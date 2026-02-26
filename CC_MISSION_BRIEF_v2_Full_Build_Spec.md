# CC MISSION BRIEF v2: Scan2Plan OS — Full Build Spec
**Date:** 2026-02-25
**From:** Chase (via Claude Chat)
**To:** CC (Claude Code)
**Status:** APPROVED — Build starts now
**Supersedes:** CC_MISSION_BRIEF_Post_Pricing_Decoupling.md (v1)

---

## The Architecture in One Sentence

We build the data capture pipeline (scoping → quoting → proposing → production → delivery). The CEO fills in the prices. We handle everything before and after.

---

## PART 1: SCOPING FORM

The scoping form is the entry point for every project. It produces the data that feeds pricing, production, field ops, QC, delivery, and reporting. Build it first because everything downstream depends on it.

### Source Spec
- `Scan2Plan_Scoping_Form_v2_1.xlsx` — Sheet "Scoping Form" (78 fields, 15 sections)
- `S2P_Automation_Maps_v1_3_LEAN__1_.xlsx` — Sheet "1_Registry_Cascade" (167 fields with downstream consumers)

### Form Sections We Build (Client + Internal)

**SECTION A — Project Identification (6 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-37 | Client / Company | Text | YES |
| SF-53 | Project Name | Text | YES |
| SF-54 | Project Code | Auto-generated | YES (system generates) |
| SF-01 | Project Address | Text + Google Maps autocomplete | YES |
| — | Specific Building or Unit | Text | NO |
| — | Email | Text | YES |

SF-54 (Project Code) format: `S2P-[SEQ]-[YEAR]`. This is the UPID. It's the join key for every downstream document. Generate it on form creation, not on Closed Won — this enables early binding (Drive folder, proposal, etc. before the deal closes).

**SECTION B — Contacts (7 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| — | Primary Contact Name | Text | YES |
| — | Contact Email | Text | YES |
| — | Contact Phone | Text | NO |
| — | Billing Contact | Toggle: Same as Primary / Different | YES |
| — | Billing Contact Name | Text | Conditional (if Different) |
| — | Billing Email | Text | Conditional (if Different) |
| — | Billing Phone | Text | NO |

**SECTION C — Building Characteristics (4 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-31 | Number of Floors | Number | YES |
| SF-06 | Basement / Attic | Multi-select: Basement / Attic / Neither | YES |
| — | Est. SF of Basement / Attic | Number | Conditional |
| SF-30 | Insurance Requirements | Text | NO |

**SECTION D — Scope Areas (REPEATABLE BLOCK — 13 fields per area)**

This is the core of the form. Users add one block per distinct area in the project (e.g., "Main Building", "Garage", "East Wing"). Each area has its own building type, sqft, LoD, disciplines, and scope.

| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-02 | Area Type | Dropdown (13 types) | YES |
| — | Area Name | Text | NO (defaults to type name) |
| SF-03 | Square Footage | Number | YES |
| SF-04 | Project Scope | Dropdown: Full / Int Only / Ext Only / Mixed | YES |
| SF-05 | Level of Detail (LoD) | Dropdown: 200 / 300 / 350 | YES |
| SF-35 | Mixed Scope — Interior LoD | Dropdown: 200 / 300 / 350 | Conditional (Scope = Mixed) |
| SF-36 | Mixed Scope — Exterior LoD | Dropdown: 200 / 300 / 350 | Conditional (Scope = Mixed) |
| SF-07 | Structural Modeling | Toggle Y/N + sqft | YES |
| SF-08 | MEPF Modeling | Toggle Y/N + sqft | YES |
| SF-10 | CAD Deliverable | Dropdown: No / Basic / A+S+Site / Full | YES |
| SF-24 | ACT (Above Ceiling) | Toggle Y/N + sqft | NO |
| SF-44 | Below Floor Scanning | Toggle Y/N + sqft | NO |
| — | Custom Line Items | Repeatable: Description + Amount | NO |

**The 13 building types (SF-02 dropdown):**
SFR (Single Family Res), MF Res, Luxury Res, Commercial, Retail, Kitchen, Schools, Hotel/Theatre, Hospital, Mechanical, Warehouse, Church, Infrastructure

**SECTION E — Landscape (3 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-22 | Landscape Modeling? | Dropdown: No / LoD 200 / LoD 300 / LoD 350 | NO |
| — | How many acres? | Number | Conditional (if Landscape ≠ No) |
| SF-43 | Landscape Terrain Type | Dropdown: Urban-Built / Natural / Forested | Conditional |

**SECTION F — Deliverable Format (4 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-11 | BIM Deliverable | Dropdown: Revit / ArchiCAD / SketchUp / Rhino / Other | YES |
| SF-28 | BIM Version | Text (e.g., "Revit 2024") | NO |
| SF-27 | Custom Template? | Toggle Y/N | NO |
| — | Upload Custom Template | File upload | Conditional |
| SF-09 | Georeferencing? | Toggle Y/N | YES |

**SECTION G — Site Conditions (3 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-41 | Era | Dropdown: Modern / Historic | YES |
| SF-42 | Room Density | Dropdown: 0-Wide Open / 1-Spacious / 2-Standard / 3-Dense / 4-Extreme | YES |
| SF-12 | Risk Factors | Multi-select: Occupied / No Power-HVAC / Hazardous / No Lighting / Fire-Flood / Non-Standard Height / Restricted Access | YES |

**SECTION H — Additional Services (2 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-40 | Scanning & Registration Only | Dropdown: None / Full Day ($2,500) / Half Day ($1,500) | NO |
| SF-13 | Expedited Service | Toggle Y/N (+20% of BIM + add-ons, not travel) | YES |

**SECTION I — Travel (4 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-32 | Dispatch Location | Dropdown: Troy NY / Woodstock NY / Brooklyn NY / Other | YES |
| SF-51 | One-Way Miles to Site | Number | YES |
| SF-50 | Travel Mode | Dropdown: Local / NYC Small / NYC Regional / Overnight / Flight | YES |
| SF-34 | Custom Travel Cost Override | Currency | NO (overrides calculated) |

**SECTION N — Documentation (5 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-14 | Upload SF Assumptions | File upload (screenshots) | YES |
| — | Assumptions on SqFt Estimate | Text | NO |
| — | Upload Scoping Documents | File upload (NDA, RFP, floor plans) | NO |
| — | Internal Notes | Text | NO |
| — | Custom Scope / Special Priorities | Text | NO |

**SECTION O — Attribution & Pipeline (7 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-18 | Lead Source | Dropdown (18 sources): ABM / Cold / Referral-Client / Referral-Partner / Existing / CEU / Proof Vault / etc. | YES |
| — | Source Note | Text | NO |
| SF-29 | Marketing Influence | Multi-select (same 18 options) | NO |
| — | Proof Links | Text | NO |
| SF-52 | Probability of Closing | Slider 0-100% | YES |
| SF-39 | Deal Stage | Dropdown: Lead / Qualified / Proposal / Negotiation / In Hand / Urgent / Lost | YES |
| SF-38 | Priority | Dropdown: 1-Critical / 2-High / 3-Medium / 4-Low / 5-Backlog | YES |

### Sections We Do NOT Build (CEO Pricing Inputs)

These sections exist in the form spec but are filled in by the CEO after we generate line item shells. They're either displayed read-only or editable only by CEO/Sales role:

**SECTION J — Internal Pricing Engine Inputs (6 fields, CEO only)**
| Field ID | Label | Notes |
|----------|-------|-------|
| SF-45 | Pricing Tier (AUTO/X7/SLAM) | CEO determines scanner path |
| SF-46 | BIM Manager (AUTO/YES/NO) | CEO determines management overhead |
| SF-47 | Scanner Assignment (Sr/Jr) | CEO picks tech rate |
| SF-48 | Est Scan Days | CEO estimates field time |
| SF-49 | # Techs Planned (1-4) | CEO plans crew |
| SF-33 | M Override | CEO can override computed multiplier |

**SECTION K — Whale Pricing (2 fields, CEO only, Tier-A projects ≥50K sqft)**
| Field ID | Label | Notes |
|----------|-------|-------|
| — | Whale Scan Cost Override | Direct cost entry |
| — | Whale Model Cost Override | Direct cost entry |

**SECTION L — Profitability (2 fields, CEO only)**
| Field ID | Label | Notes |
|----------|-------|-------|
| SF-55 | Assumed Savings / M | CEO's target margin for this deal |
| — | Caveats on Profitability | Free text reasoning |

**SECTION M — Timeline & Payment (5 fields)**
| Field ID | Label | Type | Required |
|----------|-------|------|----------|
| SF-16 | Est. Timeline | Dropdown: 1wk / 2wk / 3wk / 4wk / 5wk / 6wk / Other | YES |
| — | Project Timeline | Text (e.g., "Q1 2026, Urgent") | NO |
| — | Notes on Timeline | Text | NO |
| SF-17 | Payment Terms | Dropdown: Partner / Owner / Net30+5% / Net60+10% / Net90+15% / Other | YES |
| — | Payment Notes | Text | NO |

---

## PART 2: LINE ITEM SHELL GENERATOR

When the scoping form is complete, the system generates line item shells — one per area per discipline, plus travel and add-on lines. The CEO fills in `upteamCost` and `clientPrice`.

### Shell Generation Rules

For each area in the form:
1. **Architecture line** — always generated (every area gets Arch)
2. **Structure line** — if SF-07 = Yes
3. **MEPF line** — if SF-08 = Yes
4. **CAD line** — if SF-10 ≠ No
5. **ACT line** — if SF-24 = Yes
6. **Below Floor line** — if SF-44 = Yes

Project-level lines:
7. **Travel line** — always (from Section I data)
8. **Matterport line** — if Matterport selected in disciplines
9. **Georeferencing line** — if SF-09 = Yes ($1,500/structure)
10. **Expedited surcharge line** — if SF-13 = Yes (+20% of BIM items, not travel)
11. **Landscape line** — if SF-22 ≠ No
12. **Scan & Reg Only line** — if SF-40 ≠ None
13. **Custom line items** — pass through from Section D

### Line Item Shell Shape

```typescript
interface LineItemShell {
  id: string;                     // UUID
  areaId: string;                 // Links to area block (null for project-level items)
  areaName: string;               // "Main Building" or "Project-Level"
  category: "modeling" | "travel" | "addOn" | "custom";
  discipline?: string;            // "architecture" | "mepf" | "structure" | "site"
  description: string;            // "Architecture — Commercial — 25,000 SF — LoD 300 — Full Scope"
  buildingType: string;           // CEO's 13-type name
  squareFeet?: number;
  lod?: string;
  scope?: string;

  // CEO fills these:
  upteamCost: number | null;      // null = not yet priced
  clientPrice: number | null;     // null = not yet priced
}
```

### Post-Pricing Calculations (system computes after CEO fills in prices)

```typescript
interface QuoteTotals {
  totalClientPrice: number;
  totalUpteamCost: number;
  grossMargin: number;
  grossMarginPercent: number;
  integrityStatus: "passed" | "warning" | "blocked";
  integrityFlags: string[];
}
```

**Integrity rules:**
- grossMarginPercent < 40% → `blocked` (save disabled)
- grossMarginPercent 40-45% → `warning` (save enabled with warning)
- grossMarginPercent ≥ 45% → `passed`

---

## PART 3: PROPOSAL BUILDER + EMAIL

Once the quote passes integrity checks:
1. Save to `cpq_quotes` table (existing schema works)
2. Generate PDF proposal from quote data + client info
3. Email to client via existing proposal builder
4. Track status: sent / viewed / accepted / rejected
5. Magic link for client portal (existing `client_token` flow)

---

## PART 4: QUICKBOOKS SYNC

On quote save or deal stage change:
1. Create QBO Estimate from line items
2. Map line items to QBO line items (description, amount)
3. On Closed Won: convert Estimate to Invoice
4. Sync payment status back to CRM
5. Link expenses to projects via UPID (SF-54)

---

## PART 5: PRODUCTION PIPELINE

### Stage Transitions

When a deal hits Closed Won, the existing trigger fires (creates project, generates UPID if needed, creates Drive folder). The production pipeline then tracks the project through six stages:

```
Scoping → Field Capture → Registration → BIM QC → PC Delivery → Final Delivery
```

### Prefill Cascade (from Automation Maps Sheet 4)

Each stage auto-populates fields from upstream data. This is the literal implementation spec:

**Scoping → Field Capture (15 prefills)**
| Target (FC) | Source (SF) | Type |
|-------------|-------------|------|
| FC-01 Project Code | SF-54 | Direct |
| FC-02 Address | SF-01 | Direct |
| FC-06 Est. SF | SF-03 | Direct |
| FC-07 Scope | SF-04 | Transform: Dropdown → Checkbox |
| FC-08 Floors | SF-31 | Direct |
| FC-09 Est. Scans | Derived | Calc: Scans/KSF × SF/1000 |
| FC-18 Base Location | SF-32 | Direct |
| FC-22 Era | SF-41 | Direct |
| FC-23 Density | SF-42 | Direct |
| FC-24 Bldg Type | SF-02 | Direct |
| FC-31 Scan Days | SF-48 | Direct |
| FC-32 # Techs | SF-49 | Direct |
| FC-33 Pricing Tier | SF-45 | Direct |
| FC-35 ACT Present | SF-24 | Transform: Y/N+sqft → Y/N |
| FC-36 Below Floor | SF-44 | Transform: Y/N+sqft → Y/N |

**Field Capture → Registration (12 prefills)**
| Target (RG) | Source | Type |
|-------------|--------|------|
| RG-01 Project Code | FC-01 → SF-54 | Chain |
| RG-02 Project Name | SF-53 | Direct from SSOT |
| RG-03 SF | FC-06 → SF-03 | Chain |
| RG-05 Field Tech | FC-04 | Direct |
| RG-06 Field Date | FC-03 | Direct |
| RG-08 Cloud LoA | Default LoA-40 | Static default |
| RG-09 Model LoD | SF-05 | Direct |
| RG-10 Platform | SF-11 | Direct |
| RG-13 LoGeoRef Tier | SF-56 | Transform: Dropdown → Checkbox |
| RG-04 Scan Count | — | MANUAL (counted in studio) |
| RG-07 Software | — | MANUAL (operator choice) |
| — Field RMS | FC-13 | Carry for verification |

**Registration → BIM QC (7 prefills)**
| Target (BQ) | Source | Type |
|-------------|--------|------|
| BQ-01 Project Name | SF-53 chain | Chain |
| BQ-15 Project Code | SF-54 chain | Chain |
| BQ-03 Estimated SF | SF-03 chain | Chain |
| BQ-11 Georeferenced | RG-13 | Transform: Tier 20/60 → Y, Tier 0 → N |
| BQ-12 LoD | SF-05 chain | Chain |
| BQ-13 Revit Version | SF-28 | Direct (if populated) |
| BQ-14 Scope Discipline | SF-07 + SF-08 | Transform: Y/N → Checkbox |

**BIM QC → PC Delivery (8 prefills)**
| Target (PD) | Source | Type |
|-------------|--------|------|
| PD-01 Project Code | SF-54 chain | Chain |
| PD-02 Client | SF-37 chain | Chain |
| PD-03 Project Name | SF-53 chain | Chain |
| PD-04 SF | BQ-04 (actual, preferred) or SF-03 | Prefer actual |
| PD-09 Project Tier | SF-03 | Calc: <10K=Minnow, 10-50K=Dolphin, ≥50K=Whale |
| PD-10 LoGeoRef Tier | RG-13 | Direct |
| PD-12 Platform | RG-10 | Direct |
| PD-11 Security Tier | SF-60 | BLOCKED (form field not built yet) |

**PC Delivery → Final Delivery (7 prefills)**
| Target (DR) | Source | Type |
|-------------|--------|------|
| DR-01 Project Code | PD-01 chain | Chain |
| DR-02 Client | PD-02 chain | Chain |
| DR-03 Project Name | PD-03 chain | Chain |
| DR-04 SF | BQ-04 (actual) | Prefer actual |
| DR-09 Scope Tier | SF-03 | Same calc as PD-09 |
| DR-10 Disciplines | BQ-14 chain | Chain |
| DR-11 Formats | SF-10 + SF-11 | Transform: CAD+BIM → format list |

### Summary
- **49 total prefill mappings** across 5 stage transitions
- **30 direct pulls** (61%) — straightforward field copy
- **8 transforms** (16%) — type conversion needed (dropdown→checkbox, Y/N+sqft→Y/N)
- **4 calculations** (8%) — derived values (est. scans, project tier)
- **3 manual** (6%) — cannot be auto-populated
- **2 blocked** (4%) — waiting on upstream field to be built
- **1 static default** (2%) — Cloud LoA defaults to LoA-40

---

## PART 6: SCANTECH FIELD APPLICATION

Mobile-first form for field technicians. Pre-populated from Scoping via the 15 SF→FC prefills above.

### Fields the tech fills in on-site (FC-03 through FC-38)

**Header fields (prefilled + tech confirms):**
FC-03 Date, FC-04 Field Tech, FC-05 Scanner S/N, FC-06 Est SF (prefilled, tech confirms), FC-07 Scope (prefilled), FC-08 Floors (prefilled), FC-09 Est Scans (calculated), FC-10 Rooms

**Scan performance (tech enters):**
FC-11 Hours Scanned (total), FC-12 Hours Delayed, FC-25 Hrs Scanned Int, FC-26 Hrs Scanned Ext, FC-27 Hrs Scanned Landscape, FC-28 Scan Pts Int, FC-29 Scan Pts Ext, FC-30 Scan Pts Landscape, FC-31 Scan Days (actual), FC-32 # Techs On Site, FC-34 Actual Observed SF

**Field confirms scoping assumptions:**
FC-22 Era (prefilled, tech confirms), FC-23 Density (prefilled, tech confirms), FC-24 Bldg Type (prefilled, tech confirms), FC-33 Pricing Tier Used, FC-35 ACT Present, FC-36 Below Floor

**Quality gates:**
FC-13 Field RMS (≤5mm hard gate), FC-14 Average Overlap % (≥50% hard gate), FC-15 Field Sign-Off (Pass/Conditional/Rejected), FC-37 Site Conditions Confirmed (checklist of 7), FC-38 Scan Metrics Handoff (checklist of 5)

**Cost reporting:**
FC-16 Hours Traveled, FC-17 Miles Driven (one-way), FC-18 Base Location, FC-19 Hotel/Per Diem Cost, FC-20 Tolls/Parking, FC-21 Other Field Costs

---

## PART 7: GCS INTEGRATION

Continue existing pattern:
- Point cloud storage: `gs://s2p-core-vault/projects/[token]/`
- Token format from migration manifest: `[Address-Slug]_[YYYY-MM-DD]`
- Link GCS assets to project records via UPID
- Surface in production pipeline UI (link to point cloud files per project)

---

## PART 8: WHAT TO CLEAN UP

| Action | Target | Reason |
|--------|--------|--------|
| DELETE | `client/src/modules/sales_engine/` (~120 files) | Orphaned — confirmed not imported |
| REMOVE | External CPQ proxy logic in `server/routes/cpq.ts` | Replaced by manual pricing entry |
| REMOVE | Margin slider from DealWorkspace | Pricing is CEO-entered, not slider-derived |
| DEPRECATE | Pricing matrix API routes (return 410) | Pricing is external |
| KEEP | `pricing.ts` static tables | Reference data for form dropdowns (building type names, LoD descriptions) |
| KEEP | `cpq_quotes` table schema | Compatible — just add new fields as needed |

---

## BUILD PRIORITY ORDER

| # | What | Depends On | CEO's Leverage |
|---|------|-----------|---------------|
| 1 | Scoping Form (Sections A-I, N, O) | Nothing | 850 proposals/year flow through this |
| 2 | Line Item Shell Generator | Scoping Form | Enables CEO to start pricing immediately |
| 3 | CEO Pricing Entry UI (Sections J, K, L + line item costs) | Shell Generator | Decoupling boundary |
| 4 | Quote Save + Integrity Enforcement | Pricing Entry | 40%/45% guardrails |
| 5 | Proposal Builder + Email | Quote Save | Client-facing output |
| 6 | QuickBooks Estimate Sync | Quote Save | Financial integration |
| 7 | Production Pipeline with Prefill Cascade | Scoping Form | 49 auto-populated fields across 5 stages |
| 8 | Scantech Field App | Pipeline | 38 fields, mobile-first |
| 9 | GCS Integration | Pipeline | Asset linking |
| 10 | Reporting / Scorecard | All of the above | Dashboard from Sheet 3 spec |

---

## SUCCESS CRITERIA

1. A user fills out the scoping form (Sections A-I, N, O) and saves a complete deal record
2. The system generates line item shells from the scoping data
3. The CEO fills in upteamCost and clientPrice per line item (Sections J, K, L)
4. The system computes totals and enforces margin guardrails (40%/45%)
5. A passing quote saves to DB, generates a proposal PDF, and emails the client
6. On Closed Won: project created, UPID generated, Drive folder created, production pipeline initialized
7. Field Capture checklist auto-populates 15 fields from Scoping
8. Each subsequent stage auto-populates from upstream per the prefill cascade
9. QuickBooks receives the estimate with correct line items
10. **Zero pricing formulas in our codebase** — we capture, display, persist, and enforce guardrails. We do not calculate prices.

---

## KEY FILES REFERENCE

All files are local on the Mac at `/Users/chasethis/S2P-studio/`

**CEO's Spec Documents (read before building):**
- `/Users/chasethis/S2P-studio/Scan2Plan_Scoping_Form_v2_1.xlsx` — Form spec (primary reference for Part 1)
- `/Users/chasethis/S2P-studio/S2P_Automation_Maps_v1_3_LEAN__1_.xlsx` — Field registry + prefill cascades (primary reference for Parts 5-6)
- `/Users/chasethis/S2P-studio/S2P_CEO_Exit_Readiness_Deep_Audit_v1.md` — Business context (reference only)
- `/Users/chasethis/S2P-studio/S2P_Workload_Architecture_Occams_Razor.md` — Business context (reference only)

**Existing Codebase:**
- `shared/schema.ts` — Database schema (extend, don't replace)
- `server/routes/cpq.ts` — CPQ endpoints (simplify)
- `client/src/features/cpq/Calculator.tsx` — Refactor to scoping form
- `client/src/pages/DealWorkspace.tsx` — Add pricing entry UI
- `client/src/features/cpq/pricing.ts` — Keep as reference data only

**Architecture Docs:**
- `__CPQ_Integration_Guide.md` — Current system docs
- `__SYSTEM_ARCHITECTURE_EXPORT.md` — Full audit
- `CPQ_PRICING_ENGINE_ADR.md` — Decoupling decision record

---

*The CEO owns the math. We own the machine. 167 fields, 49 prefills, 6 stages, zero pricing formulas.*
