# S2P Studio — AI Studio Prompts (Chunked)

Paste these one at a time into your AI Studio project. Wait for each to complete before sending the next.

---

## PROMPT 1: Project Setup + Layout

```
Create a React 19 + TypeScript + Vite app called "Scan2Plan Studio".

Tech stack: Tailwind CSS v4, lucide-react icons, motion (framer-motion), Recharts.

Layout:
- Dark sidebar (#0F172A) on the left with navigation links and "S2P" logo text at top
- Light main content area
- Sticky header with page title
- Font: Inter

Sidebar nav items (use lucide-react icons):
1. Dashboard (LayoutDashboard icon) → /dashboard
2. Pipeline (Kanban icon) → /pipeline
3. Production (HardHat icon) → /production
4. Quotes (Calculator icon) → /quotes
5. Customers (Users icon) → /customers
6. Revenue (TrendingUp icon) → /revenue
7. Knowledge (BookOpen icon) → /knowledge
8. Settings (Settings icon) → /settings

Add a Login page at / that has username + password fields with blue (#2563EB) submit button. Use React Router for navigation. Protect all routes except login behind an AuthContext that checks if the user is logged in.

Brand colors: blue primary #2563EB, dark sidebar #0F172A, slate-100 backgrounds.
Make it look premium — glassmorphism cards, subtle shadows, smooth page transitions with motion.
```

---

## PROMPT 2: API Service Layer + Dashboard

```
Now add an API service layer. Create src/services/api.ts with:

const BASE_URL = 'https://s2p-staging-238833520624.us-east4.run.app';

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

Export these functions:
- login(username, password) → POST /api/login
- fetchPublicStats() → GET /api/stats/public
- checkHealth() → GET /api/health
- fetchLeads() → GET /api/leads
- fetchProjects() → GET /api/projects
- fetchProducts() → GET /api/products
- createLead(data) → POST /api/leads

The /api/stats/public endpoint returns:
{ leads: { total, active, closed_won, pipeline_count, pipeline_value }, customers: { unique_clients }, projects: { total, active, delivered }, revenue: { all_time, ytd }, updated_at }

Now build the Dashboard page:
- 6 KPI cards in a grid: Total Leads, Pipeline Value ($), Active Projects, Revenue YTD ($), Revenue All-Time ($), Unique Clients
- Fetch data from fetchPublicStats()
- Format currency values with $ and commas
- Cards should have glassmorphism styling, blue accent borders
- Add a "Backend Status" indicator that calls checkHealth() and shows green/red dot
```

---

## PROMPT 3: Pipeline + Production Boards

```
Build the Pipeline page:
- Kanban board with 6 columns: Leads, Contacted, Proposal, Negotiation, Won, Lost
- Fetch leads from fetchLeads() and group by dealStage field
- Lead cards show: clientName, projectAddress, value
- Column headers show count of leads in each stage
- Cards have subtle hover effect and shadow
- Won column cards have green left border, Lost have red

Build the Production page:
- Kanban board with 6 columns: Scheduling, Scanning, Registration, Modeling, QC, Delivered
- Fetch projects from fetchProjects() and group by status field
- Project cards show: address, clientName, projectCode, scanDate
- Delivered column cards have green left border
- Each column header shows count

Both boards use horizontal scroll on narrow screens.
```

---

## PROMPT 4: Gemini AI Chat Widget

```
Add a floating Gemini AI chat widget available on every page.

Use @google/genai SDK:
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

Inject the API key at build time in vite.config.ts:
define: { 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) }

Chat widget specs:
- Floating blue button (MessageCircle icon) in bottom-right corner
- Expands to a chat panel (400px wide, 500px tall)
- Message list with user/assistant bubbles
- Text input with send button
- System prompt: "You are the S2P Operator, the AI assistant for Scan2Plan — a 3D laser scanning and BIM modeling company. You help manage leads, track projects, and answer questions about scan-to-BIM workflows. Be concise and actionable."
- Model: gemini-2.5-flash-preview-05-20
- Add a "Reasoning" toggle that switches to gemini-2.5-pro model
- Function calling tool: createLead with params { clientName: string, projectAddress: string, sqft: number, notes: string }
- When createLead is called, use the api service to POST /api/leads and show confirmation in chat
```

---

## PROMPT 5: Remaining Pages

```
Build these remaining pages:

Quote Builder (/quotes):
- Product grid from fetchProducts()
- Each product card has name, sku, category, unitPrice, and a quantity input
- "Add to Quote" button per product
- Running total at bottom
- "Submit Quote" button

Customers (/customers):
- Simple card grid placeholder — show "Connected to Cloud SQL" message
- Will be populated when customer endpoint is wired

Revenue (/revenue):
- Bar chart (Recharts) showing monthly revenue
- For now, use the stats from fetchPublicStats() to show:
  - Revenue YTD vs All-Time comparison bar
  - Active vs Delivered projects pie chart
- Stats cards: All-Time Revenue, YTD Revenue, Pipeline Value

Knowledge (/knowledge):
- Chat interface similar to NotebookLM
- Text area to paste source documents
- Ask questions grounded in pasted content via Gemini
- Source attribution in responses

Settings (/settings):
- Backend health card: calls checkHealth(), shows status, database connectivity, uptime
- Integration status card: calls /api/health/integrations, shows each service status
- Account info: display "chase@scan2plan.io" and "scan2plan-internal" project
```
