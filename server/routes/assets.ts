// ── Project Assets Routes ──
// Link GCS paths to production projects, browse linked folders, get asset metadata.

import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { db } from '../db.js';
import { projectAssets, productionProjects } from '../../shared/schema/db.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

const ALLOWED_BUCKETS = [
    's2p-active-projects',
    's2p-incoming-staging',
    's2p-quarantine',
    's2p-core-vault',
];

function getStorage() {
    return new Storage();
}

// ── Link a GCS path to a production project ──
router.post('/:projectId/assets', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        const { bucket, gcsPath, label, assetType } = req.body;

        if (!bucket || !gcsPath) {
            return res.status(400).json({ error: 'bucket and gcsPath are required' });
        }
        if (!ALLOWED_BUCKETS.includes(bucket)) {
            return res.status(400).json({ error: `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}` });
        }

        // Verify project exists
        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, projectId));
        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        // Scan GCS for file count and total size
        let fileCount: number | null = null;
        let totalSizeBytes: string | null = null;
        try {
            const storage = getStorage();
            const [files] = await storage.bucket(bucket).getFiles({
                prefix: gcsPath.endsWith('/') ? gcsPath : `${gcsPath}/`,
                maxResults: 5000,
            });
            fileCount = files.length;
            totalSizeBytes = files
                .reduce((sum, f) => sum + parseInt(f.metadata.size || '0', 10), 0)
                .toString();
        } catch {
            // GCS scan failed — link anyway, counts will be null
        }

        const [asset] = await db
            .insert(projectAssets)
            .values({
                productionProjectId: projectId,
                bucket,
                gcsPath,
                label: label || null,
                assetType: assetType || 'folder',
                fileCount,
                totalSizeBytes,
            })
            .returning();

        res.status(201).json(asset);
    } catch (error: any) {
        console.error('Link asset error:', error);
        res.status(500).json({ error: error.message || 'Failed to link asset' });
    }
});

// ── List linked assets for a production project ──
router.get('/:projectId/assets', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        const assets = await db
            .select()
            .from(projectAssets)
            .where(eq(projectAssets.productionProjectId, projectId))
            .orderBy(desc(projectAssets.linkedAt));

        res.json(assets);
    } catch (error: any) {
        console.error('List assets error:', error);
        res.status(500).json({ error: error.message || 'Failed to list assets' });
    }
});

// ── Refresh asset metadata (re-scan GCS for counts) ──
router.post('/:projectId/assets/:assetId/refresh', async (req: Request, res: Response) => {
    try {
        const assetId = parseInt(req.params.assetId, 10);

        const [asset] = await db
            .select()
            .from(projectAssets)
            .where(eq(projectAssets.id, assetId));
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const storage = getStorage();
        const prefix = asset.gcsPath.endsWith('/') ? asset.gcsPath : `${asset.gcsPath}/`;
        const [files] = await storage.bucket(asset.bucket).getFiles({
            prefix,
            maxResults: 5000,
        });

        const fileCount = files.length;
        const totalSizeBytes = files
            .reduce((sum, f) => sum + parseInt(f.metadata.size || '0', 10), 0)
            .toString();

        const [updated] = await db
            .update(projectAssets)
            .set({ fileCount, totalSizeBytes })
            .where(eq(projectAssets.id, assetId))
            .returning();

        res.json(updated);
    } catch (error: any) {
        console.error('Refresh asset error:', error);
        res.status(500).json({ error: error.message || 'Failed to refresh asset' });
    }
});

// ── Browse contents of a linked asset folder ──
router.get('/:projectId/assets/:assetId/browse', async (req: Request, res: Response) => {
    try {
        const assetId = parseInt(req.params.assetId, 10);
        const subPath = (req.query.path as string) || '';

        const [asset] = await db
            .select()
            .from(projectAssets)
            .where(eq(projectAssets.id, assetId));
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const storage = getStorage();
        const basePath = asset.gcsPath.endsWith('/') ? asset.gcsPath : `${asset.gcsPath}/`;
        const fullPrefix = subPath ? `${basePath}${subPath}` : basePath;

        const [files, , apiResponse] = await storage.bucket(asset.bucket).getFiles({
            prefix: fullPrefix,
            delimiter: '/',
            maxResults: 500,
            autoPaginate: false,
        });

        // Folders (prefixes)
        const prefixes: string[] = (apiResponse as any)?.prefixes || [];
        const folders = prefixes.map(p => {
            const relative = p.replace(basePath, '');
            const name = relative.replace(/\/$/, '').split('/').pop() || relative;
            return { name, path: relative, type: 'folder' as const };
        });

        // Files (exclude the prefix itself)
        const fileEntries = files
            .filter(f => f.name !== fullPrefix)
            .map(f => {
                const relative = f.name.replace(basePath, '');
                const name = relative.split('/').pop() || relative;
                return {
                    name,
                    path: relative,
                    type: 'file' as const,
                    size: parseInt(f.metadata.size || '0', 10),
                    contentType: f.metadata.contentType || 'application/octet-stream',
                    updated: f.metadata.updated || null,
                };
            });

        res.json({
            basePath: asset.gcsPath,
            currentPath: subPath || '',
            folders,
            files: fileEntries,
        });
    } catch (error: any) {
        console.error('Browse asset error:', error);
        res.status(500).json({ error: error.message || 'Failed to browse asset' });
    }
});

// ── Get a signed download URL for a file in a linked asset ──
router.get('/:projectId/assets/:assetId/download', async (req: Request, res: Response) => {
    try {
        const assetId = parseInt(req.params.assetId, 10);
        const filePath = req.query.path as string;

        if (!filePath) {
            return res.status(400).json({ error: 'path query parameter is required' });
        }

        const [asset] = await db
            .select()
            .from(projectAssets)
            .where(eq(projectAssets.id, assetId));
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const storage = getStorage();
        const basePath = asset.gcsPath.endsWith('/') ? asset.gcsPath : `${asset.gcsPath}/`;
        const fullPath = `${basePath}${filePath}`;

        const [signedUrl] = await storage
            .bucket(asset.bucket)
            .file(fullPath)
            .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

        res.json({ url: signedUrl, filename: filePath.split('/').pop() });
    } catch (error: any) {
        console.error('Download asset error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate download URL' });
    }
});

// ── Unlink an asset ──
router.delete('/:projectId/assets/:assetId', async (req: Request, res: Response) => {
    try {
        const assetId = parseInt(req.params.assetId, 10);

        const [deleted] = await db
            .delete(projectAssets)
            .where(eq(projectAssets.id, assetId))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        res.json({ message: 'Asset unlinked', id: assetId });
    } catch (error: any) {
        console.error('Unlink asset error:', error);
        res.status(500).json({ error: error.message || 'Failed to unlink asset' });
    }
});

export default router;
