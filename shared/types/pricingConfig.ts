// ── Pricing Configuration Type ──
// All pricing variables that can be updated from the database
// without redeploying. Replaces hardcoded constants.

export interface PricingConfig {
    // Rates
    matterportRatePerSqft: number;
    actRatePerSqft: number;
    upteamMultiplierFallback: number;
    minSqftFloor: number;
    sqftPerAcre: number;
    tierAThreshold: number;

    // Margins
    fy26MarginFloor: number;
    marginGuardrail: number;
    marginSliderMin: number;
    marginSliderMax: number;
    marginDefault: number;

    // Base rates (per discipline)
    baseRates: Record<string, number>;

    // LoD multipliers
    lodMultipliers: Record<string, number>;

    // Risk premiums (applied to scan costs — Arch only)
    riskPremiums: Record<string, number>;

    // Scope portions (INT/EXT split)
    scopePortions: Record<string, number>;

    // Scope discounts
    scopeDiscounts: Record<string, number>;

    // Payment term premiums
    paymentTermPremiums: Record<string, number>;

    // Travel
    travelRates: {
        standard: number;
        brooklyn: number;
        brooklynThreshold: number;
        scanDayFeeThreshold: number;
        scanDayFee: number;
    };

    // Brooklyn base fees
    brooklynBaseFees: Record<string, number>;

    // Landscape per-acre rates [<5ac, 5-20ac, 20-50ac, 50-100ac, 100+ac]
    landscapeRates: Record<string, Record<string, number[]>>;

    // Elevation tiered pricing
    elevationTiers: { max: number; rate: number }[];

    // Georeferencing price per structure
    georeferencingPerStructure: number;

    // Scan & Reg flat rates
    scanRegFullDay: number;
    scanRegHalfDay: number;

    // Expedited surcharge percentage (applied to BIM + add-ons, not travel)
    expeditedSurchargePercent: number;

    // Below Floor rate as fraction of Architecture rate
    belowFloorRateFraction: number;
}

/** Default pricing config — used as fallback when DB config is unavailable */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
    matterportRatePerSqft: 0.10,
    actRatePerSqft: 0.20,
    upteamMultiplierFallback: 0.65,
    minSqftFloor: 3000,
    sqftPerAcre: 43560,
    tierAThreshold: 50000,

    fy26MarginFloor: 0.40,
    marginGuardrail: 0.45,
    marginSliderMin: 0.35,
    marginSliderMax: 0.60,
    marginDefault: 0.45,

    baseRates: {
        arch: 0.25,
        mepf: 0.30,
        structure: 0.20,
        site: 0.15,
    },

    lodMultipliers: {
        '200': 1.0,
        '300': 1.3,
        '350': 1.5,
    },

    riskPremiums: {
        occupied: 0.15,
        hazardous: 0.20,
        no_power: 0.20,
        no_lighting: 0.10,
        fire_flood: 0.15,
    },

    scopePortions: {
        full: 1.0,
        interior: 0.65,
        exterior: 0.35,
    },

    scopeDiscounts: {
        full: 0,
        interior: 0.35,
        exterior: 0.65,
        mixed: 0,
    },

    paymentTermPremiums: {
        partner: 0,
        owner: 0,
        net30: 0.05,
        net60: 0.10,
        net90: 0.15,
    },

    travelRates: {
        standard: 3,
        brooklyn: 4,
        brooklynThreshold: 20,
        scanDayFeeThreshold: 75,
        scanDayFee: 300,
    },

    brooklynBaseFees: {
        tierC: 150,
        tierB: 300,
        tierA: 0,
    },

    landscapeRates: {
        '14': {
            '200': [875, 625, 375, 250, 160],
            '300': [1000, 750, 500, 375, 220],
            '350': [1250, 1000, 750, 500, 260],
        },
        '15': {
            '200': [625, 375, 250, 200, 140],
            '300': [750, 500, 375, 275, 200],
            '350': [1000, 750, 500, 325, 240],
        },
    },

    elevationTiers: [
        { max: 10, rate: 25 },
        { max: 20, rate: 20 },
        { max: 100, rate: 15 },
        { max: 300, rate: 10 },
        { max: Infinity, rate: 5 },
    ],

    georeferencingPerStructure: 1500,
    scanRegFullDay: 2500,
    scanRegHalfDay: 1500,
    expeditedSurchargePercent: 0.20,
    belowFloorRateFraction: 0.50,
};
