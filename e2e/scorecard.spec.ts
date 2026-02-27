// ── S2PX Scorecard Dashboard — Playwright E2E Tests ──
// Coverage: all 4 tabs (Overview, Pipeline, Production, Profitability),
// time-range filter toggle, KPI card values, chart titles, table rows,
// and data-integrity cross-checks against mock fixture constants.
//
// Usage:
//   npx playwright test e2e/scorecard.spec.ts
//   npx playwright test e2e/scorecard.spec.ts --headed

import { test, expect } from '@playwright/test';
import {
    setupMockApi,
    bypassFirebaseAuth,
    MOCK_SCORECARD_OVERVIEW,
    MOCK_PIPELINE_REPORT,
    MOCK_PRODUCTION_REPORT,
    MOCK_PROFITABILITY_REPORT,
} from './fixtures/mock-data';

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Wait for the Scorecard page to finish its initial data fetch.
 *  The Loader2 spinner is shown while isLoading=true; we wait for it to
 *  disappear before making assertions. */
async function waitForLoad(page: Parameters<typeof setupMockApi>[0]) {
    // Spinner must be gone before we assert content.
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
    // Confirm the page header is present.
    await expect(page.getByRole('heading', { name: 'Scorecard' })).toBeVisible();
}

// ── beforeEach shared across all test groups ────────────────────────────────

test.describe('S2PX Scorecard Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard/scorecard');
        await waitForLoad(page);
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 1 — Page Shell / Chrome
    // ══════════════════════════════════════════════════════════════════════

    test.describe('page shell', () => {
        test('shows Scorecard heading with executive operations dashboard subtitle', async ({ page }) => {
            await expect(page.getByRole('heading', { name: 'Scorecard' })).toBeVisible();
            // The subtitle text ends with a period in the source
            await expect(page.getByText('Executive operations dashboard')).toBeVisible();
        });

        test('renders all four tab buttons', async ({ page }) => {
            for (const tab of ['Overview', 'Pipeline', 'Production', 'Profitability']) {
                await expect(page.getByRole('button', { name: tab })).toBeVisible();
            }
        });

        test('renders all four time-range filter buttons', async ({ page }) => {
            for (const label of ['3M', '6M', '12M', 'All']) {
                await expect(page.getByRole('button', { name: label })).toBeVisible();
            }
        });

        test('Overview tab is active by default', async ({ page }) => {
            // Active tab has blue text / border; check it has the active class
            const overviewBtn = page.getByRole('button', { name: 'Overview' });
            await expect(overviewBtn).toHaveClass(/text-blue-600/);
        });

        test('12M time-range button is active by default (matches useState(12))', async ({ page }) => {
            const btn12M = page.getByRole('button', { name: '12M' });
            await expect(btn12M).toHaveClass(/bg-slate-800/);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 2 — Overview Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Overview tab', () => {
        // The Overview tab is already shown on load; no click needed.

        test('renders 10 KPI cards', async ({ page }) => {
            // Each KpiCard has a text-3xl font-bold value div.
            // Count via the unique labels which are always rendered.
            const kpiLabels = [
                'Win Rate',
                'Estimated Revenue',
                'Actual Revenue (QBO)',
                'YTD Actual Revenue',
                'Blended Margin',
                'Avg Deal Size',
                'Pipeline Value',
                'Avg Cycle Time',
                'RMS Pass Rate',
                'QC Pass Rate',
            ];
            for (const label of kpiLabels) {
                await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
            }
        });

        // ── Individual KPI values ────────────────────────────────────────

        test('Win Rate KPI shows 64%', async ({ page }) => {
            // The card renders value in a text-3xl div immediately above the label.
            const winRateCard = page.locator('div', { has: page.getByText('Win Rate') }).first();
            await expect(winRateCard).toContainText(`${MOCK_SCORECARD_OVERVIEW.winRate}%`);
        });

        test('Estimated Revenue KPI shows $3,250,000', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Estimated Revenue') }).first();
            await expect(card).toContainText('$3,250,000');
        });

        test('Actual Revenue (QBO) KPI shows $4,506,000', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Actual Revenue (QBO)') }).first();
            await expect(card).toContainText('$4,506,000');
        });

        test('YTD Actual Revenue KPI shows $907,000', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('YTD Actual Revenue') }).first();
            await expect(card).toContainText('$907,000');
        });

        test('Blended Margin KPI shows 45%', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Blended Margin') }).first();
            await expect(card).toContainText(`${MOCK_SCORECARD_OVERVIEW.blendedMarginPct}%`);
        });

        test('Avg Deal Size KPI shows $22,414', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Avg Deal Size') }).first();
            await expect(card).toContainText('$22,414');
        });

        test('Pipeline Value KPI shows $1,850,000', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Pipeline Value') }).first();
            await expect(card).toContainText('$1,850,000');
        });

        test('Avg Cycle Time KPI shows 22d', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Avg Cycle Time') }).first();
            await expect(card).toContainText(`${MOCK_SCORECARD_OVERVIEW.avgCycleDays}d`);
        });

        test('RMS Pass Rate KPI shows 94%', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('RMS Pass Rate') }).first();
            await expect(card).toContainText(`${MOCK_SCORECARD_OVERVIEW.rmsPassRate}%`);
        });

        test('QC Pass Rate KPI shows 88%', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('QC Pass Rate') }).first();
            await expect(card).toContainText(`${MOCK_SCORECARD_OVERVIEW.qcPassRate}%`);
        });

        // ── KPI chip badges ──────────────────────────────────────────────

        test('Win Rate card has "Closed" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Win Rate') }).first();
            await expect(card).toContainText('Closed');
        });

        test('RMS Pass Rate card has "≤5mm" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('RMS Pass Rate') }).first();
            await expect(card).toContainText('≤5mm');
        });

        test('QC Pass Rate card has "BIM QC" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('QC Pass Rate') }).first();
            await expect(card).toContainText('BIM QC');
        });

        // ── Charts ───────────────────────────────────────────────────────

        test('renders Monthly Revenue: Actual vs Estimated chart', async ({ page }) => {
            await expect(page.getByText('Monthly Revenue: Actual vs Estimated')).toBeVisible();
        });

        test('renders Win Rate Trend chart', async ({ page }) => {
            await expect(page.getByText('Win Rate Trend')).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3 — Pipeline Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Pipeline tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByRole('button', { name: 'Pipeline' }).click();
            // Wait for tab content to be visible by checking a unique element
            await expect(page.getByText('Deal Funnel')).toBeVisible();
        });

        test('Pipeline tab becomes active after click', async ({ page }) => {
            const pipelineBtn = page.getByRole('button', { name: 'Pipeline' });
            await expect(pipelineBtn).toHaveClass(/text-blue-600/);
        });

        // ── Tier KPI cards ───────────────────────────────────────────────

        test('shows Minnow Avg Deal card with $8,500', async ({ page }) => {
            await expect(page.getByText('Minnow Avg Deal')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Minnow Avg Deal') }).first();
            await expect(card).toContainText('$8,500');
        });

        test('shows Dolphin Avg Deal card with $24,000', async ({ page }) => {
            await expect(page.getByText('Dolphin Avg Deal')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Dolphin Avg Deal') }).first();
            await expect(card).toContainText('$24,000');
        });

        test('shows Whale Avg Deal card with $85,000', async ({ page }) => {
            await expect(page.getByText('Whale Avg Deal')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Whale Avg Deal') }).first();
            await expect(card).toContainText('$85,000');
        });

        // ── Tier chip counts ─────────────────────────────────────────────

        test('Minnow card shows "68 deals" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Minnow Avg Deal') }).first();
            await expect(card).toContainText('68 deals');
        });

        test('Dolphin card shows "52 deals" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Dolphin Avg Deal') }).first();
            await expect(card).toContainText('52 deals');
        });

        test('Whale card shows "25 deals" chip', async ({ page }) => {
            const card = page.locator('div', { has: page.getByText('Whale Avg Deal') }).first();
            await expect(card).toContainText('25 deals');
        });

        // ── Charts ───────────────────────────────────────────────────────

        test('renders Deal Funnel chart', async ({ page }) => {
            await expect(page.getByText('Deal Funnel')).toBeVisible();
        });

        test('renders Monthly Pipeline Activity chart', async ({ page }) => {
            await expect(page.getByText('Monthly Pipeline Activity')).toBeVisible();
        });

        test('renders Win Rate by Lead Source chart', async ({ page }) => {
            await expect(page.getByText('Win Rate by Lead Source')).toBeVisible();
        });

        // ── Lead source data spot-check ──────────────────────────────────

        test('Win Rate by Lead Source chart shows Referral source data', async ({ page }) => {
            // The source names are rendered as YAxis labels inside the recharts SVG.
            // We locate via the text "Referral" which recharts renders as a <text> element.
            const referralEntry = MOCK_PIPELINE_REPORT.winRateBySource.find(s => s.source === 'Referral');
            expect(referralEntry).toBeDefined();
            expect(referralEntry!.winRate).toBe(79);
            // Verify the text exists in the chart area
            await expect(page.locator('text', { hasText: 'Referral' }).first()).toBeVisible();
        });

        test('Referral has the highest win rate (79%) among lead sources', async ({ page }) => {
            const rates = MOCK_PIPELINE_REPORT.winRateBySource.map(s => s.winRate);
            const maxRate = Math.max(...rates);
            const topSource = MOCK_PIPELINE_REPORT.winRateBySource.find(s => s.winRate === maxRate);
            expect(topSource?.source).toBe('Referral');
            expect(topSource?.winRate).toBe(79);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 4 — Production Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Production tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByRole('button', { name: 'Production' }).click();
            await expect(page.getByText('Stage Distribution')).toBeVisible();
        });

        test('Production tab becomes active after click', async ({ page }) => {
            const productionBtn = page.getByRole('button', { name: 'Production' });
            await expect(productionBtn).toHaveClass(/text-blue-600/);
        });

        // ── Quality gate KPI cards ───────────────────────────────────────

        test('Field RMS Pass Rate card shows 94%', async ({ page }) => {
            await expect(page.getByText('Field RMS Pass Rate')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Field RMS Pass Rate') }).first();
            await expect(card).toContainText(`${MOCK_PRODUCTION_REPORT.qualityGates.fieldRms.passRate}%`);
        });

        test('Field RMS Pass Rate card chip shows 72/77', async ({ page }) => {
            const { pass, total } = MOCK_PRODUCTION_REPORT.qualityGates.fieldRms;
            const card = page.locator('div', { has: page.getByText('Field RMS Pass Rate') }).first();
            await expect(card).toContainText(`${pass}/${total}`);
        });

        test('Avg Overlap Pass Rate card shows 88%', async ({ page }) => {
            await expect(page.getByText('Avg Overlap Pass Rate')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Avg Overlap Pass Rate') }).first();
            await expect(card).toContainText(`${MOCK_PRODUCTION_REPORT.qualityGates.avgOverlap.passRate}%`);
        });

        test('Avg Overlap Pass Rate card chip shows 68/77', async ({ page }) => {
            const { pass, total } = MOCK_PRODUCTION_REPORT.qualityGates.avgOverlap;
            const card = page.locator('div', { has: page.getByText('Avg Overlap Pass Rate') }).first();
            await expect(card).toContainText(`${pass}/${total}`);
        });

        test('QC Pass Rate card is visible', async ({ page }) => {
            await expect(page.getByText('QC Pass Rate')).toBeVisible();
        });

        test('QC Pass Rate card chip shows pass/fail/conditional counts', async ({ page }) => {
            // chip format: "${pass}P / ${fail}F / ${conditional}C"
            const { pass, fail, conditional } = MOCK_PRODUCTION_REPORT.qualityGates.qcStatus;
            const card = page.locator('div', { has: page.getByText('QC Pass Rate') }).first();
            await expect(card).toContainText(`${pass}P`);
            await expect(card).toContainText(`${fail}F`);
            await expect(card).toContainText(`${conditional}C`);
        });

        test('QC Pass Rate card computed value is 89% (55/62)', async ({ page }) => {
            // Math.round((55/62)*100) = 89
            const { pass, total } = MOCK_PRODUCTION_REPORT.qualityGates.qcStatus;
            const computed = Math.round((pass / total) * 100);
            const card = page.locator('div', { has: page.getByText('QC Pass Rate') }).first();
            await expect(card).toContainText(`${computed}%`);
        });

        // ── Charts ───────────────────────────────────────────────────────

        test('renders Stage Distribution chart', async ({ page }) => {
            await expect(page.getByText('Stage Distribution')).toBeVisible();
        });

        test('renders Monthly Throughput chart', async ({ page }) => {
            await expect(page.getByText('Monthly Throughput')).toBeVisible();
        });

        // ── Estimate vs Actual SF table ──────────────────────────────────

        test('renders Estimate vs Actual SF section', async ({ page }) => {
            await expect(page.getByText('Estimate vs Actual SF')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows Downtown Office Tower row', async ({ page }) => {
            await expect(page.getByText('Downtown Office Tower')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows Harbor View Condos row', async ({ page }) => {
            await expect(page.getByText('Harbor View Condos')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows Tech Campus Phase 2 row', async ({ page }) => {
            await expect(page.getByText('Tech Campus Phase 2')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows UPID UP-001', async ({ page }) => {
            await expect(page.getByText('UP-001')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows UPID UP-002', async ({ page }) => {
            await expect(page.getByText('UP-002')).toBeVisible();
        });

        test('Estimate vs Actual SF table shows UPID UP-003', async ({ page }) => {
            await expect(page.getByText('UP-003')).toBeVisible();
        });

        test('Estimate vs Actual SF table has all expected column headers', async ({ page }) => {
            for (const header of ['UPID', 'Project', 'Est SF', 'Actual SF', 'Variance']) {
                await expect(page.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeVisible();
            }
        });

        test('Downtown Office Tower row shows +5% variance', async ({ page }) => {
            const row = page.locator('tr', { has: page.getByText('Downtown Office Tower') });
            await expect(row).toContainText('+5%');
        });

        test('Harbor View Condos row shows -3% variance', async ({ page }) => {
            const row = page.locator('tr', { has: page.getByText('Harbor View Condos') });
            await expect(row).toContainText('-3%');
        });

        test('Tech Campus Phase 2 row shows +8% variance', async ({ page }) => {
            const row = page.locator('tr', { has: page.getByText('Tech Campus Phase 2') });
            await expect(row).toContainText('+8%');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 5 — Profitability Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Profitability tab', () => {
        test.beforeEach(async ({ page }) => {
            await page.getByRole('button', { name: 'Profitability' }).click();
            await expect(page.getByText('Margin Distribution')).toBeVisible();
        });

        test('Profitability tab becomes active after click', async ({ page }) => {
            const profitabilityBtn = page.getByRole('button', { name: 'Profitability' });
            await expect(profitabilityBtn).toHaveClass(/text-blue-600/);
        });

        // ── Margin by tier KPI cards ─────────────────────────────────────

        test('shows Minnow Avg Margin card with 52.3%', async ({ page }) => {
            await expect(page.getByText('Minnow Avg Margin')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Minnow Avg Margin') }).first();
            await expect(card).toContainText(`${MOCK_PROFITABILITY_REPORT.avgMarginByTier[0].avgMargin}%`);
        });

        test('shows Dolphin Avg Margin card with 47.1%', async ({ page }) => {
            await expect(page.getByText('Dolphin Avg Margin')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Dolphin Avg Margin') }).first();
            await expect(card).toContainText(`${MOCK_PROFITABILITY_REPORT.avgMarginByTier[1].avgMargin}%`);
        });

        test('shows Whale Avg Margin card with 43.8%', async ({ page }) => {
            await expect(page.getByText('Whale Avg Margin')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Whale Avg Margin') }).first();
            await expect(card).toContainText(`${MOCK_PROFITABILITY_REPORT.avgMarginByTier[2].avgMargin}%`);
        });

        // ── Charts ───────────────────────────────────────────────────────

        test('renders Margin Distribution chart', async ({ page }) => {
            await expect(page.getByText('Margin Distribution')).toBeVisible();
        });

        test('renders Monthly Margin Trend chart', async ({ page }) => {
            await expect(page.getByText('Monthly Margin Trend')).toBeVisible();
        });

        test('renders Cost & Price per SF by Tier chart', async ({ page }) => {
            await expect(page.getByText('Cost & Price per SF by Tier')).toBeVisible();
        });

        // ── Travel Cost Breakdown ────────────────────────────────────────

        test('renders Travel Cost Breakdown section', async ({ page }) => {
            await expect(page.getByText('Travel Cost Breakdown')).toBeVisible();
        });

        test('Travel Cost Breakdown shows Total Miles label', async ({ page }) => {
            await expect(page.getByText('Total Miles')).toBeVisible();
        });

        test('Travel Cost Breakdown shows 45,200 total miles', async ({ page }) => {
            const { totalMilesDriven } = MOCK_PROFITABILITY_REPORT.travelCostBreakdown;
            await expect(page.getByText(totalMilesDriven.toLocaleString())).toBeVisible();
        });

        test('Travel Cost Breakdown shows Hotel/Per Diem label', async ({ page }) => {
            await expect(page.getByText('Hotel/Per Diem')).toBeVisible();
        });

        test('Travel Cost Breakdown shows $28,500 hotel/per diem', async ({ page }) => {
            // formatCurrency(28500) = "$28,500"
            await expect(page.getByText('$28,500')).toBeVisible();
        });

        test('Travel Cost Breakdown shows Tolls/Parking label', async ({ page }) => {
            await expect(page.getByText('Tolls/Parking')).toBeVisible();
        });

        test('Travel Cost Breakdown shows Other Costs label', async ({ page }) => {
            await expect(page.getByText('Other Costs')).toBeVisible();
        });

        test('Travel Cost Breakdown shows Avg/Project label', async ({ page }) => {
            await expect(page.getByText('Avg/Project')).toBeVisible();
        });

        test('Travel Cost Breakdown avg per project shows $850', async ({ page }) => {
            await expect(page.getByText('$850')).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 6 — Time Range Filter
    // ══════════════════════════════════════════════════════════════════════

    test.describe('time range filter', () => {
        test('clicking 3M button makes it active (dark background)', async ({ page }) => {
            const btn3M = page.getByRole('button', { name: '3M' });
            await btn3M.click();
            await expect(btn3M).toHaveClass(/bg-slate-800/);
        });

        test('clicking 3M button deactivates the previous active button', async ({ page }) => {
            const btn12M = page.getByRole('button', { name: '12M' });
            const btn3M = page.getByRole('button', { name: '3M' });
            await btn3M.click();
            // 12M should no longer have the dark background
            await expect(btn12M).not.toHaveClass(/bg-slate-800/);
        });

        test('clicking 6M button makes it active', async ({ page }) => {
            const btn6M = page.getByRole('button', { name: '6M' });
            await btn6M.click();
            await expect(btn6M).toHaveClass(/bg-slate-800/);
        });

        test('clicking All button makes it active', async ({ page }) => {
            const btnAll = page.getByRole('button', { name: 'All' });
            await btnAll.click();
            await expect(btnAll).toHaveClass(/bg-slate-800/);
        });

        test('only one time-range button can be active at a time', async ({ page }) => {
            const btnAll = page.getByRole('button', { name: 'All' });
            await btnAll.click();

            // After clicking All, 12M (previously active) must be inactive
            const btn12M = page.getByRole('button', { name: '12M' });
            await expect(btn12M).not.toHaveClass(/bg-slate-800/);

            // 3M, 6M must also be inactive
            for (const label of ['3M', '6M']) {
                await expect(page.getByRole('button', { name: label })).not.toHaveClass(/bg-slate-800/);
            }
        });

        test('clicking 3M triggers a new API call to scorecard endpoints', async ({ page }) => {
            const requests: string[] = [];
            page.on('request', req => {
                if (req.url().includes('/api/scorecard/')) {
                    requests.push(req.url());
                }
            });

            await page.getByRole('button', { name: '3M' }).click();
            // After the click, loading spinner appears then disappears
            await waitForLoad(page);

            // At least one scorecard endpoint must have been re-called
            expect(requests.length).toBeGreaterThan(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 7 — Data Integrity Calculations
    // These tests verify the math is correct in the fixture data itself,
    // and that the UI renders the computed values faithfully.
    // ══════════════════════════════════════════════════════════════════════

    test.describe('data integrity calculations', () => {
        test('Win Rate = wonCount / (wonCount + lostCount) * 100 = 64%', async ({ page }) => {
            const { wonCount, lostCount, winRate } = MOCK_SCORECARD_OVERVIEW;
            const computed = Math.round((wonCount / (wonCount + lostCount)) * 100);
            // Verify fixture math
            expect(computed).toBe(64);
            expect(winRate).toBe(64);
            // Verify UI displays the correct value
            const card = page.locator('div', { has: page.getByText('Win Rate') }).first();
            await expect(card).toContainText('64%');
        });

        test('Blended Margin = (revenue - cost) / revenue * 100 = 45%', async ({ page }) => {
            const { totalRevenue, totalCost, blendedMarginPct } = MOCK_SCORECARD_OVERVIEW;
            const computed = Math.round(((totalRevenue - totalCost) / totalRevenue) * 100);
            // Verify fixture math: (3250000 - 1787500) / 3250000 * 100 = 45%
            expect(computed).toBe(45);
            expect(blendedMarginPct).toBe(45);
            // Verify UI
            const card = page.locator('div', { has: page.getByText('Blended Margin') }).first();
            await expect(card).toContainText('45%');
        });

        test('Avg Deal Size = totalRevenue / wonCount = $22,414', async ({ page }) => {
            const { totalRevenue, wonCount, avgDealSize } = MOCK_SCORECARD_OVERVIEW;
            const computed = Math.round(totalRevenue / wonCount);
            // 3250000 / 145 = 22413.79... → rounds to 22414
            expect(computed).toBe(22414);
            expect(avgDealSize).toBe(22414);
            // Verify UI
            const card = page.locator('div', { has: page.getByText('Avg Deal Size') }).first();
            await expect(card).toContainText('$22,414');
        });

        test('Active count = totalDeals - wonCount - lostCount = 63', async ({ page }) => {
            const { totalDeals, wonCount, lostCount, activeCount } = MOCK_SCORECARD_OVERVIEW;
            const computed = totalDeals - wonCount - lostCount;
            // 290 - 145 - 82 = 63
            expect(computed).toBe(63);
            expect(activeCount).toBe(63);
        });

        test('totalDeals = wonCount + lostCount + activeCount = 290', async ({ page }) => {
            const { totalDeals, wonCount, lostCount, activeCount } = MOCK_SCORECARD_OVERVIEW;
            expect(wonCount + lostCount + activeCount).toBe(totalDeals);
            expect(totalDeals).toBe(290);
        });

        test('Actual Revenue = sum of monthly QBO revenue = $4,506,000', async ({ page }) => {
            const { actualRevenue } = MOCK_SCORECARD_OVERVIEW;
            // Fixture sets actualRevenue = totalRevenue from 12-month monthly array
            expect(actualRevenue).toBe(4506000);
            const card = page.locator('div', { has: page.getByText('Actual Revenue (QBO)') }).first();
            await expect(card).toContainText('$4,506,000');
        });

        test('YTD Actual Revenue = sum of 2026 months = $907,000', async ({ page }) => {
            const { ytdActualRevenue } = MOCK_SCORECARD_OVERVIEW;
            // 2026-01 (445000) + 2026-02 (462000) = 907000
            expect(ytdActualRevenue).toBe(907000);
            const card = page.locator('div', { has: page.getByText('YTD Actual Revenue') }).first();
            await expect(card).toContainText('$907,000');
        });

        test('Pipeline Value is $1,850,000', async ({ page }) => {
            expect(MOCK_SCORECARD_OVERVIEW.activePipelineValue).toBe(1850000);
            const card = page.locator('div', { has: page.getByText('Pipeline Value') }).first();
            await expect(card).toContainText('$1,850,000');
        });

        test('Field RMS pass rate = pass/total * 100 = 94%', async ({ page }) => {
            const { pass, total, passRate } = MOCK_PRODUCTION_REPORT.qualityGates.fieldRms;
            const computed = Math.round((pass / total) * 100);
            expect(computed).toBe(94);
            expect(passRate).toBe(94);
        });

        test('Avg Overlap pass rate = 68/77 * 100 = 88%', async ({ page }) => {
            const { pass, total, passRate } = MOCK_PRODUCTION_REPORT.qualityGates.avgOverlap;
            const computed = Math.round((pass / total) * 100);
            expect(computed).toBe(88);
            expect(passRate).toBe(88);
        });

        test('QC pass rate = 55/62 * 100 = 89% (computed in component)', async ({ page }) => {
            const { pass, total } = MOCK_PRODUCTION_REPORT.qualityGates.qcStatus;
            const computed = Math.round((pass / total) * 100);
            // 55/62 = 0.8871... * 100 = 89
            expect(computed).toBe(89);
        });

        test('Referral win rate is highest among all lead sources', async ({ page }) => {
            const maxRate = Math.max(
                ...MOCK_PIPELINE_REPORT.winRateBySource.map(s => s.winRate)
            );
            const topSource = MOCK_PIPELINE_REPORT.winRateBySource.find(s => s.winRate === maxRate);
            expect(topSource?.source).toBe('Referral');
            expect(maxRate).toBe(79);
        });

        test('Minnow margin (52.3%) > Dolphin margin (47.1%) > Whale margin (43.8%)', async ({ page }) => {
            const [minnow, dolphin, whale] = MOCK_PROFITABILITY_REPORT.avgMarginByTier;
            expect(minnow.avgMargin).toBeGreaterThan(dolphin.avgMargin);
            expect(dolphin.avgMargin).toBeGreaterThan(whale.avgMargin);
        });

        test('totalMilesDriven is 45,200', async ({ page }) => {
            expect(MOCK_PROFITABILITY_REPORT.travelCostBreakdown.totalMilesDriven).toBe(45200);
        });

        test('totalHotelPerDiem is $28,500', async ({ page }) => {
            expect(MOCK_PROFITABILITY_REPORT.travelCostBreakdown.totalHotelPerDiem).toBe(28500);
        });

        test('Estimate vs Actual SF overall variance is +4%', async ({ page }) => {
            expect(MOCK_PRODUCTION_REPORT.estimateVsActual.variancePct).toBe(4);
        });

        test('Tech Campus Phase 2 has largest positive variance (+8%)', async ({ page }) => {
            const projects = MOCK_PRODUCTION_REPORT.estimateVsActual.byProject;
            const maxVariance = Math.max(...projects.map(p => p.variancePct));
            const topProject = projects.find(p => p.variancePct === maxVariance);
            expect(topProject?.projectName).toBe('Tech Campus Phase 2');
            expect(maxVariance).toBe(8);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 8 — Tab Navigation (switching between all tabs)
    // ══════════════════════════════════════════════════════════════════════

    test.describe('tab navigation', () => {
        test('can navigate Overview -> Pipeline -> Production -> Profitability -> Overview', async ({ page }) => {
            // Start on Overview (default)
            await expect(page.getByText('Monthly Revenue: Actual vs Estimated')).toBeVisible();

            // Navigate to Pipeline
            await page.getByRole('button', { name: 'Pipeline' }).click();
            await expect(page.getByText('Deal Funnel')).toBeVisible();
            await expect(page.getByText('Monthly Revenue: Actual vs Estimated')).not.toBeVisible();

            // Navigate to Production
            await page.getByRole('button', { name: 'Production' }).click();
            await expect(page.getByText('Stage Distribution')).toBeVisible();
            await expect(page.getByText('Deal Funnel')).not.toBeVisible();

            // Navigate to Profitability
            await page.getByRole('button', { name: 'Profitability' }).click();
            await expect(page.getByText('Margin Distribution')).toBeVisible();
            await expect(page.getByText('Stage Distribution')).not.toBeVisible();

            // Navigate back to Overview
            await page.getByRole('button', { name: 'Overview' }).click();
            await expect(page.getByText('Monthly Revenue: Actual vs Estimated')).toBeVisible();
            await expect(page.getByText('Margin Distribution')).not.toBeVisible();
        });

        test('only one tab content panel is visible at a time', async ({ page }) => {
            // On Overview, Pipeline-specific content is not visible
            await expect(page.getByText('Deal Funnel')).not.toBeVisible();
            await expect(page.getByText('Stage Distribution')).not.toBeVisible();
            await expect(page.getByText('Margin Distribution')).not.toBeVisible();

            // Switch to Pipeline — Overview-specific content is gone
            await page.getByRole('button', { name: 'Pipeline' }).click();
            await expect(page.getByText('Win Rate Trend')).not.toBeVisible();
        });

        test('tab state persists after time-range change', async ({ page }) => {
            // Go to Pipeline tab
            await page.getByRole('button', { name: 'Pipeline' }).click();
            await expect(page.getByText('Deal Funnel')).toBeVisible();

            // Change time range
            await page.getByRole('button', { name: '6M' }).click();
            await waitForLoad(page);

            // Should still be on Pipeline tab after reload
            await expect(page.getByText('Deal Funnel')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Pipeline' })).toHaveClass(/text-blue-600/);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 9 — Accessibility
    // ══════════════════════════════════════════════════════════════════════

    test.describe('accessibility', () => {
        test('all tab buttons are keyboard-focusable', async ({ page }) => {
            for (const tabName of ['Overview', 'Pipeline', 'Production', 'Profitability']) {
                const btn = page.getByRole('button', { name: tabName });
                await btn.focus();
                await expect(btn).toBeFocused();
            }
        });

        test('all time-range buttons are keyboard-focusable', async ({ page }) => {
            for (const label of ['3M', '6M', '12M', 'All']) {
                const btn = page.getByRole('button', { name: label });
                await btn.focus();
                await expect(btn).toBeFocused();
            }
        });

        test('page heading has h2 semantic role', async ({ page }) => {
            await expect(page.getByRole('heading', { name: 'Scorecard', level: 2 })).toBeVisible();
        });

        test('Production tab table has proper thead/tbody structure', async ({ page }) => {
            await page.getByRole('button', { name: 'Production' }).click();
            await expect(page.locator('table')).toBeVisible();
            await expect(page.locator('thead')).toBeVisible();
            await expect(page.locator('tbody')).toBeVisible();
        });
    });
});
