// ── Pricing V2 Engine ──
// Pure functions implementing the S2P Pricing v3.1 Excel workbook math.
// All table data is passed in — no DB calls, no side effects.
// This is a SHADOW module: it does NOT replace the existing engine.

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
    V2AreaResult,
    V2QuoteResult,
} from './pricingV2Types.js';

// ────────────────────────────────────────────────────────────────────────────
// BAND HELPERS
// ────────────────────────────────────────────────────────────────────────────

/** Map square footage to the X7 band string used for table lookups. */
export function getBand(sqft: number): string {
    if (sqft <= 3000) return '0-3k';
    if (sqft <= 5000) return '3k-5k';
    if (sqft <= 10000) return '5k-10k';
    if (sqft <= 20000) return '10k-20k';
    if (sqft <= 30000) return '20k-30k';
    if (sqft <= 40000) return '30k-40k';
    if (sqft <= 50000) return '40k-50k';
    if (sqft <= 75000) return '50k-75k';
    if (sqft <= 100000) return '75k-100k';
    return '100k+';
}

/** Map square footage to SLAM mega-band string. */
export function getMegaBand(sqft: number): string {
    if (sqft <= 200000) return '100k-200k';
    if (sqft <= 500000) return '200k-500k';
    if (sqft <= 1000000) return '500k-1M';
    if (sqft <= 2000000) return '1M-2M';
    if (sqft <= 5000000) return '2M-5M';
    return '5M+';
}

// ────────────────────────────────────────────────────────────────────────────
// MULTIPLIER M
// ────────────────────────────────────────────────────────────────────────────

/** Compute f = partner cost rate (with optional BIM Manager surcharge). */
export function computePartnerCostF(c: V2Constants, bimManagerActive: boolean): number {
    const fBase = c.qcPct + c.pmPct + c.cooPct + c.registrationPct;
    return bimManagerActive ? fBase + c.bimManagerPct : fBase;
}

/** Compute a = above-the-line rate. */
export function computeAboveTheLineA(c: V2Constants): number {
    return c.taxPct + c.ownerCompPct + c.salesMarketingPct + c.overheadPct + c.badDebtPct;
}

/** Compute M = 1 / (1 - f - a - s). */
export function computeMultiplierM(c: V2Constants, bimManagerActive: boolean): number {
    const f = computePartnerCostF(c, bimManagerActive);
    const a = computeAboveTheLineA(c);
    const s = c.savingsFloorPct;
    const denominator = 1 - f - a - s;
    if (denominator <= 0) {
        throw new Error(`Invalid M denominator: 1 - ${f} - ${a} - ${s} = ${denominator}`);
    }
    return 1 / denominator;
}

// ────────────────────────────────────────────────────────────────────────────
// MODIFIER STACK
// ────────────────────────────────────────────────────────────────────────────

/** Look up a scan modifier multiplier by (tier, category, code). */
function findModifier(
    modifiers: V2ScanModifier[],
    tier: string,
    category: string,
    code: string,
): number {
    const row = modifiers.find(
        (m) => m.tier === tier && m.category === category && m.code === code,
    );
    if (row) return row.multiplier;
    // Fall back to default for this tier+category
    const def = modifiers.find(
        (m) => m.tier === tier && m.category === category && m.isDefault,
    );
    return def?.multiplier ?? 1.0;
}

/** Compute the multiplicative modifier stack for scan cost.
 *  stack = era × occupied × power × hazard × density × scanScope */
export function computeModifierStack(
    area: V2AreaInput,
    modifiers: V2ScanModifier[],
    tier: string,
    constants: V2Constants,
): number {
    const t = tier.toLowerCase(); // "x7" | "slam"

    const era = findModifier(modifiers, t, 'era', area.era === 'Historic' ? 'historic' : 'modern');
    const occupied = findModifier(modifiers, t, 'occupied', area.occupied ? 'yes' : 'no');
    const power = findModifier(modifiers, t, 'power', area.noPowerHeat ? 'yes' : 'no');
    const hazard = findModifier(modifiers, t, 'hazard', area.hazardous ? 'yes' : 'no');

    // Density: code is the numeric level as string ("0"-"4"), default "2"
    const densityLevel = area.roomDensity ?? 2;
    const density = findModifier(modifiers, t, 'density', String(densityLevel));

    // Scan scope multiplier
    let scanScope = constants.scanScopeFullPct; // 1.0 for Full/Mixed
    if (area.scope === 'Int Only') scanScope = constants.scanScopeIntOnlyPct;
    else if (area.scope === 'Ext Only') scanScope = constants.scanScopeExtOnlyPct;

    return era * occupied * power * hazard * density * scanScope;
}

// ────────────────────────────────────────────────────────────────────────────
// SCAN COST
// ────────────────────────────────────────────────────────────────────────────

/** Look up scan throughput baseline (sqft/hr) for a band. */
function lookupScanBaseline(baselines: V2ScanBaseline[], band: string): number {
    const row = baselines.find((b) => b.band === band);
    return row?.sqftPerHour ?? 1000; // safe fallback
}

/** Look up building type info. */
function lookupBuildingType(types: V2BuildingType[], typeNum: number): V2BuildingType {
    const t = types.find((bt) => bt.typeNumber === typeNum);
    if (!t) throw new Error(`Unknown building type number: ${typeNum}`);
    return t;
}

/** Compute X7 scan cost per sqft.
 *  scanCost = techRate / (baseline × throughputRatio) */
export function computeX7ScanCost(
    constants: V2Constants,
    baselines: V2ScanBaseline[],
    buildingTypes: V2BuildingType[],
    typeNum: number,
    band: string,
    scannerAssignment: string,
): number {
    const baseline = lookupScanBaseline(baselines, band);
    const bt = lookupBuildingType(buildingTypes, typeNum);
    const throughput = baseline * bt.throughputRatio;
    if (throughput <= 0) return 0;
    const rate = scannerAssignment === 'Jr' ? constants.jrTechRate : constants.srTechRate;
    return rate / throughput;
}

/** Compute SLAM scan cost per sqft.
 *  slamScanCost = crewRate / (slamBaseline × slamTypeRatio)
 *  crewRate is a composite from the SLAM config. */
export function computeSlamScanCost(
    slamConfig: V2SlamConfig,
    buildingTypes: V2BuildingType[],
    typeNum: number,
): number {
    const bt = lookupBuildingType(buildingTypes, typeNum);
    if (!bt.slamEligible || bt.slamThroughputRatio == null || bt.slamThroughputRatio === 0) {
        return 0; // Not SLAM-eligible, should have been caught by tier resolution
    }
    const throughput = slamConfig.slamBaselineSqftPerHour * bt.slamThroughputRatio;
    if (throughput <= 0) return 0;
    // Composite crew rate = scanner + assist (2-person crew)
    const crewRate = slamConfig.slamScannerRate + slamConfig.slamAssistRate;
    return crewRate / throughput;
}

// ────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE PRICING (UppT + Scan → varCOGS → price)
// ────────────────────────────────────────────────────────────────────────────

/** Look up architecture UppT per sqft from rate tables. */
function lookupArchUppt(
    archRates: V2ArchRate[],
    typeNum: number,
    band: string,
    lod: string,
): number {
    const row = archRates.find(
        (r) => r.buildingTypeNum === typeNum && r.band === band && r.lod === lod,
    );
    return row?.upptPerSqft ?? 0;
}

/** Look up mega-band UppT per sqft for SLAM tier. */
function lookupMegabandUppt(
    megabandRates: V2MegabandRate[],
    typeNum: number,
    megaBand: string,
    lod: string,
): number {
    const row = megabandRates.find(
        (r) => r.buildingTypeNum === typeNum && r.megaBand === megaBand && r.lod === lod,
    );
    return row?.upptPerSqft ?? 0;
}

/** Compute UppT scope discount multiplier. */
function getUpptScopeMultiplier(scope: string, c: V2Constants): number {
    if (scope === 'Int Only') return c.upptScopeIntOnlyPct;
    if (scope === 'Ext Only') return c.upptScopeExtOnlyPct;
    return 1.0; // Full or Mixed (Mixed handles blending separately)
}

/** Compute arch UppT for an area, handling scope and mixed blending.
 *  For Mixed scope: blends 65% interior + 35% exterior UppT.
 *  For Int/Ext Only: applies scope discount. */
function computeArchUppt(
    area: V2AreaInput,
    tables: V2PricingTables,
    band: string,
    tier: string,
): number {
    if (tier === 'SLAM') {
        const megaBand = getMegaBand(area.squareFootage);
        if (area.scope === 'Mixed') {
            const intLod = area.mixedInteriorLod ?? area.lod;
            const extLod = area.mixedExteriorLod ?? area.lod;
            const intUppt = lookupMegabandUppt(tables.megabandRates, area.buildingTypeNum, megaBand, intLod);
            const extUppt = lookupMegabandUppt(tables.megabandRates, area.buildingTypeNum, megaBand, extLod);
            return tables.constants.mixedInteriorWeight * intUppt
                + tables.constants.mixedExteriorWeight * extUppt;
        }
        const baseUppt = lookupMegabandUppt(tables.megabandRates, area.buildingTypeNum, megaBand, area.lod);
        return baseUppt * getUpptScopeMultiplier(area.scope, tables.constants);
    }

    // X7 tier
    if (area.scope === 'Mixed') {
        const intLod = area.mixedInteriorLod ?? area.lod;
        const extLod = area.mixedExteriorLod ?? area.lod;
        const intUppt = lookupArchUppt(tables.archRates, area.buildingTypeNum, band, intLod);
        const extUppt = lookupArchUppt(tables.archRates, area.buildingTypeNum, band, extLod);
        return tables.constants.mixedInteriorWeight * intUppt
            + tables.constants.mixedExteriorWeight * extUppt;
    }
    const baseUppt = lookupArchUppt(tables.archRates, area.buildingTypeNum, band, area.lod);
    return baseUppt * getUpptScopeMultiplier(area.scope, tables.constants);
}

/** Compute architecture price for a single area.
 *  Returns { upptPerSqft, scanPerSqft, vcogsPerSqft, pricePerSqft, total } */
export function computeArchPrice(
    area: V2AreaInput,
    tables: V2PricingTables,
    M: number,
    tier: string,
    modifierStack: number,
): { upptPerSqft: number; scanPerSqft: number; vcogsPerSqft: number; pricePerSqft: number; total: number } {
    const band = getBand(area.squareFootage);
    const scanner = area.scannerAssignment ?? 'Sr';

    // UppT
    const upptPerSqft = computeArchUppt(area, tables, band, tier);

    // Scan cost (base, before modifiers)
    let baseScanPerSqft: number;
    if (tier === 'SLAM') {
        baseScanPerSqft = computeSlamScanCost(tables.slamConfig, tables.buildingTypes, area.buildingTypeNum);
    } else {
        baseScanPerSqft = computeX7ScanCost(
            tables.constants, tables.scanBaselines, tables.buildingTypes,
            area.buildingTypeNum, band, scanner,
        );
    }

    // Scanner assignment adjustment (Jr tech discount — X7 only, SLAM always 1.0)
    const scannerAdj = (tier === 'X7' && scanner === 'Jr')
        ? tables.constants.jrTechRate / tables.constants.srTechRate
        : 1.0;

    // Adjusted scan = base × scannerAdj × modifierStack
    const adjustedScanPerSqft = baseScanPerSqft * scannerAdj * modifierStack;

    // varCOGS = UppT + adjustedScan
    const vcogsPerSqft = upptPerSqft + adjustedScanPerSqft;

    // Price = varCOGS × M
    const pricePerSqft = vcogsPerSqft * M;
    const total = pricePerSqft * area.squareFootage;

    return { upptPerSqft, scanPerSqft: adjustedScanPerSqft, vcogsPerSqft, pricePerSqft, total };
}

// ────────────────────────────────────────────────────────────────────────────
// ADD-ON PRICING (Structure, MEPF, Grade)
// ────────────────────────────────────────────────────────────────────────────

/** Look up add-on UppT from rate table. */
function lookupAddonUppt(
    addonRates: V2AddonRate[],
    discipline: string,
    typeNum: number,
    band: string,
    lod: string,
): number {
    const row = addonRates.find(
        (r) => r.discipline === discipline && r.buildingTypeNum === typeNum && r.band === band && r.lod === lod,
    );
    return row?.upptPerSqft ?? 0;
}

/** Look up add-on markup multiplier for a band. */
function lookupAddonMarkup(
    markups: V2AddonMarkup[],
    band: string,
    discipline: string,
): number {
    const row = markups.find((m) => m.band === band);
    if (!row) return 1.0;
    if (discipline === 'structure') return row.structureMarkup;
    if (discipline === 'mepf') return row.mepfMarkup;
    if (discipline === 'grade') return row.gradeMarkup;
    return 1.0;
}

/** Compute add-on price per sqft for a discipline.
 *  addOnPerSqft = UppT × markup × scopeDiscount
 *  Note: Grade does NOT get scope discount. */
export function computeAddonPerSqft(
    discipline: string,
    area: V2AreaInput,
    tables: V2PricingTables,
): number {
    const band = getBand(area.squareFootage);
    const uppt = lookupAddonUppt(tables.addonRates, discipline, area.buildingTypeNum, band, area.lod);
    const markup = lookupAddonMarkup(tables.addonMarkups, band, discipline);

    // Scope discount — Grade is exempt
    let scopeDiscount = 1.0;
    if (discipline !== 'grade') {
        scopeDiscount = getUpptScopeMultiplier(area.scope, tables.constants);
    }

    return uppt * markup * scopeDiscount;
}

// ────────────────────────────────────────────────────────────────────────────
// CAD CONVERSION PRICING
// ────────────────────────────────────────────────────────────────────────────

/** Look up CAD conversion rate per sqft by band and package. */
function lookupCadMarkup(cadMarkups: V2CadMarkup[], band: string): V2CadMarkup | undefined {
    return cadMarkups.find((c) => c.band === band);
}

/** Look up CAD UppT from rate table. */
function lookupCadUppt(cadRates: V2CadRate[], band: string, pkg: string): number {
    const row = cadRates.find((r) => r.band === band);
    if (!row) return 0;
    if (pkg === 'Basic') return row.basicUppt;
    if (pkg === 'A+S') return row.asPlusUppt;
    if (pkg === 'Full') return row.fullUppt;
    return 0;
}

/** Compute CAD conversion per sqft. */
export function computeCadPerSqft(
    area: V2AreaInput,
    tables: V2PricingTables,
): number {
    if (!area.cadConversion) return 0;
    const band = getBand(area.squareFootage);
    const pkg = area.cadPackage ?? 'Basic';

    const uppt = lookupCadUppt(tables.cadRates, band, pkg);
    const markupRow = lookupCadMarkup(tables.cadMarkups, band);
    if (!markupRow) return uppt; // no markup found, return raw UppT

    let markup = 1.0;
    if (pkg === 'Basic') markup = markupRow.basicMarkup;
    else if (pkg === 'A+S') markup = markupRow.asPlusMarkup;
    else if (pkg === 'Full') markup = markupRow.fullMarkup;

    return uppt * markup;
}

// ────────────────────────────────────────────────────────────────────────────
// AREA RESULT COMPUTATION
// ────────────────────────────────────────────────────────────────────────────

/** Compute the full pricing result for a single area. */
export function computeAreaResult(
    area: V2AreaInput,
    tables: V2PricingTables,
    M: number,
    tier: string,
): V2AreaResult {
    const sqft = area.squareFootage;
    const modStack = computeModifierStack(area, tables.scanModifiers, tier, tables.constants);

    // Architecture
    const arch = computeArchPrice(area, tables, M, tier, modStack);

    // Add-ons (per sqft × sqft)
    const structPerSqft = area.structure ? computeAddonPerSqft('structure', area, tables) : 0;
    const mepfPerSqft = area.mepf ? computeAddonPerSqft('mepf', area, tables) : 0;
    const gradePerSqft = area.grade ? computeAddonPerSqft('grade', area, tables) : 0;

    // CAD conversion
    const cadPerSqft = computeCadPerSqft(area, tables);

    // Matterport
    const matterportTotal = area.matterport ? tables.constants.matterportPerSqft * sqft : 0;

    // Georeferencing (flat fee)
    const georeferencingTotal = area.georeferencing ? tables.constants.georeferencingFee : 0;

    // Totals
    const structureTotal = structPerSqft * sqft;
    const mepfTotal = mepfPerSqft * sqft;
    const gradeTotal = gradePerSqft * sqft;
    const cadTotal = cadPerSqft * sqft;

    const subtotalBim = arch.total + structureTotal + mepfTotal + gradeTotal;
    const baseProjectTotal = subtotalBim + cadTotal + matterportTotal + georeferencingTotal;

    return {
        archPerSqft: arch.pricePerSqft,
        archTotal: arch.total,
        structurePerSqft: structPerSqft,
        structureTotal,
        mepfPerSqft: mepfPerSqft,
        mepfTotal,
        gradePerSqft: gradePerSqft,
        gradeTotal,
        cadPerSqft,
        cadTotal,
        matterportTotal,
        georeferencingTotal,
        subtotalBim,
        baseProjectTotal,
        modifierStack: modStack,
        upptArchPerSqft: arch.upptPerSqft,
        scanEstPerSqft: arch.scanPerSqft,
        adjustedVcogsPerSqft: arch.vcogsPerSqft,
    };
}

// ────────────────────────────────────────────────────────────────────────────
// TRAVEL COST
// ────────────────────────────────────────────────────────────────────────────

/** Determine travel mode based on distance. */
function getTravelMode(distanceMi: number, travel: V2TravelParams): 'nyc' | 'truck' | 'flight' {
    // NYC = local (within overnight threshold, approximated by short distance)
    if (distanceMi <= 20) return 'nyc';
    if (distanceMi > travel.airfareThresholdMi) return 'flight';
    return 'truck';
}

/** Compute travel cost.
 *  Modes: NYC (flat), Truck (mileage + optional overnight), Flight (airfare + car + parking). */
export function computeTravelCost(
    travel: V2TravelParams,
    distanceMi: number,
    scanDays: number,
    numTechs: number,
): number {
    if (distanceMi <= 0) return 0;

    const mode = getTravelMode(distanceMi, travel);

    let mileage = 0;
    let hotel = 0;
    let perDiem = 0;
    let airfare = 0;
    let carRental = 0;
    let airportParking = 0;

    if (mode === 'nyc') {
        // NYC flat rate
        mileage = scanDays <= 1 ? travel.nycFlatSmall : travel.nycFlatRegional;
    } else if (mode === 'truck') {
        const isOvernight = distanceMi > travel.overnightThresholdMi;
        if (isOvernight) {
            // Single trip out + daily per diem/hotel
            mileage = distanceMi * travel.mileageRate;
            hotel = travel.hotelCap * scanDays;
            perDiem = travel.perDiem * scanDays;
        } else {
            // Daily round-trip
            mileage = distanceMi * travel.mileageRate * scanDays;
        }
    } else {
        // Flight mode
        airfare = travel.avgAirfare * numTechs;
        carRental = travel.carRental * (scanDays + 1); // +1 for travel day
        airportParking = travel.airportParking;
        hotel = travel.hotelCap * scanDays;
        perDiem = travel.perDiem * scanDays;
    }

    return mileage + hotel + perDiem + airfare + carRental + airportParking;
}

// ────────────────────────────────────────────────────────────────────────────
// TIER RESOLUTION
// ────────────────────────────────────────────────────────────────────────────

/** Resolve whether to use X7 or SLAM tier.
 *  Rules: Types 1 (SFR), 3 (Luxury), 13 (Infra) always X7.
 *         If total sqft >= threshold and SLAM-eligible, auto-SLAM.
 *         Explicit override honored. */
export function resolveTier(
    input: V2ProjectInput,
    tables: V2PricingTables,
): string {
    const totalSqft = input.areas.reduce((sum, a) => sum + a.squareFootage, 0);

    // Explicit override
    if (input.pricingTier === 'X7') return 'X7';
    if (input.pricingTier === 'SLAM') {
        // Verify all areas are SLAM-eligible
        const allEligible = input.areas.every((a) => {
            const bt = tables.buildingTypes.find((t) => t.typeNumber === a.buildingTypeNum);
            return bt?.slamEligible ?? false;
        });
        return allEligible ? 'SLAM' : 'X7';
    }

    // AUTO: check threshold and eligibility
    if (totalSqft >= tables.constants.tierAThresholdSqft) {
        const allEligible = input.areas.every((a) => {
            const bt = tables.buildingTypes.find((t) => t.typeNumber === a.buildingTypeNum);
            return bt?.slamEligible ?? false;
        });
        if (allEligible) return 'SLAM';
    }

    return 'X7';
}

/** Resolve BIM Manager activation.
 *  YES/NO = explicit. AUTO = active when tier is SLAM (whale). */
export function resolveBimManager(
    input: V2ProjectInput,
    tier: string,
): boolean {
    if (input.bimManager === 'YES') return true;
    if (input.bimManager === 'NO') return false;
    // AUTO: active for SLAM/whale projects
    return tier === 'SLAM';
}

// ────────────────────────────────────────────────────────────────────────────
// SCAN DAY / TECH COUNT ESTIMATION
// ────────────────────────────────────────────────────────────────────────────

/** Estimate scan days from total sqft and throughput.
 *  Uses an 8-hour field day baseline. */
export function estimateScanDays(
    areas: V2AreaInput[],
    tables: V2PricingTables,
    tier: string,
): number {
    const hoursPerDay = 8;
    let totalHours = 0;

    for (const area of areas) {
        const band = getBand(area.squareFootage);
        let throughputSqftPerHr: number;

        if (tier === 'SLAM') {
            const bt = lookupBuildingType(tables.buildingTypes, area.buildingTypeNum);
            throughputSqftPerHr = tables.slamConfig.slamBaselineSqftPerHour * (bt.slamThroughputRatio ?? 1);
        } else {
            const baseline = lookupScanBaseline(tables.scanBaselines, band);
            const bt = lookupBuildingType(tables.buildingTypes, area.buildingTypeNum);
            throughputSqftPerHr = baseline * bt.throughputRatio;
        }

        if (throughputSqftPerHr > 0) {
            totalHours += area.squareFootage / throughputSqftPerHr;
        }
    }

    return Math.max(1, Math.ceil(totalHours / hoursPerDay));
}

/** Estimate number of techs needed. */
export function estimateNumTechs(tier: string): number {
    return tier === 'SLAM' ? 2 : 1;
}

// ────────────────────────────────────────────────────────────────────────────
// FLOOR ENFORCEMENT
// ────────────────────────────────────────────────────────────────────────────

/** Compute floor adjustment to guarantee savings floor margin.
 *  If the auto-floor is active and the computed price doesn't meet the
 *  savings floor, this returns the amount to add. */
export function computeFloorAdjustment(
    constants: V2Constants,
    baseProjectTotal: number,
    travelCharge: number,
    expeditedSurcharge: number,
    bimManagerActive: boolean,
): number {
    if (!constants.autoFloorActive) return 0;

    const f = computePartnerCostF(constants, bimManagerActive);
    const s = constants.savingsFloorPct;

    // Cost floor = total COGS / (1 - f - s)
    // This ensures at least s% margin after partner costs
    const denominator = 1 - f - s;
    if (denominator <= 0) return 0;

    const currentTotal = baseProjectTotal + travelCharge + expeditedSurcharge;
    // Approximate COGS as currentTotal / M (reverse the markup)
    // Then re-derive what the floor should be
    const M = computeMultiplierM(constants, bimManagerActive);
    const approxCogs = currentTotal / M;
    const costFloor = approxCogs / denominator * (1 / (1 - computeAboveTheLineA(constants)));

    // If current total is already above the floor, no adjustment needed
    if (currentTotal >= costFloor) return 0;
    return costFloor - currentTotal;
}

// ────────────────────────────────────────────────────────────────────────────
// MASTER ORCHESTRATOR
// ────────────────────────────────────────────────────────────────────────────

/** Compute a complete project quote using the V2 engine.
 *  This is the main entry point — equivalent to the Project Calculator sheet. */
export function computeProjectQuoteV2(
    input: V2ProjectInput,
    tables: V2PricingTables,
): V2QuoteResult {
    // 1. Resolve tier and BIM Manager
    const resolvedTier = resolveTier(input, tables);
    const bimManagerActive = resolveBimManager(input, resolvedTier);

    // 2. Compute M
    const M = computeMultiplierM(tables.constants, bimManagerActive);
    const f = computePartnerCostF(tables.constants, bimManagerActive);
    const a = computeAboveTheLineA(tables.constants);
    const s = tables.constants.savingsFloorPct;

    // 3. Compute each area
    const areaResults: V2AreaResult[] = input.areas.map((area) =>
        computeAreaResult(area, tables, M, resolvedTier),
    );

    // 4. Sum base project total across all areas
    const baseProjectTotal = areaResults.reduce((sum, ar) => sum + ar.baseProjectTotal, 0);

    // 5. Travel
    const scanDays = input.scanDays ?? estimateScanDays(input.areas, tables, resolvedTier);
    const numTechs = input.numTechs ?? estimateNumTechs(resolvedTier);
    const travelCharge = input.travelOverride
        ?? computeTravelCost(tables.travelParams, input.travelDistanceMi ?? 0, scanDays, numTechs);

    // 6. Expedited surcharge (applied to base project total, not travel)
    const expeditedSurcharge = input.expedited
        ? baseProjectTotal * tables.constants.expeditedPct
        : 0;

    // 7. Floor adjustment
    const floorAdjustment = computeFloorAdjustment(
        tables.constants, baseProjectTotal, travelCharge, expeditedSurcharge, bimManagerActive,
    );

    // 8. Total before minimum check
    let totalQuote = baseProjectTotal + travelCharge + expeditedSurcharge + floorAdjustment;

    // 9. Minimum check
    const hasAddOns = input.areas.some((a) => a.structure || a.mepf || a.grade);
    const minimumFloor = hasAddOns
        ? tables.constants.fullServiceMinimum
        : tables.constants.archMinimum;
    const minimumApplied = totalQuote < minimumFloor ? minimumFloor : 0;
    if (minimumApplied > 0) {
        totalQuote = minimumFloor;
    }

    return {
        areas: areaResults,
        baseProjectTotal,
        travelCharge,
        expeditedSurcharge,
        floorAdjustment,
        totalQuote,
        minimumApplied,
        resolvedTier,
        bimManagerActive,
        multiplierM: M,
        partnerCostF: f,
        aboveTheLineA: a,
        savingsFloorS: s,
    };
}
