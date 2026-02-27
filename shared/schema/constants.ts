// ── Shared Constants for S2PX ──
// All dropdown options from the mission brief (CC_MISSION_BRIEF_v2)

// Section D — 13 building types (SF-02)
export const BUILDING_TYPES = [
    'SFR',
    'MF Res',
    'Luxury Res',
    'Commercial',
    'Retail',
    'Kitchen',
    'Schools',
    'Hotel/Theatre',
    'Hospital',
    'Mechanical',
    'Warehouse',
    'Church',
    'Infrastructure',
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

// Section D — Project Scope (SF-04)
export const PROJECT_SCOPES = ['Full', 'Int Only', 'Ext Only', 'Mixed'] as const;
export type ProjectScope = (typeof PROJECT_SCOPES)[number];

// Section D — Level of Detail (SF-05)
export const LOD_LEVELS = ['200', '300', '350'] as const;
export type LodLevel = (typeof LOD_LEVELS)[number];

// Section D — CAD Deliverable (SF-10)
export const CAD_OPTIONS = ['No', 'Basic', 'A+S+Site', 'Full'] as const;
export type CadOption = (typeof CAD_OPTIONS)[number];

// Section E — Landscape (SF-22)
export const LANDSCAPE_OPTIONS = ['No', 'LoD 200', 'LoD 300', 'LoD 350'] as const;

// Section E — Landscape Terrain (SF-43)
export const LANDSCAPE_TERRAIN_TYPES = ['Urban-Built', 'Natural', 'Forested'] as const;

// Section F — BIM Deliverable (SF-11)
export const BIM_DELIVERABLES = ['Revit', 'ArchiCAD', 'SketchUp', 'Rhino', 'Other'] as const;

// Section G — Era (SF-41)
export const ERAS = ['Modern', 'Historic'] as const;

// Section G — Room Density (SF-42)
export const ROOM_DENSITIES = [
    { value: 0, label: '0 - Wide Open' },
    { value: 1, label: '1 - Spacious' },
    { value: 2, label: '2 - Standard' },
    { value: 3, label: '3 - Dense' },
    { value: 4, label: '4 - Extreme' },
] as const;

// Section G — Risk Factors (SF-12)
export const RISK_FACTORS = [
    'Occupied',
    'No Power-HVAC',
    'Hazardous',
    'No Lighting',
    'Fire-Flood',
    'Non-Standard Height',
    'Restricted Access',
] as const;

// Section H — Scan & Reg Only (SF-40)
export const SCAN_REG_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'full_day', label: 'Full Day ($2,500)' },
    { value: 'half_day', label: 'Half Day ($1,500)' },
] as const;

// Section I — Dispatch Locations (SF-32)
export const DISPATCH_LOCATIONS = ['Troy NY', 'Woodstock NY', 'Brooklyn NY', 'Other'] as const;

// Section I — Dispatch location addresses for Google Maps Distance Matrix API
export const DISPATCH_ADDRESSES: Record<string, string> = {
    'Troy NY': 'Troy, NY',
    'Woodstock NY': 'Woodstock, NY',
    'Brooklyn NY': 'Brooklyn, NY',
    'Other': '',
};

// Section I — Travel Modes (SF-50)
export const TRAVEL_MODES = ['Local', 'NYC Small', 'NYC Regional', 'Overnight', 'Flight'] as const;

// Section M — Est. Timeline (SF-16)
export const TIMELINE_OPTIONS = ['1wk', '2wk', '3wk', '4wk', '5wk', '6wk', 'Other'] as const;

// Section M — Payment Terms (SF-17)
export const PAYMENT_TERMS = [
    'Partner',
    'Owner',
    'Net30+5%',
    'Net60+10%',
    'Net90+15%',
    'Other',
] as const;

// Section O — Lead Sources (SF-18, SF-29) — 18 options
export const LEAD_SOURCES = [
    'ABM',
    'Cold',
    'Referral-Client',
    'Referral-Partner',
    'Existing',
    'CEU',
    'Proof Vault',
    'SEO',
    'Social',
    'Paid Ads',
    'Trade Show',
    'Webinar',
    'Content Download',
    'Partner Portal',
    'Inbound',
    'Trigger Event',
    'SDR Outbound',
    'Other',
] as const;

// Section O — Deal Stages (SF-39)
export const DEAL_STAGES = [
    'Lead',
    'Qualified',
    'Proposal',
    'Negotiation',
    'In Hand',
    'Urgent',
    'Lost',
] as const;

// Section O — Priority (SF-38)
export const PRIORITIES = [
    { value: 1, label: '1 - Critical' },
    { value: 2, label: '2 - High' },
    { value: 3, label: '3 - Medium' },
    { value: 4, label: '4 - Low' },
    { value: 5, label: '5 - Backlog' },
] as const;

// Scoping form statuses
export const FORM_STATUSES = [
    'draft',
    'complete',
    'priced',
    'quoted',
    'won',
    'lost',
    'deleted',
] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

// Production pipeline stages
export const PRODUCTION_STAGES = [
    'scheduling',
    'field_capture',
    'registration',
    'bim_qc',
    'pc_delivery',
    'final_delivery',
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

// Quote integrity statuses
export const INTEGRITY_STATUSES = ['passed', 'warning', 'blocked'] as const;
export type IntegrityStatus = (typeof INTEGRITY_STATUSES)[number];

// Section J — Pricing Tier (SF-45)
export const PRICING_TIERS = ['AUTO', 'X7', 'SLAM'] as const;

// Section J — BIM Manager (SF-46)
export const BIM_MANAGER_OPTIONS = ['AUTO', 'YES', 'NO'] as const;

// Section J — Scanner Assignment (SF-47)
export const SCANNER_ASSIGNMENTS = ['Sr', 'Jr'] as const;

// Section C — Basement/Attic options (SF-06)
export const BASEMENT_ATTIC_OPTIONS = ['Basement', 'Attic', 'Neither'] as const;
