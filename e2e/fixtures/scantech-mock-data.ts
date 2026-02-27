// ── S2PX E2E Test Fixtures: Scantech & PM Dashboard Mock Data ──
// Synthetic field operations data for Phase 20 E2E tests.
// All data is fake but structurally consistent with the real API shapes.

import type { Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// Scantech — Mobile Field Operations Mock Data
// ═══════════════════════════════════════════════════════════════

// ── Scantech Project List ──

export const MOCK_SCANTECH_PROJECTS = [
    {
        id: 101,
        scopingFormId: 201,
        upid: 'UP-101',
        currentStage: 'field_capture',
        projectName: 'Downtown Office Tower',
        clientCompany: 'Acme Corp',
        projectAddress: '123 Main St, Denver, CO 80202',
        projectLat: '39.7392',
        projectLng: '-104.9903',
        buildingFootprintSqft: 45000,
        buildingType: 'commercial_office',
        uploadCount: 7,
        checklistProgress: { total: 3, completed: 1 },
        updatedAt: '2026-02-26T14:30:00Z',
    },
    {
        id: 102,
        scopingFormId: 202,
        upid: 'UP-102',
        currentStage: 'scheduling',
        projectName: 'Harbor View Condos',
        clientCompany: 'BuildRight LLC',
        projectAddress: '456 Harbor Dr, San Diego, CA 92101',
        projectLat: '32.7157',
        projectLng: '-117.1611',
        buildingFootprintSqft: 28000,
        buildingType: 'residential_multi',
        uploadCount: 0,
        checklistProgress: { total: 3, completed: 0 },
        updatedAt: '2026-02-25T09:15:00Z',
    },
    {
        id: 103,
        scopingFormId: 203,
        upid: 'UP-103',
        currentStage: 'field_capture',
        projectName: 'Tech Campus Phase 2',
        clientCompany: 'Metro Development',
        projectAddress: '789 Innovation Blvd, Austin, TX 73301',
        projectLat: '30.2672',
        projectLng: '-97.7431',
        buildingFootprintSqft: 120000,
        buildingType: 'commercial_campus',
        uploadCount: 23,
        checklistProgress: { total: 3, completed: 3 },
        updatedAt: '2026-02-27T08:00:00Z',
    },
];

// ── Scantech Project Detail (project 101) ──

export const MOCK_SCANTECH_DETAIL = {
    id: 101,
    scopingFormId: 201,
    upid: 'UP-101',
    currentStage: 'field_capture',
    stageData: {
        field_capture: {
            fieldDate: '2026-02-26',
            fieldTech: 'Mike Johnson',
            scannerSN: 'TX8-2024-0042',
        },
    },
    scopingData: {
        clientCompany: 'Acme Corp',
        projectName: 'Downtown Office Tower',
        projectAddress: '123 Main St, Denver, CO 80202',
        email: 'john@acme.com',
        primaryContactName: 'John Smith',
        contactPhone: '555-0100',
        numberOfFloors: 8,
        basementAttic: ['basement'],
        bimDeliverable: 'Revit',
        bimVersion: '2024',
        georeferencing: true,
        era: 'modern_2001_plus',
        roomDensity: 7,
        riskFactors: ['high_ceiling', 'active_construction'],
        dispatchLocation: 'Denver HQ',
        oneWayMiles: 12,
        travelMode: 'drive',
        pricingTier: 'Dolphin',
        estScanDays: 3,
        techsPlanned: 2,
        landscapeModeling: null,
        scanRegOnly: null,
        expedited: false,
        estTimeline: '2-3 weeks',
        paymentTerms: 'NET-30',
        internalNotes: 'Priority client — fast turnaround requested',
        areas: [
            { id: 1, areaType: 'interior', areaName: 'Floors 1-4', squareFootage: 22000, projectScope: 'full_bim', lod: '300' },
            { id: 2, areaType: 'interior', areaName: 'Floors 5-8', squareFootage: 18000, projectScope: 'full_bim', lod: '200' },
            { id: 3, areaType: 'exterior', areaName: 'Building Envelope', squareFootage: 5000, projectScope: 'point_cloud', lod: '200' },
        ],
    },
    checklists: [
        {
            id: 1,
            checklistId: 4,
            checklistTitle: 'Pre-Scan Checklist',
            checklistSlug: 'pre-scan',
            checklistType: 'pre_scan',
            status: 'complete',
            responses: [
                { itemId: 'PRE-01', checked: true, completedAt: '2026-02-26T08:00:00Z' },
                { itemId: 'PRE-02', checked: true, completedAt: '2026-02-26T08:05:00Z' },
                { itemId: 'PRE-03', checked: true, completedAt: '2026-02-26T08:10:00Z' },
            ],
            completedAt: '2026-02-26T08:15:00Z',
            respondedByName: 'Mike Johnson',
            createdAt: '2026-02-26T07:30:00Z',
            updatedAt: '2026-02-26T08:15:00Z',
        },
        {
            id: 2,
            checklistId: 5,
            checklistTitle: 'Post-Scan Checklist',
            checklistSlug: 'post-scan',
            checklistType: 'post_scan',
            status: 'in_progress',
            responses: [
                { itemId: 'POST-01', checked: true, completedAt: '2026-02-26T16:00:00Z' },
                { itemId: 'POST-02', checked: false },
            ],
            completedAt: null,
            respondedByName: 'Mike Johnson',
            createdAt: '2026-02-26T16:00:00Z',
            updatedAt: '2026-02-26T16:05:00Z',
        },
        {
            id: 3,
            checklistId: 6,
            checklistTitle: 'Safety Checklist',
            checklistSlug: 'safety',
            checklistType: 'safety',
            status: 'complete',
            responses: [
                { itemId: 'SAF-01', checked: true, completedAt: '2026-02-26T07:45:00Z' },
                { itemId: 'SAF-02', checked: true, completedAt: '2026-02-26T07:46:00Z' },
            ],
            completedAt: '2026-02-26T07:50:00Z',
            respondedByName: 'Mike Johnson',
            createdAt: '2026-02-26T07:40:00Z',
            updatedAt: '2026-02-26T07:50:00Z',
        },
    ],
    uploads: [
        {
            id: 1001,
            productionProjectId: 101,
            filename: 'floor1_entry.jpg',
            gcsPath: 'UP-101/field/photo/floor1_entry.jpg',
            bucket: 's2p-active-projects',
            sizeBytes: '4250000',
            contentType: 'image/jpeg',
            fileCategory: 'photo' as const,
            captureMethod: 'camera' as const,
            metadata: { width: 4032, height: 3024, gps: { lat: 39.7392, lng: -104.9903 } },
            notes: 'Main entrance lobby',
            createdAt: '2026-02-26T09:30:00Z',
            uploadedByName: 'Mike Johnson',
        },
        {
            id: 1002,
            productionProjectId: 101,
            filename: 'floor2_hallway.jpg',
            gcsPath: 'UP-101/field/photo/floor2_hallway.jpg',
            bucket: 's2p-active-projects',
            sizeBytes: '3800000',
            contentType: 'image/jpeg',
            fileCategory: 'photo' as const,
            captureMethod: 'camera' as const,
            metadata: null,
            notes: null,
            createdAt: '2026-02-26T10:15:00Z',
            uploadedByName: 'Mike Johnson',
        },
        {
            id: 1003,
            productionProjectId: 101,
            filename: 'scan_floor1.e57',
            gcsPath: 'UP-101/field/scan_file/scan_floor1.e57',
            bucket: 's2p-active-projects',
            sizeBytes: '2147483648',
            contentType: 'application/octet-stream',
            fileCategory: 'scan_file' as const,
            captureMethod: 'trimble_import' as const,
            metadata: { scanPositions: 42, scanner: 'TX8' },
            notes: 'Floor 1 full scan — 42 positions',
            createdAt: '2026-02-26T14:00:00Z',
            uploadedByName: 'Mike Johnson',
        },
        {
            id: 1004,
            productionProjectId: 101,
            filename: 'scan_floor2.e57',
            gcsPath: 'UP-101/field/scan_file/scan_floor2.e57',
            bucket: 's2p-active-projects',
            sizeBytes: '1800000000',
            contentType: 'application/octet-stream',
            fileCategory: 'scan_file' as const,
            captureMethod: 'trimble_import' as const,
            metadata: { scanPositions: 38, scanner: 'TX8' },
            notes: 'Floor 2 scan — 38 positions',
            createdAt: '2026-02-26T15:30:00Z',
            uploadedByName: 'Mike Johnson',
        },
        {
            id: 1005,
            productionProjectId: 101,
            filename: 'site_walkthrough.mp4',
            gcsPath: 'UP-101/field/video/site_walkthrough.mp4',
            bucket: 's2p-active-projects',
            sizeBytes: '85000000',
            contentType: 'video/mp4',
            fileCategory: 'video' as const,
            captureMethod: 'camera' as const,
            metadata: { duration: '02:34', resolution: '1920x1080' },
            notes: 'Full building walkthrough video',
            createdAt: '2026-02-26T11:00:00Z',
            uploadedByName: 'Mike Johnson',
        },
    ],
    notes: [
        {
            id: 'note-001',
            content: 'Building lobby has active construction — need to coordinate with site manager for access.',
            createdAt: '2026-02-26T08:30:00Z',
            updatedAt: '2026-02-26T08:30:00Z',
            aiAssisted: false,
            category: 'site_condition' as const,
        },
        {
            id: 'note-002',
            content: 'MEP density on floors 3-4 is higher than expected. Recommend additional scan positions.',
            createdAt: '2026-02-26T12:00:00Z',
            updatedAt: '2026-02-26T12:00:00Z',
            aiAssisted: true,
            category: 'issue' as const,
        },
    ],
    projectLat: '39.7392',
    projectLng: '-104.9903',
    buildingFootprintSqft: 45000,
    updatedAt: '2026-02-26T14:30:00Z',
};

// ── Checklist Templates ──

export const MOCK_CHECKLIST_TEMPLATES = [
    {
        id: 4,
        slug: 'pre-scan',
        title: 'Pre-Scan Checklist',
        description: 'Equipment and site preparation before scanning begins',
        checklistType: 'pre_scan',
        items: [
            { itemId: 'PRE-01', label: 'Scanner batteries fully charged', category: 'Equipment', required: true, inputType: 'checkbox' as const },
            { itemId: 'PRE-02', label: 'Tripod and accessories packed', category: 'Equipment', required: true, inputType: 'checkbox' as const },
            { itemId: 'PRE-03', label: 'SD cards formatted and ready', category: 'Equipment', required: true, inputType: 'checkbox' as const },
            { itemId: 'PRE-04', label: 'Targets and checkerboards packed', category: 'Equipment', required: false, inputType: 'checkbox' as const },
            { itemId: 'PRE-05', label: 'Site access confirmed with client', category: 'Site Prep', required: true, inputType: 'checkbox' as const },
            { itemId: 'PRE-06', label: 'Parking arrangements confirmed', category: 'Site Prep', required: false, inputType: 'checkbox' as const },
            { itemId: 'PRE-07', label: 'Weather conditions checked', category: 'Site Prep', required: false, inputType: 'checkbox' as const },
            { itemId: 'PRE-08', label: 'PPE requirements identified', category: 'Safety', required: true, inputType: 'checkbox' as const },
        ],
        isActive: true,
        version: 1,
    },
    {
        id: 5,
        slug: 'post-scan',
        title: 'Post-Scan Checklist',
        description: 'Data quality and handoff after scanning is complete',
        checklistType: 'post_scan',
        items: [
            { itemId: 'POST-01', label: 'All scan positions captured', category: 'Data Quality', required: true, inputType: 'checkbox' as const },
            { itemId: 'POST-02', label: 'Field RMS within tolerance', category: 'Data Quality', required: true, inputType: 'checkbox' as const },
            { itemId: 'POST-03', label: 'Control points documented', category: 'Data Quality', required: true, inputType: 'checkbox' as const },
            { itemId: 'POST-04', label: 'Photos of all areas captured', category: 'Documentation', required: false, inputType: 'checkbox' as const },
            { itemId: 'POST-05', label: 'Data backed up to external drive', category: 'Data Transfer', required: true, inputType: 'checkbox' as const },
            { itemId: 'POST-06', label: 'Client sign-off obtained', category: 'Handoff', required: false, inputType: 'checkbox' as const },
        ],
        isActive: true,
        version: 1,
    },
    {
        id: 6,
        slug: 'safety',
        title: 'Safety Checklist',
        description: 'Safety procedures and hazard identification',
        checklistType: 'safety',
        items: [
            { itemId: 'SAF-01', label: 'PPE worn (hard hat, vest, boots)', category: 'PPE', required: true, inputType: 'checkbox' as const },
            { itemId: 'SAF-02', label: 'Site hazards identified and documented', category: 'Hazards', required: true, inputType: 'checkbox' as const },
            { itemId: 'SAF-03', label: 'Emergency exits located', category: 'Emergency', required: true, inputType: 'checkbox' as const },
            { itemId: 'SAF-04', label: 'Site contact informed of work plan', category: 'Communication', required: false, inputType: 'checkbox' as const },
        ],
        isActive: true,
        version: 1,
    },
];

// ── AI Assistant Response ──

export const MOCK_AI_RESPONSE = {
    response: 'Based on the building type (commercial office) and 8 floors, I recommend approximately 40-50 scan positions per floor for LOD 300. The active construction on the lower floors may require additional positions to capture temporary conditions. Ensure control points are visible from multiple scan positions for optimal registration accuracy.',
};

// ── Signed URL Mocks ──

export const MOCK_SIGNED_UPLOAD_URL = {
    signedUrl: 'https://storage.googleapis.com/s2p-active-projects/UP-101/field/photo/test-upload.jpg?X-Goog-Signature=mock',
    gcsPath: 'UP-101/field/photo/test-upload.jpg',
    bucket: 's2p-active-projects',
};

export const MOCK_SIGNED_DOWNLOAD_URL = {
    url: 'https://storage.googleapis.com/s2p-active-projects/UP-101/field/scan_file/scan_floor1.e57?X-Goog-Signature=mock',
    filename: 'scan_floor1.e57',
    expiresAt: '2026-02-26T16:00:00Z',
};

export const MOCK_SIGNED_THUMBNAIL_URL = {
    url: 'https://storage.googleapis.com/s2p-active-projects/UP-101/field/photo/floor1_entry.jpg?X-Goog-Signature=mock',
    filename: 'floor1_entry.jpg',
    contentType: 'image/jpeg',
};

// ═══════════════════════════════════════════════════════════════
// PM Dashboard — Mission Control Mock Data
// ═══════════════════════════════════════════════════════════════

export const MOCK_PM_FIELD_SUMMARY = {
    projectId: 101,
    upid: 'UP-101',
    projectName: 'Downtown Office Tower',
    clientCompany: 'Acme Corp',
    projectAddress: '123 Main St, Denver, CO 80202',
    currentStage: 'field_capture',

    checklists: [
        {
            id: 4,
            slug: 'pre-scan',
            title: 'Pre-Scan Checklist',
            checklistType: 'pre_scan',
            totalItems: 8,
            completedItems: 8,
            requiredItems: 5,
            requiredCompleted: 5,
            status: 'complete',
            respondedByName: 'Mike Johnson',
            completedAt: '2026-02-26T08:15:00Z',
            updatedAt: '2026-02-26T08:15:00Z',
        },
        {
            id: 5,
            slug: 'post-scan',
            title: 'Post-Scan Checklist',
            checklistType: 'post_scan',
            totalItems: 6,
            completedItems: 1,
            requiredItems: 4,
            requiredCompleted: 1,
            status: 'in_progress',
            respondedByName: 'Mike Johnson',
            completedAt: null,
            updatedAt: '2026-02-26T16:05:00Z',
        },
        {
            id: 6,
            slug: 'safety',
            title: 'Safety Checklist',
            checklistType: 'safety',
            totalItems: 4,
            completedItems: 4,
            requiredItems: 3,
            requiredCompleted: 3,
            status: 'complete',
            respondedByName: 'Mike Johnson',
            completedAt: '2026-02-26T07:50:00Z',
            updatedAt: '2026-02-26T07:50:00Z',
        },
    ],

    uploads: {
        total: 5,
        byCategory: [
            { category: 'photo' as const, count: 2, totalBytes: '8050000' },
            { category: 'scan_file' as const, count: 2, totalBytes: '3947483648' },
            { category: 'video' as const, count: 1, totalBytes: '85000000' },
        ],
        recentUploads: MOCK_SCANTECH_DETAIL.uploads,
    },

    notes: {
        total: 2,
        recent: MOCK_SCANTECH_DETAIL.notes,
        aiAssistedCount: 1,
    },

    scopingData: MOCK_SCANTECH_DETAIL.scopingData,
    fieldCaptureData: MOCK_SCANTECH_DETAIL.stageData.field_capture,
};

// ── PM Dashboard Upload List (paginated) ──

export const MOCK_PM_UPLOADS = {
    uploads: MOCK_SCANTECH_DETAIL.uploads,
    total: 5,
    limit: 20,
    offset: 0,
};

// ── Production Projects List (for PM Dashboard context) ──

export const MOCK_PRODUCTION_PROJECTS = [
    {
        id: 101,
        scopingFormId: 201,
        upid: 'UP-101',
        currentStage: 'field_capture',
        projectName: 'Downtown Office Tower',
        clientCompany: 'Acme Corp',
        projectAddress: '123 Main St, Denver, CO 80202',
        buildingType: 'commercial_office',
        numberOfFloors: 8,
        totalSquareFootage: 45000,
        bimDeliverable: 'Revit',
        stageData: MOCK_SCANTECH_DETAIL.stageData,
        createdAt: '2026-02-20T10:00:00Z',
        updatedAt: '2026-02-26T14:30:00Z',
    },
];

// ═══════════════════════════════════════════════════════════════
// Route Interceptor — Scantech & PM Dashboard API Mocking
// ═══════════════════════════════════════════════════════════════

/**
 * Set up mock API routes for Scantech mobile E2E tests.
 * Intercepts all /api/scantech/* endpoints.
 */
export async function setupScantechMockApi(page: Page) {
    // ── Auth (reuse existing pattern) ──
    await page.route('**/api/auth/user', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            id: 1,
            email: 'mike@scan2plan.io',
            firstName: 'Mike',
            lastName: 'Johnson',
            role: 'tech',
            firebaseUid: 'tech-uid-001',
        })})
    );

    // ── Scantech Project List ──
    await page.route('**/api/scantech/projects', route => {
        const url = route.request().url();
        // If it has an ID in the path, it's a project detail request
        if (/\/projects\/\d+/.test(url)) return route.fallback();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SCANTECH_PROJECTS),
        });
    });

    // ── Scantech Project Detail ──
    await page.route('**/api/scantech/projects/101', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SCANTECH_DETAIL),
        })
    );

    // ── Checklist Templates ──
    await page.route('**/api/scantech/checklists', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_CHECKLIST_TEMPLATES),
        })
    );

    // ── Checklist Submission (POST) ──
    await page.route('**/api/scantech/projects/*/checklist', route => {
        if (route.request().method() === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, id: 99 }),
            });
        }
        return route.fallback();
    });

    // ── Upload Signed URL ──
    await page.route('**/api/scantech/projects/*/upload/signed-url', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SIGNED_UPLOAD_URL),
        })
    );

    // ── Upload Confirm ──
    await page.route('**/api/scantech/projects/*/upload/confirm', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 9999 }),
        })
    );

    // ── Field Notes (POST) ──
    await page.route('**/api/scantech/projects/*/notes', route => {
        if (route.request().method() === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        }
        return route.fallback();
    });

    // ── AI Assistant ──
    await page.route('**/api/scantech/ai/assist', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_AI_RESPONSE),
        })
    );

    // ── GCS Signed URL Intercept (prevent real GCS calls) ──
    await page.route('https://storage.googleapis.com/**', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/octet-stream',
            body: Buffer.from('mock-file-content'),
        })
    );

    // ── Catch-all for unmatched API routes ──
    await page.route('**/api/**', route => {
        const url = route.request().url();
        if (url.includes('/api/auth/') || url.includes('/api/scantech/')) {
            return route.fallback();
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
}

/**
 * Set up mock API routes for PM Dashboard desktop E2E tests.
 * Intercepts /api/pm/* and /api/production/* endpoints.
 */
export async function setupPMDashboardMockApi(page: Page) {
    // ── Auth ──
    await page.route('**/api/auth/user', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            id: 1,
            email: 'chase@scan2plan.io',
            firstName: 'Chase',
            lastName: 'Pierson',
            role: 'admin',
            firebaseUid: 'test-uid-123',
        })})
    );

    // ── PM Dashboard: Field Summary ──
    await page.route('**/api/pm/projects/101/field-summary', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_PM_FIELD_SUMMARY),
        })
    );

    // ── PM Dashboard: Uploads List ──
    await page.route('**/api/pm/projects/101/uploads', route => {
        const url = route.request().url();
        // If it has an uploadId, it's a download/thumbnail request
        if (/\/uploads\/\d+/.test(url)) return route.fallback();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_PM_UPLOADS),
        });
    });

    // ── PM Dashboard: Download URL ──
    await page.route('**/api/pm/projects/*/uploads/*/download', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SIGNED_DOWNLOAD_URL),
        })
    );

    // ── PM Dashboard: Thumbnail URL ──
    await page.route('**/api/pm/projects/*/uploads/*/thumbnail', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SIGNED_THUMBNAIL_URL),
        })
    );

    // ── Production Project Detail (for ProductionDetail page) ──
    await page.route('**/api/production/projects/101', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_PRODUCTION_PROJECTS[0]),
        })
    );

    // ── Production Project List ──
    await page.route('**/api/production/projects', route => {
        const url = route.request().url();
        if (/\/projects\/\d+/.test(url)) return route.fallback();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_PRODUCTION_PROJECTS),
        });
    });

    // ── GCS Signed URL Intercept ──
    await page.route('https://storage.googleapis.com/**', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/octet-stream',
            body: Buffer.from('mock-file-content'),
        })
    );

    // ── Catch-all for unmatched API routes ──
    await page.route('**/api/**', route => {
        const url = route.request().url();
        if (url.includes('/api/auth/') || url.includes('/api/pm/') || url.includes('/api/production/')) {
            return route.fallback();
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
}

/**
 * Bypass Firebase auth for Scantech (field tech user).
 */
export async function bypassFirebaseAuthScantech(page: Page) {
    await page.addInitScript(() => {
        (window as any).__E2E_AUTH_USER__ = {
            id: 1,
            email: 'mike@scan2plan.io',
            firstName: 'Mike',
            lastName: 'Johnson',
            role: 'tech',
            profileImageUrl: '',
        };
        localStorage.setItem('s2px-tour-completed', 'true');
    });
}

/**
 * Bypass Firebase auth for PM Dashboard (admin user).
 */
export async function bypassFirebaseAuthPM(page: Page) {
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
