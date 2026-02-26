import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

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

// GET /api/projects/:id — single project (must be defined AFTER /gcs/* routes)
router.get('/:id(\\d+)', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const results = await db.execute(sql`
            SELECT
                pp.id,
                pp.scoping_form_id as lead_id,
                sf.project_name,
                sf.client_company as client_name,
                pp.current_stage as status,
                pp.created_at,
                pp.stage_data
            FROM production_projects pp
            JOIN scoping_forms sf ON sf.id = pp.scoping_form_id
            WHERE pp.id = ${id}
        `);

        if (results.rows.length === 0) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const row: any = results.rows[0];
        res.json({
            id: row.id,
            leadId: row.lead_id,
            projectName: row.project_name,
            clientName: row.client_name,
            status: row.status,
            scanDate: row.stage_data?.fieldCapture?.scanDate || undefined,
            deliveryDate: row.stage_data?.finalDelivery?.deliveryDate || undefined,
            deliverableType: undefined,
            potreePath: undefined,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : String(row.created_at),
        });
    } catch (error: any) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
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
