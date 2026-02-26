// ── Upload Shares Routes ──
// Authenticated endpoints for creating/managing share links.
// Public endpoints for external users to upload files via token.

import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { db } from '../db.js';
import { uploadShares, uploadShareFiles, productionProjects } from '../../shared/schema/db.js';
import { eq, and, sql } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const DEFAULT_STAGING_BUCKET = process.env.GCS_STAGING_BUCKET || 's2p-incoming-staging';

function getStorage() {
    return new Storage();
}

function generateToken(): string {
    return crypto.randomBytes(24).toString('base64url');
}

// ═══════════════════════════════════════════
// Authenticated Endpoints (behind requireAuth)
// ═══════════════════════════════════════════

// POST /api/upload-shares — Create a new share link
router.post('/', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { projectId, label, expiresInDays, maxUploadBytes } = req.body;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        // Verify project exists
        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, projectId));
        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        const token = generateToken();
        const days = expiresInDays || 7;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        // Build target prefix from project UPID
        const targetPrefix = `${project.upid}/`;

        const [share] = await db
            .insert(uploadShares)
            .values({
                productionProjectId: projectId,
                token,
                label: label || null,
                targetBucket: DEFAULT_STAGING_BUCKET,
                targetPrefix,
                createdBy: authReq.user?.id ?? null,
                expiresAt,
                maxUploadBytes: maxUploadBytes ? String(maxUploadBytes) : null,
            })
            .returning();

        res.status(201).json({
            ...share,
            uploadUrl: `/upload/${share.token}`,
        });
    } catch (error: any) {
        console.error('Create share error:', error);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

// GET /api/upload-shares?projectId=X — List shares for a project
router.get('/', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.query.projectId as string, 10);
        if (!projectId || isNaN(projectId)) {
            return res.status(400).json({ error: 'projectId query param is required' });
        }

        const shares = await db
            .select()
            .from(uploadShares)
            .where(eq(uploadShares.productionProjectId, projectId))
            .orderBy(sql`${uploadShares.createdAt} DESC`);

        res.json(shares);
    } catch (error: any) {
        console.error('List shares error:', error);
        res.status(500).json({ error: 'Failed to list share links' });
    }
});

// DELETE /api/upload-shares/:id — Revoke a share link
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [updated] = await db
            .update(uploadShares)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(uploadShares.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ error: 'Share not found' });
        }

        res.json({ message: 'Share link revoked', id });
    } catch (error: any) {
        console.error('Revoke share error:', error);
        res.status(500).json({ error: 'Failed to revoke share link' });
    }
});

// GET /api/upload-shares/:id/files — List files uploaded to a share
router.get('/:id/files', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const files = await db
            .select()
            .from(uploadShareFiles)
            .where(eq(uploadShareFiles.shareId, id))
            .orderBy(sql`${uploadShareFiles.uploadedAt} DESC`);

        res.json(files);
    } catch (error: any) {
        console.error('List share files error:', error);
        res.status(500).json({ error: 'Failed to list uploaded files' });
    }
});

// ═══════════════════════════════════════════
// Public Endpoints (no auth required — token validated)
// Mounted separately in index.ts before requireAuth
// ═══════════════════════════════════════════

export const uploadSharePublicRouter = Router();

// GET /api/public/upload/:token — Get share info
uploadSharePublicRouter.get('/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const [share] = await db
            .select()
            .from(uploadShares)
            .where(and(
                eq(uploadShares.token, token),
                eq(uploadShares.isActive, true),
            ));

        if (!share) {
            return res.status(404).json({ error: 'Share link not found or has been revoked' });
        }

        if (new Date() > share.expiresAt) {
            return res.status(410).json({ error: 'Share link has expired' });
        }

        // Get project name
        const [project] = await db
            .select({ upid: productionProjects.upid })
            .from(productionProjects)
            .where(eq(productionProjects.id, share.productionProjectId));

        // Get uploaded files
        const files = await db
            .select()
            .from(uploadShareFiles)
            .where(eq(uploadShareFiles.shareId, share.id))
            .orderBy(sql`${uploadShareFiles.uploadedAt} DESC`);

        res.json({
            id: share.id,
            label: share.label,
            projectUpid: project?.upid || 'Unknown',
            targetBucket: share.targetBucket,
            expiresAt: share.expiresAt,
            maxUploadBytes: share.maxUploadBytes,
            totalUploadedBytes: share.totalUploadedBytes,
            uploadCount: share.uploadCount,
            files: files.map(f => ({
                filename: f.filename,
                sizeBytes: f.sizeBytes,
                contentType: f.contentType,
                uploadedByName: f.uploadedByName,
                uploadedAt: f.uploadedAt,
            })),
        });
    } catch (error: any) {
        console.error('Public share info error:', error);
        res.status(500).json({ error: 'Failed to get share info' });
    }
});

// POST /api/public/upload/:token/signed-url — Generate signed upload URL
uploadSharePublicRouter.post('/:token/signed-url', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { filename, contentType, sizeBytes, uploaderName } = req.body;

        if (!filename) {
            return res.status(400).json({ error: 'filename is required' });
        }

        const [share] = await db
            .select()
            .from(uploadShares)
            .where(and(
                eq(uploadShares.token, token),
                eq(uploadShares.isActive, true),
            ));

        if (!share) {
            return res.status(404).json({ error: 'Share link not found or revoked' });
        }

        if (new Date() > share.expiresAt) {
            return res.status(410).json({ error: 'Share link has expired' });
        }

        // Check size limit
        if (share.maxUploadBytes && sizeBytes) {
            const currentTotal = parseInt(share.totalUploadedBytes || '0', 10);
            const max = parseInt(share.maxUploadBytes, 10);
            if (currentTotal + sizeBytes > max) {
                return res.status(413).json({ error: 'Upload would exceed size limit' });
            }
        }

        // Generate signed upload URL
        const storage = getStorage();
        const gcsPath = `${share.targetPrefix}${filename}`;
        const file = storage.bucket(share.targetBucket).file(gcsPath);

        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 30 * 60 * 1000, // 30 minutes
            contentType: contentType || 'application/octet-stream',
        });

        res.json({
            signedUrl,
            gcsPath,
            bucket: share.targetBucket,
        });
    } catch (error: any) {
        console.error('Generate signed URL error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// POST /api/public/upload/:token/confirm — Confirm upload completed
uploadSharePublicRouter.post('/:token/confirm', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { filename, gcsPath, sizeBytes, contentType, uploaderName } = req.body;

        if (!filename || !gcsPath || !sizeBytes) {
            return res.status(400).json({ error: 'filename, gcsPath, and sizeBytes are required' });
        }

        const [share] = await db
            .select()
            .from(uploadShares)
            .where(and(
                eq(uploadShares.token, token),
                eq(uploadShares.isActive, true),
            ));

        if (!share) {
            return res.status(404).json({ error: 'Share link not found or revoked' });
        }

        // Record the file
        const [file] = await db
            .insert(uploadShareFiles)
            .values({
                shareId: share.id,
                filename,
                gcsPath,
                sizeBytes: String(sizeBytes),
                contentType: contentType || null,
                uploadedByName: uploaderName || null,
            })
            .returning();

        // Update counters
        const currentTotal = parseInt(share.totalUploadedBytes || '0', 10);
        await db
            .update(uploadShares)
            .set({
                totalUploadedBytes: String(currentTotal + parseInt(String(sizeBytes), 10)),
                uploadCount: (share.uploadCount || 0) + 1,
                updatedAt: new Date(),
            })
            .where(eq(uploadShares.id, share.id));

        res.json({
            message: 'Upload confirmed',
            file: {
                id: file.id,
                filename: file.filename,
                sizeBytes: file.sizeBytes,
            },
        });
    } catch (error: any) {
        console.error('Confirm upload error:', error);
        res.status(500).json({ error: 'Failed to confirm upload' });
    }
});

export default router;
