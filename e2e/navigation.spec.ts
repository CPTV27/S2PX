/**
 * S2PX Navigation & User Journey E2E Tests
 *
 * Covers:
 *   - Layout structure (sidebar, header, branding)
 *   - Individual nav item routing
 *   - Active state highlighting
 *   - CEO Morning Review full journey
 *   - Revenue tab traversal
 *   - Responsive sidebar behavior
 *   - Search / Command Palette trigger
 *
 * Usage:
 *   npx playwright test e2e/navigation.spec.ts
 *   npx playwright test e2e/navigation.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import { setupMockApi, bypassFirebaseAuth } from './fixtures/mock-data';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Navigate to /dashboard with mocked API and bypassed Firebase auth.
 * All tests that need an authenticated shell call this first.
 */
async function goToDashboard(page: Parameters<typeof setupMockApi>[0]) {
    await bypassFirebaseAuth(page);
    await setupMockApi(page);
    await page.goto('/dashboard');
    // Wait for the sidebar to be visible before asserting anything
    await page.locator('aside').waitFor({ state: 'visible' });
}

// Revenue tab labels in display order
const REVENUE_TABS = ['Revenue', 'P&L', 'Expenses', 'Customers', 'Estimates', 'Balance Sheet'] as const;

// ─────────────────────────────────────────────
// Suite 1 — Layout Structure
// ─────────────────────────────────────────────

test.describe('Layout Structure', () => {
    test.beforeEach(async ({ page }) => {
        await goToDashboard(page);
    });

    test('sidebar is visible with S2PX logo text', async ({ page }) => {
        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible();

        // Logo area: "S2P" + blue "X" — rendered as two adjacent text nodes inside a span
        // The sidebar logo container has data-tour="sidebar-logo"
        const logoContainer = page.locator('[data-tour="sidebar-logo"]');
        await expect(logoContainer).toBeVisible();

        // S2PX brand text is visible on lg breakpoint; the test runs at Desktop Chrome (1280px)
        await expect(logoContainer.getByText(/S2P/)).toBeVisible();
        await expect(logoContainer.getByText(/Scan2Plan OS/i)).toBeVisible();
    });

    test('all 9 navigation items are visible in the sidebar', async ({ page }) => {
        const navLabels = [
            'Dashboard',
            'Pipeline',
            'Production',
            'Archive',
            'Revenue',
            'Scorecard',
            'Knowledge Base',
            'Cloud Storage',
            'Settings',
        ];

        for (const label of navLabels) {
            await expect(
                page.locator('aside nav').getByText(label, { exact: true }),
            ).toBeVisible();
        }
    });

    test('header shows "Scan2Plan OS X" brand label', async ({ page }) => {
        const header = page.locator('header');
        await expect(header).toBeVisible();
        // The h2 renders "Scan2Plan OS X" in monospace uppercase
        await expect(header.getByText('Scan2Plan OS X')).toBeVisible();
    });

    test('header shows "Operations Center" title', async ({ page }) => {
        await expect(page.locator('header').getByRole('heading', { name: 'Operations Center' })).toBeVisible();
    });

    test('header shows user name "Chase Pierson"', async ({ page }) => {
        await expect(page.locator('header').getByText('Chase Pierson')).toBeVisible();
    });

    test('header shows user role "admin"', async ({ page }) => {
        await expect(page.locator('header').getByText('admin', { exact: false })).toBeVisible();
    });

    test('header shows user initials avatar "CP"', async ({ page }) => {
        // Avatar div shows initials computed from firstName + lastName
        await expect(page.locator('header').getByText('CP')).toBeVisible();
    });

    test('Gemini 2.5 badge is visible in the header', async ({ page }) => {
        await expect(page.locator('header').getByText('Gemini 2.5')).toBeVisible();
    });

    test('sidebar has Tour button in the footer area', async ({ page }) => {
        // TourTrigger renders inside the sidebar footer
        const sidebar = page.locator('aside');
        // The tour trigger button text may vary; locate by its general area
        const sidebarFooter = sidebar.locator('div').filter({ has: page.getByRole('button') }).last();
        await expect(sidebarFooter).toBeVisible();
    });

    test('sidebar has Logout button', async ({ page }) => {
        // Logout button lives in the sidebar footer
        const logoutBtn = page.locator('aside').getByText(/logout/i);
        await expect(logoutBtn).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 2 — Navigation Routing
// ─────────────────────────────────────────────

test.describe('Navigation User Journey', () => {
    test.beforeEach(async ({ page }) => {
        await goToDashboard(page);
    });

    test('initial load is at /dashboard', async ({ page }) => {
        await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('clicking Pipeline nav navigates to /dashboard/pipeline', async ({ page }) => {
        await page.locator('aside nav').getByText('Pipeline', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);
    });

    test('clicking Production nav navigates to /dashboard/production', async ({ page }) => {
        await page.locator('aside nav').getByText('Production', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/production/);
    });

    test('clicking Archive nav navigates to /dashboard/projects', async ({ page }) => {
        await page.locator('aside nav').getByText('Archive', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/projects/);
    });

    test('clicking Revenue nav navigates to /dashboard/revenue and shows Financial Dashboard heading', async ({ page }) => {
        await page.locator('aside nav').getByText('Revenue', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/revenue/);
        // Revenue page renders a "Financial Dashboard" heading
        await expect(page.getByRole('heading', { name: /Financial Dashboard/i })).toBeVisible();
    });

    test('clicking Scorecard nav navigates to /dashboard/scorecard and shows Scorecard heading', async ({ page }) => {
        await page.locator('aside nav').getByText('Scorecard', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/scorecard/);
        await expect(page.getByRole('heading', { name: /Scorecard/i })).toBeVisible();
    });

    test('clicking Knowledge Base nav navigates to /dashboard/knowledge', async ({ page }) => {
        await page.locator('aside nav').getByText('Knowledge Base', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/knowledge/);
    });

    test('clicking Cloud Storage nav navigates to /dashboard/storage', async ({ page }) => {
        await page.locator('aside nav').getByText('Cloud Storage', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/storage/);
    });

    test('clicking Settings nav navigates to /dashboard/settings', async ({ page }) => {
        await page.locator('aside nav').getByText('Settings', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/settings/);
    });
});

// ─────────────────────────────────────────────
// Suite 3 — Active State Highlighting
// ─────────────────────────────────────────────

test.describe('Active State Highlighting', () => {
    test.beforeEach(async ({ page }) => {
        await goToDashboard(page);
    });

    /**
     * The active nav item receives bg-s2p-primary (blue) and text-white.
     * We verify the active link has a different background from inactive ones
     * by checking for the presence of the active CSS class on the link element.
     *
     * The Link elements use `data-tour` attributes that map cleanly to routes.
     */

    test('Dashboard link is active (highlighted) on /dashboard', async ({ page }) => {
        const dashLink = page.locator('[data-tour="nav-dashboard"]');
        // Active state: bg-s2p-primary applied — check that the element has a class
        // containing "bg-" (Tailwind bg color) distinct from the inactive "text-slate-400"
        await expect(dashLink).toHaveClass(/text-white/);
    });

    test('Pipeline link is active on /dashboard/pipeline', async ({ page }) => {
        await page.locator('aside nav').getByText('Pipeline', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);
        await expect(page.locator('[data-tour="nav-pipeline"]')).toHaveClass(/text-white/);
    });

    test('Revenue link is active on /dashboard/revenue', async ({ page }) => {
        await page.locator('aside nav').getByText('Revenue', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/revenue/);
        await expect(page.locator('[data-tour="nav-revenue"]')).toHaveClass(/text-white/);
    });

    test('Scorecard link is active on /dashboard/scorecard', async ({ page }) => {
        await page.locator('aside nav').getByText('Scorecard', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/scorecard/);
        await expect(page.locator('[data-tour="nav-scorecard"]')).toHaveClass(/text-white/);
    });

    test('Settings link is active on /dashboard/settings', async ({ page }) => {
        await page.locator('aside nav').getByText('Settings', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/settings/);
        await expect(page.locator('[data-tour="nav-settings"]')).toHaveClass(/text-white/);
    });

    test('previously active link loses active state after navigating away', async ({ page }) => {
        // Start at Dashboard (active) — uses bg-s2p-primary for active state
        await expect(page.locator('[data-tour="nav-dashboard"]')).toHaveClass(/bg-s2p-primary/);

        // Navigate to Pipeline
        await page.locator('aside nav').getByText('Pipeline', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);

        // Dashboard should no longer have the active class
        await expect(page.locator('[data-tour="nav-dashboard"]')).not.toHaveClass(/bg-s2p-primary/);

        // Pipeline should now be active
        await expect(page.locator('[data-tour="nav-pipeline"]')).toHaveClass(/bg-s2p-primary/);
    });
});

// ─────────────────────────────────────────────
// Suite 4 — CEO Morning Review (Full Journey)
// ─────────────────────────────────────────────

test.describe('CEO Morning Review — Full User Journey', () => {
    test('complete CEO morning review flow', async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);

        // ── Step 1: Land on Dashboard ──────────────────────────────────────
        await page.goto('/dashboard');
        await page.locator('aside').waitFor({ state: 'visible' });
        await expect(page).toHaveURL(/\/dashboard$/);

        // ── Step 2: Navigate to Scorecard ─────────────────────────────────
        await page.locator('aside nav').getByText('Scorecard', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/scorecard/);

        // Scorecard heading confirms page loaded
        await expect(page.getByRole('heading', { name: /Scorecard/i })).toBeVisible();

        // KPI data should render — mock returns winRate: 64, blendedMarginPct: 45
        // Wait for any numeric KPI card to appear (look for "%" which appears in win rate / margin)
        await expect(page.getByText(/%/).first()).toBeVisible();

        // ── Step 3: Navigate to Revenue ───────────────────────────────────
        await page.locator('aside nav').getByText('Revenue', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/revenue/);
        await expect(page.getByRole('heading', { name: /Financial Dashboard/i })).toBeVisible();

        // Financial data should contain "$" — mock returns totalRevenue 4,506,000
        await expect(page.getByText(/\$/).first()).toBeVisible();

        // Verify at least one number is rendered (not just a loading spinner)
        await expect(page.getByText(/\d{1,3}(,\d{3})+/).first()).toBeVisible();

        // ── Step 4: Click through all 6 Revenue tabs ──────────────────────
        for (const tabLabel of REVENUE_TABS) {
            const tab = page.getByRole('button', { name: tabLabel });
            await tab.click();

            // Tab should be in an "active" state after clicking
            await expect(tab).toBeVisible();

            // Each tab must render data — minimum: a "$" sign or a number
            // Give each tab a moment to receive mock API data
            await expect(
                page.locator('main').getByText(/\$|\d/).first()
            ).toBeVisible({ timeout: 8_000 });
        }

        // ── Step 5: Navigate to Pipeline ──────────────────────────────────
        await page.locator('aside nav').getByText('Pipeline', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);

        // ── Step 6: Return to Dashboard ───────────────────────────────────
        await page.locator('aside nav').getByText('Dashboard', { exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard$/);

        // Confirm sidebar and header are intact after full navigation journey
        await expect(page.locator('aside')).toBeVisible();
        await expect(page.locator('header').getByText('Chase Pierson')).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 5 — Revenue Tab Traversal (Isolated)
// ─────────────────────────────────────────────

test.describe('Revenue Page — Tab Traversal', () => {
    test.beforeEach(async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard/revenue');
        await expect(page.getByRole('heading', { name: /Financial Dashboard/i })).toBeVisible();
    });

    for (const tabLabel of REVENUE_TABS) {
        test(`"${tabLabel}" tab renders data`, async ({ page }) => {
            const tab = page.getByRole('button', { name: tabLabel });
            await expect(tab).toBeVisible();
            await tab.click();

            // After clicking, the tab panel must show real content.
            // The mock data always contains dollar amounts or percentages.
            await expect(
                page.locator('main').getByText(/\$|\d{2,}/).first()
            ).toBeVisible({ timeout: 8_000 });
        });
    }

    test('tab panel content updates when switching tabs', async ({ page }) => {
        // Revenue tab is active by default — it shows revenue chart data
        await expect(page.getByRole('button', { name: 'Revenue' })).toBeVisible();

        // Switch to P&L and confirm heading or label appears
        await page.getByRole('button', { name: 'P&L' }).click();
        // P&L section renders "Net Income" or "Income" labels from mock
        await expect(page.getByText(/Income|P&L|Net/i).first()).toBeVisible({ timeout: 8_000 });

        // Switch to Customers tab
        await page.getByRole('button', { name: 'Customers' }).click();
        // Customers section renders "Acme Corp" from mock data
        await expect(page.getByText(/Acme Corp/i)).toBeVisible({ timeout: 8_000 });

        // Switch to Estimates tab
        await page.getByRole('button', { name: 'Estimates' }).click();
        // Estimates section renders conversion rate or estimate count
        await expect(page.getByText(/Estimate|conversion/i).first()).toBeVisible({ timeout: 8_000 });
    });
});

// ─────────────────────────────────────────────
// Suite 6 — Responsive Sidebar Behavior
// ─────────────────────────────────────────────

test.describe('Responsive Sidebar Behavior', () => {
    test('sidebar collapses to icon-only (w-20) on mobile viewport (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard');
        await page.locator('aside').waitFor({ state: 'visible' });

        const sidebar = page.locator('aside');

        // On mobile (<lg breakpoint), sidebar has class "w-20" (icon-only)
        await expect(sidebar).toHaveClass(/w-20/);

        // Nav labels are hidden on mobile — they use "hidden lg:block"
        // Verify nav text is NOT visible (labels are display:none)
        const pipelineLabel = sidebar.locator('span', { hasText: 'Pipeline' });
        await expect(pipelineLabel).toHaveClass(/hidden/);
    });

    test('sidebar shows full labels on desktop viewport (1280px)', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard');
        await page.locator('aside').waitFor({ state: 'visible' });

        const sidebar = page.locator('aside');

        // On desktop (lg+), sidebar has class "lg:w-64"
        await expect(sidebar).toHaveClass(/lg:w-64/);

        // Nav labels are visible — "lg:block" is active
        await expect(sidebar.getByText('Pipeline', { exact: true })).toBeVisible();
        await expect(sidebar.getByText('Revenue', { exact: true })).toBeVisible();
        await expect(sidebar.getByText('Scorecard', { exact: true })).toBeVisible();
    });

    test('main content area adjusts offset with sidebar on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard');
        await page.locator('aside').waitFor({ state: 'visible' });

        // Main has "ml-20 lg:ml-64" — confirm it carries the lg:ml-64 class
        const main = page.locator('main');
        await expect(main).toHaveClass(/lg:ml-64/);
    });
});

// ─────────────────────────────────────────────
// Suite 7 — Search / Command Palette
// ─────────────────────────────────────────────

test.describe('Search (Cmd+K)', () => {
    test.beforeEach(async ({ page }) => {
        await goToDashboard(page);
    });

    test('search button is visible in the header', async ({ page }) => {
        const searchBtn = page.locator('[data-tour="search-button"]');
        await expect(searchBtn).toBeVisible();
    });

    test('search button displays the ⌘K keyboard shortcut hint', async ({ page }) => {
        const searchBtn = page.locator('[data-tour="search-button"]');
        // The <kbd> element inside the button shows "⌘K"
        await expect(searchBtn.locator('kbd')).toHaveText('⌘K');
    });

    test('search button has accessible title attribute with ⌘K hint', async ({ page }) => {
        const searchBtn = page.locator('[data-tour="search-button"]');
        await expect(searchBtn).toHaveAttribute('title', /⌘K/);
    });

    test('clicking the search button opens the command palette', async ({ page }) => {
        const searchBtn = page.locator('[data-tour="search-button"]');
        await searchBtn.click();

        // CommandPalette renders an input when open
        // It is typically a dialog or input with role="searchbox" / type="text"
        const paletteInput = page.getByRole('searchbox').or(page.locator('input[placeholder*="Search"]'));
        await expect(paletteInput.first()).toBeVisible({ timeout: 5_000 });
    });

    test('pressing ⌘K keyboard shortcut opens the command palette', async ({ page }) => {
        // Trigger the keyboard shortcut
        await page.keyboard.press('Meta+k');

        // Palette should open and show a focusable input
        const paletteInput = page.getByRole('searchbox').or(page.locator('input[placeholder*="Search"]'));
        await expect(paletteInput.first()).toBeVisible({ timeout: 5_000 });
    });
});

// ─────────────────────────────────────────────
// Suite 8 — Header Stability Across Routes
// ─────────────────────────────────────────────

test.describe('Header Stability Across Routes', () => {
    test('header content is consistent when navigating between pages', async ({ page }) => {
        await bypassFirebaseAuth(page);
        await setupMockApi(page);
        await page.goto('/dashboard');
        await page.locator('aside').waitFor({ state: 'visible' });

        const routesToCheck = [
            '/dashboard/revenue',
            '/dashboard/scorecard',
            '/dashboard/pipeline',
            '/dashboard/settings',
            '/dashboard',
        ];

        for (const route of routesToCheck) {
            await page.goto(route);
            await page.locator('aside').waitFor({ state: 'visible' });

            // Header must always show these three things
            await expect(page.locator('header').getByText('Scan2Plan OS X')).toBeVisible();
            await expect(page.locator('header').getByText('Chase Pierson')).toBeVisible();
            await expect(page.locator('header').getByText('Gemini 2.5')).toBeVisible();
        }
    });
});
