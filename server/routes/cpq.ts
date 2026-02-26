import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { scopingForms, scopeAreas, quotes } from '../../shared/schema/db.js';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

// ── POST /api/cpq/quotes — save an AI-generated quote ──
// Creates a minimal scoping form (if no leadId) + quote record
router.post('/quotes', async (req: Request, res: Response) => {
    try {
        const { leadId, totalPrice, pricingBreakdown, areas, paymentTerms } = req.body;

        let scopingFormId = leadId;

        // If no leadId, create a minimal scoping form to link the quote to
        if (!scopingFormId) {
            const seqResult = await db.execute(sql`SELECT nextval('upid_seq') as seq`);
            const seq = (seqResult.rows[0] as { seq: string }).seq;
            const upid = `S2P-${String(seq).padStart(4, '0')}-${new Date().getFullYear()}`;

            const projectName = pricingBreakdown?.lineItems?.[0]?.service || 'AI Quote';

            const [form] = await db.insert(scopingForms).values({
                upid,
                status: 'quoted',
                clientCompany: 'AI Quote Client',
                projectName,
                projectAddress: 'TBD',
                email: 'unknown@example.com',
                primaryContactName: 'Unknown',
                contactEmail: 'unknown@example.com',
                numberOfFloors: 1,
                bimDeliverable: 'Revit',
                georeferencing: false,
                era: 'Modern',
                roomDensity: 2,
                riskFactors: [],
                expedited: false,
                dispatchLocation: 'Troy NY',
                oneWayMiles: 0,
                travelMode: 'Local',
                leadSource: 'Other',
                probability: 50,
                dealStage: 'Lead',
                priority: 3,
            }).returning();

            scopingFormId = form.id;

            // Create scope areas from the quote's areas if present
            if (areas && Array.isArray(areas)) {
                for (let i = 0; i < areas.length; i++) {
                    const area = areas[i];
                    await db.insert(scopeAreas).values({
                        scopingFormId: form.id,
                        areaType: 'Commercial',
                        areaName: area.name,
                        squareFootage: area.sqft || 0,
                        projectScope: 'Full',
                        lod: '300',
                        cadDeliverable: 'No',
                        sortOrder: i,
                    });
                }
            }
        }

        // Save the quote
        const [quote] = await db.insert(quotes).values({
            scopingFormId,
            lineItems: pricingBreakdown?.lineItems || [],
            totals: {
                totalClientPrice: totalPrice || 0,
                totalUpteamCost: pricingBreakdown?.totalCOGS || 0,
                grossMargin: (totalPrice || 0) - (pricingBreakdown?.totalCOGS || 0),
                grossMarginPercent: totalPrice > 0
                    ? Math.round(((totalPrice - (pricingBreakdown?.totalCOGS || 0)) / totalPrice) * 100)
                    : 0,
                cogsMultiplier: pricingBreakdown?.cogsMultiplier,
                overheadPct: pricingBreakdown?.overheadPct,
                profitBreakdown: pricingBreakdown?.profitBreakdown,
                multipliers: pricingBreakdown?.multipliers,
                notes: pricingBreakdown?.notes,
            },
            integrityStatus: 'passed',
            version: 1,
        }).returning();

        // Generate a quote number
        const quoteNumber = `Q-${String(quote.id).padStart(4, '0')}`;

        res.status(201).json({
            id: quote.id,
            leadId: scopingFormId,
            quoteNumber,
            totalPrice: totalPrice || 0,
            areas: areas || [],
            pricingBreakdown: pricingBreakdown || null,
            paymentTerms: paymentTerms || null,
            isLatest: true,
            createdAt: quote.createdAt.toISOString(),
        });
    } catch (error: any) {
        console.error('Create CPQ quote error:', error);
        res.status(400).json({ error: error.message || 'Failed to save quote' });
    }
});

// ── GET /api/cpq/quotes — list quotes (optional leadId filter) ──
router.get('/quotes', async (req: Request, res: Response) => {
    try {
        const leadId = req.query.leadId ? parseInt(req.query.leadId as string, 10) : undefined;

        let query;
        if (leadId && !isNaN(leadId)) {
            query = db.execute(sql`
                SELECT q.*, sf.project_name
                FROM quotes q
                JOIN scoping_forms sf ON sf.id = q.scoping_form_id
                WHERE q.scoping_form_id = ${leadId}
                ORDER BY q.created_at DESC
            `);
        } else {
            query = db.execute(sql`
                SELECT q.*, sf.project_name
                FROM quotes q
                JOIN scoping_forms sf ON sf.id = q.scoping_form_id
                ORDER BY q.created_at DESC
                LIMIT 100
            `);
        }

        const results = await query;

        const mapped = results.rows.map((row: any) => ({
            id: row.id,
            leadId: row.scoping_form_id,
            quoteNumber: `Q-${String(row.id).padStart(4, '0')}`,
            totalPrice: row.totals?.totalClientPrice || 0,
            areas: [],
            pricingBreakdown: {
                lineItems: row.line_items,
                ...(row.totals || {}),
            },
            isLatest: true,
            createdAt: row.created_at instanceof Date
                ? row.created_at.toISOString()
                : String(row.created_at),
        }));

        res.json(mapped);
    } catch (error: any) {
        console.error('List CPQ quotes error:', error);
        res.status(500).json({ error: 'Failed to fetch quotes' });
    }
});

// ── POST /api/cpq/calculate-pricing — deprecated, return 410 ──
router.post('/calculate-pricing', (_req: Request, res: Response) => {
    res.status(410).json({
        error: 'Pricing calculation has moved to the CEO pricing flow. Use the DealWorkspace for pricing.',
    });
});

// ── GET /api/products — return empty (no product catalog) ──
router.get('/products', (_req: Request, res: Response) => {
    res.json([]);
});

export default router;
