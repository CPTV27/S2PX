# S2PX — Scan2Plan OS X

Full-stack operations platform for a 3D laser scanning and BIM modeling business. Manages the complete lifecycle from lead intake through scoping, CEO pricing, proposal generation, QuickBooks sync, production pipeline, field operations, cloud storage, and executive reporting.

**Stack:** React 19 + Vite 6 | Express + TypeScript | PostgreSQL (Drizzle ORM) | Firebase Auth | Google Cloud Storage | PDFKit | Gemini AI

---

## Architecture

```
s2px/
  client/src/          React 19 SPA (Vite 6, Tailwind CSS 4)
  server/              Express API (TypeScript, PDFKit, Nodemailer)
  shared/              Schema (Drizzle), engine (shell gen, pricing), types
```

**Monorepo** with path aliases: `@/` (client), `@shared/` (shared).

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Framer Motion, Recharts, Lucide icons |
| Backend | Express, TypeScript, PDFKit, Nodemailer, Google Generative AI |
| Database | PostgreSQL via Drizzle ORM (Neon-compatible) |
| Auth | Firebase Authentication (Google OAuth) |
| Storage | Google Cloud Storage (4 buckets: vault, active-projects, staging, quarantine) |
| Maps | Google Maps API (@vis.gl/react-google-maps) |
| Accounting | QuickBooks Online (OAuth2 integration) |
| AI | Gemini 2.5 Flash/Pro (KB chat, AI editing, notebook extraction) |
| Hosting | Firebase Hosting (frontend) + Cloud Run (API) |
| Container | Docker multi-stage Node 20 Alpine |

---

## Database Schema (13 tables)

| Table | Purpose |
|-------|---------|
| `users` | Firebase-authenticated users with roles (user, admin, ceo) |
| `scoping_forms` | 78-field master deal record — single source of truth for every project |
| `scope_areas` | Repeatable building area blocks (1:N per scoping form) — type, SF, LoD, disciplines |
| `quotes` | Priced line items (CEO pricing) + integrity status + QBO sync tracking |
| `proposals` | Generated PDF proposals + client portal magic links + view/response tracking |
| `proposal_templates` | Editable boilerplate content for 9-11 page PDF proposals |
| `qbo_tokens` | QuickBooks Online OAuth2 credentials (encrypted refresh tokens) |
| `production_projects` | 6-stage production pipeline with prefill cascade |
| `project_assets` | GCS file paths + metadata caching for production deliverables |
| `kb_sections` | Knowledge base content (4 parts, full-text search) |
| `kb_edit_history` | KB revision audit log |
| `upload_shares` | Token-based external upload links (client file collection) |
| `upload_share_files` | Per-file audit trail for upload shares |

---

## Feature Map

### Phase 0-2: Foundation
- Firebase Google OAuth with role-based access (user/admin/ceo)
- Dashboard with KPI cards (leads, projects, revenue, win rate)
- Sales pipeline Kanban board
- Project archive with status tracking

### Phase 3: Scoping Engine
- 78-field scoping form (client info, building details, BIM specs, travel, risk factors)
- Repeatable area blocks with discipline toggles (Architecture, Structural, MEPF, CAD, ACT, Below Floor)
- Auto-generated UPID (unique project identifier)
- Google Maps integration for address geocoding + building footprint estimation

### Phase 4: CEO Pricing (Shell Generator)
- **13-rule shell generator** converts scoping form into `LineItemShell[]` (modeling, travel, add-ons)
- DealWorkspace: CEO manually prices each line item (upteam cost + client price)
- `computeQuoteTotals()` with integrity guardrails: blocked <40% margin, warning 40-45%, passed >=45%
- Line item table with inline editing, CEO strategy sections, pricing tools

### Phase 5: Proposals
- **9-11 page PDF generator** (PDFKit): Cover, About/Why, Project Overview, 5-column Estimate Table, Payment Terms, Capabilities, Difference, BIM Standards (LoD table with project-row highlighting)
- Editable proposal templates (boilerplate stored in DB, managed via Settings UI)
- `{{variable}}` substitution in template text
- Client portal with magic link (token-based, tracks views/responses)
- Email delivery with PDF attachment (Nodemailer + SendGrid)

### Phase 6: QuickBooks Online
- OAuth2 connection flow
- Estimate creation from priced quotes (line items mapped to QBO format)
- Estimate-to-invoice conversion
- QBO estimate emailing

### Phase 7: Production Pipeline
- 6-stage Kanban: Pre-Scan, Scanning, Registration, Modeling, QC, Delivery
- **49-mapping prefill cascade** auto-populates stage fields from scoping data
- Stage advance with preview and validation
- Per-project detail view with stage data editing

### Phase 8: Field Operations
- Mobile-first field capture UI (`/field/:projectId`)
- GCS asset linking (browse, link, refresh metadata)
- Asset browser with download URLs
- 4-bucket storage architecture (vault, active-projects, staging, quarantine)

### Phase 9: Scorecard & Reporting
- 4-tab executive dashboard: Overview, Pipeline, Production, Profitability
- SQL CTE aggregations with time-range and tier filters
- Recharts visualizations (bar, line, pie charts)

### Phase 10: Knowledge Base
- 4-part content library with markdown editing
- Full-text search (PostgreSQL `ts_rank`)
- AI chat powered by Gemini (contextual Q&A with citations)
- AI-assisted section editing with diff preview
- Edit history with version tracking

### Phase 11: Geo & Maps
- Address geocoding via Google Maps API
- Building footprint estimation
- Batch geocoding for existing scoping forms
- Map integration in scoping form

### Phase 12: Cloud Storage & Upload Portal
- GCS project folder browser with breadcrumb navigation
- Token-based upload portal for clients (`/upload/:token`)
- Upload share management (create, revoke, track usage)
- File audit trail with size/type tracking
- Sidebar redesign + archive page overhaul

### Phase 13: Proposal Template System
- `proposal_templates` DB table with editable boilerplate sections
- Template CRUD API with active template selection
- Settings UI for content editing (About, Why, Capabilities, Difference, BIM Standards, Payment Terms, SF Audit)
- Template selector in ProposalBuilder
- 9-11 page PDF with variable substitution and LoD table highlighting

---

## Routes

### Authenticated (Dashboard)
| Path | Page |
|------|------|
| `/dashboard` | Home dashboard with KPI cards |
| `/dashboard/pipeline` | Sales pipeline Kanban |
| `/dashboard/production` | Production pipeline Kanban |
| `/dashboard/production/:id` | Production project detail |
| `/dashboard/projects` | Project archive |
| `/dashboard/revenue` | Revenue dashboard |
| `/dashboard/scorecard` | Executive scorecard (4 tabs) |
| `/dashboard/knowledge` | Knowledge base |
| `/dashboard/storage` | GCS file browser |
| `/dashboard/settings` | System settings + connections |
| `/dashboard/settings/proposal-template` | Proposal template editor |
| `/dashboard/scoping` | Scoping form list |
| `/dashboard/scoping/new` | New scoping form |
| `/dashboard/scoping/:id` | Edit scoping form |
| `/dashboard/deals/:id` | DealWorkspace (pricing + proposals) |
| `/dashboard/proposals/:id` | Proposal builder + PDF generation |

### Public
| Path | Page |
|------|------|
| `/login` | Firebase Google OAuth |
| `/upload/:token` | Client upload portal (token-validated) |
| `/field/:projectId` | Mobile field capture (auth required) |

---

## API Endpoints

| Group | Endpoints |
|-------|-----------|
| Auth | `GET /api/auth/user` |
| Scoping | `GET/POST /api/scoping`, `GET/PATCH/DELETE /api/scoping/:id`, areas CRUD |
| Quotes | `GET/POST /api/quotes`, `GET/PATCH /api/quotes/:id`, `GET /api/quotes/by-form/:id` |
| Proposals | `POST /api/proposals/:quoteId/generate`, `POST /api/proposals/:id/send`, `GET /api/proposals/:quoteId/status`, `GET /api/client-portal/:token` |
| Proposal Templates | `GET/POST /api/proposal-templates`, `GET/PATCH/DELETE /api/proposal-templates/:id`, `GET /api/proposal-templates/active` |
| QBO | `GET /api/qbo/status`, `GET /api/qbo/auth`, `POST /api/qbo/disconnect`, estimate/invoice CRUD |
| Production | `GET/POST /api/production`, `GET/PATCH /api/production/:id`, `POST /api/production/:id/advance`, assets CRUD |
| Upload Shares | `GET/POST /api/upload-shares`, `DELETE /api/upload-shares/:id`, `GET /api/upload-shares/:id/files` |
| Scorecard | `GET /api/scorecard/{overview,pipeline,production,profitability}` |
| Knowledge Base | `GET /api/kb/sections`, `GET/PUT /api/kb/sections/:slug`, `GET /api/kb/search`, `POST /api/kb/chat`, AI edit |
| Geo | `POST /api/geo/lookup`, `POST /api/geo/batch` |
| GCS | `GET /api/projects/gcs/{folders,browse,download,analytics}` |
| Health | `GET /api/health` |

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (local or Neon)
- Firebase project with Google OAuth enabled
- Google Cloud Storage bucket(s)

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Firebase (web SDK config)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Cloud
GCS_BUCKET=your-primary-bucket
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# AI
GEMINI_API_KEY=

# Optional
ANTHROPIC_API_KEY=          # KB notebook extraction
QBO_CLIENT_ID=              # QuickBooks Online
QBO_CLIENT_SECRET=
SENDGRID_API_KEY=           # Email delivery
GOOGLE_MAPS_API_KEY=        # Geocoding
```

### Install & Run

```bash
npm install

# Run database migrations
npx tsx server/scripts/migrate-phase13.ts   # (latest)

# Development (concurrent client + server)
npm run dev
# Client: http://localhost:5173
# Server: http://localhost:5001

# Type check
npx tsc --noEmit

# Test (117/117 passing)
npm test

# Production build
npm run build
```

### Docker

```bash
docker build -t s2px .
docker run -p 5001:5001 --env-file .env s2px
```

---

## Shared Engine

The `shared/` directory contains framework-agnostic business logic used by both client and server:

| Module | Purpose |
|--------|---------|
| `shared/schema/db.ts` | Drizzle ORM table definitions (13 tables) |
| `shared/engine/shellGenerator.ts` | 13-rule line item generator (scoping form -> LineItemShell[]) |
| `shared/engine/quoteTotals.ts` | `computeQuoteTotals()` with margin integrity guardrails |
| `shared/engine/prefillCascade.ts` | 49 production stage prefill mappings |
| `shared/types/lineItem.ts` | `LineItemShell`, `QuoteTotals` interfaces |
| `shared/types/scorecard.ts` | Scorecard response types |

---

## Testing

```
117/117 tests passing (Vitest)

  shared/engine/__tests__/shellGenerator.test.ts    29 tests
  shared/engine/__tests__/prefillCascade.test.ts    77 tests
  shared/engine/__tests__/quoteTotals.test.ts       11 tests
```

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Firebase Hosting | `*.web.app` |
| API | Cloud Run (us-central1) | Auto-scaled container |
| Database | PostgreSQL (Neon) | Serverless |
| Storage | Google Cloud Storage | 4 buckets |

Firebase Hosting rewrites `/api/**` to Cloud Run, so the frontend and API share a single origin in production.

---

## Brand

- **Full name:** Scan2Plan OS X
- **Monogram:** S2PX
- **Version:** vX.1
- **Sidebar:** `S2P` + blue `X` accent, subtitle "Scan2Plan OS"
- **Header:** `SCAN2PLAN OS X` monospace uppercase

---

*Built with TypeScript. 13 phases shipped. Zero compromises.*
