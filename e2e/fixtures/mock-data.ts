// ── S2PX E2E Test Fixtures: Synthetic Financial Data ──
// All pricing is fake but mathematically consistent for calculation verification.

import type { Page } from '@playwright/test';

// ── Revenue Data ──
// Total should be sum of monthly = 12 months × varying amounts
const monthlyRevenue = [
    { month: '2025-03', revenue: 285000, transactionCount: 18 },
    { month: '2025-04', revenue: 312000, transactionCount: 22 },
    { month: '2025-05', revenue: 298000, transactionCount: 19 },
    { month: '2025-06', revenue: 345000, transactionCount: 25 },
    { month: '2025-07', revenue: 378000, transactionCount: 28 },
    { month: '2025-08', revenue: 401000, transactionCount: 31 },
    { month: '2025-09', revenue: 356000, transactionCount: 24 },
    { month: '2025-10', revenue: 389000, transactionCount: 27 },
    { month: '2025-11', revenue: 410000, transactionCount: 30 },
    { month: '2025-12', revenue: 425000, transactionCount: 32 },
    { month: '2026-01', revenue: 445000, transactionCount: 34 },
    { month: '2026-02', revenue: 462000, transactionCount: 36 },
];

const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0); // 4,506,000
const ytdRevenue = monthlyRevenue
    .filter(m => m.month.startsWith('2026'))
    .reduce((s, m) => s + m.revenue, 0); // 907,000

export const MOCK_REVENUE = {
    totalRevenue,
    ytdRevenue,
    monthlyRevenue,
    topCustomers: [
        { customerName: 'Acme Corp', revenue: 680000, transactionCount: 45 },
        { customerName: 'BuildRight LLC', revenue: 520000, transactionCount: 38 },
        { customerName: 'Metro Development', revenue: 445000, transactionCount: 32 },
        { customerName: 'Greenfield Properties', revenue: 380000, transactionCount: 28 },
        { customerName: 'Summit Architecture', revenue: 350000, transactionCount: 25 },
        { customerName: 'Pacific Design Group', revenue: 310000, transactionCount: 22 },
        { customerName: 'Urban Planning Inc', revenue: 290000, transactionCount: 20 },
        { customerName: 'Skyline Builders', revenue: 265000, transactionCount: 18 },
        { customerName: 'Foundation First', revenue: 240000, transactionCount: 16 },
        { customerName: 'TrueNorth Engineering', revenue: 215000, transactionCount: 14 },
    ],
    revenueByType: [
        { type: '4000 Sales', total: totalRevenue },
        { type: '4100 Discounts', total: -12500 },
    ],
};

// ── P&L Data ──
// Net Income = Income + OtherIncome - COGS - Expenses - OtherExpenses
const totalIncome = 4506000;
const totalCOGS = 1802400;   // ~40% of income
const totalExpenses = 1351800; // ~30% of income
const totalOtherIncome = 15000;
const totalOtherExpenses = 8200;
const netIncome = totalIncome + totalOtherIncome - totalCOGS - totalExpenses - totalOtherExpenses;
// = 4506000 + 15000 - 1802400 - 1351800 - 8200 = 1,358,600

export const MOCK_PNL = {
    totalIncome,
    totalCOGS,
    totalExpenses,
    totalOtherIncome,
    totalOtherExpenses,
    netIncome,
    monthlyPnl: monthlyRevenue.map(m => ({
        month: m.month,
        income: m.revenue,
        cogs: Math.round(m.revenue * 0.40),
        expenses: Math.round(m.revenue * 0.30),
        otherIncome: 1250,
        otherExpenses: 683,
        netIncome: Math.round(m.revenue * 0.30 + 567), // approx
    })),
    accountDetails: [
        { account: '4000 Sales', category: 'Income', total: 4506000, monthly: [] },
        { account: '5000 Subcontractor Costs', category: 'Cost of Goods Sold', total: 1200000, monthly: [] },
        { account: '5100 Equipment Costs', category: 'Cost of Goods Sold', total: 602400, monthly: [] },
        { account: '6000 Payroll Expenses', category: 'Expenses', total: 810000, monthly: [] },
        { account: '6100 Office Rent', category: 'Expenses', total: 216000, monthly: [] },
        { account: '6200 Insurance', category: 'Expenses', total: 180000, monthly: [] },
        { account: '6300 Utilities', category: 'Expenses', total: 145800, monthly: [] },
    ],
};

// ── Expenses Data ──
export const MOCK_EXPENSES = {
    totalAllTime: 1351800,
    totalTrailing12mo: 1080000,
    vendorCount: 42,
    topVendors: [
        { vendor: 'ScanTech Solutions', totalAllTime: 285000, totalTrailing12mo: 220000 },
        { vendor: 'CloudHost Pro', totalAllTime: 180000, totalTrailing12mo: 145000 },
        { vendor: 'Office Depot', totalAllTime: 95000, totalTrailing12mo: 78000 },
        { vendor: 'Adobe Systems', totalAllTime: 72000, totalTrailing12mo: 58000 },
        { vendor: 'Autodesk Inc', totalAllTime: 65000, totalTrailing12mo: 52000 },
        { vendor: 'Enterprise Fleet', totalAllTime: 58000, totalTrailing12mo: 45000 },
        { vendor: 'Verizon Wireless', totalAllTime: 42000, totalTrailing12mo: 34000 },
        { vendor: 'State Farm Insurance', totalAllTime: 38000, totalTrailing12mo: 30000 },
        { vendor: 'Google Workspace', totalAllTime: 28000, totalTrailing12mo: 22000 },
        { vendor: 'Staples Business', totalAllTime: 24000, totalTrailing12mo: 19000 },
    ],
};

// ── Customers Data ──
export const MOCK_CUSTOMERS = {
    totalCustomers: 542,
    activeCustomers: 128,
    customers: [
        { id: 1, customerName: 'Acme Corp', company: 'Acme Corporation', email: 'billing@acme.com', phone: '555-0100', totalRevenue: 680000, transactionCount: 45, estimateCount: 8, lastTransactionDate: '2026-02-15' },
        { id: 2, customerName: 'BuildRight LLC', company: 'BuildRight', email: 'accounts@buildright.com', phone: '555-0200', totalRevenue: 520000, transactionCount: 38, estimateCount: 6, lastTransactionDate: '2026-02-10' },
        { id: 3, customerName: 'Metro Development', company: 'Metro Dev Group', email: 'finance@metrodev.com', phone: '555-0300', totalRevenue: 445000, transactionCount: 32, estimateCount: 5, lastTransactionDate: '2026-01-28' },
        { id: 4, customerName: 'Greenfield Properties', company: 'Greenfield', email: 'ap@greenfield.com', phone: '555-0400', totalRevenue: 380000, transactionCount: 28, estimateCount: 4, lastTransactionDate: '2026-01-15' },
        { id: 5, customerName: 'Summit Architecture', company: 'Summit Arch', email: 'billing@summit-arch.com', phone: '555-0500', totalRevenue: 350000, transactionCount: 25, estimateCount: 3, lastTransactionDate: '2025-12-20' },
        { id: 6, customerName: 'Inactive Client Co', company: null, email: null, phone: null, totalRevenue: 5000, transactionCount: 2, estimateCount: 1, lastTransactionDate: '2024-06-15' },
    ],
};

// ── Estimates Data ──
// conversionRate = acceptedCount / totalEstimates
const totalEstimates = 1168;
const acceptedCount = 584;
const invoicedCount = 467;
const conversionRate = acceptedCount / totalEstimates; // 0.5

export const MOCK_ESTIMATES = {
    totalEstimates,
    acceptedCount,
    invoicedCount,
    pendingCount: totalEstimates - acceptedCount - invoicedCount,
    conversionRate,
    totalEstimateValue: 6250000,
    totalInvoicedValue: 3120000,
    monthlyEstimates: [
        { month: '2025-06', count: 85, totalValue: 450000, acceptedCount: 42 },
        { month: '2025-07', count: 92, totalValue: 490000, acceptedCount: 48 },
        { month: '2025-08', count: 105, totalValue: 560000, acceptedCount: 55 },
        { month: '2025-09', count: 88, totalValue: 465000, acceptedCount: 44 },
        { month: '2025-10', count: 110, totalValue: 590000, acceptedCount: 58 },
        { month: '2025-11', count: 115, totalValue: 620000, acceptedCount: 60 },
        { month: '2025-12', count: 98, totalValue: 525000, acceptedCount: 50 },
        { month: '2026-01', count: 120, totalValue: 640000, acceptedCount: 65 },
        { month: '2026-02', count: 108, totalValue: 580000, acceptedCount: 56 },
    ],
};

// ── Balance Sheet Data ──
// Assets = Liabilities + Equity (accounting equation)
const totalAssets = 2850000;
const totalLiabilities = 1140000;
const totalEquity = totalAssets - totalLiabilities; // 1,710,000

export const MOCK_BALANCE_SHEET = {
    snapshotDate: '2026-02-26',
    totalAssets,
    totalLiabilities,
    totalEquity,
    items: [
        { account: 'Business Checking', category: 'Assets', subcategory: 'Bank Accounts', total: 485000 },
        { account: 'Savings Account', category: 'Assets', subcategory: 'Bank Accounts', total: 320000 },
        { account: 'Accounts Receivable', category: 'Assets', subcategory: 'Current Assets', total: 890000 },
        { account: 'Equipment', category: 'Assets', subcategory: 'Fixed Assets', total: 645000 },
        { account: 'Vehicles', category: 'Assets', subcategory: 'Fixed Assets', total: 285000 },
        { account: 'Office Furniture', category: 'Assets', subcategory: 'Fixed Assets', total: 125000 },
        { account: 'Depreciation', category: 'Assets', subcategory: 'Fixed Assets', total: -100000 },
        { account: 'Security Deposit', category: 'Assets', subcategory: 'Other Assets', total: 200000 },
        { account: 'Accounts Payable', category: 'Liabilities', subcategory: 'Current Liabilities', total: 340000 },
        { account: 'Credit Card Payable', category: 'Liabilities', subcategory: 'Current Liabilities', total: 85000 },
        { account: 'Payroll Liabilities', category: 'Liabilities', subcategory: 'Current Liabilities', total: 120000 },
        { account: 'Vehicle Loans', category: 'Liabilities', subcategory: 'Long-Term Liabilities', total: 285000 },
        { account: 'Equipment Financing', category: 'Liabilities', subcategory: 'Long-Term Liabilities', total: 310000 },
        { account: 'Owner Equity', category: 'Equity', subcategory: null, total: 500000 },
        { account: 'Retained Earnings', category: 'Equity', subcategory: null, total: 851400 },
        { account: 'Net Income', category: 'Equity', subcategory: null, total: 358600 },
    ],
};

// ── Scorecard Data ──
// winRate = wonCount / (wonCount + lostCount) * 100
const wonCount = 145;
const lostCount = 82;
const activeCount = 63;
const totalDeals = wonCount + lostCount + activeCount;
const winRate = Math.round((wonCount / (wonCount + lostCount)) * 100); // 64%
const scorecardTotalRevenue = 3250000;
const scorecardTotalCost = 1787500;
const blendedMarginPct = Math.round(((scorecardTotalRevenue - scorecardTotalCost) / scorecardTotalRevenue) * 100); // 45%
const avgDealSize = Math.round(scorecardTotalRevenue / wonCount); // ~22,414

export const MOCK_SCORECARD_OVERVIEW = {
    totalDeals,
    wonCount,
    lostCount,
    activeCount,
    winRate,
    totalRevenue: scorecardTotalRevenue,
    totalCost: scorecardTotalCost,
    avgDealSize,
    blendedMarginPct,
    activePipelineValue: 1850000,
    totalSfDelivered: 2450000,
    totalProduction: 89,
    deliveredCount: 67,
    avgCycleDays: 22,
    rmsPassRate: 94,
    qcPassRate: 88,
    actualRevenue: totalRevenue,     // from QBO
    ytdActualRevenue: ytdRevenue,   // from QBO
    monthlyRevenue: [
        { month: 'Jan', revenue: 280000, cost: 154000, actualRevenue: 445000 },
        { month: 'Feb', revenue: 310000, cost: 170500, actualRevenue: 462000 },
        { month: 'Mar', revenue: 265000, cost: 145750, actualRevenue: 285000 },
        { month: 'Apr', revenue: 340000, cost: 187000, actualRevenue: 312000 },
        { month: 'May', revenue: 295000, cost: 162250, actualRevenue: 298000 },
        { month: 'Jun', revenue: 380000, cost: 209000, actualRevenue: 345000 },
    ],
    monthlyWinRate: [
        { month: 'Jan', won: 12, lost: 7, rate: 63 },
        { month: 'Feb', won: 14, lost: 6, rate: 70 },
        { month: 'Mar', won: 10, lost: 8, rate: 56 },
        { month: 'Apr', won: 15, lost: 5, rate: 75 },
        { month: 'May', won: 11, lost: 9, rate: 55 },
        { month: 'Jun', won: 13, lost: 7, rate: 65 },
    ],
};

export const MOCK_PIPELINE_REPORT = {
    funnel: [
        { stage: 'Lead', count: 45, totalValue: 1250000, weightedValue: 250000 },
        { stage: 'Qualified', count: 28, totalValue: 890000, weightedValue: 356000 },
        { stage: 'Proposal', count: 22, totalValue: 720000, weightedValue: 432000 },
        { stage: 'Negotiation', count: 15, totalValue: 580000, weightedValue: 406000 },
        { stage: 'In Hand', count: 18, totalValue: 650000, weightedValue: 585000 },
        { stage: 'Lost', count: 35, totalValue: 980000, weightedValue: 0 },
    ],
    monthlyTrend: [
        { month: 'Jan', wonCount: 12, wonValue: 280000, lostCount: 7, newCount: 25 },
        { month: 'Feb', wonCount: 14, wonValue: 310000, lostCount: 6, newCount: 28 },
        { month: 'Mar', wonCount: 10, wonValue: 265000, lostCount: 8, newCount: 22 },
    ],
    winRateBySource: [
        { source: 'Google Ads', totalDeals: 45, wonDeals: 28, winRate: 62 },
        { source: 'Referral', totalDeals: 38, wonDeals: 30, winRate: 79 },
        { source: 'Cold Call', totalDeals: 25, wonDeals: 8, winRate: 32 },
        { source: 'Website', totalDeals: 30, wonDeals: 18, winRate: 60 },
    ],
    avgDealByTier: [
        { tier: 'Minnow', avgValue: 8500, count: 68, avgSqft: 4200 },
        { tier: 'Dolphin', avgValue: 24000, count: 52, avgSqft: 28000 },
        { tier: 'Whale', avgValue: 85000, count: 25, avgSqft: 120000 },
    ],
};

export const MOCK_PRODUCTION_REPORT = {
    stageDistribution: [
        { stage: 'scheduling', count: 8 },
        { stage: 'field_capture', count: 12 },
        { stage: 'registration', count: 15 },
        { stage: 'bim_qc', count: 10 },
        { stage: 'pc_delivery', count: 7 },
        { stage: 'final_delivery', count: 37 },
    ],
    qualityGates: {
        fieldRms: { pass: 72, fail: 5, total: 77, passRate: 94 },
        avgOverlap: { pass: 68, fail: 9, total: 77, passRate: 88 },
        qcStatus: { pass: 55, fail: 4, conditional: 3, total: 62 },
    },
    estimateVsActual: {
        totalEstSF: 1850000,
        totalActualSF: 1920000,
        variancePct: 4,
        byProject: [
            { upid: 'UP-001', projectName: 'Downtown Office Tower', estSF: 250000, actualSF: 262000, variancePct: 5 },
            { upid: 'UP-002', projectName: 'Harbor View Condos', estSF: 180000, actualSF: 175000, variancePct: -3 },
            { upid: 'UP-003', projectName: 'Tech Campus Phase 2', estSF: 320000, actualSF: 345000, variancePct: 8 },
        ],
    },
    monthlyThroughput: [
        { month: 'Jan', started: 8, completed: 6 },
        { month: 'Feb', started: 10, completed: 7 },
        { month: 'Mar', started: 7, completed: 9 },
        { month: 'Apr', started: 12, completed: 8 },
    ],
};

export const MOCK_PROFITABILITY_REPORT = {
    marginDistribution: [
        { range: '<40%', count: 8, color: '#EF4444' },
        { range: '40-45%', count: 22, color: '#F59E0B' },
        { range: '45-50%', count: 45, color: '#10B981' },
        { range: '50-55%', count: 38, color: '#3B82F6' },
        { range: '55%+', count: 32, color: '#2563EB' },
    ],
    avgMarginByTier: [
        { tier: 'Minnow', avgMargin: 52.3, count: 68 },
        { tier: 'Dolphin', avgMargin: 47.1, count: 52 },
        { tier: 'Whale', avgMargin: 43.8, count: 25 },
    ],
    costPerSF: [
        { tier: 'Minnow', avgCostPerSF: 1.85, avgPricePerSF: 3.90, count: 68 },
        { tier: 'Dolphin', avgCostPerSF: 0.95, avgPricePerSF: 1.80, count: 52 },
        { tier: 'Whale', avgCostPerSF: 0.55, avgPricePerSF: 0.98, count: 25 },
    ],
    travelCostBreakdown: {
        totalMilesDriven: 45200,
        totalHotelPerDiem: 28500,
        totalTollsParking: 4800,
        totalOtherCosts: 3200,
        avgTravelCostPerProject: 850,
    },
    monthlyMarginTrend: [
        { month: 'Jan', avgMargin: 45.2, totalRevenue: 280000, totalCost: 154000 },
        { month: 'Feb', avgMargin: 47.8, totalRevenue: 310000, totalCost: 162000 },
        { month: 'Mar', avgMargin: 44.1, totalRevenue: 265000, totalCost: 148000 },
        { month: 'Apr', avgMargin: 48.5, totalRevenue: 340000, totalCost: 175000 },
    ],
};

// ── Auth User Mock ──
export const MOCK_USER = {
    id: 1,
    email: 'chase@scan2plan.io',
    firstName: 'Chase',
    lastName: 'Pierson',
    role: 'admin',
    firebaseUid: 'test-uid-123',
};

// ── Route Interceptor: intercept all API calls and return mock data ──
export async function setupMockApi(page: Page) {
    // Auth - always return the test user
    await page.route('**/api/auth/user', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
    );

    // Financials
    await page.route('**/api/financials/revenue-actual', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REVENUE) })
    );
    await page.route('**/api/financials/pnl-summary', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PNL) })
    );
    await page.route('**/api/financials/expenses-summary', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXPENSES) })
    );
    await page.route('**/api/financials/customers', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CUSTOMERS) })
    );
    await page.route('**/api/financials/estimate-conversion', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ESTIMATES) })
    );
    await page.route('**/api/financials/balance-sheet', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BALANCE_SHEET) })
    );

    // Scorecard
    await page.route('**/api/scorecard/overview*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCORECARD_OVERVIEW) })
    );
    await page.route('**/api/scorecard/pipeline*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PIPELINE_REPORT) })
    );
    await page.route('**/api/scorecard/production*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRODUCTION_REPORT) })
    );
    await page.route('**/api/scorecard/profitability*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROFITABILITY_REPORT) })
    );

    // KB chat (CFO Agent)
    await page.route('**/api/kb/chat', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                response: 'Based on QBO data, your monthly burn rate is approximately $225,000. Revenue is trending upward at 8% MoM with a healthy 45% blended margin.',
            }),
        })
    );

    // Catch-all for other API calls to prevent network errors
    // NOTE: Playwright checks routes LIFO (last-registered first), so this catch-all
    // must use route.fallback() to defer to the specific handlers registered above.
    await page.route('**/api/**', route => {
        const url = route.request().url();
        // Defer to specific handlers registered above for known API groups
        if (url.includes('/api/auth/') || url.includes('/api/financials/') ||
            url.includes('/api/scorecard/') || url.includes('/api/kb/')) {
            return route.fallback();
        }
        // Fulfill unknown API calls with empty array to prevent network errors
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
}

// ── Firebase Auth Bypass ──
// Injects mock user into window before app initializes
// Picked up by useAuth.tsx E2E bypass (DEV mode only)
// Also dismisses the guided tour by setting localStorage key
export async function bypassFirebaseAuth(page: Page) {
    await page.addInitScript(() => {
        (window as any).__E2E_AUTH_USER__ = {
            id: 1,
            email: 'chase@scan2plan.io',
            firstName: 'Chase',
            lastName: 'Pierson',
            role: 'admin',
            profileImageUrl: '',
        };
        // Skip the guided tour so it doesn't block tests
        localStorage.setItem('s2px-tour-completed', 'true');
    });
}
