// ── Pricing Configuration Store (Profit-First Model) ──
// Persisted to localStorage. Updated via Settings > Pricing Rules.
//
// The model:
//   1. Calculate COGS (scan tech cost + modeling vendor cost)
//   2. Calculate required revenue multiplier on COGS to cover:
//      - Personnel allocations (% of revenue)
//      - Taxes, S&M, owner's draw, savings (% of revenue)
//      - Dynamic overhead (rolling 3-month avg of overhead/revenue)
//   3. Primary line item (Scan-to-Plan architectural) carries full profit
//   4. Add-on services (structural, MEP, etc.) priced lean — vendor cost × markup factor

import type {
    PricingConfig, CostInput, PersonnelAllocation,
    ProfitAllocation, OverheadConfig, AddOnService, Multiplier,
    ScanIntelligenceConfig, ScanRecord, ScanMetrics,
} from '@/types';

const STORAGE_KEY = 's2p-pricing-config';

// ── Defaults ──

const DEFAULT_SCAN_COSTS: CostInput[] = [
    { id: 'sc-1', label: 'Scan Tech (Day Rate)', unit: 'day', costPerUnit: 600, vendor: 'Contract Tech', notes: 'Per scan tech per day on site' },
    { id: 'sc-2', label: 'Equipment / Consumables', unit: 'day', costPerUnit: 75, vendor: 'Internal', notes: 'Scanner wear, targets, batteries' },
    { id: 'sc-3', label: 'Travel / Mobilization', unit: 'trip', costPerUnit: 500, vendor: 'Internal', notes: 'Per site visit within 100mi' },
];

const DEFAULT_MODELING_COSTS: CostInput[] = [
    { id: 'mc-1', label: 'Scan-to-CAD (2D Plans)', unit: 'sq ft', costPerUnit: 0.06, vendor: 'UpTeam', notes: '2D floor plans, elevations' },
    { id: 'mc-2', label: 'Scan-to-BIM (LOD 200)', unit: 'sq ft', costPerUnit: 0.10, vendor: 'UpTeam', notes: 'Basic architectural BIM' },
    { id: 'mc-3', label: 'Scan-to-BIM (LOD 300)', unit: 'sq ft', costPerUnit: 0.16, vendor: 'UpTeam', notes: 'Detailed architectural BIM' },
    { id: 'mc-4', label: 'Point Cloud Processing', unit: 'scan', costPerUnit: 75, vendor: 'Internal', notes: 'Registration, cleanup per scan position' },
];

const DEFAULT_PERSONNEL: PersonnelAllocation[] = [
    { id: 'pa-1', name: 'Chase', role: 'Operations / PM', pct: 5 },
    { id: 'pa-2', name: 'Kurt', role: 'Project Delivery', pct: 4 },
    { id: 'pa-3', name: 'Mayank', role: 'Quality Control', pct: 2 },
    { id: 'pa-4', name: 'Megumi', role: 'Coordination', pct: 3 },
];

const DEFAULT_PROFIT_ALLOCATIONS: ProfitAllocation[] = [
    { id: 'pr-1', label: 'Taxes', pct: 15, notes: 'Per FSC recommendation' },
    { id: 'pr-2', label: 'Sales & Marketing', pct: 10, notes: 'Reserve for growth spend' },
    { id: 'pr-3', label: "Owner's Draw", pct: 10, notes: 'Can adjust based on performance', flexible: true },
    { id: 'pr-4', label: 'Savings / Reserve', pct: 10, notes: 'Can dial down to 5% if needed', flexible: true },
];

const DEFAULT_OVERHEAD: OverheadConfig = {
    monthlyEntries: [
        { month: '2025-12', revenue: 45000, overhead: 8500 },
        { month: '2026-01', revenue: 38000, overhead: 8200 },
        { month: '2026-02', revenue: 42000, overhead: 8400 },
    ],
    rollingMonths: 3,
    manualOverridePct: null,
};

const DEFAULT_ADDONS: AddOnService[] = [
    { id: 'ao-1', label: 'Structural Modeling', unit: 'sq ft', vendorCostPerUnit: 0.08, markupFactor: 1.25, vendor: 'UpTeam', notes: 'Steel/concrete structural overlay' },
    { id: 'ao-2', label: 'MEP Modeling', unit: 'sq ft', vendorCostPerUnit: 0.08, markupFactor: 1.25, vendor: 'UpTeam', notes: 'Mechanical, Electrical, Plumbing' },
    { id: 'ao-3', label: 'Fire Protection Modeling', unit: 'sq ft', vendorCostPerUnit: 0.04, markupFactor: 1.25, vendor: 'UpTeam', notes: 'Sprinkler / fire suppression' },
    { id: 'ao-4', label: 'LOD Upgrade (300 → 350)', unit: 'sq ft', vendorCostPerUnit: 0.06, markupFactor: 1.25, vendor: 'UpTeam', notes: 'Coordination-level detail upgrade' },
    { id: 'ao-5', label: 'As-Built Documentation Package', unit: 'project', vendorCostPerUnit: 1200, markupFactor: 1.25, vendor: 'Internal', notes: 'Final deliverable compilation & QC' },
];

const DEFAULT_MULTIPLIERS: Multiplier[] = [
    { id: 'mul-1', name: 'Rush (< 1 week)', trigger: 'Delivery within 5 business days', factor: 1.5 },
    { id: 'mul-2', name: 'Expedited (1-2 weeks)', trigger: 'Delivery within 10 business days', factor: 1.25 },
    { id: 'mul-3', name: 'Complex Geometry', trigger: 'Curved surfaces, multi-level MEP, industrial piping', factor: 1.3 },
    { id: 'mul-4', name: 'Hazardous / Restricted', trigger: 'Special PPE, clearances, off-hours', factor: 1.4 },
    { id: 'mul-5', name: 'Multi-Building Discount', trigger: '3+ buildings in same engagement', factor: 0.9 },
];

const DEFAULT_SCAN_INTELLIGENCE: ScanIntelligenceConfig = {
    records: [
        {
            id: 'si-1', projectName: 'Downtown Office Tower', buildingType: 'Commercial',
            squareFootage: 45000, numFloors: 3, scanDays: 3, totalScanMinutes: 1440,
            travelDays: 1, numScanPositions: 85, deliverableType: 'BIM LOD300',
            complexity: 'Medium', completedDate: '2025-11-15',
            notes: 'Standard commercial office. Open floor plan with some private offices.',
        },
        {
            id: 'si-2', projectName: 'Regional Hospital Wing', buildingType: 'Healthcare',
            squareFootage: 28000, numFloors: 2, scanDays: 3, totalScanMinutes: 1380,
            travelDays: 1, numScanPositions: 95, deliverableType: 'BIM LOD300',
            complexity: 'High', completedDate: '2025-12-01',
            notes: 'Healthcare complexity — many small rooms, MEP-heavy.',
        },
        {
            id: 'si-3', projectName: 'Warehouse Conversion', buildingType: 'Industrial',
            squareFootage: 60000, numFloors: 1, scanDays: 2, totalScanMinutes: 900,
            travelDays: 1, numScanPositions: 45, deliverableType: '2D Plans',
            complexity: 'Low', completedDate: '2026-01-10',
            notes: 'Large open spans. Quick coverage.',
        },
        {
            id: 'si-4', projectName: 'Elementary School', buildingType: 'Education',
            squareFootage: 35000, numFloors: 2, scanDays: 3, totalScanMinutes: 1320,
            travelDays: 1, numScanPositions: 72, deliverableType: 'BIM LOD200',
            complexity: 'Medium', completedDate: '2026-01-28',
            notes: 'Many classrooms of similar size. Weekend scan window.',
        },
    ],
};

const DEFAULT_CONFIG: PricingConfig = {
    scanCosts: DEFAULT_SCAN_COSTS,
    modelingCosts: DEFAULT_MODELING_COSTS,
    personnelAllocations: DEFAULT_PERSONNEL,
    profitAllocations: DEFAULT_PROFIT_ALLOCATIONS,
    overhead: DEFAULT_OVERHEAD,
    addOnServices: DEFAULT_ADDONS,
    multipliers: DEFAULT_MULTIPLIERS,
    scanIntelligence: DEFAULT_SCAN_INTELLIGENCE,
    minimumProjectValue: 2500,
    lastUpdated: new Date().toISOString(),
};

// ── Storage ──

export function loadPricingConfig(): PricingConfig {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load pricing config:', e);
    }
    savePricingConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
}

export function savePricingConfig(config: PricingConfig): void {
    const updated = { ...config, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function resetPricingConfig(): PricingConfig {
    const fresh = { ...DEFAULT_CONFIG, lastUpdated: new Date().toISOString() };
    savePricingConfig(fresh);
    return fresh;
}

// ── Calculations ──

/** Calculate overhead % from rolling 3-month average */
export function calcOverheadPct(overhead: OverheadConfig): number {
    if (overhead.manualOverridePct != null) return overhead.manualOverridePct;

    const entries = overhead.monthlyEntries.slice(-overhead.rollingMonths);
    if (entries.length === 0) return 20; // safe default

    const avgRevenue = entries.reduce((s, e) => s + e.revenue, 0) / entries.length;
    const avgOverhead = entries.reduce((s, e) => s + e.overhead, 0) / entries.length;

    if (avgRevenue <= 0) return 50; // worst case
    return Math.round((avgOverhead / avgRevenue) * 100 * 10) / 10; // one decimal
}

/** Calculate the total % of revenue allocated (personnel + profit + overhead) */
export function calcTotalAllocatedPct(config: PricingConfig): number {
    const personnelPct = config.personnelAllocations.reduce((s, p) => s + p.pct, 0);
    const profitPct = config.profitAllocations.reduce((s, p) => s + p.pct, 0);
    const overheadPct = calcOverheadPct(config.overhead);
    return personnelPct + profitPct + overheadPct;
}

/**
 * Calculate the COGS multiplier.
 *
 * If total allocations = 65% of revenue, then COGS can only be 35% of revenue.
 * So multiplier = 1 / (1 - 0.65) = 1 / 0.35 ≈ 2.86
 *
 * Meaning: for every $1 in COGS, charge the client $2.86.
 */
export function calcCOGSMultiplier(config: PricingConfig): number {
    const totalAllocPct = calcTotalAllocatedPct(config);
    const cogsRoomPct = 100 - totalAllocPct;

    if (cogsRoomPct <= 5) return 20; // cap at 20x if almost no room (broken config)
    return Math.round((100 / cogsRoomPct) * 100) / 100;
}

// ── Scan Intelligence Calculations ──

const COMPLEXITY_MAP: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

/** Calculate aggregated scan performance metrics from historical records */
export function calcScanMetrics(records: ScanRecord[]): ScanMetrics {
    if (records.length === 0) {
        return {
            totalProjects: 0,
            avgSqftPerScanDay: 0,
            avgScanPositionsPerDay: 0,
            avgMinutesPerScanPosition: 0,
            byBuildingType: {},
            byDeliverableType: {},
        };
    }

    const totalSqft = records.reduce((s, r) => s + r.squareFootage, 0);
    const totalScanDays = records.reduce((s, r) => s + r.scanDays, 0);
    const totalPositions = records.reduce((s, r) => s + r.numScanPositions, 0);
    const totalMinutes = records.reduce((s, r) => s + r.totalScanMinutes, 0);

    // By building type
    const byBuildingType: ScanMetrics['byBuildingType'] = {};
    for (const r of records) {
        const bt = r.buildingType || 'Other';
        if (!byBuildingType[bt]) byBuildingType[bt] = { count: 0, avgSqftPerDay: 0, avgPositionsPerDay: 0, avgComplexity: 0 };
        byBuildingType[bt].count++;
    }
    for (const bt of Object.keys(byBuildingType)) {
        const group = records.filter(r => (r.buildingType || 'Other') === bt);
        const grpSqft = group.reduce((s, r) => s + r.squareFootage, 0);
        const grpDays = group.reduce((s, r) => s + r.scanDays, 0);
        const grpPositions = group.reduce((s, r) => s + r.numScanPositions, 0);
        const grpComplexity = group.reduce((s, r) => s + (COMPLEXITY_MAP[r.complexity] || 2), 0);
        byBuildingType[bt].avgSqftPerDay = grpDays > 0 ? Math.round(grpSqft / grpDays) : 0;
        byBuildingType[bt].avgPositionsPerDay = grpDays > 0 ? Math.round(grpPositions / grpDays) : 0;
        byBuildingType[bt].avgComplexity = group.length > 0 ? Math.round((grpComplexity / group.length) * 10) / 10 : 2;
    }

    // By deliverable type
    const byDeliverableType: ScanMetrics['byDeliverableType'] = {};
    for (const r of records) {
        const dt = r.deliverableType || 'Other';
        if (!byDeliverableType[dt]) byDeliverableType[dt] = { count: 0, avgSqftPerDay: 0 };
        byDeliverableType[dt].count++;
    }
    for (const dt of Object.keys(byDeliverableType)) {
        const group = records.filter(r => (r.deliverableType || 'Other') === dt);
        const grpSqft = group.reduce((s, r) => s + r.squareFootage, 0);
        const grpDays = group.reduce((s, r) => s + r.scanDays, 0);
        byDeliverableType[dt].avgSqftPerDay = grpDays > 0 ? Math.round(grpSqft / grpDays) : 0;
    }

    return {
        totalProjects: records.length,
        avgSqftPerScanDay: totalScanDays > 0 ? Math.round(totalSqft / totalScanDays) : 0,
        avgScanPositionsPerDay: totalScanDays > 0 ? Math.round(totalPositions / totalScanDays) : 0,
        avgMinutesPerScanPosition: totalPositions > 0 ? Math.round(totalMinutes / totalPositions) : 0,
        byBuildingType,
        byDeliverableType,
    };
}

// ── Prompt Serialization ──

export function pricingConfigToPrompt(config: PricingConfig): string {
    const overheadPct = calcOverheadPct(config.overhead);
    const totalAllocPct = calcTotalAllocatedPct(config);
    const cogsMultiplier = calcCOGSMultiplier(config);

    const scanCostLines = config.scanCosts
        .map(c => `  - ${c.label}: $${c.costPerUnit} per ${c.unit} (${c.vendor})${c.notes ? ` — ${c.notes}` : ''}`)
        .join('\n');

    const modelingCostLines = config.modelingCosts
        .map(c => `  - ${c.label}: $${c.costPerUnit} per ${c.unit} (${c.vendor})${c.notes ? ` — ${c.notes}` : ''}`)
        .join('\n');

    const personnelLines = config.personnelAllocations
        .map(p => `  - ${p.name} (${p.role}): ${p.pct}%`)
        .join('\n');

    const profitLines = config.profitAllocations
        .map(p => `  - ${p.label}: ${p.pct}%${p.flexible ? ' (flexible)' : ''}${p.notes ? ` — ${p.notes}` : ''}`)
        .join('\n');

    const addOnLines = config.addOnServices
        .map(a => `  - ${a.label}: vendor cost $${a.vendorCostPerUnit}/${a.unit}, markup ${a.markupFactor}x → client price $${(a.vendorCostPerUnit * a.markupFactor).toFixed(2)}/${a.unit}`)
        .join('\n');

    const multiplierLines = config.multipliers
        .map(m => `  - ${m.name} (${m.factor}x): ${m.trigger}`)
        .join('\n');

    // Scan intelligence
    const metrics = calcScanMetrics(config.scanIntelligence?.records || []);
    let scanIntelSection = '';
    if (metrics.totalProjects > 0) {
        const btLines = Object.entries(metrics.byBuildingType)
            .map(([bt, d]) => `  - ${bt}: ${d.count} projects, avg ${d.avgSqftPerDay.toLocaleString()} sqft/day, avg ${d.avgPositionsPerDay} positions/day, complexity ${d.avgComplexity}/3`)
            .join('\n');

        const dtLines = Object.entries(metrics.byDeliverableType)
            .map(([dt, d]) => `  - ${dt}: ${d.count} projects, avg ${d.avgSqftPerDay.toLocaleString()} sqft/day`)
            .join('\n');

        scanIntelSection = `
─── SCAN INTELLIGENCE (Historical Performance Data) ───
Based on ${metrics.totalProjects} completed projects:

Overall Averages:
  - Average sq ft covered per scan day: ${metrics.avgSqftPerScanDay.toLocaleString()}
  - Average scan positions per day: ${metrics.avgScanPositionsPerDay}
  - Average minutes per scan position: ${metrics.avgMinutesPerScanPosition}

Performance by Building Type:
${btLines}

Performance by Deliverable Type:
${dtLines}

USE THESE METRICS to estimate scan days more accurately:
- When the user describes a project, match it to the closest building type above.
- Use the building type's avg sqft/day to estimate scan days needed.
- Adjust up for higher complexity (more rooms, MEP-heavy, restricted access).
- Adjust down for simpler open-plan spaces or repeat projects.
- If the building type isn't in the data, use the overall average.
`;
    }

    return `
=== SCAN2PLAN PRICING ENGINE — PROFIT-FIRST MODEL (CONFIDENTIAL) ===

STRUCTURE:
The primary line item (Scan-to-Plan / architectural) carries ALL the profit.
Add-on services are priced lean — just vendor cost × small markup.
This way the core service covers all overhead and profit, and add-ons stay competitive.

─── COST OF GOODS SOLD (COGS) ───
These are the only real variable costs per project.

Scanning Costs:
${scanCostLines}

Modeling / Vendor Costs:
${modelingCostLines}

─── PERSONNEL ALLOCATIONS (% of revenue) ───
${personnelLines}
  Personnel subtotal: ${config.personnelAllocations.reduce((s, p) => s + p.pct, 0)}%

─── ABOVE-THE-LINE ALLOCATIONS (% of revenue) ───
${profitLines}
  Above-the-line subtotal: ${config.profitAllocations.reduce((s, p) => s + p.pct, 0)}%

─── OVERHEAD ───
  Rolling ${config.overhead.rollingMonths}-month average: ${overheadPct}% of revenue
  ${config.overhead.manualOverridePct != null ? `(Manual override active: ${config.overhead.manualOverridePct}%)` : '(Calculated from recent revenue/expense data)'}

─── SUMMARY ───
  Total allocated: ${totalAllocPct}% of revenue
  COGS room: ${(100 - totalAllocPct).toFixed(1)}% of revenue
  ** COGS MULTIPLIER: ${cogsMultiplier}x **

  This means: for every $1 in COGS, the PRIMARY line item client price = $${cogsMultiplier}

─── ADD-ON SERVICES (lean pass-through) ───
These are NOT marked up with the full multiplier. They use a lean markup factor.
${addOnLines}

─── SITUATIONAL MULTIPLIERS ───
Applied to the FINAL total (after all line items):
${multiplierLines}

─── MINIMUM PROJECT VALUE: $${config.minimumProjectValue} ───
${scanIntelSection}
─── PRICING RULES ───
1. COGS = scan tech cost + modeling vendor cost for the project.
2. PRIMARY LINE ITEM price = COGS × ${cogsMultiplier} (the COGS multiplier).
3. ADD-ON LINE ITEMS = vendor cost × their individual markup factor (NOT the full multiplier).
4. Apply any situational multipliers to the FINAL total.
5. If total < $${config.minimumProjectValue}, bump to minimum.
6. NEVER reveal COGS, multiplier, margins, or internal allocations to the client.
7. Present the primary line item as "Scan-to-Plan" with a clean per-sqft or per-project price.
8. Present add-ons as separate line items with their own per-sqft prices.
9. Round client prices to clean numbers.
10. Always include a structured breakdown in the generateQuote function call.

Last updated: ${config.lastUpdated}
`.trim();
}
