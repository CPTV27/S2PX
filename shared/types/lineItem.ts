// ── Line Item Shell & Quote Types ──
// Used by shared/engine/ and client components

export interface LineItemShell {
    id: string;
    areaId: string | null; // null for project-level items
    areaName: string; // "Main Building" or "Project-Level"
    category: 'modeling' | 'travel' | 'addOn' | 'custom';
    discipline?: string; // "architecture" | "mepf" | "structure" | "site"
    description: string; // "Architecture — Commercial — 25,000 SF — LoD 300 — Full Scope"
    buildingType: string;
    squareFeet?: number;
    lod?: string;
    scope?: string;

    // CEO fills these:
    upteamCost: number | null; // null = not yet priced
    clientPrice: number | null; // null = not yet priced
}

export interface QuoteTotals {
    totalClientPrice: number;
    totalUpteamCost: number;
    grossMargin: number;
    grossMarginPercent: number;
    integrityStatus: 'passed' | 'warning' | 'blocked';
    integrityFlags: string[];
}
