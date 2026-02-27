// ── S2PX E2E: Financial Data Integrity & Math Correctness ──
// Verifies that synthetic pricing data flows through calculations correctly
// and that derived values displayed in the UI match expected results.
//
// Two layers of assertions per group:
//   1. Data-level: assert against the raw mock objects directly (pure math)
//   2. UI-level:   navigate to the page and verify rendered text

import { test, expect } from '@playwright/test';
import {
    setupMockApi,
    bypassFirebaseAuth,
    MOCK_REVENUE,
    MOCK_PNL,
    MOCK_EXPENSES,
    MOCK_CUSTOMERS,
    MOCK_ESTIMATES,
    MOCK_BALANCE_SHEET,
    MOCK_SCORECARD_OVERVIEW,
} from './fixtures/mock-data';

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Format a number as USD currency exactly as the app's formatCurrency util does */
function fmt(n: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

/** Navigate to /revenue and wait for the Financial Dashboard heading */
async function gotoRevenue(page: import('@playwright/test').Page) {
    await page.goto('/dashboard/revenue');
    await expect(page.getByRole('heading', { name: 'Financial Dashboard' })).toBeVisible();
}

/** Navigate to /scorecard and wait for the Scorecard heading */
async function gotoScorecard(page: import('@playwright/test').Page) {
    await page.goto('/dashboard/scorecard');
    await expect(page.getByRole('heading', { name: 'Scorecard' })).toBeVisible();
}

/** Click a Revenue sub-tab by its visible label */
async function clickRevenueTab(page: import('@playwright/test').Page, label: string) {
    await page.getByRole('button', { name: label, exact: true }).click();
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. REVENUE CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Revenue Calculations', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('total revenue equals sum of all monthly revenue values', () => {
        const computed = MOCK_REVENUE.monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
        expect(computed).toBe(MOCK_REVENUE.totalRevenue);
        // Explicit expected value from fixture comment
        expect(computed).toBe(4_506_000);
    });

    test('YTD revenue equals sum of 2026 months only', () => {
        const ytd = MOCK_REVENUE.monthlyRevenue
            .filter(m => m.month.startsWith('2026'))
            .reduce((sum, m) => sum + m.revenue, 0);
        expect(ytd).toBe(MOCK_REVENUE.ytdRevenue);
        // Jan 2026 (445,000) + Feb 2026 (462,000) = 907,000
        expect(ytd).toBe(907_000);
    });

    test('top customers are sorted in descending revenue order', () => {
        const revenues = MOCK_REVENUE.topCustomers.map(c => c.revenue);
        for (let i = 0; i < revenues.length - 1; i++) {
            expect(revenues[i]).toBeGreaterThanOrEqual(revenues[i + 1]);
        }
    });

    test('no negative revenue values exist in monthly data', () => {
        for (const month of MOCK_REVENUE.monthlyRevenue) {
            expect(month.revenue).toBeGreaterThan(0);
        }
    });

    test('no negative revenue values exist for top customers', () => {
        for (const customer of MOCK_REVENUE.topCustomers) {
            expect(customer.revenue).toBeGreaterThan(0);
        }
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('Revenue page displays correct all-time total', async ({ page }) => {
        await gotoRevenue(page);
        // KPI card: "All-Time Revenue" → formatCurrency(4_506_000) = "$4,506,000"
        await expect(page.getByText(fmt(MOCK_REVENUE.totalRevenue))).toBeVisible();
    });

    test('Revenue page displays correct YTD revenue', async ({ page }) => {
        await gotoRevenue(page);
        // KPI card: "YTD Revenue" → "$907,000"
        await expect(page.getByText(fmt(MOCK_REVENUE.ytdRevenue))).toBeVisible();
    });

    test('Revenue page renders the top customer by name and revenue', async ({ page }) => {
        await gotoRevenue(page);
        const top = MOCK_REVENUE.topCustomers[0];
        await expect(page.getByText(top.customerName)).toBeVisible();
        await expect(page.getByText(fmt(top.revenue))).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. P&L CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('P&L Calculations', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('net income formula: income + otherIncome - COGS - expenses - otherExpenses', () => {
        const {
            totalIncome, totalOtherIncome, totalCOGS, totalExpenses, totalOtherExpenses, netIncome,
        } = MOCK_PNL;

        const computed = totalIncome + totalOtherIncome - totalCOGS - totalExpenses - totalOtherExpenses;
        expect(computed).toBe(netIncome);
        // 4,506,000 + 15,000 - 1,802,400 - 1,351,800 - 8,200 = 1,358,600
        expect(computed).toBe(1_358_600);
    });

    test('gross profit = income - COGS', () => {
        const grossProfit = MOCK_PNL.totalIncome - MOCK_PNL.totalCOGS;
        expect(grossProfit).toBe(4_506_000 - 1_802_400);
        expect(grossProfit).toBe(2_703_600);
    });

    test('gross margin % = (income - COGS) / income * 100, rounds to 60.0%', () => {
        const grossProfit = MOCK_PNL.totalIncome - MOCK_PNL.totalCOGS;
        const margin = (grossProfit / MOCK_PNL.totalIncome) * 100;
        expect(margin).toBeCloseTo(60.0, 1);
    });

    test('COGS is less than total income', () => {
        expect(MOCK_PNL.totalCOGS).toBeLessThan(MOCK_PNL.totalIncome);
    });

    test('net income is positive (company is profitable)', () => {
        expect(MOCK_PNL.netIncome).toBeGreaterThan(0);
    });

    test('COGS account items sum to totalCOGS', () => {
        const cogsTotal = MOCK_PNL.accountDetails
            .filter(a => a.category === 'Cost of Goods Sold')
            .reduce((sum, a) => sum + a.total, 0);
        expect(cogsTotal).toBe(MOCK_PNL.totalCOGS);
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('P&L tab displays correct gross profit value', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'P&L');

        const grossProfit = MOCK_PNL.totalIncome - MOCK_PNL.totalCOGS; // 2,703,600
        await expect(page.getByText(fmt(grossProfit))).toBeVisible();
    });

    test('P&L tab displays correct gross margin percentage', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'P&L');

        // UI renders: `${grossMargin.toFixed(1)}%` = "60.0%"
        await expect(page.getByText('60.0%')).toBeVisible();
    });

    test('P&L tab displays correct net income', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'P&L');

        await expect(page.getByText(fmt(MOCK_PNL.netIncome))).toBeVisible();
    });

    test('P&L tab displays income label', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'P&L');

        const kpiCards = page.locator('.rounded-xl.p-4');
        await expect(kpiCards.filter({ hasText: 'Income' }).first()).toBeVisible();
        await expect(kpiCards.filter({ hasText: 'COGS' }).first()).toBeVisible();
        await expect(kpiCards.filter({ hasText: 'Net Income' }).first()).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. BALANCE SHEET EQUATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Balance Sheet Equation', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('accounting equation holds: Assets = Liabilities + Equity', () => {
        const { totalAssets, totalLiabilities, totalEquity } = MOCK_BALANCE_SHEET;
        expect(totalLiabilities + totalEquity).toBe(totalAssets);
        // 1,140,000 + 1,710,000 = 2,850,000
        expect(totalAssets).toBe(2_850_000);
        expect(totalLiabilities).toBe(1_140_000);
        expect(totalEquity).toBe(1_710_000);
    });

    test('sum of asset line items equals totalAssets', () => {
        const assetItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Assets');
        const computed = assetItems.reduce((sum, i) => sum + i.total, 0);
        expect(computed).toBe(MOCK_BALANCE_SHEET.totalAssets);
    });

    test('sum of liability line items equals totalLiabilities', () => {
        const liabilityItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Liabilities');
        const computed = liabilityItems.reduce((sum, i) => sum + i.total, 0);
        expect(computed).toBe(MOCK_BALANCE_SHEET.totalLiabilities);
    });

    test('sum of equity line items equals totalEquity', () => {
        const equityItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Equity');
        const computed = equityItems.reduce((sum, i) => sum + i.total, 0);
        expect(computed).toBe(MOCK_BALANCE_SHEET.totalEquity);
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('Balance Sheet tab displays total assets', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Balance Sheet');
        await expect(page.getByText('Total Assets')).toBeVisible();

        // Value appears in both KPI card and section header — use .first()
        await expect(page.getByText(fmt(MOCK_BALANCE_SHEET.totalAssets)).first()).toBeVisible();
    });

    test('Balance Sheet tab displays total liabilities', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Balance Sheet');
        await expect(page.getByText('Total Liabilities')).toBeVisible();

        await expect(page.getByText(fmt(MOCK_BALANCE_SHEET.totalLiabilities)).first()).toBeVisible();
    });

    test('Balance Sheet tab displays total equity', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Balance Sheet');
        await expect(page.getByText('Total Equity')).toBeVisible();

        await expect(page.getByText(fmt(MOCK_BALANCE_SHEET.totalEquity)).first()).toBeVisible();
    });

    test('Balance Sheet tab renders section headers', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Balance Sheet');

        await expect(page.locator('h3', { hasText: 'Assets' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Liabilities' })).toBeVisible();
        await expect(page.locator('h3', { hasText: 'Equity' })).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ESTIMATE CONVERSION MATH
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Estimate Conversion Math', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('conversion rate = accepted / total = 0.5 (decimal fraction)', () => {
        const computed = MOCK_ESTIMATES.acceptedCount / MOCK_ESTIMATES.totalEstimates;
        expect(computed).toBe(MOCK_ESTIMATES.conversionRate);
        // 584 / 1168 = 0.5 (stored as decimal; UI multiplies by 100 to display 50.0%)
        expect(computed).toBe(0.5);
    });

    test('pending count = total - accepted - invoiced', () => {
        const computed =
            MOCK_ESTIMATES.totalEstimates
            - MOCK_ESTIMATES.acceptedCount
            - MOCK_ESTIMATES.invoicedCount;
        expect(computed).toBe(MOCK_ESTIMATES.pendingCount);
        // 1168 - 584 - 467 = 117
        expect(computed).toBe(117);
    });

    test('invoiced value is less than total estimate value', () => {
        expect(MOCK_ESTIMATES.totalInvoicedValue).toBeLessThan(MOCK_ESTIMATES.totalEstimateValue);
    });

    test('accepted count is less than or equal to total estimates', () => {
        expect(MOCK_ESTIMATES.acceptedCount).toBeLessThanOrEqual(MOCK_ESTIMATES.totalEstimates);
    });

    test('invoiced count is less than or equal to accepted count', () => {
        expect(MOCK_ESTIMATES.invoicedCount).toBeLessThanOrEqual(MOCK_ESTIMATES.acceptedCount);
    });

    test('all monthly estimate counts are positive integers', () => {
        for (const month of MOCK_ESTIMATES.monthlyEstimates) {
            expect(month.count).toBeGreaterThan(0);
            expect(Number.isInteger(month.count)).toBe(true);
            expect(month.acceptedCount).toBeGreaterThanOrEqual(0);
        }
    });

    test('monthly accepted counts do not exceed monthly totals', () => {
        for (const month of MOCK_ESTIMATES.monthlyEstimates) {
            expect(month.acceptedCount).toBeLessThanOrEqual(month.count);
        }
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('Estimates tab displays total estimate count', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Estimates');

        // KPI card "Total Estimates" → "1168"
        await expect(page.getByText(String(MOCK_ESTIMATES.totalEstimates))).toBeVisible();
    });

    test('Estimates tab displays accepted count', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Estimates');

        await expect(page.getByText(String(MOCK_ESTIMATES.acceptedCount))).toBeVisible();
    });

    test('Estimates tab displays invoiced count', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Estimates');

        await expect(page.getByText(String(MOCK_ESTIMATES.invoicedCount))).toBeVisible();
    });

    test('Estimates tab displays total estimate value', async ({ page }) => {
        await gotoRevenue(page);
        await clickRevenueTab(page, 'Estimates');

        // KPI card "Estimate Value" → "$6,250,000"
        await expect(page.getByText(fmt(MOCK_ESTIMATES.totalEstimateValue))).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SCORECARD CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Scorecard Calculations', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('win rate = won / (won + lost) * 100, rounds to 64%', () => {
        const { wonCount, lostCount, winRate } = MOCK_SCORECARD_OVERVIEW;
        const computed = Math.round((wonCount / (wonCount + lostCount)) * 100);
        expect(computed).toBe(winRate);
        // 145 / (145 + 82) * 100 = 145/227 * 100 ≈ 63.88 → 64
        expect(computed).toBe(64);
    });

    test('blended margin = (revenue - cost) / revenue * 100, rounds to 45%', () => {
        const { totalRevenue, totalCost, blendedMarginPct } = MOCK_SCORECARD_OVERVIEW;
        const computed = Math.round(((totalRevenue - totalCost) / totalRevenue) * 100);
        expect(computed).toBe(blendedMarginPct);
        // (3,250,000 - 1,787,500) / 3,250,000 * 100 = 45%
        expect(computed).toBe(45);
    });

    test('avg deal size = total revenue / won count, rounds to 22,414', () => {
        const { totalRevenue, wonCount, avgDealSize } = MOCK_SCORECARD_OVERVIEW;
        const computed = Math.round(totalRevenue / wonCount);
        expect(computed).toBe(avgDealSize);
        // 3,250,000 / 145 ≈ 22,413.79 → 22,414
        expect(computed).toBe(22_414);
    });

    test('total deals = won + lost + active', () => {
        const { wonCount, lostCount, activeCount, totalDeals } = MOCK_SCORECARD_OVERVIEW;
        const computed = wonCount + lostCount + activeCount;
        expect(computed).toBe(totalDeals);
        // 145 + 82 + 63 = 290
        expect(computed).toBe(290);
    });

    test('blended margin is between 0 and 100 percent', () => {
        expect(MOCK_SCORECARD_OVERVIEW.blendedMarginPct).toBeGreaterThan(0);
        expect(MOCK_SCORECARD_OVERVIEW.blendedMarginPct).toBeLessThan(100);
    });

    test('total cost is less than total revenue', () => {
        expect(MOCK_SCORECARD_OVERVIEW.totalCost).toBeLessThan(MOCK_SCORECARD_OVERVIEW.totalRevenue);
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('Scorecard overview displays win rate', async ({ page }) => {
        await gotoScorecard(page);

        // KPI card renders: `${data.winRate}%` = "64%"
        await expect(page.getByText(`${MOCK_SCORECARD_OVERVIEW.winRate}%`)).toBeVisible();
    });

    test('Scorecard overview displays blended margin', async ({ page }) => {
        await gotoScorecard(page);

        // KPI card renders: `${data.blendedMarginPct}%` = "45%"
        await expect(page.getByText(`${MOCK_SCORECARD_OVERVIEW.blendedMarginPct}%`)).toBeVisible();
    });

    test('Scorecard overview displays avg deal size', async ({ page }) => {
        await gotoScorecard(page);

        // KPI card renders formatCurrency(avgDealSize) = "$22,414"
        await expect(page.getByText(fmt(MOCK_SCORECARD_OVERVIEW.avgDealSize))).toBeVisible();
    });

    test('Scorecard overview displays actual QBO revenue', async ({ page }) => {
        await gotoScorecard(page);

        // KPI card "Actual Revenue (QBO)" → formatCurrency(4,506,000) = "$4,506,000"
        await expect(page.getByText(fmt(MOCK_SCORECARD_OVERVIEW.actualRevenue))).toBeVisible();
    });

    test('Scorecard overview displays the Actual Revenue (QBO) label', async ({ page }) => {
        await gotoScorecard(page);

        await expect(page.getByText('Actual Revenue (QBO)')).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. CROSS-PAGE CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Cross-Page Consistency', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
    });

    // ── Data-level ──────────────────────────────────────────────────────────

    test('scorecard actualRevenue matches revenue page totalRevenue in mock data', () => {
        // Both should reference the same QBO total: $4,506,000
        expect(MOCK_SCORECARD_OVERVIEW.actualRevenue).toBe(MOCK_REVENUE.totalRevenue);
        expect(MOCK_SCORECARD_OVERVIEW.actualRevenue).toBe(4_506_000);
    });

    test('scorecard ytdActualRevenue matches revenue page ytdRevenue in mock data', () => {
        expect(MOCK_SCORECARD_OVERVIEW.ytdActualRevenue).toBe(MOCK_REVENUE.ytdRevenue);
        expect(MOCK_SCORECARD_OVERVIEW.ytdActualRevenue).toBe(907_000);
    });

    // ── UI-level ────────────────────────────────────────────────────────────

    test('the same $4,506,000 total appears on both Revenue and Scorecard pages', async ({ page }) => {
        const expectedTotal = fmt(4_506_000); // "$4,506,000"

        // Step 1: Revenue page — "All-Time Revenue" KPI card
        await gotoRevenue(page);
        await expect(page.getByText(expectedTotal)).toBeVisible();

        // Step 2: Scorecard page — "Actual Revenue (QBO)" KPI card
        await gotoScorecard(page);
        await expect(page.getByText(expectedTotal)).toBeVisible();
    });

    test('YTD actual revenue $907,000 is consistent across pages', async ({ page }) => {
        const expectedYtd = fmt(907_000); // "$907,000"

        // Revenue page YTD KPI
        await gotoRevenue(page);
        await expect(page.getByText(expectedYtd)).toBeVisible();

        // Scorecard YTD actual KPI
        await gotoScorecard(page);
        await expect(page.getByText(expectedYtd)).toBeVisible();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. DATA SANITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Data Sanity Checks', () => {
    test('all monetary values are non-negative except depreciation', () => {
        // Revenue monthly
        for (const m of MOCK_REVENUE.monthlyRevenue) {
            expect(m.revenue).toBeGreaterThanOrEqual(0);
        }

        // Top customers
        for (const c of MOCK_REVENUE.topCustomers) {
            expect(c.revenue).toBeGreaterThanOrEqual(0);
        }

        // P&L totals (these are gross totals, not net, so should all be >= 0)
        expect(MOCK_PNL.totalIncome).toBeGreaterThanOrEqual(0);
        expect(MOCK_PNL.totalCOGS).toBeGreaterThanOrEqual(0);
        expect(MOCK_PNL.totalExpenses).toBeGreaterThanOrEqual(0);
        expect(MOCK_PNL.totalOtherIncome).toBeGreaterThanOrEqual(0);
        expect(MOCK_PNL.totalOtherExpenses).toBeGreaterThanOrEqual(0);

        // Expenses
        expect(MOCK_EXPENSES.totalAllTime).toBeGreaterThanOrEqual(0);
        expect(MOCK_EXPENSES.totalTrailing12mo).toBeGreaterThanOrEqual(0);
        for (const v of MOCK_EXPENSES.topVendors) {
            expect(v.totalAllTime).toBeGreaterThanOrEqual(0);
            expect(v.totalTrailing12mo).toBeGreaterThanOrEqual(0);
        }

        // Balance sheet — depreciation is intentionally negative, everything else non-negative
        for (const item of MOCK_BALANCE_SHEET.items) {
            if (item.account === 'Depreciation') {
                expect(item.total).toBeLessThan(0); // expected to be negative
            } else {
                expect(item.total).toBeGreaterThanOrEqual(0);
            }
        }

        // Estimate values
        expect(MOCK_ESTIMATES.totalEstimateValue).toBeGreaterThanOrEqual(0);
        expect(MOCK_ESTIMATES.totalInvoicedValue).toBeGreaterThanOrEqual(0);

        // Scorecard revenue/cost
        expect(MOCK_SCORECARD_OVERVIEW.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.totalCost).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.avgDealSize).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.activePipelineValue).toBeGreaterThanOrEqual(0);
    });

    test('all percentage values are between 0 and 100', () => {
        expect(MOCK_SCORECARD_OVERVIEW.winRate).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.winRate).toBeLessThanOrEqual(100);

        expect(MOCK_SCORECARD_OVERVIEW.blendedMarginPct).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.blendedMarginPct).toBeLessThanOrEqual(100);

        expect(MOCK_SCORECARD_OVERVIEW.rmsPassRate).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.rmsPassRate).toBeLessThanOrEqual(100);

        expect(MOCK_SCORECARD_OVERVIEW.qcPassRate).toBeGreaterThanOrEqual(0);
        expect(MOCK_SCORECARD_OVERVIEW.qcPassRate).toBeLessThanOrEqual(100);

        // conversionRate in mock is stored as decimal fraction 0–1
        expect(MOCK_ESTIMATES.conversionRate).toBeGreaterThanOrEqual(0);
        expect(MOCK_ESTIMATES.conversionRate).toBeLessThanOrEqual(1);
    });

    test('all count values are non-negative integers', () => {
        // Customer counts
        expect(MOCK_CUSTOMERS.totalCustomers).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_CUSTOMERS.totalCustomers)).toBe(true);
        expect(MOCK_CUSTOMERS.activeCustomers).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_CUSTOMERS.activeCustomers)).toBe(true);

        // Estimate counts
        expect(MOCK_ESTIMATES.totalEstimates).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_ESTIMATES.totalEstimates)).toBe(true);
        expect(MOCK_ESTIMATES.acceptedCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_ESTIMATES.acceptedCount)).toBe(true);
        expect(MOCK_ESTIMATES.invoicedCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_ESTIMATES.invoicedCount)).toBe(true);
        expect(MOCK_ESTIMATES.pendingCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_ESTIMATES.pendingCount)).toBe(true);

        // Scorecard deal counts
        expect(MOCK_SCORECARD_OVERVIEW.wonCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_SCORECARD_OVERVIEW.wonCount)).toBe(true);
        expect(MOCK_SCORECARD_OVERVIEW.lostCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_SCORECARD_OVERVIEW.lostCount)).toBe(true);
        expect(MOCK_SCORECARD_OVERVIEW.activeCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_SCORECARD_OVERVIEW.activeCount)).toBe(true);
        expect(MOCK_SCORECARD_OVERVIEW.totalDeals).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_SCORECARD_OVERVIEW.totalDeals)).toBe(true);

        // Expense vendor count
        expect(MOCK_EXPENSES.vendorCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(MOCK_EXPENSES.vendorCount)).toBe(true);
    });

    test('monthly revenue data is in chronological order', () => {
        const months = MOCK_REVENUE.monthlyRevenue.map(m => m.month);
        for (let i = 0; i < months.length - 1; i++) {
            expect(months[i] < months[i + 1]).toBe(true);
        }
    });

    test('monthly estimate data is in chronological order', () => {
        const months = MOCK_ESTIMATES.monthlyEstimates.map(m => m.month);
        for (let i = 0; i < months.length - 1; i++) {
            expect(months[i] < months[i + 1]).toBe(true);
        }
    });

    test('all customer names are non-empty strings', () => {
        for (const customer of MOCK_REVENUE.topCustomers) {
            expect(typeof customer.customerName).toBe('string');
            expect(customer.customerName.trim().length).toBeGreaterThan(0);
        }

        for (const customer of MOCK_CUSTOMERS.customers) {
            expect(typeof customer.customerName).toBe('string');
            expect(customer.customerName.trim().length).toBeGreaterThan(0);
        }
    });

    test('all balance sheet items have a valid category', () => {
        const validCategories = new Set(['Assets', 'Liabilities', 'Equity']);
        for (const item of MOCK_BALANCE_SHEET.items) {
            expect(validCategories.has(item.category)).toBe(true);
        }
    });

    test('active customers does not exceed total customers', () => {
        expect(MOCK_CUSTOMERS.activeCustomers).toBeLessThanOrEqual(MOCK_CUSTOMERS.totalCustomers);
    });

    test('trailing 12-month expenses do not exceed all-time expenses', () => {
        expect(MOCK_EXPENSES.totalTrailing12mo).toBeLessThanOrEqual(MOCK_EXPENSES.totalAllTime);
    });
});
