// ── S2PX E2E Test Fixtures: Deal Lifecycle (Scoping → Pricing → Proposal) ──
// Realistic mock data for the complete deal pipeline user journey.
// All pricing uses the shared engine rules and is mathematically consistent.

import type { Page, BrowserContext } from '@playwright/test';

// ── Scoping Form (saved) ──
export const MOCK_SCOPING_FORM = {
    id: 9001,
    upid: 'SCAN-2026-0042',
    status: 'complete',
    clientCompany: 'Acme Architecture Group',
    projectName: 'Downtown Albany Office Renovation',
    projectAddress: '1 Commerce Plaza, Albany, NY 12260',
    specificBuilding: 'Tower B',
    email: 'projects@acmearch.com',
    projectLat: '42.6526',
    projectLng: '-73.7562',
    buildingFootprintSqft: 18500,
    primaryContactName: 'Sarah Mitchell',
    contactEmail: 'sarah@acmearch.com',
    contactPhone: '518-555-0147',
    billingSameAsPrimary: true,
    billingContactName: '',
    billingEmail: '',
    billingPhone: '',
    numberOfFloors: 4,
    basementAttic: ['Basement'],
    estSfBasementAttic: 12000,
    insuranceRequirements: 'Standard COI required',
    landscapeModeling: 'No',
    landscapeAcres: null,
    landscapeTerrain: '',
    bimDeliverable: 'Revit',
    bimVersion: 'Revit 2024',
    customTemplate: false,
    templateFileUrl: '',
    georeferencing: true,
    era: 'Modern (2000+)',
    roomDensity: 3,
    riskFactors: ['Active construction', 'Limited access hours'],
    scanRegOnly: 'none',
    expedited: false,
    dispatchLocation: 'Troy NY',
    oneWayMiles: 12,
    travelMode: 'Local',
    customTravelCost: null,
    mileageRate: null,
    scanDayFeeOverride: null,
    estTimeline: '',
    projectTimeline: 'Q2 2026',
    timelineNotes: 'Client needs delivery before summer construction phase',
    paymentTerms: 'Net 30',
    paymentNotes: '',
    sfAssumptionsUrl: '',
    sqftAssumptionsNote: 'SF estimated from client floor plans',
    scopingDocsUrls: [],
    internalNotes: 'Good repeat client. Sarah prefers email communication.',
    customScope: '',
    leadSource: 'Referral',
    sourceNote: 'Referred by BuildRight LLC',
    marketingInfluence: ['Website', 'Case Study'],
    proofLinks: '',
    probability: 75,
    dealStage: 'Proposal',
    priority: 2,
    createdAt: '2026-02-20T14:30:00.000Z',
    updatedAt: '2026-02-25T10:15:00.000Z',
    areas: [] as typeof MOCK_SCOPE_AREAS, // populated below
};

// ── Scope Areas ──
export const MOCK_SCOPE_AREAS = [
    {
        id: 101,
        scopingFormId: 9001,
        areaType: 'Commercial Office',
        areaName: 'Floors 1-3 Office Space',
        squareFootage: 45000,
        projectScope: 'Full Scope',
        lod: '300',
        mixedInteriorLod: '',
        mixedExteriorLod: '',
        structural: { enabled: true, sqft: 45000 },
        mepf: { enabled: true, sqft: 45000 },
        cadDeliverable: 'Revit',
        act: { enabled: false },
        belowFloor: { enabled: false },
        customLineItems: [],
        sortOrder: 0,
    },
    {
        id: 102,
        scopingFormId: 9001,
        areaType: 'Commercial Office',
        areaName: 'Floor 4 Executive Suite',
        squareFootage: 15000,
        projectScope: 'Full Scope',
        lod: '400',
        mixedInteriorLod: '',
        mixedExteriorLod: '',
        structural: { enabled: false },
        mepf: { enabled: true, sqft: 15000 },
        cadDeliverable: 'Revit',
        act: { enabled: false },
        belowFloor: { enabled: false },
        customLineItems: [],
        sortOrder: 1,
    },
    {
        id: 103,
        scopingFormId: 9001,
        areaType: 'Basement / Utility',
        areaName: 'Basement Mechanical',
        squareFootage: 12000,
        projectScope: 'MEP Only',
        lod: '200',
        mixedInteriorLod: '',
        mixedExteriorLod: '',
        structural: { enabled: false },
        mepf: { enabled: true, sqft: 12000 },
        cadDeliverable: 'Revit',
        act: { enabled: false },
        belowFloor: { enabled: false },
        customLineItems: [],
        sortOrder: 2,
    },
];

// Wire areas into the form
MOCK_SCOPING_FORM.areas = MOCK_SCOPE_AREAS;

// ── New form (just created, no areas yet) ──
export const MOCK_NEW_FORM = {
    id: 9002,
    upid: 'SCAN-2026-0043',
    status: 'draft',
    clientCompany: 'Test Client Corp',
    projectName: 'New Test Project',
    projectAddress: '100 State St, Albany, NY 12207',
    specificBuilding: '',
    email: 'test@testclient.com',
    primaryContactName: 'John Test',
    contactEmail: 'john@testclient.com',
    contactPhone: '518-555-0199',
    billingSameAsPrimary: true,
    billingContactName: '',
    billingEmail: '',
    billingPhone: '',
    numberOfFloors: 2,
    basementAttic: [],
    insuranceRequirements: '',
    landscapeModeling: 'No',
    bimDeliverable: 'Revit',
    bimVersion: 'Revit 2025',
    georeferencing: false,
    era: 'Modern (2000+)',
    roomDensity: 2,
    riskFactors: [],
    scanRegOnly: 'none',
    expedited: false,
    dispatchLocation: 'Troy NY',
    oneWayMiles: 8,
    travelMode: 'Local',
    estTimeline: '',
    projectTimeline: 'Q3 2026',
    paymentTerms: 'Net 30',
    leadSource: 'Website',
    probability: 50,
    dealStage: 'Lead',
    priority: 3,
    areas: [],
    createdAt: '2026-02-28T12:00:00.000Z',
    updatedAt: '2026-02-28T12:00:00.000Z',
};

// ── Line Items (generated from shellGenerator for MOCK_SCOPING_FORM) ──
// These match what generateLineItemShells() would produce for the form above.
export const MOCK_LINE_ITEMS = [
    // Area 1: Floors 1-3 Office (45,000 SF, LoD 300, Full Scope)
    {
        id: 'li-1',
        areaId: '101',
        areaName: 'Floors 1-3 Office Space',
        category: 'modeling' as const,
        discipline: 'architecture',
        description: 'Architecture — Commercial Office — 45,000 SF — LoD 300 — Full Scope',
        buildingType: 'Commercial Office',
        squareFeet: 45000,
        lod: '300',
        scope: 'Full Scope',
        upteamCost: null,
        clientPrice: null,
    },
    {
        id: 'li-2',
        areaId: '101',
        areaName: 'Floors 1-3 Office Space',
        category: 'modeling' as const,
        discipline: 'structure',
        description: 'Structural — Commercial Office — 45,000 SF',
        buildingType: 'Commercial Office',
        squareFeet: 45000,
        upteamCost: null,
        clientPrice: null,
    },
    {
        id: 'li-3',
        areaId: '101',
        areaName: 'Floors 1-3 Office Space',
        category: 'modeling' as const,
        discipline: 'mepf',
        description: 'MEP/F — Commercial Office — 45,000 SF',
        buildingType: 'Commercial Office',
        squareFeet: 45000,
        upteamCost: null,
        clientPrice: null,
    },
    // Area 2: Floor 4 Executive (15,000 SF, LoD 400, Full Scope)
    {
        id: 'li-4',
        areaId: '102',
        areaName: 'Floor 4 Executive Suite',
        category: 'modeling' as const,
        discipline: 'architecture',
        description: 'Architecture — Commercial Office — 15,000 SF — LoD 400 — Full Scope',
        buildingType: 'Commercial Office',
        squareFeet: 15000,
        lod: '400',
        scope: 'Full Scope',
        upteamCost: null,
        clientPrice: null,
    },
    {
        id: 'li-5',
        areaId: '102',
        areaName: 'Floor 4 Executive Suite',
        category: 'modeling' as const,
        discipline: 'mepf',
        description: 'MEP/F — Commercial Office — 15,000 SF',
        buildingType: 'Commercial Office',
        squareFeet: 15000,
        upteamCost: null,
        clientPrice: null,
    },
    // Area 3: Basement Mechanical (12,000 SF, LoD 200, MEP Only)
    {
        id: 'li-6',
        areaId: '103',
        areaName: 'Basement Mechanical',
        category: 'modeling' as const,
        discipline: 'mepf',
        description: 'MEP/F — Basement / Utility — 12,000 SF',
        buildingType: 'Basement / Utility',
        squareFeet: 12000,
        upteamCost: null,
        clientPrice: null,
    },
    // Project-level: Georeferencing add-on
    {
        id: 'li-7',
        areaId: null,
        areaName: 'Project-Level',
        category: 'addOn' as const,
        description: 'Georeferencing',
        buildingType: '',
        upteamCost: null,
        clientPrice: null,
    },
    // Project-level: Travel (Local, 12 mi)
    {
        id: 'li-8',
        areaId: null,
        areaName: 'Project-Level',
        category: 'travel' as const,
        description: 'Travel — Local — 12 mi one-way from Troy NY',
        buildingType: '',
        upteamCost: null,
        clientPrice: null,
    },
];

// ── Line Items with CEO Prices (priced version of above) ──
export const MOCK_PRICED_LINE_ITEMS = MOCK_LINE_ITEMS.map(item => ({
    ...item,
    upteamCost: item.category === 'travel' ? 180
        : item.category === 'addOn' ? 350
        : item.discipline === 'architecture' && item.squareFeet === 45000 ? 4200
        : item.discipline === 'architecture' && item.squareFeet === 15000 ? 1800
        : item.discipline === 'structure' ? 2100
        : item.discipline === 'mepf' && item.squareFeet === 45000 ? 3500
        : item.discipline === 'mepf' && item.squareFeet === 15000 ? 1400
        : item.discipline === 'mepf' && item.squareFeet === 12000 ? 1200
        : 500,
    clientPrice: item.category === 'travel' ? 350
        : item.category === 'addOn' ? 750
        : item.discipline === 'architecture' && item.squareFeet === 45000 ? 8500
        : item.discipline === 'architecture' && item.squareFeet === 15000 ? 3800
        : item.discipline === 'structure' ? 4200
        : item.discipline === 'mepf' && item.squareFeet === 45000 ? 7000
        : item.discipline === 'mepf' && item.squareFeet === 15000 ? 2800
        : item.discipline === 'mepf' && item.squareFeet === 12000 ? 2400
        : 1000,
}));

// Totals for the priced line items
const totalClient = MOCK_PRICED_LINE_ITEMS.reduce((s, i) => s + (i.clientPrice || 0), 0);
const totalCost = MOCK_PRICED_LINE_ITEMS.reduce((s, i) => s + (i.upteamCost || 0), 0);
const grossMargin = totalClient - totalCost;
const marginPct = totalClient > 0 ? (grossMargin / totalClient) * 100 : 0;

export const MOCK_QUOTE_TOTALS = {
    totalClientPrice: totalClient,    // 29,800
    totalUpteamCost: totalCost,       // 14,730
    grossMargin,                      // 15,070
    grossMarginPercent: Math.round(marginPct * 100) / 100,  // ~50.57%
    integrityStatus: 'passed' as const,
    integrityFlags: [],
};

// ── Quote (unsaved — no quote exists yet for form 9001) ──
export const MOCK_EMPTY_QUOTES: never[] = [];

// ── Quote (saved) ──
export const MOCK_SAVED_QUOTE = {
    id: 5001,
    scopingFormId: 9001,
    lineItems: MOCK_PRICED_LINE_ITEMS,
    totals: MOCK_QUOTE_TOTALS,
    integrityStatus: 'passed',
    createdAt: '2026-02-26T09:00:00.000Z',
    updatedAt: '2026-02-26T09:00:00.000Z',
};

// ── Low-margin quote (triggers warning) ──
export const MOCK_LOW_MARGIN_ITEMS = MOCK_LINE_ITEMS.map(item => ({
    ...item,
    upteamCost: 1000,
    clientPrice: 1700, // ~41% margin → warning
}));

// ── Blocked-margin quote (triggers blocked) ──
export const MOCK_BLOCKED_MARGIN_ITEMS = MOCK_LINE_ITEMS.map(item => ({
    ...item,
    upteamCost: 1000,
    clientPrice: 1500, // ~33% margin → blocked
}));

// ── Scoping Form List (for pipeline/list view) ──
export const MOCK_SCOPING_LIST = [
    {
        id: 9001,
        upid: 'SCAN-2026-0042',
        status: 'complete',
        clientCompany: 'Acme Architecture Group',
        projectName: 'Downtown Albany Office Renovation',
        projectAddress: '1 Commerce Plaza, Albany, NY 12260',
        probability: 75,
        dealStage: 'Proposal',
        priority: 2,
        createdAt: '2026-02-20T14:30:00.000Z',
        updatedAt: '2026-02-25T10:15:00.000Z',
    },
    {
        id: 9002,
        upid: 'SCAN-2026-0041',
        status: 'priced',
        clientCompany: 'Metro Development Corp',
        projectName: 'Warehouse 12 Scan',
        projectAddress: '45 Industrial Pkwy, Colonie, NY 12205',
        probability: 90,
        dealStage: 'Won',
        priority: 1,
        createdAt: '2026-02-15T08:00:00.000Z',
        updatedAt: '2026-02-22T16:00:00.000Z',
    },
    {
        id: 9003,
        upid: 'SCAN-2026-0040',
        status: 'draft',
        clientCompany: 'Summit Architecture',
        projectName: 'Residential Tower Survey',
        projectAddress: '200 Pearl St, Albany, NY 12207',
        probability: 30,
        dealStage: 'Lead',
        priority: 4,
        createdAt: '2026-02-10T11:00:00.000Z',
        updatedAt: '2026-02-10T11:00:00.000Z',
    },
];

// ── Proposal (generated from quote) ──
export const MOCK_PROPOSAL = {
    id: 7001,
    quoteId: 5001,
    scopingFormId: 9001,
    status: 'draft',
    clientCompany: 'Acme Architecture Group',
    projectName: 'Downtown Albany Office Renovation',
    contactName: 'Sarah Mitchell',
    contactEmail: 'sarah@acmearch.com',
    totalPrice: MOCK_QUOTE_TOTALS.totalClientPrice,
    pdfUrl: null,
    sentAt: null,
    viewedAt: null,
    respondedAt: null,
    clientResponse: null,
    createdAt: '2026-02-26T09:05:00.000Z',
    updatedAt: '2026-02-26T09:05:00.000Z',
};

// ── Geo/Travel Mock ──
export const MOCK_GEO_LOOKUP = {
    lat: 42.6526,
    lng: -73.7562,
    formattedAddress: '1 Commerce Plaza, Albany, NY 12260, USA',
    buildingFootprintSqft: 18500,
};

export const MOCK_DISTANCE_RESULT = {
    distanceMiles: 12,
    durationMinutes: 18,
    origin: 'Troy, NY',
    destination: '1 Commerce Plaza, Albany, NY 12260',
};

// ── API Interceptor for Deal Lifecycle Tests ──
// IMPORTANT: Uses context.route() instead of page.route() because Vite's
// dev server proxy handles /api/* requests server-side, bypassing page-level
// route interception for fetch() calls made by the React app. Context-level
// routing intercepts at a higher level and reliably catches all requests.
export async function setupDealMockApi(context: BrowserContext, options?: {
    quoteExists?: boolean;
    proposalExists?: boolean;
}) {
    const quoteExists = options?.quoteExists ?? false;
    const proposalExists = options?.proposalExists ?? false;

    const json = (body: unknown, status = 200) => ({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
    });

    // Single route handler — matches any /api/ request and dispatches by pathname.
    // NOTE: The glob **/api/** also matches third-party URLs like
    // maps.googleapis.com/maps/api/js — we must let those through.
    await context.route('**/api/**', async (route) => {
        const rawUrl = route.request().url();
        const reqUrl = new URL(rawUrl);

        // Only intercept our own API, not third-party APIs (e.g., Google Maps)
        if (!reqUrl.host.startsWith('localhost')) {
            return route.fallback();
        }

        const p = reqUrl.pathname;
        const method = route.request().method();

        // ── Auth ──
        if (p.startsWith('/api/auth/')) {
            return route.fulfill(json({
                id: 1, email: 'chase@scan2plan.io', firstName: 'Chase',
                lastName: 'Pierson', role: 'admin', firebaseUid: 'test-uid-123',
            }));
        }

        // ── Scoping: Area CRUD (must check before single-form match) ──
        if (/\/api\/scoping\/\d+\/areas/.test(p)) {
            if (method === 'POST') {
                return route.fulfill(json({ id: 200, ...MOCK_SCOPE_AREAS[0] }, 201));
            }
            if (p.match(/\/areas\/\d+$/)) {
                return route.fulfill(json({ id: 200, ...MOCK_SCOPE_AREAS[0] }));
            }
            return route.fulfill(json(MOCK_SCOPE_AREAS));
        }

        // ── Scoping: Single form by ID ──
        if (p === '/api/scoping/9001') {
            return route.fulfill(json(MOCK_SCOPING_FORM));
        }
        if (p === '/api/scoping/9002') {
            return route.fulfill(json({ ...MOCK_NEW_FORM, areas: [] }));
        }
        if (/^\/api\/scoping\/\d+$/.test(p)) {
            return route.fulfill(json({ message: 'Not found' }, 404));
        }

        // ── Scoping: List ──
        if (p === '/api/scoping') {
            if (method === 'POST') {
                return route.fulfill(json(MOCK_NEW_FORM, 201));
            }
            return route.fulfill(json(MOCK_SCOPING_LIST));
        }

        // ── Quotes: by-form ──
        if (p.startsWith('/api/quotes/by-form/')) {
            return route.fulfill(json(quoteExists ? [MOCK_SAVED_QUOTE] : MOCK_EMPTY_QUOTES));
        }

        // ── Quotes: CRUD ──
        if (p === '/api/quotes') {
            if (method === 'POST') {
                return route.fulfill(json(MOCK_SAVED_QUOTE, 201));
            }
            return route.fulfill(json([]));
        }
        if (p.startsWith('/api/quotes/')) {
            return route.fulfill(json(MOCK_SAVED_QUOTE));
        }

        // ── Proposals ──
        if (/\/api\/proposals\/\d+\/generate$/.test(p)) {
            return route.fulfill(json(MOCK_PROPOSAL, 201));
        }
        if (/\/api\/proposals\/\d+\/status$/.test(p)) {
            return route.fulfill(json(proposalExists ? MOCK_PROPOSAL : null));
        }
        if (p.startsWith('/api/proposals')) {
            return route.fulfill(json(proposalExists ? MOCK_PROPOSAL : null));
        }

        // ── Geo / Travel ──
        if (p.startsWith('/api/geo/')) {
            if (p.includes('/distance')) {
                return route.fulfill(json(MOCK_DISTANCE_RESULT));
            }
            return route.fulfill(json(MOCK_GEO_LOOKUP));
        }

        // ── Leads ──
        if (p.startsWith('/api/leads')) {
            return route.fulfill(json([]));
        }

        // ── Other known endpoints ──
        if (p.startsWith('/api/production') || p.startsWith('/api/projects') ||
            p.startsWith('/api/scorecard') || p.startsWith('/api/knowledge') ||
            p.startsWith('/api/storage') || p.startsWith('/api/settings') ||
            p.startsWith('/api/chat') || p.startsWith('/api/health')) {
            return route.fulfill(json([]));
        }

        // ── Catch-all: prevent ECONNREFUSED leaks ──
        return route.fulfill(json([]));
    });
}

// ── Firebase Auth Bypass (reusable) ──
export async function bypassAuth(page: Page) {
    await page.addInitScript(() => {
        (window as any).__E2E_AUTH_USER__ = {
            id: 1,
            email: 'chase@scan2plan.io',
            firstName: 'Chase',
            lastName: 'Pierson',
            role: 'admin',
            profileImageUrl: '',
        };
        localStorage.setItem('s2px-tour-completed', 'true');
    });
}
