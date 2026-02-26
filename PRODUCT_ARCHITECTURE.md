# S2PX — Scan2Plan OS X | Product Architecture Document

**Version:** X.1 · **Updated:** 2026-02-26 · **Phase:** 12 complete (13 phases shipped)

---

## 1. Product Overview

S2PX is a full-stack enterprise SaaS platform for the 3D scanning and BIM (Building Information Modeling) industry. It manages the entire lifecycle of a scanning project — from initial lead capture and scoping, through pricing and proposals, to production tracking, field capture, asset management, and financial reporting.

**Business context:** A construction scanning company receives a client request (e.g., "scan a 50,000 SF hospital"), scopes the work through a detailed 78-field form, generates line-item pricing, sends a PDF proposal, tracks production through 6 stages with prefilled data cascading forward, manages GCS-stored scan data, and reports profitability.

**Brand:** "Scan2Plan OS X" (short: S2PX). The "X" signals a generational leap, inspired by the macOS X rebrand.

---

## 2. Architecture Overview

### Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 19, Vite 6, TypeScript, Tailwind CSS 4 | SPA at `client/src/` |
| **Backend** | Express.js, TypeScript, tsx (direct TS execution) | Server at `server/` |
| **Database** | PostgreSQL (Neon serverless) | Drizzle ORM |
| **Auth** | Firebase Auth (Google OAuth) | Admin SDK server-side, Client SDK client-side |
| **Storage** | Google Cloud Storage (4 buckets) | Firebase SDK browsing, GCS SDK uploading |
| **PDF** | PDFKit | Server-side proposal generation |
| **Email** | Nodemailer | Proposal delivery |
| **AI** | Google Gemini (gemini-2.5-flash) | KB chat, AI editing |
| **Maps** | Google Maps Platform | Address geocoding, footprint lookup |
| **Accounting** | QuickBooks Online (OAuth2) | Estimate/Invoice sync |
| **Hosting** | Firebase Hosting (frontend) + Cloud Run (backend) | Single GCP project: `s2px-production` |

### Monorepo Structure

```
S2P-Studio/
├── client/src/           # React frontend
│   ├── components/       # 50+ components (kb/, pricing/, scoping/, production/, archive/, field/, notebook/)
│   ├── pages/            # 21 page components
│   ├── hooks/            # Custom hooks (useAuth, useQuoteSession, useDealWorkspace, useScopingForm)
│   ├── services/         # API client, Firebase, Gemini
│   ├── lib/              # Utility functions (cn, formatDate, getStatusColor)
│   └── engine/           # Legacy client-side pricing (deprecated)
├── server/               # Express backend
│   ├── routes/           # 16 route modules
│   ├── middleware/        # Firebase auth middleware
│   ├── scripts/          # DB seed scripts (seed-kb.ts, migrate-phase12.ts)
│   ├── db.ts             # Drizzle database connection
│   ├── index.ts          # Express app setup + startup
│   └── routes.ts         # Route registry (mounts all 16 modules)
├── shared/               # Code shared between client & server
│   ├── schema/           # Drizzle table definitions + constants
│   ├── engine/           # Prefill cascade (49 mappings) + shell generator (13 rules)
│   └── types/            # LineItem, Production, Scorecard type definitions
├── knowledge-base/       # KB markdown source files (4 parts)
│   └── docs/             # part-1-foundation.md through part-4-brand.md
├── migrations/           # Drizzle-generated SQL migrations
├── firebase.json         # Hosting config (SPA + API rewrite to Cloud Run)
├── Dockerfile            # Multi-stage Node 20 Alpine (server only)
├── vite.config.ts        # Vite config (React, Tailwind, proxy, path aliases)
├── drizzle.config.ts     # Drizzle PostgreSQL config
├── tsconfig.json         # Root TS config with path aliases
└── tsconfig.server.json  # Server-specific TS config
```

### Path Aliases

| Alias | Maps To | Used In |
|-------|---------|---------|
| `@/` | `client/src/` | Frontend imports |
| `@shared/` | `shared/` | Both client and server |

---

## 3. Database Schema

### 12 Tables (PostgreSQL via Drizzle ORM)

#### 3.1 `users` — Authentication & Identity
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | Internal ID |
| `firebase_uid` | text UNIQUE | Firebase Auth UID |
| `email` | text | User email |
| `first_name` | text | |
| `last_name` | text | |
| `profile_image_url` | text | Google profile photo |
| `role` | text | `user` \| `admin` \| `ceo` (default: `user`) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Upserted on every authenticated API request.

#### 3.2 `scoping_forms` — 78-Column Master Scoping Record (SSOT)
The Single Source of Truth for every deal. Every project begins here.

| Section | Fields | Description |
|---------|--------|-------------|
| **A** Project Info | `upid` (unique, "S2P-{seq}-{year}"), `status`, `client_company`, `project_name`, `project_address`, `project_lat`, `project_lng`, `building_footprint_sqft`, `specific_building`, `email` | Core project identity |
| **B** Contacts | `primary_contact_name`, `contact_email`, `contact_phone`, `billing_same_as_primary`, `billing_contact_name`, `billing_email`, `billing_phone` | Primary + billing contacts |
| **C** Building | `number_of_floors`, `basement_attic` (JSON array), `est_sf_basement_attic`, `insurance_requirements` | Physical building data |
| **D** Areas | → separate `scope_areas` table (1:N) | Per-area scope details |
| **E** Landscape | `landscape_modeling`, `landscape_acres`, `landscape_terrain` | Exterior landscape scope |
| **F** BIM | `bim_deliverable`, `bim_version`, `custom_template`, `template_file_url`, `georeferencing` | Deliverable specifications |
| **G** Complexity | `era`, `room_density`, `risk_factors` (JSON array) | Difficulty/complexity factors |
| **H** Service | `scan_reg_only`, `expedited` | Service level toggles |
| **I** Travel | `dispatch_location`, `one_way_miles`, `travel_mode`, `custom_travel_cost` | Dispatch logistics |
| **J-L** CEO | `pricing_tier`, `bim_manager`, `scanner_assignment`, `est_scan_days`, `techs_planned`, `m_override`, `whale_scan_cost`, `whale_model_cost`, `assumed_savings_m`, `caveats_profitability` | CEO-only pricing fields |
| **M** Timeline | `est_timeline`, `project_timeline`, `timeline_notes`, `payment_terms`, `payment_notes` | Schedule + payment |
| **N** Docs | `sf_assumptions_url`, `sqft_assumptions_note`, `scoping_docs_urls` (JSON), `internal_notes`, `custom_scope` | Supporting documentation |
| **O** Attribution | `lead_source`, `source_note`, `marketing_influence` (JSON), `proof_links`, `probability`, `deal_stage`, `priority` | Lead tracking |
| **Timestamps** | `created_at`, `updated_at` | |

**Status lifecycle:** `draft` → `complete` → `priced` → `quoted` → `won` \| `lost` \| `deleted`

#### 3.3 `scope_areas` — Repeatable Building Area Blocks
Each scoping form can have N scope areas (Section D). This is where per-area pricing originates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `scoping_form_id` | int FK → scoping_forms | Parent form |
| `area_type` | text | One of 13 building types (SFR, MF Res, Luxury Res, Commercial, Retail, Kitchen, Schools, Hotel/Theatre, Hospital, Mechanical, Warehouse, Church, Infrastructure) |
| `area_name` | text | Optional custom name |
| `square_footage` | int | Total SF for this area |
| `project_scope` | text | `Full` \| `Int Only` \| `Ext Only` \| `Mixed` |
| `lod` | text | `200` \| `300` \| `350` |
| `mixed_interior_lod` | text | Only when scope = Mixed |
| `mixed_exterior_lod` | text | Only when scope = Mixed |
| `structural` | jsonb | `{ enabled: boolean, sqft?: number }` |
| `mepf` | jsonb | `{ enabled: boolean, sqft?: number }` |
| `cad_deliverable` | text | `Revit` \| `AutoCAD` \| `SketchUp` \| `No` |
| `act` | jsonb | `{ enabled: boolean, sqft?: number }` (Acoustical Ceiling Tile) |
| `below_floor` | jsonb | `{ enabled: boolean, sqft?: number }` |
| `custom_line_items` | jsonb | `[{ description, amount }]` |
| `sort_order` | int | Display ordering |

#### 3.4 `quotes` — Priced Line Items
CEO-generated pricing for a scoping form. The shell generator produces unpriceable line items; the CEO fills in costs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `scoping_form_id` | int FK | |
| `line_items` | jsonb | `LineItemShell[]` — see Section 7 |
| `totals` | jsonb | `QuoteTotals` — revenue, cost, margin, integrity |
| `integrity_status` | text | `passed` \| `warning` \| `blocked` |
| `version` | int | Incremented on save |
| `qbo_estimate_id` | text | QuickBooks Estimate ID |
| `qbo_estimate_number` | text | QuickBooks Estimate # |
| `qbo_customer_id` | text | QuickBooks Customer ID |
| `qbo_invoice_id` | text | QuickBooks Invoice ID (after conversion) |
| `qbo_synced_at` | timestamp | Last QBO sync |
| `created_at`, `updated_at` | timestamp | |

#### 3.5 `proposals` — Generated PDF Proposals
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `scoping_form_id`, `quote_id` | int FK | |
| `status` | text | `draft` \| `sent` \| `viewed` \| `accepted` \| `rejected` |
| `pdf_url` | text | GCS URL or inline base64 |
| `access_token` | text | Magic link token for client portal |
| `custom_message` | text | Optional cover note |
| `sent_to` | text | Recipient email |
| `sent_at`, `viewed_at`, `responded_at` | timestamp | Engagement tracking |
| `version` | int | |
| `created_at`, `updated_at` | timestamp | |

#### 3.6 `qbo_tokens` — QuickBooks OAuth2 Credentials
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `realm_id` | text | QBO company ID |
| `access_token` | text | Short-lived token |
| `refresh_token` | text | Long-lived refresh |
| `expires_at`, `refresh_expires_at` | timestamp | |
| `created_at`, `updated_at` | timestamp | |

#### 3.7 `production_projects` — Stage-Tracked Production Work
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `scoping_form_id` | int FK | |
| `upid` | text | Copied from scoping form |
| `current_stage` | text | `scheduling` → `field_capture` → `registration` → `bim_qc` → `pc_delivery` → `final_delivery` |
| `stage_data` | jsonb | Per-stage field values (accumulated across all stages) |
| `created_at`, `updated_at` | timestamp | |

Stage data is a nested JSON object keyed by stage name, e.g.:
```json
{
  "scheduling": { "fieldDate": "2026-03-01", "assignedTech": "John" },
  "field_capture": { "scanCount": 142, "rmsScore": 0.003, ... }
}
```

#### 3.8 `project_assets` — GCS-Linked Resources
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `production_project_id` | int FK | |
| `bucket` | text | One of 4 GCS buckets |
| `gcs_path` | text | Folder or file path |
| `label` | text | Human-readable name |
| `asset_type` | text | `folder` \| `file` |
| `file_count` | int | Cached metadata (refreshable) |
| `total_size_bytes` | text | Cached total size |
| `linked_at` | timestamp | |
| `linked_by` | text | User who linked |

#### 3.9 `kb_sections` — Knowledge Base Content
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `slug` | text UNIQUE | URL-safe identifier |
| `title` | text | Section title |
| `emoji` | text | Display emoji |
| `part_number` | int | Part grouping (1-4) |
| `part_title` | text | Part display name |
| `section_number` | int | Section within part |
| `sort_order` | int | Global display order |
| `content` | text | Markdown content |
| `content_plain` | text | Stripped plain text (for search) |
| `word_count` | int | Auto-calculated |
| `version` | int | Optimistic locking counter |
| `edited_by` | text | Last editor |
| `created_at`, `updated_at` | timestamp | |

**Current content (v4.1):** 4 parts, 4 sections, 935 words total.

#### 3.10 `kb_edit_history` — KB Revision Log
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `section_id` | int FK → kb_sections (CASCADE) | |
| `previous_content` | text | Content before edit |
| `new_content` | text | Content after edit |
| `edited_by` | text | Editor identifier |
| `edit_summary` | text | Change description |
| `version` | int | Version that produced this entry |
| `created_at` | timestamp | |

#### 3.11 `upload_shares` — Token-Based External Upload Links
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `production_project_id` | int FK (CASCADE) | |
| `token` | text UNIQUE | `crypto.randomBytes(24).toString('base64url')` |
| `label` | text | Optional description |
| `target_bucket` | text | GCS destination bucket |
| `target_prefix` | text | GCS path prefix (`{upid}/`) |
| `created_by` | int FK → users | |
| `expires_at` | timestamp | Link expiration |
| `max_upload_bytes` | text | Optional size limit |
| `total_uploaded_bytes` | text | Running total (default: `'0'`) |
| `upload_count` | int | File counter (default: 0) |
| `is_active` | boolean | Revocable (default: true) |
| `created_at`, `updated_at` | timestamp | |

#### 3.12 `upload_share_files` — Upload Audit Log
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `share_id` | int FK → upload_shares (CASCADE) | |
| `filename` | text | Original filename |
| `gcs_path` | text | Full GCS path |
| `size_bytes` | text | File size |
| `content_type` | text | MIME type |
| `uploaded_by_name` | text | Optional uploader name |
| `uploaded_at` | timestamp | |

### GCS Bucket Architecture

| Bucket | Purpose | Access |
|--------|---------|--------|
| `s2p-core-vault` | Finalized deliverables | Internal only |
| `s2p-active-projects` | Current production data | Internal only |
| `s2p-incoming-staging` | External uploads (upload portal) | Public via signed URLs |
| `s2p-quarantine` | Flagged/quarantined files | Internal only |

---

## 4. API Routes

### Authentication
All `/api/*` routes pass through `requireAuth` middleware except:
- `/api/health` (skipped inside middleware)
- `/api/public/upload/*` (mounted before middleware)
- `/api/client-portal/*` (proposal magic link, within proposals route)

**Auth flow:** Client sends Firebase ID token as `Authorization: Bearer {token}` → middleware decodes via `adminAuth.verifyIdToken()` → upserts user record → attaches `req.user` with full DB user object.

### Route Map

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | DB connectivity check |

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/user` | Current user profile |

#### Scoping Forms
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scoping` | Create form + areas (auto-generates UPID) |
| GET | `/api/scoping` | List forms (?status, ?dealStage filters) |
| GET | `/api/scoping/:id` | Get form + areas |
| PATCH | `/api/scoping/:id` | Update form fields (autosave) |
| DELETE | `/api/scoping/:id` | Soft delete (status='deleted') |
| POST | `/api/scoping/:id/areas` | Add scope area |
| PATCH | `/api/scoping/:id/areas/:areaId` | Update area |
| DELETE | `/api/scoping/:id/areas/:areaId` | Delete area |

#### Leads (View Layer on Scoping Forms)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leads` | List non-deleted leads (joins + aggregates) |
| GET | `/api/leads/:id` | Single lead |
| POST | `/api/leads` | Create minimal scoping form from lead |
| PATCH | `/api/leads/:id` | Update lead → scoping form |

#### Quotes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/quotes` | Save quote (blocks if integrity='blocked') |
| GET | `/api/quotes/:id` | Fetch quote |
| GET | `/api/quotes/by-form/:formId` | Quotes for a scoping form |
| PATCH | `/api/quotes/:id` | Update line items/totals |

#### Proposals
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/proposals/:quoteId/generate` | Generate PDF + access token |
| POST | `/api/proposals/:id/send` | Email to client |
| GET | `/api/proposals/:quoteId/status` | Proposal versions |
| GET | `/api/client-portal/:token` | **Public** — magic link view (marks as viewed) |

#### QuickBooks Online
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/qbo/status` | Connection status |
| GET | `/api/qbo/auth` | Start OAuth2 flow |
| GET | `/api/qbo/callback` | OAuth2 callback |
| POST | `/api/qbo/disconnect` | Revoke tokens |
| POST | `/api/qbo/estimate/:quoteId` | Create QBO Estimate |
| GET | `/api/qbo/estimate/:quoteId` | Get estimate info + URL |
| POST | `/api/qbo/email-estimate/:quoteId` | Email estimate |
| POST | `/api/qbo/invoice/:quoteId` | Convert Estimate → Invoice (sets form status='won') |

#### Production Pipeline
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/production` | Create project (starts at 'scheduling') |
| GET | `/api/production` | List projects (?stage filter, includes asset count) |
| GET | `/api/production/summary/stages` | Stage distribution counts |
| GET | `/api/production/:id` | Single project detail |
| PATCH | `/api/production/:id` | Update stage data (deep merge into current stage) |
| POST | `/api/production/:id/advance` | Advance stage + run prefill cascade |
| GET | `/api/production/:id/preview-advance` | Preview prefill results before advancing |

#### Project Assets
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/production/:projectId/assets` | Link GCS path (auto-scans metadata) |
| GET | `/api/production/:projectId/assets` | List linked assets |
| POST | `/api/production/:projectId/assets/:id/refresh` | Re-scan GCS metadata |
| GET | `/api/production/:projectId/assets/:id/browse` | Browse folder contents (?path) |
| GET | `/api/production/:projectId/assets/:id/download` | Signed download URL (?path) |
| DELETE | `/api/production/:projectId/assets/:id` | Unlink asset |

#### Upload Shares
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-shares` | Create share link (auth) |
| GET | `/api/upload-shares` | List shares (?projectId, auth) |
| DELETE | `/api/upload-shares/:id` | Revoke share (auth) |
| GET | `/api/upload-shares/:id/files` | List uploaded files (auth) |
| GET | `/api/public/upload/:token` | **Public** — share info |
| POST | `/api/public/upload/:token/signed-url` | **Public** — get GCS signed upload URL |
| POST | `/api/public/upload/:token/confirm` | **Public** — confirm completed upload |

#### Projects Browse (Archive)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List production projects with scoping form data |
| GET | `/api/projects/:id` | Full project detail (~50 scoping form fields + assets + stage data) |
| GET | `/api/projects/gcs/folders` | List GCS project folders |
| GET | `/api/projects/gcs/browse` | Browse GCS folder contents |
| GET | `/api/projects/gcs/download` | Signed GCS download URL |
| GET | `/api/projects/gcs/analytics` | Storage analytics (size, count by type) |

#### Knowledge Base
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kb/sections` | List sections (metadata only, no content) |
| GET | `/api/kb/sections/:slug` | Full section with content |
| GET | `/api/kb/search` | Full-text search (?q, PostgreSQL ts_headline) |
| PUT | `/api/kb/sections/:slug` | Update content (optimistic locking on version) |
| GET | `/api/kb/sections/:slug/history` | Edit history |
| POST | `/api/kb/sections/:slug/ai-edit` | AI-assisted edit (Gemini) |
| POST | `/api/kb/chat` | AI chat with KB context (Gemini) |

#### Scorecard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scorecard/overview` | Executive KPIs (16 metrics, monthly trends) |
| GET | `/api/scorecard/pipeline` | Pipeline funnel, win rates by source |
| GET | `/api/scorecard/production` | Stage distribution, quality gates |
| GET | `/api/scorecard/profitability` | Margins, cost per SF, travel breakdown |

All scorecard endpoints accept: `?months`, `?tier`, `?buildingType`, `?leadSource` filters.

#### Geo
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/geo/lookup` | Address → lat/lng + footprint (Google Maps) |
| POST | `/api/geo/batch` | Batch geocode scoping forms |

#### Uploads
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/uploads` | File upload (50MB max, multer → GCS) |

---

## 5. Shared Engine

### 5.1 Shell Generator (`shared/engine/shellGenerator.ts`)

Generates unpriceable line item shells from scoping form data. The CEO then fills in `upteamCost` and `clientPrice` for each.

**13 generation rules in 2 categories:**

**Per-Area Rules (iterate over each scope area):**
1. **Architecture** — Always generated. Description includes scope, LOD, building type.
2. **Structure** — If `structural.enabled`. Uses structural sqft override or area SF.
3. **MEPF** — If `mepf.enabled`. Mechanical/electrical/plumbing/fire protection.
4. **CAD Deliverable** — If `cadDeliverable !== 'No'`. Revit/AutoCAD/SketchUp output.
5. **ACT** — If `act.enabled`. Acoustical ceiling tile modeling.
6. **Below Floor** — If `belowFloor.enabled`. Sub-floor utilities.

**Project-Level Rules (once per project):**
7. **Landscape** — If `landscapeModeling` is enabled. Includes acres and terrain.
8. **Georeferencing** — If georeferencing flag is true.
9. **Scan + Registration** — If `scanRegOnly` option selected.
10. **Expedited** — If expedited flag is true.
11. **Travel** — Calculated from dispatch location, miles, mode.
12. **Expedited Travel** — Premium surcharge when both expedited and travel apply.
13. **Custom Line Items** — User-added items from scope area `customLineItems[]`.

**Output:** `LineItemShell[]` — each item has: `id`, `areaId`, `areaName`, `category`, `discipline`, `description`, `buildingType`, `squareFeet`, `lod`, `scope`, `upteamCost: null`, `clientPrice: null`.

### 5.2 Prefill Cascade (`shared/engine/prefillCascade.ts`)

**49 declarative mappings** that auto-populate stage fields when a production project advances.

| Transition | # Mappings | Key Fields |
|------------|-----------|------------|
| Scheduling → Field Capture | 15 | Project metadata, scope, dispatch, building type, SF, floors, timeline |
| Field Capture → Registration | 12 | Chained fields + scan count, RMS, overlap, software |
| Registration → BIM QC | 7 | Chained + discipline array transform |
| BIM QC → PC Delivery | 8 | Chained + project tier calculation (Minnow/Dolphin/Whale) |
| PC Delivery → Final Delivery | 7 | Chained + delivery format transform |

**Mapping types:**
- `direct` — Copy from scoping form (SSOT) into target stage field
- `chain` — Copy from the previous stage's data (accumulated context)
- `transform` — Apply a function (e.g., `scopeToCheckboxArray`, `georefToTier`, `cadBimToFormats`)
- `calculation` — Derive from multiple inputs (e.g., `calcEstScans`, `calcProjectTier`)
- `static` — Hardcoded value (e.g., registration LoA = 40)
- `manual` — Left empty for on-site user entry
- `blocked` — Placeholder for future implementation

### 5.3 Constants (`shared/schema/constants.ts`)

Central registry of all enumerated values used across the application:

| Category | Count | Values |
|----------|-------|--------|
| Building Types | 13 | SFR, MF Res, Luxury Res, Commercial, Retail, Kitchen, Schools, Hotel/Theatre, Hospital, Mechanical, Warehouse, Church, Infrastructure |
| Lead Sources | 18 | Referral (Client), Referral (Partner), Website, LinkedIn, etc. |
| Deal Stages | 7 | discovery, qualification, scoping, proposal_sent, negotiation, won, lost |
| Production Stages | 6 | scheduling, field_capture, registration, bim_qc, pc_delivery, final_delivery |
| LOD Levels | 5 | 100, 200, 300, 350, 400 |
| Risk Factors | 7 | High Security, Hazardous, Occupied, Historical, Multi-Site, Complex MEP, Weather-Dependent |
| Pricing Tiers | 3 | Minnow (<10k SF), Dolphin (10k-50k SF), Whale (>50k SF) |
| Integrity Statuses | 3 | passed, warning, blocked |

---

## 6. Shared Types

### 6.1 LineItemShell & QuoteTotals (`shared/types/lineItem.ts`)

```typescript
interface LineItemShell {
    id: string;                           // UUID
    areaId: string | null;                // links to scope_areas.id (null for project-level)
    areaName: string;                     // display name
    category: 'modeling' | 'travel' | 'addOn' | 'custom';
    discipline?: string;                  // Architecture, Structure, MEPF, etc.
    description: string;                  // Full description for proposal
    buildingType: string;                 // From scope area
    squareFeet?: number;                  // Area SF
    lod?: string;                         // LOD level
    scope?: string;                       // Full, Int Only, Ext Only, Mixed
    upteamCost: number | null;            // CEO fills: internal cost
    clientPrice: number | null;           // CEO fills: client price
}

interface QuoteTotals {
    totalClientPrice: number;
    totalUpteamCost: number;
    grossMargin: number;                  // totalClientPrice - totalUpteamCost
    grossMarginPercent: number;           // (grossMargin / totalClientPrice) * 100
    integrityStatus: 'passed' | 'warning' | 'blocked';
    integrityFlags: string[];             // Reasons for non-passed status
}
```

### 6.2 Production Stage Data (`shared/types/production.ts`)

Each of the 6 stages has a typed data interface. Key examples:

**FieldCaptureData (28 fields):** projectCode, address, estSF, fieldDate, assignedTech, fieldTeamSize, scannerModel, scanCount, scanPositions, rmsScore, overlapPercent, rooms, totalScanMinutes, etc.

**BimQcData (20 fields):** assignedModeler, disciplines[], lodTarget, qcStatus, qcPassRate, deviationReport, etc.

**FinalDeliveryData (15 fields):** deliveryFormats[], clientApproval, invoiceSent, projectCloseDate, lessonsLearned, etc.

### 6.3 Scorecard (`shared/types/scorecard.ts`)

```typescript
interface ScorecardOverview {
    totalDeals: number; wonCount: number; lostCount: number;
    winRate: number; avgCycleDays: number; avgDealSize: number;
    totalRevenue: number; totalCost: number; grossMarginPercent: number;
    activeProductionCount: number; completedCount: number;
    rmsPassRate: number; overlapPassRate: number; qcPassRate: number;
    monthlyTrend: { month: string; revenue: number; cost: number; deals: number; winRate: number }[];
}

interface PipelineReport {
    funnel: { stage: string; count: number; value: number }[];
    monthlyTrend: { month: string; new: number; won: number; lost: number }[];
    winRateBySource: { source: string; winRate: number; count: number }[];
    avgDealByTier: { tier: string; avgDeal: number; count: number }[];
}

interface ProductionReport {
    stageDistribution: { stage: string; count: number }[];
    qualityGates: { rmsPass: number; overlapPass: number; qcPass: number; total: number };
    estimateVsActualSF: { projectId: number; estimated: number; actual: number }[];
}

interface ProfitabilityReport {
    marginDistribution: { range: string; count: number }[];
    avgMarginByTier: { tier: string; avgMargin: number; count: number }[];
    costPerSF: { buildingType: string; avgCostPerSF: number }[];
    travelCostBreakdown: { mode: string; avgCost: number; count: number }[];
    monthlyMarginTrend: { month: string; avgMargin: number; revenue: number; cost: number }[];
}
```

---

## 7. Frontend Architecture

### 7.1 Page Map (21 Pages)

| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/login` | Login | No | Firebase Google OAuth |
| `/upload/:token` | UploadPortal | No | Public upload portal (token-validated) |
| `/field/:projectId` | FieldCapture | Yes | Mobile-first field data entry |
| `/dashboard` | Dashboard | Yes | Home (inside DashboardLayout) |
| `/dashboard/pipeline` | Pipeline | Yes | Sales Kanban |
| `/dashboard/projects` | Projects (Archive) | Yes | Unified project archive |
| `/dashboard/revenue` | Revenue | Yes | Financial dashboard |
| `/dashboard/scorecard` | Scorecard | Yes | KPI dashboard (4 tabs) |
| `/dashboard/knowledge` | KnowledgeBase | Yes | KB browse, search, AI chat |
| `/dashboard/settings` | Settings | Yes | User + QBO + about |
| `/dashboard/storage` | StorageBrowser | Yes | GCS bucket browser |
| `/dashboard/scoping` | ScopingList | Yes | Scoping form list |
| `/dashboard/scoping/new` | ScopingForm | Yes | New scoping form |
| `/dashboard/scoping/:id` | ScopingForm | Yes | Edit scoping form |
| `/dashboard/deals/:id` | DealWorkspace | Yes | Scoping + quote + proposal |
| `/dashboard/proposals/:id` | ProposalBuilder | Yes | PDF proposal generation |
| `/dashboard/production` | ProductionPipeline | Yes | Production Kanban |
| `/dashboard/production/:id` | ProductionDetail | Yes | Single project detail |

### 7.2 Component Architecture

**Layout:** `DashboardLayout.tsx` wraps all `/dashboard/*` routes with a collapsible sidebar and top header. Sidebar contains nav links with icons. Header shows "SCAN2PLAN OS X" in monospace.

**State Management:** No global store (Redux/Zustand). Each page manages its own state via `useState` + `useEffect` + API calls. Shared logic lives in custom hooks:
- `useAuth()` — Firebase auth state
- `useQuoteSession()` — Quote editing state
- `useDealWorkspace()` — Combined deal state
- `useScopingForm()` — Form field management

**Styling:** Tailwind CSS 4 with custom design tokens:
- `s2p-fg` — Foreground text
- `s2p-muted` — Muted text
- `s2p-border` — Border color
- `s2p-primary` — Blue accent
- `s2p-surface` — Card backgrounds

**Icons:** Lucide React (tree-shakeable, 500+ icons).

**Charts:** Recharts (AreaChart, BarChart, PieChart) for Scorecard and Revenue.

**Animation:** Framer Motion for transitions, sidebar collapse, card hover states.

---

## 8. Authentication & Security

### 8.1 Auth Flow

```
Client                              Server
  │                                    │
  ├─ Firebase signInWithPopup(Google) ─┤
  │   └─ Returns ID token              │
  │                                    │
  ├─ Every API call:                   │
  │   Authorization: Bearer {idToken}  │
  │                            ──────►│
  │                                    ├─ adminAuth.verifyIdToken(token)
  │                                    ├─ Upsert user in DB
  │                                    ├─ Attach req.user
  │                                    └─ Continue to route handler
```

### 8.2 Public Routes

Two mechanisms for unauthenticated access:

1. **Upload Portal** (`/api/public/upload/:token`) — Mounted before `requireAuth` middleware in `server/index.ts`. Token validated internally against `upload_shares` table.

2. **Client Portal** (`/api/client-portal/:token`) — Inside proposals routes. Proposal `accessToken` validated internally.

### 8.3 CORS

```
Allowed Origins:
  - https://s2px.web.app          (primary)
  - https://s2px-production.web.app (Firebase default)
  - https://scan2plan.io          (custom domain)
  - http://localhost:5173          (local dev)
Credentials: false (stateless Bearer auth, no cookies)
```

---

## 9. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `FIREBASE_PROJECT_ID` | No | `s2px-production` | Firebase project ID |
| `GCS_BUCKET` | No | `s2p-core-vault` | Primary GCS bucket |
| `GCS_PROJECT_BUCKET` | No | `s2p-active-projects` | Project storage bucket |
| `GCS_STAGING_BUCKET` | No | `s2p-incoming-staging` | Upload staging bucket |
| `GEMINI_API_KEY` | Yes | — | Google AI API key |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | — | Google Maps API key |
| `SERVER_PORT` / `PORT` | No | `5001` / `8080` (Cloud Run) | API server port |
| `APP_URL` | No | `http://localhost:5173` | Client app URL |
| `NODE_ENV` | No | `development` | Environment mode |

---

## 10. Build & Deployment

### 10.1 Local Development

```bash
npm run dev              # Concurrently: client (5173) + server (5001)
npm run dev:client       # Vite dev server only
npm run dev:server       # Server with tsx watch
npm run build            # tsc -b && vite build
npm run test             # vitest run (117 tests)
```

Vite proxies `/api` → `http://localhost:5001` in dev mode.

### 10.2 Production Deploy

**Frontend:** Firebase Hosting
```bash
npx vite build           # → dist/
firebase deploy --only hosting
```
Hosting URL: https://s2px.web.app
Rewrites `/api/**` → Cloud Run service `s2px-api` (us-central1).

**Backend:** Cloud Run
```bash
gcloud run deploy s2px-api --source . --region us-central1
```
Builds Docker image (Node 20 Alpine, `npx tsx server/index.ts`), deploys as revision.

### 10.3 Database Migrations

No automated migration pipeline. Changes applied via:
1. Drizzle `generate` + `migrate` (when supported)
2. Direct SQL scripts (`server/scripts/migrate-phase12.ts`)
3. `CREATE TABLE IF NOT EXISTS` for safety

### 10.4 Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY shared/ ./shared/
COPY tsconfig.json tsconfig.server.json drizzle.config.ts ./

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/ ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
```

Uses `tsx` for direct TypeScript execution — avoids path alias build issues.

---

## 11. Testing

**Framework:** Vitest 4.0
**Test count:** 117/117 passing
**Test suites:**

| Suite | Tests | Description |
|-------|-------|-------------|
| `shared/engine/__tests__/prefillCascade.test.ts` | 77 | All 49 mappings × multiple transitions + edge cases |
| `shared/engine/__tests__/shellGenerator.test.ts` | 29 | 13 rules × configuration variants |
| `client/src/engine/pricing.test.ts` | 0 | Legacy empty file (expected "No test suite found") |

**Golden tests:** 73 pricing rate assertions (archived from pre-CEO pricing era).

---

## 12. Phase History

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Backend scaffold, Express + Drizzle + Firebase Auth | ✅ |
| 1 | Scoping forms (78 fields, 13 building types) | ✅ |
| 2 | Shell generator (13 line item rules) | ✅ |
| 3 | CEO pricing flow (line items, totals, integrity) | ✅ |
| 4 | Proposals (PDF generation, magic links, email delivery) | ✅ |
| 5 | QuickBooks Online (OAuth2, estimates, invoices) | ✅ |
| 6 | Production pipeline (6 stages, prefill cascade) | ✅ |
| 7 | Field app (mobile-first scan capture) | ✅ |
| 8 | GCS integration (asset linking, browsing, downloads) | ✅ |
| 9 | Scorecard & reporting (4 tabs, SQL CTE aggregations) | ✅ |
| 10 | Knowledge Base (CRUD, search, AI chat, AI editing) | ✅ |
| 11 | Geo (address lookup, footprint, batch geocoding) | ✅ |
| 12 | KB sidebar redesign, Archive page, GCS upload portal | ✅ |

---

## 13. Key Design Decisions

1. **Scoping form as SSOT** — Every piece of project data originates in the 78-field scoping form. Quotes, proposals, production, and reporting all trace back to it.

2. **Declarative prefill cascade** — 49 typed mappings define how data flows between production stages. Adding a new field means adding one mapping object, not writing imperative code.

3. **Shell generator, not auto-pricer** — The system generates line item descriptions but never auto-fills prices. The CEO retains full control over pricing via the DealWorkspace.

4. **Signed URLs for large uploads** — Upload portal uses GCS signed URLs (`action: 'write'`) so files go directly to GCS, bypassing the 50MB multer limit on the Express server.

5. **Token-based public access** — Both proposals (client portal) and upload shares use random tokens for unauthenticated access, with expiry and revocation controls.

6. **No global state management** — Pages manage their own state. Shared logic is in hooks and the `api.ts` service layer. This keeps the codebase simple at the cost of occasional prop drilling.

7. **Direct TypeScript execution** — Server runs via `tsx` rather than pre-compiling to JavaScript. This simplifies the Docker build and avoids path alias resolution issues at build time.
