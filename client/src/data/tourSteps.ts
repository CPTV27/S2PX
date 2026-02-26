export interface TourStep {
    /** Unique step identifier */
    id: string;
    /** Route to navigate to before showing this step */
    route: string;
    /** CSS selector for the element to spotlight */
    target: string;
    /** Tooltip title */
    title: string;
    /** Tooltip description */
    description: string;
    /** Preferred tooltip position relative to target */
    position: 'top' | 'bottom' | 'left' | 'right';
    /** Optional delay in ms after navigation before showing (for page load) */
    delay?: number;
}

export const TOUR_STEPS: TourStep[] = [
    // -- Welcome --
    {
        id: 'sidebar-logo',
        route: '/dashboard',
        target: '[data-tour="sidebar-logo"]',
        title: 'Welcome to S2PX',
        description: 'Your operations command center. The sidebar gives you one-click access to every module — from lead intake to final delivery.',
        position: 'right',
    },
    // -- Dashboard --
    {
        id: 'nav-dashboard',
        route: '/dashboard',
        target: '[data-tour="nav-dashboard"]',
        title: 'Dashboard',
        description: 'Your KPI overview — total leads, active projects, MTD revenue, and win rate at a glance.',
        position: 'right',
    },
    {
        id: 'kpi-cards',
        route: '/dashboard',
        target: '[data-tour="kpi-cards"]',
        title: 'KPI Cards',
        description: 'Real-time metrics pulled from your pipeline. These update automatically as deals move through stages.',
        position: 'bottom',
        delay: 400,
    },
    // -- Pipeline --
    {
        id: 'nav-pipeline',
        route: '/dashboard/pipeline',
        target: '[data-tour="nav-pipeline"]',
        title: 'Sales Pipeline',
        description: '8-stage Kanban board. Drag deals between columns to update status. Click any card to open its full deal workspace.',
        position: 'right',
    },
    {
        id: 'pipeline-board',
        route: '/dashboard/pipeline',
        target: '[data-tour="pipeline-board"]',
        title: 'Kanban Board',
        description: 'Each column represents a stage: Lead → Contacted → Qualified → Proposal → Negotiation → In Hand → Won / Lost.',
        position: 'bottom',
        delay: 500,
    },
    // -- Production --
    {
        id: 'nav-production',
        route: '/dashboard/production',
        target: '[data-tour="nav-production"]',
        title: 'Production Pipeline',
        description: '6-stage production tracker: Pre-Scan → Scanning → Registration → Modeling → QC → Delivery. Manage every scan project here.',
        position: 'right',
    },
    // -- Archive --
    {
        id: 'nav-archive',
        route: '/dashboard/projects',
        target: '[data-tour="nav-archive"]',
        title: 'Project Archive',
        description: 'Searchable history of all projects with status tracking, GCS storage analytics, and quick access to scoping data.',
        position: 'right',
    },
    // -- Revenue --
    {
        id: 'nav-revenue',
        route: '/dashboard/revenue',
        target: '[data-tour="nav-revenue"]',
        title: 'Revenue Dashboard',
        description: 'Monthly revenue charts from won deals. Track growth trends, compare periods, and identify your top-performing segments.',
        position: 'right',
    },
    // -- Scorecard --
    {
        id: 'nav-scorecard',
        route: '/dashboard/scorecard',
        target: '[data-tour="nav-scorecard"]',
        title: 'Executive Scorecard',
        description: '4-tab reporting suite: Overview, Pipeline, Production, and Profitability — with SQL-backed aggregations and Recharts visualizations.',
        position: 'right',
    },
    // -- Knowledge Base --
    {
        id: 'nav-knowledge',
        route: '/dashboard/knowledge',
        target: '[data-tour="nav-knowledge"]',
        title: 'Knowledge Base',
        description: '4-part content library with full-text search and Gemini AI chat. Your team\'s operational playbook, always up to date.',
        position: 'right',
    },
    // -- Cloud Storage --
    {
        id: 'nav-storage',
        route: '/dashboard/storage',
        target: '[data-tour="nav-storage"]',
        title: 'Cloud Storage',
        description: 'Browse your Google Cloud Storage buckets — point clouds, BIM files, project photos, and deliverables organized by project.',
        position: 'right',
    },
    // -- Settings --
    {
        id: 'nav-settings',
        route: '/dashboard/settings',
        target: '[data-tour="nav-settings"]',
        title: 'Settings',
        description: 'System health dashboard and configuration. Check backend, Firestore, GCS, and Gemini connections. Edit proposal templates here.',
        position: 'right',
    },
    // -- Header: Search --
    {
        id: 'search-button',
        route: '/dashboard',
        target: '[data-tour="search-button"]',
        title: 'Quick Search',
        description: 'Press \u2318K anywhere to instantly search the Knowledge Base. Find answers, procedures, and reference material in seconds.',
        position: 'bottom',
    },
    // -- Chat Widget --
    {
        id: 'chat-widget',
        route: '/dashboard',
        target: '[data-tour="chat-widget"]',
        title: 'AI Operator',
        description: 'Your Gemini-powered assistant. Create leads by conversation, get pricing guidance, or ask operational questions anytime.',
        position: 'left',
        delay: 300,
    },
];

export const TOUR_STORAGE_KEY = 's2px-tour-completed';
