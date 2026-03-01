// ── Scantech Public API Routes ──
// Token-validated endpoints for field technicians who don't have
// Google accounts. Mirrors the authenticated scantech routes.
// Mounted at /api/public/scantech BEFORE requireAuth middleware.

import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { db } from '../db.js';
import {
    scantechTokens,
    productionProjects,
    scopingForms,
    scopeAreas,
    fieldUploads,
    scanChecklists,
    scanChecklistResponses,
    users,
} from '../../shared/schema/db.js';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';

const router = Router();
const ACTIVE_BUCKET = process.env.GCS_ACTIVE_BUCKET || 's2p-active-projects';

function getStorage() {
    return new Storage();
}

// ── Token validation middleware ──
interface TokenRequest extends Request {
    scantechToken: {
        id: number;
        productionProjectId: number;
        token: string;
        techName: string;
        techEmail: string | null;
        techPhone: string | null;
    };
}

async function validateToken(req: Request, res: Response, next: Function) {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const [record] = await db
        .select()
        .from(scantechTokens)
        .where(eq(scantechTokens.token, token));

    if (!record) return res.status(404).json({ error: 'Invalid link' });
    if (!record.isActive) return res.status(410).json({ error: 'This link has been revoked' });
    if (record.expiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

    // Update access tracking
    await db
        .update(scantechTokens)
        .set({
            lastAccessedAt: new Date(),
            accessCount: (record.accessCount || 0) + 1,
            updatedAt: new Date(),
        })
        .where(eq(scantechTokens.id, record.id));

    (req as TokenRequest).scantechToken = {
        id: record.id,
        productionProjectId: record.productionProjectId,
        token: record.token,
        techName: record.techName,
        techEmail: record.techEmail,
        techPhone: record.techPhone,
    };

    next();
}

// ═══════════════════════════════════════════
// GET /:token — Project info + checklists
// ═══════════════════════════════════════════

router.get('/:token', validateToken, async (req: Request, res: Response) => {
    try {
        const { productionProjectId, techName, techEmail } = (req as TokenRequest).scantechToken;

        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, productionProjectId));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const [form] = await db
            .select()
            .from(scopingForms)
            .where(eq(scopingForms.id, project.scopingFormId));

        if (!form) return res.status(404).json({ error: 'Scoping form not found' });

        const areas = await db
            .select()
            .from(scopeAreas)
            .where(eq(scopeAreas.scopingFormId, form.id))
            .orderBy(scopeAreas.sortOrder);

        // Load checklists + responses
        const allChecklists = await db
            .select()
            .from(scanChecklists)
            .where(eq(scanChecklists.isActive, true));

        const responses = await db
            .select({
                id: scanChecklistResponses.id,
                checklistId: scanChecklistResponses.checklistId,
                responses: scanChecklistResponses.responses,
                status: scanChecklistResponses.status,
                completedAt: scanChecklistResponses.completedAt,
                createdAt: scanChecklistResponses.createdAt,
                updatedAt: scanChecklistResponses.updatedAt,
            })
            .from(scanChecklistResponses)
            .where(eq(scanChecklistResponses.productionProjectId, productionProjectId));

        const checklistSubmissions = allChecklists.map(cl => {
            const resp = responses.find(r => r.checklistId === cl.id);
            return {
                id: resp?.id || 0,
                checklistId: cl.id,
                checklistTitle: cl.title,
                checklistSlug: cl.slug,
                checklistType: cl.checklistType,
                status: resp?.status || 'in_progress',
                responses: (resp?.responses as any[]) || [],
                completedAt: resp?.completedAt?.toISOString() || null,
                respondedByName: techName,
                createdAt: resp?.createdAt?.toISOString() || '',
                updatedAt: resp?.updatedAt?.toISOString() || '',
                items: cl.items,
            };
        });

        // Load uploads
        const uploads = await db
            .select({
                id: fieldUploads.id,
                productionProjectId: fieldUploads.productionProjectId,
                filename: fieldUploads.filename,
                gcsPath: fieldUploads.gcsPath,
                bucket: fieldUploads.bucket,
                sizeBytes: fieldUploads.sizeBytes,
                contentType: fieldUploads.contentType,
                fileCategory: fieldUploads.fileCategory,
                captureMethod: fieldUploads.captureMethod,
                metadata: fieldUploads.metadata,
                notes: fieldUploads.notes,
                createdAt: fieldUploads.createdAt,
            })
            .from(fieldUploads)
            .where(eq(fieldUploads.productionProjectId, productionProjectId))
            .orderBy(desc(fieldUploads.createdAt));

        // Extract notes from stageData
        const stageData = (project.stageData || {}) as Record<string, any>;
        const notes = stageData?.scantech?.notes || [];

        // Scoping snapshot (limited for public — no pricing data)
        const scopingData = {
            clientCompany: form.clientCompany,
            projectName: form.projectName,
            projectAddress: form.projectAddress,
            numberOfFloors: form.numberOfFloors,
            basementAttic: form.basementAttic,
            bimDeliverable: form.bimDeliverable,
            era: form.era,
            roomDensity: form.roomDensity,
            riskFactors: form.riskFactors,
            areas: areas.map(a => ({
                id: a.id,
                areaType: a.areaType,
                areaName: a.areaName,
                squareFootage: a.squareFootage,
                projectScope: a.projectScope,
                lod: a.lod,
            })),
        };

        res.json({
            id: project.id,
            upid: project.upid,
            currentStage: project.currentStage,
            scopingData,
            checklists: checklistSubmissions,
            uploads: uploads.map(u => ({
                ...u,
                createdAt: u.createdAt?.toISOString() || '',
                uploadedByName: techName,
            })),
            notes,
            techName,
            techEmail,
            projectLat: form.projectLat,
            projectLng: form.projectLng,
            buildingFootprintSqft: form.buildingFootprintSqft,
            updatedAt: project.updatedAt?.toISOString() || '',
        });
    } catch (error: any) {
        console.error('Public scantech project error:', error);
        res.status(500).json({ error: error.message || 'Failed to load project' });
    }
});

// ═══════════════════════════════════════════
// GET /:token/checklists — Active checklist templates
// ═══════════════════════════════════════════

router.get('/:token/checklists', validateToken, async (_req: Request, res: Response) => {
    try {
        const checklists = await db
            .select()
            .from(scanChecklists)
            .where(eq(scanChecklists.isActive, true))
            .orderBy(scanChecklists.checklistType, scanChecklists.title);

        res.json(checklists);
    } catch (error: any) {
        console.error('Public scantech checklists error:', error);
        res.status(500).json({ error: error.message || 'Failed to load checklists' });
    }
});

// ═══════════════════════════════════════════
// POST /:token/checklist — Submit checklist responses
// ═══════════════════════════════════════════

router.post('/:token/checklist', validateToken, async (req: Request, res: Response) => {
    try {
        const { productionProjectId, techName } = (req as TokenRequest).scantechToken;
        const { checklistId, responses, status } = req.body;

        if (!checklistId || !responses) {
            return res.status(400).json({ error: 'checklistId and responses are required' });
        }

        // Add tech name metadata to responses
        const enrichedResponses = Array.isArray(responses)
            ? responses.map((r: any) => ({ ...r, respondedVia: 'scantech_link', techName }))
            : responses;

        const [existing] = await db
            .select()
            .from(scanChecklistResponses)
            .where(
                and(
                    eq(scanChecklistResponses.productionProjectId, productionProjectId),
                    eq(scanChecklistResponses.checklistId, checklistId)
                )
            );

        if (existing) {
            const [updated] = await db
                .update(scanChecklistResponses)
                .set({
                    responses: enrichedResponses,
                    status: status || existing.status,
                    respondedBy: null, // Public — no user FK
                    completedAt: status === 'complete' ? new Date() : existing.completedAt,
                    updatedAt: new Date(),
                })
                .where(eq(scanChecklistResponses.id, existing.id))
                .returning();

            return res.json(updated);
        }

        const [created] = await db
            .insert(scanChecklistResponses)
            .values({
                productionProjectId,
                checklistId,
                respondedBy: null, // Public — no user FK
                responses: enrichedResponses,
                status: status || 'in_progress',
                completedAt: status === 'complete' ? new Date() : null,
            })
            .returning();

        res.status(201).json(created);
    } catch (error: any) {
        console.error('Public scantech checklist error:', error);
        res.status(500).json({ error: error.message || 'Failed to save checklist' });
    }
});

// ═══════════════════════════════════════════
// POST /:token/upload/signed-url — GCS signed URL for direct upload
// ═══════════════════════════════════════════

router.post('/:token/upload/signed-url', validateToken, async (req: Request, res: Response) => {
    try {
        const { productionProjectId } = (req as TokenRequest).scantechToken;
        const { filename, contentType, sizeBytes, fileCategory } = req.body;

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'filename and contentType are required' });
        }

        const [project] = await db
            .select({ upid: productionProjects.upid })
            .from(productionProjects)
            .where(eq(productionProjects.id, productionProjectId));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const category = fileCategory || 'document';
        const gcsPath = `${project.upid}/field/${category}/${filename}`;

        const storage = getStorage();
        const bucket = storage.bucket(ACTIVE_BUCKET);
        const file = bucket.file(gcsPath);

        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 30 * 60 * 1000,
            contentType,
        });

        res.json({ signedUrl, gcsPath, bucket: ACTIVE_BUCKET });
    } catch (error: any) {
        console.error('Public scantech signed URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate signed URL' });
    }
});

// ═══════════════════════════════════════════
// POST /:token/upload/confirm — Confirm upload
// ═══════════════════════════════════════════

router.post('/:token/upload/confirm', validateToken, async (req: Request, res: Response) => {
    try {
        const { productionProjectId } = (req as TokenRequest).scantechToken;
        const { filename, gcsPath, bucket, sizeBytes, contentType, fileCategory, captureMethod, notes, metadata } = req.body;

        if (!filename || !gcsPath || !bucket) {
            return res.status(400).json({ error: 'filename, gcsPath, and bucket are required' });
        }

        const [upload] = await db
            .insert(fieldUploads)
            .values({
                productionProjectId,
                uploadedBy: null, // Public — no user FK
                filename,
                gcsPath,
                bucket,
                sizeBytes: String(sizeBytes || 0),
                contentType: contentType || null,
                fileCategory: fileCategory || 'document',
                captureMethod: captureMethod || null,
                metadata: metadata || null,
                notes: notes || null,
            })
            .returning();

        res.status(201).json(upload);
    } catch (error: any) {
        console.error('Public scantech upload confirm error:', error);
        res.status(500).json({ error: error.message || 'Failed to confirm upload' });
    }
});

// ═══════════════════════════════════════════
// POST /:token/notes — Save field notes
// ═══════════════════════════════════════════

router.post('/:token/notes', validateToken, async (req: Request, res: Response) => {
    try {
        const { productionProjectId } = (req as TokenRequest).scantechToken;
        const { notes } = req.body;

        if (!notes) return res.status(400).json({ error: 'notes array is required' });

        const [project] = await db
            .select({ stageData: productionProjects.stageData })
            .from(productionProjects)
            .where(eq(productionProjects.id, productionProjectId));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const stageData = (project.stageData || {}) as Record<string, any>;
        stageData.scantech = stageData.scantech || {};
        stageData.scantech.notes = notes;

        await db
            .update(productionProjects)
            .set({ stageData, updatedAt: new Date() })
            .where(eq(productionProjects.id, productionProjectId));

        res.json({ ok: true, noteCount: notes.length });
    } catch (error: any) {
        console.error('Public scantech notes error:', error);
        res.status(500).json({ error: error.message || 'Failed to save notes' });
    }
});

export { router as scantechPublicRouter };
