// ── Scantech API Routes (Phase 18) ──
// Mobile field operations: projects, checklists, uploads, notes, AI assistant.

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
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const ACTIVE_BUCKET = process.env.GCS_ACTIVE_BUCKET || 's2p-active-projects';

function getStorage() {
    return new Storage();
}

// ═══════════════════════════════════════════
// Route 1: GET /projects — List field-relevant projects
// ═══════════════════════════════════════════

router.get('/projects', async (req: Request, res: Response) => {
    try {
        const projects = await db
            .select({
                id: productionProjects.id,
                scopingFormId: productionProjects.scopingFormId,
                upid: productionProjects.upid,
                currentStage: productionProjects.currentStage,
                stageData: productionProjects.stageData,
                updatedAt: productionProjects.updatedAt,
                // Scoping form fields
                projectName: scopingForms.projectName,
                clientCompany: scopingForms.clientCompany,
                projectAddress: scopingForms.projectAddress,
                projectLat: scopingForms.projectLat,
                projectLng: scopingForms.projectLng,
                buildingFootprintSqft: scopingForms.buildingFootprintSqft,
            })
            .from(productionProjects)
            .innerJoin(scopingForms, eq(productionProjects.scopingFormId, scopingForms.id))
            .where(
                inArray(productionProjects.currentStage, ['scheduling', 'field_capture'])
            )
            .orderBy(desc(productionProjects.updatedAt));

        // Get upload counts and checklist progress for all projects
        const projectIds = projects.map(p => p.id);

        let uploadCounts: Record<number, number> = {};
        let checklistProgress: Record<number, { total: number; completed: number }> = {};

        if (projectIds.length > 0) {
            // Upload counts
            const uploads = await db
                .select({
                    projectId: fieldUploads.productionProjectId,
                    count: sql<number>`count(*)::int`,
                })
                .from(fieldUploads)
                .where(inArray(fieldUploads.productionProjectId, projectIds))
                .groupBy(fieldUploads.productionProjectId);

            for (const u of uploads) {
                uploadCounts[u.projectId] = u.count;
            }

            // Checklist progress
            const responses = await db
                .select({
                    projectId: scanChecklistResponses.productionProjectId,
                    total: sql<number>`count(*)::int`,
                    completed: sql<number>`count(*) filter (where ${scanChecklistResponses.status} = 'complete')::int`,
                })
                .from(scanChecklistResponses)
                .where(inArray(scanChecklistResponses.productionProjectId, projectIds))
                .groupBy(scanChecklistResponses.productionProjectId);

            for (const r of responses) {
                checklistProgress[r.projectId] = { total: r.total, completed: r.completed };
            }
        }

        // Get first area's building type for each project
        const areaTypes: Record<number, string | null> = {};
        if (projectIds.length > 0) {
            const firstAreas = await db
                .select({
                    scopingFormId: scopeAreas.scopingFormId,
                    areaType: scopeAreas.areaType,
                })
                .from(scopeAreas)
                .where(
                    inArray(
                        scopeAreas.scopingFormId,
                        projects.map(p => p.scopingFormId)
                    )
                )
                .orderBy(scopeAreas.sortOrder);

            // Take first area per scoping form
            const seen = new Set<number>();
            for (const a of firstAreas) {
                if (!seen.has(a.scopingFormId)) {
                    seen.add(a.scopingFormId);
                    // Map scopingFormId back to projectId
                    const proj = projects.find(p => p.scopingFormId === a.scopingFormId);
                    if (proj) areaTypes[proj.id] = a.areaType;
                }
            }
        }

        const result = projects.map(p => ({
            id: p.id,
            scopingFormId: p.scopingFormId,
            upid: p.upid,
            currentStage: p.currentStage,
            projectName: p.projectName,
            clientCompany: p.clientCompany,
            projectAddress: p.projectAddress,
            projectLat: p.projectLat,
            projectLng: p.projectLng,
            buildingFootprintSqft: p.buildingFootprintSqft,
            buildingType: areaTypes[p.id] || null,
            uploadCount: uploadCounts[p.id] || 0,
            checklistProgress: checklistProgress[p.id] || { total: 0, completed: 0 },
            updatedAt: p.updatedAt?.toISOString() || new Date().toISOString(),
        }));

        res.json(result);
    } catch (error: any) {
        console.error('Scantech projects list error:', error);
        res.status(500).json({ error: error.message || 'Failed to list projects' });
    }
});

// ═══════════════════════════════════════════
// Route 2: GET /projects/:id — Full project detail
// ═══════════════════════════════════════════

router.get('/projects/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid project ID' });

        // Load production project + scoping form
        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, id));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const [form] = await db
            .select()
            .from(scopingForms)
            .where(eq(scopingForms.id, project.scopingFormId));

        if (!form) return res.status(404).json({ error: 'Scoping form not found' });

        // Load scope areas
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
                respondedByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
            })
            .from(scanChecklistResponses)
            .leftJoin(users, eq(scanChecklistResponses.respondedBy, users.id))
            .where(eq(scanChecklistResponses.productionProjectId, id));

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
                respondedByName: resp?.respondedByName || null,
                createdAt: resp?.createdAt?.toISOString() || '',
                updatedAt: resp?.updatedAt?.toISOString() || '',
                items: cl.items, // include template items for rendering
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
                uploadedByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
            })
            .from(fieldUploads)
            .leftJoin(users, eq(fieldUploads.uploadedBy, users.id))
            .where(eq(fieldUploads.productionProjectId, id))
            .orderBy(desc(fieldUploads.createdAt));

        // Extract notes from stageData
        const stageData = (project.stageData || {}) as Record<string, any>;
        const notes = stageData?.scantech?.notes || [];

        // Build scoping snapshot
        const scopingData = {
            clientCompany: form.clientCompany,
            projectName: form.projectName,
            projectAddress: form.projectAddress,
            email: form.email,
            primaryContactName: form.primaryContactName,
            contactPhone: form.contactPhone,
            numberOfFloors: form.numberOfFloors,
            basementAttic: form.basementAttic,
            bimDeliverable: form.bimDeliverable,
            bimVersion: form.bimVersion,
            georeferencing: form.georeferencing,
            era: form.era,
            roomDensity: form.roomDensity,
            riskFactors: form.riskFactors,
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
            scopingFormId: project.scopingFormId,
            upid: project.upid,
            currentStage: project.currentStage,
            stageData,
            scopingData,
            checklists: checklistSubmissions,
            uploads: uploads.map(u => ({
                ...u,
                createdAt: u.createdAt?.toISOString() || '',
            })),
            notes,
            projectLat: form.projectLat,
            projectLng: form.projectLng,
            buildingFootprintSqft: form.buildingFootprintSqft,
            updatedAt: project.updatedAt?.toISOString() || '',
        });
    } catch (error: any) {
        console.error('Scantech project detail error:', error);
        res.status(500).json({ error: error.message || 'Failed to load project' });
    }
});

// ═══════════════════════════════════════════
// Route 3: GET /checklists — Active checklist templates
// ═══════════════════════════════════════════

router.get('/checklists', async (_req: Request, res: Response) => {
    try {
        const checklists = await db
            .select()
            .from(scanChecklists)
            .where(eq(scanChecklists.isActive, true))
            .orderBy(scanChecklists.checklistType, scanChecklists.title);

        res.json(checklists);
    } catch (error: any) {
        console.error('Scantech checklists error:', error);
        res.status(500).json({ error: error.message || 'Failed to load checklists' });
    }
});

// ═══════════════════════════════════════════
// Route 4: POST /projects/:id/checklist — Submit/update checklist responses
// ═══════════════════════════════════════════

router.post('/projects/:id/checklist', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const authReq = req as AuthenticatedRequest;
        const { checklistId, responses, status } = req.body;

        if (!checklistId || !responses) {
            return res.status(400).json({ error: 'checklistId and responses are required' });
        }

        // Check if response already exists for this project + checklist
        const [existing] = await db
            .select()
            .from(scanChecklistResponses)
            .where(
                and(
                    eq(scanChecklistResponses.productionProjectId, projectId),
                    eq(scanChecklistResponses.checklistId, checklistId)
                )
            );

        if (existing) {
            // Update
            const [updated] = await db
                .update(scanChecklistResponses)
                .set({
                    responses,
                    status: status || existing.status,
                    respondedBy: authReq.user?.id ?? existing.respondedBy,
                    completedAt: status === 'complete' ? new Date() : existing.completedAt,
                    updatedAt: new Date(),
                })
                .where(eq(scanChecklistResponses.id, existing.id))
                .returning();

            return res.json(updated);
        }

        // Insert
        const [created] = await db
            .insert(scanChecklistResponses)
            .values({
                productionProjectId: projectId,
                checklistId,
                respondedBy: authReq.user?.id ?? null,
                responses,
                status: status || 'in_progress',
                completedAt: status === 'complete' ? new Date() : null,
            })
            .returning();

        res.status(201).json(created);
    } catch (error: any) {
        console.error('Scantech checklist submit error:', error);
        res.status(500).json({ error: error.message || 'Failed to save checklist' });
    }
});

// ═══════════════════════════════════════════
// Route 5: POST /projects/:id/upload/signed-url — Generate GCS signed URL
// ═══════════════════════════════════════════

router.post('/projects/:id/upload/signed-url', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { filename, contentType, sizeBytes, fileCategory } = req.body;

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'filename and contentType are required' });
        }

        // Look up project UPID
        const [project] = await db
            .select({ upid: productionProjects.upid })
            .from(productionProjects)
            .where(eq(productionProjects.id, projectId));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const category = fileCategory || 'document';
        const gcsPath = `${project.upid}/field/${category}/${filename}`;

        const storage = getStorage();
        const bucket = storage.bucket(ACTIVE_BUCKET);
        const file = bucket.file(gcsPath);

        const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 30 * 60 * 1000, // 30 minutes
            contentType,
        });

        res.json({
            signedUrl,
            gcsPath,
            bucket: ACTIVE_BUCKET,
        });
    } catch (error: any) {
        console.error('Scantech signed URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate signed URL' });
    }
});

// ═══════════════════════════════════════════
// Route 6: POST /projects/:id/upload/confirm — Confirm upload complete
// ═══════════════════════════════════════════

router.post('/projects/:id/upload/confirm', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const authReq = req as AuthenticatedRequest;
        const { filename, gcsPath, bucket, sizeBytes, contentType, fileCategory, captureMethod, notes, metadata } = req.body;

        if (!filename || !gcsPath || !bucket) {
            return res.status(400).json({ error: 'filename, gcsPath, and bucket are required' });
        }

        const [upload] = await db
            .insert(fieldUploads)
            .values({
                productionProjectId: projectId,
                uploadedBy: authReq.user?.id ?? null,
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
        console.error('Scantech upload confirm error:', error);
        res.status(500).json({ error: error.message || 'Failed to confirm upload' });
    }
});

// ═══════════════════════════════════════════
// Route 7: POST /projects/:id/notes — Save field notes
// ═══════════════════════════════════════════

router.post('/projects/:id/notes', async (req: Request, res: Response) => {
    try {
        const projectId = parseInt(req.params.id, 10);
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({ error: 'notes array is required' });
        }

        // Merge notes into stageData.scantech
        const [project] = await db
            .select({ stageData: productionProjects.stageData })
            .from(productionProjects)
            .where(eq(productionProjects.id, projectId));

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const stageData = (project.stageData || {}) as Record<string, any>;
        stageData.scantech = stageData.scantech || {};
        stageData.scantech.notes = notes;

        await db
            .update(productionProjects)
            .set({
                stageData,
                updatedAt: new Date(),
            })
            .where(eq(productionProjects.id, projectId));

        res.json({ ok: true, noteCount: notes.length });
    } catch (error: any) {
        console.error('Scantech notes save error:', error);
        res.status(500).json({ error: error.message || 'Failed to save notes' });
    }
});

// ═══════════════════════════════════════════
// Route 8: POST /ai/assist — Gemini AI field assistant
// ═══════════════════════════════════════════

router.post('/ai/assist', async (req: Request, res: Response) => {
    try {
        const { intent, message, context, history } = req.body;

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        // Dynamic import to avoid top-level dependency issues
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        let model;
        let systemPrompt: string;
        const parts: any[] = [];

        switch (intent) {
            case 'photo_analysis': {
                model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                systemPrompt = `You are a field operations assistant for a 3D laser scanning company (Scan2Plan).
You are analyzing a photo taken by a scan technician at a job site.

Identify and describe:
1. Building/room type and condition
2. MEP (Mechanical, Electrical, Plumbing) complexity visible
3. Potential scanning obstructions or challenges
4. Safety hazards
5. Recommended scan positions or approach

${context?.buildingType ? `Building type: ${context.buildingType}` : ''}
${context?.riskFactors?.length ? `Known risk factors: ${context.riskFactors.join(', ')}` : ''}

Be concise and actionable. Use bullet points.`;

                parts.push({ text: systemPrompt });
                if (context?.photoBase64) {
                    parts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: context.photoBase64,
                        },
                    });
                }
                if (message) parts.push({ text: message });
                break;
            }

            case 'checklist_validate': {
                model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                systemPrompt = `You are a QC validator for a 3D laser scanning company.
Review the checklist responses below and determine if the scan technician has completed all required items.

${context?.buildingType ? `Building type: ${context.buildingType}` : ''}
${context?.riskFactors?.length ? `Risk factors: ${context.riskFactors.join(', ')}` : ''}

Checklist responses:
${JSON.stringify(context?.checklistResponses || [], null, 2)}

Respond with a JSON object:
{
  "passed": boolean,
  "missingItems": ["list of missing required items"],
  "warnings": ["list of concerns or recommendations"]
}`;

                parts.push({ text: systemPrompt });
                break;
            }

            case 'audio_to_scoping': {
                model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                systemPrompt = `You are a field operations assistant for Scan2Plan, a 3D laser scanning company.
A scan technician has dictated field observations. Parse their notes into structured scoping data.

Extract any of these fields if mentioned:
- Building type, square footage, number of floors
- Room density (0-4 scale), era (Modern/Historic)
- Risk factors (Occupied, No Power-HVAC, Hazardous, No Lighting, Fire-Flood, Non-Standard Height, Restricted Access)
- Scope (Full, Interior Only, Exterior Only, Mixed)
- Site conditions, access notes
- Any issues or concerns

Return a JSON object with:
{
  "response": "summary of what you parsed",
  "scopingUpdates": { field: value pairs that can update the scoping form }
}`;

                parts.push({ text: systemPrompt });
                parts.push({ text: message });
                break;
            }

            default: {
                // General chat
                model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                systemPrompt = `You are a helpful field operations assistant for Scan2Plan, a 3D laser scanning and BIM modeling company.
You help scan technicians with:
- Scanning procedures and best practices
- Equipment troubleshooting (Trimble scanners, Leica, Faro)
- Building type analysis and scan planning
- Point cloud registration tips
- Safety protocols
- BIM modeling standards (LOD 200/300/350)

${context?.buildingType ? `Current project building type: ${context.buildingType}` : ''}
${context?.riskFactors?.length ? `Current project risk factors: ${context.riskFactors.join(', ')}` : ''}

Be concise, practical, and field-focused. The tech is on-site with limited time.`;

                parts.push({ text: systemPrompt });

                // Add conversation history
                if (history?.length) {
                    for (const msg of history) {
                        parts.push({ text: `${msg.role === 'user' ? 'Tech' : 'Assistant'}: ${msg.text}` });
                    }
                }

                parts.push({ text: `Tech: ${message}` });
                break;
            }
        }

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
        });

        const responseText = result.response.text();

        // Try to parse structured responses
        let parsedResponse: any = { response: responseText };

        if (intent === 'checklist_validate' || intent === 'audio_to_scoping') {
            try {
                // Extract JSON from response (may be wrapped in markdown)
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    parsedResponse = { ...parsedResponse, ...parsed };
                }
            } catch {
                // Non-fatal: return raw text
            }
        }

        res.json(parsedResponse);
    } catch (error: any) {
        console.error('Scantech AI error:', error);
        res.status(500).json({ error: error.message || 'AI assistant failed' });
    }
});

export default router;
