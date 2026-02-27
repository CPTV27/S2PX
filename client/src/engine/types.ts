// Notebook CPQ — TypeScript Interfaces
// Source of truth: NOTEBOOK_CPQ_CLAUDE_CODE_SPEC.md

export type Discipline = "arch" | "mepf" | "structure" | "site";

export interface Area {
  id: string;
  name: string;
  buildingType: string;        // "1" through "17"
  squareFeet: number;          // For standard types; acres for landscape (14-15)
  disciplines: Discipline[];
  lod: string;                 // "200" | "300" | "350", default "300"
  scope: "full" | "interior" | "exterior" | "mixed";
  // Per-discipline LoD/scope overrides
  disciplineLods?: Record<string, { lod: string; scope?: string }>;
  risks?: string[];            // ["occupied", "hazardous", "no_power"]
  additionalElevations?: number;
  includeMatterport?: boolean;
}

export interface QuoteInput {
  areas: Area[];
  dispatchLocation: string;    // "WOODSTOCK", "BROOKLYN", etc.
  distance: number;            // miles
  marginTarget: number;        // 0.35 to 0.60
  paymentTerms: string;        // "partner", "net30", etc.
  risks: string[];             // Global risks applied to all areas
  mileageRate?: number;        // $/mi override (null = use default constant)
  scanDayFee?: number;         // scan day fee override (null = use default $300)
}

export interface LineItem {
  id: string;
  areaId: string;
  areaName: string;
  discipline: string;
  buildingType: string;
  sqft: number;
  effectiveSqft: number;
  lod: string;
  scope: string;
  clientPrice: number;
  upteamCost: number;
  riskMultiplier: number;
  category: "modeling" | "travel" | "service" | "elevation";
}

export interface TravelResult {
  baseCost: number;
  extraMilesCost: number;
  scanDayFee: number;
  totalCost: number;
  label: string;
  tier?: string;
}

export interface QuoteResult {
  lineItems: LineItem[];
  travel: TravelResult;
  subtotals: {
    modeling: number;
    travel: number;
    services: number;
    elevations: number;
  };
  totalUpteamCost: number;
  totalClientPrice: number;
  grossMargin: number;
  grossMarginPercent: number;
  integrityStatus: "passed" | "warning" | "blocked";
  integrityFlags: Array<{ code: string; message: string; severity: string }>;
  paymentTermPremium: number;
  paymentTerms: string;
  grandTotal: number;
  isTierA: boolean;
}

export interface ExtractionResult {
  areas: Area[];
  dispatchLocation: string;
  distance: number;
  risks: string[];
  paymentTerms: string;
  confidence: number;          // 0-1, how confident the extraction is
  ambiguities: string[];       // Things the LLM wasn't sure about
  rawInput: string;
}

// Cell state machine types
export type InputCellState = "empty" | "writing" | "extracting" | "done";
export type ExtractionCellState = "hidden" | "loading" | "review" | "confirmed";
export type QuoteCellState = "hidden" | "calculating" | "ready";
export type ExportCellState = "hidden" | "available";

export interface NotebookSession {
  input: string;
  inputState: InputCellState;
  extraction: ExtractionResult | null;
  extractionState: ExtractionCellState;
  quote: QuoteResult | null;
  quoteState: QuoteCellState;
  exportState: ExportCellState;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  error: string | null;
}
