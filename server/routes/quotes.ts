// ── Quote Routes ──
// CRUD for quotes (priced line items from CEO).
// Enforces integrity guardrails on save.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { quotes, scopingForms } from '../../shared/schema/db';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/quotes — Create a quote for a scoping form
router.post('/', async (req: Request, res: Response) => {
    try {
        const { scopingFormId, lineItems, totals, integrityStatus } = req.body;

        if (!scopingFormId || !lineItems) {
            return res.status(400).json({ message: 'scopingFormId and lineItems are required' });
        }

        // Block save if integrity is blocked
        if (integrityStatus === 'blocked') {
            return res.status(422).json({
                message: 'Cannot save quote: integrity check blocked. All items must be priced and margin must be >= 40%.',
            });
        }

        const [quote] = await db.insert(quotes).values({
            scopingFormId,
            lineItems,
            totals: totals || null,
            integrityStatus: integrityStatus || null,
        }).returning();

        // Update scoping form status to 'priced'
        await db.update(scopingForms)
            .set({ status: 'priced', updatedAt: new Date() })
            .where(eq(scopingForms.id, scopingFormId));

        res.status(201).json(quote);
    } catch (err) {
        console.error('Error creating quote:', err);
        res.status(500).json({ message: 'Failed to create quote' });
    }
});

// GET /api/quotes/:id — Get a quote by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        res.json(quote);
    } catch (err) {
        console.error('Error fetching quote:', err);
        res.status(500).json({ message: 'Failed to fetch quote' });
    }
});

// GET /api/quotes/by-form/:formId — Get quotes for a scoping form
router.get('/by-form/:formId', async (req: Request, res: Response) => {
    try {
        const formId = parseInt(req.params.formId, 10);
        const results = await db.select().from(quotes)
            .where(eq(quotes.scopingFormId, formId))
            .orderBy(quotes.createdAt);

        res.json(results);
    } catch (err) {
        console.error('Error fetching quotes by form:', err);
        res.status(500).json({ message: 'Failed to fetch quotes' });
    }
});

// PATCH /api/quotes/:id — Update line item prices
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { lineItems, totals, integrityStatus } = req.body;

        // Block save if integrity is blocked
        if (integrityStatus === 'blocked') {
            return res.status(422).json({
                message: 'Cannot save quote: integrity check blocked.',
            });
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (lineItems !== undefined) updates.lineItems = lineItems;
        if (totals !== undefined) updates.totals = totals;
        if (integrityStatus !== undefined) updates.integrityStatus = integrityStatus;

        const [updated] = await db.update(quotes)
            .set(updates)
            .where(eq(quotes.id, id))
            .returning();

        if (!updated) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        res.json(updated);
    } catch (err) {
        console.error('Error updating quote:', err);
        res.status(500).json({ message: 'Failed to update quote' });
    }
});

export default router;
