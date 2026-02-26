// ── S2PX Scorecard & Reporting Types (Phase 9) ──

export interface ScorecardFilters {
    months?: number;           // lookback period, default 12
    projectTier?: 'Minnow' | 'Dolphin' | 'Whale' | 'all';
    buildingType?: string;
    leadSource?: string;
}

// ── Overview (executive KPI snapshot) ──

export interface ScorecardOverview {
    totalDeals: number;
    wonCount: number;
    lostCount: number;
    activeCount: number;
    winRate: number;
    totalRevenue: number;
    totalCost: number;
    avgDealSize: number;
    blendedMarginPct: number;
    activePipelineValue: number;
    totalSfDelivered: number;
    totalProduction: number;
    deliveredCount: number;
    avgCycleDays: number;
    rmsPassRate: number;
    qcPassRate: number;
    monthlyRevenue: { month: string; revenue: number; cost: number }[];
    monthlyWinRate: { month: string; won: number; lost: number; rate: number }[];
}

// ── Pipeline report ──

export interface PipelineReport {
    funnel: { stage: string; count: number; totalValue: number; weightedValue: number }[];
    monthlyTrend: { month: string; wonCount: number; wonValue: number; lostCount: number; newCount: number }[];
    winRateBySource: { source: string; totalDeals: number; wonDeals: number; winRate: number }[];
    avgDealByTier: { tier: string; avgValue: number; count: number; avgSqft: number }[];
}

// ── Production report ──

export interface ProductionReport {
    stageDistribution: { stage: string; count: number }[];
    qualityGates: {
        fieldRms: { pass: number; fail: number; total: number; passRate: number };
        avgOverlap: { pass: number; fail: number; total: number; passRate: number };
        qcStatus: { pass: number; fail: number; conditional: number; total: number };
    };
    estimateVsActual: {
        totalEstSF: number;
        totalActualSF: number;
        variancePct: number;
        byProject: { upid: string; projectName: string; estSF: number; actualSF: number; variancePct: number }[];
    };
    monthlyThroughput: { month: string; started: number; completed: number }[];
}

// ── Profitability report ──

export interface ProfitabilityReport {
    marginDistribution: { range: string; count: number; color: string }[];
    avgMarginByTier: { tier: string; avgMargin: number; count: number }[];
    costPerSF: { tier: string; avgCostPerSF: number; avgPricePerSF: number; count: number }[];
    travelCostBreakdown: {
        totalMilesDriven: number;
        totalHotelPerDiem: number;
        totalTollsParking: number;
        totalOtherCosts: number;
        avgTravelCostPerProject: number;
    };
    monthlyMarginTrend: { month: string; avgMargin: number; totalRevenue: number; totalCost: number }[];
}
