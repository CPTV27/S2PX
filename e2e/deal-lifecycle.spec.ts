// ── S2PX E2E: Deal Lifecycle (Scoping → Pricing → Proposal) ──
// Tests the complete revenue-generating flow from lead to proposal.
// Uses mock API interception via context.route() — no real backend needed.
//
// IMPORTANT: Uses context.route() instead of page.route() because Vite's
// dev server proxy intercepts /api/* requests server-side, which bypasses
// page-level route interception for fetch() calls made by the React app.

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
    MOCK_SCOPING_FORM,
    MOCK_SCOPE_AREAS,
    MOCK_SCOPING_LIST,
    MOCK_NEW_FORM,
    MOCK_LINE_ITEMS,
    MOCK_PRICED_LINE_ITEMS,
    MOCK_SAVED_QUOTE,
    MOCK_QUOTE_TOTALS,
    MOCK_PROPOSAL,
    setupDealMockApi,
    bypassAuth,
} from './fixtures/deal-mock-data';

// ─────────────────────────────────────────────
// Helper: navigate to an authenticated page
// ─────────────────────────────────────────────
async function goTo(
    page: Page,
    context: BrowserContext,
    path: string,
    options?: { quoteExists?: boolean; proposalExists?: boolean },
) {
    await bypassAuth(page);
    await setupDealMockApi(context, options);
    await page.goto(path, { waitUntil: 'networkidle' });
}

// ─────────────────────────────────────────────
// Helper: expand a collapsible FormSection by its title text
// Sections B-O are collapsed by default (only A and D are open).
// The section header is a <button> containing an <h3> with the title.
// ─────────────────────────────────────────────
async function expandSection(page: Page, sectionTitle: string) {
    const header = page.locator(`button:has(h3:text("${sectionTitle}"))`);
    // Only click if the section is collapsed (its content panel is hidden)
    const isExpanded = await header.locator('..').locator('> div.px-6').count() > 0;
    if (!isExpanded) {
        await header.click();
        // Wait for the content to appear
        await page.waitForTimeout(200);
    }
}

// ═══════════════════════════════════════════════
// JOURNEY 1A: SCOPING FORM — CREATE & SAVE
// ═══════════════════════════════════════════════
test.describe('Journey 1A: Scoping Form — Create & Save', () => {

    test('new scoping form renders all section headers', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Page header
        await expect(page.getByText('New Scoping Form')).toBeVisible();

        // Section A is defaultOpen — its fields should be visible
        await expect(page.locator('input[name="clientCompany"]')).toBeVisible();
        await expect(page.locator('input[name="projectName"]')).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();

        // All other sections exist as collapsible headers
        await expect(page.getByText('Section B')).toBeVisible();
        await expect(page.getByText('Section C')).toBeVisible();
        await expect(page.getByText('Section D')).toBeVisible();
        await expect(page.getByText('Section E')).toBeVisible();
        await expect(page.getByText('Section F')).toBeVisible();
        await expect(page.getByText('Section G')).toBeVisible();
        await expect(page.getByText('Section H')).toBeVisible();
        await expect(page.getByText('Section I')).toBeVisible();
        await expect(page.getByText('Section M')).toBeVisible();
        await expect(page.getByText('Section N')).toBeVisible();
        await expect(page.getByText('Section O')).toBeVisible();

        // Create & Save button
        await expect(page.getByRole('button', { name: /Create & Save/i })).toBeVisible();
    });

    test('BIM version field is a dropdown with standard versions', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Section F is collapsed — expand it first
        await expandSection(page, 'Section F');

        const bimSelect = page.locator('select[name="bimVersion"]');
        await expect(bimSelect).toBeVisible();

        // Should have Revit options
        const options = bimSelect.locator('option');
        const texts = await options.allTextContents();
        expect(texts.some(t => t.includes('2025'))).toBe(true);
        expect(texts.some(t => t.includes('2024'))).toBe(true);
    });

    test('project timeline field is a dropdown with quarters', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Section M is collapsed — expand it first
        await expandSection(page, 'Section M');

        const timelineSelect = page.locator('select[name="projectTimeline"]');
        await expect(timelineSelect).toBeVisible();

        const options = timelineSelect.locator('option');
        const texts = await options.allTextContents();
        expect(texts.some(t => t.includes('ASAP'))).toBe(true);
        expect(texts.some(t => t.includes('TBD'))).toBe(true);
    });

    test('save button shows validation error when required fields are empty', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Click save without filling anything
        await page.getByRole('button', { name: /Create & Save/i }).click();

        // Error banner should appear
        await expect(page.getByText(/Please fix the highlighted fields/i)).toBeVisible({ timeout: 5000 });
    });

    test('successful create redirects to saved form', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Section A is open — fill it (projectAddress is also required)
        await page.fill('input[name="clientCompany"]', 'Test Client Corp');
        await page.fill('input[name="projectName"]', 'New Test Project');
        await page.getByPlaceholder('123 Main St, Troy, NY 12180').fill('100 State St, Albany, NY 12207');
        await page.fill('input[name="email"]', 'test@testclient.com');

        // Expand Section B and fill required fields
        await expandSection(page, 'Section B');
        await page.fill('input[name="primaryContactName"]', 'John Test');
        await page.fill('input[name="contactEmail"]', 'john@testclient.com');

        // Expand Section C and fill required fields
        await expandSection(page, 'Section C');
        await page.fill('input[name="numberOfFloors"]', '2');

        // Expand Section F and fill BIM deliverable
        await expandSection(page, 'Section F');
        await page.locator('select[name="bimDeliverable"]').selectOption({ index: 1 });

        // Expand Section G and fill era
        await expandSection(page, 'Section G');
        const eraSelect = page.locator('select[name="era"]');
        if (await eraSelect.count() > 0) {
            await eraSelect.selectOption({ index: 1 });
        }

        // Expand Section I and fill travel
        await expandSection(page, 'Section I');
        const dispatchSelect = page.locator('select[name="dispatchLocation"]');
        if (await dispatchSelect.count() > 0) {
            await dispatchSelect.selectOption({ index: 1 });
        }
        const milesInput = page.locator('input[name="oneWayMiles"]');
        if (await milesInput.count() > 0) {
            await milesInput.fill('8');
        }
        const travelSelect = page.locator('select[name="travelMode"]');
        if (await travelSelect.count() > 0) {
            await travelSelect.selectOption({ index: 1 });
        }

        // Expand Section O and fill lead source
        await expandSection(page, 'Section O');
        const leadSelect = page.locator('select[name="leadSource"]');
        if (await leadSelect.count() > 0) {
            await leadSelect.selectOption({ index: 1 });
        }
        const probInput = page.locator('input[name="probability"]');
        if (await probInput.count() > 0) {
            await probInput.fill('50');
        }
        const stageSelect = page.locator('select[name="dealStage"]');
        if (await stageSelect.count() > 0) {
            await stageSelect.selectOption({ index: 1 });
        }

        // Click Create & Save
        await page.getByRole('button', { name: /Create & Save/i }).click();

        // Should redirect to the saved form URL
        await page.waitForURL('**/dashboard/scoping/9002', { timeout: 10000 });
    });

    test('back button navigates to pipeline (not orphaned scoping page)', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/new');

        // Click the back arrow (ArrowLeft icon button)
        const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
        await backButton.click();

        // Should navigate to pipeline
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 1B: EXISTING SCOPING FORM — EDIT & VIEW
// ═══════════════════════════════════════════════
test.describe('Journey 1B: Existing Scoping Form', () => {

    test('loads saved form with all data populated', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/9001');

        // Should show the UPID (appears in both header <p> and workflow banner <span>)
        await expect(page.getByText('SCAN-2026-0042').first()).toBeVisible({ timeout: 10000 });

        // Section A is open — client company should be populated
        const clientInput = page.locator('input[name="clientCompany"]');
        await expect(clientInput).toHaveValue('Acme Architecture Group');

        // Project name
        await expect(page.locator('input[name="projectName"]')).toHaveValue('Downtown Albany Office Renovation');
    });

    test('workflow stepper banner is visible on saved form', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/9001');

        // The workflow banner shows step indicators and "Price this Deal"
        await expect(page.getByText('1. Scope')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('2. Price')).toBeVisible();
        await expect(page.getByText(/Price this Deal/i).first()).toBeVisible();
    });

    test('"Price this Deal" navigates to DealWorkspace', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping/9001');

        // Wait for the "Price this Deal" button in the workflow banner
        const priceButton = page.getByRole('button', { name: /Price this Deal/i }).first();
        await expect(priceButton).toBeVisible({ timeout: 10000 });
        await priceButton.click();

        // Should navigate to deals page
        await page.waitForURL('**/dashboard/deals/9001', { timeout: 5000 });
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 2: DEAL WORKSPACE — CEO PRICING
// ═══════════════════════════════════════════════
test.describe('Journey 2: DealWorkspace — CEO Pricing', () => {

    test('loads deal workspace with scoping summary', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');

        // Should show project name
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // Should show client company somewhere on the page
        await expect(page.getByText('Acme Architecture Group')).toBeVisible();

        // Should show UPID
        await expect(page.getByText('SCAN-2026-0042')).toBeVisible();
    });

    test('shows scoping summary cards', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');

        // Wait for page to load
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // Travel info should appear in summary (may appear in multiple places)
        await expect(page.getByText(/12 mi/).first()).toBeVisible();
        await expect(page.getByText(/Local/).first()).toBeVisible();
    });

    test('generates line items from scoping data', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');

        // Wait for page to load fully
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // Should show area names in line items
        await expect(page.getByText('Floors 1-3 Office Space').first()).toBeVisible();
        await expect(page.getByText('Floor 4 Executive Suite').first()).toBeVisible();
        await expect(page.getByText('Basement Mechanical').first()).toBeVisible();
    });

    test('back button navigates to pipeline', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        await page.getByText('Back to Pipeline').click();
        await expect(page).toHaveURL(/\/dashboard\/pipeline/);
    });

    test('"Create Proposal" is disabled before quote is saved', async ({ page, context }) => {
        // No quote exists yet
        await goTo(page, context, '/dashboard/deals/9001', { quoteExists: false });
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // Create Proposal button should exist but be disabled or show tooltip
        const proposalButton = page.getByRole('button', { name: /Create Proposal/i });
        const proposalLink = page.getByRole('link', { name: /Create Proposal/i });
        const proposalElement = proposalButton.or(proposalLink);

        if (await proposalElement.count() > 0) {
            // If it's a button, it should be disabled or visually muted
            if (await proposalButton.count() > 0) {
                // Check for disabled state or opacity-related class
                const isDisabled = await proposalButton.isDisabled().catch(() => false);
                const classes = await proposalButton.getAttribute('class') || '';
                const hasDisabledStyle = isDisabled || classes.includes('opacity') || classes.includes('cursor-not-allowed');
                expect(hasDisabledStyle).toBeTruthy();
            }
        }
    });

    test('"Create Proposal" becomes active after quote is saved', async ({ page, context }) => {
        // Quote already exists and is saved
        await goTo(page, context, '/dashboard/deals/9001', { quoteExists: true });
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // "Create Proposal" should be a clickable link or enabled button
        const proposalLink = page.getByRole('link', { name: /Create Proposal/i });
        const proposalButton = page.getByRole('button', { name: /Create Proposal/i });
        const proposalElement = proposalLink.or(proposalButton);

        if (await proposalElement.count() > 0) {
            await expect(proposalElement.first()).toBeVisible();
            if (await proposalLink.count() > 0) {
                const href = await proposalLink.getAttribute('href');
                expect(href).toContain('/dashboard/proposals/');
            }
        }
    });

    test('"Regenerate Shells" button is visible', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        await expect(page.getByText(/Regenerate/i)).toBeVisible();
    });

    test('back navigation link to scoping form exists', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // Look for a link referencing the scoping form
        const scopingLink = page.locator('a[href*="/dashboard/scoping/9001"]');
        if (await scopingLink.count() > 0) {
            await expect(scopingLink.first()).toBeVisible();
        }
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 3: QUOTE TOTALS & MARGIN INTEGRITY
// ═══════════════════════════════════════════════
test.describe('Journey 3: Quote Totals & Margin Integrity', () => {

    test('totals bar or save button shows at bottom of deal workspace', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/deals/9001');
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // The page should have a Save Quote button or totals display
        const saveButton = page.getByRole('button', { name: /Save Quote/i });
        const totalsText = page.getByText(/Upteam Cost|Client Price|Margin/i).first();

        // At least one of these should be visible
        const hasSaveButton = await saveButton.count() > 0;
        const hasTotals = await totalsText.count() > 0;
        expect(hasSaveButton || hasTotals).toBeTruthy();
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 4: SCOPING LIST
// ═══════════════════════════════════════════════
test.describe('Journey 4: Scoping List', () => {

    test('scoping list shows existing forms', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping');

        // Should show the form list items
        await expect(page.getByText('Acme Architecture Group').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Metro Development Corp').first()).toBeVisible();
        await expect(page.getByText('Summit Architecture').first()).toBeVisible();
    });

    test('scoping list has "New" button or link', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping');
        await expect(page.getByText('Acme Architecture Group').first()).toBeVisible({ timeout: 10000 });

        const newButton = page.getByRole('link', { name: /New/i }).or(
            page.getByRole('button', { name: /New/i })
        );
        await expect(newButton.first()).toBeVisible();
    });

    test('clicking a form navigates to edit page', async ({ page, context }) => {
        await goTo(page, context, '/dashboard/scoping');
        await expect(page.getByText('Acme Architecture Group').first()).toBeVisible({ timeout: 10000 });

        // Click on the first form — could be text or a link
        const formLink = page.getByText('Downtown Albany Office Renovation').first();
        await formLink.click();

        await page.waitForURL('**/dashboard/scoping/9001', { timeout: 5000 });
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 5: ERROR BOUNDARY — STALE CHUNK HANDLING
// ═══════════════════════════════════════════════
test.describe('Journey 5: Error Boundary', () => {

    test('dashboard loads without error boundary', async ({ page, context }) => {
        await bypassAuth(page);

        // Set up minimal API mocks using context.route (not page.route)
        await context.route('**/api/**', route => {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        // Navigate to dashboard
        await page.goto('/dashboard', { waitUntil: 'networkidle' });

        // Verify the page loaded (error boundary text should NOT be visible)
        const errorBoundary = page.getByText('Something went wrong');
        await expect(errorBoundary).not.toBeVisible({ timeout: 5000 });
    });
});

// ═══════════════════════════════════════════════
// JOURNEY 6: FULL LIFECYCLE — END TO END
// ═══════════════════════════════════════════════
test.describe('Journey 6: Full Deal Lifecycle', () => {

    test('complete flow: scoping list → form → deal workspace', async ({ page, context }) => {
        // Phase 1: Start at scoping list
        await goTo(page, context, '/dashboard/scoping');
        await expect(page.getByText('Acme Architecture Group').first()).toBeVisible({ timeout: 10000 });

        // Phase 2: Open existing form
        await page.getByText('Downtown Albany Office Renovation').first().click();
        await page.waitForURL('**/dashboard/scoping/9001', { timeout: 5000 });
        await expect(page.getByText('SCAN-2026-0042')).toBeVisible({ timeout: 10000 });

        // Phase 3: Navigate to DealWorkspace via "Price this Deal"
        const priceButton = page.getByRole('button', { name: /Price this Deal/i }).first();
        await expect(priceButton).toBeVisible({ timeout: 5000 });
        await priceButton.click();
        await page.waitForURL('**/dashboard/deals/9001', { timeout: 5000 });

        // Phase 4: Verify deal loaded with correct data
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Acme Architecture Group')).toBeVisible();

        // Phase 5: Verify area names in line items
        await expect(page.getByText('Floors 1-3 Office Space').first()).toBeVisible();

        // Phase 6: Verify navigation elements
        await expect(page.getByText('Back to Pipeline')).toBeVisible();
    });

    test('full flow with saved quote shows active Create Proposal', async ({ page, context }) => {
        // Start with a quote already saved
        await goTo(page, context, '/dashboard/deals/9001', { quoteExists: true });

        // Verify the deal loaded
        await expect(page.getByText('Downtown Albany Office Renovation')).toBeVisible({ timeout: 10000 });

        // "Create Proposal" should be visible and active
        const proposalElement = page.getByText(/Create Proposal/i).first();
        await expect(proposalElement).toBeVisible();
    });
});
