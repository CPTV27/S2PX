#!/usr/bin/env npx tsx
/**
 * generate-sidecars.ts
 *
 * Creates a `project.json` sidecar file in every project folder in the
 * s2p-active-projects GCS bucket. Each sidecar is a "full project record"
 * containing:
 *   - UPID, client info, scoping form data, scope areas
 *   - Quote summaries, proposal status
 *   - Production pipeline stage data
 *   - Complete file inventory with metadata (size, type, modified date)
 *   - Timeline of key events
 *
 * For folders that don't yet have matching DB records, the sidecar
 * still captures the file inventory + folder metadata so every project
 * folder in GCS is self-describing.
 *
 * Run with:
 *   npx tsx server/scripts/generate-sidecars.ts
 *
 * Options:
 *   --dry-run     Print what would be written, don't upload
 *   --folder X    Only generate for a specific folder prefix
 */

import pg from 'pg';
import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_OgSaq5wyUi6E@ep-winter-lab-ah4py7xl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const BUCKET_NAME = process.env.GCS_ACTIVE_BUCKET || 's2p-active-projects';
const SIDECAR_FILENAME = 'project.json';

// ═══════════════════════════════════════════════════════════════
// ── CLI Args ──
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const folderFilterIdx = args.indexOf('--folder');
const FOLDER_FILTER = folderFilterIdx >= 0 ? args[folderFilterIdx + 1] : null;

// ═══════════════════════════════════════════════════════════════
// ── File Categorization ──
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
// ── Types ──
// ═══════════════════════════════════════════════════════════════

interface SidecarFile {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    contentType: string;
    category: string;
    lastModified: string | null;
}

interface SidecarSubfolder {
    name: string;
    path: string;
    fileCount: number;
    totalSize: number;
    totalSizeFormatted: string;
}

interface SidecarArea {
    areaType: string;
    areaName: string | null;
    squareFootage: number;
    projectScope: string;
    lod: string;
    cadDeliverable: string;
}

interface SidecarQuote {
    id: number;
    version: number | null;
    integrityStatus: string | null;
    totalClientPrice: number | null;
    totalUpteamCost: number | null;
    grossMarginPercent: number | null;
    lineItemCount: number;
    createdAt: string;
}

interface SidecarProposal {
    id: number;
    status: string;
    version: number | null;
    sentTo: string | null;
    sentAt: string | null;
    viewedAt: string | null;
    pdfUrl: string | null;
    createdAt: string;
}

interface SidecarTimeline {
    event: string;
    date: string;
    detail?: string;
}

interface ProjectSidecar {
    _schema: string;
    _generatedAt: string;
    _generator: string;

    // Identity
    folderName: string;
    bucket: string;
    upid: string | null;
    scanDate: string | null;

    // Client / Project Info
    client: {
        company: string | null;
        primaryContact: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        billingContact: string | null;
        billingEmail: string | null;
    } | null;

    project: {
        name: string | null;
        address: string | null;
        lat: number | null;
        lng: number | null;
        footprintSqft: number | null;
    } | null;

    // Scoping
    scoping: {
        id: number;
        status: string;
        dealStage: string;
        priority: number;
        numberOfFloors: number;
        era: string;
        roomDensity: number;
        riskFactors: string[];
        bimDeliverable: string;
        bimVersion: string | null;
        georeferencing: boolean;
        expedited: boolean;
        landscapeModeling: string | null;
        dispatchLocation: string;
        oneWayMiles: number;
        travelMode: string;
        pricingTier: string | null;
        bimManager: string | null;
        scannerAssignment: string | null;
        estScanDays: number | null;
        techsPlanned: number | null;
        leadSource: string;
        internalNotes: string | null;
        areas: SidecarArea[];
    } | null;

    // Quotes
    quotes: SidecarQuote[];

    // Proposals
    proposals: SidecarProposal[];

    // Production Pipeline
    production: {
        id: number;
        currentStage: string;
        stageData: Record<string, any>;
    } | null;

    // File Inventory
    fileInventory: {
        totalFiles: number;
        totalSize: number;
        totalSizeFormatted: string;
        subfolders: SidecarSubfolder[];
        filesByCategory: Record<string, { count: number; totalSize: number; totalSizeFormatted: string }>;
        files: SidecarFile[];
    };

    // Timeline
    timeline: SidecarTimeline[];
}

// ═══════════════════════════════════════════════════════════════
// ── Database Loading ──
// ═══════════════════════════════════════════════════════════════

interface DBData {
    scopingForms: any[];
    scopeAreas: any[];
    quotes: any[];
    proposals: any[];
    productionProjects: any[];
}

async function loadAllDBData(pool: pg.Pool): Promise<DBData> {
    console.log('Loading database records...');

    const [sfRes, saRes, qRes, pRes, ppRes] = await Promise.all([
        pool.query('SELECT * FROM scoping_forms ORDER BY id'),
        pool.query('SELECT * FROM scope_areas ORDER BY scoping_form_id, sort_order'),
        pool.query('SELECT * FROM quotes ORDER BY scoping_form_id, version'),
        pool.query('SELECT * FROM proposals ORDER BY scoping_form_id, version'),
        pool.query('SELECT * FROM production_projects ORDER BY id'),
    ]);

    console.log(`  Scoping forms: ${sfRes.rows.length}`);
    console.log(`  Scope areas: ${saRes.rows.length}`);
    console.log(`  Quotes: ${qRes.rows.length}`);
    console.log(`  Proposals: ${pRes.rows.length}`);
    console.log(`  Production projects: ${ppRes.rows.length}`);

    return {
        scopingForms: sfRes.rows,
        scopeAreas: saRes.rows,
        quotes: qRes.rows,
        proposals: pRes.rows,
        productionProjects: ppRes.rows,
    };
}

// ═══════════════════════════════════════════════════════════════
// ── Matching Logic ──
// ═══════════════════════════════════════════════════════════════

function normalizeForMatch(s: string): string {
    return s.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchFolderToProject(
    folderName: string,
    dbData: DBData
): { scopingForm: any | null; productionProject: any | null } {
    const folderNorm = normalizeForMatch(folderName);

    // Remove trailing date or "_undated" from folder name for matching
    const folderWithoutDate = folderName
        .replace(/_?\d{4}-\d{2}-\d{2}$/, '')
        .replace(/_undated$/, '')
        .trim();
    const folderNormNoDate = normalizeForMatch(folderWithoutDate);

    // Strategy 1: Match by UPID in folder name
    for (const pp of dbData.productionProjects) {
        if (pp.upid && folderName.includes(pp.upid)) {
            const sf = dbData.scopingForms.find((s: any) => s.id === pp.scoping_form_id);
            return { scopingForm: sf || null, productionProject: pp };
        }
    }

    // Strategy 2: Match by scoping form UPID in folder name
    for (const sf of dbData.scopingForms) {
        if (sf.upid && folderName.includes(sf.upid)) {
            const pp = dbData.productionProjects.find((p: any) => p.scoping_form_id === sf.id);
            return { scopingForm: sf, productionProject: pp || null };
        }
    }

    // Strategy 3: Match by project name
    for (const sf of dbData.scopingForms) {
        const projNorm = normalizeForMatch(sf.project_name || '');
        if (projNorm.length > 3 && folderNormNoDate.includes(projNorm)) {
            const pp = dbData.productionProjects.find((p: any) => p.scoping_form_id === sf.id);
            return { scopingForm: sf, productionProject: pp || null };
        }
    }

    // Strategy 4: Match by client company name
    for (const sf of dbData.scopingForms) {
        const compNorm = normalizeForMatch(sf.client_company || '');
        if (compNorm.length > 3 && folderNormNoDate.includes(compNorm)) {
            const pp = dbData.productionProjects.find((p: any) => p.scoping_form_id === sf.id);
            return { scopingForm: sf, productionProject: pp || null };
        }
    }

    // Strategy 5: Match by project name as substring of folder
    for (const sf of dbData.scopingForms) {
        const projWords = normalizeForMatch(sf.project_name || '').split(' ').filter((w: string) => w.length > 3);
        if (projWords.length >= 2) {
            const matchCount = projWords.filter((w: string) => folderNorm.includes(w)).length;
            if (matchCount >= Math.ceil(projWords.length * 0.7)) {
                const pp = dbData.productionProjects.find((p: any) => p.scoping_form_id === sf.id);
                return { scopingForm: sf, productionProject: pp || null };
            }
        }
    }

    return { scopingForm: null, productionProject: null };
}

// ═══════════════════════════════════════════════════════════════
// ── Build Sidecar Document ──
// ═══════════════════════════════════════════════════════════════

function buildSidecar(
    folderName: string,
    files: { name: string; size: number; contentType: string; updated: string | null }[],
    scopingForm: any | null,
    productionProject: any | null,
    dbData: DBData
): ProjectSidecar {
    // Extract scan date from folder name (handles both "Name_YYYY-MM-DD" and "projects/Name_YYYY-MM-DD")
    const dateMatch = folderName.match(/(\d{4}-\d{2}-\d{2})$/);
    const isUndated = folderName.includes('_undated');
    const scanDate = dateMatch ? dateMatch[1] : null;

    // Determine UPID
    const upid = productionProject?.upid || scopingForm?.upid || null;

    // Build file inventory
    const fileEntries: SidecarFile[] = [];
    const subfolderMap = new Map<string, { files: { size: number }[] }>();
    const categoryMap = new Map<string, { count: number; totalSize: number }>();
    let totalSize = 0;

    for (const file of files) {
        if (file.name.endsWith('/')) continue; // skip directory markers
        if (file.name.split('/').pop() === SIDECAR_FILENAME) continue; // skip existing sidecars

        const relativePath = file.name.startsWith(folderName + '/')
            ? file.name.substring(folderName.length + 1)
            : file.name;
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

        // Track subfolder stats
        const parts = relativePath.split('/');
        if (parts.length > 1) {
            const subfolder = parts[0];
            if (!subfolderMap.has(subfolder)) {
                subfolderMap.set(subfolder, { files: [] });
            }
            subfolderMap.get(subfolder)!.files.push({ size: file.size });
        }

        // Track category stats
        const catEntry = categoryMap.get(category) || { count: 0, totalSize: 0 };
        catEntry.count++;
        catEntry.totalSize += file.size;
        categoryMap.set(category, catEntry);
    }

    const subfolders: SidecarSubfolder[] = Array.from(subfolderMap.entries()).map(([name, data]) => ({
        name,
        path: `${folderName}/${name}/`,
        fileCount: data.files.length,
        totalSize: data.files.reduce((s, f) => s + f.size, 0),
        totalSizeFormatted: formatBytes(data.files.reduce((s, f) => s + f.size, 0)),
    })).sort((a, b) => b.totalSize - a.totalSize);

    const filesByCategory: Record<string, { count: number; totalSize: number; totalSizeFormatted: string }> = {};
    for (const [cat, data] of categoryMap.entries()) {
        filesByCategory[cat] = {
            count: data.count,
            totalSize: data.totalSize,
            totalSizeFormatted: formatBytes(data.totalSize),
        };
    }

    // Build client info
    const client = scopingForm ? {
        company: scopingForm.client_company || null,
        primaryContact: scopingForm.primary_contact_name || null,
        contactEmail: scopingForm.contact_email || null,
        contactPhone: scopingForm.contact_phone || null,
        billingContact: scopingForm.billing_contact_name || null,
        billingEmail: scopingForm.billing_email || null,
    } : null;

    // Build project info
    const project = scopingForm ? {
        name: scopingForm.project_name || null,
        address: scopingForm.project_address || null,
        lat: scopingForm.project_lat ? parseFloat(scopingForm.project_lat) : null,
        lng: scopingForm.project_lng ? parseFloat(scopingForm.project_lng) : null,
        footprintSqft: scopingForm.building_footprint_sqft || null,
    } : null;

    // Build scoping section
    const areas = scopingForm
        ? dbData.scopeAreas
            .filter((a: any) => a.scoping_form_id === scopingForm.id)
            .map((a: any) => ({
                areaType: a.area_type,
                areaName: a.area_name,
                squareFootage: a.square_footage,
                projectScope: a.project_scope,
                lod: a.lod,
                cadDeliverable: a.cad_deliverable,
            }))
        : [];

    const scoping = scopingForm ? {
        id: scopingForm.id,
        status: scopingForm.status,
        dealStage: scopingForm.deal_stage,
        priority: scopingForm.priority,
        numberOfFloors: scopingForm.number_of_floors,
        era: scopingForm.era,
        roomDensity: scopingForm.room_density,
        riskFactors: scopingForm.risk_factors || [],
        bimDeliverable: scopingForm.bim_deliverable,
        bimVersion: scopingForm.bim_version,
        georeferencing: scopingForm.georeferencing,
        expedited: scopingForm.expedited,
        landscapeModeling: scopingForm.landscape_modeling,
        dispatchLocation: scopingForm.dispatch_location,
        oneWayMiles: scopingForm.one_way_miles,
        travelMode: scopingForm.travel_mode,
        pricingTier: scopingForm.pricing_tier,
        bimManager: scopingForm.bim_manager,
        scannerAssignment: scopingForm.scanner_assignment,
        estScanDays: scopingForm.est_scan_days,
        techsPlanned: scopingForm.techs_planned,
        leadSource: scopingForm.lead_source,
        internalNotes: scopingForm.internal_notes,
        areas,
    } : null;

    // Build quotes
    const matchedQuotes: SidecarQuote[] = scopingForm
        ? dbData.quotes
            .filter((q: any) => q.scoping_form_id === scopingForm.id)
            .map((q: any) => {
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
            })
        : [];

    // Build proposals
    const matchedProposals: SidecarProposal[] = scopingForm
        ? dbData.proposals
            .filter((p: any) => p.scoping_form_id === scopingForm.id)
            .map((p: any) => ({
                id: p.id,
                status: p.status,
                version: p.version,
                sentTo: p.sent_to,
                sentAt: p.sent_at instanceof Date ? p.sent_at.toISOString() : p.sent_at || null,
                viewedAt: p.viewed_at instanceof Date ? p.viewed_at.toISOString() : p.viewed_at || null,
                pdfUrl: p.pdf_url,
                createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
            }))
        : [];

    // Build production
    const production = productionProject ? {
        id: productionProject.id,
        currentStage: productionProject.current_stage,
        stageData: productionProject.stage_data || {},
    } : null;

    // Build timeline
    const timeline: SidecarTimeline[] = [];

    if (scopingForm) {
        timeline.push({
            event: 'Scoping form created',
            date: scopingForm.created_at instanceof Date
                ? scopingForm.created_at.toISOString()
                : String(scopingForm.created_at),
            detail: `Deal stage: ${scopingForm.deal_stage}`,
        });
    }

    for (const q of matchedQuotes) {
        timeline.push({
            event: `Quote v${q.version || 1} created`,
            date: q.createdAt,
            detail: q.totalClientPrice ? `Client price: $${q.totalClientPrice}` : undefined,
        });
    }

    for (const p of matchedProposals) {
        timeline.push({
            event: `Proposal ${p.status}`,
            date: p.sentAt || p.createdAt,
            detail: p.sentTo ? `Sent to: ${p.sentTo}` : undefined,
        });
    }

    if (productionProject) {
        timeline.push({
            event: 'Entered production',
            date: productionProject.created_at instanceof Date
                ? productionProject.created_at.toISOString()
                : String(productionProject.created_at),
            detail: `Stage: ${productionProject.current_stage}`,
        });
    }

    if (scanDate) {
        timeline.push({
            event: 'Scan date (from folder)',
            date: `${scanDate}T00:00:00.000Z`,
        });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => a.date.localeCompare(b.date));

    return {
        _schema: 'S2PX-ProjectSidecar-v1',
        _generatedAt: new Date().toISOString(),
        _generator: 'generate-sidecars.ts',

        folderName,
        bucket: BUCKET_NAME,
        upid,
        scanDate,

        client,
        project,
        scoping,
        quotes: matchedQuotes,
        proposals: matchedProposals,
        production,

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
}

// ═══════════════════════════════════════════════════════════════
// ── Main ──
// ═══════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  S2PX Project Sidecar Generator');
    console.log('═══════════════════════════════════════════');
    console.log(`  Bucket: ${BUCKET_NAME}`);
    console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    if (FOLDER_FILTER) console.log(`  Filter: ${FOLDER_FILTER}`);
    console.log('');

    // Connect to DB
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const dbData = await loadAllDBData(pool);

    // Init GCS
    const storage = new Storage();
    const bucket = storage.bucket(BUCKET_NAME);

    // List project folders (they live under projects/ prefix)
    console.log('\nListing GCS project folders...');
    const PROJECT_PREFIX = 'projects/';
    const prefixes: string[] = [];
    let pageToken: string | undefined;

    do {
        const opts: any = {
            prefix: PROJECT_PREFIX,
            delimiter: '/',
            autoPaginate: false,
        };
        if (pageToken) opts.pageToken = pageToken;

        const [, , apiResponse] = await bucket.getFiles(opts);
        const pagePrefixes: string[] = (apiResponse as any)?.prefixes || [];
        prefixes.push(...pagePrefixes);
        pageToken = (apiResponse as any)?.nextPageToken;
    } while (pageToken);

    console.log(`  Found ${prefixes.length} project folders`);

    let processedCount = 0;
    let matchedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const prefix of prefixes) {
        const folderName = prefix.replace(/\/$/, '');          // e.g. "projects/100-Mine-Hill-Rd-Fairfield_2024-08-16"
        const displayName = folderName.replace(/^projects\//, ''); // e.g. "100-Mine-Hill-Rd-Fairfield_2024-08-16"

        // Apply filter if specified
        if (FOLDER_FILTER && !displayName.includes(FOLDER_FILTER)) {
            continue;
        }

        processedCount++;

        try {
            // Match folder to DB records (use displayName for matching)
            const { scopingForm, productionProject } = matchFolderToProject(displayName, dbData);
            if (scopingForm || productionProject) matchedCount++;

            // List all files in this folder
            const [folderFiles] = await bucket.getFiles({
                prefix: prefix,
            });

            const files = folderFiles
                .filter(f => !f.name.endsWith('/'))
                .map(f => ({
                    name: f.name,
                    size: Number(f.metadata.size) || 0,
                    contentType: f.metadata.contentType || 'application/octet-stream',
                    updated: f.metadata.updated ? String(f.metadata.updated) : null,
                }));

            // Build sidecar (use full GCS folderName for paths, displayName for matching)
            const sidecar = buildSidecar(folderName, files, scopingForm, productionProject, dbData);

            const sidecarJson = JSON.stringify(sidecar, null, 2);
            const sidecarPath = `${prefix}${SIDECAR_FILENAME}`;

            const matchTag = scopingForm ? ` ✅ matched → ${scopingForm.project_name || scopingForm.client_company}` : '';
            const prodTag = productionProject ? ` 🏗️ in production (${productionProject.current_stage})` : '';

            if (DRY_RUN) {
                console.log(`  [${processedCount}] ${displayName} — ${files.length} files, ${formatBytes(sidecar.fileInventory.totalSize)}${matchTag}${prodTag}`);
            } else {
                // Upload sidecar to GCS
                const file = bucket.file(sidecarPath);
                await file.save(sidecarJson, {
                    contentType: 'application/json',
                    metadata: {
                        cacheControl: 'no-cache',
                        customMetadata: {
                            'x-s2px-sidecar': 'true',
                            'x-s2px-schema': 'S2PX-ProjectSidecar-v1',
                        },
                    },
                });

                console.log(`  [${processedCount}/${prefixes.length}] ${displayName} — ${files.length} files, ${formatBytes(sidecar.fileInventory.totalSize)}${matchTag}${prodTag}`);
            }

            // Throttle: don't hammer GCS
            if (processedCount % 50 === 0) {
                console.log(`\n  ... progress: ${processedCount}/${prefixes.length} folders ...\n`);
            }

        } catch (err: any) {
            errorCount++;
            console.error(`  ❌ [${processedCount}] ${displayName} — ERROR: ${err.message}`);
        }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`  Total folders processed: ${processedCount}`);
    console.log(`  Matched to DB records:   ${matchedCount}`);
    console.log(`  Unmatched (file-only):   ${processedCount - matchedCount - errorCount}`);
    console.log(`  Errors:                  ${errorCount}`);
    console.log(`  Mode:                    ${DRY_RUN ? 'DRY RUN (nothing uploaded)' : 'LIVE (sidecars uploaded)'}`);
    console.log('');

    await pool.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
