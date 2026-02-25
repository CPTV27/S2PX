// ── S2P Backend API Service ──
// All fetch calls to the existing Scan2Plan Express backend.
// In dev, Vite proxies /api → localhost:5000.
// In production, calls go directly to the Cloud Run backend.

import type { Lead, Project, Quote, Product, User, KpiStats, ScanRecord, GcsProjectFolder, GcsFolderEntry, ProjectAnalytics } from '../types';

// In dev, Vite proxies /api → localhost:5000.
// In production, Firebase Hosting rewrites /api/** → Cloud Run (same-origin).
const BASE_URL = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
        credentials: 'include', // session cookies
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `API Error: ${res.status}`);
    }

    return res.json();
}

// ── Auth ──
export async function login(username: string, password: string): Promise<User> {
    return request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function logout(): Promise<void> {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
}

export async function getCurrentUser(): Promise<User | null> {
    try {
        return await request('/api/user');
    } catch {
        return null;
    }
}

// ── Leads ──
export async function fetchLeads(): Promise<Lead[]> {
    return request('/api/leads');
}

export async function fetchLead(id: number): Promise<Lead> {
    return request(`/api/leads/${id}`);
}

export async function createLead(data: Partial<Lead>): Promise<Lead> {
    return request('/api/leads', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
    return request(`/api/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

// ── Projects ──
export async function fetchProjects(): Promise<Project[]> {
    return request('/api/projects');
}

export async function fetchProject(id: number): Promise<Project> {
    return request(`/api/projects/${id}`);
}

// ── CPQ / Products ──
export async function fetchProducts(): Promise<Product[]> {
    return request('/api/products');
}

export async function fetchQuotes(leadId?: number): Promise<Quote[]> {
    const url = leadId ? `/api/cpq/quotes?leadId=${leadId}` : '/api/cpq/quotes';
    return request(url);
}

export async function createQuote(data: Partial<Omit<Quote, 'id' | 'createdAt'>>): Promise<Quote> {
    return request('/api/cpq/quotes', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export interface PricingRequest {
    areas: { squareFootage: number; buildingType: string; lodLevel: string; disciplines: string[] }[];
    distance?: number;
    paymentTerms?: string;
    risks?: string[];
    multipliers?: string[];
}

export interface PricingResponse {
    lineItems: { service: string; vendorCost: number; clientPrice: number }[];
    totalCOGS: number;
    totalClientPrice: number;
    cogsMultiplier: number;
}

export async function calculatePricing(data: PricingRequest): Promise<PricingResponse> {
    return request('/api/cpq/calculate-pricing', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ── Dashboard KPIs ──
export async function fetchKpiStats(): Promise<KpiStats> {
    try {
        const [leads, projects] = await Promise.all([
            fetchLeads(),
            fetchProjects(),
        ]);

        const totalLeads = leads.length;
        const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
        const wonLeads = leads.filter(l => l.status === 'won');
        const closedLeads = leads.filter(l => l.status === 'won' || l.status === 'lost');
        const winRate = closedLeads.length > 0 ? Math.round((wonLeads.length / closedLeads.length) * 100) : 0;
        const revenueMTD = wonLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

        return { totalLeads, activeProjects, revenueMTD, winRate };
    } catch {
        return { totalLeads: 0, activeProjects: 0, revenueMTD: 0, winRate: 0 };
    }
}

// ── Scan Intelligence (Field App Integration) ──

const FIELD_APP_URL = import.meta.env.VITE_FIELD_APP_URL || '';

/**
 * Fetch completed time logs from the Scantech field app (S2P-S-P-v2 backend).
 * Transforms raw time logs + project data into ScanRecord format.
 * Returns empty array if the field app is not configured or unreachable.
 */
export async function fetchScanRecordsFromFieldApp(): Promise<ScanRecord[]> {
    if (!FIELD_APP_URL) return [];

    try {
        const [timeLogs, projects] = await Promise.all([
            fetch(`${FIELD_APP_URL}/api/time-logs`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
            fetch(`${FIELD_APP_URL}/api/projects`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
        ]);

        // Group time logs by project and aggregate
        const projectMap = new Map<number, any>(projects.map((p: any) => [p.id, p]));
        const logsByProject = new Map<number, any[]>();

        for (const log of timeLogs) {
            if (!logsByProject.has(log.projectId)) logsByProject.set(log.projectId, []);
            logsByProject.get(log.projectId)!.push(log);
        }

        const records: ScanRecord[] = [];
        for (const [projectId, logs] of logsByProject) {
            const project = projectMap.get(projectId);
            if (!project || !project.actualSqft) continue;

            const scanLogs = logs.filter((l: any) => l.workType === 'Scanning');
            const travelLogs = logs.filter((l: any) => l.workType === 'Travel');
            const totalScanMinutes = scanLogs.reduce((s: number, l: any) => s + (l.totalSiteMinutes || 0), 0);
            const scanDays = Math.ceil(totalScanMinutes / 480); // 8-hour days

            records.push({
                id: `field-${projectId}`,
                projectName: project.name || `Project ${projectId}`,
                buildingType: project.buildingType || 'Commercial',
                squareFootage: project.actualSqft || project.estimatedSqft || 0,
                numFloors: 1, // Field app doesn't track this yet
                scanDays: Math.max(scanDays, 1),
                totalScanMinutes,
                travelDays: travelLogs.length > 0 ? Math.ceil(travelLogs.reduce((s: number, l: any) => s + (l.totalSiteMinutes || 0), 0) / 480) : 0,
                numScanPositions: scanLogs.length, // Each scan log ≈ 1 position session
                deliverableType: project.targetLoD || 'BIM LOD300',
                complexity: 'Medium',
                completedDate: logs[logs.length - 1]?.createdAt || new Date().toISOString(),
            });
        }

        return records;
    } catch (error) {
        console.warn('Field app not reachable:', error);
        return [];
    }
}

// ── GCS Project Sidecar Browsing ──

export async function fetchGcsProjectFolders(bucket?: string): Promise<GcsProjectFolder[]> {
    const params = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';
    return request(`/api/projects/gcs/folders${params}`);
}

export async function fetchGcsFolderContents(bucket: string, path: string): Promise<GcsFolderEntry[]> {
    return request(`/api/projects/gcs/browse?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`);
}

export async function getGcsDownloadUrl(bucket: string, path: string): Promise<{ url: string }> {
    return request(`/api/projects/gcs/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`);
}

export async function fetchGcsAnalytics(bucket?: string): Promise<ProjectAnalytics> {
    const params = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';
    return request(`/api/projects/gcs/analytics${params}`);
}

// ── Health ──
export async function checkHealth(): Promise<{ status: string }> {
    return request('/api/health');
}
