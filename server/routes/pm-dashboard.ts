// ── PM Dashboard Routes (Phase 19) ──
// Aggregated field data for Project Manager "Mission Control" view.
// Single endpoint returns all field uploads, checklists, notes in one response.
// Signed download URLs for direct GCS file access (no Express proxy for large files).

import { Router, type Request, type Response } from 'express';
import { Storage } from '@google-cloud/storage';
import { db } from '../db.js';
import {
    productionProjects,
    scopingForms,
    scopeAreas,
    fieldUploads,
    scanChecklists,
    scanChecklistResponses,
    users,
} from '../../shared/schema/db.js';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import type {
    PMFieldSummary,
    FieldUploadRecord,
    ChecklistResponse,
    ChecklistItemDef,
    FieldNote,
    ScantechScopingSnapshot,
} from '../../shared/types/scantech.js';

const router = Router();

function getStorage() {
    return new Storage();
}

// ── GET /api/pm/projects/:id/field-summary ──
// Single aggregated endpoint — runs JOINs across field_uploads, scan_checklists,
// scan_checklist_responses, scoping_forms, and production_projects.
router.get('/projects/:id/field-summary', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }

        // ── 1. Load production project ──
        const [project] = await db
            .select({
                id: productionProjects.id,
                scopingFormId: productionProjects.scopingFormId,
                upid: productionProjects.upid,
                currentStage: productionProjects.currentStage,
                stageData: productionProjects.stageData,
                projectName: scopingForms.projectName,
                clientCompany: scopingForms.clientCompany,
                projectAddress: scopingForms.projectAddress,
            })
            .from(productionProjects)
            .innerJoin(scopingForms, eq(productionProjects.scopingFormId, scopingForms.id))
            .where(eq(productionProjects.id, projectId));

        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        // ── 2. Load scoping snapshot ──
        let scopingData: ScantechScopingSnapshot | null = null;
        try {
            const [form] = await db
                .select()
                .from(scopingForms)
                .where(eq(scopingForms.id, project.scopingFormId));

            if (form) {
                const areas = await db
                    .select({
                        id: scopeAreas.id,
                        areaType: scopeAreas.areaType,
                        areaName: scopeAreas.areaName,
                        squareFootage: scopeAreas.squareFootage,
                        projectScope: scopeAreas.projectScope,
                        lod: scopeAreas.lod,
                    })
                    .from(scopeAreas)
                    .where(eq(scopeAreas.scopingFormId, form.id));

                scopingData = {
                    clientCompany: form.clientCompany,
                    projectName: form.projectName,
                    projectAddress: form.projectAddress,
                    email: form.email,
                    primaryContactName: form.primaryContactName,
                    contactPhone: form.contactPhone,
                    numberOfFloors: form.numberOfFloors,
                    basementAttic: form.basementAttic as string[] | null,
                    bimDeliverable: form.bimDeliverable,
                    bimVersion: form.bimVersion,
                    georeferencing: form.georeferencing,
                    era: form.era,
                    roomDensity: form.roomDensity,
                    riskFactors: (form.riskFactors || []) as string[],
                    dispatchLocation: form.dispatchLocation,
                    oneWayMiles: form.oneWayMiles,
                    travelMode: form.travelMode,
                    pricingTier: form.pricingTier,
                    estScanDays: form.estScanDays,
                    techsPlanned: form.techsPlanned,
                    landscapeModeling: form.landscapeModeling,
                    scanRegOnly: form.scanRegOnly,
                    expedited: form.expedited,
                    estTimeline: form.estTimeline,
                    paymentTerms: form.paymentTerms,
                    internalNotes: form.internalNotes,
                    areas,
                };
            }
        } catch {
            // Non-fatal — PM dashboard still useful without scoping data
        }

        // ── 3. Load field uploads with category rollup ──
        const uploadsRaw = await db
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
                uploadedByName: users.displayName,
            })
            .from(fieldUploads)
            .leftJoin(users, eq(fieldUploads.uploadedBy, users.id))
            .where(eq(fieldUploads.productionProjectId, projectId))
            .orderBy(desc(fieldUploads.createdAt));

        // Category rollup
        const categoryMap = new Map<string, { count: number; totalBytes: bigint }>();
        for (const u of uploadsRaw) {
            const cat = u.fileCategory;
            const existing = categoryMap.get(cat) || { count: 0, totalBytes: BigInt(0) };
            existing.count++;
            existing.totalBytes += BigInt(u.sizeBytes || '0');
            categoryMap.set(cat, existing);
        }

        const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category: category as FieldUploadRecord['fileCategory'],
            count: data.count,
            totalBytes: data.totalBytes.toString(),
        }));

        // Recent uploads (last 10)
        const recentUploads: FieldUploadRecord[] = uploadsRaw.slice(0, 10).map(u => ({
            id: u.id,
            productionProjectId: u.productionProjectId,
            filename: u.filename,
            gcsPath: u.gcsPath,
            bucket: u.bucket,
            sizeBytes: u.sizeBytes,
            contentType: u.contentType,
            fileCategory: u.fileCategory as FieldUploadRecord['fileCategory'],
            captureMethod: u.captureMethod as FieldUploadRecord['captureMethod'],
            metadata: u.metadata as Record<string, unknown> | null,
            notes: u.notes,
            createdAt: u.createdAt.toISOString(),
            uploadedByName: u.uploadedByName || undefined,
        }));

        // ── 4. Load checklist data ──
        const templates = await db
            .select()
            .from(scanChecklists)
            .where(eq(scanChecklists.isActive, true));

        const responses = await db
            .select({
                id: scanChecklistResponses.id,
                checklistId: scanChecklistResponses.checklistId,
                respondedBy: scanChecklistResponses.respondedBy,
                responses: scanChecklistResponses.responses,
                status: scanChecklistResponses.status,
                completedAt: scanChecklistResponses.completedAt,
                createdAt: scanChecklistResponses.createdAt,
                updatedAt: scanChecklistResponses.updatedAt,
                respondedByName: users.displayName,
            })
            .from(scanChecklistResponses)
            .leftJoin(users, eq(scanChecklistResponses.respondedBy, users.id))
            .where(eq(scanChecklistResponses.productionProjectId, projectId));

        const checklists = templates.map(t => {
            const items = (t.items || []) as ChecklistItemDef[];
            const resp = responses.find(r => r.checklistId === t.id);
            const respItems = resp ? (resp.responses as ChecklistResponse[]) : [];

            const completedItems = respItems.filter(r => r.checked).length;
            const requiredItems = items.filter(i => i.required).length;
            const requiredCompleted = items
                .filter(i => i.required)
                .filter(i => respItems.find(r => r.itemId === i.itemId && r.checked))
                .length;

            return {
                id: t.id,
                slug: t.slug,
                title: t.title,
                checklistType: t.checklistType,
                totalItems: items.length,
                completedItems,
                requiredItems,
                requiredCompleted,
                status: resp?.status || 'not_started',
                respondedByName: resp?.respondedByName || null,
                completedAt: resp?.completedAt?.toISOString() || null,
                updatedAt: resp?.updatedAt?.toISOString() || null,
            };
        });

        // ── 5. Load field notes from stageData ──
        const stageData = (project.stageData || {}) as Record<string, any>;
        const allNotes: FieldNote[] = stageData?.scantech?.notes || [];
        const sortedNotes = [...allNotes].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // ── 6. Assemble response ──
        const result: PMFieldSummary = {
            projectId: project.id,
            upid: project.upid,
            projectName: project.projectName,
            clientCompany: project.clientCompany,
            projectAddress: project.projectAddress,
            currentStage: project.currentStage,

            checklists,

            uploads: {
                total: uploadsRaw.length,
                byCategory,
                recentUploads,
            },

            notes: {
                total: sortedNotes.length,
                recent: sortedNotes.slice(0, 5),
                aiAssistedCount: sortedNotes.filter(n => n.aiAssisted).length,
            },

            scopingData,
            fieldCaptureData: stageData?.field_capture || stageData?.fieldCapture || null,
        };

        res.json(result);
    } catch (error: any) {
        console.error('PM field summary error:', error);
        res.status(500).json({ error: error.message || 'Failed to load field summary' });
    }
});

// ── GET /api/pm/projects/:id/uploads ──
// Full upload list with pagination (for when PM needs to see everything)
router.get('/projects/:id/uploads', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const category = req.query.category as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset = parseInt(req.query.offset as string) || 0;

        let query = db
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
                uploadedByName: users.displayName,
            })
            .from(fieldUploads)
            .leftJoin(users, eq(fieldUploads.uploadedBy, users.id))
            .where(
                category
                    ? and(
                        eq(fieldUploads.productionProjectId, projectId),
                        eq(fieldUploads.fileCategory, category),
                    )
                    : eq(fieldUploads.productionProjectId, projectId),
            )
            .orderBy(desc(fieldUploads.createdAt))
            .limit(limit)
            .offset(offset);

        const rows = await query;

        // Get total count
        const [countResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(fieldUploads)
            .where(
                category
                    ? and(
                        eq(fieldUploads.productionProjectId, projectId),
                        eq(fieldUploads.fileCategory, category),
                    )
                    : eq(fieldUploads.productionProjectId, projectId),
            );

        res.json({
            uploads: rows.map(u => ({
                ...u,
                fileCategory: u.fileCategory as FieldUploadRecord['fileCategory'],
                captureMethod: u.captureMethod as FieldUploadRecord['captureMethod'],
                metadata: u.metadata as Record<string, unknown> | null,
                createdAt: u.createdAt.toISOString(),
            })),
            total: countResult?.count || 0,
            limit,
            offset,
        });
    } catch (error: any) {
        console.error('PM uploads list error:', error);
        res.status(500).json({ error: error.message || 'Failed to list uploads' });
    }
});

// ── GET /api/pm/projects/:id/uploads/:uploadId/download ──
// Generate a signed download URL for a field upload (1-hour expiry).
// PM clicks "Download" → browser fetches directly from GCS.
router.get('/projects/:id/uploads/:uploadId/download', async (req: Request, res: Response) => {
    try {
        const uploadId = parseInt(req.params.uploadId, 10);
        const projectId = parseInt(req.params.id, 10);

        const [upload] = await db
            .select()
            .from(fieldUploads)
            .where(
                and(
                    eq(fieldUploads.id, uploadId),
                    eq(fieldUploads.productionProjectId, projectId),
                ),
            );

        if (!upload) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        const storage = getStorage();
        const [signedUrl] = await storage
            .bucket(upload.bucket)
            .file(upload.gcsPath)
            .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

        res.json({
            url: signedUrl,
            filename: upload.filename,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
    } catch (error: any) {
        console.error('PM download URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate download URL' });
    }
});

// ── GET /api/pm/projects/:id/uploads/:uploadId/thumbnail ──
// Generate a signed URL for photo/video thumbnails (15-min expiry, shorter for previews).
router.get('/projects/:id/uploads/:uploadId/thumbnail', async (req: Request, res: Response) => {
    try {
        const uploadId = parseInt(req.params.uploadId, 10);
        const projectId = parseInt(req.params.id, 10);

        const [upload] = await db
            .select()
            .from(fieldUploads)
            .where(
                and(
                    eq(fieldUploads.id, uploadId),
                    eq(fieldUploads.productionProjectId, projectId),
                ),
            );

        if (!upload) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        // Only generate thumbnails for images/videos
        const isMedia = upload.fileCategory === 'photo' || upload.fileCategory === 'video';
        if (!isMedia) {
            return res.status(400).json({ error: 'Thumbnails only available for photos and videos' });
        }

        const storage = getStorage();
        const [signedUrl] = await storage
            .bucket(upload.bucket)
            .file(upload.gcsPath)
            .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            });

        res.json({
            url: signedUrl,
            filename: upload.filename,
            contentType: upload.contentType,
        });
    } catch (error: any) {
        console.error('PM thumbnail URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate thumbnail URL' });
    }
});

export default router;
