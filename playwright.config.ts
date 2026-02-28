import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 30_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        // ── Desktop Chrome — Navigation & Layout ──
        // Tests UI shell, routing, sidebar, header, responsive layout, search.
        // These run without a real backend — mock routes prevent network errors.
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testMatch: [
                'navigation.spec.ts',
                'deal-lifecycle.spec.ts',
            ],
        },

        // ── Desktop Chrome — Data Rendering (requires mock API interception) ──
        // Temporarily excluded: Playwright page.route() interception is unreliable
        // for mock data delivery. Revenue/scorecard data tests should run against
        // the real backend locally, not against synthetic mocks.
        //
        // Excluded specs (run locally with real backend):
        //   'revenue.spec.ts',        — QBO financial data rendering
        //   'data-integrity.spec.ts',  — cross-tab math verification
        //   'scorecard.spec.ts',       — scorecard KPI & chart rendering
        //   'pm-dashboard.spec.ts',    — PM mission control rendering

        // ── Mobile — Scantech field ops (iPhone 13) ──
        // Phase 18: will be enabled once Scantech pages are built
        // {
        //     name: 'scantech-mobile',
        //     use: {
        //         ...devices['iPhone 13'],
        //         hasTouch: true,
        //         isMobile: true,
        //     },
        //     testMatch: ['scantech.spec.ts'],
        // },
    ],

    webServer: {
        command: 'npm run dev:client',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
