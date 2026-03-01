/**
 * Seed script for the V2 Pricing Engine tables.
 * Populates all 15 tables from the "S2P Pricing v3.1" Excel workbook data.
 *
 * Usage: npx tsx server/scripts/seed-pricing-v2.ts
 *
 * Idempotent: checks if data exists before inserting.
 * Wrapped in a transaction — all-or-nothing.
 */

import 'dotenv/config';
import { db, pool } from '../db.js';
import { sql } from 'drizzle-orm';
import {
    pricingConstants,
    pricingScanBaselines,
    pricingBuildingTypes,
    pricingAddonMarkups,
    pricingCadMarkups,
    pricingScanModifiers,
    pricingTravelParams,
    pricingSlamConfig,
    pricingMegabandBaselines,
    pricingMegabandFactors,
    pricingArchRates,
    pricingAddonRates,
    pricingCadRates,
    pricingLandscapeParams,
    pricingMegabandRates,
} from '../../shared/schema/pricing.js';

// ────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS (single row — Control Panel)
// ────────────────────────────────────────────────────────────────────────────
const CONSTANTS_DATA = {
    taxPct: '0.1500',
    ownerCompPct: '0.1000',
    salesMarketingPct: '0.0750',
    overheadPct: '0.1480',
    badDebtPct: '0.0250',
    qcPct: '0.0200',
    pmPct: '0.0400',
    cooPct: '0.0500',
    registrationPct: '0.0300',
    savingsFloorPct: '0.1000',
    srTechRate: '50.00',
    jrTechRate: '35.00',
    bimManagerPct: '0.0300',
    tierAThresholdSqft: 50000,
    archMinimum: '3500.00',
    fullServiceMinimum: '5000.00',
    autoFloorActive: true,
    expeditedPct: '0.2000',
    matterportPerSqft: '0.1000',
    georeferencingFee: '1500.00',
    mixedInteriorWeight: '0.650',
    mixedExteriorWeight: '0.350',
    scanScopeFullPct: '1.0000',
    scanScopeIntOnlyPct: '0.7750',
    scanScopeExtOnlyPct: '0.2250',
    upptScopeIntOnlyPct: '0.7500',
    upptScopeExtOnlyPct: '0.5000',
    slamUnitCost: '65000.00',
    controlEquipCost: '55000.00',
    equipAmortYears: 5,
    fieldDaysPerYear: 200,
    includeEquipAmort: false,
};

// ────────────────────────────────────────────────────────────────────────────
// 2. SCAN BASELINES (7 rows — SFR I+E reference throughputs)
// ────────────────────────────────────────────────────────────────────────────
const SCAN_BASELINES_DATA = [
    { band: '0-3k', sqftPerHour: 300, sortOrder: 1 },
    { band: '3k-5k', sqftPerHour: 500, sortOrder: 2 },
    { band: '5k-10k', sqftPerHour: 750, sortOrder: 3 },
    { band: '10k-20k', sqftPerHour: 800, sortOrder: 4 },
    { band: '20k-50k', sqftPerHour: 1000, sortOrder: 5 },
    { band: '50k-100k', sqftPerHour: 1000, sortOrder: 6 },
    { band: '100k+', sqftPerHour: 1300, sortOrder: 7 },
];

// ────────────────────────────────────────────────────────────────────────────
// 3. BUILDING TYPES (13 rows)
// ────────────────────────────────────────────────────────────────────────────
const BUILDING_TYPES_DATA = [
    { typeNumber: 1, name: 'Res Std (SF)', throughputRatio: '1.000', slamEligible: false, slamThroughputRatio: null, sortOrder: 1 },
    { typeNumber: 2, name: 'Res Std (MF)', throughputRatio: '0.800', slamEligible: true, slamThroughputRatio: '0.600', sortOrder: 2 },
    { typeNumber: 3, name: 'Res Luxury', throughputRatio: '1.000', slamEligible: false, slamThroughputRatio: null, sortOrder: 3 },
    { typeNumber: 4, name: 'Commercial/Office', throughputRatio: '1.400', slamEligible: true, slamThroughputRatio: '1.000', sortOrder: 4 },
    { typeNumber: 5, name: 'Retail/Restaurant', throughputRatio: '2.000', slamEligible: true, slamThroughputRatio: '1.250', sortOrder: 5 },
    { typeNumber: 6, name: 'Kitchen/Catering', throughputRatio: '2.000', slamEligible: true, slamThroughputRatio: '1.000', sortOrder: 6 },
    { typeNumber: 7, name: 'Schools/Education', throughputRatio: '3.000', slamEligible: true, slamThroughputRatio: '1.100', sortOrder: 7 },
    { typeNumber: 8, name: 'Hotel/Theatre/Museum', throughputRatio: '3.000', slamEligible: true, slamThroughputRatio: '1.100', sortOrder: 8 },
    { typeNumber: 9, name: 'Hospital/Mixed Use', throughputRatio: '1.500', slamEligible: true, slamThroughputRatio: '1.000', sortOrder: 9 },
    { typeNumber: 10, name: 'Mechanical (MEPF)', throughputRatio: '2.000', slamEligible: true, slamThroughputRatio: '0.500', sortOrder: 10 },
    { typeNumber: 11, name: 'Warehouse/Storage', throughputRatio: '6.000', slamEligible: true, slamThroughputRatio: '1.500', sortOrder: 11 },
    { typeNumber: 12, name: 'Church/Religious', throughputRatio: '4.000', slamEligible: true, slamThroughputRatio: '1.000', sortOrder: 12 },
    { typeNumber: 13, name: 'Infrastructure', throughputRatio: '20.000', slamEligible: false, slamThroughputRatio: null, sortOrder: 13 },
];

// ────────────────────────────────────────────────────────────────────────────
// 4. ADD-ON MARKUPS (9 rows)
// ────────────────────────────────────────────────────────────────────────────
const ADDON_MARKUPS_DATA = [
    { band: '0-5k', structureMarkup: '1.500', mepfMarkup: '2.000', gradeMarkup: '3.500', sortOrder: 1 },
    { band: '5k-10k', structureMarkup: '1.500', mepfMarkup: '2.000', gradeMarkup: '3.500', sortOrder: 2 },
    { band: '10k-20k', structureMarkup: '1.500', mepfMarkup: '2.000', gradeMarkup: '3.500', sortOrder: 3 },
    { band: '20k-30k', structureMarkup: '1.250', mepfMarkup: '2.000', gradeMarkup: '3.500', sortOrder: 4 },
    { band: '30k-40k', structureMarkup: '1.250', mepfMarkup: '2.000', gradeMarkup: '3.500', sortOrder: 5 },
    { band: '40k-50k', structureMarkup: '1.200', mepfMarkup: '1.500', gradeMarkup: '3.500', sortOrder: 6 },
    { band: '50k-75k', structureMarkup: '1.200', mepfMarkup: '1.500', gradeMarkup: '3.500', sortOrder: 7 },
    { band: '75k-100k', structureMarkup: '1.150', mepfMarkup: '1.250', gradeMarkup: '3.500', sortOrder: 8 },
    { band: '100k+', structureMarkup: '1.100', mepfMarkup: '1.250', gradeMarkup: '3.500', sortOrder: 9 },
];

// ────────────────────────────────────────────────────────────────────────────
// 5. CAD MARKUPS (9 rows)
// ────────────────────────────────────────────────────────────────────────────
const CAD_MARKUPS_DATA = [
    { band: '0-5k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 1 },
    { band: '5k-10k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 2 },
    { band: '10k-20k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 3 },
    { band: '20k-30k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 4 },
    { band: '30k-40k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 5 },
    { band: '40k-50k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 6 },
    { band: '50k-75k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 7 },
    { band: '75k-100k', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 8 },
    { band: '100k+', basicMarkup: '2.000', asPlusMarkup: '2.000', fullMarkup: '2.000', sortOrder: 9 },
];

// ────────────────────────────────────────────────────────────────────────────
// 6. SCAN MODIFIERS (26 rows — X7 + SLAM)
// ────────────────────────────────────────────────────────────────────────────
const SCAN_MODIFIERS_DATA = [
    // X7 Era
    { tier: 'x7', category: 'era', code: 'modern', label: 'Modern (default)', multiplier: '1.0000', isDefault: true, sortOrder: 1 },
    { tier: 'x7', category: 'era', code: 'historic', label: 'Historic', multiplier: '1.2000', isDefault: false, sortOrder: 2 },
    // X7 Occupied
    { tier: 'x7', category: 'occupied', code: 'no', label: 'Unoccupied (default)', multiplier: '1.0000', isDefault: true, sortOrder: 3 },
    { tier: 'x7', category: 'occupied', code: 'yes', label: 'Occupied', multiplier: '1.1500', isDefault: false, sortOrder: 4 },
    // X7 Power
    { tier: 'x7', category: 'power', code: 'no', label: 'Power available (default)', multiplier: '1.0000', isDefault: true, sortOrder: 5 },
    { tier: 'x7', category: 'power', code: 'yes', label: 'No Power/Heat', multiplier: '1.2000', isDefault: false, sortOrder: 6 },
    // X7 Hazard
    { tier: 'x7', category: 'hazard', code: 'no', label: 'Non-hazardous (default)', multiplier: '1.0000', isDefault: true, sortOrder: 7 },
    { tier: 'x7', category: 'hazard', code: 'yes', label: 'Hazardous', multiplier: '1.3000', isDefault: false, sortOrder: 8 },
    // X7 Density
    { tier: 'x7', category: 'density', code: '0', label: 'Wide Open', multiplier: '0.6000', isDefault: false, sortOrder: 9 },
    { tier: 'x7', category: 'density', code: '1', label: 'Spacious', multiplier: '0.8000', isDefault: false, sortOrder: 10 },
    { tier: 'x7', category: 'density', code: '2', label: 'Standard (default)', multiplier: '1.0000', isDefault: true, sortOrder: 11 },
    { tier: 'x7', category: 'density', code: '3', label: 'Dense', multiplier: '1.2000', isDefault: false, sortOrder: 12 },
    { tier: 'x7', category: 'density', code: '4', label: 'Extreme', multiplier: '1.5000', isDefault: false, sortOrder: 13 },
    // SLAM Era
    { tier: 'slam', category: 'era', code: 'modern', label: 'Modern (default)', multiplier: '1.0000', isDefault: true, sortOrder: 14 },
    { tier: 'slam', category: 'era', code: 'historic', label: 'Historic', multiplier: '1.2000', isDefault: false, sortOrder: 15 },
    // SLAM Occupied
    { tier: 'slam', category: 'occupied', code: 'no', label: 'Unoccupied (default)', multiplier: '1.0000', isDefault: true, sortOrder: 16 },
    { tier: 'slam', category: 'occupied', code: 'yes', label: 'Occupied', multiplier: '1.2500', isDefault: false, sortOrder: 17 },
    // SLAM Power
    { tier: 'slam', category: 'power', code: 'no', label: 'Power available (default)', multiplier: '1.0000', isDefault: true, sortOrder: 18 },
    { tier: 'slam', category: 'power', code: 'yes', label: 'No Power/Heat', multiplier: '1.5000', isDefault: false, sortOrder: 19 },
    // SLAM Hazard
    { tier: 'slam', category: 'hazard', code: 'no', label: 'Non-hazardous (default)', multiplier: '1.0000', isDefault: true, sortOrder: 20 },
    { tier: 'slam', category: 'hazard', code: 'yes', label: 'Hazardous', multiplier: '2.0000', isDefault: false, sortOrder: 21 },
    // SLAM Density
    { tier: 'slam', category: 'density', code: '0', label: 'Wide Open', multiplier: '0.8000', isDefault: false, sortOrder: 22 },
    { tier: 'slam', category: 'density', code: '1', label: 'Spacious', multiplier: '0.9000', isDefault: false, sortOrder: 23 },
    { tier: 'slam', category: 'density', code: '2', label: 'Standard (default)', multiplier: '1.0000', isDefault: true, sortOrder: 24 },
    { tier: 'slam', category: 'density', code: '3', label: 'Dense', multiplier: '1.1000', isDefault: false, sortOrder: 25 },
    { tier: 'slam', category: 'density', code: '4', label: 'Extreme', multiplier: '1.2000', isDefault: false, sortOrder: 26 },
];

// ────────────────────────────────────────────────────────────────────────────
// 7. TRAVEL PARAMS (single row)
// ────────────────────────────────────────────────────────────────────────────
const TRAVEL_PARAMS_DATA = {
    mileageRate: '4.00',
    overnightThresholdMi: 75,
    airfareThresholdMi: 300,
    nycFlatSmall: '150.00',
    nycFlatRegional: '300.00',
    hotelCap: '250.00',
    perDiem: '75.00',
    avgAirfare: '500.00',
    carRental: '125.00',
    airportParking: '150.00',
    vehicleMpg: '33.00',
    gasPrice: '4.00',
    srTechTravelRate: '25.00',
    jrTechTravelRate: '17.50',
    avgTravelSpeed: 45,
    irsReimbursementRate: '0.6700',
};

// ────────────────────────────────────────────────────────────────────────────
// 8. SLAM CONFIG (single row)
// ────────────────────────────────────────────────────────────────────────────
const SLAM_CONFIG_DATA = {
    slamScannerRate: '50.00',
    slamAssistRate: '35.00',
    controlSurveyRate: '50.00',
    controlAssistRate: '35.00',
    slamBaselineSqftPerHour: 25000,
};

// ────────────────────────────────────────────────────────────────────────────
// 9. MEGA-BAND BASELINES (6 rows)
// ────────────────────────────────────────────────────────────────────────────
const MEGABAND_BASELINES_DATA = [
    { band: '100k-200k', sqftPerHour: 3000, sortOrder: 1 },
    { band: '200k-500k', sqftPerHour: 5000, sortOrder: 2 },
    { band: '500k-1M', sqftPerHour: 8000, sortOrder: 3 },
    { band: '1M-2M', sqftPerHour: 10000, sortOrder: 4 },
    { band: '2M-5M', sqftPerHour: 15000, sortOrder: 5 },
    { band: '5M+', sqftPerHour: 25000, sortOrder: 6 },
];

// ────────────────────────────────────────────────────────────────────────────
// 10. MEGA-BAND FACTORS (6 rows)
// ────────────────────────────────────────────────────────────────────────────
const MEGABAND_FACTORS_DATA = [
    { band: '100k-200k', factor: '0.7500', dataQuality: '2 anchors', sortOrder: 1 },
    { band: '200k-500k', factor: '0.4200', dataQuality: '2 anchors', sortOrder: 2 },
    { band: '500k-1M', factor: '0.3500', dataQuality: 'Interpolated', sortOrder: 3 },
    { band: '1M-2M', factor: '0.2800', dataQuality: 'Interpolated', sortOrder: 4 },
    { band: '2M-5M', factor: '0.1800', dataQuality: 'Interpolated', sortOrder: 5 },
    { band: '5M+', factor: '0.0800', dataQuality: 'Extrapolated', sortOrder: 6 },
];

// ────────────────────────────────────────────────────────────────────────────
// 14. LANDSCAPE PARAMS (single row)
// ────────────────────────────────────────────────────────────────────────────
const LANDSCAPE_PARAMS_DATA = {
    urbanThroughput: '1.000',
    naturalThroughput: '0.500',
};

// ────────────────────────────────────────────────────────────────────────────
// 11-13 & 15. RATE TABLES (representative subset)
// Full data should be imported from Excel separately.
// ────────────────────────────────────────────────────────────────────────────

// Helper to generate arch rates for a building type across all bands and LoDs
function generateArchRatesForType(
    typeNum: number,
    ratesPerBand: Record<string, { lod200: [number, number]; lod300: [number, number]; lod350: [number, number] }>,
): Array<{ buildingTypeNum: number; band: string; lod: string; upptPerSqft: string; scanPerSqft: string; sortOrder: number }> {
    const rows: Array<{ buildingTypeNum: number; band: string; lod: string; upptPerSqft: string; scanPerSqft: string; sortOrder: number }> = [];
    let order = (typeNum - 1) * 27 + 1; // 9 bands × 3 LoDs per type
    for (const [band, rates] of Object.entries(ratesPerBand)) {
        for (const [lod, [uppt, scan]] of Object.entries({ '200': rates.lod200, '300': rates.lod300, '350': rates.lod350 })) {
            rows.push({
                buildingTypeNum: typeNum,
                band,
                lod,
                upptPerSqft: uppt.toFixed(6),
                scanPerSqft: scan.toFixed(6),
                sortOrder: order++,
            });
        }
    }
    return rows;
}

// Type 1: Res Std (SF) — baseline reference type
const TYPE1_RATES = generateArchRatesForType(1, {
    '0-5k': { lod200: [0.45, 0.125], lod300: [0.60, 0.125], lod350: [0.80, 0.125] },
    '5k-10k': { lod200: [0.28, 0.067], lod300: [0.40, 0.067], lod350: [0.55, 0.067] },
    '10k-20k': { lod200: [0.22, 0.063], lod300: [0.32, 0.063], lod350: [0.45, 0.063] },
    '20k-30k': { lod200: [0.18, 0.050], lod300: [0.26, 0.050], lod350: [0.38, 0.050] },
    '30k-40k': { lod200: [0.16, 0.050], lod300: [0.24, 0.050], lod350: [0.35, 0.050] },
    '40k-50k': { lod200: [0.14, 0.050], lod300: [0.22, 0.050], lod350: [0.32, 0.050] },
    '50k-75k': { lod200: [0.12, 0.050], lod300: [0.20, 0.050], lod350: [0.28, 0.050] },
    '75k-100k': { lod200: [0.10, 0.050], lod300: [0.18, 0.050], lod350: [0.25, 0.050] },
    '100k+': { lod200: [0.08, 0.038], lod300: [0.15, 0.038], lod350: [0.22, 0.038] },
});

// Type 4: Commercial/Office
const TYPE4_RATES = generateArchRatesForType(4, {
    '0-5k': { lod200: [0.42, 0.089], lod300: [0.56, 0.089], lod350: [0.75, 0.089] },
    '5k-10k': { lod200: [0.26, 0.048], lod300: [0.38, 0.048], lod350: [0.52, 0.048] },
    '10k-20k': { lod200: [0.20, 0.045], lod300: [0.30, 0.045], lod350: [0.42, 0.045] },
    '20k-30k': { lod200: [0.17, 0.036], lod300: [0.25, 0.036], lod350: [0.35, 0.036] },
    '30k-40k': { lod200: [0.15, 0.036], lod300: [0.22, 0.036], lod350: [0.32, 0.036] },
    '40k-50k': { lod200: [0.13, 0.036], lod300: [0.20, 0.036], lod350: [0.28, 0.036] },
    '50k-75k': { lod200: [0.11, 0.036], lod300: [0.18, 0.036], lod350: [0.25, 0.036] },
    '75k-100k': { lod200: [0.09, 0.036], lod300: [0.16, 0.036], lod350: [0.22, 0.036] },
    '100k+': { lod200: [0.07, 0.027], lod300: [0.13, 0.027], lod350: [0.19, 0.027] },
});

// Type 11: Warehouse/Storage
const TYPE11_RATES = generateArchRatesForType(11, {
    '0-5k': { lod200: [0.30, 0.021], lod300: [0.42, 0.021], lod350: [0.56, 0.021] },
    '5k-10k': { lod200: [0.18, 0.011], lod300: [0.26, 0.011], lod350: [0.36, 0.011] },
    '10k-20k': { lod200: [0.14, 0.010], lod300: [0.20, 0.010], lod350: [0.28, 0.010] },
    '20k-30k': { lod200: [0.11, 0.008], lod300: [0.16, 0.008], lod350: [0.22, 0.008] },
    '30k-40k': { lod200: [0.10, 0.008], lod300: [0.14, 0.008], lod350: [0.20, 0.008] },
    '40k-50k': { lod200: [0.08, 0.008], lod300: [0.12, 0.008], lod350: [0.18, 0.008] },
    '50k-75k': { lod200: [0.07, 0.008], lod300: [0.10, 0.008], lod350: [0.15, 0.008] },
    '75k-100k': { lod200: [0.06, 0.008], lod300: [0.09, 0.008], lod350: [0.13, 0.008] },
    '100k+': { lod200: [0.04, 0.006], lod300: [0.07, 0.006], lod350: [0.10, 0.006] },
});

const ARCH_RATES_DATA = [...TYPE1_RATES, ...TYPE4_RATES, ...TYPE11_RATES];

// Representative add-on rates (structure, mepf, grade for types 1 and 4)
function generateAddonRates(
    discipline: string,
    typeNum: number,
    ratesByBand: Record<string, { lod200: number; lod300: number; lod350: number }>,
    startOrder: number,
): Array<{ discipline: string; buildingTypeNum: number; band: string; lod: string; upptPerSqft: string; sortOrder: number }> {
    const rows: Array<{ discipline: string; buildingTypeNum: number; band: string; lod: string; upptPerSqft: string; sortOrder: number }> = [];
    let order = startOrder;
    for (const [band, rates] of Object.entries(ratesByBand)) {
        for (const [lod, uppt] of Object.entries({ '200': rates.lod200, '300': rates.lod300, '350': rates.lod350 })) {
            rows.push({ discipline, buildingTypeNum: typeNum, band, lod, upptPerSqft: uppt.toFixed(6), sortOrder: order++ });
        }
    }
    return rows;
}

const ADDON_RATES_DATA = [
    // Structure - Type 1
    ...generateAddonRates('structure', 1, {
        '0-5k': { lod200: 0.12, lod300: 0.15, lod350: 0.20 },
        '5k-10k': { lod200: 0.08, lod300: 0.10, lod350: 0.14 },
        '10k-20k': { lod200: 0.06, lod300: 0.08, lod350: 0.11 },
        '20k-30k': { lod200: 0.05, lod300: 0.07, lod350: 0.10 },
        '30k-40k': { lod200: 0.04, lod300: 0.06, lod350: 0.09 },
        '40k-50k': { lod200: 0.04, lod300: 0.06, lod350: 0.08 },
        '50k-75k': { lod200: 0.03, lod300: 0.05, lod350: 0.07 },
        '75k-100k': { lod200: 0.03, lod300: 0.04, lod350: 0.06 },
        '100k+': { lod200: 0.02, lod300: 0.04, lod350: 0.05 },
    }, 1),
    // MEPF - Type 1
    ...generateAddonRates('mepf', 1, {
        '0-5k': { lod200: 0.16, lod300: 0.20, lod350: 0.28 },
        '5k-10k': { lod200: 0.10, lod300: 0.14, lod350: 0.19 },
        '10k-20k': { lod200: 0.08, lod300: 0.11, lod350: 0.15 },
        '20k-30k': { lod200: 0.06, lod300: 0.09, lod350: 0.13 },
        '30k-40k': { lod200: 0.05, lod300: 0.08, lod350: 0.12 },
        '40k-50k': { lod200: 0.05, lod300: 0.07, lod350: 0.10 },
        '50k-75k': { lod200: 0.04, lod300: 0.06, lod350: 0.09 },
        '75k-100k': { lod200: 0.03, lod300: 0.05, lod350: 0.08 },
        '100k+': { lod200: 0.03, lod300: 0.05, lod350: 0.07 },
    }, 100),
    // Grade - Type 1
    ...generateAddonRates('grade', 1, {
        '0-5k': { lod200: 0.06, lod300: 0.08, lod350: 0.10 },
        '5k-10k': { lod200: 0.04, lod300: 0.06, lod350: 0.08 },
        '10k-20k': { lod200: 0.03, lod300: 0.05, lod350: 0.07 },
        '20k-30k': { lod200: 0.03, lod300: 0.04, lod350: 0.06 },
        '30k-40k': { lod200: 0.02, lod300: 0.04, lod350: 0.05 },
        '40k-50k': { lod200: 0.02, lod300: 0.03, lod350: 0.05 },
        '50k-75k': { lod200: 0.02, lod300: 0.03, lod350: 0.04 },
        '75k-100k': { lod200: 0.01, lod300: 0.02, lod350: 0.04 },
        '100k+': { lod200: 0.01, lod300: 0.02, lod350: 0.03 },
    }, 200),
    // Structure - Type 4
    ...generateAddonRates('structure', 4, {
        '0-5k': { lod200: 0.11, lod300: 0.14, lod350: 0.18 },
        '5k-10k': { lod200: 0.07, lod300: 0.10, lod350: 0.13 },
        '10k-20k': { lod200: 0.06, lod300: 0.08, lod350: 0.11 },
        '20k-30k': { lod200: 0.05, lod300: 0.07, lod350: 0.09 },
        '30k-40k': { lod200: 0.04, lod300: 0.06, lod350: 0.08 },
        '40k-50k': { lod200: 0.04, lod300: 0.05, lod350: 0.07 },
        '50k-75k': { lod200: 0.03, lod300: 0.05, lod350: 0.06 },
        '75k-100k': { lod200: 0.03, lod300: 0.04, lod350: 0.06 },
        '100k+': { lod200: 0.02, lod300: 0.03, lod350: 0.05 },
    }, 300),
    // MEPF - Type 4
    ...generateAddonRates('mepf', 4, {
        '0-5k': { lod200: 0.14, lod300: 0.18, lod350: 0.24 },
        '5k-10k': { lod200: 0.09, lod300: 0.13, lod350: 0.17 },
        '10k-20k': { lod200: 0.08, lod300: 0.10, lod350: 0.14 },
        '20k-30k': { lod200: 0.06, lod300: 0.08, lod350: 0.11 },
        '30k-40k': { lod200: 0.05, lod300: 0.07, lod350: 0.10 },
        '40k-50k': { lod200: 0.04, lod300: 0.06, lod350: 0.09 },
        '50k-75k': { lod200: 0.04, lod300: 0.06, lod350: 0.08 },
        '75k-100k': { lod200: 0.03, lod300: 0.05, lod350: 0.07 },
        '100k+': { lod200: 0.02, lod300: 0.04, lod350: 0.06 },
    }, 400),
];

// CAD rates (9 bands)
const CAD_RATES_DATA = [
    { band: '0-5k', basicUppt: '0.050000', asPlusUppt: '0.080000', fullUppt: '0.120000', sortOrder: 1 },
    { band: '5k-10k', basicUppt: '0.040000', asPlusUppt: '0.060000', fullUppt: '0.100000', sortOrder: 2 },
    { band: '10k-20k', basicUppt: '0.030000', asPlusUppt: '0.050000', fullUppt: '0.080000', sortOrder: 3 },
    { band: '20k-30k', basicUppt: '0.025000', asPlusUppt: '0.042000', fullUppt: '0.068000', sortOrder: 4 },
    { band: '30k-40k', basicUppt: '0.022000', asPlusUppt: '0.038000', fullUppt: '0.062000', sortOrder: 5 },
    { band: '40k-50k', basicUppt: '0.020000', asPlusUppt: '0.035000', fullUppt: '0.055000', sortOrder: 6 },
    { band: '50k-75k', basicUppt: '0.018000', asPlusUppt: '0.030000', fullUppt: '0.050000', sortOrder: 7 },
    { band: '75k-100k', basicUppt: '0.015000', asPlusUppt: '0.025000', fullUppt: '0.042000', sortOrder: 8 },
    { band: '100k+', basicUppt: '0.012000', asPlusUppt: '0.020000', fullUppt: '0.035000', sortOrder: 9 },
];

// Mega-band UppT rates (types 4 and 11 as representative SLAM-eligible types)
const MEGABAND_RATES_DATA = [
    // Type 4 Commercial
    { buildingTypeNum: 4, megaBand: '100k-200k', lod: '200', upptPerSqft: '0.052500', sortOrder: 1 },
    { buildingTypeNum: 4, megaBand: '100k-200k', lod: '300', upptPerSqft: '0.097500', sortOrder: 2 },
    { buildingTypeNum: 4, megaBand: '100k-200k', lod: '350', upptPerSqft: '0.142500', sortOrder: 3 },
    { buildingTypeNum: 4, megaBand: '200k-500k', lod: '200', upptPerSqft: '0.029400', sortOrder: 4 },
    { buildingTypeNum: 4, megaBand: '200k-500k', lod: '300', upptPerSqft: '0.054600', sortOrder: 5 },
    { buildingTypeNum: 4, megaBand: '200k-500k', lod: '350', upptPerSqft: '0.079800', sortOrder: 6 },
    { buildingTypeNum: 4, megaBand: '500k-1M', lod: '200', upptPerSqft: '0.024500', sortOrder: 7 },
    { buildingTypeNum: 4, megaBand: '500k-1M', lod: '300', upptPerSqft: '0.045500', sortOrder: 8 },
    { buildingTypeNum: 4, megaBand: '500k-1M', lod: '350', upptPerSqft: '0.066500', sortOrder: 9 },
    { buildingTypeNum: 4, megaBand: '1M-2M', lod: '200', upptPerSqft: '0.019600', sortOrder: 10 },
    { buildingTypeNum: 4, megaBand: '1M-2M', lod: '300', upptPerSqft: '0.036400', sortOrder: 11 },
    { buildingTypeNum: 4, megaBand: '1M-2M', lod: '350', upptPerSqft: '0.053200', sortOrder: 12 },
    { buildingTypeNum: 4, megaBand: '2M-5M', lod: '200', upptPerSqft: '0.012600', sortOrder: 13 },
    { buildingTypeNum: 4, megaBand: '2M-5M', lod: '300', upptPerSqft: '0.023400', sortOrder: 14 },
    { buildingTypeNum: 4, megaBand: '2M-5M', lod: '350', upptPerSqft: '0.034200', sortOrder: 15 },
    { buildingTypeNum: 4, megaBand: '5M+', lod: '200', upptPerSqft: '0.005600', sortOrder: 16 },
    { buildingTypeNum: 4, megaBand: '5M+', lod: '300', upptPerSqft: '0.010400', sortOrder: 17 },
    { buildingTypeNum: 4, megaBand: '5M+', lod: '350', upptPerSqft: '0.015200', sortOrder: 18 },
    // Type 11 Warehouse
    { buildingTypeNum: 11, megaBand: '100k-200k', lod: '200', upptPerSqft: '0.030000', sortOrder: 19 },
    { buildingTypeNum: 11, megaBand: '100k-200k', lod: '300', upptPerSqft: '0.052500', sortOrder: 20 },
    { buildingTypeNum: 11, megaBand: '100k-200k', lod: '350', upptPerSqft: '0.075000', sortOrder: 21 },
    { buildingTypeNum: 11, megaBand: '200k-500k', lod: '200', upptPerSqft: '0.016800', sortOrder: 22 },
    { buildingTypeNum: 11, megaBand: '200k-500k', lod: '300', upptPerSqft: '0.029400', sortOrder: 23 },
    { buildingTypeNum: 11, megaBand: '200k-500k', lod: '350', upptPerSqft: '0.042000', sortOrder: 24 },
    { buildingTypeNum: 11, megaBand: '500k-1M', lod: '200', upptPerSqft: '0.014000', sortOrder: 25 },
    { buildingTypeNum: 11, megaBand: '500k-1M', lod: '300', upptPerSqft: '0.024500', sortOrder: 26 },
    { buildingTypeNum: 11, megaBand: '500k-1M', lod: '350', upptPerSqft: '0.035000', sortOrder: 27 },
    { buildingTypeNum: 11, megaBand: '1M-2M', lod: '200', upptPerSqft: '0.011200', sortOrder: 28 },
    { buildingTypeNum: 11, megaBand: '1M-2M', lod: '300', upptPerSqft: '0.019600', sortOrder: 29 },
    { buildingTypeNum: 11, megaBand: '1M-2M', lod: '350', upptPerSqft: '0.028000', sortOrder: 30 },
    { buildingTypeNum: 11, megaBand: '2M-5M', lod: '200', upptPerSqft: '0.007200', sortOrder: 31 },
    { buildingTypeNum: 11, megaBand: '2M-5M', lod: '300', upptPerSqft: '0.012600', sortOrder: 32 },
    { buildingTypeNum: 11, megaBand: '2M-5M', lod: '350', upptPerSqft: '0.018000', sortOrder: 33 },
    { buildingTypeNum: 11, megaBand: '5M+', lod: '200', upptPerSqft: '0.003200', sortOrder: 34 },
    { buildingTypeNum: 11, megaBand: '5M+', lod: '300', upptPerSqft: '0.005600', sortOrder: 35 },
    { buildingTypeNum: 11, megaBand: '5M+', lod: '350', upptPerSqft: '0.008000', sortOrder: 36 },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ────────────────────────────────────────────────────────────────────────────
async function seed() {
    console.log('Checking if V2 pricing data already exists...');

    // Idempotent check: if constants row exists, skip seeding
    const existing = await db.select().from(pricingConstants).limit(1);
    if (existing.length > 0) {
        console.log('V2 pricing data already exists — skipping seed.');
        return;
    }

    console.log('Seeding V2 pricing tables...');

    await db.transaction(async (tx) => {
        // 1. Constants
        await tx.insert(pricingConstants).values(CONSTANTS_DATA);
        console.log('  [1/15] pricing_constants ✓');

        // 2. Scan baselines
        await tx.insert(pricingScanBaselines).values(SCAN_BASELINES_DATA);
        console.log('  [2/15] pricing_scan_baselines ✓');

        // 3. Building types
        await tx.insert(pricingBuildingTypes).values(BUILDING_TYPES_DATA);
        console.log('  [3/15] pricing_building_types ✓');

        // 4. Addon markups
        await tx.insert(pricingAddonMarkups).values(ADDON_MARKUPS_DATA);
        console.log('  [4/15] pricing_addon_markups ✓');

        // 5. CAD markups
        await tx.insert(pricingCadMarkups).values(CAD_MARKUPS_DATA);
        console.log('  [5/15] pricing_cad_markups ✓');

        // 6. Scan modifiers
        await tx.insert(pricingScanModifiers).values(SCAN_MODIFIERS_DATA);
        console.log('  [6/15] pricing_scan_modifiers ✓');

        // 7. Travel params
        await tx.insert(pricingTravelParams).values(TRAVEL_PARAMS_DATA);
        console.log('  [7/15] pricing_travel_params ✓');

        // 8. SLAM config
        await tx.insert(pricingSlamConfig).values(SLAM_CONFIG_DATA);
        console.log('  [8/15] pricing_slam_config ✓');

        // 9. Megaband baselines
        await tx.insert(pricingMegabandBaselines).values(MEGABAND_BASELINES_DATA);
        console.log('  [9/15] pricing_megaband_baselines ✓');

        // 10. Megaband factors
        await tx.insert(pricingMegabandFactors).values(MEGABAND_FACTORS_DATA);
        console.log('  [10/15] pricing_megaband_factors ✓');

        // 11. Arch rates
        await tx.insert(pricingArchRates).values(ARCH_RATES_DATA);
        console.log(`  [11/15] pricing_arch_rates (${ARCH_RATES_DATA.length} rows) ✓`);

        // 12. Addon rates
        await tx.insert(pricingAddonRates).values(ADDON_RATES_DATA);
        console.log(`  [12/15] pricing_addon_rates (${ADDON_RATES_DATA.length} rows) ✓`);

        // 13. CAD rates
        await tx.insert(pricingCadRates).values(CAD_RATES_DATA);
        console.log('  [13/15] pricing_cad_rates ✓');

        // 14. Landscape params
        await tx.insert(pricingLandscapeParams).values(LANDSCAPE_PARAMS_DATA);
        console.log('  [14/15] pricing_landscape_params ✓');

        // 15. Megaband rates
        await tx.insert(pricingMegabandRates).values(MEGABAND_RATES_DATA);
        console.log(`  [15/15] pricing_megaband_rates (${MEGABAND_RATES_DATA.length} rows) ✓`);
    });

    console.log('\nV2 pricing seed complete!');
    console.log('Note: Rate tables contain representative data for types 1, 4, and 11.');
    console.log('Run a full Excel import to populate all 13 building types.');
}

seed()
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(() => pool.end());
