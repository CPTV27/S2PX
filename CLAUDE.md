# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

S2PX (Scan2Plan OS X) is a full-stack internal operations platform for a 3D scanning/BIM company. It manages the complete deal lifecycle: lead intake → scoping → CEO pricing → proposals → QuickBooks sync → production pipeline → field ops → reporting.

## Commands

```bash
# Development
npm run dev              # Concurrent client (Vite :5173) + server (Express :5001)
npm run dev:client       # Client only
npm run dev:server       # Server only

# Verification (run all three before committing)
npm run lint             # tsc --noEmit
npm test                 # vitest (138/138 tests)
npm run build            # tsc -b && vite build → dist/

# Run a single test file
npx vitest run shared/engine/__tests__/shellGenerator.test.ts

# Database
npm run db:push          # Push schema to DB
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Drizzle Studio UI

# E2E (Playwright)
npx playwright test                          # All E2E tests
npx playwright test e2e/navigation.spec.ts   # Single spec
```

## Architecture

Monorepo with three layers sharing code via path aliases:

```
client/src/    →  React 19 + Vite 6 SPA          (alias: @/)
server/        →  Express API on port 5001         (no @/ alias, uses @shared/)
shared/        →  Schema, engine, types            (alias: @shared/)
```

**Frontend:** React 19, React Router DOM 7, Tailwind CSS 4, Framer Motion, Recharts, Lucide icons. 27 lazy-loaded route pages with manual vendor chunk splitting.

**Backend:** Express with Firebase Admin SDK auth middleware. All `/api/*` routes require Bearer token except `/api/health` and `/api/public/*`.

**Database:** PostgreSQL via Drizzle ORM (25 tables). Schema lives in `shared/schema/db.ts`.

**Auth flow:** Firebase Google OAuth on client → Bearer token in every API call → `server/middleware/auth.ts` verifies and attaches `req.user`.

## Key Architectural Patterns

### Shared Engine (`shared/engine/`)
Framework-agnostic business logic imported by both client and server:
- **shellGenerator.ts** — 13-rule engine converts scoping form → `LineItemShell[]` (modeling, travel, add-ons)
- **quoteTotals.ts** — `computeQuoteTotals()` with margin integrity: blocked <40%, warning 40-45%, passed ≥45%
- **prefillCascade.ts** — 49 declarative mappings auto-populate production stage fields from scoping data

### Path Aliases
- `@/` → `client/src/` (frontend only, configured in tsconfig.json + vite.config.ts)
- `@shared/` → `shared/` (both client and server)
- Server uses its own `tsconfig.server.json` with only `@shared/`

### API Layer
- Client API calls go through `client/src/services/api.ts` (centralized fetch wrapper)
- 22 route modules mounted in `server/routes.ts`
- Route files in `server/routes/` (scoping, quotes, proposals, production, scorecard, geo, qbo, scantech, pm-dashboard, financials, etc.)

### State Management
React hooks + context — no external state library. Key hooks:
- `useScopingForm` — form state, autosave (2s debounce), validation
- `useDealWorkspace` — quote CRUD, line items, pricing calculations
- `useAuth` — Firebase auth context

## Testing

**Unit tests (Vitest):** 5 test files in `shared/engine/__tests__/`:
- `prefillCascade.test.ts` (77 tests) — prefill mapping correctness
- `shellGenerator.test.ts` (29 tests) — line item generation rules
- `shellGenerator.edge.test.ts` (12 tests) — edge case coverage
- `quoteTotals.test.ts` (11 tests) — total calculations
- `quoteTotals.edge.test.ts` (9 tests) — edge case coverage

**E2E tests (Playwright):** 7 spec files in `e2e/` with mock API interception. Config: `playwright.config.ts` (Desktop Chrome + iPhone 13).

**Note:** `client/src/engine/pricing.test.ts` is a legacy empty file — "No test suite found" is expected and excluded from vitest via config.

## External Integrations

| Service | SDK | Purpose |
|---------|-----|---------|
| Firebase | Admin SDK (server) + Web SDK (client) | Auth (Google OAuth) + storage browsing |
| GCS | `@google-cloud/storage` (server) | File uploads, 4-bucket architecture |
| Google Maps | `@vis.gl/react-google-maps` + Distance Matrix API | Address geocoding, travel calculation |
| Gemini AI | `@google/generative-ai` | KB chat, AI editing, extraction |
| QuickBooks | OAuth2 REST API | Estimate/invoice sync |
| SendGrid | Nodemailer transport | Proposal email delivery |

## Environment Variables

Required: `DATABASE_URL`, `VITE_FIREBASE_*` (6 vars), `GCS_BUCKET`

Optional: `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `QBO_CLIENT_ID`/`QBO_CLIENT_SECRET`, `SENDGRID_API_KEY`, `ANTHROPIC_API_KEY`

See `.env.example` for the full template.

## Deployment

- **Frontend:** Firebase Hosting (`firebase deploy --only hosting`) → `s2px.web.app`
- **Backend:** Cloud Run (`gcloud run deploy s2px-api ...`)
- **Critical:** Always use `--update-env-vars` (additive), never `--set-env-vars` (replaces ALL vars)
- Firebase Hosting rewrites `/api/**` to Cloud Run in production (single origin)
- `firebase.json` target is `"s2p-studio"` — this is intentional (legacy hosting target name, UI is fully rebranded)

## Brand

- **Name:** Scan2Plan OS X (S2PX), version vX.1
- Sidebar: `S2P` + blue `X` accent; Header: `SCAN2PLAN OS X` monospace uppercase
