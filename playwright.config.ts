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
        // ── Desktop Chrome (existing E2E suites) ──
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testMatch: [
                'navigation.spec.ts',
                'revenue.spec.ts',
                'scorecard.spec.ts',
                'data-integrity.spec.ts',
                'pm-dashboard.spec.ts',
            ],
        },

        // ── Mobile — Scantech field ops (iPhone 13) ──
        {
            name: 'scantech-mobile',
            use: {
                ...devices['iPhone 13'],
                hasTouch: true,
                isMobile: true,
            },
            testMatch: ['scantech.spec.ts'],
        },
    ],

    webServer: {
        command: 'npm run dev:client',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
