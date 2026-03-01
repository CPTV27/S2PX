/**
 * V2 Pricing API Routes
 * CEO-only endpoint to run the V2 engine and compare with V1 output.
 * Shadow module — does NOT replace any existing pricing functionality.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { loadV2PricingTables } from '../lib/pricingV2Loader.js';
import { computeProjectQuoteV2 } from '../../shared/engine/pricingV2.js';
import type { V2ProjectInput } from '../../shared/engine/pricingV2Types.js';

const router = Router();

/**
 * POST /api/pricing-v2/quote
 * Run a project through the V2 engine and return the result.
 * CEO/admin only.
 *
 * Body: V2ProjectInput
 * Returns: V2QuoteResult
 */
router.post('/quote', requireRole('ceo', 'admin'), async (req: Request, res: Response) => {
    try {
        const input = req.body as V2ProjectInput;

        if (!input.areas || input.areas.length === 0) {
            res.status(400).json({ error: 'At least one area is required' });
            return;
        }

        const tables = await loadV2PricingTables();
        if (!tables) {
            res.status(503).json({ error: 'V2 pricing tables not seeded. Run: npx tsx server/scripts/seed-pricing-v2.ts' });
            return;
        }

        const result = computeProjectQuoteV2(input, tables);
        res.json(result);
    } catch (err: any) {
        console.error('[pricing-v2] Quote error:', err);
        res.status(500).json({ error: err.message || 'V2 engine error' });
    }
});

/**
 * GET /api/pricing-v2/tables
 * Return the current V2 pricing tables (for inspection / debugging).
 * CEO/admin only.
 */
router.get('/tables', requireRole('ceo', 'admin'), async (_req: Request, res: Response) => {
    try {
        const tables = await loadV2PricingTables();
        if (!tables) {
            res.status(503).json({ error: 'V2 pricing tables not seeded' });
            return;
        }
        res.json(tables);
    } catch (err: any) {
        console.error('[pricing-v2] Tables error:', err);
        res.status(500).json({ error: err.message || 'Failed to load tables' });
    }
});

/**
 * GET /api/pricing-v2/status
 * Quick health check — are the V2 tables seeded?
 */
router.get('/status', requireRole('ceo', 'admin'), async (_req: Request, res: Response) => {
    try {
        const tables = await loadV2PricingTables();
        res.json({
            seeded: tables !== null,
            buildingTypes: tables?.buildingTypes.length ?? 0,
            archRates: tables?.archRates.length ?? 0,
            addonRates: tables?.addonRates.length ?? 0,
            megabandRates: tables?.megabandRates.length ?? 0,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
