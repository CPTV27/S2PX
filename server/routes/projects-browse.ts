import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { projectAssets } from '../../shared/schema/db.js';
import { eq } from 'drizzle-orm';

const router = Router();

let storage: Storage | null = null;
try {
    storage = new Storage();
} catch {
    console.warn('[s2px] GCS not configured — project browsing will be limited');
}

const DEFAULT_BUCKET = process.env.GCS_PROJECT_BUCKET || 's2p-active-projects';

// ── Database Projects ──

// GET /api/projects — list production projects as Project type
router.get('/', async (_req: Request, res: Response) => {
    try {
        const results = await db.execute(sql`
            SELECT
                pp.id,
                pp.scoping_form_id as lead_id,
                sf.project_name,
                sf.client_company as client_name,
                sf.project_address,
                pp.current_stage as status,
                pp.created_at,
                pp.stage_data
            FROM production_projects pp
            JOIN scoping_forms sf ON sf.id = pp.scoping_form_id
            ORDER BY pp.updated_at DESC
        `);

        const projects = results.rows.map((row: any) => ({
            id: row.id,
            leadId: row.lead_id,
            projectName: row.project_name,
            clientName: row.client_name,
            projectAddress: row.project_address || undefined,
            status: row.status,
            scanDate: row.stage_data?.fieldCapture?.scanDate || undefined,
            deliveryDate: row.stage_data?.finalDelivery?.deliveryDate || undefined,
            deliverableType: undefined,
            potreePath: undefined,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : String(row.created_at),
        }));

        res.json(projects);
    } catch (error: any) {
        console.error('List projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET /api/projects/:id — full project detail with scoping form + assets
router.get('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const results = await db.execute(sql`
            SELECT
                pp.id,
                pp.scoping_form_id as lead_id,
                pp.upid,
                pp.current_stage as status,
                pp.stage_data,
                pp.created_at,
                pp.updated_at as pp_updated_at,
                sf.project_name,
                sf.client_company,
                sf.project_address,
                sf.project_lat,
                sf.project_lng,
                sf.building_footprint_sqft,
                sf.email,
                sf.primary_contact_name,
                sf.contact_email,
                sf.contact_phone,
                sf.billing_same_as_primary,
                sf.billing_contact_name,
                sf.billing_email,
                sf.billing_phone,
                sf.number_of_floors,
                sf.basement_attic,
                sf.est_sf_basement_attic,
                sf.insurance_requirements,
                sf.landscape_modeling,
                sf.landscape_acres,
                sf.landscape_terrain,
                sf.bim_deliverable,
                sf.bim_version,
                sf.custom_template,
                sf.georeferencing,
                sf.era,
                sf.room_density,
                sf.risk_factors,
                sf.scan_reg_only,
                sf.expedited,
                sf.dispatch_location,
                sf.one_way_miles,
                sf.travel_mode,
                sf.est_timeline,
                sf.project_timeline,
                sf.timeline_notes,
                sf.payment_terms,
                sf.lead_source,
                sf.probability,
                sf.deal_stage,
                sf.priority,
                sf.pricing_tier,
                sf.bim_manager,
                sf.scanner_assignment,
                sf.est_scan_days,
                sf.techs_planned,
                sf.internal_notes
            FROM production_projects pp
            JOIN scoping_forms sf ON sf.id = pp.scoping_form_id
            WHERE pp.id = ${id}
        `);

        if (results.rows.length === 0) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const row: any = results.rows[0];

        // Fetch linked assets
        const assets = await db
            .select()
            .from(projectAssets)
            .where(eq(projectAssets.productionProjectId, id));

        res.json({
            project: {
                id: row.id,
                leadId: row.lead_id,
                upid: row.upid,
                projectName: row.project_name,
                clientName: row.client_company,
                projectAddress: row.project_address || undefined,
                status: row.status,
                scanDate: row.stage_data?.fieldCapture?.scanDate || undefined,
                deliveryDate: row.stage_data?.finalDelivery?.deliveryDate || undefined,
                createdAt: row.created_at instanceof Date
                    ? row.created_at.toISOString()
                    : String(row.created_at),
            },
            scopingForm: {
                clientCompany: row.client_company,
                projectName: row.project_name,
                projectAddress: row.project_address,
                projectLat: row.project_lat,
                projectLng: row.project_lng,
                buildingFootprintSqft: row.building_footprint_sqft,
                email: row.email,
                primaryContactName: row.primary_contact_name,
                contactEmail: row.contact_email,
                contactPhone: row.contact_phone,
                billingSameAsPrimary: row.billing_same_as_primary,
                billingContactName: row.billing_contact_name,
                billingEmail: row.billing_email,
                billingPhone: row.billing_phone,
                numberOfFloors: row.number_of_floors,
                basementAttic: row.basement_attic,
                estSfBasementAttic: row.est_sf_basement_attic,
                insuranceRequirements: row.insurance_requirements,
                landscapeModeling: row.landscape_modeling,
                landscapeAcres: row.landscape_acres,
                landscapeTerrain: row.landscape_terrain,
                bimDeliverable: row.bim_deliverable,
                bimVersion: row.bim_version,
                customTemplate: row.custom_template,
                georeferencing: row.georeferencing,
                era: row.era,
                roomDensity: row.room_density,
                riskFactors: row.risk_factors,
                scanRegOnly: row.scan_reg_only,
                expedited: row.expedited,
                dispatchLocation: row.dispatch_location,
                oneWayMiles: row.one_way_miles,
                travelMode: row.travel_mode,
                estTimeline: row.est_timeline,
                projectTimeline: row.project_timeline,
                timelineNotes: row.timeline_notes,
                paymentTerms: row.payment_terms,
                leadSource: row.lead_source,
                probability: row.probability,
                dealStage: row.deal_stage,
                priority: row.priority,
                pricingTier: row.pricing_tier,
                bimManager: row.bim_manager,
                scannerAssignment: row.scanner_assignment,
                estScanDays: row.est_scan_days,
                techsPlanned: row.techs_planned,
                internalNotes: row.internal_notes,
            },
            stageData: row.stage_data || {},
            assets: assets.map(a => ({
                id: a.id,
                bucket: a.bucket,
                gcsPath: a.gcsPath,
                label: a.label,
                assetType: a.assetType,
                fileCount: a.fileCount,
                totalSizeBytes: a.totalSizeBytes,
                linkedAt: a.linkedAt instanceof Date ? a.linkedAt.toISOString() : String(a.linkedAt),
            })),
        });
    } catch (error: any) {
        console.error('Get project detail error:', error);
        res.status(500).json({ error: 'Failed to fetch project detail' });
    }
});

// ── GCS Project Folder Browsing ──

function requireGCS(res: Response): boolean {
    if (!storage) {
        res.status(503).json({ error: 'GCS not configured' });
        return false;
    }
    return true;
}

// GET /api/projects/gcs/folders — list top-level project folders
router.get('/gcs/folders', async (req: Request, res: Response) => {
    if (!requireGCS(res)) return;
    try {
        const bucketName = (req.query.bucket as string) || DEFAULT_BUCKET;
        const bucket = storage!.bucket(bucketName);

        const [, , apiResponse] = await bucket.getFiles({
            delimiter: '/',
            autoPaginate: false,
        });

        const prefixes: string[] = (apiResponse as any)?.prefixes || [];

        const folders = prefixes.map(prefix => {
            const name = prefix.replace(/\/$/, '');
            const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})$/);
            return {
                name,
                scanDate: dateMatch ? dateMatch[1] : 'undated',
                folderPath: prefix,
                bucket: bucketName,
            };
        });

        folders.sort((a, b) => {
            if (a.scanDate === 'undated' && b.scanDate === 'undated') return a.name.localeCompare(b.name);
            if (a.scanDate === 'undated') return 1;
            if (b.scanDate === 'undated') return -1;
            return b.scanDate.localeCompare(a.scanDate);
        });

        res.json(folders);
    } catch (error: any) {
        console.error('List GCS folders error:', error);
        res.status(500).json({ error: 'Failed to list project folders' });
    }
});

// GET /api/projects/gcs/browse — browse folder contents
router.get('/gcs/browse', async (req: Request, res: Response) => {
    if (!requireGCS(res)) return;
    try {
        const bucketName = req.query.bucket as string;
        const path = req.query.path as string;

        if (!bucketName || !path) {
            res.status(400).json({ error: 'bucket and path are required' });
            return;
        }

        const bucket = storage!.bucket(bucketName);
        const [files, , apiResponse] = await bucket.getFiles({
            prefix: path,
            delimiter: '/',
            autoPaginate: false,
        });

        const prefixes: string[] = (apiResponse as any)?.prefixes || [];
        const entries: any[] = [];

        // Subfolders
        for (const prefix of prefixes) {
            const name = prefix.replace(path, '').replace(/\/$/, '');
            if (name) {
                entries.push({ name, fullPath: prefix, isFolder: true });
            }
        }

        // Files (metadata comes from listing — no extra API call)
        for (const file of files) {
            const name = file.name.replace(path, '');
            if (name && !name.endsWith('/')) {
                entries.push({
                    name,
                    fullPath: file.name,
                    isFolder: false,
                    size: Number(file.metadata.size) || 0,
                    contentType: file.metadata.contentType || 'application/octet-stream',
                    updated: file.metadata.updated || undefined,
                });
            }
        }

        res.json(entries);
    } catch (error: any) {
        console.error('Browse GCS folder error:', error);
        res.status(500).json({ error: 'Failed to browse folder' });
    }
});

// GET /api/projects/gcs/download — signed download URL
router.get('/gcs/download', async (req: Request, res: Response) => {
    if (!requireGCS(res)) return;
    try {
        const bucketName = req.query.bucket as string;
        const filePath = req.query.path as string;

        if (!bucketName || !filePath) {
            res.status(400).json({ error: 'bucket and path are required' });
            return;
        }

        const [url] = await storage!.bucket(bucketName).file(filePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
        });

        res.json({ url });
    } catch (error: any) {
        console.error('GCS download URL error:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});

// GET /api/projects/gcs/analytics — compute analytics across all projects
router.get('/gcs/analytics', async (req: Request, res: Response) => {
    if (!requireGCS(res)) return;
    try {
        const bucketName = (req.query.bucket as string) || DEFAULT_BUCKET;
        const [files] = await storage!.bucket(bucketName).getFiles();

        const projectMap = new Map<string, { files: { size: number }[]; scanDate: string }>();
        const fileCats = new Map<string, { count: number; totalSize: number }>();
        const fileExts = new Map<string, { count: number; totalSize: number }>();
        const folderTypes = new Map<string, Set<string>>();
        const projectsByMonth = new Map<string, number>();

        let totalFiles = 0;
        let totalSize = 0;
        let earliestDate = 'unknown';
        let latestDate = 'unknown';

        for (const file of files) {
            const parts = file.name.split('/');
            if (parts.length < 2) continue;

            const projectFolder = parts[0];
            if (!projectMap.has(projectFolder)) {
                const dateMatch = projectFolder.match(/(\d{4}-\d{2}-\d{2})$/);
                const scanDate = dateMatch ? dateMatch[1] : 'undated';
                projectMap.set(projectFolder, { files: [], scanDate });

                if (scanDate !== 'undated') {
                    const month = scanDate.substring(0, 7);
                    projectsByMonth.set(month, (projectsByMonth.get(month) || 0) + 1);
                    if (earliestDate === 'unknown' || scanDate < earliestDate) earliestDate = scanDate;
                    if (latestDate === 'unknown' || scanDate > latestDate) latestDate = scanDate;
                }
            }

            if (file.name.endsWith('/')) continue;

            const size = Number(file.metadata.size) || 0;
            totalFiles++;
            totalSize += size;
            projectMap.get(projectFolder)!.files.push({ size });

            const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            const cat = categorizeFile(ext);

            const ce = fileCats.get(cat) || { count: 0, totalSize: 0 };
            ce.count++; ce.totalSize += size;
            fileCats.set(cat, ce);

            const ee = fileExts.get(ext) || { count: 0, totalSize: 0 };
            ee.count++; ee.totalSize += size;
            fileExts.set(ext, ee);

            if (parts.length >= 3 && parts[1]) {
                if (!folderTypes.has(parts[1])) folderTypes.set(parts[1], new Set());
                folderTypes.get(parts[1])!.add(projectFolder);
            }
        }

        const topProjects = Array.from(projectMap.entries())
            .map(([name, p]) => ({
                name,
                scanDate: p.scanDate,
                totalSize: p.files.reduce((s, f) => s + f.size, 0),
                fileCount: p.files.length,
            }))
            .sort((a, b) => b.totalSize - a.totalSize);

        res.json({
            totalProjects: projectMap.size,
            totalFiles,
            totalSizeBytes: totalSize,
            dateRange: { earliest: earliestDate, latest: latestDate },
            projectsByMonth: Array.from(projectsByMonth.entries())
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => a.month.localeCompare(b.month)),
            fileCategories: Array.from(fileCats.entries())
                .map(([category, data]) => ({ category, ...data }))
                .sort((a, b) => b.totalSize - a.totalSize),
            fileExtensions: Array.from(fileExts.entries())
                .map(([ext, data]) => ({ ext, ...data }))
                .sort((a, b) => b.totalSize - a.totalSize),
            topProjectsBySize: topProjects.slice(0, 20),
            avgFilesPerProject: projectMap.size > 0 ? Math.round(totalFiles / projectMap.size) : 0,
            avgProjectSizeBytes: projectMap.size > 0 ? Math.round(totalSize / projectMap.size) : 0,
            folderTypes: Array.from(folderTypes.entries())
                .map(([folder, projects]) => ({ folder, projectCount: projects.size }))
                .sort((a, b) => b.projectCount - a.projectCount),
            computedAt: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('GCS analytics error:', error);
        res.status(500).json({ error: 'Failed to compute analytics' });
    }
});

function categorizeFile(ext: string): string {
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

export default router;
