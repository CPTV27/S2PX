// ── Proposal Template Routes ──
// CRUD for editable boilerplate content used in proposal PDF generation.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { proposalTemplates } from '../../shared/schema/db';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/proposal-templates — List all templates
router.get('/', async (_req: Request, res: Response) => {
    try {
        const templates = await db.select().from(proposalTemplates)
            .orderBy(proposalTemplates.createdAt);
        res.json(templates);
    } catch (err) {
        console.error('Error listing proposal templates:', err);
        res.status(500).json({ message: 'Failed to list templates' });
    }
});

// GET /api/proposal-templates/active — Get the active template (convenience)
router.get('/active', async (_req: Request, res: Response) => {
    try {
        const [template] = await db.select().from(proposalTemplates)
            .where(eq(proposalTemplates.isActive, true))
            .limit(1);
        if (!template) return res.status(404).json({ message: 'No active template found' });
        res.json(template);
    } catch (err) {
        console.error('Error fetching active template:', err);
        res.status(500).json({ message: 'Failed to fetch active template' });
    }
});

// GET /api/proposal-templates/:id — Get one template
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [template] = await db.select().from(proposalTemplates)
            .where(eq(proposalTemplates.id, id));
        if (!template) return res.status(404).json({ message: 'Template not found' });
        res.json(template);
    } catch (err) {
        console.error('Error fetching proposal template:', err);
        res.status(500).json({ message: 'Failed to fetch template' });
    }
});

// POST /api/proposal-templates — Create a template
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            name, aboutScan2plan, whyScan2plan, capabilities, difference,
            bimStandardsIntro, paymentTermsDefault, sfAuditClause,
            contactEmail, contactPhone, footerText,
        } = req.body;

        const [template] = await db.insert(proposalTemplates).values({
            name: name || 'default',
            aboutScan2plan: aboutScan2plan || null,
            whyScan2plan: whyScan2plan || null,
            capabilities: capabilities || null,
            difference: difference || null,
            bimStandardsIntro: bimStandardsIntro || null,
            paymentTermsDefault: paymentTermsDefault || null,
            sfAuditClause: sfAuditClause || null,
            contactEmail: contactEmail || 'admin@scan2plan.io',
            contactPhone: contactPhone || '(518) 362-2403',
            footerText: footerText || null,
        }).returning();

        res.status(201).json(template);
    } catch (err) {
        console.error('Error creating proposal template:', err);
        res.status(500).json({ message: 'Failed to create template' });
    }
});

// PATCH /api/proposal-templates/:id — Update a template
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const updates: Record<string, unknown> = { updatedAt: new Date() };

        const allowedFields = [
            'name', 'aboutScan2plan', 'whyScan2plan', 'capabilities', 'difference',
            'bimStandardsIntro', 'paymentTermsDefault', 'sfAuditClause',
            'contactEmail', 'contactPhone', 'footerText', 'isActive',
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        const [template] = await db.update(proposalTemplates)
            .set(updates)
            .where(eq(proposalTemplates.id, id))
            .returning();

        if (!template) return res.status(404).json({ message: 'Template not found' });
        res.json(template);
    } catch (err) {
        console.error('Error updating proposal template:', err);
        res.status(500).json({ message: 'Failed to update template' });
    }
});

// DELETE /api/proposal-templates/:id — Delete a template
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [deleted] = await db.delete(proposalTemplates)
            .where(eq(proposalTemplates.id, id))
            .returning();

        if (!deleted) return res.status(404).json({ message: 'Template not found' });
        res.json({ message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting proposal template:', err);
        res.status(500).json({ message: 'Failed to delete template' });
    }
});

export default router;
