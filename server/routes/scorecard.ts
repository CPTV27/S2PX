// ── S2PX Scorecard & Reporting API (Phase 9) ──
// Read-only aggregation endpoints over existing tables.

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// All scorecard routes require CEO, admin, or viewer role
router.use(requireRole('ceo', 'admin', 'viewer'));

// ── Helper: parse common filters ──
function parseFilters(req: Request) {
    const months = parseInt(req.query.months as string) || 12;
    const tier = (req.query.tier as string) || 'all';
    const buildingType = req.query.buildingType as string | undefined;
    const leadSource = req.query.leadSource as string | undefined;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return { months, tier, buildingType, leadSource, cutoff };
}

// ── GET /api/scorecard/overview ──
router.get('/overview', async (req: Request, res: Response) => {
    try {
        const { cutoff } = parseFilters(req);

        // Pipeline + financial stats
        const pipeline = await db.execute(sql`
            SELECT
                COUNT(*)::int as total_deals,
                COUNT(*) FILTER (WHERE sf.status = 'won')::int as won_count,
                COUNT(*) FILTER (WHERE sf.status = 'lost' OR sf.deal_stage = 'Lost')::int as lost_count,
                COUNT(*) FILTER (WHERE sf.status NOT IN ('won','lost','deleted') AND sf.deal_stage != 'Lost')::int as active_count,
                COALESCE(SUM(q_val.client_price) FILTER (WHERE sf.status = 'won'), 0)::numeric as total_revenue,
                COALESCE(SUM(q_val.upteam_cost) FILTER (WHERE sf.status = 'won'), 0)::numeric as total_cost,
                COALESCE(AVG(q_val.client_price) FILTER (WHERE sf.status = 'won'), 0)::numeric as avg_deal_size,
                COALESCE(SUM(q_val.client_price * sf.probability / 100.0)
                    FILTER (WHERE sf.status NOT IN ('won','lost','deleted') AND sf.deal_stage != 'Lost'), 0)::numeric as active_pipeline_value,
                COALESCE(SUM(sa_agg.total_sqft) FILTER (WHERE sf.status = 'won'), 0)::numeric as total_sf_delivered
            FROM scoping_forms sf
            LEFT JOIN LATERAL (
                SELECT
                    (q.totals->>'totalClientPrice')::numeric as client_price,
                    (q.totals->>'totalUpteamCost')::numeric as upteam_cost
                FROM quotes q WHERE q.scoping_form_id = sf.id
                ORDER BY q.version DESC NULLS LAST, q.created_at DESC LIMIT 1
            ) q_val ON true
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(square_footage), 0)::numeric as total_sqft
                FROM scope_areas WHERE scoping_form_id = sf.id
            ) sa_agg ON true
            WHERE sf.status != 'deleted' AND sf.created_at >= ${cutoff}
        `);

        // Production stats
        const production = await db.execute(sql`
            SELECT
                COUNT(*)::int as total_production,
                COUNT(*) FILTER (WHERE current_stage = 'final_delivery')::int as delivered_count,
                COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                    FILTER (WHERE current_stage = 'final_delivery'), 0)::numeric as avg_cycle_days
            FROM production_projects
            WHERE created_at >= ${cutoff}
        `);

        // Quality stats
        const quality = await db.execute(sql`
            SELECT
                COUNT(*) FILTER (WHERE (stage_data->'field_capture'->>'fieldRMS')::numeric <= 5)::int as rms_pass,
                COUNT(*) FILTER (WHERE stage_data->'field_capture'->>'fieldRMS' IS NOT NULL)::int as rms_total,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' = 'Pass')::int as qc_pass,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' IS NOT NULL)::int as qc_total
            FROM production_projects
            WHERE created_at >= ${cutoff}
        `);

        // Monthly revenue + cost
        const monthly = await db.execute(sql`
            SELECT
                TO_CHAR(sf.updated_at, 'Mon') as month,
                EXTRACT(MONTH FROM sf.updated_at)::int as month_num,
                COALESCE(SUM((q.totals->>'totalClientPrice')::numeric), 0)::numeric as revenue,
                COALESCE(SUM((q.totals->>'totalUpteamCost')::numeric), 0)::numeric as cost
            FROM scoping_forms sf
            LEFT JOIN LATERAL (
                SELECT totals FROM quotes WHERE scoping_form_id = sf.id
                ORDER BY version DESC NULLS LAST, created_at DESC LIMIT 1
            ) q ON true
            WHERE sf.status = 'won' AND sf.updated_at >= ${cutoff}
            GROUP BY TO_CHAR(sf.updated_at, 'Mon'), EXTRACT(MONTH FROM sf.updated_at)
            ORDER BY month_num
        `);

        // Monthly win rate
        const monthlyWR = await db.execute(sql`
            SELECT
                TO_CHAR(sf.updated_at, 'Mon') as month,
                EXTRACT(MONTH FROM sf.updated_at)::int as month_num,
                COUNT(*) FILTER (WHERE sf.status = 'won')::int as won,
                COUNT(*) FILTER (WHERE sf.status = 'lost' OR sf.deal_stage = 'Lost')::int as lost
            FROM scoping_forms sf
            WHERE sf.status IN ('won', 'lost') AND sf.updated_at >= ${cutoff}
            GROUP BY TO_CHAR(sf.updated_at, 'Mon'), EXTRACT(MONTH FROM sf.updated_at)
            ORDER BY month_num
        `);

        // Actual revenue from QBO sales transactions
        const actualRev = await db.execute(sql`
            SELECT
                COALESCE(SUM(amount), 0)::numeric as total_actual_revenue,
                COALESCE(SUM(amount) FILTER (WHERE EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM NOW())), 0)::numeric as ytd_actual_revenue
            FROM qbo_sales_transactions
            WHERE account_name = '4000 Sales'
        `);

        // Actual monthly revenue (last 12 months)
        const actualMonthly = await db.execute(sql`
            SELECT
                TO_CHAR(transaction_date, 'Mon') as month,
                EXTRACT(MONTH FROM transaction_date)::int as month_num,
                SUM(amount)::numeric as actual_revenue
            FROM qbo_sales_transactions
            WHERE account_name = '4000 Sales'
                AND transaction_date >= ${cutoff}
            GROUP BY TO_CHAR(transaction_date, 'Mon'), EXTRACT(MONTH FROM transaction_date)
            ORDER BY month_num
        `);

        const p = pipeline.rows[0] as any;
        const pr = production.rows[0] as any;
        const q = quality.rows[0] as any;
        const ar = actualRev.rows[0] as any;

        const wonCount = Number(p.won_count) || 0;
        const lostCount = Number(p.lost_count) || 0;
        const closedTotal = wonCount + lostCount;
        const totalRevenue = Number(p.total_revenue) || 0;
        const totalCost = Number(p.total_cost) || 0;

        // Build merged monthly revenue with actual overlaid
        const actualByMonth = new Map<string, number>();
        for (const r of actualMonthly.rows as any[]) {
            actualByMonth.set(r.month?.trim(), Math.round(Number(r.actual_revenue) || 0));
        }

        res.json({
            totalDeals: Number(p.total_deals) || 0,
            wonCount,
            lostCount,
            activeCount: Number(p.active_count) || 0,
            winRate: closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0,
            totalRevenue,
            totalCost,
            avgDealSize: Math.round(Number(p.avg_deal_size) || 0),
            blendedMarginPct: totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0,
            activePipelineValue: Math.round(Number(p.active_pipeline_value) || 0),
            totalSfDelivered: Math.round(Number(p.total_sf_delivered) || 0),
            totalProduction: Number(pr.total_production) || 0,
            deliveredCount: Number(pr.delivered_count) || 0,
            avgCycleDays: Math.round(Number(pr.avg_cycle_days) || 0),
            rmsPassRate: Number(q.rms_total) > 0
                ? Math.round((Number(q.rms_pass) / Number(q.rms_total)) * 100) : 0,
            qcPassRate: Number(q.qc_total) > 0
                ? Math.round((Number(q.qc_pass) / Number(q.qc_total)) * 100) : 0,
            actualRevenue: Math.round(Number(ar.total_actual_revenue) || 0),
            ytdActualRevenue: Math.round(Number(ar.ytd_actual_revenue) || 0),
            monthlyRevenue: (monthly.rows as any[]).map(r => ({
                month: r.month?.trim(),
                revenue: Math.round(Number(r.revenue) || 0),
                cost: Math.round(Number(r.cost) || 0),
                actualRevenue: actualByMonth.get(r.month?.trim()) || 0,
            })),
            monthlyWinRate: (monthlyWR.rows as any[]).map(r => {
                const w = Number(r.won) || 0;
                const l = Number(r.lost) || 0;
                return {
                    month: r.month?.trim(),
                    won: w,
                    lost: l,
                    rate: (w + l) > 0 ? Math.round((w / (w + l)) * 100) : 0,
                };
            }),
        });
    } catch (error: any) {
        console.error('Scorecard overview error:', error);
        res.status(500).json({ error: 'Failed to fetch scorecard overview' });
    }
});

// ── GET /api/scorecard/pipeline ──
router.get('/pipeline', async (req: Request, res: Response) => {
    try {
        const { cutoff } = parseFilters(req);

        // Deal stage funnel
        const funnel = await db.execute(sql`
            SELECT
                sf.deal_stage as stage,
                COUNT(*)::int as count,
                COALESCE(SUM(q_val.client_price), 0)::numeric as total_value,
                COALESCE(SUM(q_val.client_price * sf.probability / 100.0), 0)::numeric as weighted_value
            FROM scoping_forms sf
            LEFT JOIN LATERAL (
                SELECT (q.totals->>'totalClientPrice')::numeric as client_price
                FROM quotes q WHERE q.scoping_form_id = sf.id
                ORDER BY q.version DESC NULLS LAST, q.created_at DESC LIMIT 1
            ) q_val ON true
            WHERE sf.status != 'deleted' AND sf.created_at >= ${cutoff}
            GROUP BY sf.deal_stage
            ORDER BY CASE sf.deal_stage
                WHEN 'Lead' THEN 1 WHEN 'Qualified' THEN 2 WHEN 'Proposal' THEN 3
                WHEN 'Negotiation' THEN 4 WHEN 'In Hand' THEN 5 WHEN 'Urgent' THEN 6
                WHEN 'Lost' THEN 7 ELSE 8 END
        `);

        // Monthly pipeline activity
        const monthlyTrend = await db.execute(sql`
            SELECT
                TO_CHAR(sf.created_at, 'Mon') as month,
                EXTRACT(MONTH FROM sf.created_at)::int as month_num,
                COUNT(*) FILTER (WHERE sf.status = 'won')::int as won_count,
                COALESCE(SUM((q.totals->>'totalClientPrice')::numeric) FILTER (WHERE sf.status = 'won'), 0)::numeric as won_value,
                COUNT(*) FILTER (WHERE sf.status = 'lost' OR sf.deal_stage = 'Lost')::int as lost_count,
                COUNT(*)::int as new_count
            FROM scoping_forms sf
            LEFT JOIN LATERAL (
                SELECT totals FROM quotes WHERE scoping_form_id = sf.id
                ORDER BY version DESC NULLS LAST, created_at DESC LIMIT 1
            ) q ON true
            WHERE sf.status != 'deleted' AND sf.created_at >= ${cutoff}
            GROUP BY TO_CHAR(sf.created_at, 'Mon'), EXTRACT(MONTH FROM sf.created_at)
            ORDER BY month_num
        `);

        // Win rate by lead source
        const bySource = await db.execute(sql`
            SELECT
                sf.lead_source as source,
                COUNT(*)::int as total_deals,
                COUNT(*) FILTER (WHERE sf.status = 'won')::int as won_deals
            FROM scoping_forms sf
            WHERE sf.status IN ('won', 'lost') AND sf.created_at >= ${cutoff}
            GROUP BY sf.lead_source
            HAVING COUNT(*) >= 1
            ORDER BY COUNT(*) FILTER (WHERE sf.status = 'won')::float / GREATEST(COUNT(*), 1) DESC
            LIMIT 10
        `);

        // Avg deal by tier
        const byTier = await db.execute(sql`
            SELECT
                CASE
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 10000 THEN 'Minnow'
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 50000 THEN 'Dolphin'
                    ELSE 'Whale'
                END as tier,
                COALESCE(AVG(q_val.client_price), 0)::numeric as avg_value,
                COUNT(*)::int as count,
                COALESCE(AVG(sa_agg.total_sqft), 0)::numeric as avg_sqft
            FROM scoping_forms sf
            LEFT JOIN LATERAL (
                SELECT (q.totals->>'totalClientPrice')::numeric as client_price
                FROM quotes q WHERE q.scoping_form_id = sf.id
                ORDER BY q.version DESC NULLS LAST, q.created_at DESC LIMIT 1
            ) q_val ON true
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(square_footage), 0)::numeric as total_sqft
                FROM scope_areas WHERE scoping_form_id = sf.id
            ) sa_agg ON true
            WHERE sf.status = 'won' AND sf.created_at >= ${cutoff}
            GROUP BY 1
            ORDER BY CASE
                WHEN COALESCE(sa_agg.total_sqft, 0) < 10000 THEN 1
                WHEN COALESCE(sa_agg.total_sqft, 0) < 50000 THEN 2
                ELSE 3
            END
        `);

        res.json({
            funnel: (funnel.rows as any[]).map(r => ({
                stage: r.stage,
                count: Number(r.count),
                totalValue: Math.round(Number(r.total_value) || 0),
                weightedValue: Math.round(Number(r.weighted_value) || 0),
            })),
            monthlyTrend: (monthlyTrend.rows as any[]).map(r => ({
                month: r.month?.trim(),
                wonCount: Number(r.won_count),
                wonValue: Math.round(Number(r.won_value) || 0),
                lostCount: Number(r.lost_count),
                newCount: Number(r.new_count),
            })),
            winRateBySource: (bySource.rows as any[]).map(r => ({
                source: r.source || 'Unknown',
                totalDeals: Number(r.total_deals),
                wonDeals: Number(r.won_deals),
                winRate: Number(r.total_deals) > 0
                    ? Math.round((Number(r.won_deals) / Number(r.total_deals)) * 100) : 0,
            })),
            avgDealByTier: (byTier.rows as any[]).map(r => ({
                tier: r.tier,
                avgValue: Math.round(Number(r.avg_value) || 0),
                count: Number(r.count),
                avgSqft: Math.round(Number(r.avg_sqft) || 0),
            })),
        });
    } catch (error: any) {
        console.error('Scorecard pipeline error:', error);
        res.status(500).json({ error: 'Failed to fetch pipeline report' });
    }
});

// ── GET /api/scorecard/production ──
router.get('/production', async (req: Request, res: Response) => {
    try {
        const { cutoff } = parseFilters(req);

        // Stage distribution
        const stages = await db.execute(sql`
            SELECT current_stage as stage, COUNT(*)::int as count
            FROM production_projects
            WHERE created_at >= ${cutoff}
            GROUP BY current_stage
            ORDER BY CASE current_stage
                WHEN 'scheduling' THEN 1 WHEN 'field_capture' THEN 2
                WHEN 'registration' THEN 3 WHEN 'bim_qc' THEN 4
                WHEN 'pc_delivery' THEN 5 WHEN 'final_delivery' THEN 6 ELSE 7 END
        `);

        // Quality gates
        const quality = await db.execute(sql`
            SELECT
                COUNT(*) FILTER (WHERE (stage_data->'field_capture'->>'fieldRMS')::numeric <= 5)::int as rms_pass,
                COUNT(*) FILTER (WHERE (stage_data->'field_capture'->>'fieldRMS')::numeric > 5)::int as rms_fail,
                COUNT(*) FILTER (WHERE stage_data->'field_capture'->>'fieldRMS' IS NOT NULL)::int as rms_total,
                COUNT(*) FILTER (WHERE (stage_data->'field_capture'->>'avgOverlap')::numeric >= 50)::int as overlap_pass,
                COUNT(*) FILTER (WHERE (stage_data->'field_capture'->>'avgOverlap')::numeric < 50)::int as overlap_fail,
                COUNT(*) FILTER (WHERE stage_data->'field_capture'->>'avgOverlap' IS NOT NULL)::int as overlap_total,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' = 'Pass')::int as qc_pass,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' = 'Fail')::int as qc_fail,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' = 'Conditional')::int as qc_conditional,
                COUNT(*) FILTER (WHERE stage_data->'bim_qc'->>'qcStatus' IS NOT NULL)::int as qc_total
            FROM production_projects
            WHERE created_at >= ${cutoff}
        `);

        // Estimate vs actual SF
        const sfComparison = await db.execute(sql`
            SELECT
                pp.upid,
                sf.project_name,
                COALESCE(sa_agg.total_sqft, 0)::numeric as est_sf,
                COALESCE(
                    (pp.stage_data->'bim_qc'->>'actualSF')::numeric,
                    (pp.stage_data->'field_capture'->>'actualObservedSF')::numeric,
                    0
                )::numeric as actual_sf
            FROM production_projects pp
            JOIN scoping_forms sf ON sf.id = pp.scoping_form_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(square_footage), 0)::numeric as total_sqft
                FROM scope_areas WHERE scoping_form_id = sf.id
            ) sa_agg ON true
            WHERE pp.created_at >= ${cutoff}
                AND (pp.stage_data->'bim_qc'->>'actualSF' IS NOT NULL
                     OR pp.stage_data->'field_capture'->>'actualObservedSF' IS NOT NULL)
        `);

        // Monthly throughput
        const throughput = await db.execute(sql`
            SELECT
                TO_CHAR(created_at, 'Mon') as month,
                EXTRACT(MONTH FROM created_at)::int as month_num,
                COUNT(*)::int as started,
                COUNT(*) FILTER (WHERE current_stage = 'final_delivery')::int as completed
            FROM production_projects
            WHERE created_at >= ${cutoff}
            GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
            ORDER BY month_num
        `);

        const qr = quality.rows[0] as any;
        const sfRows = sfComparison.rows as any[];
        const totalEstSF = sfRows.reduce((s, r) => s + (Number(r.est_sf) || 0), 0);
        const totalActualSF = sfRows.reduce((s, r) => s + (Number(r.actual_sf) || 0), 0);

        res.json({
            stageDistribution: (stages.rows as any[]).map(r => ({
                stage: r.stage,
                count: Number(r.count),
            })),
            qualityGates: {
                fieldRms: {
                    pass: Number(qr.rms_pass),
                    fail: Number(qr.rms_fail),
                    total: Number(qr.rms_total),
                    passRate: Number(qr.rms_total) > 0 ? Math.round((Number(qr.rms_pass) / Number(qr.rms_total)) * 100) : 0,
                },
                avgOverlap: {
                    pass: Number(qr.overlap_pass),
                    fail: Number(qr.overlap_fail),
                    total: Number(qr.overlap_total),
                    passRate: Number(qr.overlap_total) > 0 ? Math.round((Number(qr.overlap_pass) / Number(qr.overlap_total)) * 100) : 0,
                },
                qcStatus: {
                    pass: Number(qr.qc_pass),
                    fail: Number(qr.qc_fail),
                    conditional: Number(qr.qc_conditional),
                    total: Number(qr.qc_total),
                },
            },
            estimateVsActual: {
                totalEstSF: Math.round(totalEstSF),
                totalActualSF: Math.round(totalActualSF),
                variancePct: totalEstSF > 0 ? Math.round(((totalActualSF - totalEstSF) / totalEstSF) * 100) : 0,
                byProject: sfRows.map(r => ({
                    upid: r.upid,
                    projectName: r.project_name,
                    estSF: Math.round(Number(r.est_sf) || 0),
                    actualSF: Math.round(Number(r.actual_sf) || 0),
                    variancePct: Number(r.est_sf) > 0
                        ? Math.round(((Number(r.actual_sf) - Number(r.est_sf)) / Number(r.est_sf)) * 100) : 0,
                })),
            },
            monthlyThroughput: (throughput.rows as any[]).map(r => ({
                month: r.month?.trim(),
                started: Number(r.started),
                completed: Number(r.completed),
            })),
        });
    } catch (error: any) {
        console.error('Scorecard production error:', error);
        res.status(500).json({ error: 'Failed to fetch production report' });
    }
});

// ── GET /api/scorecard/profitability ──
router.get('/profitability', async (req: Request, res: Response) => {
    try {
        const { cutoff } = parseFilters(req);

        // Margin distribution
        const margins = await db.execute(sql`
            SELECT
                CASE
                    WHEN (q.totals->>'grossMarginPercent')::numeric < 40 THEN '<40%'
                    WHEN (q.totals->>'grossMarginPercent')::numeric < 45 THEN '40-45%'
                    WHEN (q.totals->>'grossMarginPercent')::numeric < 50 THEN '45-50%'
                    WHEN (q.totals->>'grossMarginPercent')::numeric < 55 THEN '50-55%'
                    ELSE '55%+'
                END as margin_range,
                COUNT(*)::int as count
            FROM quotes q
            JOIN scoping_forms sf ON sf.id = q.scoping_form_id
            WHERE sf.status = 'won' AND q.totals->>'grossMarginPercent' IS NOT NULL
                AND sf.created_at >= ${cutoff}
                AND q.id = (SELECT q2.id FROM quotes q2 WHERE q2.scoping_form_id = sf.id
                            ORDER BY q2.version DESC NULLS LAST, q2.created_at DESC LIMIT 1)
            GROUP BY margin_range
            ORDER BY CASE margin_range
                WHEN '<40%' THEN 1 WHEN '40-45%' THEN 2 WHEN '45-50%' THEN 3
                WHEN '50-55%' THEN 4 ELSE 5 END
        `);

        const marginColors: Record<string, string> = {
            '<40%': '#EF4444', '40-45%': '#F59E0B', '45-50%': '#10B981',
            '50-55%': '#3B82F6', '55%+': '#2563EB',
        };

        // Avg margin by tier
        const byTier = await db.execute(sql`
            SELECT
                CASE
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 10000 THEN 'Minnow'
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 50000 THEN 'Dolphin'
                    ELSE 'Whale'
                END as tier,
                COALESCE(AVG((q.totals->>'grossMarginPercent')::numeric), 0)::numeric as avg_margin,
                COUNT(*)::int as count
            FROM scoping_forms sf
            JOIN LATERAL (
                SELECT totals FROM quotes WHERE scoping_form_id = sf.id
                ORDER BY version DESC NULLS LAST, created_at DESC LIMIT 1
            ) q ON true
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(square_footage), 0)::numeric as total_sqft
                FROM scope_areas WHERE scoping_form_id = sf.id
            ) sa_agg ON true
            WHERE sf.status = 'won' AND q.totals->>'grossMarginPercent' IS NOT NULL
                AND sf.created_at >= ${cutoff}
            GROUP BY 1
        `);

        // Cost per SF by tier
        const costPerSF = await db.execute(sql`
            SELECT
                CASE
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 10000 THEN 'Minnow'
                    WHEN COALESCE(sa_agg.total_sqft, 0) < 50000 THEN 'Dolphin'
                    ELSE 'Whale'
                END as tier,
                CASE WHEN SUM(sa_agg.total_sqft) > 0
                    THEN (SUM((q.totals->>'totalUpteamCost')::numeric) / SUM(sa_agg.total_sqft))::numeric
                    ELSE 0 END as avg_cost_per_sf,
                CASE WHEN SUM(sa_agg.total_sqft) > 0
                    THEN (SUM((q.totals->>'totalClientPrice')::numeric) / SUM(sa_agg.total_sqft))::numeric
                    ELSE 0 END as avg_price_per_sf,
                COUNT(*)::int as count
            FROM scoping_forms sf
            JOIN LATERAL (
                SELECT totals FROM quotes WHERE scoping_form_id = sf.id
                ORDER BY version DESC NULLS LAST, created_at DESC LIMIT 1
            ) q ON true
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(square_footage), 0)::numeric as total_sqft
                FROM scope_areas WHERE scoping_form_id = sf.id
            ) sa_agg ON true
            WHERE sf.status = 'won' AND sf.created_at >= ${cutoff}
            GROUP BY 1
        `);

        // Travel cost breakdown from field capture data
        const travel = await db.execute(sql`
            SELECT
                COALESCE(SUM((pp.stage_data->'field_capture'->>'milesDriven')::numeric), 0)::numeric as total_miles,
                COALESCE(SUM((pp.stage_data->'field_capture'->>'hotelPerDiem')::numeric), 0)::numeric as total_hotel,
                COALESCE(SUM((pp.stage_data->'field_capture'->>'tollsParking')::numeric), 0)::numeric as total_tolls,
                COALESCE(SUM((pp.stage_data->'field_capture'->>'otherFieldCosts')::numeric), 0)::numeric as total_other,
                COUNT(*) FILTER (WHERE pp.stage_data->'field_capture'->>'milesDriven' IS NOT NULL)::int as project_count
            FROM production_projects pp
            WHERE pp.created_at >= ${cutoff}
        `);

        // Monthly margin trend
        const monthlyMargin = await db.execute(sql`
            SELECT
                TO_CHAR(sf.updated_at, 'Mon') as month,
                EXTRACT(MONTH FROM sf.updated_at)::int as month_num,
                COALESCE(AVG((q.totals->>'grossMarginPercent')::numeric), 0)::numeric as avg_margin,
                COALESCE(SUM((q.totals->>'totalClientPrice')::numeric), 0)::numeric as total_revenue,
                COALESCE(SUM((q.totals->>'totalUpteamCost')::numeric), 0)::numeric as total_cost
            FROM scoping_forms sf
            JOIN LATERAL (
                SELECT totals FROM quotes WHERE scoping_form_id = sf.id
                ORDER BY version DESC NULLS LAST, created_at DESC LIMIT 1
            ) q ON true
            WHERE sf.status = 'won' AND sf.updated_at >= ${cutoff}
            GROUP BY TO_CHAR(sf.updated_at, 'Mon'), EXTRACT(MONTH FROM sf.updated_at)
            ORDER BY month_num
        `);

        const tr = travel.rows[0] as any;
        const projectCount = Math.max(Number(tr.project_count), 1);
        const totalTravelCost = Number(tr.total_hotel) + Number(tr.total_tolls) + Number(tr.total_other)
            + (Number(tr.total_miles) * 0.67); // IRS mileage rate 2024

        res.json({
            marginDistribution: (margins.rows as any[]).map(r => ({
                range: r.margin_range,
                count: Number(r.count),
                color: marginColors[r.margin_range] || '#94A3B8',
            })),
            avgMarginByTier: (byTier.rows as any[]).map(r => ({
                tier: r.tier,
                avgMargin: Math.round(Number(r.avg_margin) * 10) / 10,
                count: Number(r.count),
            })),
            costPerSF: (costPerSF.rows as any[]).map(r => ({
                tier: r.tier,
                avgCostPerSF: Math.round(Number(r.avg_cost_per_sf) * 100) / 100,
                avgPricePerSF: Math.round(Number(r.avg_price_per_sf) * 100) / 100,
                count: Number(r.count),
            })),
            travelCostBreakdown: {
                totalMilesDriven: Math.round(Number(tr.total_miles) || 0),
                totalHotelPerDiem: Math.round(Number(tr.total_hotel) || 0),
                totalTollsParking: Math.round(Number(tr.total_tolls) || 0),
                totalOtherCosts: Math.round(Number(tr.total_other) || 0),
                avgTravelCostPerProject: Math.round(totalTravelCost / projectCount),
            },
            monthlyMarginTrend: (monthlyMargin.rows as any[]).map(r => ({
                month: r.month?.trim(),
                avgMargin: Math.round(Number(r.avg_margin) * 10) / 10,
                totalRevenue: Math.round(Number(r.total_revenue) || 0),
                totalCost: Math.round(Number(r.total_cost) || 0),
            })),
        });
    } catch (error: any) {
        console.error('Scorecard profitability error:', error);
        res.status(500).json({ error: 'Failed to fetch profitability report' });
    }
});

export default router;
