// ── Zod Validation Schemas for API Requests ──
import { z } from 'zod';
import {
    BUILDING_TYPES,
    PROJECT_SCOPES,
    LOD_LEVELS,
    CAD_OPTIONS,
    DEAL_STAGES,
    LEAD_SOURCES,
    ERAS,
    RISK_FACTORS,
    DISPATCH_LOCATIONS,
    TRAVEL_MODES,
    BIM_DELIVERABLES,
} from './constants.js';

// Helper for enum-like string unions
const stringEnum = <T extends readonly string[]>(values: T) =>
    z.enum(values as unknown as [string, ...string[]]);

// ── Scope Area (Section D) ──
export const scopeAreaSchema = z.object({
    areaType: stringEnum(BUILDING_TYPES),
    areaName: z.string().optional(),
    squareFootage: z.number().int().positive(),
    projectScope: stringEnum(PROJECT_SCOPES),
    lod: stringEnum(LOD_LEVELS),
    mixedInteriorLod: stringEnum(LOD_LEVELS).optional(),
    mixedExteriorLod: stringEnum(LOD_LEVELS).optional(),
    structural: z.object({ enabled: z.boolean(), sqft: z.number().int().optional() }).optional(),
    mepf: z.object({ enabled: z.boolean(), sqft: z.number().int().optional() }).optional(),
    cadDeliverable: stringEnum(CAD_OPTIONS),
    act: z.object({ enabled: z.boolean(), sqft: z.number().int().optional() }).optional(),
    belowFloor: z.object({ enabled: z.boolean(), sqft: z.number().int().optional() }).optional(),
    customLineItems: z.array(z.object({
        description: z.string(),
        amount: z.number(),
    })).optional(),
    sortOrder: z.number().int().optional(),
});

// ── Scoping Form (create) ──
export const createScopingFormSchema = z.object({
    // Section A
    clientCompany: z.string().min(1),
    projectName: z.string().min(1),
    projectAddress: z.string().min(1),
    specificBuilding: z.string().optional(),
    email: z.string().email(),

    // Section B
    primaryContactName: z.string().min(1),
    contactEmail: z.string().email(),
    contactPhone: z.string().optional(),
    billingSameAsPrimary: z.boolean().optional().default(true),
    billingContactName: z.string().optional(),
    billingEmail: z.string().email().optional(),
    billingPhone: z.string().optional(),

    // Section C
    numberOfFloors: z.number().int().positive(),
    basementAttic: z.array(z.string()).optional(),
    estSfBasementAttic: z.number().int().optional(),
    insuranceRequirements: z.string().optional(),

    // Section E
    landscapeModeling: z.string().optional().default('No'),
    landscapeAcres: z.number().optional(),
    landscapeTerrain: z.string().optional(),

    // Section F
    bimDeliverable: stringEnum(BIM_DELIVERABLES),
    bimVersion: z.string().optional(),
    customTemplate: z.boolean().optional().default(false),
    templateFileUrl: z.string().optional(),
    georeferencing: z.boolean(),

    // Section G
    era: stringEnum(ERAS),
    roomDensity: z.number().int().min(0).max(4),
    riskFactors: z.array(stringEnum(RISK_FACTORS)).min(0),

    // Section H
    scanRegOnly: z.string().optional().default('none'),
    expedited: z.boolean(),

    // Section I
    dispatchLocation: stringEnum(DISPATCH_LOCATIONS),
    oneWayMiles: z.number().int().min(0),
    travelMode: stringEnum(TRAVEL_MODES),
    customTravelCost: z.number().optional(),

    // Section M
    estTimeline: z.string().optional(),
    projectTimeline: z.string().optional(),
    timelineNotes: z.string().optional(),
    paymentTerms: z.string().optional(),
    paymentNotes: z.string().optional(),

    // Section N
    sfAssumptionsUrl: z.string().optional(),
    sqftAssumptionsNote: z.string().optional(),
    scopingDocsUrls: z.array(z.string()).optional(),
    internalNotes: z.string().optional(),
    customScope: z.string().optional(),

    // Section O
    leadSource: stringEnum(LEAD_SOURCES),
    sourceNote: z.string().optional(),
    marketingInfluence: z.array(z.string()).optional(),
    proofLinks: z.string().optional(),
    probability: z.number().int().min(0).max(100),
    dealStage: stringEnum(DEAL_STAGES),
    priority: z.number().int().min(1).max(5),

    // Areas (optional on create — can be added later)
    areas: z.array(scopeAreaSchema).optional(),
});

// ── Scoping Form (partial update / autosave) ──
export const updateScopingFormSchema = createScopingFormSchema.partial();

// ── Line Item Shell (Phase 2) ──
export const lineItemShellSchema = z.object({
    id: z.string(),
    areaId: z.string().nullable(),
    areaName: z.string(),
    category: z.enum(['modeling', 'travel', 'addOn', 'custom']),
    discipline: z.string().optional(),
    description: z.string(),
    buildingType: z.string(),
    squareFeet: z.number().optional(),
    lod: z.string().optional(),
    scope: z.string().optional(),
    upteamCost: z.number().nullable(),
    clientPrice: z.number().nullable(),
});

// ── Quote (Phase 3) ──
export const createQuoteSchema = z.object({
    scopingFormId: z.number().int(),
    lineItems: z.array(lineItemShellSchema),
    totals: z.object({
        totalClientPrice: z.number(),
        totalUpteamCost: z.number(),
        grossMargin: z.number(),
        grossMarginPercent: z.number(),
        integrityStatus: z.enum(['passed', 'warning', 'blocked']),
        integrityFlags: z.array(z.string()),
    }).optional(),
});
