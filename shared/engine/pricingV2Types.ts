// ── Pricing V2 Types ──
// Input/output types for the Excel-based pricing engine (System B).
// All table shapes match Drizzle select() return types from shared/schema/pricing.ts.
// The engine receives these as arguments — no DB calls in the engine.

// ────────────────────────────────────────────────────────────────────────────
// TABLE DATA SHAPES (passed to engine functions)
// ────────────────────────────────────────────────────────────────────────────

/** Control Panel constants — single row with all CEO-tunable percentages/rates */
export interface V2Constants {
    // Section A: Above-the-Line
    taxPct: number;
    ownerCompPct: number;
    salesMarketingPct: number;
    overheadPct: number;
    badDebtPct: number;

    // Section B: Partner Costs
    qcPct: number;
    pmPct: number;
    cooPct: number;
    registrationPct: number;

    // Section C: Savings Floor
    savingsFloorPct: number;

    // Section E: Scanner Rates
    srTechRate: number;   // $/hr
    jrTechRate: number;   // $/hr

    // Section M: Whale / BIM Manager
    bimManagerPct: number;
    tierAThresholdSqft: number;

    // Section T: Minimums
    archMinimum: number;
    fullServiceMinimum: number;

    // Section U: Floor Enforcement
    autoFloorActive: boolean;

    // Extras
    expeditedPct: number;
    matterportPerSqft: number;
    georeferencingFee: number;

    // Scope weights
    mixedInteriorWeight: number;
    mixedExteriorWeight: number;
    scanScopeFullPct: number;
    scanScopeIntOnlyPct: number;
    scanScopeExtOnlyPct: number;
    upptScopeIntOnlyPct: number;
    upptScopeExtOnlyPct: number;

    // Equipment amort (optional)
    slamUnitCost: number;
    controlEquipCost: number;
    equipAmortYears: number;
    fieldDaysPerYear: number;
    includeEquipAmort: boolean;
}

/** Scan throughput baseline by band */
export interface V2ScanBaseline {
    band: string;
    sqftPerHour: number;
}

/** Building type with throughput ratio */
export interface V2BuildingType {
    typeNumber: number;
    name: string;
    throughputRatio: number;
    slamEligible: boolean;
    slamThroughputRatio: number | null;
}

/** Add-on markup by band */
export interface V2AddonMarkup {
    band: string;
    structureMarkup: number;
    mepfMarkup: number;
    gradeMarkup: number;
}

/** CAD markup by band */
export interface V2CadMarkup {
    band: string;
    basicMarkup: number;
    asPlusMarkup: number;
    fullMarkup: number;
}

/** Scan modifier (era, occupied, power, hazard, density) */
export interface V2ScanModifier {
    tier: string;       // "x7" | "slam"
    category: string;   // "era" | "occupied" | "power" | "hazard" | "density"
    code: string;
    label: string;
    multiplier: number;
    isDefault: boolean;
}

/** Travel parameters */
export interface V2TravelParams {
    mileageRate: number;
    overnightThresholdMi: number;
    airfareThresholdMi: number;
    nycFlatSmall: number;
    nycFlatRegional: number;
    hotelCap: number;
    perDiem: number;
    avgAirfare: number;
    carRental: number;
    airportParking: number;
    vehicleMpg: number;
    gasPrice: number;
    srTechTravelRate: number;
    jrTechTravelRate: number;
    avgTravelSpeed: number;
    irsReimbursementRate: number;
}

/** SLAM scanner config */
export interface V2SlamConfig {
    slamScannerRate: number;
    slamAssistRate: number;
    controlSurveyRate: number;
    controlAssistRate: number;
    slamBaselineSqftPerHour: number;
}

/** Mega-band baseline */
export interface V2MegabandBaseline {
    band: string;
    sqftPerHour: number;
}

/** Mega-band discount factor */
export interface V2MegabandFactor {
    band: string;
    factor: number;
}

/** Arch COGS rate row */
export interface V2ArchRate {
    buildingTypeNum: number;
    band: string;
    lod: string;
    upptPerSqft: number;
    scanPerSqft: number;
}

/** Add-on rate row */
export interface V2AddonRate {
    discipline: string; // "structure" | "mepf" | "grade"
    buildingTypeNum: number;
    band: string;
    lod: string;
    upptPerSqft: number;
}

/** CAD rate row */
export interface V2CadRate {
    band: string;
    basicUppt: number;
    asPlusUppt: number;
    fullUppt: number;
}

/** Mega-band UppT rate row */
export interface V2MegabandRate {
    buildingTypeNum: number;
    megaBand: string;
    lod: string;
    upptPerSqft: number;
}

// ────────────────────────────────────────────────────────────────────────────
// BUNDLED TABLE DATA (all tables in one object)
// ────────────────────────────────────────────────────────────────────────────

export interface V2PricingTables {
    constants: V2Constants;
    scanBaselines: V2ScanBaseline[];
    buildingTypes: V2BuildingType[];
    addonMarkups: V2AddonMarkup[];
    cadMarkups: V2CadMarkup[];
    scanModifiers: V2ScanModifier[];
    travelParams: V2TravelParams;
    slamConfig: V2SlamConfig;
    megabandBaselines: V2MegabandBaseline[];
    megabandFactors: V2MegabandFactor[];
    archRates: V2ArchRate[];
    addonRates: V2AddonRate[];
    cadRates: V2CadRate[];
    megabandRates: V2MegabandRate[];
}

// ────────────────────────────────────────────────────────────────────────────
// ENGINE INPUT
// ────────────────────────────────────────────────────────────────────────────

export interface V2AreaInput {
    squareFootage: number;
    buildingTypeNum: number;     // 1-13
    lod: string;                 // "200" | "300" | "350"
    scope: string;               // "Full" | "Int Only" | "Ext Only" | "Mixed"
    mixedInteriorLod?: string;   // used when scope = "Mixed"
    mixedExteriorLod?: string;   // used when scope = "Mixed"
    scannerAssignment?: string;  // "Sr" | "Jr" (default "Sr")

    // Modifiers
    era?: string;                // "Modern" | "Historic"
    roomDensity?: number;        // 0-4
    occupied?: boolean;
    noPowerHeat?: boolean;
    hazardous?: boolean;

    // Disciplines
    structure?: boolean;
    mepf?: boolean;
    grade?: boolean;
    cadConversion?: boolean;
    cadPackage?: string;         // "Basic" | "A+S" | "Full"
    matterport?: boolean;
    georeferencing?: boolean;
}

export interface V2ProjectInput {
    areas: V2AreaInput[];
    bimManager?: string;         // "YES" | "NO" | "AUTO"
    pricingTier?: string;        // "X7" | "SLAM" | "AUTO"
    expedited?: boolean;
    travelDistanceMi?: number;
    numTechs?: number;           // override
    scanDays?: number;           // override
    travelOverride?: number;     // $ override
}

// ────────────────────────────────────────────────────────────────────────────
// ENGINE OUTPUT
// ────────────────────────────────────────────────────────────────────────────

export interface V2AreaResult {
    archPerSqft: number;
    archTotal: number;
    structurePerSqft: number;
    structureTotal: number;
    mepfPerSqft: number;
    mepfTotal: number;
    gradePerSqft: number;
    gradeTotal: number;
    cadPerSqft: number;
    cadTotal: number;
    matterportTotal: number;
    georeferencingTotal: number;
    subtotalBim: number;
    baseProjectTotal: number;
    modifierStack: number;
    upptArchPerSqft: number;     // UppT (pre-M) for decomposition
    scanEstPerSqft: number;      // Scan cost (pre-M) for decomposition
    adjustedVcogsPerSqft: number; // UppT + adjusted Scan
}

export interface V2QuoteResult {
    areas: V2AreaResult[];
    baseProjectTotal: number;
    travelCharge: number;
    expeditedSurcharge: number;
    floorAdjustment: number;
    totalQuote: number;
    minimumApplied: number;      // minimum floor check
    resolvedTier: string;        // "X7" | "SLAM"
    bimManagerActive: boolean;
    multiplierM: number;         // the M used
    partnerCostF: number;        // the f used
    aboveTheLineA: number;       // the a used
    savingsFloorS: number;       // the s used
}
