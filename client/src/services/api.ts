// ── S2P Backend API Service ──
// All fetch calls to the Scan2Plan Express backend.
// In dev, Vite proxies /api → localhost:5000.
// In production, Firebase Hosting rewrites /api/** → Cloud Run (same-origin).

import type { Lead, Project, Quote, Product, User, KpiStats, ScanRecord, GcsProjectFolder, GcsFolderEntry, ProjectAnalytics, ProjectDetailResponse } from '../types';
import { auth } from '@/services/firebase';
import { signOut } from 'firebase/auth';

const BASE_URL = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
    };

    // Attach Firebase ID token as Bearer auth
    const token = await auth.currentUser?.getIdToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${url}`, {
        headers,
        ...options,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `API Error: ${res.status}`);
    }

    return res.json();
}

// ── Auth ──

export async function logout(): Promise<void> {
    await signOut(auth);
}

export async function fetchCurrentUser(): Promise<User | null> {
    try {
        return await request('/api/auth/user');
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

export async function fetchProjectDetail(id: number): Promise<ProjectDetailResponse> {
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

// ── Scoping Forms ──

export interface ScopingFormData {
    id?: number;
    upid?: string;
    status?: string;
    clientCompany: string;
    projectName: string;
    projectAddress: string;
    projectLat?: string | null;
    projectLng?: string | null;
    buildingFootprintSqft?: number | null;
    specificBuilding?: string;
    email: string;
    primaryContactName: string;
    contactEmail: string;
    contactPhone?: string;
    billingSameAsPrimary?: boolean;
    billingContactName?: string;
    billingEmail?: string;
    billingPhone?: string;
    numberOfFloors: number;
    basementAttic?: string[];
    estSfBasementAttic?: number;
    insuranceRequirements?: string;
    landscapeModeling?: string;
    landscapeAcres?: number;
    landscapeTerrain?: string;
    bimDeliverable: string;
    bimVersion?: string;
    customTemplate?: boolean;
    templateFileUrl?: string;
    georeferencing: boolean;
    era: string;
    roomDensity: number;
    riskFactors: string[];
    scanRegOnly?: string;
    expedited: boolean;
    dispatchLocation: string;
    oneWayMiles: number;
    travelMode: string;
    customTravelCost?: number;
    mileageRate?: number;
    scanDayFeeOverride?: number;
    estTimeline?: string;
    projectTimeline?: string;
    timelineNotes?: string;
    paymentTerms?: string;
    paymentNotes?: string;
    sfAssumptionsUrl?: string;
    sqftAssumptionsNote?: string;
    scopingDocsUrls?: string[];
    internalNotes?: string;
    customScope?: string;
    leadSource: string;
    sourceNote?: string;
    marketingInfluence?: string[];
    proofLinks?: string;
    probability: number;
    dealStage: string;
    priority: number;
    // CEO sections
    pricingTier?: string;
    bimManager?: string;
    scannerAssignment?: string;
    estScanDays?: number;
    techsPlanned?: number;
    mOverride?: number;
    whaleScanCost?: number;
    whaleModelCost?: number;
    assumedSavingsM?: number;
    caveatsProfitability?: string;
    areas?: ScopeAreaData[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ScopeAreaData {
    id?: number;
    scopingFormId?: number;
    areaType: string;
    areaName?: string;
    squareFootage: number;
    projectScope: string;
    lod: string;
    mixedInteriorLod?: string;
    mixedExteriorLod?: string;
    structural?: { enabled: boolean; sqft?: number };
    mepf?: { enabled: boolean; sqft?: number };
    cadDeliverable: string;
    act?: { enabled: boolean; sqft?: number };
    belowFloor?: { enabled: boolean; sqft?: number };
    customLineItems?: { description: string; amount: number }[];
    sortOrder?: number;
}

export async function fetchScopingForms(filters?: { status?: string; dealStage?: string }): Promise<ScopingFormData[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.dealStage) params.set('dealStage', filters.dealStage);
    const qs = params.toString();
    return request(`/api/scoping${qs ? `?${qs}` : ''}`);
}

export async function fetchScopingForm(id: number): Promise<ScopingFormData> {
    return request(`/api/scoping/${id}`);
}

export async function createScopingForm(data: Partial<ScopingFormData>): Promise<ScopingFormData> {
    return request('/api/scoping', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateScopingForm(id: number, data: Partial<ScopingFormData>): Promise<ScopingFormData> {
    return request(`/api/scoping/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteScopingForm(id: number): Promise<void> {
    await request(`/api/scoping/${id}`, { method: 'DELETE' });
}

export async function addScopeArea(formId: number, data: Partial<ScopeAreaData>): Promise<ScopeAreaData> {
    return request(`/api/scoping/${formId}/areas`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateScopeArea(formId: number, areaId: number, data: Partial<ScopeAreaData>): Promise<ScopeAreaData> {
    return request(`/api/scoping/${formId}/areas/${areaId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteScopeArea(formId: number, areaId: number): Promise<void> {
    await request(`/api/scoping/${formId}/areas/${areaId}`, { method: 'DELETE' });
}

export async function uploadFile(file: File, upid: string, fieldName: string): Promise<{ url: string; path: string; filename: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upid', upid);
    formData.append('fieldName', fieldName);

    const headers: Record<string, string> = {};
    const token = await auth.currentUser?.getIdToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/uploads', {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `Upload failed: ${res.status}`);
    }

    return res.json();
}

// ── Quotes (Phase 3 — CEO Pricing) ──

export interface QuoteData {
    id?: number;
    scopingFormId: number;
    lineItems: import('@shared/types/lineItem').LineItemShell[];
    totals?: import('@shared/types/lineItem').QuoteTotals | null;
    integrityStatus?: string | null;
    version?: number;
    createdAt?: string;
    updatedAt?: string;
}

export async function createQuoteDeal(data: {
    scopingFormId: number;
    lineItems: import('@shared/types/lineItem').LineItemShell[];
    totals?: import('@shared/types/lineItem').QuoteTotals | null;
    integrityStatus?: string | null;
}): Promise<QuoteData> {
    return request('/api/quotes', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchQuoteDeal(id: number): Promise<QuoteData> {
    return request(`/api/quotes/${id}`);
}

export async function fetchQuotesByForm(formId: number): Promise<QuoteData[]> {
    return request(`/api/quotes/by-form/${formId}`);
}

export async function updateQuoteDeal(id: number, data: {
    lineItems?: import('@shared/types/lineItem').LineItemShell[];
    totals?: import('@shared/types/lineItem').QuoteTotals | null;
    integrityStatus?: string | null;
}): Promise<QuoteData> {
    return request(`/api/quotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

// ── Proposals (Phase 4) ──

export interface ProposalSummary {
    id: number;
    status: string;
    version: number;
    sentTo?: string | null;
    sentAt?: string | null;
    viewedAt?: string | null;
    respondedAt?: string | null;
    createdAt: string;
    accessToken?: string;
    pdfSize?: number;
}

export async function generateProposal(quoteId: number, customMessage?: string, templateId?: number): Promise<ProposalSummary> {
    return request(`/api/proposals/${quoteId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ customMessage, templateId }),
    });
}

export async function sendProposal(proposalId: number, email?: string): Promise<{ sent: boolean; to: string }> {
    return request(`/api/proposals/${proposalId}/send`, {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

export async function fetchProposalStatus(quoteId: number): Promise<ProposalSummary[]> {
    return request(`/api/proposals/${quoteId}/status`);
}

// ── QuickBooks Online (Phase 5) ──

export interface QBOStatus {
    configured: boolean;
    connected: boolean;
    realmId?: string | null;
    environment?: string;
    error?: string;
}

export interface QBOEstimateInfo {
    synced: boolean;
    estimateId?: string;
    estimateNumber?: string;
    customerId?: string;
    invoiceId?: string;
    syncedAt?: string;
    estimateUrl?: string | null;
    estimateStatus?: string | null;
    connected?: boolean;
}

export async function fetchQBOStatus(): Promise<QBOStatus> {
    return request('/api/qbo/status');
}

export async function startQBOAuth(): Promise<{ authUrl: string }> {
    return request('/api/qbo/auth');
}

export async function disconnectQBO(): Promise<{ message: string }> {
    return request('/api/qbo/disconnect', { method: 'POST' });
}

export async function createQBOEstimate(quoteId: number, forceResync?: boolean): Promise<{
    message: string;
    estimateId: string;
    estimateNumber: string;
    customerId: string;
    totalAmount: number;
}> {
    return request(`/api/qbo/estimate/${quoteId}`, {
        method: 'POST',
        body: JSON.stringify({ forceResync }),
    });
}

export async function fetchQBOEstimate(quoteId: number): Promise<QBOEstimateInfo> {
    return request(`/api/qbo/estimate/${quoteId}`);
}

export async function convertQBOToInvoice(quoteId: number): Promise<{
    message: string;
    invoiceId: string;
    invoiceNumber: string;
}> {
    return request(`/api/qbo/invoice/${quoteId}`, { method: 'POST' });
}

export async function emailQBOEstimate(quoteId: number, email?: string): Promise<{ message: string }> {
    return request(`/api/qbo/email-estimate/${quoteId}`, {
        method: 'POST',
        body: JSON.stringify({ email }),
    });
}

// ── Production Pipeline (Phase 6) ──

export interface ProductionProjectData {
    id: number;
    scopingFormId: number;
    upid: string;
    currentStage: string;
    stageData: Record<string, Record<string, unknown>>;
    createdAt: string;
    updatedAt: string;
    projectName?: string;
    clientCompany?: string;
    projectAddress?: string;
    assetCount?: number;
}

export interface PrefillResultData {
    field: string;
    value: unknown;
    mapping: {
        targetId: string;
        targetField: string;
        sourceId: string;
        type: string;
        description: string;
    };
    skipped: boolean;
    skipReason?: string;
}

export interface AdvanceResult {
    project: ProductionProjectData;
    prefillResults: PrefillResultData[];
    advancedFrom: string;
    advancedTo: string;
}

export interface StageSummary {
    current_stage: string;
    count: number;
}

export async function fetchProductionProjects(stage?: string): Promise<ProductionProjectData[]> {
    const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
    return request(`/api/production${qs}`);
}

export async function fetchProductionProject(id: number): Promise<ProductionProjectData> {
    return request(`/api/production/${id}`);
}

export async function createProductionProject(scopingFormId: number): Promise<ProductionProjectData> {
    return request('/api/production', {
        method: 'POST',
        body: JSON.stringify({ scopingFormId }),
    });
}

export async function updateProductionProject(id: number, stageUpdates: Record<string, unknown>): Promise<ProductionProjectData> {
    return request(`/api/production/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stageUpdates }),
    });
}

export async function advanceProductionStage(id: number): Promise<AdvanceResult> {
    return request(`/api/production/${id}/advance`, { method: 'POST' });
}

export async function previewProductionAdvance(id: number): Promise<{
    fromStage: string;
    toStage: string;
    prefillData: Record<string, unknown>;
    results: PrefillResultData[];
}> {
    return request(`/api/production/${id}/preview-advance`);
}

export async function fetchProductionStageSummary(): Promise<StageSummary[]> {
    return request('/api/production/summary/stages');
}

// ── Project Assets (Phase 8) ──

export interface ProjectAsset {
    id: number;
    productionProjectId: number;
    bucket: string;
    gcsPath: string;
    label: string | null;
    assetType: string;
    fileCount: number | null;
    totalSizeBytes: string | null;
    linkedAt: string;
    linkedBy: string | null;
}

export interface AssetBrowseResult {
    basePath: string;
    currentPath: string;
    folders: { name: string; path: string; type: 'folder' }[];
    files: {
        name: string;
        path: string;
        type: 'file';
        size: number;
        contentType: string;
        updated: string | null;
    }[];
}

export async function fetchProjectAssets(projectId: number): Promise<ProjectAsset[]> {
    return request(`/api/production/${projectId}/assets`);
}

export async function linkProjectAsset(projectId: number, data: {
    bucket: string;
    gcsPath: string;
    label?: string;
    assetType?: string;
}): Promise<ProjectAsset> {
    return request(`/api/production/${projectId}/assets`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function refreshProjectAsset(projectId: number, assetId: number): Promise<ProjectAsset> {
    return request(`/api/production/${projectId}/assets/${assetId}/refresh`, {
        method: 'POST',
    });
}

export async function browseProjectAsset(projectId: number, assetId: number, path?: string): Promise<AssetBrowseResult> {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return request(`/api/production/${projectId}/assets/${assetId}/browse${qs}`);
}

export async function getAssetDownloadUrl(projectId: number, assetId: number, filePath: string): Promise<{ url: string; filename: string }> {
    return request(`/api/production/${projectId}/assets/${assetId}/download?path=${encodeURIComponent(filePath)}`);
}

export async function unlinkProjectAsset(projectId: number, assetId: number): Promise<{ message: string }> {
    return request(`/api/production/${projectId}/assets/${assetId}`, {
        method: 'DELETE',
    });
}

// ── Scorecard & Reporting (Phase 9) ──

export interface ScorecardFilters {
    months?: number;
    projectTier?: string;
    buildingType?: string;
    leadSource?: string;
}

function buildScorecardParams(filters?: ScorecardFilters): string {
    if (!filters) return '';
    const params = new URLSearchParams();
    if (filters.months) params.set('months', String(filters.months));
    if (filters.projectTier && filters.projectTier !== 'all') params.set('tier', filters.projectTier);
    if (filters.buildingType) params.set('buildingType', filters.buildingType);
    if (filters.leadSource) params.set('leadSource', filters.leadSource);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export async function fetchScorecardOverview(filters?: ScorecardFilters) {
    return request<import('@shared/types/scorecard').ScorecardOverview>(
        `/api/scorecard/overview${buildScorecardParams(filters)}`
    );
}

export async function fetchPipelineReport(filters?: ScorecardFilters) {
    return request<import('@shared/types/scorecard').PipelineReport>(
        `/api/scorecard/pipeline${buildScorecardParams(filters)}`
    );
}

export async function fetchProductionReport(filters?: ScorecardFilters) {
    return request<import('@shared/types/scorecard').ProductionReport>(
        `/api/scorecard/production${buildScorecardParams(filters)}`
    );
}

export async function fetchProfitabilityReport(filters?: ScorecardFilters) {
    return request<import('@shared/types/scorecard').ProfitabilityReport>(
        `/api/scorecard/profitability${buildScorecardParams(filters)}`
    );
}

// ── Upload Shares (Phase 12) ──

export interface UploadShareData {
    id: number;
    productionProjectId: number;
    token: string;
    label: string | null;
    targetBucket: string;
    targetPrefix: string;
    createdBy: string | null;
    expiresAt: string;
    maxUploadBytes: string | null;
    totalUploadedBytes: string | null;
    uploadCount: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    uploadUrl?: string;
}

export interface UploadShareFileData {
    id: number;
    shareId: number;
    filename: string;
    gcsPath: string;
    sizeBytes: string;
    contentType: string | null;
    uploadedByName: string | null;
    uploadedAt: string;
}

export async function createUploadShare(data: {
    projectId: number;
    label?: string;
    expiresInDays?: number;
    maxUploadBytes?: number;
}): Promise<UploadShareData> {
    return request('/api/upload-shares', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function fetchUploadShares(projectId: number): Promise<UploadShareData[]> {
    return request(`/api/upload-shares?projectId=${projectId}`);
}

export async function revokeUploadShare(id: number): Promise<{ message: string }> {
    return request(`/api/upload-shares/${id}`, { method: 'DELETE' });
}

export async function fetchUploadShareFiles(id: number): Promise<UploadShareFileData[]> {
    return request(`/api/upload-shares/${id}/files`);
}

// ── Proposal Templates (Phase 13) ──

export interface ProposalTemplateData {
    id: number;
    name: string;
    aboutScan2plan: string | null;
    whyScan2plan: string | null;
    capabilities: string | null;
    difference: string | null;
    bimStandardsIntro: string | null;
    paymentTermsDefault: string | null;
    sfAuditClause: string | null;
    contactEmail: string;
    contactPhone: string;
    footerText: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export async function fetchProposalTemplates(): Promise<ProposalTemplateData[]> {
    return request('/api/proposal-templates');
}

export async function fetchActiveProposalTemplate(): Promise<ProposalTemplateData> {
    return request('/api/proposal-templates/active');
}

export async function fetchProposalTemplate(id: number): Promise<ProposalTemplateData> {
    return request(`/api/proposal-templates/${id}`);
}

export async function createProposalTemplate(data: Partial<ProposalTemplateData>): Promise<ProposalTemplateData> {
    return request('/api/proposal-templates', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateProposalTemplate(id: number, data: Partial<ProposalTemplateData>): Promise<ProposalTemplateData> {
    return request(`/api/proposal-templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteProposalTemplate(id: number): Promise<{ message: string }> {
    return request(`/api/proposal-templates/${id}`, { method: 'DELETE' });
}

// ── Health ──
export async function checkHealth(): Promise<{ status: string }> {
    return request('/api/health');
}

// ── Knowledge Base ──
export interface KBSectionMeta {
    id: number;
    slug: string;
    title: string;
    emoji: string | null;
    partNumber: number | null;
    partTitle: string | null;
    sectionNumber: number | null;
    sortOrder: number;
    wordCount: number;
    version: number;
    editedBy: string | null;
    updatedAt: string;
}

export interface KBSection extends KBSectionMeta {
    content: string;
    contentPlain: string;
}

export interface KBSearchResult {
    id: number;
    slug: string;
    title: string;
    emoji: string | null;
    part_title: string | null;
    section_number: number | null;
    snippet: string;
    rank: number;
}

export async function fetchKBSections(): Promise<KBSectionMeta[]> {
    return request<KBSectionMeta[]>('/api/kb/sections');
}

export async function fetchKBSection(slug: string): Promise<KBSection> {
    return request<KBSection>(`/api/kb/sections/${slug}`);
}

export async function searchKB(q: string): Promise<{ results: KBSearchResult[] }> {
    return request<{ results: KBSearchResult[] }>(`/api/kb/search?q=${encodeURIComponent(q)}`);
}

export async function updateKBSection(slug: string, data: { content: string; editSummary: string; version: number; editedBy: string }): Promise<KBSection> {
    return request<KBSection>(`/api/kb/sections/${slug}`, { method: 'PUT', body: JSON.stringify(data) });
}

export interface KBChatResponse {
    response: string;
    citations: { slug: string; title: string }[];
    sources: { slug: string; title: string }[];
}

export async function sendKBChat(
    message: string,
    history?: { role: 'user' | 'model'; text: string }[],
    sectionSlugs?: string[]
): Promise<KBChatResponse> {
    return request<KBChatResponse>('/api/kb/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history, sectionSlugs }),
    });
}

export interface KBAIEditResponse {
    proposedContent: string;
    originalContent: string;
    sectionTitle: string;
}

export async function requestKBAIEdit(slug: string, instruction: string): Promise<KBAIEditResponse> {
    return request<KBAIEditResponse>(`/api/kb/sections/${slug}/ai-edit`, {
        method: 'POST',
        body: JSON.stringify({ instruction }),
    });
}

export interface KBEditHistoryEntry {
    id: number;
    editedBy: string;
    editSummary: string | null;
    version: number;
    createdAt: string;
}

export async function fetchKBHistory(slug: string): Promise<KBEditHistoryEntry[]> {
    return request<KBEditHistoryEntry[]>(`/api/kb/sections/${slug}/history`);
}

// ── Geo / Maps (Phase 11) ──

export interface GeoLookupResult {
    lat: number;
    lng: number;
    footprintSqft: number | null;
    formattedAddress: string;
    placeId: string | null;
}

export async function geoLookup(address: string, scopingFormId?: number): Promise<GeoLookupResult> {
    return request<GeoLookupResult>('/api/geo/lookup', {
        method: 'POST',
        body: JSON.stringify({ address, scopingFormId }),
    });
}

export async function geoBatch(scopingFormIds: number[]): Promise<{
    results: { id: number; status: string; lat?: number; lng?: number; footprintSqft?: number | null }[];
    processed: number;
}> {
    return request('/api/geo/batch', {
        method: 'POST',
        body: JSON.stringify({ scopingFormIds }),
    });
}

export interface DistanceResult {
    distanceMiles: number;
    durationMinutes: number;
    originAddress: string;
    destinationAddress: string;
}

export async function fetchDrivingDistance(origin: string, destination: string): Promise<DistanceResult> {
    return request<DistanceResult>('/api/geo/distance', {
        method: 'POST',
        body: JSON.stringify({ origin, destination }),
    });
}

// ── Financials (Phase 15 — QBO actual data) ──

import type {
    ActualRevenueData,
    PnlSummary,
    ExpenseSummaryData,
    QBOCustomerListData,
    EstimateConversionData,
    BalanceSheetData,
} from '@shared/types/financials';

export async function fetchActualRevenue(): Promise<ActualRevenueData> {
    return request('/api/financials/revenue-actual');
}

export async function fetchPnlSummary(): Promise<PnlSummary> {
    return request('/api/financials/pnl-summary');
}

export async function fetchExpensesSummary(): Promise<ExpenseSummaryData> {
    return request('/api/financials/expenses-summary');
}

export async function fetchQBOCustomers(): Promise<QBOCustomerListData> {
    return request('/api/financials/customers');
}

export async function fetchEstimateConversion(): Promise<EstimateConversionData> {
    return request('/api/financials/estimate-conversion');
}

export async function fetchBalanceSheet(): Promise<BalanceSheetData> {
    return request('/api/financials/balance-sheet');
}

// ── Team Chat (Phase 16) ──

export interface ChatChannel {
    id: number;
    name: string;
    displayName: string;
    description: string | null;
    emoji: string;
    isDefault: boolean;
    googleChatWebhookUrl: string | null;
    createdAt: string;
    updatedAt: string;
    recentCount?: number;
}

export interface TeamMessage {
    id: number;
    channelId: number;
    userId: number;
    content: string;
    messageType: string;
    parentId: number | null;
    editedAt: string | null;
    createdAt: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImageUrl: string | null;
}

export async function fetchChatChannels(): Promise<ChatChannel[]> {
    return request('/api/chat/channels');
}

export async function createChatChannel(data: {
    name: string;
    displayName: string;
    description?: string;
    emoji?: string;
}): Promise<ChatChannel> {
    return request('/api/chat/channels', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateChatChannel(id: number, data: Partial<ChatChannel>): Promise<ChatChannel> {
    return request(`/api/chat/channels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function fetchChannelMessages(channelId: number, before?: number): Promise<TeamMessage[]> {
    const qs = before ? `?before=${before}` : '';
    return request(`/api/chat/channels/${channelId}/messages${qs}`);
}

export async function pollChannelMessages(channelId: number, afterId: number): Promise<TeamMessage[]> {
    return request(`/api/chat/channels/${channelId}/messages/poll?after=${afterId}`);
}

export async function sendTeamMessage(channelId: number, data: {
    content: string;
    userId: number;
    parentId?: number;
}): Promise<TeamMessage> {
    return request(`/api/chat/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function editTeamMessage(id: number, content: string): Promise<TeamMessage> {
    return request(`/api/chat/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
    });
}

export async function deleteTeamMessage(id: number): Promise<{ success: boolean }> {
    return request(`/api/chat/messages/${id}`, { method: 'DELETE' });
}

export async function seedChatChannels(): Promise<ChatChannel[]> {
    return request('/api/chat/seed', { method: 'POST' });
}

// ═══════════════════════════════════════════════════════════════
// Scantech — Mobile Field Operations (Phase 18)
// ═══════════════════════════════════════════════════════════════

import type {
    ScantechProject,
    ScantechProjectDetail,
    ChecklistTemplate,
    ChecklistSubmission,
    ChecklistResponse,
    FieldUploadRecord,
    FieldNote,
    FileCategory,
    CaptureMethod,
    ScantechAIRequest,
    ScantechAIResponse,
    PMFieldSummary,
    FieldDownloadUrl,
} from '@shared/types/scantech';

// Re-export for convenience
export type {
    ScantechProject,
    ScantechProjectDetail,
    ChecklistTemplate,
    ChecklistSubmission,
    ChecklistResponse,
    FieldUploadRecord,
    FieldNote,
    FileCategory,
    CaptureMethod,
    ScantechAIRequest,
    ScantechAIResponse,
    PMFieldSummary,
    FieldDownloadUrl,
};

/** List projects in scheduling/field_capture stage */
export async function fetchScantechProjects(): Promise<ScantechProject[]> {
    return request('/api/scantech/projects');
}

/** Full project detail: scoping, checklists, uploads, notes */
export async function fetchScantechProject(id: number): Promise<ScantechProjectDetail> {
    return request(`/api/scantech/projects/${id}`);
}

/** Active checklist templates */
export async function fetchScantechChecklists(): Promise<ChecklistTemplate[]> {
    return request('/api/scantech/checklists');
}

/** Submit or autosave checklist responses */
export async function submitChecklistResponse(
    projectId: number,
    data: {
        checklistId: number;
        responses: ChecklistResponse[];
        status: 'in_progress' | 'complete' | 'flagged';
    },
): Promise<ChecklistSubmission> {
    return request(`/api/scantech/projects/${projectId}/checklist`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Generate GCS signed URL for direct-to-bucket upload */
export async function getFieldUploadSignedUrl(
    projectId: number,
    data: {
        filename: string;
        contentType: string;
        sizeBytes: number;
        fileCategory: FileCategory;
        captureMethod: CaptureMethod;
    },
): Promise<{ signedUrl: string; gcsPath: string; bucket: string }> {
    return request(`/api/scantech/projects/${projectId}/upload/signed-url`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Confirm upload completion and record in field_uploads table */
export async function confirmFieldUpload(
    projectId: number,
    data: {
        filename: string;
        gcsPath: string;
        bucket: string;
        sizeBytes: number;
        contentType: string;
        fileCategory: FileCategory;
        captureMethod: CaptureMethod;
        metadata?: Record<string, unknown>;
        notes?: string;
    },
): Promise<FieldUploadRecord> {
    return request(`/api/scantech/projects/${projectId}/upload/confirm`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Save field notes to stageData.scantech.notes */
export async function saveFieldNotes(
    projectId: number,
    notes: FieldNote[],
): Promise<{ success: boolean }> {
    return request(`/api/scantech/projects/${projectId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
    });
}

/** Gemini AI assistant — chat, photo analysis, audio-to-scoping, checklist validation */
export async function scantechAIAssist(
    data: ScantechAIRequest,
): Promise<ScantechAIResponse> {
    return request('/api/scantech/ai/assist', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ═══════════════════════════════════════════════════════════════
// PM Dashboard — Back-Office Field View (Phase 19)
// ═══════════════════════════════════════════════════════════════

/** Aggregated field summary for PM Mission Control */
export async function fetchPMFieldSummary(projectId: number): Promise<PMFieldSummary> {
    return request(`/api/pm/projects/${projectId}/field-summary`);
}

/** Full upload list with pagination */
export async function fetchPMUploads(
    projectId: number,
    opts?: { category?: string; limit?: number; offset?: number },
): Promise<{ uploads: FieldUploadRecord[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams();
    if (opts?.category) params.set('category', opts.category);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return request(`/api/pm/projects/${projectId}/uploads${qs ? `?${qs}` : ''}`);
}

/** Generate signed download URL for a field upload */
export async function getFieldDownloadUrl(
    projectId: number,
    uploadId: number,
): Promise<FieldDownloadUrl> {
    return request(`/api/pm/projects/${projectId}/uploads/${uploadId}/download`);
}

/** Generate signed thumbnail URL for a photo/video upload */
export async function getFieldThumbnailUrl(
    projectId: number,
    uploadId: number,
): Promise<{ url: string; filename: string; contentType: string }> {
    return request(`/api/pm/projects/${projectId}/uploads/${uploadId}/thumbnail`);
}
