// ── Production Pipeline Types ──
// Stage definitions, field schemas per stage, and prefill cascade declarations.

import type { ProductionStage } from '../schema/constants';

// ── Stage Metadata ──

export interface StageConfig {
    id: ProductionStage;
    label: string;
    shortLabel: string;
    color: string; // tailwind color class suffix
    order: number;
}

export const STAGE_CONFIGS: StageConfig[] = [
    { id: 'scheduling', label: 'Scheduling', shortLabel: 'SCH', color: 'slate', order: 0 },
    { id: 'field_capture', label: 'Field Capture', shortLabel: 'FC', color: 'blue', order: 1 },
    { id: 'registration', label: 'Registration', shortLabel: 'RG', color: 'indigo', order: 2 },
    { id: 'bim_qc', label: 'BIM QC', shortLabel: 'BQ', color: 'violet', order: 3 },
    { id: 'pc_delivery', label: 'PC Delivery', shortLabel: 'PD', color: 'amber', order: 4 },
    { id: 'final_delivery', label: 'Final Delivery', shortLabel: 'DR', color: 'emerald', order: 5 },
];

export function getStageConfig(stage: ProductionStage): StageConfig {
    return STAGE_CONFIGS.find(s => s.id === stage) ?? STAGE_CONFIGS[0];
}

export function getNextStage(current: ProductionStage): ProductionStage | null {
    const config = getStageConfig(current);
    const next = STAGE_CONFIGS.find(s => s.order === config.order + 1);
    return next?.id ?? null;
}

// ── Stage Data Shapes ──
// Each stage stores its fields as JSON in production_projects.stage_data

export interface FieldCaptureData {
    // Prefilled from scoping
    projectCode: string;        // FC-01 ← SF-54
    address: string;            // FC-02 ← SF-01
    estSF: number;              // FC-06 ← SF-03
    scope: string[];            // FC-07 ← SF-04 (transform: dropdown → checkbox array)
    floors: number;             // FC-08 ← SF-31
    estScans: number;           // FC-09 ← derived calc
    baseLocation: string;       // FC-18 ← SF-32
    era: string;                // FC-22 ← SF-41
    density: number;            // FC-23 ← SF-42
    buildingType: string;       // FC-24 ← SF-02
    scanDays: number | null;    // FC-31 ← SF-48
    numTechs: number | null;    // FC-32 ← SF-49
    pricingTier: string | null; // FC-33 ← SF-45
    actPresent: boolean;        // FC-35 ← SF-24 (transform: Y/N+sqft → Y/N)
    belowFloor: boolean;        // FC-36 ← SF-44 (transform: Y/N+sqft → Y/N)

    // Tech fills on-site
    fieldDate: string | null;       // FC-03
    fieldTech: string | null;       // FC-04
    scannerSN: string | null;       // FC-05
    rooms: number | null;           // FC-10
    hoursScanned: number | null;    // FC-11
    hoursDelayed: number | null;    // FC-12
    fieldRMS: number | null;        // FC-13 (≤5mm hard gate)
    avgOverlap: number | null;      // FC-14 (≥50% hard gate)
    fieldSignOff: string | null;    // FC-15 (Pass/Conditional/Rejected)
    hoursTraveled: number | null;   // FC-16
    milesDriven: number | null;     // FC-17
    hotelPerDiem: number | null;    // FC-19
    tollsParking: number | null;    // FC-20
    otherFieldCosts: number | null; // FC-21
    hrsScannedInt: number | null;   // FC-25
    hrsScannedExt: number | null;   // FC-26
    hrsScannedLandscape: number | null; // FC-27
    scanPtsInt: number | null;      // FC-28
    scanPtsExt: number | null;      // FC-29
    scanPtsLandscape: number | null;    // FC-30
    actualObservedSF: number | null;    // FC-34
    siteConditionsConfirmed: string[] | null; // FC-37
    scanMetricsHandoff: string[] | null;     // FC-38
}

export interface RegistrationData {
    // Prefilled
    projectCode: string;        // RG-01 ← chain SF-54
    projectName: string;        // RG-02 ← SF-53
    estSF: number;              // RG-03 ← chain SF-03
    fieldTech: string | null;   // RG-05 ← FC-04
    fieldDate: string | null;   // RG-06 ← FC-03
    cloudLoA: string;           // RG-08 ← static default "LoA-40"
    modelLoD: string;           // RG-09 ← SF-05
    platform: string;           // RG-10 ← SF-11
    geoRefTier: string | null;  // RG-13 ← SF-56 (transform)
    fieldRMS: number | null;    // carried from FC-13

    // Manual (operator fills)
    scanCount: number | null;   // RG-04
    software: string | null;    // RG-07

    // Operator fills
    regTech: string | null;
    regDate: string | null;
    regRMS: number | null;
    regSignOff: string | null;
}

export interface BimQcData {
    // Prefilled
    projectName: string;        // BQ-01 ← chain SF-53
    projectCode: string;        // BQ-15 ← chain SF-54
    estSF: number;              // BQ-03 ← chain SF-03
    georeferenced: boolean;     // BQ-11 ← RG-13 (transform: Tier 20/60 → Y, Tier 0 → N)
    modelLoD: string;           // BQ-12 ← chain SF-05
    revitVersion: string | null; // BQ-13 ← SF-28
    scopeDiscipline: string[];  // BQ-14 ← SF-07 + SF-08 (transform: Y/N → checkbox)

    // QC fills
    actualSF: number | null;    // BQ-04
    qcTech: string | null;
    qcDate: string | null;
    qcStatus: string | null;    // Pass / Fail / Conditional
    qcNotes: string | null;
}

export interface PcDeliveryData {
    // Prefilled
    projectCode: string;        // PD-01 ← chain SF-54
    client: string;             // PD-02 ← chain SF-37
    projectName: string;        // PD-03 ← chain SF-53
    deliverySF: number;         // PD-04 ← BQ-04 (actual, preferred) or SF-03
    projectTier: string;        // PD-09 ← calc from SF-03 (<10K=Minnow, 10-50K=Dolphin, ≥50K=Whale)
    geoRefTier: string | null;  // PD-10 ← RG-13
    platform: string;           // PD-12 ← RG-10
    securityTier: string | null; // PD-11 ← SF-60 (BLOCKED — not built yet)

    // Delivery fills
    deliveryDate: string | null;
    deliveredBy: string | null;
    deliveryNotes: string | null;
}

export interface FinalDeliveryData {
    // Prefilled
    projectCode: string;        // DR-01 ← chain PD-01
    client: string;             // DR-02 ← chain PD-02
    projectName: string;        // DR-03 ← chain PD-03
    deliverySF: number;         // DR-04 ← BQ-04 (actual)
    scopeTier: string;          // DR-09 ← same calc as PD-09
    disciplines: string[];      // DR-10 ← chain BQ-14
    formats: string[];          // DR-11 ← SF-10 + SF-11 (transform: CAD+BIM → format list)

    // Final delivery fills
    finalDeliveryDate: string | null;
    clientSignOff: string | null;
    finalNotes: string | null;
}

// Union type for stageData JSON
export type StageData = {
    scheduling: Record<string, never>; // scheduling stage has no separate data — it IS the scoping form
    field_capture: FieldCaptureData;
    registration: RegistrationData;
    bim_qc: BimQcData;
    pc_delivery: PcDeliveryData;
    final_delivery: FinalDeliveryData;
};

// ── Prefill Cascade Declarations ──

export type PrefillType = 'direct' | 'chain' | 'transform' | 'calculation' | 'static' | 'manual' | 'blocked';

export interface PrefillMapping {
    /** Target field ID (e.g., "FC-01") */
    targetId: string;
    /** Target field path in stageData (e.g., "projectCode") */
    targetField: string;
    /** Source field ID (e.g., "SF-54") */
    sourceId: string;
    /** Stage transition this applies to */
    transition: `${ProductionStage}_to_${ProductionStage}`;
    /** How the value is derived */
    type: PrefillType;
    /** Human description for UI display */
    description: string;
    /**
     * For transforms/calculations: the function name to apply.
     * Resolved at runtime by the prefill engine.
     */
    transformKey?: string;
}

// ── Production Project (full shape returned to frontend) ──

export interface ProductionProject {
    id: number;
    scopingFormId: number;
    upid: string;
    currentStage: ProductionStage;
    stageData: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    // Joined fields for display
    projectName?: string;
    clientCompany?: string;
    projectAddress?: string;
}
