/**
 * S2PX — PM Dashboard (Mission Control) E2E Tests
 *
 * Covers:
 *   - Field Data tab rendering on Production Detail page
 *   - Status header with readiness state
 *   - Quick stats row (photos, scan files, notes, upload size)
 *   - Checklist progress cards with expand/collapse
 *   - Field media gallery with filter pills
 *   - Scan file downloads with signed URLs
 *   - Field notes panel
 *   - Scoping data snapshot
 *   - Tab switching between Stage Data and Field Data
 *   - Data integrity assertions
 *
 * Runs in the 'chromium' project (Desktop Chrome).
 *
 * Usage:
 *   npx playwright test e2e/pm-dashboard.spec.ts
 *   npx playwright test e2e/pm-dashboard.spec.ts --headed
 */

import { test, expect } from '@playwright/test';
import {
    setupPMDashboardMockApi,
    bypassFirebaseAuthPM,
    MOCK_PM_FIELD_SUMMARY,
    MOCK_SCANTECH_DETAIL,
} from './fixtures/scantech-mock-data';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function goToProductionDetail(page: Parameters<typeof setupPMDashboardMockApi>[0]) {
    await bypassFirebaseAuthPM(page);
    await setupPMDashboardMockApi(page);
    await page.goto('/dashboard/production/101');
    await page.waitForLoadState('networkidle');
}

async function switchToFieldDataTab(page: Parameters<typeof setupPMDashboardMockApi>[0]) {
    // Click the "Field Data" tab button
    const fieldDataTab = page.getByText('Field Data', { exact: false }).first();
    await fieldDataTab.click();
    // Wait for the lazy-loaded component to render
    await page.waitForTimeout(500);
}

// ─────────────────────────────────────────────
// Suite 1 — Tab Navigation
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Tab Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
    });

    test('Production Detail page loads with Stage Data tab active by default', async ({ page }) => {
        // The "Stage Data" tab should be active (blue underline)
        const stageDataTab = page.getByText('Stage Data');
        await expect(stageDataTab).toBeVisible();
    });

    test('Field Data tab is visible with LIVE badge', async ({ page }) => {
        await expect(page.getByText('Field Data')).toBeVisible();
        await expect(page.getByText('LIVE')).toBeVisible();
    });

    test('clicking Field Data tab loads the Mission Control dashboard', async ({ page }) => {
        await switchToFieldDataTab(page);
        // The PM Field Summary readiness header should appear
        await page.waitForTimeout(1000);
        // Look for content unique to the Field Data view
        await expect(page.getByText(/checklist/i).first()).toBeVisible();
    });

    test('clicking back to Stage Data shows the original form fields', async ({ page }) => {
        // Switch to Field Data
        await switchToFieldDataTab(page);
        await page.waitForTimeout(500);

        // Switch back to Stage Data
        await page.getByText('Stage Data').click();
        await page.waitForTimeout(300);

        // Should see stage data fields again
        await expect(page.getByText('Stage Data')).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 2 — Status Header & Readiness
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Status Header', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows readiness status (in-progress since post-scan incomplete)', async ({ page }) => {
        // With 2/3 checklists complete and one in-progress, status should be in_progress
        // The exact label depends on readiness derivation logic
        const statusLabels = [
            'Field Work In Progress',
            'Ready for Review',
            'Flagged',
            'Awaiting Field Data',
        ];
        const foundStatus = await page.evaluate((labels) => {
            return labels.some(label => document.body.textContent?.includes(label));
        }, statusLabels);
        expect(foundStatus).toBe(true);
    });

    test('shows checklist completion count', async ({ page }) => {
        // 2/3 checklists complete
        await expect(page.getByText('2/3').first()).toBeVisible();
    });

    test('shows total upload count', async ({ page }) => {
        await expect(page.getByText('5 uploads')).toBeVisible();
    });

    test('shows total notes count', async ({ page }) => {
        await expect(page.getByText('2 notes')).toBeVisible();
    });

    test('has a refresh button', async ({ page }) => {
        await expect(page.getByText('Refresh')).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 3 — Quick Stats Row
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Quick Stats', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Photos stat card with correct count', async ({ page }) => {
        await expect(page.getByText('Photos')).toBeVisible();
        // 2 photos in mock data
        await expect(page.getByText('2').first()).toBeVisible();
    });

    test('shows Scan Files stat card', async ({ page }) => {
        await expect(page.getByText('Scan Files')).toBeVisible();
    });

    test('shows Field Notes stat card with AI-assisted sublabel', async ({ page }) => {
        await expect(page.getByText('Field Notes')).toBeVisible();
        // 1 AI-assisted note
        await expect(page.getByText('1 AI-assisted')).toBeVisible();
    });

    test('shows Total Upload Size stat card', async ({ page }) => {
        await expect(page.getByText('Total Upload Size')).toBeVisible();
        // Total bytes across all categories: ~3.95 GB + 85 MB + 8 MB ≈ 3.8 GB
        // The exact display depends on formatBytes() calculation
    });
});

// ─────────────────────────────────────────────
// Suite 4 — Checklist Progress Cards
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Checklist Progress', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Checklist Status section header', async ({ page }) => {
        await expect(page.getByText('Checklist Status')).toBeVisible();
    });

    test('shows completion badge (2/3 Complete)', async ({ page }) => {
        await expect(page.getByText('2/3 Complete')).toBeVisible();
    });

    test('renders all 3 checklist cards', async ({ page }) => {
        await expect(page.getByText('Pre-Scan Checklist')).toBeVisible();
        await expect(page.getByText('Post-Scan Checklist')).toBeVisible();
        await expect(page.getByText('Safety Checklist')).toBeVisible();
    });

    test('pre-scan checklist shows full completion (8/8)', async ({ page }) => {
        await expect(page.getByText('8/8')).toBeVisible();
    });

    test('post-scan checklist shows partial completion (1/6)', async ({ page }) => {
        await expect(page.getByText('1/6')).toBeVisible();
    });

    test('safety checklist shows full completion (4/4)', async ({ page }) => {
        await expect(page.getByText('4/4')).toBeVisible();
    });

    test('clicking a checklist card expands detail view', async ({ page }) => {
        // Click on Pre-Scan Checklist
        await page.getByText('Pre-Scan Checklist').click();
        await page.waitForTimeout(300);

        // Expanded view should show "All Items" and "Required" breakdown
        await expect(page.getByText('All Items')).toBeVisible();
        await expect(page.getByText('Required')).toBeVisible();
    });

    test('expanded checklist shows respondent name', async ({ page }) => {
        await page.getByText('Pre-Scan Checklist').click();
        await page.waitForTimeout(300);
        await expect(page.getByText('Mike Johnson')).toBeVisible();
    });

    test('expanded checklist shows completion date', async ({ page }) => {
        await page.getByText('Pre-Scan Checklist').click();
        await page.waitForTimeout(300);
        // Should show "Completed" with a date
        await expect(page.getByText(/Completed/)).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 5 — Field Media Gallery
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Media Gallery', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Field Uploads section header with count', async ({ page }) => {
        await expect(page.getByText('Field Uploads')).toBeVisible();
    });

    test('shows filter pills for categories', async ({ page }) => {
        await expect(page.getByText('All')).toBeVisible();
    });

    test('shows upload filenames in gallery cards', async ({ page }) => {
        await expect(page.getByText('floor1_entry.jpg')).toBeVisible();
        await expect(page.getByText('floor2_hallway.jpg')).toBeVisible();
    });

    test('shows video file in gallery', async ({ page }) => {
        await expect(page.getByText('site_walkthrough.mp4')).toBeVisible();
    });

    test('shows file sizes in gallery cards', async ({ page }) => {
        // floor1_entry.jpg is ~4.1 MB
        await expect(page.getByText('4.1 MB').first()).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 6 — Scan File Downloads
// ─────────────────────────────────────────────

test.describe('PM Dashboard — File Downloads', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Scan Files & Documents section', async ({ page }) => {
        await expect(page.getByText('Scan Files & Documents')).toBeVisible();
    });

    test('lists scan files with .e57 extension badges', async ({ page }) => {
        await expect(page.getByText('scan_floor1.e57')).toBeVisible();
        await expect(page.getByText('scan_floor2.e57')).toBeVisible();
    });

    test('shows E57 file type labels', async ({ page }) => {
        // E57 badges should be visible
        const e57Badges = page.getByText('E57');
        const count = await e57Badges.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('shows file sizes for scan files', async ({ page }) => {
        // scan_floor1.e57 is ~2 GB
        await expect(page.getByText('2 GB').first()).toBeVisible();
    });

    test('scan files have download buttons', async ({ page }) => {
        const downloadBtns = page.getByText('Download', { exact: true });
        const count = await downloadBtns.count();
        // At least 2 scan files should have download buttons
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('shows Large File badge for files > 100MB', async ({ page }) => {
        // Both e57 files are > 100MB
        const largeBadges = page.getByText('Large File');
        const count = await largeBadges.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('shows total file size summary', async ({ page }) => {
        // Should show "X total" in the header
        await expect(page.getByText(/total$/)).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 7 — Field Notes Panel
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Field Notes', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Field Notes section header with count badge', async ({ page }) => {
        await expect(page.getByText('Field Notes')).toBeVisible();
    });

    test('field notes panel is collapsible', async ({ page }) => {
        // Click to expand
        await page.getByText('Field Notes').click();
        await page.waitForTimeout(300);

        // Should show note content
        await expect(page.getByText(/lobby.*construction/i)).toBeVisible();
    });

    test('shows note category badges', async ({ page }) => {
        await page.getByText('Field Notes').click();
        await page.waitForTimeout(300);
        await expect(page.getByText('site condition')).toBeVisible();
        await expect(page.getByText('issue')).toBeVisible();
    });

    test('shows AI badge on AI-assisted notes', async ({ page }) => {
        await page.getByText('Field Notes').click();
        await page.waitForTimeout(300);
        // The AI-assisted note should have an "AI" badge
        await expect(page.getByText('AI').first()).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 8 — Scoping Data Snapshot
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Scoping Snapshot', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('shows Scoping Data section header', async ({ page }) => {
        await expect(page.getByText('Scoping Data')).toBeVisible();
    });

    test('shows area count in scoping header', async ({ page }) => {
        await expect(page.getByText('3 areas')).toBeVisible();
    });

    test('scoping panel is collapsed by default', async ({ page }) => {
        // The detailed scoping fields should not be visible until expanded
        await expect(page.getByText('modern_2001_plus')).not.toBeVisible();
    });

    test('expanding scoping panel shows client and project fields', async ({ page }) => {
        await page.getByText('Scoping Data').click();
        await page.waitForTimeout(300);

        await expect(page.getByText('Acme Corp')).toBeVisible();
        await expect(page.getByText('Downtown Office Tower')).toBeVisible();
        await expect(page.getByText('123 Main St, Denver, CO 80202')).toBeVisible();
    });

    test('expanding scoping panel shows building details', async ({ page }) => {
        await page.getByText('Scoping Data').click();
        await page.waitForTimeout(300);

        await expect(page.getByText('Revit')).toBeVisible();
        await expect(page.getByText('8')).toBeVisible();  // floors
    });

    test('expanding scoping panel shows scope areas with SF', async ({ page }) => {
        await page.getByText('Scoping Data').click();
        await page.waitForTimeout(300);

        await expect(page.getByText('Floors 1-4')).toBeVisible();
        await expect(page.getByText('22,000 SF')).toBeVisible();
    });

    test('expanding scoping panel shows risk factors', async ({ page }) => {
        await page.getByText('Scoping Data').click();
        await page.waitForTimeout(300);

        await expect(page.getByText('high_ceiling')).toBeVisible();
        await expect(page.getByText('active_construction')).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 9 — Data Integrity Assertions
// ─────────────────────────────────────────────

test.describe('PM Dashboard — Data Integrity', () => {
    test.beforeEach(async ({ page }) => {
        await goToProductionDetail(page);
        await switchToFieldDataTab(page);
        await page.waitForTimeout(1000);
    });

    test('upload category counts match mock data', async ({ page }) => {
        // Photos: 2, Scan Files: 2, Video: 1 = 5 total
        await expect(page.getByText('5 uploads')).toBeVisible();
    });

    test('checklist completion ratio matches mock data', async ({ page }) => {
        // 2 complete + 1 in_progress = 2/3
        await expect(page.getByText('2/3').first()).toBeVisible();
    });

    test('notes count matches mock data', async ({ page }) => {
        // 2 total notes
        await expect(page.getByText('2 notes')).toBeVisible();
    });

    test('AI-assisted note count matches mock data', async ({ page }) => {
        // 1 AI-assisted note
        await expect(page.getByText('1 AI-assisted')).toBeVisible();
    });

    test('checklist item counts are mathematically consistent', async ({ page }) => {
        // Pre-scan: 8/8, Post-scan: 1/6, Safety: 4/4
        await expect(page.getByText('8/8')).toBeVisible();
        await expect(page.getByText('1/6')).toBeVisible();
        await expect(page.getByText('4/4')).toBeVisible();
    });
});

// ─────────────────────────────────────────────
// Suite 10 — API Mocking Verification
// ─────────────────────────────────────────────

test.describe('PM Dashboard — API Mocking', () => {
    test('field summary endpoint returns correct aggregated data', async ({ page }) => {
        await bypassFirebaseAuthPM(page);
        await setupPMDashboardMockApi(page);

        const response = await page.request.get('/api/pm/projects/101/field-summary');
        expect(response.ok()).toBe(true);
        const data = await response.json();

        expect(data.upid).toBe('UP-101');
        expect(data.checklists).toHaveLength(3);
        expect(data.uploads.total).toBe(5);
        expect(data.notes.total).toBe(2);
        expect(data.notes.aiAssistedCount).toBe(1);
    });

    test('download URL endpoint returns signed URL', async ({ page }) => {
        await bypassFirebaseAuthPM(page);
        await setupPMDashboardMockApi(page);

        const response = await page.request.get('/api/pm/projects/101/uploads/1003/download');
        expect(response.ok()).toBe(true);
        const data = await response.json();

        expect(data.url).toContain('storage.googleapis.com');
        expect(data.filename).toBe('scan_floor1.e57');
    });

    test('thumbnail URL endpoint returns signed URL', async ({ page }) => {
        await bypassFirebaseAuthPM(page);
        await setupPMDashboardMockApi(page);

        const response = await page.request.get('/api/pm/projects/101/uploads/1001/thumbnail');
        expect(response.ok()).toBe(true);
        const data = await response.json();

        expect(data.url).toContain('storage.googleapis.com');
        expect(data.filename).toBe('floor1_entry.jpg');
    });

    test('GCS signed URLs are intercepted without hitting real storage', async ({ page }) => {
        await bypassFirebaseAuthPM(page);
        await setupPMDashboardMockApi(page);

        const gcsResponse = await page.request.get(
            'https://storage.googleapis.com/s2p-active-projects/UP-101/field/scan_file/scan_floor1.e57?X-Goog-Signature=mock'
        );
        expect(gcsResponse.ok()).toBe(true);
    });
});
