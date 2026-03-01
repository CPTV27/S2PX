// ── S2PX Role-Based Permissions ──
// Simple role-to-routes map. Not a full RBAC system — just
// controls which sidebar items, routes, and API groups each role can access.

export type AppRole = 'ceo' | 'admin' | 'user' | 'scantech' | 'viewer';

export const APP_ROLES: AppRole[] = ['ceo', 'admin', 'user', 'scantech', 'viewer'];

export const ROLE_LABELS: Record<AppRole, string> = {
    ceo: 'CEO',
    admin: 'Admin',
    user: 'User',
    scantech: 'Scan Tech',
    viewer: 'Viewer',
};

// ── Sidebar navigation access ──
// Keys match the `path` values in DashboardLayout navItems

export const ROLE_NAV_ACCESS: Record<AppRole, string[]> = {
    ceo: [
        '/dashboard',
        '/dashboard/pipeline',
        '/dashboard/production',
        '/dashboard/projects',
        '/dashboard/revenue',
        '/dashboard/scorecard',
        '/dashboard/knowledge',
        '/dashboard/storage',
        '/dashboard/settings',
    ],
    admin: [
        '/dashboard',
        '/dashboard/pipeline',
        '/dashboard/production',
        '/dashboard/projects',
        '/dashboard/scorecard',
        '/dashboard/knowledge',
        '/dashboard/storage',
        '/dashboard/settings',
    ],
    user: [
        '/dashboard',
        '/dashboard/pipeline',
        '/dashboard/production',
        '/dashboard/projects',
        '/dashboard/knowledge',
        '/dashboard/storage',
        '/dashboard/settings',
    ],
    scantech: [], // No dashboard — redirect to /scantech
    viewer: [
        '/dashboard',
        '/dashboard/production',
        '/dashboard/projects',
        '/dashboard/scorecard',
    ],
};

// ── Route prefix access ──
// Controls which URL prefixes each role can navigate to.
// CEO uses '*' wildcard for full access.

export const ROLE_ROUTE_ACCESS: Record<AppRole, string[]> = {
    ceo: ['*'],
    admin: [
        '/dashboard',
        '/scantech',
        '/field',
    ],
    user: [
        '/dashboard',
        '/scantech',
        '/field',
    ],
    scantech: ['/scantech', '/field'],
    viewer: [
        '/dashboard',
    ],
};

// Routes that specific roles are BLOCKED from (overrides prefix access)
export const ROLE_ROUTE_DENY: Partial<Record<AppRole, string[]>> = {
    admin: ['/dashboard/revenue'],
    user: ['/dashboard/revenue', '/dashboard/scorecard'],
    viewer: [
        '/dashboard/revenue',
        '/dashboard/pipeline',
        '/dashboard/knowledge',
        '/dashboard/storage',
        '/dashboard/settings',
        '/dashboard/scoping',
        '/dashboard/deals',
        '/dashboard/proposals',
    ],
};

export function canAccessRoute(role: AppRole, path: string): boolean {
    const allowed = ROLE_ROUTE_ACCESS[role];
    if (!allowed) return false;
    if (allowed.includes('*')) return true;

    // Check deny list first
    const denied = ROLE_ROUTE_DENY[role];
    if (denied?.some((d) => path === d || path.startsWith(d + '/'))) {
        return false;
    }

    return allowed.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

export function canAccessNav(role: AppRole, navPath: string): boolean {
    return ROLE_NAV_ACCESS[role]?.includes(navPath) ?? false;
}

// ── API-level access groups ──
// Maps API feature groups to which roles can use them.

export const ROLE_API_ACCESS: Record<string, AppRole[]> = {
    revenue: ['ceo'],
    scorecard: ['ceo', 'admin', 'viewer'],
    'user-management': ['ceo', 'admin'],
    'quotes:write': ['ceo', 'admin'],
    'proposals:write': ['ceo', 'admin'],
    'production:advance': ['ceo', 'admin'],
    'scantech:tokens': ['ceo', 'admin'],
};

export function canAccessApi(role: AppRole, group: string): boolean {
    const roles = ROLE_API_ACCESS[group];
    if (!roles) return true; // No restriction defined → allow
    return roles.includes(role);
}

// ── Default redirect for each role ──
// Where to send a user after login or when accessing a blocked route.

export const ROLE_DEFAULT_ROUTE: Record<AppRole, string> = {
    ceo: '/dashboard',
    admin: '/dashboard',
    user: '/dashboard',
    scantech: '/scantech',
    viewer: '/dashboard',
};
