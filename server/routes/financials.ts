// ── S2PX Financials API (Phase 15) ──
// Read-only aggregation endpoints over QBO financial tables.

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import type {
    ActualRevenueData,
    PnlSummary,
    ExpenseSummaryData,
    QBOCustomerListData,
    EstimateConversionData,
    BalanceSheetData,
} from '../../shared/types/financials.js';

const router = Router();

// ── GET /api/financials/revenue-actual ──
router.get('/revenue-actual', async (req: Request, res: Response) => {
    try {
        const monthly = await db.execute(sql`
            SELECT
                TO_CHAR(transaction_date, 'YYYY-MM') AS month,
                SUM(amount)::numeric                 AS revenue,
                COUNT(*)::int                        AS transaction_count
            FROM qbo_sales_transactions
            WHERE account_name = '4000 Sales'
            GROUP BY 1
            ORDER BY 1
        `);

        const topCustomers = await db.execute(sql`
            SELECT
                customer_name,
                SUM(amount)::numeric AS revenue,
                COUNT(*)::int        AS transaction_count
            FROM qbo_sales_transactions
            WHERE account_name = '4000 Sales'
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 20
        `);

        const totals = await db.execute(sql`
            SELECT
                COALESCE(SUM(amount), 0)::numeric AS total_revenue,
                COALESCE(SUM(amount) FILTER (
                    WHERE EXTRACT(YEAR FROM transaction_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                ), 0)::numeric AS ytd_revenue
            FROM qbo_sales_transactions
            WHERE account_name = '4000 Sales'
        `);

        const revenueByType = await db.execute(sql`
            SELECT
                account_name                AS type,
                COALESCE(SUM(amount), 0)::numeric AS total
            FROM qbo_sales_transactions
            GROUP BY account_name
            ORDER BY total DESC
        `);

        const t = totals.rows[0] as any;

        const result: ActualRevenueData = {
            totalRevenue: Math.round(Number(t.total_revenue) || 0),
            ytdRevenue: Math.round(Number(t.ytd_revenue) || 0),
            monthlyRevenue: (monthly.rows as any[]).map(r => ({
                month: r.month,
                revenue: Math.round(Number(r.revenue) || 0),
                transactionCount: Number(r.transaction_count),
            })),
            topCustomers: (topCustomers.rows as any[]).map(r => ({
                customerName: r.customer_name ?? '',
                revenue: Math.round(Number(r.revenue) || 0),
                transactionCount: Number(r.transaction_count),
            })),
            revenueByType: (revenueByType.rows as any[]).map(r => ({
                type: r.type ?? '',
                total: Math.round(Number(r.total) || 0),
            })),
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials revenue-actual error:', error);
        res.status(500).json({ error: 'Failed to fetch actual revenue data' });
    }
});

// ── GET /api/financials/pnl-summary ──
router.get('/pnl-summary', async (req: Request, res: Response) => {
    try {
        const monthly = await db.execute(sql`
            SELECT
                month,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Income'), 0)::numeric          AS income,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Cost of Goods Sold'), 0)::numeric AS cogs,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Expenses'), 0)::numeric        AS expenses,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Other Income'), 0)::numeric    AS other_income,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Other Expenses'), 0)::numeric  AS other_expenses,
                COALESCE(SUM(CASE
                    WHEN category IN ('Income', 'Other Income')    THEN amount
                    WHEN category IN ('Cost of Goods Sold', 'Expenses', 'Other Expenses') THEN -amount
                    ELSE 0
                END), 0)::numeric AS net_income
            FROM qbo_pnl_monthly
            GROUP BY month
            ORDER BY month
        `);

        const accountDetails = await db.execute(sql`
            SELECT
                account_name AS account,
                category,
                COALESCE(SUM(amount), 0)::numeric AS total,
                JSON_AGG(
                    JSON_BUILD_OBJECT('month', month, 'amount', ROUND(amount::numeric, 2))
                    ORDER BY month
                ) AS monthly
            FROM qbo_pnl_monthly
            GROUP BY account_name, category
            ORDER BY category, total DESC
        `);

        const grandTotals = await db.execute(sql`
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE category = 'Income'), 0)::numeric          AS total_income,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Cost of Goods Sold'), 0)::numeric AS total_cogs,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Expenses'), 0)::numeric        AS total_expenses,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Other Income'), 0)::numeric    AS total_other_income,
                COALESCE(SUM(amount) FILTER (WHERE category = 'Other Expenses'), 0)::numeric  AS total_other_expenses
            FROM qbo_pnl_monthly
        `);

        const g = grandTotals.rows[0] as any;
        const totalIncome = Number(g.total_income) || 0;
        const totalCOGS = Number(g.total_cogs) || 0;
        const totalExpenses = Number(g.total_expenses) || 0;
        const totalOtherIncome = Number(g.total_other_income) || 0;
        const totalOtherExpenses = Number(g.total_other_expenses) || 0;
        const netIncome = (totalIncome + totalOtherIncome) - (totalCOGS + totalExpenses + totalOtherExpenses);

        const result: PnlSummary = {
            totalIncome: Math.round(totalIncome),
            totalCOGS: Math.round(totalCOGS),
            totalExpenses: Math.round(totalExpenses),
            totalOtherIncome: Math.round(totalOtherIncome),
            totalOtherExpenses: Math.round(totalOtherExpenses),
            netIncome: Math.round(netIncome),
            monthlyPnl: (monthly.rows as any[]).map(r => ({
                month: r.month,
                income: Math.round(Number(r.income) || 0),
                cogs: Math.round(Number(r.cogs) || 0),
                expenses: Math.round(Number(r.expenses) || 0),
                otherIncome: Math.round(Number(r.other_income) || 0),
                otherExpenses: Math.round(Number(r.other_expenses) || 0),
                netIncome: Math.round(Number(r.net_income) || 0),
            })),
            accountDetails: (accountDetails.rows as any[]).map(r => ({
                account: r.account ?? '',
                category: r.category ?? '',
                total: Math.round(Number(r.total) || 0),
                monthly: Array.isArray(r.monthly)
                    ? r.monthly.map((m: any) => ({ month: m.month, amount: Number(m.amount) || 0 }))
                    : [],
            })),
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials pnl-summary error:', error);
        res.status(500).json({ error: 'Failed to fetch P&L summary' });
    }
});

// ── GET /api/financials/expenses-summary ──
router.get('/expenses-summary', async (req: Request, res: Response) => {
    try {
        const trailing12CutOff = new Date();
        trailing12CutOff.setMonth(trailing12CutOff.getMonth() - 12);

        const vendors = await db.execute(sql`
            SELECT
                vendor_name,
                COALESCE(SUM(total_amount), 0)::numeric                                                 AS total_all_time,
                COALESCE(SUM(total_amount) FILTER (WHERE period_end >= ${trailing12CutOff}), 0)::numeric AS total_trailing_12mo
            FROM qbo_expenses_by_vendor
            GROUP BY vendor_name
            ORDER BY total_all_time DESC
            LIMIT 50
        `);

        const totals = await db.execute(sql`
            SELECT
                COALESCE(SUM(total_amount), 0)::numeric                                                 AS total_all_time,
                COALESCE(SUM(total_amount) FILTER (WHERE period_end >= ${trailing12CutOff}), 0)::numeric AS total_trailing_12mo,
                COUNT(DISTINCT vendor_name)::int                                                         AS vendor_count
            FROM qbo_expenses_by_vendor
        `);

        const t = totals.rows[0] as any;

        const result: ExpenseSummaryData = {
            totalAllTime: Math.round(Number(t.total_all_time) || 0),
            totalTrailing12mo: Math.round(Number(t.total_trailing_12mo) || 0),
            topVendors: (vendors.rows as any[]).map(r => ({
                vendor: r.vendor_name ?? '',
                totalAllTime: Math.round(Number(r.total_all_time) || 0),
                totalTrailing12mo: Math.round(Number(r.total_trailing_12mo) || 0),
            })),
            vendorCount: Number(t.vendor_count) || 0,
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials expenses-summary error:', error);
        res.status(500).json({ error: 'Failed to fetch expenses summary' });
    }
});

// ── GET /api/financials/customers ──
router.get('/customers', async (req: Request, res: Response) => {
    try {
        const trailing12CutOff = new Date();
        trailing12CutOff.setMonth(trailing12CutOff.getMonth() - 12);

        const customers = await db.execute(sql`
            SELECT
                c.id,
                c.customer_name,
                c.company,
                c.email,
                c.phone,
                COALESCE(tx.total_revenue, 0)::numeric          AS total_revenue,
                COALESCE(tx.transaction_count, 0)::int          AS transaction_count,
                COALESCE(est.estimate_count, 0)::int            AS estimate_count,
                TO_CHAR(tx.last_transaction_date, 'YYYY-MM-DD') AS last_transaction_date
            FROM qbo_customers c
            LEFT JOIN LATERAL (
                SELECT
                    SUM(amount)::numeric    AS total_revenue,
                    COUNT(*)::int           AS transaction_count,
                    MAX(transaction_date)   AS last_transaction_date
                FROM qbo_sales_transactions
                WHERE customer_name = c.customer_name
                  AND account_name = '4000 Sales'
            ) tx ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS estimate_count
                FROM qbo_estimates
                WHERE customer_name = c.customer_name
            ) est ON true
            ORDER BY total_revenue DESC NULLS LAST
        `);

        const activeCutoff = trailing12CutOff.toISOString().split('T')[0];
        const activeCustomers = (customers.rows as any[]).filter(
            r => r.last_transaction_date && r.last_transaction_date >= activeCutoff
        ).length;

        const result: QBOCustomerListData = {
            customers: (customers.rows as any[]).map(r => ({
                id: Number(r.id),
                customerName: r.customer_name ?? '',
                company: r.company ?? null,
                email: r.email ?? null,
                phone: r.phone ?? null,
                totalRevenue: Math.round(Number(r.total_revenue) || 0),
                transactionCount: Number(r.transaction_count),
                estimateCount: Number(r.estimate_count),
                lastTransactionDate: r.last_transaction_date ?? null,
            })),
            totalCustomers: customers.rows.length,
            activeCustomers,
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customer list' });
    }
});

// ── GET /api/financials/estimate-conversion ──
router.get('/estimate-conversion', async (req: Request, res: Response) => {
    try {
        const statusCounts = await db.execute(sql`
            SELECT
                COUNT(*)::int                                                       AS total_estimates,
                COUNT(*) FILTER (WHERE status = 'Accepted')::int                   AS accepted_count,
                COUNT(*) FILTER (WHERE status = 'Invoiced')::int                   AS invoiced_count,
                COUNT(*) FILTER (WHERE status NOT IN ('Accepted', 'Invoiced'))::int AS pending_count,
                COALESCE(SUM(total_amount), 0)::numeric                            AS total_estimate_value,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'Invoiced'), 0)::numeric AS total_invoiced_value
            FROM qbo_estimates
        `);

        const monthly = await db.execute(sql`
            SELECT
                TO_CHAR(estimate_date, 'YYYY-MM') AS month,
                COUNT(*)::int                     AS count,
                COALESCE(SUM(total_amount), 0)::numeric AS total_value,
                COUNT(*) FILTER (WHERE status = 'Accepted')::int AS accepted_count
            FROM qbo_estimates
            GROUP BY 1
            ORDER BY 1
        `);

        const s = statusCounts.rows[0] as any;
        const total = Number(s.total_estimates) || 0;
        const accepted = Number(s.accepted_count) || 0;

        const result: EstimateConversionData = {
            totalEstimates: total,
            acceptedCount: accepted,
            invoicedCount: Number(s.invoiced_count) || 0,
            pendingCount: Number(s.pending_count) || 0,
            conversionRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
            totalEstimateValue: Math.round(Number(s.total_estimate_value) || 0),
            totalInvoicedValue: Math.round(Number(s.total_invoiced_value) || 0),
            monthlyEstimates: (monthly.rows as any[]).map(r => ({
                month: r.month,
                count: Number(r.count),
                totalValue: Math.round(Number(r.total_value) || 0),
                acceptedCount: Number(r.accepted_count),
            })),
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials estimate-conversion error:', error);
        res.status(500).json({ error: 'Failed to fetch estimate conversion data' });
    }
});

// ── GET /api/financials/balance-sheet ──
router.get('/balance-sheet', async (req: Request, res: Response) => {
    try {
        const items = await db.execute(sql`
            SELECT
                account_name  AS account,
                category,
                subcategory,
                COALESCE(SUM(amount), 0)::numeric AS total
            FROM qbo_balance_sheet
            GROUP BY account_name, category, subcategory
            ORDER BY
                CASE category
                    WHEN 'Assets'      THEN 1
                    WHEN 'Liabilities' THEN 2
                    WHEN 'Equity'      THEN 3
                    ELSE 4
                END,
                subcategory NULLS LAST,
                total DESC
        `);

        const snapshotRow = await db.execute(sql`
            SELECT TO_CHAR(MAX(snapshot_date), 'YYYY-MM-DD') AS snapshot_date
            FROM qbo_balance_sheet
        `);

        const rows = items.rows as any[];

        const totalAssets = rows
            .filter(r => r.category === 'Assets')
            .reduce((sum, r) => sum + (Number(r.total) || 0), 0);

        const totalLiabilities = rows
            .filter(r => r.category === 'Liabilities')
            .reduce((sum, r) => sum + (Number(r.total) || 0), 0);

        const totalEquity = rows
            .filter(r => r.category === 'Equity')
            .reduce((sum, r) => sum + (Number(r.total) || 0), 0);

        const snapshotDate = (snapshotRow.rows[0] as any)?.snapshot_date ?? new Date().toISOString().split('T')[0];

        const result: BalanceSheetData = {
            snapshotDate,
            totalAssets: Math.round(totalAssets),
            totalLiabilities: Math.round(totalLiabilities),
            totalEquity: Math.round(totalEquity),
            items: rows.map(r => ({
                account: r.account ?? '',
                category: r.category ?? '',
                subcategory: r.subcategory ?? null,
                total: Math.round(Number(r.total) || 0),
            })),
        };

        res.json(result);
    } catch (error: any) {
        console.error('Financials balance-sheet error:', error);
        res.status(500).json({ error: 'Failed to fetch balance sheet' });
    }
});

export default router;
