// Notebook CPQ — Pricing Constants
// Source of truth: NOTEBOOK_CPQ_CLAUDE_CODE_SPEC.md + Pricing Engine Specification

export const MIN_SQFT_FLOOR = 3000;
export const UPTEAM_MULTIPLIER_FALLBACK = 0.65;
export const SQFT_PER_ACRE = 43560;
export const TIER_A_THRESHOLD = 50000;
export const ACT_RATE_PER_SQFT = 0.20;
export const MATTERPORT_RATE_PER_SQFT = 0.01;

export const FY26_MARGIN_FLOOR = 0.40;
export const MARGIN_GUARDRAIL = 0.45;
export const MARGIN_SLIDER_MIN = 0.35;
export const MARGIN_SLIDER_MAX = 0.60;
export const MARGIN_DEFAULT = 0.45;

export const DEFAULT_BASE_RATES: Record<string, number> = {
  arch: 0.25,
  mepf: 0.30,
  structure: 0.20,
  site: 0.15,
};

export const LOD_MULTIPLIERS: Record<string, number> = {
  "200": 1.0,
  "300": 1.3,
  "350": 1.5,
};

export const RISK_PREMIUMS: Record<string, number> = {
  occupied: 0.15,
  hazardous: 0.25,
  no_power: 0.20,
};

export const SCOPE_PORTIONS: Record<string, number> = {
  full: 1.0,
  interior: 0.65,
  exterior: 0.35,
};

export const SCOPE_DISCOUNTS: Record<string, number> = {
  full: 0,
  interior: 0.35,
  exterior: 0.65,
  mixed: 0,
};

export const PAYMENT_TERM_PREMIUMS: Record<string, number> = {
  partner: 0,
  owner: 0,
  net30: 0.05,
  net60: 0.10,
  net90: 0.15,
};

export const TRAVEL_RATES = {
  standard: 3,
  brooklyn: 4,
  brooklynThreshold: 20,
  scanDayFeeThreshold: 75,
  scanDayFee: 300,
};

export const BROOKLYN_BASE_FEES: Record<string, number> = {
  tierC: 150,
  tierB: 300,
  tierA: 0,
};

export const BUILDING_TYPES: Record<string, { name: string; method: string }> = {
  "1": { name: "Office Building", method: "per-sqft" },
  "2": { name: "Educational", method: "per-sqft" },
  "3": { name: "Healthcare", method: "per-sqft" },
  "4": { name: "Industrial", method: "per-sqft" },
  "5": { name: "Residential Multi-Family", method: "per-sqft" },
  "6": { name: "Residential Single-Family", method: "per-sqft" },
  "7": { name: "Retail", method: "per-sqft" },
  "8": { name: "Hospitality", method: "per-sqft" },
  "9": { name: "Mixed-Use", method: "per-sqft" },
  "10": { name: "Warehouse", method: "per-sqft" },
  "11": { name: "Religious", method: "per-sqft" },
  "12": { name: "Government", method: "per-sqft" },
  "13": { name: "Parking Structure", method: "per-sqft" },
  "14": { name: "Built Landscape", method: "per-acre" },
  "15": { name: "Natural Landscape", method: "per-acre" },
  "16": { name: "ACT Ceilings Only", method: "per-sqft" },
  "17": { name: "Matterport Only", method: "per-sqft" },
};

// Landscape per-acre rates [<5ac, 5-20ac, 20-50ac, 50-100ac, 100+ac]
export const LANDSCAPE_RATES: Record<string, Record<string, number[]>> = {
  "14": { // Built Landscape
    "200": [875, 625, 375, 250, 160],
    "300": [1000, 750, 500, 375, 220],
    "350": [1250, 1000, 750, 500, 260],
  },
  "15": { // Natural Landscape
    "200": [625, 375, 250, 200, 140],
    "300": [750, 500, 375, 275, 200],
    "350": [1000, 750, 500, 325, 240],
  },
};

// Elevation tiered pricing
export const ELEVATION_TIERS = [
  { max: 10, rate: 25 },
  { max: 20, rate: 20 },
  { max: 100, rate: 15 },
  { max: 300, rate: 10 },
  { max: Infinity, rate: 5 },
];

// Dispatch locations (standard = $3/mi, Brooklyn = tiered)
export const DISPATCH_LOCATIONS = [
  "TROY", "WOODSTOCK", "BOISE", "BROOKLYN",
] as const;
