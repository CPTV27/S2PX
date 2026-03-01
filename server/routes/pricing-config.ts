// ── Pricing Config Routes ──
// GET: Returns current pricing config (DB row or defaults)
// PUT: Updates pricing config (CEO/admin only)

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { pricingConfig } from '../../shared/schema/db.js';
import { DEFAULT_PRICING_CONFIG } from '../../shared/types/pricingConfig.js';
import { desc, eq } from 'drizzle-orm';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// ── GET /api/pricing-config ──
// Returns the latest pricing config. Falls back to defaults if none exists.
router.get('/', async (_req: Request, res: Response) => {
    try {
        const rows = await db
            .select()
            .from(pricingConfig)
            .orderBy(desc(pricingConfig.updatedAt))
            .limit(1);

        if (rows.length > 0) {
            // Merge DB config over defaults to ensure new keys are always present
            const merged = { ...DEFAULT_PRICING_CONFIG, ...(rows[0].config as Record<string, unknown>) };
            res.json({ id: rows[0].id, config: merged, updatedAt: rows[0].updatedAt, updatedBy: rows[0].updatedBy });
        } else {
            res.json({ id: null, config: DEFAULT_PRICING_CONFIG, updatedAt: null, updatedBy: null });
        }
    } catch (error: any) {
        console.error('Pricing config GET error:', error);
        res.status(500).json({ error: error.message || 'Failed to load pricing config' });
    }
});

// ── PUT /api/pricing-config ──
// Upserts pricing config. Expects { config: PricingConfig } in body.
router.put('/', requireRole('ceo', 'admin'), async (req: Request, res: Response) => {
    try {
        const { config } = req.body;
        if (!config || typeof config !== 'object') {
            return res.status(400).json({ error: 'Missing config object in request body' });
        }

        const updatedBy = (req as any).user?.email || 'system';

        // Check if a config row exists
        const existing = await db
            .select({ id: pricingConfig.id })
            .from(pricingConfig)
            .limit(1);

        if (existing.length > 0) {
            // Update existing row
            const [updated] = await db
                .update(pricingConfig)
                .set({
                    config,
                    updatedBy,
                    updatedAt: new Date(),
                })
                .where(eq(pricingConfig.id, existing[0].id))
                .returning();
            res.json({ id: updated.id, config: updated.config, updatedAt: updated.updatedAt });
        } else {
            // Insert first row
            const [inserted] = await db
                .insert(pricingConfig)
                .values({
                    config,
                    updatedBy,
                })
                .returning();
            res.json({ id: inserted.id, config: inserted.config, updatedAt: inserted.updatedAt });
        }
    } catch (error: any) {
        console.error('Pricing config PUT error:', error);
        res.status(500).json({ error: error.message || 'Failed to update pricing config' });
    }
});

export default router;
