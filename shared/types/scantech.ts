// ── Scantech Types (Phase 18) ──
// Shared interfaces for the mobile field operations app.

// ── Checklist Types ──

export interface ChecklistItemDef {
    itemId: string;           // 'PRE-01', 'POST-01', 'SAF-01'
    label: string;            // "Scanner batteries charged"
    category: string;         // "Equipment", "Safety", "Site Prep"
    required: boolean;        // hard-gate item?
    helpText?: string;        // optional hint for tech
    inputType: 'checkbox' | 'text' | 'number' | 'photo';
}

export interface ChecklistResponse {
    itemId: string;
    checked: boolean;
    value?: string | number;
    photoUrl?: string;
    note?: string;
    completedAt?: string;     // ISO timestamp
}

export interface ChecklistTemplate {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    checklistType: string;    // pre_scan | post_scan | safety | custom
    items: ChecklistItemDef[];
    isActive: boolean;
    version: number;
}

export interface ChecklistSubmission {
    id: number;
    checklistId: number;
    checklistTitle: string;
    checklistSlug: string;
    checklistType: string;
    status: string;           // in_progress | complete | flagged
    responses: ChecklistResponse[];
    completedAt: string | null;
    respondedByName: string | null;
    createdAt: string;
    updatedAt: string;
}

// ── Upload Types ──

export type FileCategory = 'photo' | 'video' | 'scan_file' | 'document';
export type CaptureMethod = 'camera' | 'file_picker' | 'trimble_import';

export interface FieldUploadRecord {
    id: number;
    productionProjectId: number;
    filename: string;
    gcsPath: string;
    bucket: string;
    sizeBytes: string;
    contentType: string | null;
    fileCategory: FileCategory;
    captureMethod: CaptureMethod | null;
    metadata: Record<string, unknown> | null;
    notes: string | null;
    createdAt: string;
    uploadedByName?: string;
}

// ── Field Notes ──

export interface FieldNote {
    id: string;               // UUID
    content: string;
    createdAt: string;
    updatedAt: string;
    aiAssisted: boolean;
    category?: 'general' | 'site_condition' | 'issue' | 'photo_analysis';
}

// ── Project List ──

export interface ScantechProject {
    id: number;
    scopingFormId: number;
    upid: string;
    currentStage: string;
    projectName: string | null;
    clientCompany: string | null;
    projectAddress: string | null;
    projectLat: string | null;
    projectLng: string | null;
    buildingFootprintSqft: number | null;
    buildingType: string | null;
    uploadCount: number;
    checklistProgress: {
        total: number;
        completed: number;
    };
    updatedAt: string;
}

// ── Scoping Snapshot (read-only for Scoping tab) ──

export interface ScantechScopingSnapshot {
    clientCompany: string;
    projectName: string;
    projectAddress: string;
    email: string;
    primaryContactName: string;
    contactPhone: string | null;
    numberOfFloors: number;
    basementAttic: string[] | null;
    bimDeliverable: string;
    bimVersion: string | null;
    georeferencing: boolean;
    era: string;
    roomDensity: number;
    riskFactors: string[];
    dispatchLocation: string;
    oneWayMiles: number;
    travelMode: string;
    pricingTier: string | null;
    estScanDays: number | null;
    techsPlanned: number | null;
    landscapeModeling: string | null;
    scanRegOnly: string | null;
    expedited: boolean;
    estTimeline: string | null;
    paymentTerms: string | null;
    internalNotes: string | null;
    areas: {
        id: number;
        areaType: string;
        areaName: string | null;
        squareFootage: number;
        projectScope: string;
        lod: string;
    }[];
}

// ── Full Project Detail ──

export interface ScantechProjectDetail {
    id: number;
    scopingFormId: number;
    upid: string;
    currentStage: string;
    stageData: Record<string, Record<string, unknown>>;
    scopingData: ScantechScopingSnapshot;
    checklists: ChecklistSubmission[];
    uploads: FieldUploadRecord[];
    notes: FieldNote[];
    projectLat: string | null;
    projectLng: string | null;
    buildingFootprintSqft: number | null;
    updatedAt: string;
}

// ── AI Types ──

export type ScantechAIIntent = 'chat' | 'photo_analysis' | 'audio_to_scoping' | 'checklist_validate';

export interface ScantechAIRequest {
    intent: ScantechAIIntent;
    message: string;
    context?: {
        projectId?: number;
        photoBase64?: string;      // for photo_analysis
        buildingType?: string;
        riskFactors?: string[];
        checklistResponses?: ChecklistResponse[];  // for checklist_validate
    };
    history?: { role: 'user' | 'model'; text: string }[];
}

export interface ScantechAIResponse {
    response: string;
    suggestedItems?: ChecklistItemDef[];   // for checklist intelligence
    scopingUpdates?: Record<string, unknown>; // for audio_to_scoping
    validationResult?: {
        passed: boolean;
        missingItems: string[];
        warnings: string[];
    };
}
