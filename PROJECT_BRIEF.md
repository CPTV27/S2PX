# S2P Studio — Project Brief

## What Is This?

S2P Studio is the internal operations dashboard for **Scan2Plan**, a 3D laser scanning and BIM modeling services company. It's a React SPA that connects to an Express backend on Cloud Run, Firebase Firestore, Google Cloud Storage (3 buckets, 567 projects, 365K+ files), and AI APIs (Gemini 2.5 + Anthropic Claude).

**Live:** https://s2p-studio.web.app
**Backend:** Cloud Run service `s2p-staging` in `scan2plan-internal` GCP project
**Source:** `/Users/chasethis/S2P-Studio` (frontend), `/Users/chasethis/s2p-platform` (backend)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 |
| Routing | React Router v7 |
| Animations | Framer Motion (motion/react) |
| Charts | Recharts |
| Icons | Lucide React |
| AI (Chat/Quotes) | Google Gemini 2.5 Flash + Pro (with extended thinking) |
| AI (Extraction) | Anthropic Claude (via browser-side API) |
| Database | PostgreSQL on Cloud SQL (via Express backend) |
| Document Store | Firebase Firestore (wiki pages) |
| File Storage | Google Cloud Storage (3 buckets) |
| Backend API | Express.js on Cloud Run (us-east4) |
| Hosting | Firebase Hosting → Cloud Run rewrite for /api/** |
| Auth | Dev auto-login (Google OAuth configured but credentials not deployed) |

---

## Architecture

```
Browser (s2p-studio.web.app)
  ├── /dashboard/*  →  React SPA (Vite build)
  └── /api/**       →  Firebase Hosting rewrite → Cloud Run (s2p-staging)
                         ├── PostgreSQL (Cloud SQL) — leads, projects, quotes, products
                         ├── GCS buckets — s2p-active-projects, s2p-incoming-staging, s2p-quarantine
                         └── Session auth (express-session + connect-pg-simple)

  + Direct Firebase SDK calls:
    ├── Firestore — wiki_pages collection (Knowledge Base)
    └── Gemini API — client-side via @google/genai
```

---

## Modules (10 pages)

### 1. Dashboard (`/dashboard`)
KPI overview: Total Leads, Active Projects, Revenue MTD, Win Rate.
Data: Aggregated from `/api/leads` + `/api/projects`.

### 2. Pipeline (`/dashboard/pipeline`)
CRM-style lead tracker with status filters (new → contacted → qualified → proposal_sent → won/lost). Searchable, color-coded priority badges.
Data: `/api/leads`

### 3. AI Quotes (`/dashboard/quotes`)
Chat interface with Gemini 2.5 for generating structured project quotes. Uses the Pricing Rules engine config as context. Supports extended reasoning mode. Can save quotes to database.
Data: Gemini API + `/api/cpq/quotes` + localStorage pricing config

### 4. Projects (`/dashboard/projects`)
Split-view: left panel lists 567 GCS project folders (searchable), right panel is a file browser with folder navigation, breadcrumbs, and download buttons. Toggle between Cloud Storage and Database views. Collapsible analytics panel showing file distribution, project-by-month charts, top projects by size.
Data: `/api/projects/gcs/folders`, `/api/projects/gcs/browse`, `/api/projects/gcs/analytics`

### 5. Revenue (`/dashboard/revenue`)
Financial dashboard: Total YTD revenue, average deal size, monthly run rate. Bar chart + line chart showing monthly revenue trends from won leads.
Data: `/api/leads` filtered by status=won

### 6. Knowledge Base (`/dashboard/knowledge`)
Wiki system backed by Firestore. Left panel shows wiki pages with categories and tags. Right panel is a Gemini-powered Q&A chat that uses wiki content as context. Supports live real-time sync.
Data: Firestore `wiki_pages` collection + Gemini API

### 7. Pricing Rules (`/dashboard/pricing-rules`)
Profit-first pricing engine configuration. Sections: COGS (scan + modeling costs), personnel allocations (% of revenue per team member), profit allocations (taxes, S&M, owner draw, savings), overhead (rolling 3-month), add-on services, multipliers (rush, complexity, hazardous). Integrates scan intelligence from field app.
Data: localStorage + optional field app API

### 8. Notebook CPQ (`/dashboard/notebook-cpq`)
Natural language quoting via Anthropic Claude. Describe a project in plain English → AI extracts structured parameters (building type, sqft, LOD, disciplines) → deterministic pricing engine calculates quote → margin guardrails verify profitability. Includes building location map sidebar and quick reference panel.
Data: Anthropic API (key via UI or env) + pricing engine

### 9. Cloud Storage (`/dashboard/storage`)
Direct GCS file manager across 3 buckets (active, incoming, quarantine). Upload, download, delete files. Breadcrumb navigation, drag-and-drop upload.
Data: Firebase Storage SDK

### 10. Settings (`/dashboard/settings`)
System health dashboard: connection status for Backend API, Gemini, Firebase Hosting, Firestore, Cloud Storage. Version info and project metadata.

---

## Data Model (Key Types)

```typescript
// CRM
Lead { id, clientName, projectName, status, priority, estimatedValue, squareFootage, buildingType }
Project { id, leadId, projectName, clientName, status, scanDate, deliveryDate, deliverableType }
Quote { id, leadId, quoteNumber, totalPrice, areas, pricingBreakdown }

// Pricing Engine (Profit-First)
PricingConfig {
  scanCosts: CostInput[]          // Scan tech day rate, equipment, travel
  modelingCosts: CostInput[]      // CAD/BIM rates by LOD level
  personnelAllocations[]          // Team member % of revenue
  profitAllocations[]             // Taxes 15%, S&M 10%, owner draw 10%, savings 10%
  overhead: OverheadConfig        // Rolling 3-month average
  addOnServices: AddOnService[]   // Structural, MEP, fire protection
  multipliers: Multiplier[]       // Rush, complexity, hazardous
  scanIntelligence               // Historical project performance data
}

GeneratedQuote {
  lineItems: QuoteLineItem[]     // Service, qty, vendor cost, margin, client price
  totalCOGS, totalClientPrice, cogsMultiplier
  profitBreakdown[]              // Where the margin goes
}

// GCS Storage
GcsProjectFolder { name, scanDate, folderPath, bucket }
GcsFolderEntry { name, fullPath, isFolder, size, contentType }
ProjectAnalytics { totalProjects: 567, totalFiles: 365791, totalSizeBytes: ~21.9TB }

// Knowledge Base
WikiPage { id, title, content, category, tags }
```

---

## File Structure

```
src/
├── pages/           # 10 page components (Dashboard, Pipeline, Projects, etc.)
├── components/
│   ├── DashboardLayout.tsx   # Sidebar nav + header + outlet
│   ├── ChatWidget.tsx        # Floating Gemini chat assistant
│   └── notebook/             # 7 sub-components for Notebook CPQ
│       ├── Notebook.tsx      # Main extraction → pricing → export flow
│       ├── InputCell.tsx     # Natural language input
│       ├── ExtractionCell.tsx # AI-extracted parameters display
│       ├── QuoteCell.tsx     # Calculated quote with integrity checks
│       ├── QuoteExport.tsx   # Export/follow-up options
│       ├── BuildingMap.tsx   # Location visualization
│       └── MarginSlider.tsx  # Margin adjustment control
├── services/
│   ├── api.ts          # Express backend client (leads, projects, GCS, quotes)
│   ├── firebase.ts     # Firebase app init
│   ├── firestore.ts    # Wiki CRUD + real-time listeners
│   ├── storage.ts      # GCS file operations (upload, download, delete)
│   ├── gemini.ts       # Gemini 2.5 Flash/Pro with tools + system prompt
│   └── pricingConfig.ts # Pricing engine persistence + calculations
├── engine/
│   ├── types.ts        # Extraction types (Area, BuildingType, Discipline)
│   ├── constants.ts    # LOD levels, discipline lists, complexity factors
│   ├── extract.ts      # NLP parameter extraction from descriptions
│   ├── pricing.ts      # Deterministic quote calculation
│   └── pricing.test.ts # Unit tests for pricing engine
├── hooks/
│   └── useQuoteSession.ts # Notebook state management
├── types/
│   └── index.ts        # All TypeScript interfaces (see above)
├── lib/
│   └── utils.ts        # formatCurrency, formatDate, cn, getStatusColor
├── styles/
│   └── notebook.css    # Notebook CPQ custom theme
├── App.tsx             # Router config
├── main.tsx            # Entry point
└── index.css           # Tailwind theme tokens + global styles
```

---

## Infrastructure

| Resource | Details |
|----------|---------|
| GCP Project | `scan2plan-internal` (project #238833520624) |
| Cloud Run | `s2p-staging` in us-east4, 512Mi, Node 20 Alpine |
| Cloud SQL | PostgreSQL `s2p-staging` in us-central1 |
| GCS Buckets | `s2p-active-projects` (567 project folders, 365K files, ~22TB), `s2p-incoming-staging`, `s2p-quarantine` |
| Firebase Hosting | `s2p-studio.web.app` with /api/** rewrite to Cloud Run |
| Firestore | Default database, `wiki_pages` collection (8 seeded pages) |
| Service Account | `238833520624-compute@developer.gserviceaccount.com` with `storage.objectViewer` on all 3 buckets |

---

## Current Status

### Working
- All 10 pages render and load data
- GCS project browser (567 folders, file navigation, breadcrumbs)
- GCS analytics (computed from 365K files across all projects)
- Knowledge Base with Firestore wiki + Gemini Q&A
- Pipeline, Revenue, Dashboard pulling from backend API
- Pricing Rules engine with localStorage persistence
- AI Quotes chat with Gemini (standard + reasoning modes)
- Cloud Storage multi-bucket browser
- Firebase Hosting → Cloud Run API proxy (same-origin, no CORS issues)

### Known Issues
1. **File download broken** — `generateSignedReadUrl()` likely fails because Cloud Run service account needs `roles/iam.serviceAccountTokenCreator` to sign GCS URLs
2. **Notebook CPQ API key** — Anthropic key not embedded in production build; users must enter via UI
3. **No auth guard** — App doesn't redirect to /login; all routes accessible without authentication
4. **Logout button** — No onClick handler wired
5. **New Lead button** — UI present but no create form/modal
6. **Knowledge Base** — Read-only; no create/edit/delete wiki page UI

### Opportunities for Improvement
- **Auth flow**: Wire up Google OAuth through the Firebase Hosting proxy or add simple token auth
- **Lead detail view**: No route for viewing/editing individual leads
- **Quote→Lead linking**: Pipeline doesn't show associated quotes
- **Real-time updates**: Only Knowledge Base has live sync; Pipeline and Projects could benefit
- **Code splitting**: Projects.tsx and PricingRules.tsx are large (1000+ lines each)
- **Error boundaries**: No React error boundaries for graceful failure handling
- **Mobile responsiveness**: Sidebar collapses but some pages may not be fully responsive
- **Testing**: Only pricing engine has tests; no component or integration tests
- **Deployment pipeline**: Manual deploys; could use GitHub Actions CI/CD

---

## Environment Variables

```bash
# AI APIs
GEMINI_API_KEY=AIzaSy...              # Google Gemini (exposed via vite define)
ANTHROPIC_API_KEY=sk-ant-...          # Claude (exposed via vite define)

# Backend
S2P_API_URL=http://localhost:5000     # Dev proxy target

# Firebase (client-side, VITE_ prefix required)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=scan2plan-internal.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=scan2plan-internal
VITE_FIREBASE_STORAGE_BUCKET=scan2plan-internal.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=238833520624
VITE_FIREBASE_APP_ID=1:238833520624:web:...

# Optional
VITE_FIELD_APP_URL=                   # Field technician app for scan intelligence sync
```

---

## How to Run Locally

```bash
cd /Users/chasethis/S2P-Studio
npm install
npm run dev          # Vite dev server on :5173, proxies /api to backend

# Backend (separate terminal):
cd /Users/chasethis/s2p-platform
npm install
npm run dev          # Express on :5000
```

## How to Deploy

```bash
# Frontend
cd /Users/chasethis/S2P-Studio
npm run build && firebase deploy --only hosting

# Backend
cd /Users/chasethis/s2p-platform
gcloud run deploy s2p-staging --source . --region us-east4 --env-vars-file .env.cloudrun.yaml --allow-unauthenticated --port 8080 --memory 512Mi --timeout 300

# Firestore rules
firebase deploy --only firestore:rules --project scan2plan-internal
```
