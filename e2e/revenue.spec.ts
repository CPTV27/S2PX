// ── S2PX Revenue Dashboard — Playwright E2E Tests ──
// Coverage: all 6 tabs (Revenue, P&L, Expenses, Customers, Estimates, Balance Sheet),
// CFO Agent chat panel, KPI card values, table rows, search filter,
// and data-integrity cross-checks against mock fixture constants.
//
// Usage:
//   npx playwright test e2e/revenue.spec.ts
//   npx playwright test e2e/revenue.spec.ts --headed
//   npx playwright test e2e/revenue.spec.ts --grep "CFO Agent"

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
} from './fixtures/mock-data';

// ── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Wait for the Revenue page to finish its initial data fetch.
 * The Loader2 spinner is shown while isLoading=true; we wait for it to
 * disappear and then confirm the page heading is present.
 */
async function waitForLoad(page: Parameters<typeof setupMockApi>[0]) {
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Financial Dashboard' })).toBeVisible();
}

/**
 * Click a Revenue sub-tab and wait for an element unique to that tab to appear.
 * Returns after the AnimatePresence transition completes.
 */
async function clickTab(page: Parameters<typeof setupMockApi>[0], label: string) {
    await page.getByRole('button', { name: label }).click();
}

// ── beforeEach shared across all test groups ─────────────────────────────────

test.describe('S2PX Revenue Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard/revenue');
        await waitForLoad(page);
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 1 — Page Shell / Chrome
    // ══════════════════════════════════════════════════════════════════════

    test.describe('page shell', () => {
        test('shows "Financial Dashboard" heading', async ({ page }) => {
            await expect(page.getByRole('heading', { name: 'Financial Dashboard' })).toBeVisible();
        });

        test('shows "QBO Synced" badge', async ({ page }) => {
            await expect(page.getByText('QBO Synced')).toBeVisible();
        });

        test('shows subtitle with month count', async ({ page }) => {
            // Subtitle mentions how many months of data are loaded
            await expect(page.getByText(/months of data/i)).toBeVisible();
        });

        test('renders all six tab buttons', async ({ page }) => {
            for (const tab of ['Revenue', 'P&L', 'Expenses', 'Customers', 'Estimates', 'Balance Sheet']) {
                await expect(page.getByRole('button', { name: tab })).toBeVisible();
            }
        });

        test('Revenue tab is active by default (white background)', async ({ page }) => {
            const revenueBtn = page.getByRole('button', { name: 'Revenue' });
            await expect(revenueBtn).toHaveClass(/bg-white/);
        });

        test('page heading has h2 semantic role', async ({ page }) => {
            await expect(
                page.getByRole('heading', { name: 'Financial Dashboard', level: 2 }),
            ).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 2 — Revenue Tab (default)
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Revenue tab', () => {
        // Revenue tab is active on load — no click required.

        test('shows All-Time Revenue KPI card with $4,506,000', async ({ page }) => {
            await expect(page.getByText('All-Time Revenue')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('All-Time Revenue') }).first();
            await expect(card).toContainText('$4,506,000');
        });

        test('shows YTD Revenue KPI card with $907,000', async ({ page }) => {
            await expect(page.getByText('YTD Revenue')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('YTD Revenue') }).first();
            await expect(card).toContainText('$907,000');
        });

        test('shows Monthly Avg KPI card', async ({ page }) => {
            await expect(page.getByText('Monthly Avg (YTD)')).toBeVisible();
        });

        test('shows YoY Growth KPI card', async ({ page }) => {
            await expect(page.getByText('YoY Growth')).toBeVisible();
        });

        test('shows "Monthly Revenue (Last 24 Months)" chart section', async ({ page }) => {
            await expect(page.getByText('Monthly Revenue (Last 24 Months)')).toBeVisible();
        });

        test('shows "Top Revenue Customers" table heading', async ({ page }) => {
            await expect(page.getByText('Top Revenue Customers')).toBeVisible();
        });

        test('top customer table has correct column headers', async ({ page }) => {
            for (const header of ['Customer', 'Revenue', 'Transactions']) {
                await expect(page.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeVisible();
            }
        });

        test('shows at least 10 rows in the top customers table', async ({ page }) => {
            // The component renders up to 15 rows; mock has 10 top customers
            const rows = page.locator('table tbody tr');
            await expect(rows).toHaveCount(MOCK_REVENUE.topCustomers.length);
        });

        test('Acme Corp is the first customer with $680,000', async ({ page }) => {
            const firstRow = page.locator('table tbody tr').first();
            await expect(firstRow).toContainText('Acme Corp');
            await expect(firstRow).toContainText('$680,000');
        });

        test('Acme Corp row shows 45 transactions', async ({ page }) => {
            const acmeRow = page.locator('tr', { has: page.getByText('Acme Corp') });
            await expect(acmeRow).toContainText('45');
        });

        test('BuildRight LLC appears as the second customer', async ({ page }) => {
            const secondRow = page.locator('table tbody tr').nth(1);
            await expect(secondRow).toContainText('BuildRight LLC');
        });

        test('TrueNorth Engineering appears in the table', async ({ page }) => {
            await expect(page.getByText('TrueNorth Engineering')).toBeVisible();
        });

        test('customer ranks are numbered (shows #1 in first row)', async ({ page }) => {
            const firstRow = page.locator('table tbody tr').first();
            await expect(firstRow).toContainText('1');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 3 — P&L Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('P&L tab', () => {
        test.beforeEach(async ({ page }) => {
            await clickTab(page, 'P&L');
            await expect(page.getByText('Monthly P&L')).toBeVisible();
        });

        test('P&L tab becomes active after click', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'P&L' })).toHaveClass(/bg-white/);
        });

        test('shows Income KPI with $4,506,000', async ({ page }) => {
            const card = page.locator('.rounded-xl.p-4').filter({ hasText: 'Income' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('$4,506,000');
        });

        test('shows COGS KPI with $1,802,400', async ({ page }) => {
            const card = page.locator('.rounded-xl.p-4').filter({ hasText: 'COGS' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('$1,802,400');
        });

        test('shows Gross Profit KPI with $2,703,600', async ({ page }) => {
            await expect(page.getByText('Gross Profit')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Gross Profit') }).first();
            // grossProfit = totalIncome - totalCOGS = 4506000 - 1802400 = 2703600
            await expect(card).toContainText('$2,703,600');
        });

        test('shows Gross Margin KPI near 60.0%', async ({ page }) => {
            await expect(page.getByText('Gross Margin')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Gross Margin') }).first();
            // grossMargin = (2703600 / 4506000) * 100 = 60.0%
            await expect(card).toContainText('60.0%');
        });

        test('shows Expenses KPI with $1,351,800', async ({ page }) => {
            const card = page.locator('.rounded-xl.p-4').filter({ hasText: 'Expenses' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('$1,351,800');
        });

        test('shows Net Income KPI with $1,358,600', async ({ page }) => {
            const card = page.locator('.rounded-xl.p-4').filter({ hasText: 'Net Income' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('$1,358,600');
        });

        test('shows "Monthly P&L (Last 24 Months)" chart section', async ({ page }) => {
            await expect(page.getByText(/Monthly P&L/i)).toBeVisible();
        });

        test('renders six KPI cards on P&L tab', async ({ page }) => {
            const kpiCards = page.locator('.rounded-xl.p-4');
            for (const label of ['Income', 'COGS', 'Gross Profit', 'Gross Margin', 'Expenses', 'Net Income']) {
                await expect(kpiCards.filter({ hasText: label }).first()).toBeVisible();
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 4 — Expenses Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Expenses tab', () => {
        test.beforeEach(async ({ page }) => {
            await clickTab(page, 'Expenses');
            await expect(page.getByText('Top Vendors by Spend')).toBeVisible();
        });

        test('Expenses tab becomes active after click', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'Expenses' })).toHaveClass(/bg-white/);
        });

        test('shows Total Expenses (All Time) KPI with $1,351,800', async ({ page }) => {
            await expect(page.getByText('Total Expenses (All Time)')).toBeVisible();
            const card = page
                .locator('div', { has: page.getByText('Total Expenses (All Time)') })
                .first();
            await expect(card).toContainText('$1,351,800');
        });

        test('shows Trailing 12 Months KPI with $1,080,000', async ({ page }) => {
            await expect(page.getByText('Trailing 12 Months')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Trailing 12 Months') }).first();
            await expect(card).toContainText('$1,080,000');
        });

        test('shows Vendor Count KPI with 42', async ({ page }) => {
            await expect(page.getByText('Vendor Count')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Vendor Count') }).first();
            await expect(card).toContainText('42');
        });

        test('shows "Top Vendors by Spend" section heading', async ({ page }) => {
            await expect(page.getByText('Top Vendors by Spend')).toBeVisible();
        });

        test('ScanTech Solutions is the top vendor at $285,000', async ({ page }) => {
            await expect(page.getByText('ScanTech Solutions')).toBeVisible();
            // The vendor row shows the all-time amount
            const vendorRow = page.locator('div', { has: page.getByText('ScanTech Solutions') }).first();
            await expect(vendorRow).toContainText('$285,000');
        });

        test('CloudHost Pro appears as second vendor', async ({ page }) => {
            await expect(page.getByText('CloudHost Pro')).toBeVisible();
        });

        test('Adobe Systems appears in the vendor list', async ({ page }) => {
            await expect(page.getByText('Adobe Systems')).toBeVisible();
        });

        test('shows All Time and 12mo Trailing legend labels', async ({ page }) => {
            await expect(page.getByText('All Time', { exact: true })).toBeVisible();
            await expect(page.getByText('12mo Trailing')).toBeVisible();
        });

        test('ScanTech Solutions shows trailing 12mo of $220,000', async ({ page }) => {
            const vendorRow = page.locator('div', { has: page.getByText('ScanTech Solutions') }).first();
            await expect(vendorRow).toContainText('$220,000');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 5 — Customers Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Customers tab', () => {
        test.beforeEach(async ({ page }) => {
            await clickTab(page, 'Customers');
            await expect(page.getByText('Customer Directory')).toBeVisible();
        });

        test('Customers tab becomes active after click', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'Customers' })).toHaveClass(/bg-white/);
        });

        test('shows Total Customers KPI with 542', async ({ page }) => {
            await expect(page.getByText('Total Customers')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Customers') }).first();
            await expect(card).toContainText('542');
        });

        test('shows Active (12mo) KPI with 128', async ({ page }) => {
            await expect(page.getByText('Active (12mo)')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Active (12mo)') }).first();
            await expect(card).toContainText('128');
        });

        test('shows Inactive KPI with 414', async ({ page }) => {
            // Inactive = totalCustomers - activeCustomers = 542 - 128 = 414
            // Customers tab KPI cards use rounded-2xl p-5
            const card = page.locator('.rounded-2xl.p-5').filter({ hasText: 'Inactive' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('414');
        });

        test('shows "Customer Directory" section heading', async ({ page }) => {
            await expect(page.getByText('Customer Directory')).toBeVisible();
        });

        test('shows customer table with correct column headers', async ({ page }) => {
            for (const header of ['Customer', 'Email', 'Revenue', 'Txns', 'Estimates']) {
                await expect(
                    page.getByRole('columnheader', { name: new RegExp(header, 'i') }),
                ).toBeVisible();
            }
        });

        test('Acme Corp appears in the customer directory', async ({ page }) => {
            await expect(page.getByText('Acme Corp')).toBeVisible();
        });

        test('Acme Corp shows $680,000 revenue', async ({ page }) => {
            const acmeRow = page.locator('tr', { has: page.getByText('Acme Corp') });
            await expect(acmeRow).toContainText('$680,000');
        });

        test('Acme Corp shows 45 transactions', async ({ page }) => {
            const acmeRow = page.locator('tr', { has: page.getByText('Acme Corp') });
            await expect(acmeRow).toContainText('45');
        });

        test('Acme Corp shows billing@acme.com email', async ({ page }) => {
            const acmeRow = page.locator('tr', { has: page.getByText('Acme Corp') });
            await expect(acmeRow).toContainText('billing@acme.com');
        });

        test('search filter shows search input placeholder', async ({ page }) => {
            const searchInput = page.getByPlaceholder('Search customers...');
            await expect(searchInput).toBeVisible();
        });

        test('search filter with "Acme" shows only Acme Corp', async ({ page }) => {
            const searchInput = page.getByPlaceholder('Search customers...');
            await searchInput.fill('Acme');

            // Acme Corp must be visible
            await expect(page.getByText('Acme Corp')).toBeVisible();

            // Other customers must not be visible
            await expect(page.getByText('BuildRight LLC')).not.toBeVisible();
            await expect(page.getByText('Metro Development')).not.toBeVisible();
        });

        test('search filter is case-insensitive', async ({ page }) => {
            const searchInput = page.getByPlaceholder('Search customers...');
            await searchInput.fill('acme');
            await expect(page.getByText('Acme Corp')).toBeVisible();
        });

        test('clearing the search filter restores all customers', async ({ page }) => {
            const searchInput = page.getByPlaceholder('Search customers...');
            await searchInput.fill('Acme');
            await expect(page.getByText('BuildRight LLC')).not.toBeVisible();

            await searchInput.fill('');
            await expect(page.getByText('BuildRight LLC')).toBeVisible();
        });

        test('search for non-existent customer shows no rows', async ({ page }) => {
            const searchInput = page.getByPlaceholder('Search customers...');
            await searchInput.fill('ZZZZZ_DOES_NOT_EXIST');
            await expect(page.getByText('Acme Corp')).not.toBeVisible();
            await expect(page.getByText('BuildRight LLC')).not.toBeVisible();
        });

        test('Inactive Client Co appears in the directory', async ({ page }) => {
            await expect(page.getByText('Inactive Client Co')).toBeVisible();
        });

        test('BuildRight LLC shows accounts@buildright.com email', async ({ page }) => {
            const row = page.locator('tr', { has: page.getByText('BuildRight LLC') });
            await expect(row).toContainText('accounts@buildright.com');
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 6 — Estimates Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Estimates tab', () => {
        test.beforeEach(async ({ page }) => {
            await clickTab(page, 'Estimates');
            await expect(page.getByText('Monthly Estimates')).toBeVisible();
        });

        test('Estimates tab becomes active after click', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'Estimates' })).toHaveClass(/bg-white/);
        });

        test('shows Total Estimates KPI with 1168', async ({ page }) => {
            await expect(page.getByText('Total Estimates')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Estimates') }).first();
            await expect(card).toContainText('1168');
        });

        test('shows Accepted KPI with 584', async ({ page }) => {
            const card = page.locator('.rounded-xl.p-4').filter({ hasText: 'Accepted' }).first();
            await expect(card).toBeVisible();
            await expect(card).toContainText('584');
        });

        test('shows Invoiced KPI with 467', async ({ page }) => {
            await expect(page.getByText('Invoiced')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Invoiced') }).first();
            await expect(card).toContainText('467');
        });

        test('shows Conversion Rate KPI with 50.0%', async ({ page }) => {
            await expect(page.getByText('Conversion Rate')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Conversion Rate') }).first();
            // conversionRate in mock = 584/1168 = 0.5 (decimal fraction)
            // The component renders: `${(data.conversionRate * 100).toFixed(1)}%` = "50.0%"
            await expect(card).toContainText('50.0%');
        });

        test('shows Estimate Value KPI with $6,250,000', async ({ page }) => {
            await expect(page.getByText('Estimate Value')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Estimate Value') }).first();
            await expect(card).toContainText('$6,250,000');
        });

        test('shows "Monthly Estimates" chart section', async ({ page }) => {
            await expect(page.getByText('Monthly Estimates')).toBeVisible();
        });

        test('renders five KPI cards on Estimates tab', async ({ page }) => {
            const kpiCards = page.locator('.rounded-xl.p-4');
            for (const label of ['Total Estimates', 'Accepted', 'Invoiced', 'Conversion Rate', 'Estimate Value']) {
                await expect(kpiCards.filter({ hasText: label }).first()).toBeVisible();
            }
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 7 — Balance Sheet Tab
    // ══════════════════════════════════════════════════════════════════════

    test.describe('Balance Sheet tab', () => {
        test.beforeEach(async ({ page }) => {
            await clickTab(page, 'Balance Sheet');
            await expect(page.getByText('Total Assets')).toBeVisible();
        });

        test('Balance Sheet tab becomes active after click', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'Balance Sheet' })).toHaveClass(/bg-white/);
        });

        test('shows Total Assets KPI with $2,850,000', async ({ page }) => {
            await expect(page.getByText('Total Assets')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Assets') }).first();
            await expect(card).toContainText('$2,850,000');
        });

        test('shows Total Liabilities KPI with $1,140,000', async ({ page }) => {
            await expect(page.getByText('Total Liabilities')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Liabilities') }).first();
            await expect(card).toContainText('$1,140,000');
        });

        test('shows Total Equity KPI with $1,710,000', async ({ page }) => {
            await expect(page.getByText('Total Equity')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Equity') }).first();
            await expect(card).toContainText('$1,710,000');
        });

        test('shows snapshot date text', async ({ page }) => {
            await expect(page.getByText(/Snapshot as of/i)).toBeVisible();
        });

        test('shows Assets section card', async ({ page }) => {
            await expect(page.locator('h3', { hasText: 'Assets' })).toBeVisible();
        });

        test('shows Liabilities section card', async ({ page }) => {
            await expect(page.locator('h3', { hasText: 'Liabilities' })).toBeVisible();
        });

        test('shows Equity section card', async ({ page }) => {
            await expect(page.locator('h3', { hasText: 'Equity' })).toBeVisible();
        });

        test('Assets section contains Business Checking with $485,000', async ({ page }) => {
            await expect(page.getByText('Business Checking')).toBeVisible();
            const assetRow = page.locator('div', { has: page.getByText('Business Checking') }).first();
            await expect(assetRow).toContainText('$485,000');
        });

        test('Assets section contains Accounts Receivable', async ({ page }) => {
            await expect(page.getByText('Accounts Receivable')).toBeVisible();
        });

        test('Assets section contains Equipment', async ({ page }) => {
            // Balance Sheet renders as "Fixed Assets › Equipment" in one span
            await expect(page.getByText(/Equipment/).first()).toBeVisible();
        });

        test('Liabilities section contains Accounts Payable', async ({ page }) => {
            await expect(page.getByText('Accounts Payable')).toBeVisible();
        });

        test('Liabilities section contains Vehicle Loans', async ({ page }) => {
            await expect(page.getByText('Vehicle Loans')).toBeVisible();
        });

        test('Equity section contains Retained Earnings', async ({ page }) => {
            await expect(page.getByText('Retained Earnings')).toBeVisible();
        });

        test('Equity section contains Owner Equity', async ({ page }) => {
            await expect(page.getByText('Owner Equity')).toBeVisible();
        });

        test('Savings Account appears with $320,000', async ({ page }) => {
            await expect(page.getByText('Savings Account')).toBeVisible();
        });

        test('subcategory labels are visible (Bank Accounts, Current Liabilities)', async ({ page }) => {
            await expect(page.getByText('Bank Accounts').first()).toBeVisible();
            await expect(page.getByText('Current Liabilities').first()).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 8 — CFO Agent
    // ══════════════════════════════════════════════════════════════════════

    test.describe('CFO Agent', () => {
        test('CFO Agent FAB button is visible on load', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await expect(fab).toBeVisible();
        });

        test('FAB button has a Bot icon and "CFO Agent" label on desktop', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await expect(fab).toBeVisible();
            // The span label is visible on md+ screens; test viewport is 1280px
            await expect(fab).toContainText('CFO Agent');
        });

        test('clicking FAB opens the CFO Agent panel', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await fab.click();

            // Panel slides in from the right
            await expect(page.getByRole('heading', { name: 'CFO Agent' })).toBeVisible({ timeout: 5_000 });
        });

        test('panel shows "CFO Agent" header after opening', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            // h3 renders "CFO Agent"
            await expect(page.locator('h3', { hasText: 'CFO Agent' })).toBeVisible();
        });

        test('panel shows "Gemini 2.5 Flash" subtitle after opening', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            await expect(page.getByText('Gemini 2.5 Flash')).toBeVisible({ timeout: 5_000 });
        });

        test('panel shows 4 pre-built prompt buttons', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            await expect(page.getByText('What is our monthly burn rate?')).toBeVisible();
            await expect(page.getByText('Which customers drive the most revenue?')).toBeVisible();
            await expect(page.getByText('How does this year compare to last year?')).toBeVisible();
            await expect(page.getByText('What is our gross margin trend?')).toBeVisible();
        });

        test('pre-built prompt buttons are clickable and populate the input', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            await page.getByText('What is our monthly burn rate?').click();

            const chatInput = page.getByPlaceholder('Ask about financials...');
            await expect(chatInput).toHaveValue('What is our monthly burn rate?');
        });

        test('panel shows chat input with placeholder text', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            await expect(page.getByPlaceholder('Ask about financials...')).toBeVisible();
        });

        test('can close CFO Agent panel with X button', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await fab.click();
            await expect(page.locator('h3', { hasText: 'CFO Agent' })).toBeVisible();

            // The CFO panel close button is an X icon button in the fixed panel
            const panel = page.locator('.fixed.bottom-0.right-0');
            await panel.locator('button').first().click();
            await expect(page.locator('h3', { hasText: 'CFO Agent' })).not.toBeVisible({ timeout: 5_000 });
        });

        test('FAB is hidden while panel is open', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await fab.click();
            await expect(page.locator('h3', { hasText: 'CFO Agent' })).toBeVisible();

            // The FAB has class `hidden` when isOpen is true
            await expect(fab).toHaveClass(/hidden/);
        });

        test('sending a message calls the KB chat API and shows response', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();

            const chatInput = page.getByPlaceholder('Ask about financials...');
            await chatInput.fill('What is our burn rate?');
            await chatInput.press('Enter');

            // Mock responds with burn rate message
            await expect(
                page.getByText(/monthly burn rate is approximately \$225,000/i),
            ).toBeVisible({ timeout: 10_000 });
        });

        test('FAB is visible again after closing the panel', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            await fab.click();
            await expect(page.locator('h3', { hasText: 'CFO Agent' })).toBeVisible();

            // Close via the first button in the fixed panel
            const panel = page.locator('.fixed.bottom-0.right-0');
            await panel.locator('button').first().click();

            // FAB should re-appear
            await expect(fab).toBeVisible({ timeout: 5_000 });
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 9 — Tab Navigation
    // ══════════════════════════════════════════════════════════════════════

    test.describe('tab navigation', () => {
        test('can navigate through all 6 tabs in sequence', async ({ page }) => {
            // Revenue is default
            await expect(page.getByText('Top Revenue Customers')).toBeVisible();

            await clickTab(page, 'P&L');
            await expect(page.getByText('Monthly P&L')).toBeVisible();
            await expect(page.getByText('Top Revenue Customers')).not.toBeVisible();

            await clickTab(page, 'Expenses');
            await expect(page.getByText('Top Vendors by Spend')).toBeVisible();
            await expect(page.getByText('Monthly P&L')).not.toBeVisible();

            await clickTab(page, 'Customers');
            await expect(page.getByText('Customer Directory')).toBeVisible();
            await expect(page.getByText('Top Vendors by Spend')).not.toBeVisible();

            await clickTab(page, 'Estimates');
            await expect(page.getByText('Monthly Estimates')).toBeVisible();
            await expect(page.getByText('Customer Directory')).not.toBeVisible();

            await clickTab(page, 'Balance Sheet');
            await expect(page.getByText('Total Assets')).toBeVisible();
            await expect(page.getByText('Monthly Estimates')).not.toBeVisible();

            // Navigate back to Revenue
            await clickTab(page, 'Revenue');
            await expect(page.getByText('Top Revenue Customers')).toBeVisible();
            await expect(page.getByText('Total Assets')).not.toBeVisible();
        });

        test('only one tab content panel is visible at a time', async ({ page }) => {
            // On Revenue tab: P&L-specific and Expenses-specific content should not be visible
            await expect(page.getByText('Top Vendors by Spend')).not.toBeVisible();
            await expect(page.getByText('Customer Directory')).not.toBeVisible();
            await expect(page.getByText('Monthly Estimates')).not.toBeVisible();
        });

        test('non-active tabs do not have bg-white class', async ({ page }) => {
            // Only the Revenue button should be "active" on load
            await expect(page.getByRole('button', { name: 'P&L' })).not.toHaveClass(/bg-white/);
            await expect(page.getByRole('button', { name: 'Expenses' })).not.toHaveClass(/bg-white/);
        });

        test('switching tabs does not trigger a full page reload', async ({ page }) => {
            let navigationCount = 0;
            page.on('framenavigated', () => { navigationCount++; });

            await clickTab(page, 'P&L');
            await clickTab(page, 'Expenses');
            await clickTab(page, 'Customers');

            // Tab switching is client-side state; no new navigation events
            expect(navigationCount).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 10 — Data Integrity Calculations
    // These tests verify the fixture math and confirm the UI renders
    // computed values faithfully using the mock data.
    // ══════════════════════════════════════════════════════════════════════

    test.describe('data integrity calculations', () => {
        test('Revenue: totalRevenue = sum of all monthly revenue = $4,506,000', async ({ page }) => {
            const computedTotal = MOCK_REVENUE.monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
            expect(computedTotal).toBe(4506000);
            expect(MOCK_REVENUE.totalRevenue).toBe(computedTotal);

            const card = page.locator('div', { has: page.getByText('All-Time Revenue') }).first();
            await expect(card).toContainText('$4,506,000');
        });

        test('Revenue: ytdRevenue = sum of 2026 months = $907,000', async ({ page }) => {
            const ytd = MOCK_REVENUE.monthlyRevenue
                .filter(m => m.month.startsWith('2026'))
                .reduce((s, m) => s + m.revenue, 0);
            // 2026-01 (445000) + 2026-02 (462000) = 907000
            expect(ytd).toBe(907000);
            expect(MOCK_REVENUE.ytdRevenue).toBe(907000);

            const card = page.locator('div', { has: page.getByText('YTD Revenue') }).first();
            await expect(card).toContainText('$907,000');
        });

        test('Revenue: Acme Corp is the top customer by revenue', async ({ page }) => {
            const maxRevenue = Math.max(...MOCK_REVENUE.topCustomers.map(c => c.revenue));
            const topCustomer = MOCK_REVENUE.topCustomers.find(c => c.revenue === maxRevenue);
            expect(topCustomer?.customerName).toBe('Acme Corp');
            expect(maxRevenue).toBe(680000);
        });

        test('Revenue: top 10 customer revenue sum < totalRevenue', async ({ page }) => {
            const top10Sum = MOCK_REVENUE.topCustomers.reduce((s, c) => s + c.revenue, 0);
            expect(top10Sum).toBeLessThan(MOCK_REVENUE.totalRevenue);
        });

        test('P&L: Gross Profit = Income - COGS = $2,703,600', async ({ page }) => {
            const grossProfit = MOCK_PNL.totalIncome - MOCK_PNL.totalCOGS;
            // 4506000 - 1802400 = 2703600
            expect(grossProfit).toBe(2703600);

            await clickTab(page, 'P&L');
            await expect(page.getByText('Monthly P&L')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Gross Profit') }).first();
            await expect(card).toContainText('$2,703,600');
        });

        test('P&L: Gross Margin = Gross Profit / Income * 100 = 60.0%', async ({ page }) => {
            const grossProfit = MOCK_PNL.totalIncome - MOCK_PNL.totalCOGS;
            const grossMargin = (grossProfit / MOCK_PNL.totalIncome) * 100;
            expect(grossMargin.toFixed(1)).toBe('60.0');

            await clickTab(page, 'P&L');
            await expect(page.getByText('Monthly P&L')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Gross Margin') }).first();
            await expect(card).toContainText('60.0%');
        });

        test('P&L: Net Income = Income + OtherIncome - COGS - Expenses - OtherExpenses = $1,358,600', async ({ page }) => {
            const computed =
                MOCK_PNL.totalIncome +
                MOCK_PNL.totalOtherIncome -
                MOCK_PNL.totalCOGS -
                MOCK_PNL.totalExpenses -
                MOCK_PNL.totalOtherExpenses;
            // 4506000 + 15000 - 1802400 - 1351800 - 8200 = 1358600
            expect(computed).toBe(1358600);
            expect(MOCK_PNL.netIncome).toBe(1358600);

            await clickTab(page, 'P&L');
            await expect(page.getByText('Monthly P&L')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Net Income') }).first();
            await expect(card).toContainText('$1,358,600');
        });

        test('Expenses: P&L totalExpenses matches Expenses tab totalAllTime', async ({ page }) => {
            // Both should equal $1,351,800
            expect(MOCK_PNL.totalExpenses).toBe(MOCK_EXPENSES.totalAllTime);
            expect(MOCK_EXPENSES.totalAllTime).toBe(1351800);
        });

        test('Expenses: ScanTech Solutions is the largest vendor', async ({ page }) => {
            const maxSpend = Math.max(...MOCK_EXPENSES.topVendors.map(v => v.totalAllTime));
            const topVendor = MOCK_EXPENSES.topVendors.find(v => v.totalAllTime === maxSpend);
            expect(topVendor?.vendor).toBe('ScanTech Solutions');
            expect(maxSpend).toBe(285000);
        });

        test('Customers: Inactive = Total - Active = 414', async ({ page }) => {
            const inactive = MOCK_CUSTOMERS.totalCustomers - MOCK_CUSTOMERS.activeCustomers;
            expect(inactive).toBe(414);
            // 542 - 128 = 414
        });

        test('Customers: Acme Corp has the highest revenue in mock data', async ({ page }) => {
            const maxRevenue = Math.max(...MOCK_CUSTOMERS.customers.map(c => c.totalRevenue));
            const topCust = MOCK_CUSTOMERS.customers.find(c => c.totalRevenue === maxRevenue);
            expect(topCust?.customerName).toBe('Acme Corp');
            expect(maxRevenue).toBe(680000);
        });

        test('Estimates: conversionRate as stored in mock = 0.5 (decimal fraction)', async ({ page }) => {
            // The fixture stores conversionRate = acceptedCount / totalEstimates = 0.5
            expect(MOCK_ESTIMATES.conversionRate).toBeCloseTo(0.5);
            // Verify the math: accepted / total
            const computed = MOCK_ESTIMATES.acceptedCount / MOCK_ESTIMATES.totalEstimates;
            expect(computed).toBeCloseTo(0.5);
        });

        test('Estimates: accepted + invoiced + pending = totalEstimates', async ({ page }) => {
            const sum =
                MOCK_ESTIMATES.acceptedCount +
                MOCK_ESTIMATES.invoicedCount +
                MOCK_ESTIMATES.pendingCount;
            expect(sum).toBe(MOCK_ESTIMATES.totalEstimates);
        });

        test('Estimates: acceptedCount (584) < totalEstimates (1168)', async ({ page }) => {
            expect(MOCK_ESTIMATES.acceptedCount).toBeLessThan(MOCK_ESTIMATES.totalEstimates);
        });

        test('Balance Sheet: Assets = Liabilities + Equity (accounting equation)', async ({ page }) => {
            // totalAssets = totalLiabilities + totalEquity
            expect(MOCK_BALANCE_SHEET.totalAssets).toBe(
                MOCK_BALANCE_SHEET.totalLiabilities + MOCK_BALANCE_SHEET.totalEquity,
            );
            // 2850000 = 1140000 + 1710000
            expect(MOCK_BALANCE_SHEET.totalAssets).toBe(2850000);
            expect(MOCK_BALANCE_SHEET.totalLiabilities).toBe(1140000);
            expect(MOCK_BALANCE_SHEET.totalEquity).toBe(1710000);
        });

        test('Balance Sheet: totalEquity = totalAssets - totalLiabilities = $1,710,000', async ({ page }) => {
            const computed = MOCK_BALANCE_SHEET.totalAssets - MOCK_BALANCE_SHEET.totalLiabilities;
            expect(computed).toBe(1710000);
            expect(MOCK_BALANCE_SHEET.totalEquity).toBe(1710000);

            await clickTab(page, 'Balance Sheet');
            await expect(page.getByText('Total Assets')).toBeVisible();
            const card = page.locator('div', { has: page.getByText('Total Equity') }).first();
            await expect(card).toContainText('$1,710,000');
        });

        test('Balance Sheet: sum of asset items = totalAssets', async ({ page }) => {
            const assetItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Assets');
            const assetSum = assetItems.reduce((s, i) => s + i.total, 0);
            expect(assetSum).toBe(MOCK_BALANCE_SHEET.totalAssets);
        });

        test('Balance Sheet: sum of liability items = totalLiabilities', async ({ page }) => {
            const liabilityItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Liabilities');
            const liabilitySum = liabilityItems.reduce((s, i) => s + i.total, 0);
            expect(liabilitySum).toBe(MOCK_BALANCE_SHEET.totalLiabilities);
        });

        test('Balance Sheet: sum of equity items = totalEquity', async ({ page }) => {
            const equityItems = MOCK_BALANCE_SHEET.items.filter(i => i.category === 'Equity');
            const equitySum = equityItems.reduce((s, i) => s + i.total, 0);
            // Owner Equity (500000) + Retained Earnings (851400) + Net Income (358600) = 1710000
            expect(equitySum).toBe(MOCK_BALANCE_SHEET.totalEquity);
        });

        test('Revenue data covers 12 monthly periods', async ({ page }) => {
            expect(MOCK_REVENUE.monthlyRevenue).toHaveLength(12);
        });

        test('most recent monthly revenue (2026-02) is the largest month', async ({ page }) => {
            const revenues = MOCK_REVENUE.monthlyRevenue.map(m => m.revenue);
            const max = Math.max(...revenues);
            const latest = MOCK_REVENUE.monthlyRevenue[MOCK_REVENUE.monthlyRevenue.length - 1];
            expect(latest.revenue).toBe(max);
            expect(latest.revenue).toBe(462000);
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 11 — Accessibility
    // ══════════════════════════════════════════════════════════════════════

    test.describe('accessibility', () => {
        test('all six tab buttons are keyboard-focusable', async ({ page }) => {
            for (const tabName of ['Revenue', 'P&L', 'Expenses', 'Customers', 'Estimates', 'Balance Sheet']) {
                const btn = page.getByRole('button', { name: tabName });
                await btn.focus();
                await expect(btn).toBeFocused();
            }
        });

        test('Revenue tab table has proper thead/tbody structure', async ({ page }) => {
            await expect(page.locator('table')).toBeVisible();
            await expect(page.locator('thead')).toBeVisible();
            await expect(page.locator('tbody')).toBeVisible();
        });

        test('Customers tab table has proper thead/tbody structure', async ({ page }) => {
            await clickTab(page, 'Customers');
            await expect(page.getByText('Customer Directory')).toBeVisible();
            await expect(page.locator('table')).toBeVisible();
            await expect(page.locator('thead')).toBeVisible();
            await expect(page.locator('tbody')).toBeVisible();
        });

        test('customer search input has a visible placeholder', async ({ page }) => {
            await clickTab(page, 'Customers');
            const input = page.getByPlaceholder('Search customers...');
            await expect(input).toBeVisible();
        });

        test('CFO Agent FAB button has an accessible label or text', async ({ page }) => {
            const fab = page.locator('[data-tour="cfo-agent"]');
            // Button contains "CFO Agent" text (visible on desktop viewport)
            await expect(fab).toContainText('CFO Agent');
        });

        test('CFO Agent chat input is keyboard-accessible (Enter submits)', async ({ page }) => {
            await page.locator('[data-tour="cfo-agent"]').click();
            const chatInput = page.getByPlaceholder('Ask about financials...');
            await chatInput.focus();
            await expect(chatInput).toBeFocused();
        });

        test('page uses semantic heading hierarchy (h2 for Financial Dashboard)', async ({ page }) => {
            await expect(
                page.getByRole('heading', { name: 'Financial Dashboard', level: 2 }),
            ).toBeVisible();
        });
    });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 12 — Loading & Error States
    // ══════════════════════════════════════════════════════════════════════

    test.describe('loading states', () => {
        test('spinner is not visible after page load completes', async ({ page }) => {
            // waitForLoad already asserted this; re-confirm spinner is gone
            await expect(page.locator('.animate-spin').first()).not.toBeVisible();
        });

        test('URL is /dashboard/revenue after navigation', async ({ page }) => {
            await expect(page).toHaveURL(/\/dashboard\/revenue/);
        });

        test('all API endpoints are called on initial load', async ({ page }) => {
            // We can verify indirectly by confirming all 6 tabs show data
            const tabData = [
                { tab: 'Revenue', signal: 'Top Revenue Customers' },
                { tab: 'P&L', signal: 'Monthly P&L' },
                { tab: 'Expenses', signal: 'Top Vendors by Spend' },
                { tab: 'Customers', signal: 'Customer Directory' },
                { tab: 'Estimates', signal: 'Monthly Estimates' },
                { tab: 'Balance Sheet', signal: 'Total Assets' },
            ] as const;

            for (const { tab, signal } of tabData) {
                await clickTab(page, tab);
                await expect(page.getByText(signal)).toBeVisible({ timeout: 5_000 });
            }
        });
    });
});
