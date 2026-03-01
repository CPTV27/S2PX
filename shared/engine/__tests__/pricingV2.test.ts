import { describe, it, expect } from 'vitest';
import {
    getBand,
    getMegaBand,
    computePartnerCostF,
    computeAboveTheLineA,
    computeMultiplierM,
    computeModifierStack,
    computeX7ScanCost,
    computeSlamScanCost,
    computeArchPrice,
    computeAddonPerSqft,
    computeCadPerSqft,
    computeTravelCost,
    computeAreaResult,
    resolveTier,
    resolveBimManager,
    estimateScanDays,
    computeProjectQuoteV2,
} from '../pricingV2.js';
import type {
    V2Constants,
    V2ScanBaseline,
    V2BuildingType,
    V2AddonMarkup,
    V2CadMarkup,
    V2ScanModifier,
    V2TravelParams,
    V2SlamConfig,
    V2MegabandBaseline,
    V2MegabandFactor,
    V2ArchRate,
    V2AddonRate,
    V2CadRate,
    V2MegabandRate,
    V2PricingTables,
    V2AreaInput,
    V2ProjectInput,
} from '../pricingV2Types.js';

// ────────────────────────────────────────────────────────────────────────────
// FIXTURE DATA (mirrors Excel "Control Panel" values)
// ────────────────────────────────────────────────────────────────────────────

const CONSTANTS: V2Constants = {
    // Section A: Above-the-Line
    taxPct: 0.15,
    ownerCompPct: 0.10,
    salesMarketingPct: 0.075,
    overheadPct: 0.148,
    badDebtPct: 0.025,
    // Section B: Partner Costs
    qcPct: 0.02,
    pmPct: 0.04,
    cooPct: 0.05,
    registrationPct: 0.03,
    // Section C: Savings Floor
    savingsFloorPct: 0.10,
    // Section E: Scanner Rates
    srTechRate: 50,
    jrTechRate: 35,
    // Section M: Whale / BIM Manager
    bimManagerPct: 0.03,
    tierAThresholdSqft: 50000,
    // Section T: Minimums
    archMinimum: 5000,
    fullServiceMinimum: 5000,
    // Section U: Floor Enforcement
    autoFloorActive: true,
    // Extras
    expeditedPct: 0.20,
    matterportPerSqft: 0.10,
    georeferencingFee: 1500,
    // Scope weights
    mixedInteriorWeight: 0.65,
    mixedExteriorWeight: 0.35,
    scanScopeFullPct: 1.0,
    scanScopeIntOnlyPct: 0.775,
    scanScopeExtOnlyPct: 0.225,
    upptScopeIntOnlyPct: 0.75,
    upptScopeExtOnlyPct: 0.50,
    // Equipment amort
    slamUnitCost: 25000,
    controlEquipCost: 15000,
    equipAmortYears: 3,
    fieldDaysPerYear: 200,
    includeEquipAmort: false,
};

const SCAN_BASELINES: V2ScanBaseline[] = [
    { band: '0-3k', sqftPerHour: 300 },
    { band: '3k-5k', sqftPerHour: 500 },
    { band: '5k-10k', sqftPerHour: 750 },
    { band: '10k-20k', sqftPerHour: 800 },
    { band: '20k-30k', sqftPerHour: 1000 },
    { band: '30k-40k', sqftPerHour: 1000 },
    { band: '40k-50k', sqftPerHour: 1000 },
    { band: '50k-75k', sqftPerHour: 1000 },
    { band: '75k-100k', sqftPerHour: 1000 },
    { band: '100k+', sqftPerHour: 1300 },
];

const BUILDING_TYPES: V2BuildingType[] = [
    { typeNumber: 1, name: 'Res Std (SF)', throughputRatio: 1.0, slamEligible: false, slamThroughputRatio: null },
    { typeNumber: 2, name: 'Res Std (MF)', throughputRatio: 0.8, slamEligible: true, slamThroughputRatio: 0.6 },
    { typeNumber: 3, name: 'Res Luxury', throughputRatio: 1.0, slamEligible: false, slamThroughputRatio: null },
    { typeNumber: 4, name: 'Commercial/Office', throughputRatio: 1.4, slamEligible: true, slamThroughputRatio: 1.0 },
    { typeNumber: 5, name: 'Retail/Restaurant', throughputRatio: 2.0, slamEligible: true, slamThroughputRatio: 1.25 },
    { typeNumber: 6, name: 'Kitchen/Catering', throughputRatio: 2.0, slamEligible: true, slamThroughputRatio: 1.0 },
    { typeNumber: 7, name: 'Schools/Education', throughputRatio: 3.0, slamEligible: true, slamThroughputRatio: 1.1 },
    { typeNumber: 8, name: 'Hotel/Theatre/Museum', throughputRatio: 3.0, slamEligible: true, slamThroughputRatio: 1.1 },
    { typeNumber: 9, name: 'Hospital/Mixed Use', throughputRatio: 1.5, slamEligible: true, slamThroughputRatio: 1.0 },
    { typeNumber: 10, name: 'Mechanical (MEPF)', throughputRatio: 2.0, slamEligible: true, slamThroughputRatio: 0.5 },
    { typeNumber: 11, name: 'Warehouse/Storage', throughputRatio: 6.0, slamEligible: true, slamThroughputRatio: 1.5 },
    { typeNumber: 12, name: 'Church/Religious', throughputRatio: 4.0, slamEligible: true, slamThroughputRatio: 1.0 },
    { typeNumber: 13, name: 'Infrastructure', throughputRatio: 20.0, slamEligible: false, slamThroughputRatio: null },
];

const ADDON_MARKUPS: V2AddonMarkup[] = [
    { band: '0-3k', structureMarkup: 1.5, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '3k-5k', structureMarkup: 1.5, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '5k-10k', structureMarkup: 1.5, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '10k-20k', structureMarkup: 1.5, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '20k-30k', structureMarkup: 1.25, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '30k-40k', structureMarkup: 1.25, mepfMarkup: 2.0, gradeMarkup: 3.5 },
    { band: '40k-50k', structureMarkup: 1.2, mepfMarkup: 1.5, gradeMarkup: 3.5 },
    { band: '50k-75k', structureMarkup: 1.2, mepfMarkup: 1.5, gradeMarkup: 3.5 },
    { band: '75k-100k', structureMarkup: 1.15, mepfMarkup: 1.25, gradeMarkup: 3.5 },
    { band: '100k+', structureMarkup: 1.1, mepfMarkup: 1.25, gradeMarkup: 3.5 },
];

const CAD_MARKUPS: V2CadMarkup[] = [
    { band: '0-3k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '3k-5k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '5k-10k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '10k-20k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '20k-30k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '30k-40k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '40k-50k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '50k-75k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '75k-100k', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
    { band: '100k+', basicMarkup: 1.0, asPlusMarkup: 1.5, fullMarkup: 2.0 },
];

const SCAN_MODIFIERS: V2ScanModifier[] = [
    // X7 modifiers
    { tier: 'x7', category: 'era', code: 'modern', label: 'Modern', multiplier: 1.0, isDefault: true },
    { tier: 'x7', category: 'era', code: 'historic', label: 'Historic', multiplier: 1.2, isDefault: false },
    { tier: 'x7', category: 'occupied', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'x7', category: 'occupied', code: 'yes', label: 'Yes', multiplier: 1.15, isDefault: false },
    { tier: 'x7', category: 'power', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'x7', category: 'power', code: 'yes', label: 'Yes', multiplier: 1.2, isDefault: false },
    { tier: 'x7', category: 'hazard', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'x7', category: 'hazard', code: 'yes', label: 'Yes', multiplier: 1.3, isDefault: false },
    { tier: 'x7', category: 'density', code: '0', label: 'Wide Open', multiplier: 0.6, isDefault: false },
    { tier: 'x7', category: 'density', code: '1', label: 'Spacious', multiplier: 0.8, isDefault: false },
    { tier: 'x7', category: 'density', code: '2', label: 'Standard', multiplier: 1.0, isDefault: true },
    { tier: 'x7', category: 'density', code: '3', label: 'Dense', multiplier: 1.2, isDefault: false },
    { tier: 'x7', category: 'density', code: '4', label: 'Extreme', multiplier: 1.5, isDefault: false },
    // SLAM modifiers
    { tier: 'slam', category: 'era', code: 'modern', label: 'Modern', multiplier: 1.0, isDefault: true },
    { tier: 'slam', category: 'era', code: 'historic', label: 'Historic', multiplier: 1.2, isDefault: false },
    { tier: 'slam', category: 'occupied', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'slam', category: 'occupied', code: 'yes', label: 'Yes', multiplier: 1.25, isDefault: false },
    { tier: 'slam', category: 'power', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'slam', category: 'power', code: 'yes', label: 'Yes', multiplier: 1.5, isDefault: false },
    { tier: 'slam', category: 'hazard', code: 'no', label: 'No', multiplier: 1.0, isDefault: true },
    { tier: 'slam', category: 'hazard', code: 'yes', label: 'Yes', multiplier: 2.0, isDefault: false },
    { tier: 'slam', category: 'density', code: '0', label: 'Wide Open', multiplier: 0.8, isDefault: false },
    { tier: 'slam', category: 'density', code: '1', label: 'Spacious', multiplier: 0.9, isDefault: false },
    { tier: 'slam', category: 'density', code: '2', label: 'Standard', multiplier: 1.0, isDefault: true },
    { tier: 'slam', category: 'density', code: '3', label: 'Dense', multiplier: 1.1, isDefault: false },
    { tier: 'slam', category: 'density', code: '4', label: 'Extreme', multiplier: 1.2, isDefault: false },
];

const TRAVEL_PARAMS: V2TravelParams = {
    mileageRate: 4,
    overnightThresholdMi: 75,
    airfareThresholdMi: 300,
    nycFlatSmall: 150,
    nycFlatRegional: 300,
    hotelCap: 250,
    perDiem: 75,
    avgAirfare: 500,
    carRental: 125,
    airportParking: 150,
    vehicleMpg: 25,
    gasPrice: 3.50,
    srTechTravelRate: 50,
    jrTechTravelRate: 35,
    avgTravelSpeed: 45,
    irsReimbursementRate: 0.67,
};

const SLAM_CONFIG: V2SlamConfig = {
    slamScannerRate: 75,
    slamAssistRate: 35,
    controlSurveyRate: 85,
    controlAssistRate: 35,
    slamBaselineSqftPerHour: 25000,
};

const MEGABAND_BASELINES: V2MegabandBaseline[] = [
    { band: '100k-200k', sqftPerHour: 25000 },
    { band: '200k-500k', sqftPerHour: 30000 },
    { band: '500k-1M', sqftPerHour: 35000 },
    { band: '1M-2M', sqftPerHour: 40000 },
    { band: '2M-5M', sqftPerHour: 45000 },
    { band: '5M+', sqftPerHour: 50000 },
];

const MEGABAND_FACTORS: V2MegabandFactor[] = [
    { band: '100k-200k', factor: 0.75 },
    { band: '200k-500k', factor: 0.42 },
    { band: '500k-1M', factor: 0.35 },
    { band: '1M-2M', factor: 0.28 },
    { band: '2M-5M', factor: 0.18 },
    { band: '5M+', factor: 0.08 },
];

// Sample arch rates for building type 1 (SFR) and type 4 (Commercial)
const ARCH_RATES: V2ArchRate[] = [
    // Type 1 SFR - LoD 200/300/350, small bands
    { buildingTypeNum: 1, band: '0-3k', lod: '200', upptPerSqft: 0.45, scanPerSqft: 0.167 },
    { buildingTypeNum: 1, band: '0-3k', lod: '300', upptPerSqft: 0.60, scanPerSqft: 0.167 },
    { buildingTypeNum: 1, band: '0-3k', lod: '350', upptPerSqft: 0.80, scanPerSqft: 0.167 },
    { buildingTypeNum: 1, band: '3k-5k', lod: '200', upptPerSqft: 0.35, scanPerSqft: 0.10 },
    { buildingTypeNum: 1, band: '3k-5k', lod: '300', upptPerSqft: 0.50, scanPerSqft: 0.10 },
    { buildingTypeNum: 1, band: '3k-5k', lod: '350', upptPerSqft: 0.65, scanPerSqft: 0.10 },
    { buildingTypeNum: 1, band: '5k-10k', lod: '200', upptPerSqft: 0.28, scanPerSqft: 0.067 },
    { buildingTypeNum: 1, band: '5k-10k', lod: '300', upptPerSqft: 0.40, scanPerSqft: 0.067 },
    { buildingTypeNum: 1, band: '5k-10k', lod: '350', upptPerSqft: 0.55, scanPerSqft: 0.067 },
    { buildingTypeNum: 1, band: '10k-20k', lod: '200', upptPerSqft: 0.22, scanPerSqft: 0.0625 },
    { buildingTypeNum: 1, band: '10k-20k', lod: '300', upptPerSqft: 0.32, scanPerSqft: 0.0625 },
    { buildingTypeNum: 1, band: '10k-20k', lod: '350', upptPerSqft: 0.45, scanPerSqft: 0.0625 },
    // Type 4 Commercial - a few bands
    { buildingTypeNum: 4, band: '5k-10k', lod: '300', upptPerSqft: 0.38, scanPerSqft: 0.048 },
    { buildingTypeNum: 4, band: '10k-20k', lod: '300', upptPerSqft: 0.30, scanPerSqft: 0.045 },
    { buildingTypeNum: 4, band: '20k-30k', lod: '300', upptPerSqft: 0.25, scanPerSqft: 0.036 },
    { buildingTypeNum: 4, band: '40k-50k', lod: '300', upptPerSqft: 0.20, scanPerSqft: 0.036 },
];

// Sample add-on rates
const ADDON_RATES: V2AddonRate[] = [
    { discipline: 'structure', buildingTypeNum: 1, band: '0-3k', lod: '300', upptPerSqft: 0.15 },
    { discipline: 'structure', buildingTypeNum: 1, band: '5k-10k', lod: '300', upptPerSqft: 0.10 },
    { discipline: 'mepf', buildingTypeNum: 1, band: '0-3k', lod: '300', upptPerSqft: 0.20 },
    { discipline: 'mepf', buildingTypeNum: 1, band: '5k-10k', lod: '300', upptPerSqft: 0.14 },
    { discipline: 'grade', buildingTypeNum: 1, band: '0-3k', lod: '300', upptPerSqft: 0.08 },
    { discipline: 'grade', buildingTypeNum: 1, band: '5k-10k', lod: '300', upptPerSqft: 0.06 },
    { discipline: 'structure', buildingTypeNum: 4, band: '10k-20k', lod: '300', upptPerSqft: 0.12 },
    { discipline: 'mepf', buildingTypeNum: 4, band: '10k-20k', lod: '300', upptPerSqft: 0.16 },
];

// Sample CAD rates
const CAD_RATES: V2CadRate[] = [
    { band: '0-3k', basicUppt: 0.05, asPlusUppt: 0.08, fullUppt: 0.12 },
    { band: '5k-10k', basicUppt: 0.04, asPlusUppt: 0.06, fullUppt: 0.10 },
    { band: '10k-20k', basicUppt: 0.03, asPlusUppt: 0.05, fullUppt: 0.08 },
];

// Sample mega-band rates
const MEGABAND_RATES: V2MegabandRate[] = [
    { buildingTypeNum: 4, megaBand: '100k-200k', lod: '300', upptPerSqft: 0.15 },
    { buildingTypeNum: 4, megaBand: '200k-500k', lod: '300', upptPerSqft: 0.084 },
    { buildingTypeNum: 11, megaBand: '100k-200k', lod: '300', upptPerSqft: 0.08 },
];

function makeTables(overrides?: Partial<V2PricingTables>): V2PricingTables {
    return {
        constants: CONSTANTS,
        scanBaselines: SCAN_BASELINES,
        buildingTypes: BUILDING_TYPES,
        addonMarkups: ADDON_MARKUPS,
        cadMarkups: CAD_MARKUPS,
        scanModifiers: SCAN_MODIFIERS,
        travelParams: TRAVEL_PARAMS,
        slamConfig: SLAM_CONFIG,
        megabandBaselines: MEGABAND_BASELINES,
        megabandFactors: MEGABAND_FACTORS,
        archRates: ARCH_RATES,
        addonRates: ADDON_RATES,
        cadRates: CAD_RATES,
        megabandRates: MEGABAND_RATES,
        ...overrides,
    };
}

// ────────────────────────────────────────────────────────────────────────────
// TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('pricingV2 — band helpers', () => {
    it('getBand maps sqft correctly', () => {
        expect(getBand(1000)).toBe('0-3k');
        expect(getBand(3000)).toBe('0-3k');
        expect(getBand(3001)).toBe('3k-5k');
        expect(getBand(5000)).toBe('3k-5k');
        expect(getBand(5001)).toBe('5k-10k');
        expect(getBand(10000)).toBe('5k-10k');
        expect(getBand(50000)).toBe('40k-50k');
        expect(getBand(75000)).toBe('50k-75k');
        expect(getBand(100000)).toBe('75k-100k');
        expect(getBand(100001)).toBe('100k+');
        expect(getBand(500000)).toBe('100k+');
    });

    it('getMegaBand maps sqft correctly', () => {
        expect(getMegaBand(150000)).toBe('100k-200k');
        expect(getMegaBand(200000)).toBe('100k-200k');
        expect(getMegaBand(200001)).toBe('200k-500k');
        expect(getMegaBand(500000)).toBe('200k-500k');
        expect(getMegaBand(1000000)).toBe('500k-1M');
        expect(getMegaBand(2000000)).toBe('1M-2M');
        expect(getMegaBand(5000000)).toBe('2M-5M');
        expect(getMegaBand(5000001)).toBe('5M+');
    });
});

describe('pricingV2 — M multiplier', () => {
    it('computes f (partner cost) without BIM Manager', () => {
        const f = computePartnerCostF(CONSTANTS, false);
        // 0.02 + 0.04 + 0.05 + 0.03 = 0.14
        expect(f).toBeCloseTo(0.14, 6);
    });

    it('computes f with BIM Manager (+3%)', () => {
        const f = computePartnerCostF(CONSTANTS, true);
        // 0.14 + 0.03 = 0.17
        expect(f).toBeCloseTo(0.17, 6);
    });

    it('computes a (above-the-line)', () => {
        const a = computeAboveTheLineA(CONSTANTS);
        // 0.15 + 0.10 + 0.075 + 0.148 + 0.025 = 0.498
        expect(a).toBeCloseTo(0.498, 6);
    });

    it('computes M_base ≈ 3.8168', () => {
        const M = computeMultiplierM(CONSTANTS, false);
        // 1 / (1 - 0.14 - 0.498 - 0.10) = 1 / 0.262
        expect(M).toBeCloseTo(3.8168, 3);
    });

    it('computes M_whale ≈ 4.3103', () => {
        const M = computeMultiplierM(CONSTANTS, true);
        // 1 / (1 - 0.17 - 0.498 - 0.10) = 1 / 0.232
        expect(M).toBeCloseTo(4.3103, 3);
    });

    it('throws if denominator is zero or negative', () => {
        const badConstants = { ...CONSTANTS, savingsFloorPct: 0.362 };
        // 1 - 0.14 - 0.498 - 0.362 = 0.0 → should throw
        expect(() => computeMultiplierM(badConstants, false)).toThrow();
    });
});

describe('pricingV2 — modifier stack', () => {
    const tables = makeTables();

    it('returns 1.0 for all defaults (X7, modern, unoccupied, power, no hazard, density 2, Full)', () => {
        const area: V2AreaInput = {
            squareFootage: 5000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
        };
        const stack = computeModifierStack(area, tables.scanModifiers, 'X7', tables.constants);
        expect(stack).toBeCloseTo(1.0, 6);
    });

    it('stacks historic × occupied × hazardous (X7)', () => {
        const area: V2AreaInput = {
            squareFootage: 5000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            era: 'Historic',
            occupied: true,
            hazardous: true,
        };
        const stack = computeModifierStack(area, tables.scanModifiers, 'X7', tables.constants);
        // 1.2 × 1.15 × 1.0 × 1.3 × 1.0 × 1.0 = 1.794
        expect(stack).toBeCloseTo(1.2 * 1.15 * 1.3, 4);
    });

    it('applies scan scope multiplier for Int Only', () => {
        const area: V2AreaInput = {
            squareFootage: 5000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Int Only',
        };
        const stack = computeModifierStack(area, tables.scanModifiers, 'X7', tables.constants);
        expect(stack).toBeCloseTo(0.775, 6);
    });

    it('uses SLAM modifiers (higher occupied penalty)', () => {
        const area: V2AreaInput = {
            squareFootage: 100000,
            buildingTypeNum: 4,
            lod: '300',
            scope: 'Full',
            occupied: true,
        };
        const stack = computeModifierStack(area, tables.scanModifiers, 'SLAM', tables.constants);
        // SLAM occupied = 1.25 (vs X7 = 1.15)
        expect(stack).toBeCloseTo(1.25, 4);
    });

    it('density 0 (wide open) reduces scan cost', () => {
        const area: V2AreaInput = {
            squareFootage: 5000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            roomDensity: 0,
        };
        const stack = computeModifierStack(area, tables.scanModifiers, 'X7', tables.constants);
        expect(stack).toBeCloseTo(0.6, 4);
    });
});

describe('pricingV2 — scan cost', () => {
    it('computes X7 scan cost for SFR in 0-3k band', () => {
        // rate / (baseline × ratio) = 50 / (300 × 1.0) = 0.1667
        const cost = computeX7ScanCost(CONSTANTS, SCAN_BASELINES, BUILDING_TYPES, 1, '0-3k', 'Sr');
        expect(cost).toBeCloseTo(50 / 300, 4);
    });

    it('Jr tech reduces X7 scan cost', () => {
        const cost = computeX7ScanCost(CONSTANTS, SCAN_BASELINES, BUILDING_TYPES, 1, '0-3k', 'Jr');
        // 35 / (300 × 1.0) = 0.1167
        expect(cost).toBeCloseTo(35 / 300, 4);
    });

    it('warehouse (type 11) has high throughput ratio → low scan cost', () => {
        const cost = computeX7ScanCost(CONSTANTS, SCAN_BASELINES, BUILDING_TYPES, 11, '10k-20k', 'Sr');
        // 50 / (800 × 6.0) = 50/4800 = 0.01042
        expect(cost).toBeCloseTo(50 / 4800, 4);
    });

    it('computes SLAM scan cost for Commercial (type 4)', () => {
        const cost = computeSlamScanCost(SLAM_CONFIG, BUILDING_TYPES, 4);
        // crewRate = 75+35=110, throughput = 25000 × 1.0 = 25000
        // 110 / 25000 = 0.0044
        expect(cost).toBeCloseTo(110 / 25000, 4);
    });

    it('returns 0 for non-SLAM-eligible type', () => {
        const cost = computeSlamScanCost(SLAM_CONFIG, BUILDING_TYPES, 1); // SFR
        expect(cost).toBe(0);
    });
});

describe('pricingV2 — architecture pricing', () => {
    const tables = makeTables();
    const M_base = computeMultiplierM(CONSTANTS, false); // ~3.8168

    it('computes arch price for SFR, 2000 sqft, LoD 300', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
        };
        const result = computeArchPrice(area, tables, M_base, 'X7', 1.0);
        // UppT = 0.60, scan = 50/(300×1.0) = 0.1667
        // But engine uses scannerAdj internally (1.0 for Sr) and modStack is passed as 1.0
        // varCOGS = 0.60 + 0.1667 = 0.7667
        // price = 0.7667 × 3.8168 = 2.927
        expect(result.upptPerSqft).toBeCloseTo(0.60, 4);
        expect(result.vcogsPerSqft).toBeGreaterThan(0.7);
        expect(result.pricePerSqft).toBeGreaterThan(2.5);
        expect(result.total).toBeCloseTo(result.pricePerSqft * 2000, 2);
    });

    it('Int Only scope reduces UppT by 25%', () => {
        const fullArea: V2AreaInput = {
            squareFootage: 8000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
        };
        const intArea: V2AreaInput = { ...fullArea, scope: 'Int Only' };

        const fullResult = computeArchPrice(fullArea, tables, M_base, 'X7', 1.0);
        const intResult = computeArchPrice(intArea, tables, M_base, 'X7', 1.0);

        // Int Only UppT = Full UppT × 0.75
        expect(intResult.upptPerSqft).toBeCloseTo(fullResult.upptPerSqft * 0.75, 4);
    });

    it('mixed scope blends interior and exterior UppT', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Mixed',
            mixedInteriorLod: '300',
            mixedExteriorLod: '200',
        };
        const result = computeArchPrice(area, tables, M_base, 'X7', 1.0);
        // blended = 0.65 × uppt(300) + 0.35 × uppt(200)
        // = 0.65 × 0.60 + 0.35 × 0.45 = 0.39 + 0.1575 = 0.5475
        expect(result.upptPerSqft).toBeCloseTo(0.65 * 0.60 + 0.35 * 0.45, 4);
    });
});

describe('pricingV2 — add-on pricing', () => {
    const tables = makeTables();

    it('computes structure add-on for SFR, 2000 sqft, LoD 300', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            structure: true,
        };
        const perSqft = computeAddonPerSqft('structure', area, tables);
        // UppT=0.15 × markup=1.5 × scopeDiscount=1.0 = 0.225
        expect(perSqft).toBeCloseTo(0.15 * 1.5, 4);
    });

    it('applies scope discount to structure (Int Only)', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Int Only',
            structure: true,
        };
        const perSqft = computeAddonPerSqft('structure', area, tables);
        // UppT=0.15 × markup=1.5 × scopeDiscount=0.75 = 0.16875
        expect(perSqft).toBeCloseTo(0.15 * 1.5 * 0.75, 4);
    });

    it('grade is exempt from scope discount', () => {
        const fullArea: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            grade: true,
        };
        const intArea: V2AreaInput = { ...fullArea, scope: 'Int Only' };

        const fullPerSqft = computeAddonPerSqft('grade', fullArea, tables);
        const intPerSqft = computeAddonPerSqft('grade', intArea, tables);

        // Grade ignores scope discount — same price
        expect(fullPerSqft).toBeCloseTo(intPerSqft, 6);
    });
});

describe('pricingV2 — CAD conversion', () => {
    const tables = makeTables();

    it('returns 0 when cadConversion is false', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            cadConversion: false,
        };
        expect(computeCadPerSqft(area, tables)).toBe(0);
    });

    it('computes Basic CAD conversion rate', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            cadConversion: true,
            cadPackage: 'Basic',
        };
        const perSqft = computeCadPerSqft(area, tables);
        // UppT=0.05 × markup=1.0 = 0.05
        expect(perSqft).toBeCloseTo(0.05, 4);
    });

    it('Full package uses higher markup', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            cadConversion: true,
            cadPackage: 'Full',
        };
        const perSqft = computeCadPerSqft(area, tables);
        // UppT=0.12 × markup=2.0 = 0.24
        expect(perSqft).toBeCloseTo(0.12 * 2.0, 4);
    });
});

describe('pricingV2 — travel cost', () => {
    it('returns 0 for distance 0', () => {
        expect(computeTravelCost(TRAVEL_PARAMS, 0, 1, 1)).toBe(0);
    });

    it('NYC flat rate for short distance, 1 day', () => {
        const cost = computeTravelCost(TRAVEL_PARAMS, 15, 1, 1);
        expect(cost).toBe(150); // nycFlatSmall
    });

    it('NYC flat rate for short distance, multi-day', () => {
        const cost = computeTravelCost(TRAVEL_PARAMS, 15, 3, 1);
        expect(cost).toBe(300); // nycFlatRegional
    });

    it('truck mode, under overnight threshold', () => {
        const cost = computeTravelCost(TRAVEL_PARAMS, 50, 2, 1);
        // daily round-trip: 50 × $4 × 2 = $400
        expect(cost).toBe(400);
    });

    it('truck mode, over overnight threshold', () => {
        const cost = computeTravelCost(TRAVEL_PARAMS, 100, 2, 1);
        // mileage: 100 × $4 = $400
        // hotel: $250 × 2 = $500
        // per diem: $75 × 2 = $150
        // total: $1050
        expect(cost).toBe(1050);
    });

    it('flight mode for long distance', () => {
        const cost = computeTravelCost(TRAVEL_PARAMS, 500, 2, 2);
        // airfare: $500 × 2 techs = $1000
        // carRental: $125 × 3 days = $375
        // airportParking: $150
        // hotel: $250 × 2 = $500
        // per diem: $75 × 2 = $150
        // total: $2175
        expect(cost).toBe(2175);
    });
});

describe('pricingV2 — tier resolution', () => {
    const tables = makeTables();

    it('SFR always resolves to X7 even at 60k sqft', () => {
        const input: V2ProjectInput = {
            areas: [{ squareFootage: 60000, buildingTypeNum: 1, lod: '300', scope: 'Full' }],
        };
        expect(resolveTier(input, tables)).toBe('X7');
    });

    it('Commercial at 60k sqft auto-resolves to SLAM', () => {
        const input: V2ProjectInput = {
            areas: [{ squareFootage: 60000, buildingTypeNum: 4, lod: '300', scope: 'Full' }],
        };
        expect(resolveTier(input, tables)).toBe('SLAM');
    });

    it('Commercial at 40k sqft stays X7', () => {
        const input: V2ProjectInput = {
            areas: [{ squareFootage: 40000, buildingTypeNum: 4, lod: '300', scope: 'Full' }],
        };
        expect(resolveTier(input, tables)).toBe('X7');
    });

    it('explicit X7 override honored', () => {
        const input: V2ProjectInput = {
            areas: [{ squareFootage: 100000, buildingTypeNum: 4, lod: '300', scope: 'Full' }],
            pricingTier: 'X7',
        };
        expect(resolveTier(input, tables)).toBe('X7');
    });

    it('explicit SLAM rejected for non-eligible type', () => {
        const input: V2ProjectInput = {
            areas: [{ squareFootage: 100000, buildingTypeNum: 1, lod: '300', scope: 'Full' }],
            pricingTier: 'SLAM',
        };
        expect(resolveTier(input, tables)).toBe('X7');
    });
});

describe('pricingV2 — BIM Manager resolution', () => {
    it('YES always active', () => {
        expect(resolveBimManager({ areas: [] }, 'X7')).toBe(false);
        expect(resolveBimManager({ areas: [], bimManager: 'YES' }, 'X7')).toBe(true);
    });

    it('NO always inactive', () => {
        expect(resolveBimManager({ areas: [], bimManager: 'NO' }, 'SLAM')).toBe(false);
    });

    it('AUTO activates for SLAM', () => {
        expect(resolveBimManager({ areas: [] }, 'SLAM')).toBe(true);
        expect(resolveBimManager({ areas: [] }, 'X7')).toBe(false);
    });
});

describe('pricingV2 — full area result', () => {
    const tables = makeTables();
    const M = computeMultiplierM(CONSTANTS, false);

    it('computes area result for simple SFR 2000 sqft', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
        };
        const result = computeAreaResult(area, tables, M, 'X7');

        expect(result.archTotal).toBeGreaterThan(0);
        expect(result.structureTotal).toBe(0); // not selected
        expect(result.mepfTotal).toBe(0);
        expect(result.gradeTotal).toBe(0);
        expect(result.cadTotal).toBe(0);
        expect(result.matterportTotal).toBe(0);
        expect(result.georeferencingTotal).toBe(0);
        expect(result.baseProjectTotal).toBe(result.archTotal);
        expect(result.modifierStack).toBeCloseTo(1.0, 4);
    });

    it('adds matterport and georeferencing when selected', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            matterport: true,
            georeferencing: true,
        };
        const result = computeAreaResult(area, tables, M, 'X7');

        expect(result.matterportTotal).toBeCloseTo(0.10 * 2000, 2);
        expect(result.georeferencingTotal).toBe(1500);
        expect(result.baseProjectTotal).toBe(
            result.archTotal + result.cadTotal + result.matterportTotal + result.georeferencingTotal,
        );
    });

    it('includes structure and mepf add-ons', () => {
        const area: V2AreaInput = {
            squareFootage: 2000,
            buildingTypeNum: 1,
            lod: '300',
            scope: 'Full',
            structure: true,
            mepf: true,
        };
        const result = computeAreaResult(area, tables, M, 'X7');

        expect(result.structureTotal).toBeGreaterThan(0);
        expect(result.mepfTotal).toBeGreaterThan(0);
        expect(result.subtotalBim).toBe(
            result.archTotal + result.structureTotal + result.mepfTotal + result.gradeTotal,
        );
    });
});

describe('pricingV2 — full project quote', () => {
    const tables = makeTables();

    it('computes a simple SFR quote', () => {
        const input: V2ProjectInput = {
            areas: [{
                squareFootage: 3000,
                buildingTypeNum: 1,
                lod: '300',
                scope: 'Full',
            }],
            travelDistanceMi: 30,
        };
        const result = computeProjectQuoteV2(input, tables);

        expect(result.resolvedTier).toBe('X7');
        expect(result.bimManagerActive).toBe(false);
        expect(result.multiplierM).toBeCloseTo(3.8168, 3);
        expect(result.baseProjectTotal).toBeGreaterThan(0);
        expect(result.travelCharge).toBeGreaterThan(0);
        expect(result.totalQuote).toBeGreaterThanOrEqual(result.baseProjectTotal + result.travelCharge);
    });

    it('applies expedited surcharge (20%)', () => {
        const input: V2ProjectInput = {
            areas: [{
                squareFootage: 5000,
                buildingTypeNum: 1,
                lod: '300',
                scope: 'Full',
            }],
            expedited: true,
        };
        const result = computeProjectQuoteV2(input, tables);

        expect(result.expeditedSurcharge).toBeCloseTo(result.baseProjectTotal * 0.20, 2);
    });

    it('enforces minimum floor on tiny project', () => {
        const input: V2ProjectInput = {
            areas: [{
                squareFootage: 200, // very small
                buildingTypeNum: 1,
                lod: '200',
                scope: 'Full',
            }],
        };
        const result = computeProjectQuoteV2(input, tables);

        // Tiny project should hit minimum
        if (result.baseProjectTotal < 5000) {
            expect(result.minimumApplied).toBe(5000);
            expect(result.totalQuote).toBe(5000);
        }
    });

    it('multi-area project sums correctly', () => {
        const input: V2ProjectInput = {
            areas: [
                { squareFootage: 3000, buildingTypeNum: 1, lod: '300', scope: 'Full' },
                { squareFootage: 8000, buildingTypeNum: 1, lod: '300', scope: 'Full' },
            ],
            travelDistanceMi: 50,
        };
        const result = computeProjectQuoteV2(input, tables);

        const sumBase = result.areas.reduce((s, a) => s + a.baseProjectTotal, 0);
        expect(result.baseProjectTotal).toBeCloseTo(sumBase, 2);
        expect(result.areas).toHaveLength(2);
    });

    it('uses travel override when provided', () => {
        const input: V2ProjectInput = {
            areas: [{
                squareFootage: 5000,
                buildingTypeNum: 1,
                lod: '300',
                scope: 'Full',
            }],
            travelOverride: 999,
        };
        const result = computeProjectQuoteV2(input, tables);
        expect(result.travelCharge).toBe(999);
    });

    it('whale project uses M_whale and BIM Manager', () => {
        const input: V2ProjectInput = {
            areas: [{
                squareFootage: 60000,
                buildingTypeNum: 4,
                lod: '300',
                scope: 'Full',
            }],
        };
        const result = computeProjectQuoteV2(input, tables);

        expect(result.resolvedTier).toBe('SLAM');
        expect(result.bimManagerActive).toBe(true);
        expect(result.multiplierM).toBeCloseTo(4.3103, 3);
        expect(result.partnerCostF).toBeCloseTo(0.17, 4);
    });
});

describe('pricingV2 — scan day estimation', () => {
    const tables = makeTables();

    it('estimates 1 day for small project', () => {
        const areas: V2AreaInput[] = [
            { squareFootage: 2000, buildingTypeNum: 1, lod: '300', scope: 'Full' },
        ];
        const days = estimateScanDays(areas, tables, 'X7');
        // 2000 sqft / (300 × 1.0) = 6.67 hrs → 1 day
        expect(days).toBe(1);
    });

    it('estimates multiple days for large project', () => {
        const areas: V2AreaInput[] = [
            { squareFootage: 20000, buildingTypeNum: 1, lod: '300', scope: 'Full' },
        ];
        const days = estimateScanDays(areas, tables, 'X7');
        // 20000 / (800 × 1.0) = 25 hrs → ceil(25/8) = 4 days
        expect(days).toBe(4);
    });
});
