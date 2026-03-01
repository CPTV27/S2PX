/**
 * sidecarWriter.ts
 *
 * Writes / updates the project.json sidecar file in a project's GCS folder.
 * Called by routes whenever project data changes:
 *   - Upload confirmation (new files added)
 *   - Production stage changes
 *   - Scoping form updates
 *   - Quote / proposal creation
 *
 * The sidecar is a self-describing "full project record" that lives alongside
 * the project files in GCS, so every folder carries its own context.
 */

import { Storage } from '@google-cloud/storage';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const ACTIVE_BUCKET = process.env.GCS_ACTIVE_BUCKET || 's2p-active-projects';
const SIDECAR_FILENAME = 'project.json';

let storage: Storage | null = null;
try {
    storage = new Storage();
} catch {
    console.warn('[s2px:sidecar] GCS not configured — sidecar writes disabled');
}

// ═══════════════════════════════════════════════════════════════
// ── File Helpers ──
// ═══════════════════════════════════════════════════════════════

function categorizeFile(ext: string): string {
    ext = ext.toLowerCase();
    const pc = ['e57', 'las', 'laz', 'pts', 'ptx', 'xyz', 'ply', 'pcd', 'rcp', 'rcs'];
    const bim = ['rvt', 'rfa', 'rte', 'rft', 'dwg', 'dxf', 'ifc', 'nwd', 'nwc', 'nwf', 'skp', '3dm'];
    const rw = ['rwp', 'rlp', 'rwi'];
    const photo = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp', 'heic', 'raw', 'cr2', 'nef'];
    const archive = ['zip', 'rar', '7z', 'tar', 'gz'];
    const doc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf'];

    if (pc.includes(ext)) return 'Point Cloud';
    if (bim.includes(ext)) return 'BIM / CAD';
    if (rw.includes(ext)) return 'Realworks';
    if (photo.includes(ext)) return 'Photos';
    if (archive.includes(ext)) return 'Archives';
    if (doc.includes(ext)) return 'Documents';
    return 'Other';
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ═══════════════════════════════════════════════════════════════
// ── Core: Write Sidecar for a Production Project ──
// ═══════════════════════════════════════════════════════════════

/**
 * Regenerate and upload the project.json sidecar for a given production project.
 * Looks up the project's UPID, finds the matching GCS folder, loads full context
 * from DB, scans the file inventory, and writes the sidecar.
 *
 * @param productionProjectId - the production_projects.id
 * @param options.folderOverride - explicit GCS folder prefix (skips folder discovery)
 */
export async function writeSidecar(
    productionProjectId: number,
    options?: { folderOverride?: string }
): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!storage) {
        return { success: false, error: 'GCS not configured' };
    }

    try {
        // ── Load project + scoping form ──
        const projRes = await db.execute(sql`
            SELECT
                pp.id, pp.upid, pp.current_stage, pp.stage_data,
                pp.created_at as pp_created_at,
                sf.id as sf_id, sf.status, sf.client_company, sf.project_name,
                sf.project_address, sf.project_lat, sf.project_lng,
                sf.building_footprint_sqft, sf.email,
                sf.primary_contact_name, sf.contact_email, sf.contact_phone,
                sf.billing_contact_name, sf.billing_email,
                sf.number_of_floors, sf.era, sf.room_density, sf.risk_factors,
                sf.bim_deliverable, sf.bim_version, sf.georeferencing,
                sf.expedited, sf.landscape_modeling,
                sf.dispatch_location, sf.one_way_miles, sf.travel_mode,
                sf.pricing_tier, sf.bim_manager, sf.scanner_assignment,
                sf.est_scan_days, sf.techs_planned,
                sf.lead_source, sf.internal_notes,
                sf.deal_stage, sf.priority,
                sf.created_at as sf_created_at
            FROM production_projects pp
            JOIN scoping_forms sf ON sf.id = pp.scoping_form_id
            WHERE pp.id = ${productionProjectId}
        `);

        if (projRes.rows.length === 0) {
            return { success: false, error: `Production project ${productionProjectId} not found` };
        }

        const row: any = projRes.rows[0];
        const upid = row.upid;

        // ── Find GCS folder ──
        let folderPrefix = options?.folderOverride;

        if (!folderPrefix) {
            // Search for a folder containing the UPID
            const bucket = storage.bucket(ACTIVE_BUCKET);
            const [, , apiResp] = await bucket.getFiles({
                delimiter: '/',
                autoPaginate: false,
            });
            const prefixes: string[] = (apiResp as any)?.prefixes || [];

            // Try matching by UPID or project name
            folderPrefix = prefixes.find(p => p.includes(upid));

            if (!folderPrefix) {
                // Try fuzzy match on project name
                const projNorm = (row.project_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const compNorm = (row.client_company || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                folderPrefix = prefixes.find(p => {
                    const pNorm = p.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return (projNorm.length > 3 && pNorm.includes(projNorm)) ||
                           (compNorm.length > 3 && pNorm.includes(compNorm));
                });
            }

            if (!folderPrefix) {
                return { success: false, error: `No GCS folder found for UPID ${upid}` };
            }
        }

        // Ensure trailing slash
        if (!folderPrefix.endsWith('/')) folderPrefix += '/';
        const folderName = folderPrefix.replace(/\/$/, '');

        // ── Load scope areas ──
        const areasRes = await db.execute(sql`
            SELECT area_type, area_name, square_footage, project_scope, lod, cad_deliverable
            FROM scope_areas
            WHERE scoping_form_id = ${row.sf_id}
            ORDER BY sort_order
        `);

        // ── Load quotes ──
        const quotesRes = await db.execute(sql`
            SELECT id, version, integrity_status, totals, line_items, created_at
            FROM quotes
            WHERE scoping_form_id = ${row.sf_id}
            ORDER BY version
        `);

        // ── Load proposals ──
        const proposalsRes = await db.execute(sql`
            SELECT id, status, version, sent_to, sent_at, viewed_at, pdf_url, created_at
            FROM proposals
            WHERE scoping_form_id = ${row.sf_id}
            ORDER BY version
        `);

        // ── Scan file inventory ──
        const bucket = storage.bucket(ACTIVE_BUCKET);
        const [folderFiles] = await bucket.getFiles({ prefix: folderPrefix });

        const files = folderFiles
            .filter(f => !f.name.endsWith('/') && f.name.split('/').pop() !== SIDECAR_FILENAME)
            .map(f => ({
                name: f.name,
                size: Number(f.metadata.size) || 0,
                contentType: f.metadata.contentType || 'application/octet-stream',
                updated: f.metadata.updated ? String(f.metadata.updated) : null,
            }));

        // Build file inventory stats
        let totalSize = 0;
        const fileEntries: any[] = [];
        const subfolderMap = new Map<string, { files: { size: number }[] }>();
        const categoryMap = new Map<string, { count: number; totalSize: number }>();

        for (const file of files) {
            const relativePath = file.name.substring(folderPrefix.length);
            const fileName = relativePath.split('/').pop() || relativePath;
            const ext = fileName.split('.').pop() || '';
            const category = categorizeFile(ext);
            totalSize += file.size;

            fileEntries.push({
                name: fileName,
                path: relativePath,
                size: file.size,
                sizeFormatted: formatBytes(file.size),
                contentType: file.contentType,
                category,
                lastModified: file.updated,
            });

            const parts = relativePath.split('/');
            if (parts.length > 1) {
                const subfolder = parts[0];
                if (!subfolderMap.has(subfolder)) subfolderMap.set(subfolder, { files: [] });
                subfolderMap.get(subfolder)!.files.push({ size: file.size });
            }

            const catEntry = categoryMap.get(category) || { count: 0, totalSize: 0 };
            catEntry.count++;
            catEntry.totalSize += file.size;
            categoryMap.set(category, catEntry);
        }

        const subfolders = Array.from(subfolderMap.entries()).map(([name, data]) => ({
            name,
            path: `${folderName}/${name}/`,
            fileCount: data.files.length,
            totalSize: data.files.reduce((s, f) => s + f.size, 0),
            totalSizeFormatted: formatBytes(data.files.reduce((s, f) => s + f.size, 0)),
        })).sort((a, b) => b.totalSize - a.totalSize);

        const filesByCategory: Record<string, any> = {};
        for (const [cat, data] of categoryMap.entries()) {
            filesByCategory[cat] = { count: data.count, totalSize: data.totalSize, totalSizeFormatted: formatBytes(data.totalSize) };
        }

        // ── Build timeline ──
        const timeline: any[] = [];

        timeline.push({
            event: 'Scoping form created',
            date: row.sf_created_at instanceof Date ? row.sf_created_at.toISOString() : String(row.sf_created_at),
            detail: `Deal stage: ${row.deal_stage}`,
        });

        for (const q of quotesRes.rows as any[]) {
            const totals = q.totals || {};
            timeline.push({
                event: `Quote v${q.version || 1} created`,
                date: q.created_at instanceof Date ? q.created_at.toISOString() : String(q.created_at),
                detail: totals.totalClientPrice ? `Client price: $${totals.totalClientPrice}` : undefined,
            });
        }

        for (const p of proposalsRes.rows as any[]) {
            timeline.push({
                event: `Proposal ${p.status}`,
                date: (p.sent_at || p.created_at) instanceof Date
                    ? (p.sent_at || p.created_at).toISOString()
                    : String(p.sent_at || p.created_at),
                detail: p.sent_to ? `Sent to: ${p.sent_to}` : undefined,
            });
        }

        timeline.push({
            event: 'Entered production',
            date: row.pp_created_at instanceof Date ? row.pp_created_at.toISOString() : String(row.pp_created_at),
            detail: `Stage: ${row.current_stage}`,
        });

        // Extract scan date from folder
        const dateMatch = folderName.match(/(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch) {
            timeline.push({
                event: 'Scan date (from folder)',
                date: `${dateMatch[1]}T00:00:00.000Z`,
            });
        }

        timeline.sort((a: any, b: any) => a.date.localeCompare(b.date));

        // ── Assemble sidecar ──
        const sidecar = {
            _schema: 'S2PX-ProjectSidecar-v1',
            _generatedAt: new Date().toISOString(),
            _generator: 'sidecarWriter',

            folderName,
            bucket: ACTIVE_BUCKET,
            upid,
            scanDate: dateMatch ? dateMatch[1] : null,

            client: {
                company: row.client_company,
                primaryContact: row.primary_contact_name,
                contactEmail: row.contact_email,
                contactPhone: row.contact_phone,
                billingContact: row.billing_contact_name,
                billingEmail: row.billing_email,
            },

            project: {
                name: row.project_name,
                address: row.project_address,
                lat: row.project_lat ? parseFloat(row.project_lat) : null,
                lng: row.project_lng ? parseFloat(row.project_lng) : null,
                footprintSqft: row.building_footprint_sqft,
            },

            scoping: {
                id: row.sf_id,
                status: row.status,
                dealStage: row.deal_stage,
                priority: row.priority,
                numberOfFloors: row.number_of_floors,
                era: row.era,
                roomDensity: row.room_density,
                riskFactors: row.risk_factors || [],
                bimDeliverable: row.bim_deliverable,
                bimVersion: row.bim_version,
                georeferencing: row.georeferencing,
                expedited: row.expedited,
                landscapeModeling: row.landscape_modeling,
                dispatchLocation: row.dispatch_location,
                oneWayMiles: row.one_way_miles,
                travelMode: row.travel_mode,
                pricingTier: row.pricing_tier,
                bimManager: row.bim_manager,
                scannerAssignment: row.scanner_assignment,
                estScanDays: row.est_scan_days,
                techsPlanned: row.techs_planned,
                leadSource: row.lead_source,
                internalNotes: row.internal_notes,
                areas: (areasRes.rows as any[]).map(a => ({
                    areaType: a.area_type,
                    areaName: a.area_name,
                    squareFootage: a.square_footage,
                    projectScope: a.project_scope,
                    lod: a.lod,
                    cadDeliverable: a.cad_deliverable,
                })),
            },

            quotes: (quotesRes.rows as any[]).map(q => {
                const totals = q.totals || {};
                const lineItems = Array.isArray(q.line_items) ? q.line_items : [];
                return {
                    id: q.id,
                    version: q.version,
                    integrityStatus: q.integrity_status,
                    totalClientPrice: totals.totalClientPrice ?? null,
                    totalUpteamCost: totals.totalUpteamCost ?? null,
                    grossMarginPercent: totals.grossMarginPercent ?? null,
                    lineItemCount: lineItems.length,
                    createdAt: q.created_at instanceof Date ? q.created_at.toISOString() : String(q.created_at),
                };
            }),

            proposals: (proposalsRes.rows as any[]).map(p => ({
                id: p.id,
                status: p.status,
                version: p.version,
                sentTo: p.sent_to,
                sentAt: p.sent_at instanceof Date ? p.sent_at.toISOString() : p.sent_at || null,
                viewedAt: p.viewed_at instanceof Date ? p.viewed_at.toISOString() : p.viewed_at || null,
                pdfUrl: p.pdf_url,
                createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
            })),

            production: {
                id: row.id,
                currentStage: row.current_stage,
                stageData: row.stage_data || {},
            },

            fileInventory: {
                totalFiles: fileEntries.length,
                totalSize,
                totalSizeFormatted: formatBytes(totalSize),
                subfolders,
                filesByCategory,
                files: fileEntries,
            },

            timeline,
        };

        // ── Write to GCS ──
        const sidecarPath = `${folderPrefix}${SIDECAR_FILENAME}`;
        const file = bucket.file(sidecarPath);
        await file.save(JSON.stringify(sidecar, null, 2), {
            contentType: 'application/json',
            metadata: {
                cacheControl: 'no-cache',
                customMetadata: {
                    'x-s2px-sidecar': 'true',
                    'x-s2px-schema': 'S2PX-ProjectSidecar-v1',
                },
            },
        });

        console.log(`[s2px:sidecar] Updated ${sidecarPath} (${fileEntries.length} files, ${formatBytes(totalSize)})`);
        return { success: true, path: sidecarPath };

    } catch (err: any) {
        console.error(`[s2px:sidecar] Error writing sidecar for project ${productionProjectId}:`, err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fire-and-forget sidecar update. Logs errors but never throws.
 * Use this in routes where sidecar update is a nice-to-have, not critical.
 */
export function updateSidecarAsync(productionProjectId: number, folderOverride?: string): void {
    writeSidecar(productionProjectId, folderOverride ? { folderOverride } : undefined)
        .catch(err => console.error(`[s2px:sidecar] Async update failed:`, err.message));
}
