// ── Prefill Cascade Engine ──
// 49 declarative mappings across 5 stage transitions.
// Pure functions — no DB access. Used by both server (advance route) and client (preview).

import type { ProductionStage } from '../schema/constants';
import type { PrefillMapping, StageData } from '../types/production';

// ── All 49 Prefill Mappings ──

export const PREFILL_MAPPINGS: PrefillMapping[] = [
    // ═══════════════════════════════════════════
    // Scheduling → Field Capture (15 prefills)
    // ═══════════════════════════════════════════
    { targetId: 'FC-01', targetField: 'projectCode',  sourceId: 'SF-54', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Project Code (UPID)' },
    { targetId: 'FC-02', targetField: 'address',       sourceId: 'SF-01', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Project Address' },
    { targetId: 'FC-06', targetField: 'estSF',         sourceId: 'SF-03', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Estimated Square Footage' },
    { targetId: 'FC-07', targetField: 'scope',         sourceId: 'SF-04', transition: 'scheduling_to_field_capture', type: 'transform',   description: 'Scope (dropdown → checkbox array)', transformKey: 'scopeToCheckboxArray' },
    { targetId: 'FC-08', targetField: 'floors',        sourceId: 'SF-31', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Number of Floors' },
    { targetId: 'FC-09', targetField: 'estScans',      sourceId: 'SF-03', transition: 'scheduling_to_field_capture', type: 'calculation', description: 'Est. Scans (ScansPerKSF × SF/1000)', transformKey: 'calcEstScans' },
    { targetId: 'FC-18', targetField: 'baseLocation',  sourceId: 'SF-32', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Base / Dispatch Location' },
    { targetId: 'FC-22', targetField: 'era',           sourceId: 'SF-41', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Era (Modern/Historic)' },
    { targetId: 'FC-23', targetField: 'density',       sourceId: 'SF-42', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Room Density (0-4)' },
    { targetId: 'FC-24', targetField: 'buildingType',  sourceId: 'SF-02', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Building Type' },
    { targetId: 'FC-31', targetField: 'scanDays',      sourceId: 'SF-48', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Est. Scan Days (CEO)' },
    { targetId: 'FC-32', targetField: 'numTechs',      sourceId: 'SF-49', transition: 'scheduling_to_field_capture', type: 'direct',      description: '# Techs Planned (CEO)' },
    { targetId: 'FC-33', targetField: 'pricingTier',   sourceId: 'SF-45', transition: 'scheduling_to_field_capture', type: 'direct',      description: 'Pricing Tier (CEO)' },
    { targetId: 'FC-35', targetField: 'actPresent',    sourceId: 'SF-24', transition: 'scheduling_to_field_capture', type: 'transform',   description: 'ACT Present (Y/N+sqft → Y/N)', transformKey: 'toggleSqftToBoolean' },
    { targetId: 'FC-36', targetField: 'belowFloor',    sourceId: 'SF-44', transition: 'scheduling_to_field_capture', type: 'transform',   description: 'Below Floor (Y/N+sqft → Y/N)', transformKey: 'toggleSqftToBoolean' },

    // ═══════════════════════════════════════════
    // Field Capture → Registration (12 prefills)
    // ═══════════════════════════════════════════
    { targetId: 'RG-01', targetField: 'projectCode',  sourceId: 'SF-54', transition: 'field_capture_to_registration', type: 'chain',    description: 'Project Code (chain from SSOT)' },
    { targetId: 'RG-02', targetField: 'projectName',  sourceId: 'SF-53', transition: 'field_capture_to_registration', type: 'chain',    description: 'Project Name (chain from SSOT)' },
    { targetId: 'RG-03', targetField: 'estSF',        sourceId: 'SF-03', transition: 'field_capture_to_registration', type: 'chain',    description: 'Square Footage (chain)' },
    { targetId: 'RG-05', targetField: 'fieldTech',    sourceId: 'FC-04', transition: 'field_capture_to_registration', type: 'direct',   description: 'Field Tech (from FC)' },
    { targetId: 'RG-06', targetField: 'fieldDate',    sourceId: 'FC-03', transition: 'field_capture_to_registration', type: 'direct',   description: 'Field Date (from FC)' },
    { targetId: 'RG-08', targetField: 'cloudLoA',     sourceId: '',      transition: 'field_capture_to_registration', type: 'static',   description: 'Cloud LoA (default LoA-40)', transformKey: 'staticLoA40' },
    { targetId: 'RG-09', targetField: 'modelLoD',     sourceId: 'SF-05', transition: 'field_capture_to_registration', type: 'direct',   description: 'Model LoD' },
    { targetId: 'RG-10', targetField: 'platform',     sourceId: 'SF-11', transition: 'field_capture_to_registration', type: 'direct',   description: 'BIM Platform (Revit/ArchiCAD/etc)' },
    { targetId: 'RG-13', targetField: 'geoRefTier',   sourceId: 'SF-09', transition: 'field_capture_to_registration', type: 'transform', description: 'GeoRef Tier (georef toggle → tier)', transformKey: 'georefToTier' },
    { targetId: 'RG-04', targetField: 'scanCount',    sourceId: '',      transition: 'field_capture_to_registration', type: 'manual',   description: 'Scan Count (manual — counted in studio)' },
    { targetId: 'RG-07', targetField: 'software',     sourceId: '',      transition: 'field_capture_to_registration', type: 'manual',   description: 'Registration Software (manual — operator choice)' },
    { targetId: '',       targetField: 'fieldRMS',     sourceId: 'FC-13', transition: 'field_capture_to_registration', type: 'direct',   description: 'Field RMS (carried for verification)' },

    // ═══════════════════════════════════════════
    // Registration → BIM QC (7 prefills)
    // ═══════════════════════════════════════════
    { targetId: 'BQ-01', targetField: 'projectName',     sourceId: 'SF-53', transition: 'registration_to_bim_qc', type: 'chain',     description: 'Project Name (chain)' },
    { targetId: 'BQ-15', targetField: 'projectCode',     sourceId: 'SF-54', transition: 'registration_to_bim_qc', type: 'chain',     description: 'Project Code (chain)' },
    { targetId: 'BQ-03', targetField: 'estSF',           sourceId: 'SF-03', transition: 'registration_to_bim_qc', type: 'chain',     description: 'Estimated SF (chain)' },
    { targetId: 'BQ-11', targetField: 'georeferenced',   sourceId: 'RG-13', transition: 'registration_to_bim_qc', type: 'transform', description: 'Georeferenced (Tier 20/60 → Y, Tier 0 → N)', transformKey: 'geoRefTierToBoolean' },
    { targetId: 'BQ-12', targetField: 'modelLoD',        sourceId: 'SF-05', transition: 'registration_to_bim_qc', type: 'chain',     description: 'Model LoD (chain)' },
    { targetId: 'BQ-13', targetField: 'revitVersion',    sourceId: 'SF-28', transition: 'registration_to_bim_qc', type: 'direct',    description: 'Revit Version (if populated)' },
    { targetId: 'BQ-14', targetField: 'scopeDiscipline', sourceId: 'SF-07+SF-08', transition: 'registration_to_bim_qc', type: 'transform', description: 'Scope Disciplines (Y/N → checkbox array)', transformKey: 'disciplinesToArray' },

    // ═══════════════════════════════════════════
    // BIM QC → PC Delivery (8 prefills)
    // ═══════════════════════════════════════════
    { targetId: 'PD-01', targetField: 'projectCode',  sourceId: 'SF-54',    transition: 'bim_qc_to_pc_delivery', type: 'chain',       description: 'Project Code (chain)' },
    { targetId: 'PD-02', targetField: 'client',       sourceId: 'SF-37',    transition: 'bim_qc_to_pc_delivery', type: 'chain',       description: 'Client Company (chain)' },
    { targetId: 'PD-03', targetField: 'projectName',  sourceId: 'SF-53',    transition: 'bim_qc_to_pc_delivery', type: 'chain',       description: 'Project Name (chain)' },
    { targetId: 'PD-04', targetField: 'deliverySF',   sourceId: 'BQ-04|SF-03', transition: 'bim_qc_to_pc_delivery', type: 'calculation', description: 'SF (prefer actual BQ-04, fallback SF-03)', transformKey: 'preferActualSF' },
    { targetId: 'PD-09', targetField: 'projectTier',  sourceId: 'SF-03',    transition: 'bim_qc_to_pc_delivery', type: 'calculation', description: 'Project Tier (<10K=Minnow, 10-50K=Dolphin, ≥50K=Whale)', transformKey: 'calcProjectTier' },
    { targetId: 'PD-10', targetField: 'geoRefTier',   sourceId: 'RG-13',    transition: 'bim_qc_to_pc_delivery', type: 'direct',      description: 'GeoRef Tier (from Registration)' },
    { targetId: 'PD-12', targetField: 'platform',     sourceId: 'RG-10',    transition: 'bim_qc_to_pc_delivery', type: 'direct',      description: 'BIM Platform (from Registration)' },
    { targetId: 'PD-11', targetField: 'securityTier', sourceId: 'SF-60',    transition: 'bim_qc_to_pc_delivery', type: 'blocked',     description: 'Security Tier (BLOCKED — SF-60 not built yet)' },

    // ═══════════════════════════════════════════
    // PC Delivery → Final Delivery (7 prefills)
    // ═══════════════════════════════════════════
    { targetId: 'DR-01', targetField: 'projectCode',  sourceId: 'PD-01',    transition: 'pc_delivery_to_final_delivery', type: 'chain',       description: 'Project Code (chain)' },
    { targetId: 'DR-02', targetField: 'client',       sourceId: 'PD-02',    transition: 'pc_delivery_to_final_delivery', type: 'chain',       description: 'Client (chain)' },
    { targetId: 'DR-03', targetField: 'projectName',  sourceId: 'PD-03',    transition: 'pc_delivery_to_final_delivery', type: 'chain',       description: 'Project Name (chain)' },
    { targetId: 'DR-04', targetField: 'deliverySF',   sourceId: 'BQ-04|SF-03', transition: 'pc_delivery_to_final_delivery', type: 'calculation', description: 'SF (prefer actual BQ-04)', transformKey: 'preferActualSF' },
    { targetId: 'DR-09', targetField: 'scopeTier',    sourceId: 'SF-03',    transition: 'pc_delivery_to_final_delivery', type: 'calculation', description: 'Scope Tier (same calc as PD-09)', transformKey: 'calcProjectTier' },
    { targetId: 'DR-10', targetField: 'disciplines',  sourceId: 'BQ-14',    transition: 'pc_delivery_to_final_delivery', type: 'chain',       description: 'Disciplines (chain from BQ)' },
    { targetId: 'DR-11', targetField: 'formats',      sourceId: 'SF-10+SF-11', transition: 'pc_delivery_to_final_delivery', type: 'transform', description: 'Formats (CAD+BIM → format list)', transformKey: 'cadBimToFormats' },
];

// ── Source Field Resolvers ──
// Maps SF field IDs to their location in scoping form / areas / stageData

interface ScopingFormLike {
    upid: string;
    projectAddress: string;
    projectName: string;
    clientCompany: string;
    numberOfFloors: number;
    dispatchLocation: string;
    era: string;
    roomDensity: number;
    estScanDays: number | null;
    techsPlanned: number | null;
    pricingTier: string | null;
    lod?: string;              // from first area
    bimDeliverable: string;
    bimVersion: string | null;
    georeferencing: boolean;
    cadDeliverable?: string;   // from first area
    areas: ScopeAreaLike[];
}

interface ScopeAreaLike {
    areaType: string;
    squareFootage: number;
    projectScope: string;
    lod: string;
    cadDeliverable?: string;
    structural: { enabled: boolean; sqft?: number } | null;
    mepf: { enabled: boolean; sqft?: number } | null;
    act: { enabled: boolean; sqft?: number } | null;
    belowFloor: { enabled: boolean; sqft?: number } | null;
}

// Resolve a source field ID to its value from the scoping form or any previous stage data.
// allStageData is keyed by stage name → { fieldKey: value }.
function resolveSourceField(
    fieldId: string,
    form: ScopingFormLike,
    allStageData: Record<string, Record<string, unknown>>,
): unknown {
    // Aggregate area values (use first area for area-level fields, sum for SF)
    const firstArea = form.areas[0];
    const totalSF = form.areas.reduce((sum, a) => sum + (a.squareFootage || 0), 0);

    // Helper: read a field from a specific stage's data
    const fromStage = (stage: string, field: string, fallback?: unknown) =>
        allStageData[stage]?.[field] ?? fallback ?? null;

    const resolvers: Record<string, () => unknown> = {
        'SF-54': () => form.upid,
        'SF-53': () => form.projectName,
        'SF-37': () => form.clientCompany,
        'SF-01': () => form.projectAddress,
        'SF-02': () => firstArea?.areaType ?? '',
        'SF-03': () => totalSF,
        'SF-04': () => firstArea?.projectScope ?? '',
        'SF-05': () => firstArea?.lod ?? form.lod ?? '',
        'SF-07': () => firstArea?.structural ?? null,
        'SF-08': () => firstArea?.mepf ?? null,
        'SF-09': () => form.georeferencing,
        'SF-10': () => firstArea?.cadDeliverable ?? form.cadDeliverable ?? 'No',
        'SF-11': () => form.bimDeliverable,
        'SF-24': () => firstArea?.act ?? null,
        'SF-28': () => form.bimVersion,
        'SF-31': () => form.numberOfFloors,
        'SF-32': () => form.dispatchLocation,
        'SF-41': () => form.era,
        'SF-42': () => form.roomDensity,
        'SF-44': () => firstArea?.belowFloor ?? null,
        'SF-45': () => form.pricingTier,
        'SF-48': () => form.estScanDays,
        'SF-49': () => form.techsPlanned,
        'SF-56': () => form.georeferencing, // georef toggle — transformed downstream
        'SF-60': () => null, // BLOCKED — not built yet

        // Previous stage fields — read from the stage where they were originally created
        'FC-03': () => fromStage('field_capture', 'fieldDate'),
        'FC-04': () => fromStage('field_capture', 'fieldTech'),
        'FC-13': () => fromStage('field_capture', 'fieldRMS'),
        'RG-10': () => fromStage('registration', 'platform'),
        'RG-13': () => fromStage('registration', 'geoRefTier'),
        'BQ-04': () => fromStage('bim_qc', 'actualSF'),
        'BQ-14': () => fromStage('bim_qc', 'scopeDiscipline', []),
        'PD-01': () => fromStage('pc_delivery', 'projectCode', form.upid),
        'PD-02': () => fromStage('pc_delivery', 'client', form.clientCompany),
        'PD-03': () => fromStage('pc_delivery', 'projectName', form.projectName),
    };

    // Handle composite source IDs like "SF-07+SF-08" or "BQ-04|SF-03"
    if (fieldId.includes('+')) {
        const parts = fieldId.split('+');
        return parts.map(id => resolvers[id.trim()]?.() ?? null);
    }
    if (fieldId.includes('|')) {
        // Prefer first, fallback to second
        const [primary, fallback] = fieldId.split('|');
        const primaryVal = resolvers[primary.trim()]?.();
        if (primaryVal !== null && primaryVal !== undefined) return primaryVal;
        return resolvers[fallback.trim()]?.() ?? null;
    }

    return resolvers[fieldId]?.() ?? null;
}

// ── Transform Functions ──

// Scans per KSF lookup — approximate values based on building complexity
const SCANS_PER_KSF: Record<number, number> = {
    0: 3,   // Wide Open
    1: 5,   // Spacious
    2: 8,   // Standard
    3: 12,  // Dense
    4: 18,  // Extreme
};

export const TRANSFORM_FUNCTIONS: Record<string, (value: unknown, form: ScopingFormLike, prevStageData: Record<string, unknown> | null) => unknown> = {
    // FC-07: Scope dropdown → checkbox array
    scopeToCheckboxArray: (value) => {
        const scope = value as string;
        if (scope === 'Full') return ['Interior', 'Exterior'];
        if (scope === 'Int Only') return ['Interior'];
        if (scope === 'Ext Only') return ['Exterior'];
        if (scope === 'Mixed') return ['Interior', 'Exterior', 'Mixed'];
        return [scope];
    },

    // FC-09: Estimated scan positions = (ScansPerKSF × totalSF) / 1000
    calcEstScans: (_value, form) => {
        const totalSF = form.areas.reduce((sum, a) => sum + (a.squareFootage || 0), 0);
        const density = form.roomDensity ?? 2;
        const scansPerKSF = SCANS_PER_KSF[density] ?? 8;
        return Math.ceil((scansPerKSF * totalSF) / 1000);
    },

    // FC-35, FC-36: { enabled: boolean, sqft?: number } → boolean
    toggleSqftToBoolean: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'object' && value !== null && 'enabled' in value) {
            return (value as { enabled: boolean }).enabled;
        }
        return Boolean(value);
    },

    // RG-08: Static default
    staticLoA40: () => 'LoA-40',

    // RG-13: Georeferencing toggle → tier string
    georefToTier: (value) => {
        if (value === true) return 'Tier-20';
        if (value === false || value === null) return 'Tier-0';
        return String(value);
    },

    // BQ-11: GeoRef tier → boolean (Tier 20 or 60 → Y, Tier 0 → N)
    geoRefTierToBoolean: (value) => {
        const tier = String(value ?? '');
        return tier === 'Tier-20' || tier === 'Tier-60';
    },

    // BQ-14: Structural + MEPF toggles → discipline array
    disciplinesToArray: (value) => {
        const [structural, mepf] = value as [
            { enabled: boolean } | null,
            { enabled: boolean } | null,
        ];
        const disciplines: string[] = ['Architecture']; // always present
        if (structural?.enabled) disciplines.push('Structural');
        if (mepf?.enabled) disciplines.push('MEPF');
        return disciplines;
    },

    // PD-04, DR-04: Prefer actual SF from BQ-04, fallback to estimated
    preferActualSF: (value) => {
        // value comes from resolveSourceField with "|" handling —
        // already resolved to the preferred value
        return typeof value === 'number' ? value : 0;
    },

    // PD-09, DR-09: Project tier from total SF
    calcProjectTier: (value) => {
        const sf = Number(value) || 0;
        if (sf >= 50000) return 'Whale';
        if (sf >= 10000) return 'Dolphin';
        return 'Minnow';
    },

    // DR-11: CAD deliverable + BIM platform → format list
    cadBimToFormats: (value) => {
        const [cad, bim] = value as [string, string];
        const formats: string[] = [];
        if (bim && bim !== 'Other') formats.push(bim);
        if (cad && cad !== 'No') formats.push(`CAD (${cad})`);
        return formats;
    },
};

// ── Core Engine ──

export interface PrefillResult {
    field: string;
    value: unknown;
    mapping: PrefillMapping;
    skipped: boolean;
    skipReason?: string;
}

/**
 * Execute the prefill cascade for a given stage transition.
 * Returns a partial stageData object for the target stage.
 */
export function executePrefillCascade(
    fromStage: ProductionStage,
    toStage: ProductionStage,
    form: ScopingFormLike,
    allStageData: Record<string, Record<string, unknown>>,
): { data: Record<string, unknown>; results: PrefillResult[] } {
    const transitionKey = `${fromStage}_to_${toStage}`;
    const mappings = PREFILL_MAPPINGS.filter(m => m.transition === transitionKey);

    const data: Record<string, unknown> = {};
    const results: PrefillResult[] = [];

    for (const mapping of mappings) {
        // Skip blocked and manual fields
        if (mapping.type === 'blocked') {
            results.push({
                field: mapping.targetField,
                value: null,
                mapping,
                skipped: true,
                skipReason: 'Blocked — upstream field not built yet',
            });
            continue;
        }

        if (mapping.type === 'manual') {
            results.push({
                field: mapping.targetField,
                value: null,
                mapping,
                skipped: true,
                skipReason: 'Manual entry required',
            });
            continue;
        }

        // Resolve source value — resolver has access to ALL stage data, not just the previous stage
        let sourceValue = resolveSourceField(mapping.sourceId, form, allStageData);

        // For chain types, we also look through all previous stage data
        if (mapping.type === 'chain') {
            // Try to resolve from SSOT (scoping form) first, which resolveSourceField already does
            // For fields that chain through previous stages, check stageData too
            if (sourceValue === null || sourceValue === undefined) {
                for (const stageKey of Object.keys(allStageData)) {
                    const stageFields = allStageData[stageKey];
                    if (stageFields && mapping.targetField in stageFields) {
                        sourceValue = stageFields[mapping.targetField];
                        break;
                    }
                }
            }
        }

        // Apply transform if needed
        if (mapping.transformKey && TRANSFORM_FUNCTIONS[mapping.transformKey]) {
            sourceValue = TRANSFORM_FUNCTIONS[mapping.transformKey](sourceValue, form, allStageData[fromStage] ?? null);
        }

        data[mapping.targetField] = sourceValue;
        results.push({
            field: mapping.targetField,
            value: sourceValue,
            mapping,
            skipped: false,
        });
    }

    return { data, results };
}

/**
 * Get all mappings for a given transition (for UI preview).
 */
export function getMappingsForTransition(
    fromStage: ProductionStage,
    toStage: ProductionStage,
): PrefillMapping[] {
    const transitionKey = `${fromStage}_to_${toStage}`;
    return PREFILL_MAPPINGS.filter(m => m.transition === transitionKey);
}

/**
 * Count mappings by type for a given transition.
 */
export function getMappingSummary(fromStage: ProductionStage, toStage: ProductionStage) {
    const mappings = getMappingsForTransition(fromStage, toStage);
    const counts: Record<string, number> = {};
    for (const m of mappings) {
        counts[m.type] = (counts[m.type] || 0) + 1;
    }
    return { total: mappings.length, byType: counts };
}
