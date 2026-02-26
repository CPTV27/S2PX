// ── Production Pipeline Routes ──
// CRUD + stage advancement with prefill cascade execution.

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { productionProjects, scopingForms, scopeAreas, projectAssets } from '../../shared/schema/db.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { executePrefillCascade } from '../../shared/engine/prefillCascade.js';
import { PRODUCTION_STAGES, type ProductionStage } from '../../shared/schema/constants.js';
import { getNextStage } from '../../shared/types/production.js';

const router = Router();

// ── Helper: load scoping form with areas ──
async function loadFormWithAreas(scopingFormId: number) {
    const [form] = await db
        .select()
        .from(scopingForms)
        .where(eq(scopingForms.id, scopingFormId));
    if (!form) return null;

    const areas = await db
        .select()
        .from(scopeAreas)
        .where(eq(scopeAreas.scopingFormId, scopingFormId))
        .orderBy(scopeAreas.sortOrder);

    return { ...form, areas };
}

// ── Create production project (on Closed Won) ──
router.post('/', async (req: Request, res: Response) => {
    try {
        const { scopingFormId } = req.body;
        if (!scopingFormId) {
            return res.status(400).json({ error: 'scopingFormId is required' });
        }

        // Load the scoping form
        const form = await loadFormWithAreas(scopingFormId);
        if (!form) {
            return res.status(404).json({ error: 'Scoping form not found' });
        }

        // Check if production project already exists for this form
        const [existing] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.scopingFormId, scopingFormId));
        if (existing) {
            return res.status(409).json({
                error: 'Production project already exists for this scoping form',
                project: existing,
            });
        }

        // Create at scheduling stage (no prefill needed — it IS the scoping form)
        const [project] = await db
            .insert(productionProjects)
            .values({
                scopingFormId,
                upid: form.upid,
                currentStage: 'scheduling' as ProductionStage,
                stageData: { scheduling: {} },
            })
            .returning();

        res.status(201).json(project);
    } catch (error: any) {
        console.error('Create production project error:', error);
        res.status(400).json({ error: error.message || 'Failed to create production project' });
    }
});

// ── List all production projects (filterable by stage) ──
router.get('/', async (req: Request, res: Response) => {
    try {
        const { stage } = req.query;
        let query = db
            .select({
                id: productionProjects.id,
                scopingFormId: productionProjects.scopingFormId,
                upid: productionProjects.upid,
                currentStage: productionProjects.currentStage,
                stageData: productionProjects.stageData,
                createdAt: productionProjects.createdAt,
                updatedAt: productionProjects.updatedAt,
                projectName: scopingForms.projectName,
                clientCompany: scopingForms.clientCompany,
                projectAddress: scopingForms.projectAddress,
                assetCount: sql<number>`(SELECT COUNT(*)::int FROM project_assets WHERE production_project_id = ${productionProjects.id})`.as('asset_count'),
            })
            .from(productionProjects)
            .leftJoin(scopingForms, eq(productionProjects.scopingFormId, scopingForms.id))
            .orderBy(desc(productionProjects.updatedAt))
            .$dynamic();

        if (stage && typeof stage === 'string' && PRODUCTION_STAGES.includes(stage as ProductionStage)) {
            query = query.where(eq(productionProjects.currentStage, stage));
        }

        const projects = await query;
        res.json(projects);
    } catch (error: any) {
        console.error('List production projects error:', error);
        res.status(500).json({ error: error.message || 'Failed to list production projects' });
    }
});

// ── Get single production project ──
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const [project] = await db
            .select({
                id: productionProjects.id,
                scopingFormId: productionProjects.scopingFormId,
                upid: productionProjects.upid,
                currentStage: productionProjects.currentStage,
                stageData: productionProjects.stageData,
                createdAt: productionProjects.createdAt,
                updatedAt: productionProjects.updatedAt,
                projectName: scopingForms.projectName,
                clientCompany: scopingForms.clientCompany,
                projectAddress: scopingForms.projectAddress,
                assetCount: sql<number>`(SELECT COUNT(*)::int FROM project_assets WHERE production_project_id = ${productionProjects.id})`.as('asset_count'),
            })
            .from(productionProjects)
            .leftJoin(scopingForms, eq(productionProjects.scopingFormId, scopingForms.id))
            .where(eq(productionProjects.id, id));

        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }
        res.json(project);
    } catch (error: any) {
        console.error('Get production project error:', error);
        res.status(500).json({ error: error.message || 'Failed to get production project' });
    }
});

// ── Update stage data (manual field entries within current stage) ──
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { stageUpdates } = req.body;

        const [existing] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, id));
        if (!existing) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        // Merge updates into current stage's data
        const currentData = (existing.stageData as Record<string, Record<string, unknown>>) || {};
        const stage = existing.currentStage;
        currentData[stage] = { ...(currentData[stage] || {}), ...stageUpdates };

        const [updated] = await db
            .update(productionProjects)
            .set({
                stageData: currentData,
                updatedAt: new Date(),
            })
            .where(eq(productionProjects.id, id))
            .returning();

        res.json(updated);
    } catch (error: any) {
        console.error('Update production project error:', error);
        res.status(400).json({ error: error.message || 'Failed to update production project' });
    }
});

// ── Advance to next stage (runs prefill cascade) ──
router.post('/:id/advance', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);

        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, id));
        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        const currentStage = project.currentStage as ProductionStage;
        const nextStageId = getNextStage(currentStage);
        if (!nextStageId) {
            return res.status(400).json({ error: 'Project is already at final stage' });
        }

        // Load scoping form for SSOT fields
        const form = await loadFormWithAreas(project.scopingFormId);
        if (!form) {
            return res.status(404).json({ error: 'Scoping form not found' });
        }

        // Execute prefill cascade
        const allStageData = (project.stageData as Record<string, Record<string, unknown>>) || {};
        const { data: prefillData, results } = executePrefillCascade(
            currentStage,
            nextStageId,
            form as any,
            allStageData,
        );

        // Merge prefilled data into stageData for the new stage
        allStageData[nextStageId] = { ...(allStageData[nextStageId] || {}), ...prefillData };

        const [updated] = await db
            .update(productionProjects)
            .set({
                currentStage: nextStageId,
                stageData: allStageData,
                updatedAt: new Date(),
            })
            .where(eq(productionProjects.id, id))
            .returning();

        res.json({
            project: updated,
            prefillResults: results,
            advancedFrom: currentStage,
            advancedTo: nextStageId,
        });
    } catch (error: any) {
        console.error('Advance production project error:', error);
        res.status(500).json({ error: error.message || 'Failed to advance stage' });
    }
});

// ── Preview prefill cascade (dry run — no data saved) ──
router.get('/:id/preview-advance', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);

        const [project] = await db
            .select()
            .from(productionProjects)
            .where(eq(productionProjects.id, id));
        if (!project) {
            return res.status(404).json({ error: 'Production project not found' });
        }

        const currentStage = project.currentStage as ProductionStage;
        const nextStageId = getNextStage(currentStage);
        if (!nextStageId) {
            return res.status(400).json({ error: 'Project is already at final stage' });
        }

        const form = await loadFormWithAreas(project.scopingFormId);
        if (!form) {
            return res.status(404).json({ error: 'Scoping form not found' });
        }

        const allStageData = (project.stageData as Record<string, Record<string, unknown>>) || {};
        const { data: prefillData, results } = executePrefillCascade(
            currentStage,
            nextStageId,
            form as any,
            allStageData,
        );

        res.json({
            fromStage: currentStage,
            toStage: nextStageId,
            prefillData,
            results,
        });
    } catch (error: any) {
        console.error('Preview advance error:', error);
        res.status(500).json({ error: error.message || 'Failed to preview advance' });
    }
});

// ── Stage summary (counts per stage) ──
router.get('/summary/stages', async (_req: Request, res: Response) => {
    try {
        const result = await db.execute(sql`
            SELECT current_stage, COUNT(*)::int as count
            FROM production_projects
            GROUP BY current_stage
            ORDER BY
                CASE current_stage
                    WHEN 'scheduling' THEN 0
                    WHEN 'field_capture' THEN 1
                    WHEN 'registration' THEN 2
                    WHEN 'bim_qc' THEN 3
                    WHEN 'pc_delivery' THEN 4
                    WHEN 'final_delivery' THEN 5
                END
        `);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Stage summary error:', error);
        res.status(500).json({ error: error.message || 'Failed to get stage summary' });
    }
});

export default router;
