// ── S2PX Pricing Engine Schema (Drizzle ORM) ──
// Translates the "S2P Pricing v3.1" Excel workbook into DB-backed tables.
// CEO can update all constants via a Settings UI — nothing is hardcoded.
//
// Excel Tab Mapping:
//   Control Panel      → pricing_constants + pricing_scanner_rates + pricing_travel_params
//                        + pricing_scan_modifiers + pricing_slam_config
//   Arch COGS & Pricing → pricing_arch_rates
//   Add-On Pricing      → pricing_addon_rates
//   Mega-Band           → pricing_megaband_rates + pricing_megaband_factors
//   Scan Throughput     → Derived from pricing_constants (baselines × type ratios)

import {
    pgTable,
    serial,
    text,
    integer,
    boolean,
    numeric,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

// ────────────────────────────────────────────────────────────────────────────
// 1. PRICING CONSTANTS — "Control Panel" Sections A-D, T-U
// ────────────────────────────────────────────────────────────────────────────
// Single-row table (id=1). Key-value would be fragile; structured columns
// make TypeScript typing and validation trivial. CEO edits these via UI.
export const pricingConstants = pgTable('pricing_constants', {
    id: serial('id').primaryKey(),

    // ── Section A: Above-the-Line ──
    taxPct: numeric('tax_pct', { precision: 6, scale: 4 }).notNull(),                 // 0.15
    ownerCompPct: numeric('owner_comp_pct', { precision: 6, scale: 4 }).notNull(),     // 0.10
    salesMarketingPct: numeric('sm_pct', { precision: 6, scale: 4 }).notNull(),        // 0.075
    overheadPct: numeric('overhead_pct', { precision: 6, scale: 4 }).notNull(),        // 0.148
    badDebtPct: numeric('bad_debt_pct', { precision: 6, scale: 4 }).notNull(),         // 0.025
    // a = tax + ownerComp + sm + overhead + badDebt (computed in engine)

    // ── Section B: Partner Costs (f) ──
    qcPct: numeric('qc_pct', { precision: 6, scale: 4 }).notNull(),                   // 0.02
    pmPct: numeric('pm_pct', { precision: 6, scale: 4 }).notNull(),                    // 0.04
    cooPct: numeric('coo_pct', { precision: 6, scale: 4 }).notNull(),                  // 0.05
    registrationPct: numeric('registration_pct', { precision: 6, scale: 4 }).notNull(), // 0.03
    // f = qc + pm + coo + registration (computed in engine)

    // ── Section C: Savings Target ──
    savingsFloorPct: numeric('savings_floor_pct', { precision: 6, scale: 4 }).notNull(), // 0.10
    // M = 1 / (1 - f - a - s) — computed in engine, never stored

    // ── Section E: Scanner Rates ──
    srTechRate: numeric('sr_tech_rate', { precision: 8, scale: 2 }).notNull(),         // 50.00 $/hr
    jrTechRate: numeric('jr_tech_rate', { precision: 8, scale: 2 }).notNull(),         // 35.00 $/hr

    // ── Section M: Whale / BIM Manager ──
    bimManagerPct: numeric('bim_manager_pct', { precision: 6, scale: 4 }).notNull(),   // 0.03
    tierAThresholdSqft: integer('tier_a_threshold_sqft').notNull(),                     // 50000
    // f_whale = f + bimManagerPct (computed in engine)
    // M_whale = 1 / (1 - f_whale - a - s) (computed in engine)

    // ── Section T: Quote Minimums ──
    archMinimum: numeric('arch_minimum', { precision: 10, scale: 2 }).notNull(),       // 3500
    fullServiceMinimum: numeric('full_service_minimum', { precision: 10, scale: 2 }).notNull(), // 5000

    // ── Section U: Floor Enforcement ──
    autoFloorActive: boolean('auto_floor_active').notNull().default(true),              // Y

    // ── Expedited Surcharge ──
    expeditedPct: numeric('expedited_pct', { precision: 6, scale: 4 }).notNull().default('0.20'), // 20%

    // ── Matterport $/sqft ──
    matterportPerSqft: numeric('matterport_per_sqft', { precision: 8, scale: 4 }).notNull().default('0.10'),

    // ── Georeferencing Flat Fee ──
    georeferencingFee: numeric('georeferencing_fee', { precision: 10, scale: 2 }).notNull().default('1500'),

    // ── Mixed Scope Blend Weights ──
    mixedInteriorWeight: numeric('mixed_interior_weight', { precision: 4, scale: 3 }).notNull().default('0.65'),
    mixedExteriorWeight: numeric('mixed_exterior_weight', { precision: 4, scale: 3 }).notNull().default('0.35'),

    // ── Scope Scan Multipliers (separate from UppT scope discounts) ──
    scanScopeFullPct: numeric('scan_scope_full_pct', { precision: 5, scale: 4 }).notNull().default('1.0'),
    scanScopeIntOnlyPct: numeric('scan_scope_int_only_pct', { precision: 5, scale: 4 }).notNull().default('0.775'),
    scanScopeExtOnlyPct: numeric('scan_scope_ext_only_pct', { precision: 5, scale: 4 }).notNull().default('0.225'),

    // ── UppT Scope Discounts (Int Only / Ext Only multipliers on UppT) ──
    upptScopeIntOnlyPct: numeric('uppt_scope_int_only_pct', { precision: 5, scale: 4 }).notNull().default('0.75'),
    upptScopeExtOnlyPct: numeric('uppt_scope_ext_only_pct', { precision: 5, scale: 4 }).notNull().default('0.50'),

    // ── Equipment Amortization (SLAM) ──
    slamUnitCost: numeric('slam_unit_cost', { precision: 12, scale: 2 }).notNull().default('65000'),
    controlEquipCost: numeric('control_equip_cost', { precision: 12, scale: 2 }).notNull().default('55000'),
    equipAmortYears: integer('equip_amort_years').notNull().default(5),
    fieldDaysPerYear: integer('field_days_per_year').notNull().default(200),
    includeEquipAmort: boolean('include_equip_amort').notNull().default(false),

    // Meta
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'), // Firebase UID of last editor
});

// ────────────────────────────────────────────────────────────────────────────
// 2. SCAN BASELINES — Control Panel Section F
// ────────────────────────────────────────────────────────────────────────────
// 7 sqft bands. The "SFR I+E" scan throughput baselines (sqft/hr).
// Building-type-specific throughput = baseline × type ratio.
export const pricingScanBaselines = pgTable('pricing_scan_baselines', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),           // "0-3k", "3k-5k", "5k-10k", "10k-20k", "20k-50k", "50-100k", "100k+"
    sqftPerHour: integer('sqft_per_hour').notNull(), // 300, 500, 750, 800, 1000, 1000, 1300
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('scan_baselines_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 3. BUILDING TYPES — Control Panel Section G
// ────────────────────────────────────────────────────────────────────────────
// 13 building types with scan throughput ratio (relative to SFR baseline).
export const pricingBuildingTypes = pgTable('pricing_building_types', {
    id: serial('id').primaryKey(),
    typeNumber: integer('type_number').notNull().unique(), // 1-13
    name: text('name').notNull(),           // "Res Std (SF)", "Commercial/Office", etc.
    throughputRatio: numeric('throughput_ratio', { precision: 6, scale: 3 }).notNull(), // 1.0, 0.8, 1.4, etc.
    slamEligible: boolean('slam_eligible').notNull().default(true), // Types 1, 3, 13 are NOT eligible
    slamThroughputRatio: numeric('slam_throughput_ratio', { precision: 6, scale: 3 }), // SLAM-specific ratio (null if not eligible)
    sortOrder: integer('sort_order').notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
// 4. ADD-ON MARKUPS — Control Panel Section H
// ────────────────────────────────────────────────────────────────────────────
// 9 sqft bands × 3 disciplines (Structure, MEPF, Grade).
// The markup multiplier applied to the 2026 UppT to get the add-on price.
export const pricingAddonMarkups = pgTable('pricing_addon_markups', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),                // "0-5k" through "100k+"
    structureMarkup: numeric('structure_markup', { precision: 6, scale: 3 }).notNull(), // 1.5, 1.25, etc.
    mepfMarkup: numeric('mepf_markup', { precision: 6, scale: 3 }).notNull(),           // 2.0, 1.5, etc.
    gradeMarkup: numeric('grade_markup', { precision: 6, scale: 3 }).notNull(),          // 3.5 (flat)
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('addon_markups_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 5. CAD CONVERSION MARKUPS — Control Panel Section K
// ────────────────────────────────────────────────────────────────────────────
// 9 sqft bands × 3 packages (Basic, A+S, Full).
export const pricingCadMarkups = pgTable('pricing_cad_markups', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),                // "0-5k" through "100k+"
    basicMarkup: numeric('basic_markup', { precision: 6, scale: 3 }).notNull(),   // 2.0
    asPlusMarkup: numeric('as_plus_markup', { precision: 6, scale: 3 }).notNull(), // 2.0
    fullMarkup: numeric('full_markup', { precision: 6, scale: 3 }).notNull(),      // 2.0
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('cad_markups_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 6. SCAN MODIFIERS — Control Panel Section L (X7) + Section R (SLAM)
// ────────────────────────────────────────────────────────────────────────────
// Site condition multipliers that stack on scan time.
// Two tiers: X7 (standard) and SLAM (whale projects).
export const pricingScanModifiers = pgTable('pricing_scan_modifiers', {
    id: serial('id').primaryKey(),
    tier: text('tier').notNull(),                // "x7" | "slam"
    category: text('category').notNull(),        // "era" | "occupied" | "power" | "hazard" | "density"
    code: text('code').notNull(),                // "MOD", "HIS", "OCC", "NPH", "HAZ", "RD0"-"RD4"
    label: text('label').notNull(),              // Human-readable: "Modern (default)", "Historic", etc.
    multiplier: numeric('multiplier', { precision: 6, scale: 4 }).notNull(), // 1.0, 1.2, 1.15, etc.
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('scan_modifiers_tier_code_idx').on(table.tier, table.code),
]);

// ────────────────────────────────────────────────────────────────────────────
// 7. TRAVEL PARAMETERS — Control Panel Section I
// ────────────────────────────────────────────────────────────────────────────
// Single-row config for the travel cost estimator.
export const pricingTravelParams = pgTable('pricing_travel_params', {
    id: serial('id').primaryKey(),

    // Distance-based rates
    mileageRate: numeric('mileage_rate', { precision: 8, scale: 2 }).notNull(),         // 4.00 $/mi (all-in)
    overnightThresholdMi: integer('overnight_threshold_mi').notNull(),                    // 75
    airfareThresholdMi: integer('airfare_threshold_mi').notNull(),                        // 300

    // NYC flat rates
    nycFlatSmall: numeric('nyc_flat_small', { precision: 8, scale: 2 }).notNull(),       // 150 (1-day)
    nycFlatRegional: numeric('nyc_flat_regional', { precision: 8, scale: 2 }).notNull(), // 300 (multi-day)

    // Overnight costs
    hotelCap: numeric('hotel_cap', { precision: 8, scale: 2 }).notNull(),                // 250 $/night
    perDiem: numeric('per_diem', { precision: 8, scale: 2 }).notNull(),                  // 75 $/day

    // Flight costs
    avgAirfare: numeric('avg_airfare', { precision: 8, scale: 2 }).notNull(),            // 500 $/RT per tech
    carRental: numeric('car_rental', { precision: 8, scale: 2 }).notNull(),              // 125 $/day
    airportParking: numeric('airport_parking', { precision: 8, scale: 2 }).notNull(),    // 150 $/trip

    // Vehicle details (for cost analysis, not pricing)
    vehicleMpg: numeric('vehicle_mpg', { precision: 6, scale: 2 }).notNull(),            // 33
    gasPrice: numeric('gas_price', { precision: 6, scale: 2 }).notNull(),                 // 4.00 $/gal

    // Tech travel rates (for crew labor during drive time)
    srTechTravelRate: numeric('sr_tech_travel_rate', { precision: 8, scale: 2 }).notNull(), // 25.00 $/hr
    jrTechTravelRate: numeric('jr_tech_travel_rate', { precision: 8, scale: 2 }).notNull(), // 17.50 $/hr
    avgTravelSpeed: integer('avg_travel_speed').notNull(),                                  // 45 mph

    // Personal vehicle mileage reimbursement (IRS rate)
    irsReimbursementRate: numeric('irs_reimbursement_rate', { precision: 6, scale: 4 }).notNull(), // 0.67

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
// 8. SLAM CONFIG — Control Panel Sections O + P
// ────────────────────────────────────────────────────────────────────────────
// Single-row config for SLAM/Tier-A scanner pricing.
export const pricingSlamConfig = pgTable('pricing_slam_config', {
    id: serial('id').primaryKey(),

    // SLAM Scanner Crew Rates (Section P)
    slamScannerRate: numeric('slam_scanner_rate', { precision: 8, scale: 2 }).notNull(),   // 50 $/hr
    slamAssistRate: numeric('slam_assist_rate', { precision: 8, scale: 2 }).notNull(),     // 35 $/hr
    controlSurveyRate: numeric('control_survey_rate', { precision: 8, scale: 2 }).notNull(), // 50 $/hr
    controlAssistRate: numeric('control_assist_rate', { precision: 8, scale: 2 }).notNull(), // 35 $/hr
    // combinedCrewRate = sum of above (computed in engine: $170/hr)

    // SLAM Baseline Throughput (Section P)
    slamBaselineSqftPerHour: integer('slam_baseline_sqft_per_hour').notNull(),              // 25000

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
// 9. MEGA-BAND SCAN BASELINES — Control Panel Section O
// ────────────────────────────────────────────────────────────────────────────
// 6 sqft bands for mega/SLAM projects (100k+ breakpoints).
export const pricingMegabandBaselines = pgTable('pricing_megaband_baselines', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),           // "100k-200k", "200k-500k", "500k-1M", "1M-2M", "2M-5M", "5M+"
    sqftPerHour: integer('sqft_per_hour').notNull(), // 3000, 5000, 8000, 10000, 15000, 25000
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('megaband_baselines_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 10. MEGA-BAND DISCOUNT FACTORS — Mega-Band tab Section A
// ────────────────────────────────────────────────────────────────────────────
// 6 discount factors applied to 100k+ base UppT rates for larger bands.
export const pricingMegabandFactors = pgTable('pricing_megaband_factors', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),           // "100k-200k" through "5M+"
    factor: numeric('factor', { precision: 6, scale: 4 }).notNull(), // 0.75, 0.42, 0.35, 0.28, 0.18, 0.08
    dataQuality: text('data_quality'),      // "Interpolated", "2 anchors", etc. (informational)
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('megaband_factors_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 11. ARCH COGS RATES — "Arch COGS & Pricing" tab
// ────────────────────────────────────────────────────────────────────────────
// 13 building types × 9 bands × 3 LoDs = 351 rows (+ 350+ legacy rows excluded).
// Each row: the UppT and Scan $/sqft for Architecture pricing.
// New Price = (UppT + Scan) × M
export const pricingArchRates = pgTable('pricing_arch_rates', {
    id: serial('id').primaryKey(),
    buildingTypeNum: integer('building_type_num').notNull(), // 1-13
    band: text('band').notNull(),             // "0-5k" through "100k+"
    lod: text('lod').notNull(),               // "200", "300", "350"
    upptPerSqft: numeric('uppt_per_sqft', { precision: 10, scale: 6 }).notNull(),  // UppT 2026 rate
    scanPerSqft: numeric('scan_per_sqft', { precision: 10, scale: 6 }).notNull(),  // Scan cost per sqft
    // varCogs = uppt + scan (computed in engine)
    // newPrice = varCogs × M (computed in engine)
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('arch_rates_type_band_lod_idx').on(table.buildingTypeNum, table.band, table.lod),
]);

// ────────────────────────────────────────────────────────────────────────────
// 12. ADD-ON RATES — "Add-On Pricing" tab
// ────────────────────────────────────────────────────────────────────────────
// 4 disciplines × 13 types × 9 bands × 3 LoDs = up to 1,404 rows.
// Each row: the UppT 2026 rate. Final price = UppT × markup (from pricingAddonMarkups).
// Discipline sections: Structure (rows 6-356), MEPF (361-711), Grade (716-1066)
// CAD is separate (rows 1071-1079) — stored in pricingCadRates.
export const pricingAddonRates = pgTable('pricing_addon_rates', {
    id: serial('id').primaryKey(),
    discipline: text('discipline').notNull(),  // "structure" | "mepf" | "grade"
    buildingTypeNum: integer('building_type_num').notNull(), // 1-13
    band: text('band').notNull(),              // "0-5k" through "100k+"
    lod: text('lod').notNull(),                // "200", "300", "350"
    upptPerSqft: numeric('uppt_per_sqft', { precision: 10, scale: 6 }).notNull(), // UppT 2026 rate
    // Final price = upptPerSqft × markup from pricingAddonMarkups (computed in engine)
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('addon_rates_disc_type_band_lod_idx').on(
        table.discipline, table.buildingTypeNum, table.band, table.lod
    ),
]);

// ────────────────────────────────────────────────────────────────────────────
// 13. CAD CONVERSION RATES — "Add-On Pricing" tab rows 1071-1079
// ────────────────────────────────────────────────────────────────────────────
// 9 bands × 3 base UppT values (one per package level).
// Final CAD price = base × markup from pricingCadMarkups.
export const pricingCadRates = pgTable('pricing_cad_rates', {
    id: serial('id').primaryKey(),
    band: text('band').notNull(),              // "0-5k" through "100k+"
    basicUppt: numeric('basic_uppt', { precision: 10, scale: 6 }).notNull(),    // Basic Arch UppT
    asPlusUppt: numeric('as_plus_uppt', { precision: 10, scale: 6 }).notNull(), // A+S+Site UppT
    fullUppt: numeric('full_uppt', { precision: 10, scale: 6 }).notNull(),      // Full (A+S+MEP+Site) UppT
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('cad_rates_band_idx').on(table.band),
]);

// ────────────────────────────────────────────────────────────────────────────
// 14. LANDSCAPE PARAMETERS — Control Panel Section J
// ────────────────────────────────────────────────────────────────────────────
// Single-row config for landscape scan pricing.
export const pricingLandscapeParams = pgTable('pricing_landscape_params', {
    id: serial('id').primaryKey(),
    urbanThroughput: numeric('urban_throughput', { precision: 6, scale: 3 }).notNull(), // 1.0 acres/hr
    naturalThroughput: numeric('natural_throughput', { precision: 6, scale: 3 }).notNull(), // 0.5 acres/hr
    // Landscape M = same as Architecture M (computed in engine)
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────────────
// 15. MEGA-BAND UPPT RATES — "Mega-Band" tab Sections B/C/D
// ────────────────────────────────────────────────────────────────────────────
// 13 types × 6 mega-bands × 3 LoDs = 234 rows.
// These are the discount-adjusted UppT rates for SLAM pricing.
// Derived as: 100k+ base rate × discount factor.
// Stored as pre-computed values so the engine can do a simple lookup.
export const pricingMegabandRates = pgTable('pricing_megaband_rates', {
    id: serial('id').primaryKey(),
    buildingTypeNum: integer('building_type_num').notNull(), // 1-13
    megaBand: text('mega_band').notNull(),    // "100k-200k" through "5M+"
    lod: text('lod').notNull(),               // "200", "300", "350"
    upptPerSqft: numeric('uppt_per_sqft', { precision: 10, scale: 6 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
}, (table) => [
    uniqueIndex('megaband_rates_type_band_lod_idx').on(
        table.buildingTypeNum, table.megaBand, table.lod
    ),
]);
