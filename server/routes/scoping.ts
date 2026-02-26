import type { Express, Request, Response } from 'express';
import { db } from '../db.js';
import { scopingForms, scopeAreas } from '../../shared/schema/db.js';
import { eq, desc, sql } from 'drizzle-orm';

// UPID generator: S2P-[SEQ]-[YEAR]
async function generateUpid(): Promise<string> {
    const result = await db.execute(sql`SELECT nextval('upid_seq') as seq`);
    const seq = (result.rows[0] as { seq: string }).seq;
    const year = new Date().getFullYear();
    return `S2P-${String(seq).padStart(4, '0')}-${year}`;
}

export function registerScopingRoutes(app: Express) {
    // ── Create scoping form + generate UPID ──
    app.post('/api/scoping', async (req: Request, res: Response) => {
        try {
            const upid = await generateUpid();
            const { areas, ...formData } = req.body;

            const [form] = await db
                .insert(scopingForms)
                .values({ ...formData, upid })
                .returning();

            // Insert areas if provided
            if (areas && Array.isArray(areas) && areas.length > 0) {
                await db.insert(scopeAreas).values(
                    areas.map((area: any, i: number) => ({
                        ...area,
                        scopingFormId: form.id,
                        sortOrder: i,
                    }))
                );
            }

            // Fetch back with areas
            const resultAreas = await db
                .select()
                .from(scopeAreas)
                .where(eq(scopeAreas.scopingFormId, form.id))
                .orderBy(scopeAreas.sortOrder);

            res.status(201).json({ ...form, areas: resultAreas });
        } catch (error: any) {
            console.error('Create scoping form error:', error);
            res.status(400).json({ error: error.message || 'Failed to create scoping form' });
        }
    });

    // ── List scoping forms (filterable by status, deal_stage) ──
    app.get('/api/scoping', async (req: Request, res: Response) => {
        try {
            const { status, dealStage } = req.query;
            let query = db
                .select()
                .from(scopingForms)
                .orderBy(desc(scopingForms.updatedAt))
                .$dynamic();

            if (status && typeof status === 'string') {
                query = query.where(eq(scopingForms.status, status));
            }
            if (dealStage && typeof dealStage === 'string') {
                query = query.where(eq(scopingForms.dealStage, dealStage));
            }

            const forms = await query;
            res.json(forms);
        } catch (error: any) {
            console.error('List scoping forms error:', error);
            res.status(500).json({ error: 'Failed to fetch scoping forms' });
        }
    });

    // ── Get single form + areas ──
    app.get('/api/scoping/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ error: 'Invalid ID' });
                return;
            }

            const [form] = await db
                .select()
                .from(scopingForms)
                .where(eq(scopingForms.id, id));

            if (!form) {
                res.status(404).json({ error: 'Scoping form not found' });
                return;
            }

            const areas = await db
                .select()
                .from(scopeAreas)
                .where(eq(scopeAreas.scopingFormId, id))
                .orderBy(scopeAreas.sortOrder);

            res.json({ ...form, areas });
        } catch (error: any) {
            console.error('Get scoping form error:', error);
            res.status(500).json({ error: 'Failed to fetch scoping form' });
        }
    });

    // ── Update form fields (autosave target — partial update) ──
    app.patch('/api/scoping/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ error: 'Invalid ID' });
                return;
            }

            const { areas, ...formData } = req.body;

            const [updated] = await db
                .update(scopingForms)
                .set({ ...formData, updatedAt: new Date() })
                .where(eq(scopingForms.id, id))
                .returning();

            if (!updated) {
                res.status(404).json({ error: 'Scoping form not found' });
                return;
            }

            res.json(updated);
        } catch (error: any) {
            console.error('Update scoping form error:', error);
            res.status(400).json({ error: error.message || 'Failed to update scoping form' });
        }
    });

    // ── Soft delete (set status = 'deleted') ──
    app.delete('/api/scoping/:id', async (req: Request, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                res.status(400).json({ error: 'Invalid ID' });
                return;
            }

            const [updated] = await db
                .update(scopingForms)
                .set({ status: 'deleted', updatedAt: new Date() })
                .where(eq(scopingForms.id, id))
                .returning();

            if (!updated) {
                res.status(404).json({ error: 'Scoping form not found' });
                return;
            }

            res.json({ ok: true });
        } catch (error: any) {
            console.error('Delete scoping form error:', error);
            res.status(500).json({ error: 'Failed to delete scoping form' });
        }
    });

    // ── Add scope area ──
    app.post('/api/scoping/:id/areas', async (req: Request, res: Response) => {
        try {
            const formId = parseInt(req.params.id, 10);
            if (isNaN(formId)) {
                res.status(400).json({ error: 'Invalid ID' });
                return;
            }

            const [area] = await db
                .insert(scopeAreas)
                .values({ ...req.body, scopingFormId: formId })
                .returning();

            res.status(201).json(area);
        } catch (error: any) {
            console.error('Add scope area error:', error);
            res.status(400).json({ error: error.message || 'Failed to add scope area' });
        }
    });

    // ── Update scope area ──
    app.patch('/api/scoping/:id/areas/:areaId', async (req: Request, res: Response) => {
        try {
            const areaId = parseInt(req.params.areaId, 10);
            if (isNaN(areaId)) {
                res.status(400).json({ error: 'Invalid area ID' });
                return;
            }

            const [updated] = await db
                .update(scopeAreas)
                .set(req.body)
                .where(eq(scopeAreas.id, areaId))
                .returning();

            if (!updated) {
                res.status(404).json({ error: 'Scope area not found' });
                return;
            }

            res.json(updated);
        } catch (error: any) {
            console.error('Update scope area error:', error);
            res.status(400).json({ error: error.message || 'Failed to update scope area' });
        }
    });

    // ── Delete scope area ──
    app.delete('/api/scoping/:id/areas/:areaId', async (req: Request, res: Response) => {
        try {
            const areaId = parseInt(req.params.areaId, 10);
            if (isNaN(areaId)) {
                res.status(400).json({ error: 'Invalid area ID' });
                return;
            }

            const [deleted] = await db
                .delete(scopeAreas)
                .where(eq(scopeAreas.id, areaId))
                .returning();

            if (!deleted) {
                res.status(404).json({ error: 'Scope area not found' });
                return;
            }

            res.json({ ok: true });
        } catch (error: any) {
            console.error('Delete scope area error:', error);
            res.status(500).json({ error: 'Failed to delete scope area' });
        }
    });
}
