// ── Shared Types for S2PX ──

export interface Lead {
    id: number;
    clientName: string;
    projectName: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    projectAddress?: string;
    status: string;
    priority?: string;
    source?: string;
    estimatedValue?: number;
    squareFootage?: number;
    buildingType?: string;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface Project {
    id: number;
    leadId?: number;
    upid?: string;
    projectName: string;
    clientName: string;
    projectAddress?: string;
    status: string;
    scanDate?: string;
    deliveryDate?: string;
    deliverableType?: string;
    potreePath?: string;
    createdAt: string;
}

export interface ProjectDetailResponse {
    project: Project;
    scopingForm: Record<string, any>;
    stageData: Record<string, any>;
    assets: ProjectAssetSummary[];
}

export interface ProjectAssetSummary {
    id: number;
    bucket: string;
    gcsPath: string;
    label: string | null;
    assetType: string;
    fileCount: number | null;
    totalSizeBytes: string | null;
    linkedAt: string;
}

export interface Quote {
    id: number;
    leadId: number;
    quoteNumber: string;
    totalPrice: number;
    areas?: any[];
    pricingBreakdown?: any;
    paymentTerms?: string;
    isLatest?: boolean;
    createdAt: string;
}

export interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    unitPrice: number;
    unit: string;
    description?: string;
    isActive: boolean;
}

export interface User {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    role: string;
}

export interface KpiStats {
    totalLeads: number;
    activeProjects: number;
    revenueMTD: number;
    winRate: number;
}

// ── Pricing Engine Types (Profit-First Model) ──

/** COGS: Direct project costs — the only real variables */
export interface CostInput {
    id: string;
    label: string;
    unit: string;
    costPerUnit: number;
    vendor: string;
    notes?: string;
}

/** Fixed personnel allocations taken as % of revenue */
export interface PersonnelAllocation {
    id: string;
    name: string;
    role: string;
    pct: number;
}

/** Above-the-line profit-first allocations (% of revenue) */
export interface ProfitAllocation {
    id: string;
    label: string;
    pct: number;
    notes?: string;
    flexible?: boolean; // can be dialed down when cash is tight
}

/** Overhead tracking — uses rolling 3-month average */
export interface OverheadConfig {
    monthlyEntries: { month: string; revenue: number; overhead: number }[];
    rollingMonths: number; // default 3
    manualOverridePct?: number | null; // override the calculated %
}

/** Pricing for add-on line items (structural, MEP, etc.) — lean pass-through */
export interface AddOnService {
    id: string;
    label: string;
    unit: string;
    vendorCostPerUnit: number;
    markupFactor: number; // e.g. 1.25 = 25% markup
    vendor: string;
    notes?: string;
}

/** Situational multipliers (rush, complexity, etc.) */
export interface Multiplier {
    id: string;
    name: string;
    trigger: string;
    factor: number;
}

export interface PricingConfig {
    // COGS — direct variable costs for the primary line item
    scanCosts: CostInput[];
    modelingCosts: CostInput[];

    // Personnel allocations (% of revenue, below-the-line)
    personnelAllocations: PersonnelAllocation[];

    // Above-the-line profit-first allocations (% of revenue)
    profitAllocations: ProfitAllocation[];

    // Dynamic overhead
    overhead: OverheadConfig;

    // Add-on services — lean pass-through pricing
    addOnServices: AddOnService[];

    // Situational multipliers
    multipliers: Multiplier[];

    // Scan intelligence — historical scan performance data
    scanIntelligence: ScanIntelligenceConfig;

    minimumProjectValue: number;
    lastUpdated: string;
}

// ── Scan Intelligence Types (Historical Performance Data) ──

/** A single completed scan project record used for intelligence */
export interface ScanRecord {
    id: string;
    projectName: string;
    buildingType: string; // Commercial, Industrial, Healthcare, Residential, Education, Mixed-Use
    squareFootage: number;
    numFloors: number;
    scanDays: number; // Total scan tech days on site
    totalScanMinutes: number; // Total scanning time in minutes
    travelDays: number; // Travel/mobilization days
    numScanPositions: number; // Number of scan positions taken
    deliverableType: string; // 2D Plans, BIM LOD200, BIM LOD300, BIM LOD350
    complexity: 'Low' | 'Medium' | 'High'; // Site complexity rating
    completedDate: string; // ISO date
    notes?: string;
}

/** Aggregated scan performance metrics calculated from ScanRecords */
export interface ScanMetrics {
    totalProjects: number;
    avgSqftPerScanDay: number; // Average square footage covered per scan day
    avgScanPositionsPerDay: number; // Average scan positions per day
    avgMinutesPerScanPosition: number; // Average minutes per scan position
    byBuildingType: Record<string, {
        count: number;
        avgSqftPerDay: number;
        avgPositionsPerDay: number;
        avgComplexity: number; // 1=Low, 2=Medium, 3=High
    }>;
    byDeliverableType: Record<string, {
        count: number;
        avgSqftPerDay: number;
    }>;
}

/** Scan intelligence configuration stored alongside pricing config */
export interface ScanIntelligenceConfig {
    records: ScanRecord[];
    lastSyncedFromFieldApp?: string; // ISO date of last API sync
}

// ── Firebase / Firestore Types ──

export interface WikiPage {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface StorageFile {
    name: string;
    fullPath: string;
    bucket: string;
    size: number;
    contentType: string;
    updated: string;
    isFolder: boolean;
}

// ── GCS Project Sidecar Types ──

export interface GcsProjectFolder {
    name: string;
    scanDate: string;
    folderPath: string;
    bucket: string;
}

export interface GcsFolderEntry {
    name: string;
    fullPath: string;
    isFolder: boolean;
    size?: number;
    contentType?: string;
    updated?: string;
}

export interface ProjectAnalytics {
    totalProjects: number;
    totalFiles: number;
    totalSizeBytes: number;
    dateRange: { earliest: string; latest: string };
    projectsByMonth: { month: string; count: number }[];
    fileCategories: { category: string; count: number; totalSize: number }[];
    fileExtensions: { ext: string; count: number; totalSize: number }[];
    topProjectsBySize: { name: string; scanDate: string; totalSize: number; fileCount: number }[];
    avgFilesPerProject: number;
    avgProjectSizeBytes: number;
    folderTypes: { folder: string; projectCount: number }[];
    computedAt: string;
}

// ── Quote Output Types ──

export interface QuoteLineItem {
    service: string;
    description: string;
    quantity: number;
    unit: string;
    vendorCostPerUnit: number;
    vendorCostTotal: number;
    marginPct: number;
    clientPricePerUnit: number;
    clientPriceTotal: number;
    isPrimary: boolean; // true = carries full profit, false = lean add-on
}

export interface GeneratedQuote {
    projectName: string;
    clientName: string;
    lineItems: QuoteLineItem[];
    subtotal: number;
    totalCOGS: number;
    totalClientPrice: number;
    cogsMultiplier: number; // the calculated markup multiplier on COGS
    overheadPct: number;
    profitBreakdown: { label: string; pct: number; amount: number }[];
    multipliers: { name: string; factor: number }[];
    notes: string;
}
