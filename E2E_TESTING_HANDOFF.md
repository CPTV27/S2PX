# S2PX End-to-End Testing Handoff

> **Internal document** — contains production URLs and architecture details. Do not share externally.

## What is S2PX?
Scan2Plan OS X (S2PX) is an internal operations platform for a 3D scanning/BIM company. It manages the full deal lifecycle: lead intake → scoping → pricing → proposals → production → invoicing.

## Quick Start

```bash
cd ~/S2P-Studio

# Install deps (if needed)
npm install

# Start both client + server
npm run dev

# Or start individually:
npm run dev:client   # Vite on :5173
npm run dev:server   # Express on :5001
```

### Environment
- `.env` must contain `DATABASE_URL`, `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`
- The `.env` file is already configured in the repo (gitignored)
- Auth: Firebase Google OAuth — all `/api/*` routes (except `/api/health` and `/api/public/*`) require a Firebase Bearer token

### Verification Commands
```bash
npm run lint          # tsc --noEmit (should be zero errors)
npm test              # vitest run (117/117 should pass)
npm run build         # tsc -b && vite build (should succeed)
```

### Existing Automated E2E Tests (Playwright)

There are already 6 Playwright spec files in `e2e/` with mock API interception:

```bash
# Run all E2E tests (starts dev server automatically)
npx playwright test

# Run a single spec
npx playwright test e2e/navigation.spec.ts

# Run with headed browser (watch mode)
npx playwright test --headed

# Run with Playwright UI inspector
npx playwright test --ui
```

| Spec File | Coverage |
|-----------|----------|
| `e2e/navigation.spec.ts` | UI routing, sidebar, header, responsive layout |
| `e2e/revenue.spec.ts` | 6-tab revenue dashboard data rendering |
| `e2e/scorecard.spec.ts` | 4-tab scorecard KPI rendering |
| `e2e/data-integrity.spec.ts` | Cross-tab math verification |
| `e2e/pm-dashboard.spec.ts` | PM Mission Control field data |
| `e2e/scantech.spec.ts` | Mobile Scantech field ops |

**Mock data fixtures:** `e2e/fixtures/mock-data.ts` and `e2e/fixtures/scantech-mock-data.ts`

**Config:** `playwright.config.ts` — Desktop Chrome + iPhone 13 viewports, 30s timeout, HTML reporter, auto-starts dev server on `:5173`

**Note:** Navigation tests always pass (mock API). Data-rendering tests may be excluded from CI if they require a real backend — check the spec files for `test.skip` conditions.

---

## Architecture

```
client/src/           React 19 + Vite 6 (SPA)
  pages/              Route-level components (lazy loaded)
  components/         Shared UI components
  hooks/              Custom React hooks (useScopingForm, useDealWorkspace, etc.)
  services/api.ts     Fetch wrapper for all backend calls
  engine/             Client-side pricing engine

server/               Express backend
  index.ts            App entry (cors, auth middleware, route registration)
  routes.ts           Route mounting (/api/quotes, /api/scoping, etc.)
  routes/             Individual route files
  middleware/auth.ts   Firebase token verification
  db.ts               Drizzle ORM connection

shared/               Shared between client + server
  schema/db.ts        Drizzle PostgreSQL schema (all tables)
  schema/constants.ts Shared constants (BIM versions, etc.)
  engine/             Pricing engine (shellGenerator, quoteTotals, prefillCascade)
  types/              Shared TypeScript types
```

### Database (PostgreSQL via Drizzle ORM)
Key tables: `users`, `scoping_forms`, `scope_areas`, `quotes`, `proposals`, `production_projects`, `project_assets`, `kb_sections`, `upload_shares`, `qbo_*` (QuickBooks)

### Auth Flow
- Firebase Google OAuth on the client
- Every API call includes `Authorization: Bearer <firebase-id-token>`
- `server/middleware/auth.ts` verifies the token and attaches `req.user`
- `/api/health` bypasses auth (returns `{"status":"ok","db":"connected"}`)

---

## Production URLs
- **Frontend**: https://s2px.web.app (Firebase Hosting)
- **Backend**: https://s2px-api-909127038729.us-central1.run.app (Cloud Run)
- **Health check**: `curl https://s2px-api-909127038729.us-central1.run.app/api/health`

---

## All API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (no auth) |
| GET/POST | `/api/auth/*` | Auth endpoints |
| GET/POST/PATCH | `/api/scoping/*` | Scoping forms CRUD |
| POST | `/api/scoping/:id/areas` | Add scope area |
| PATCH | `/api/scoping/:id/areas/:areaId` | Update scope area |
| DELETE | `/api/scoping/:id/areas/:areaId` | Delete scope area |
| GET | `/api/quotes/by-form/:formId` | Get quotes for a scoping form |
| GET | `/api/quotes/:id` | Get quote by ID |
| POST | `/api/quotes` | Create quote |
| PATCH | `/api/quotes/:id` | Update quote |
| GET/POST/PATCH | `/api/proposals/*` | Proposals CRUD |
| POST | `/api/geo/lookup` | Geocode an address |
| POST | `/api/geo/batch` | Batch geocode |
| POST | `/api/geo/distance` | Distance calculation |
| GET/POST | `/api/leads/*` | Leads pipeline |
| GET | `/api/projects/*` | Projects browser |
| GET | `/api/scorecard/*` | Scorecard aggregations |
| GET/POST | `/api/kb/*` | Knowledge base |
| GET/POST | `/api/production/*` | Production pipeline |
| GET/POST | `/api/qbo/*` | QuickBooks integration |
| GET/POST | `/api/financials/*` | Financial dashboards |
| GET/POST | `/api/chat/*` | Gemini AI chat |
| GET/POST | `/api/upload-shares/*` | Client upload portal |
| GET/POST | `/api/scantech/*` | Field tech mobile hub |
| GET | `/api/pm/*` | PM dashboard |
| GET/PATCH | `/api/proposal-templates/*` | Proposal template settings |
| GET/POST | `/api/cpq/*` | Configure-Price-Quote |

---

## Frontend Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | Login | Google OAuth sign-in |
| `/dashboard` | Dashboard | Main dashboard (index) |
| `/dashboard/pipeline` | Pipeline | Deal pipeline kanban |
| `/dashboard/projects` | Projects | Projects browser |
| `/dashboard/revenue` | Revenue | Revenue tracking |
| `/dashboard/scorecard` | Scorecard | KPI scorecard (4 tabs) |
| `/dashboard/knowledge` | KnowledgeBase | Internal KB |
| `/dashboard/settings` | Settings | App settings |
| `/dashboard/storage` | StorageBrowser | GCS file browser |
| `/dashboard/scoping` | ScopingList | List all scoping forms |
| `/dashboard/scoping/new` | ScopingForm | New scoping form |
| `/dashboard/scoping/:id` | ScopingForm | Edit scoping form |
| `/dashboard/deals/:id` | DealWorkspace | Price a deal (CEO pricing) |
| `/dashboard/proposals/:id` | ProposalBuilder | Build/send proposal |
| `/dashboard/production` | ProductionPipeline | Production pipeline |
| `/dashboard/production/:id` | ProductionDetail | Production project detail |
| `/scantech` | ScantechList | Mobile field tech list |
| `/scantech/:projectId/*` | ScantechProject | Field tech project (tabs) |
| `/field/:projectId` | FieldCapture | Field capture (mobile) |
| `/upload/:token` | UploadPortal | Public upload portal |
| `/client-portal/:token` | ClientPortal | Public proposal review |

---

## Critical User Journeys to Test

### Journey 1: New Deal — Scoping → Pricing → Proposal
This is the primary revenue-generating flow. It's broken into three sub-journeys that can be tested independently.

#### Journey 1A: Create Scoping Form
1. `/dashboard/scoping/new` — Fill out a new scoping form
   - Section A: Client company, project name, address (Google Places autocomplete), email
   - Section B: Contact info
   - Section C: Building info (floors, basement/attic)
   - Section D: Add at least 1 scope area (area type, sq ft, scope, LOD, CAD deliverable)
   - Section E: Landscape modeling
   - Section F: BIM deliverable, BIM version (dropdown), georeferencing
   - Section G: Building era, room density, risk factors
   - Section H: Scan registration, expedited
   - Section I: Travel (dispatch, miles, mode) — travel calculator should work
   - Section M: Project timeline (dropdown: Q1-Q4 by year, ASAP, TBD)
   - Section N: Notes, docs
   - Section O: Lead source, probability, deal stage, priority
2. Click **"Create & Save"** — should validate, show errors if invalid, redirect to `/dashboard/scoping/:id` on success
3. After save, a **workflow stepper banner** should appear at the top showing: Scope → Price → Propose → Win

**What to verify:**
- Address autocomplete dropdown appears when typing
- Travel calculator returns distance/cost (not API Error 500)
- PropertyMap shows after save (satellite view)
- Save button shows loading spinner, error feedback on failure
- Workflow banner steps update correctly
- Back button goes to `/dashboard/pipeline` (not orphaned `/dashboard/scoping` page)

#### Journey 1B: CEO Pricing (DealWorkspace)
*Prerequisite: A saved scoping form with at least one scope area.*

1. Click **"Price this Deal"** button from scoping form — navigates to `/dashboard/deals/:id`
2. DealWorkspace should load with:
   - PropertyMap satellite view (if address was entered)
   - Scoping summary (areas, SF, floors, travel, etc.)
   - Auto-generated line item shells from scoping data
   - CEO Controls sidebar
3. Enter prices in line items (upteam cost + client price per line)
4. Bottom totals bar should show live calculations (revenue, cost, margin)
5. Click **"Save Quote"** — should persist to database

**What to verify:**
- Line items generate correctly from scoping data
- Quote totals calculate in real-time
- Margin warnings appear when < 40%

#### Journey 1C: Proposal Generation
*Prerequisite: A saved quote.*

1. After saving quote, **"Create Proposal"** button becomes active
2. Click **"Create Proposal"** → navigates to `/dashboard/proposals/:id`
3. ProposalBuilder should load with prefilled data from scoping + quote

### Journey 2: Edit Existing Scoping Form
1. `/dashboard/scoping` — List should show existing forms
2. Click a form to open `/dashboard/scoping/:id`
3. Edit fields — autosave should trigger (2-second debounce)
4. Save indicator should show "Saving..." → "Saved"
5. PropertyMap should appear below Section A
6. Scope areas can be added, edited, cloned, deleted

### Journey 3: Pipeline View
1. `/dashboard/pipeline` — Should show deal cards in pipeline stages
2. Cards should be clickable → navigate to scoping form or deal workspace
3. Stage filters should work

### Journey 4: Dashboard + Scorecard
1. `/dashboard` — Main dashboard with summary metrics
2. `/dashboard/scorecard` — 4 tabs: Overview, Pipeline, Production, Profitability
3. Each tab should load data (SQL CTE aggregations on the backend)

### Journey 5: Production Pipeline
1. `/dashboard/production` — List of production projects
2. `/dashboard/production/:id` — Detail view with assets, status tracking

### Journey 6: Public Upload Portal (No Auth Required)
These routes are unauthenticated and are the easiest to automate in E2E tests.

1. `/upload/:token` — Client upload portal
   - Requires a valid upload share token (create one via `/api/upload-shares` with an authenticated call first)
   - Should show upload UI with drag-and-drop
   - Files should upload to GCS staging bucket
   - Invalid/expired tokens should show an error state

### Journey 7: Client Proposal Portal (No Auth Required)
1. `/client-portal/:token` — Public proposal review page
   - Requires a valid proposal magic link token
   - Should display the proposal PDF/content
   - Should track views (verify view count increments in DB)
   - Client response actions (accept/decline) should work

---

## Test Data Setup

There is no automated seed script. To set up test data for manual or E2E testing:

1. **Create test data through the UI** — Sign in and create a scoping form (Journey 1A). This cascades into pricing and proposals.
2. **For Playwright tests** — The existing specs use mock API interception via `page.route()` with fixtures in `e2e/fixtures/`. No real backend data is needed for these tests.
3. **For backend API testing** — You'll need a Firebase auth token (see "Testing Without Auth" section below) and a running database.
4. **Upload share tokens** — Create via the Settings or Storage page in the UI, or call `POST /api/upload-shares` with a valid auth token.

---

## Known Issues / Recently Fixed (Verify These Work)

| Issue | Fix | Status |
|-------|-----|--------|
| DealWorkspace 500 error | `quotes.ts` route ordering — `/by-form/:formId` before `/:id` | Fixed (commit cca282a) |
| Back navigation orphaned page | Changed to `/dashboard/pipeline` | Fixed (commit cca282a) |
| Stale chunk errors after deploy | ErrorBoundary auto-reloads on dynamic import failure | Fixed (commit 2c742ed) |
| Travel calculator 500 | `GOOGLE_MAPS_API_KEY` added to Cloud Run | Fixed (commit 410809d) |
| Save button silent failure | Added validation error banner + scroll to first error | Fixed (commit 410809d) |
| Project Timeline was free text | Converted to quarter dropdown | Fixed (commit 410809d) |
| BIM Version was free text | Converted to dropdown with standard versions | Fixed (commit f0cd460) |

---

## Testing Without Auth (Backend-Only)

The only unauthenticated endpoint is health:
```bash
curl http://localhost:5001/api/health
# {"status":"ok","db":"connected","timestamp":"..."}
```

All other endpoints need a Firebase token. To test API routes:
1. Sign in on the frontend at `http://localhost:5173`
2. Open browser DevTools → Application → IndexedDB → firebaseLocalStorageDb
3. Find the auth token, or intercept it from a Network request (`Authorization: Bearer ...`)
4. Use it in curl:
```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5001/api/scoping
```

---

## Testing the Pricing Engine (No Auth Needed)

The shared pricing engine runs in Node.js without auth:
```bash
npm test   # Runs vitest — 117 tests across 3 suites
```

Test files:
- `shared/engine/__tests__/quoteTotals.test.ts` — 11 tests (total calculations)
- `shared/engine/__tests__/prefillCascade.test.ts` — 77 tests (49 prefill mappings)
- `shared/engine/__tests__/shellGenerator.test.ts` — 29 tests (line item generation)

---

## Build & Deploy

```bash
# Frontend (Firebase Hosting)
npm run build                      # tsc + vite build → dist/
firebase deploy --only hosting     # Deploys dist/ to s2px.web.app

# Backend (Cloud Run)
gcloud run deploy s2px-api \
  --source . \
  --region us-central1 \
  --project s2px-production \
  --allow-unauthenticated \
  --update-env-vars "KEY=VALUE"

# IMPORTANT: Use --update-env-vars (additive), NEVER --set-env-vars (replaces ALL)
```

---

## File Quick Reference

| File | What it does |
|------|-------------|
| `client/src/App.tsx` | Route definitions + lazy loading |
| `client/src/pages/ScopingForm.tsx` | Main scoping form page |
| `client/src/pages/DealWorkspace.tsx` | CEO pricing workspace |
| `client/src/pages/ProposalBuilder.tsx` | Proposal builder |
| `client/src/hooks/useScopingForm.ts` | Scoping form state + autosave + validation |
| `client/src/hooks/useDealWorkspace.ts` | Deal workspace state + quote CRUD |
| `client/src/services/api.ts` | All API fetch calls |
| `client/src/components/scoping/SectionA-O.tsx` | Individual form sections |
| `client/src/components/scoping/AddressAutocomplete.tsx` | Google Places autocomplete |
| `client/src/components/PropertyMap.tsx` | Google Maps satellite + Solar footprint |
| `client/src/components/ErrorBoundary.tsx` | Error boundary with stale chunk handling |
| `server/routes/quotes.ts` | Quote CRUD (recently fixed route ordering) |
| `server/routes/scoping.ts` | Scoping form CRUD |
| `server/routes/geo.ts` | Geocoding, distance, batch |
| `server/routes/proposals.ts` | Proposal generation + PDF |
| `shared/engine/shellGenerator.ts` | Line item shell generation |
| `shared/engine/quoteTotals.ts` | Quote total calculations |
| `shared/engine/prefillCascade.ts` | 49 prefill mappings for pricing |
| `shared/schema/db.ts` | Full database schema |
