// Notebook CPQ — Deterministic Pricing Engine
// Source of truth: Scan2Plan CPQ Pricing Engine Specification v2.0.0
// The LLM NEVER calculates prices. All math lives here.

import type { QuoteInput, QuoteResult, TravelResult, LineItem, Area } from './types';
import {
  MIN_SQFT_FLOOR,
  UPTEAM_MULTIPLIER_FALLBACK,
  SQFT_PER_ACRE,
  TIER_A_THRESHOLD,
  ACT_RATE_PER_SQFT,
  MATTERPORT_RATE_PER_SQFT,
  FY26_MARGIN_FLOOR,
  MARGIN_GUARDRAIL,
  DEFAULT_BASE_RATES,
  LOD_MULTIPLIERS,
  RISK_PREMIUMS,
  SCOPE_PORTIONS,
  SCOPE_DISCOUNTS,
  PAYMENT_TERM_PREMIUMS,
  TRAVEL_RATES,
  BROOKLYN_BASE_FEES,
  LANDSCAPE_RATES,
  ELEVATION_TIERS,
} from './constants';

// ---------------------------------------------------------------------------
// 1. getAreaTier — sqft → tier string
// ---------------------------------------------------------------------------
export function getAreaTier(sqft: number): string {
  if (sqft < 3000)   return "0-3k";
  if (sqft < 5000)   return "3k-5k";
  if (sqft < 10000)  return "5k-10k";
  if (sqft < 25000)  return "10k-25k";
  if (sqft < 50000)  return "25k-50k";
  if (sqft < 75000)  return "50k-75k";
  if (sqft < 100000) return "75k-100k";
  return "100k+";
}

// ---------------------------------------------------------------------------
// 2. calculateAreaPricing — per-area pricing
// ---------------------------------------------------------------------------
export function calculateAreaPricing(input: {
  sqft: number;
  discipline: string;
  lod: string;
  clientRatePerSqft: number | null;
  upteamRatePerSqft: number | null;
  scopePortion: number;
}): { clientPrice: number; upteamCost: number; effectiveSqft: number } {
  const { sqft, discipline, lod, clientRatePerSqft, upteamRatePerSqft, scopePortion } = input;

  // Step 1: Apply minimum floor
  const effectiveSqft = Math.max(sqft, MIN_SQFT_FLOOR);

  // Step 2: Calculate client price
  let clientPrice: number;
  if (clientRatePerSqft !== null && clientRatePerSqft > 0) {
    // Use database rate
    clientPrice = effectiveSqft * clientRatePerSqft * scopePortion;
  } else {
    // Fallback: base rate × LoD multiplier
    const baseRate = DEFAULT_BASE_RATES[discipline] || 2.50;
    const lodMultiplier = LOD_MULTIPLIERS[lod] || 1.0;
    clientPrice = effectiveSqft * baseRate * lodMultiplier * scopePortion;
  }

  // Step 3: Calculate upteam (vendor) cost
  let upteamCost: number;
  if (upteamRatePerSqft !== null && upteamRatePerSqft > 0) {
    // Use database rate
    upteamCost = effectiveSqft * upteamRatePerSqft * scopePortion;
  } else {
    // Fallback: 65% of client price
    upteamCost = clientPrice * UPTEAM_MULTIPLIER_FALLBACK;
  }

  return { clientPrice, upteamCost, effectiveSqft };
}

// ---------------------------------------------------------------------------
// 3. isLandscapeType — landscape detection
// ---------------------------------------------------------------------------
export function isLandscapeType(buildingTypeId: string): boolean {
  return buildingTypeId === "14" || buildingTypeId === "15";
}

// ---------------------------------------------------------------------------
// 4. getLandscapeAcreageTierIndex — acreage tier
// ---------------------------------------------------------------------------
export function getLandscapeAcreageTierIndex(acres: number): number {
  if (acres >= 100) return 4;
  if (acres >= 50)  return 3;
  if (acres >= 20)  return 2;
  if (acres >= 5)   return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// 5. calculateLandscapePrice — landscape pricing
// ---------------------------------------------------------------------------
export function calculateLandscapePrice(buildingTypeId: string, acres: number, lod: string): number {
  const rates = LANDSCAPE_RATES[buildingTypeId]?.[lod];
  if (!rates) return 0;
  const tierIndex = getLandscapeAcreageTierIndex(acres);
  const perAcreRate = rates[tierIndex];
  return acres * perAcreRate;
}

// ---------------------------------------------------------------------------
// 6. calculateLandscapeAreaPricing — landscape area full pricing
// ---------------------------------------------------------------------------
export function calculateLandscapeAreaPricing(
  buildingTypeId: string,
  acres: number,
  lod: string
): { clientPrice: number; upteamCost: number } {
  const clientPrice = calculateLandscapePrice(buildingTypeId, acres, lod);
  const upteamCost = clientPrice * UPTEAM_MULTIPLIER_FALLBACK;
  return { clientPrice, upteamCost };
}

// ---------------------------------------------------------------------------
// 7. calculateStandardTravel — standard dispatch travel
// ---------------------------------------------------------------------------
export function calculateStandardTravel(distance: number): TravelResult {
  const baseCost = distance * TRAVEL_RATES.standard;
  const scanDayFee = distance >= TRAVEL_RATES.scanDayFeeThreshold
    ? TRAVEL_RATES.scanDayFee : 0;

  let label = `Travel - ${distance} mi @ $${TRAVEL_RATES.standard}/mi`;
  if (scanDayFee > 0) {
    label += ` + $${TRAVEL_RATES.scanDayFee} scan day fee`;
  }

  return {
    baseCost,
    extraMilesCost: 0,
    scanDayFee,
    totalCost: baseCost + scanDayFee,
    label,
  };
}

// ---------------------------------------------------------------------------
// 8. getBrooklynTravelTier — Brooklyn tier
// ---------------------------------------------------------------------------
export function getBrooklynTravelTier(totalSqft: number): string {
  if (totalSqft >= 50000) return "tierA";
  if (totalSqft >= 10000) return "tierB";
  return "tierC";
}

// ---------------------------------------------------------------------------
// 9. calculateBrooklynTravel — Brooklyn travel (NO scan day fee)
// ---------------------------------------------------------------------------
export function calculateBrooklynTravel(distance: number, totalProjectSqft: number): TravelResult {
  const tier = getBrooklynTravelTier(totalProjectSqft);
  const tierLabel = tier === "tierA" ? "Tier A" : (tier === "tierB" ? "Tier B" : "Tier C");
  const baseCost = BROOKLYN_BASE_FEES[tier];

  const extraMiles = Math.max(0, distance - TRAVEL_RATES.brooklynThreshold);
  const extraMilesCost = extraMiles * TRAVEL_RATES.brooklyn;

  let label = `Travel - Brooklyn ${tierLabel} ($${baseCost} base`;
  if (extraMilesCost > 0) {
    label += ` + ${extraMiles} mi @ $${TRAVEL_RATES.brooklyn}/mi`;
  }
  label += ")";

  return {
    baseCost,
    extraMilesCost,
    scanDayFee: 0, // Brooklyn does NOT have scan day fee
    totalCost: baseCost + extraMilesCost,
    label,
    tier: tierLabel,
  };
}

// ---------------------------------------------------------------------------
// 10. calculateRiskMultiplier — risk calculation
// ---------------------------------------------------------------------------
export function calculateRiskMultiplier(risks: string[]): number {
  let totalPremium = 0;
  for (const risk of risks) {
    if (risk in RISK_PREMIUMS) {
      totalPremium += RISK_PREMIUMS[risk];
    }
  }
  return 1 + totalPremium;
}

// ---------------------------------------------------------------------------
// 11. applyRiskPremium — ARCH ONLY
// ---------------------------------------------------------------------------
export function applyRiskPremium(discipline: string, baseAmount: number, risks: string[]): number {
  // CRITICAL: Risk premiums apply ONLY to Architecture
  if (discipline !== "arch") {
    return baseAmount;
  }
  return baseAmount * calculateRiskMultiplier(risks);
}

// ---------------------------------------------------------------------------
// 12. isTierAProject — Tier A detection (sqft threshold, NOT dollar value)
// ---------------------------------------------------------------------------
export function isTierAProject(totalSqft: number): boolean {
  return totalSqft >= TIER_A_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 13. applyScopeDiscount — scope application (for adjusting already-calculated prices)
// ---------------------------------------------------------------------------
export function applyScopeDiscount(basePrice: number, scope: string): number {
  const discount = SCOPE_DISCOUNTS[scope] || 0;
  return basePrice * (1 - discount);
}

// ---------------------------------------------------------------------------
// 14. applyPaymentTermPremium — payment terms
// ---------------------------------------------------------------------------
export function applyPaymentTermPremium(subtotal: number, paymentTerms: string): number {
  const premium = PAYMENT_TERM_PREMIUMS[paymentTerms] || 0;
  return subtotal * (1 + premium);
}

// ---------------------------------------------------------------------------
// 15. calculateAdditionalElevationsPrice — tiered elevation pricing
// ---------------------------------------------------------------------------
export function calculateAdditionalElevationsPrice(count: number): number {
  if (count <= 0) return 0;

  let total = 0;
  let remaining = count;

  for (const tier of ELEVATION_TIERS) {
    if (remaining <= 0) break;
    const prevMax = ELEVATION_TIERS.indexOf(tier) === 0
      ? 0
      : ELEVATION_TIERS[ELEVATION_TIERS.indexOf(tier) - 1].max;
    const tierCapacity = tier.max === Infinity ? remaining : tier.max - prevMax;
    const qty = Math.min(remaining, tierCapacity);
    total += qty * tier.rate;
    remaining -= qty;
  }

  return total;
}

// ---------------------------------------------------------------------------
// 16. calculateACTAreaPricing — ACT pricing (building type 16)
// ---------------------------------------------------------------------------
export function calculateACTAreaPricing(
  sqft: number,
  scopePortion: number = 1.0
): { clientPrice: number; upteamCost: number; effectiveSqft: number } {
  const effectiveSqft = Math.max(sqft, MIN_SQFT_FLOOR);
  const clientPrice = effectiveSqft * ACT_RATE_PER_SQFT * scopePortion;
  const upteamCost = clientPrice * UPTEAM_MULTIPLIER_FALLBACK;
  return { clientPrice, upteamCost, effectiveSqft };
}

// ---------------------------------------------------------------------------
// 17. calculateMatterportPricing — Matterport pricing (building type 17 or add-on)
// ---------------------------------------------------------------------------
export function calculateMatterportPricing(
  sqft: number
): { clientPrice: number; upteamCost: number; effectiveSqft: number } {
  const effectiveSqft = Math.max(sqft, MIN_SQFT_FLOOR);
  // Matterport does NOT support scope portion — always uses full sqft
  const clientPrice = effectiveSqft * MATTERPORT_RATE_PER_SQFT;
  const upteamCost = clientPrice * UPTEAM_MULTIPLIER_FALLBACK;
  return { clientPrice, upteamCost, effectiveSqft };
}

// ---------------------------------------------------------------------------
// 18. calculateQuote — MASTER orchestrator
// ---------------------------------------------------------------------------
export function calculateQuote(input: QuoteInput): QuoteResult {
  const lineItems: LineItem[] = [];
  let lineItemCounter = 0;

  // Step 1: Calculate total project sqft (landscape acres → sqft for total)
  let totalProjectSqft = 0;
  for (const area of input.areas) {
    if (isLandscapeType(area.buildingType)) {
      totalProjectSqft += area.squareFeet * SQFT_PER_ACRE;
    } else {
      totalProjectSqft += area.squareFeet;
    }
  }

  // Step 2: Tier A detection
  const isTierA = isTierAProject(totalProjectSqft);

  // Step 3: Process each area
  for (const area of input.areas) {
    // Merge global risks with area-level risks
    const areaRisks = [...(area.risks || []), ...input.risks].filter(
      (r, i, arr) => arr.indexOf(r) === i
    );

    // Branch by building type
    if (isLandscapeType(area.buildingType)) {
      // Landscape — uses acres, single line item
      const lod = area.lod || "300";
      const { clientPrice, upteamCost } = calculateLandscapeAreaPricing(
        area.buildingType, area.squareFeet, lod
      );
      lineItems.push({
        id: `li-${lineItemCounter++}`,
        areaId: area.id,
        areaName: area.name,
        discipline: "landscape",
        buildingType: area.buildingType,
        sqft: area.squareFeet,
        effectiveSqft: area.squareFeet,
        lod,
        scope: "full",
        clientPrice,
        upteamCost,
        riskMultiplier: 1,
        category: "modeling",
      });
    } else if (area.buildingType === "16") {
      // ACT Ceilings Only
      const scopePortion = SCOPE_PORTIONS[area.scope] || 1.0;
      const { clientPrice, upteamCost, effectiveSqft } = calculateACTAreaPricing(
        area.squareFeet, scopePortion
      );
      lineItems.push({
        id: `li-${lineItemCounter++}`,
        areaId: area.id,
        areaName: area.name,
        discipline: "act",
        buildingType: "16",
        sqft: area.squareFeet,
        effectiveSqft,
        lod: area.lod || "300",
        scope: area.scope,
        clientPrice,
        upteamCost,
        riskMultiplier: 1,
        category: "service",
      });
    } else if (area.buildingType === "17") {
      // Matterport Only
      const { clientPrice, upteamCost, effectiveSqft } = calculateMatterportPricing(
        area.squareFeet
      );
      lineItems.push({
        id: `li-${lineItemCounter++}`,
        areaId: area.id,
        areaName: area.name,
        discipline: "matterport",
        buildingType: "17",
        sqft: area.squareFeet,
        effectiveSqft,
        lod: area.lod || "300",
        scope: "full",
        clientPrice,
        upteamCost,
        riskMultiplier: 1,
        category: "service",
      });
    } else {
      // Standard building type — per discipline
      for (const discipline of area.disciplines) {
        // Step 4a: Resolve LoD
        const resolvedLod = area.disciplineLods?.[discipline]?.lod ?? area.lod ?? "300";
        // Step 4b: Resolve scope
        const resolvedScope = area.disciplineLods?.[discipline]?.scope ?? area.scope ?? "full";

        if (resolvedScope === "mixed") {
          // Mixed scope: two line items per discipline
          for (const scopeType of ["interior", "exterior"] as const) {
            const scopePortion = SCOPE_PORTIONS[scopeType];
            const pricing = calculateAreaPricing({
              sqft: area.squareFeet,
              discipline,
              lod: resolvedLod,
              clientRatePerSqft: null,
              upteamRatePerSqft: null,
              scopePortion,
            });

            // Apply risk premium (ARCH ONLY)
            const riskMultiplier = discipline === "arch" ? calculateRiskMultiplier(areaRisks) : 1;
            const clientPrice = applyRiskPremium(discipline, pricing.clientPrice, areaRisks);
            const upteamCost = pricing.upteamCost;

            lineItems.push({
              id: `li-${lineItemCounter++}`,
              areaId: area.id,
              areaName: area.name,
              discipline,
              buildingType: area.buildingType,
              sqft: area.squareFeet,
              effectiveSqft: pricing.effectiveSqft,
              lod: resolvedLod,
              scope: scopeType,
              clientPrice,
              upteamCost,
              riskMultiplier,
              category: "modeling",
            });
          }
        } else {
          // Single scope line item
          const scopePortion = SCOPE_PORTIONS[resolvedScope] || 1.0;
          const pricing = calculateAreaPricing({
            sqft: area.squareFeet,
            discipline,
            lod: resolvedLod,
            clientRatePerSqft: null,
            upteamRatePerSqft: null,
            scopePortion,
          });

          // Apply risk premium (ARCH ONLY)
          const riskMultiplier = discipline === "arch" ? calculateRiskMultiplier(areaRisks) : 1;
          const clientPrice = applyRiskPremium(discipline, pricing.clientPrice, areaRisks);
          const upteamCost = pricing.upteamCost;

          lineItems.push({
            id: `li-${lineItemCounter++}`,
            areaId: area.id,
            areaName: area.name,
            discipline,
            buildingType: area.buildingType,
            sqft: area.squareFeet,
            effectiveSqft: pricing.effectiveSqft,
            lod: resolvedLod,
            scope: resolvedScope,
            clientPrice,
            upteamCost,
            riskMultiplier,
            category: "modeling",
          });
        }
      }
    }

    // Additional elevations
    if (area.additionalElevations && area.additionalElevations > 0) {
      const elevPrice = calculateAdditionalElevationsPrice(area.additionalElevations);
      lineItems.push({
        id: `li-${lineItemCounter++}`,
        areaId: area.id,
        areaName: area.name,
        discipline: "elevations",
        buildingType: area.buildingType,
        sqft: 0,
        effectiveSqft: 0,
        lod: "",
        scope: "",
        clientPrice: elevPrice,
        upteamCost: elevPrice * UPTEAM_MULTIPLIER_FALLBACK,
        riskMultiplier: 1,
        category: "elevation",
      });
    }

    // Matterport add-on (for non-type-17 areas with includeMatterport)
    if (area.includeMatterport && area.buildingType !== "17") {
      const mp = calculateMatterportPricing(area.squareFeet);
      lineItems.push({
        id: `li-${lineItemCounter++}`,
        areaId: area.id,
        areaName: area.name,
        discipline: "matterport",
        buildingType: area.buildingType,
        sqft: area.squareFeet,
        effectiveSqft: mp.effectiveSqft,
        lod: "",
        scope: "full",
        clientPrice: mp.clientPrice,
        upteamCost: mp.upteamCost,
        riskMultiplier: 1,
        category: "service",
      });
    }
  }

  // Step 4: Travel calculation
  const travel = input.dispatchLocation.toUpperCase() === "BROOKLYN"
    ? calculateBrooklynTravel(input.distance, totalProjectSqft)
    : calculateStandardTravel(input.distance);

  // Add travel as a line item
  if (travel.totalCost > 0) {
    lineItems.push({
      id: `li-${lineItemCounter++}`,
      areaId: "travel",
      areaName: "Travel",
      discipline: "travel",
      buildingType: "",
      sqft: 0,
      effectiveSqft: 0,
      lod: "",
      scope: "",
      clientPrice: travel.totalCost,
      upteamCost: travel.totalCost,
      riskMultiplier: 1,
      category: "travel",
    });
  }

  // Step 5: Sum subtotals by category
  const subtotals = {
    modeling: 0,
    travel: 0,
    services: 0,
    elevations: 0,
  };
  for (const li of lineItems) {
    if (li.category === "modeling") subtotals.modeling += li.clientPrice;
    else if (li.category === "travel") subtotals.travel += li.clientPrice;
    else if (li.category === "service") subtotals.services += li.clientPrice;
    else if (li.category === "elevation") subtotals.elevations += li.clientPrice;
  }

  // Step 6: Calculate totals
  const totalClientPrice = subtotals.modeling + subtotals.travel + subtotals.services + subtotals.elevations;
  const totalUpteamCost = lineItems.reduce((sum, li) => sum + li.upteamCost, 0);

  // Step 7: Payment term premium
  const grandTotal = applyPaymentTermPremium(totalClientPrice, input.paymentTerms);
  const paymentTermPremium = grandTotal - totalClientPrice;

  // Step 8: Margin calculations
  const grossMargin = grandTotal > 0 ? (grandTotal - totalUpteamCost) / grandTotal : 0;
  const grossMarginPercent = grossMargin * 100;

  // Step 9: Integrity checks
  const integrityFlags: Array<{ code: string; message: string; severity: string }> = [];

  if (grossMargin < FY26_MARGIN_FLOOR) {
    integrityFlags.push({
      code: "MARGIN_FLOOR",
      message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the FY26 floor of ${(FY26_MARGIN_FLOOR * 100).toFixed(0)}%`,
      severity: "error",
    });
  } else if (grossMargin < MARGIN_GUARDRAIL) {
    integrityFlags.push({
      code: "MARGIN_GUARDRAIL",
      message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the guardrail of ${(MARGIN_GUARDRAIL * 100).toFixed(0)}%`,
      severity: "warning",
    });
  }

  let integrityStatus: "passed" | "warning" | "blocked";
  if (integrityFlags.some(f => f.severity === "error")) {
    integrityStatus = "blocked";
  } else if (integrityFlags.some(f => f.severity === "warning")) {
    integrityStatus = "warning";
  } else {
    integrityStatus = "passed";
  }

  const result: QuoteResult = {
    lineItems,
    travel,
    subtotals,
    totalUpteamCost,
    totalClientPrice,
    grossMargin,
    grossMarginPercent,
    integrityStatus,
    integrityFlags,
    paymentTermPremium,
    paymentTerms: input.paymentTerms,
    grandTotal,
    isTierA,
  };

  // Step 10: Apply margin target if provided
  if (input.marginTarget && input.marginTarget > 0) {
    return applyMarginTarget(result, input.marginTarget);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 19. applyMarginTarget — post-calculation margin adjustment
// ---------------------------------------------------------------------------
export function applyMarginTarget(quoteResult: QuoteResult, marginTarget: number): QuoteResult {
  // Adjust client prices so that the overall margin hits the target
  // Formula: newClientPrice = upteamCost / (1 - marginTarget)
  // upteamCost NEVER changes

  const adjustedLineItems = quoteResult.lineItems.map(li => {
    // Travel is pass-through — don't adjust
    if (li.category === "travel") return li;
    if (li.upteamCost <= 0) return li;
    const newClientPrice = li.upteamCost / (1 - marginTarget);
    return { ...li, clientPrice: newClientPrice };
  });

  // Recalculate subtotals
  const subtotals = { modeling: 0, travel: 0, services: 0, elevations: 0 };
  for (const li of adjustedLineItems) {
    if (li.category === "modeling") subtotals.modeling += li.clientPrice;
    else if (li.category === "travel") subtotals.travel += li.clientPrice;
    else if (li.category === "service") subtotals.services += li.clientPrice;
    else if (li.category === "elevation") subtotals.elevations += li.clientPrice;
  }

  const totalClientPrice = subtotals.modeling + subtotals.travel + subtotals.services + subtotals.elevations;
  const totalUpteamCost = adjustedLineItems.reduce((sum, li) => sum + li.upteamCost, 0);
  const grandTotal = applyPaymentTermPremium(totalClientPrice, quoteResult.paymentTerms);
  const paymentTermPremium = grandTotal - totalClientPrice;

  const grossMargin = grandTotal > 0 ? (grandTotal - totalUpteamCost) / grandTotal : 0;
  const grossMarginPercent = grossMargin * 100;

  // Re-run integrity checks
  const integrityFlags: Array<{ code: string; message: string; severity: string }> = [];
  if (grossMargin < FY26_MARGIN_FLOOR) {
    integrityFlags.push({
      code: "MARGIN_FLOOR",
      message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the FY26 floor of ${(FY26_MARGIN_FLOOR * 100).toFixed(0)}%`,
      severity: "error",
    });
  } else if (grossMargin < MARGIN_GUARDRAIL) {
    integrityFlags.push({
      code: "MARGIN_GUARDRAIL",
      message: `Gross margin ${grossMarginPercent.toFixed(1)}% is below the guardrail of ${(MARGIN_GUARDRAIL * 100).toFixed(0)}%`,
      severity: "warning",
    });
  }

  let integrityStatus: "passed" | "warning" | "blocked";
  if (integrityFlags.some(f => f.severity === "error")) {
    integrityStatus = "blocked";
  } else if (integrityFlags.some(f => f.severity === "warning")) {
    integrityStatus = "warning";
  } else {
    integrityStatus = "passed";
  }

  // Recalculate travel with adjusted line items
  const travelLi = adjustedLineItems.find(li => li.category === "travel");
  const adjustedTravel: TravelResult = travelLi
    ? { ...quoteResult.travel, totalCost: travelLi.clientPrice }
    : quoteResult.travel;

  return {
    lineItems: adjustedLineItems,
    travel: adjustedTravel,
    subtotals,
    totalUpteamCost,
    totalClientPrice,
    grossMargin,
    grossMarginPercent,
    integrityStatus,
    integrityFlags,
    paymentTermPremium,
    paymentTerms: quoteResult.paymentTerms,
    grandTotal,
    isTierA: quoteResult.isTierA,
  };
}
