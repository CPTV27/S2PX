// Golden test cases from spec — run with: npx tsx src/engine/pricing.test.ts

import {
  getAreaTier,
  calculateAreaPricing,
  calculateRiskMultiplier,
  applyRiskPremium,
  calculateAdditionalElevationsPrice,
  calculateStandardTravel,
  calculateBrooklynTravel,
  getBrooklynTravelTier,
  isLandscapeType,
  getLandscapeAcreageTierIndex,
  calculateLandscapePrice,
  calculateLandscapeAreaPricing,
  isTierAProject,
  applyScopeDiscount,
  applyPaymentTermPremium,
  calculateACTAreaPricing,
  calculateMatterportPricing,
} from './pricing';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function assertClose(a: number, b: number, label: string, tolerance = 0.01) {
  assert(Math.abs(a - b) < tolerance, `${label} (got ${a}, expected ${b})`);
}

console.log("\n=== Area Tier Tests ===");
assert(getAreaTier(2000) === "0-3k", "2000 sqft → 0-3k");
assert(getAreaTier(3000) === "3k-5k", "3000 sqft → 3k-5k");
assert(getAreaTier(10000) === "10k-25k", "10000 sqft → 10k-25k");
assert(getAreaTier(50000) === "50k-75k", "50000 sqft → 50k-75k");
assert(getAreaTier(100000) === "100k+", "100000 sqft → 100k+");

console.log("\n=== Risk Multiplier Tests ===");
assertClose(calculateRiskMultiplier(["occupied"]), 1.15, "occupied");
assertClose(calculateRiskMultiplier(["hazardous"]), 1.25, "hazardous");
assertClose(calculateRiskMultiplier(["occupied", "hazardous"]), 1.40, "occupied+hazardous");
assertClose(calculateRiskMultiplier([]), 1.0, "no risks");

console.log("\n=== Risk Premium Tests (ARCH ONLY) ===");
assertClose(applyRiskPremium("arch", 1000, ["occupied"]), 1150, "arch+occupied");
assertClose(applyRiskPremium("arch", 1000, ["hazardous"]), 1250, "arch+hazardous");
assertClose(applyRiskPremium("arch", 1000, ["occupied", "hazardous"]), 1400, "arch+occupied+hazardous");
assertClose(applyRiskPremium("mepf", 1000, ["occupied"]), 1000, "mepf NOT affected");
assertClose(applyRiskPremium("structure", 1000, ["occupied", "hazardous"]), 1000, "structure NOT affected");
assertClose(applyRiskPremium("site", 1000, ["occupied"]), 1000, "site NOT affected");

console.log("\n=== Elevation Pricing Tests ===");
assertClose(calculateAdditionalElevationsPrice(0), 0, "0 elevations");
assertClose(calculateAdditionalElevationsPrice(5), 125, "5 elevations (5×$25)");
assertClose(calculateAdditionalElevationsPrice(10), 250, "10 elevations (10×$25)");
assertClose(calculateAdditionalElevationsPrice(15), 350, "15 elevations (10×$25 + 5×$20)");
assertClose(calculateAdditionalElevationsPrice(25), 525, "25 elevations (10×$25 + 10×$20 + 5×$15)");

console.log("\n=== Standard Travel Tests ===");
assertClose(calculateStandardTravel(30).totalCost, 90, "30mi → $90");
assertClose(calculateStandardTravel(74).scanDayFee, 0, "74mi → no scan day fee");
assertClose(calculateStandardTravel(74).totalCost, 222, "74mi → $222");
assertClose(calculateStandardTravel(75).scanDayFee, 300, "75mi → $300 scan day fee");
assertClose(calculateStandardTravel(75).totalCost, 525, "75mi → $525");
assertClose(calculateStandardTravel(80).totalCost, 540, "80mi → $540");

console.log("\n=== Brooklyn Travel Tests ===");
assert(getBrooklynTravelTier(8000) === "tierC", "8k sqft → tierC");
assert(getBrooklynTravelTier(25000) === "tierB", "25k sqft → tierB");
assert(getBrooklynTravelTier(75000) === "tierA", "75k sqft → tierA");
assertClose(calculateBrooklynTravel(15, 8000).totalCost, 150, "Brooklyn 15mi/8k → $150");
assertClose(calculateBrooklynTravel(25, 25000).totalCost, 320, "Brooklyn 25mi/25k → $320");
assertClose(calculateBrooklynTravel(30, 75000).totalCost, 40, "Brooklyn 30mi/75k → $40");
assertClose(calculateBrooklynTravel(25, 25000).scanDayFee, 0, "Brooklyn NO scan day fee");

console.log("\n=== Landscape Tests ===");
assert(isLandscapeType("14") === true, "Type 14 is landscape");
assert(isLandscapeType("15") === true, "Type 15 is landscape");
assert(isLandscapeType("1") === false, "Type 1 is not landscape");
assert(getLandscapeAcreageTierIndex(3) === 0, "3 acres → tier 0");
assert(getLandscapeAcreageTierIndex(10) === 1, "10 acres → tier 1");
assert(getLandscapeAcreageTierIndex(100) === 4, "100 acres → tier 4");

// Built Landscape (Type 14), 5 acres, LOD 300 → 5ac tier is 5-20 (index 1) → $750/ac
assertClose(calculateLandscapePrice("14", 5, "300"), 3750, "Built 5ac LOD 300");
const la14 = calculateLandscapeAreaPricing("14", 5, "300");
assertClose(la14.clientPrice, 3750, "Built 5ac client price");
assertClose(la14.upteamCost, 2437.50, "Built 5ac upteam cost");

// Natural Landscape (Type 15), 10 acres, LOD 350 → 5-20 (index 1) → $750/ac
assertClose(calculateLandscapePrice("15", 10, "350"), 7500, "Natural 10ac LOD 350");
// Natural Landscape, 3 acres, LOD 200 → <5 (index 0) → $625/ac
assertClose(calculateLandscapePrice("15", 3, "200"), 1875, "Natural 3ac LOD 200");

console.log("\n=== Tier A Tests ===");
assert(isTierAProject(49999) === false, "49999 sqft → not Tier A");
assert(isTierAProject(50000) === true, "50000 sqft → Tier A");

console.log("\n=== Scope Discount Tests ===");
assertClose(applyScopeDiscount(1000, "full"), 1000, "full scope → $1000");
assertClose(applyScopeDiscount(1000, "interior"), 650, "interior scope → $650");
assertClose(applyScopeDiscount(1000, "exterior"), 350, "exterior scope → $350");

console.log("\n=== Payment Term Tests ===");
assertClose(applyPaymentTermPremium(10000, "net30"), 10500, "net30 → $10,500");
assertClose(applyPaymentTermPremium(10000, "net90"), 11500, "net90 → $11,500");
assertClose(applyPaymentTermPremium(10000, "partner"), 10000, "partner → $10,000");
assertClose(applyPaymentTermPremium(10000, "owner"), 10000, "owner → $10,000");

console.log("\n=== ACT Pricing Tests ===");
assertClose(calculateACTAreaPricing(5000).clientPrice, 1000, "ACT 5000sqft → $1,000");
assertClose(calculateACTAreaPricing(5000).upteamCost, 650, "ACT 5000sqft upteam → $650");
assertClose(calculateACTAreaPricing(2000).clientPrice, 600, "ACT 2000sqft (floor 3000) → $600");
assertClose(calculateACTAreaPricing(2000).upteamCost, 390, "ACT 2000sqft upteam → $390");
assertClose(calculateACTAreaPricing(10000, 0.65).clientPrice, 1300, "ACT 10000sqft interior → $1,300");

console.log("\n=== Matterport Pricing Tests ===");
assertClose(calculateMatterportPricing(5000).clientPrice, 50, "MP 5000sqft → $50");
assertClose(calculateMatterportPricing(5000).upteamCost, 32.50, "MP 5000sqft upteam → $32.50");
assertClose(calculateMatterportPricing(2000).clientPrice, 30, "MP 2000sqft (floor 3000) → $30");
assertClose(calculateMatterportPricing(2000).upteamCost, 19.50, "MP 2000sqft upteam → $19.50");

console.log("\n=== Modeling Cost Tests (fallback rates) ===");
// 5000 sqft, arch, LOD 300, null rates, full scope
// Fallback: 5000 × $0.25 × 1.3 × 1.0 = $1,625 client, $1,056.25 upteam
const mc1 = calculateAreaPricing({ sqft: 5000, discipline: "arch", lod: "300", clientRatePerSqft: null, upteamRatePerSqft: null, scopePortion: 1.0 });
assertClose(mc1.clientPrice, 1625, "arch 5k/LOD300 fallback client");
assertClose(mc1.upteamCost, 1056.25, "arch 5k/LOD300 fallback upteam");

// 5000 sqft, arch, LOD 300, DB rates $3.50/$2.00, full scope
const mc2 = calculateAreaPricing({ sqft: 5000, discipline: "arch", lod: "300", clientRatePerSqft: 3.50, upteamRatePerSqft: 2.00, scopePortion: 1.0 });
assertClose(mc2.clientPrice, 17500, "arch 5k/LOD300 DB rate client");
assertClose(mc2.upteamCost, 10000, "arch 5k/LOD300 DB rate upteam");

// 2000 sqft (floor to 3000), arch, LOD 300, DB rates $3.00/$1.80
const mc3 = calculateAreaPricing({ sqft: 2000, discipline: "arch", lod: "300", clientRatePerSqft: 3.00, upteamRatePerSqft: 1.80, scopePortion: 1.0 });
assertClose(mc3.clientPrice, 9000, "arch 2k→3k floor client");
assertClose(mc3.upteamCost, 5400, "arch 2k→3k floor upteam");
assert(mc3.effectiveSqft === 3000, "2000 sqft floors to 3000");

// 10000 sqft, arch, LOD 300, DB rates, interior scope (0.65)
const mc4 = calculateAreaPricing({ sqft: 10000, discipline: "arch", lod: "300", clientRatePerSqft: 3.00, upteamRatePerSqft: 1.80, scopePortion: 0.65 });
assertClose(mc4.clientPrice, 19500, "arch 10k interior client");
assertClose(mc4.upteamCost, 11700, "arch 10k interior upteam");

// 10000 sqft, arch, LOD 300, DB rates, exterior scope (0.35)
const mc5 = calculateAreaPricing({ sqft: 10000, discipline: "arch", lod: "300", clientRatePerSqft: 3.00, upteamRatePerSqft: 1.80, scopePortion: 0.35 });
assertClose(mc5.clientPrice, 10500, "arch 10k exterior client");
assertClose(mc5.upteamCost, 6300, "arch 10k exterior upteam");

console.log("\n========================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("All golden tests passed ✅");
} else {
  console.error(`${failed} test(s) FAILED ❌`);
  process.exit(1);
}
