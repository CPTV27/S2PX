// ── Pricing Constants ──
// Default values re-exported from the shared PricingConfig type.
// In production, these are overridden by DB-stored config via /api/pricing-config.
// This file provides compile-time defaults for the pricing engine and tests.

import { DEFAULT_PRICING_CONFIG } from '@shared/types/pricingConfig';

// Re-export the shared config as the single source of truth for defaults
export { DEFAULT_PRICING_CONFIG };

// ── Convenience re-exports (backward compat for pricing.ts imports) ──
export const MIN_SQFT_FLOOR = DEFAULT_PRICING_CONFIG.minSqftFloor;
export const UPTEAM_MULTIPLIER_FALLBACK = DEFAULT_PRICING_CONFIG.upteamMultiplierFallback;
export const SQFT_PER_ACRE = DEFAULT_PRICING_CONFIG.sqftPerAcre;
export const TIER_A_THRESHOLD = DEFAULT_PRICING_CONFIG.tierAThreshold;
export const ACT_RATE_PER_SQFT = DEFAULT_PRICING_CONFIG.actRatePerSqft;
export const MATTERPORT_RATE_PER_SQFT = DEFAULT_PRICING_CONFIG.matterportRatePerSqft;

export const FY26_MARGIN_FLOOR = DEFAULT_PRICING_CONFIG.fy26MarginFloor;
export const MARGIN_GUARDRAIL = DEFAULT_PRICING_CONFIG.marginGuardrail;
export const MARGIN_SLIDER_MIN = DEFAULT_PRICING_CONFIG.marginSliderMin;
export const MARGIN_SLIDER_MAX = DEFAULT_PRICING_CONFIG.marginSliderMax;
export const MARGIN_DEFAULT = DEFAULT_PRICING_CONFIG.marginDefault;

export const DEFAULT_BASE_RATES = DEFAULT_PRICING_CONFIG.baseRates;
export const LOD_MULTIPLIERS = DEFAULT_PRICING_CONFIG.lodMultipliers;
export const RISK_PREMIUMS = DEFAULT_PRICING_CONFIG.riskPremiums;
export const SCOPE_PORTIONS = DEFAULT_PRICING_CONFIG.scopePortions;
export const SCOPE_DISCOUNTS = DEFAULT_PRICING_CONFIG.scopeDiscounts;
export const PAYMENT_TERM_PREMIUMS = DEFAULT_PRICING_CONFIG.paymentTermPremiums;
export const TRAVEL_RATES = DEFAULT_PRICING_CONFIG.travelRates;
export const BROOKLYN_BASE_FEES = DEFAULT_PRICING_CONFIG.brooklynBaseFees;
export const LANDSCAPE_RATES = DEFAULT_PRICING_CONFIG.landscapeRates;
export const ELEVATION_TIERS = DEFAULT_PRICING_CONFIG.elevationTiers;

// ── Non-pricing constants (structural, not configurable) ──
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

// Dispatch locations (standard = $3/mi, Brooklyn = tiered)
export const DISPATCH_LOCATIONS = [
  "TROY", "WOODSTOCK", "BOISE", "BROOKLYN",
] as const;
