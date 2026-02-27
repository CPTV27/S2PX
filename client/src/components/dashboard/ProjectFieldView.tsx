// ── Project Field View — PM "Mission Control" Dashboard ──
// Aggregates field data from Scantech into a single PM-facing view:
// - Status header with real-time checklist/upload progress
// - Checklist completion overview
// - Media gallery (photos, videos from the field)
// - Scan file downloads (direct GCS signed URLs)
// - Field notes summary
// - Scoping data diff view

import { useState, useEffect, useCallback } from 'react';
import {
    Loader2, RefreshCw, Wifi, WifiOff,
    CheckCircle, AlertTriangle, Clock, Camera,
    HardDrive, FileText, MessageSquare, Sparkles,
    MapPin, Building2, Layers, ExternalLink,
    ChevronDown, ChevronRight, StickyNote,
} from 'lucide-react';
import {
    fetchPMFieldSummary,
    type PMFieldSummary,
    type FieldNote,
} from '@/services/api';
import { ChecklistProgress } from './ChecklistProgress';
import { FieldMediaGallery } from './FieldMediaGallery';
import { FieldFileDownloads } from './FieldFileDownloads';
import { cn } from '@/lib/utils';

interface ProjectFieldViewProps {
    projectId: number;
}

function formatBytes(bytes: string | number): string {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ProjectFieldView({ projectId }: ProjectFieldViewProps) {
    const [data, setData] = useState<PMFieldSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            const result = await fetchPMFieldSummary(projectId);
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load field data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [projectId]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                    <span>Loading field data...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-12">
                <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-500 mb-3">{error || 'No data available'}</p>
                <button
                    onClick={() => loadData()}
                    className="text-xs text-blue-600 hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Derive status
    const allChecklistsComplete = data.checklists.every(c => c.status === 'complete');
    const hasFlags = data.checklists.some(c => c.status === 'flagged');
    const allRequiredMet = data.checklists.every(c => c.requiredCompleted >= c.requiredItems);
    const totalUploads = data.uploads.total;
    const photoCount = data.uploads.byCategory.find(c => c.category === 'photo')?.count || 0;
    const scanFileCount = data.uploads.byCategory.find(c => c.category === 'scan_file')?.count || 0;

    // Overall readiness
    const readiness = allChecklistsComplete && allRequiredMet
        ? 'ready'
        : hasFlags
            ? 'flagged'
            : data.checklists.some(c => c.status === 'in_progress')
                ? 'in_progress'
                : 'not_started';

    const readinessConfig = {
        ready: { label: 'Ready for Review', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
        flagged: { label: 'Flagged — Needs Attention', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
        in_progress: { label: 'Field Work In Progress', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
        not_started: { label: 'Awaiting Field Data', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
    };

    const readinessInfo = readinessConfig[readiness];
    const ReadinessIcon = readinessInfo.icon;

    return (
        <div className="space-y-4">
            {/* ── Status Header ── */}
            <div className={cn(
                'rounded-lg border p-4 flex items-center justify-between',
                readinessInfo.color,
            )}>
                <div className="flex items-center gap-3">
                    <ReadinessIcon size={20} />
                    <div>
                        <p className="text-sm font-semibold">{readinessInfo.label}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                            {data.checklists.filter(c => c.status === 'complete').length}/{data.checklists.length} checklists
                            {' · '}
                            {totalUploads} uploads
                            {' · '}
                            {data.notes.total} notes
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
                >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── Quick Stats Row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    icon={Camera}
                    label="Photos"
                    value={String(photoCount)}
                    color="blue"
                />
                <StatCard
                    icon={HardDrive}
                    label="Scan Files"
                    value={String(scanFileCount)}
                    color="violet"
                />
                <StatCard
                    icon={MessageSquare}
                    label="Field Notes"
                    value={String(data.notes.total)}
                    sublabel={data.notes.aiAssistedCount > 0 ? `${data.notes.aiAssistedCount} AI-assisted` : undefined}
                    color="emerald"
                />
                <StatCard
                    icon={Layers}
                    label="Total Upload Size"
                    value={formatBytes(
                        data.uploads.byCategory.reduce(
                            (sum, c) => sum + parseInt(c.totalBytes, 10), 0
                        ),
                    )}
                    color="amber"
                />
            </div>

            {/* ── Checklist Progress ── */}
            <ChecklistProgress checklists={data.checklists} />

            {/* ── Media Gallery ── */}
            <FieldMediaGallery
                projectId={projectId}
                uploads={data.uploads.recentUploads}
            />

            {/* ── Scan File Downloads ── */}
            <FieldFileDownloads
                projectId={projectId}
                uploads={data.uploads.recentUploads}
            />

            {/* ── Field Notes ── */}
            {data.notes.total > 0 && (
                <FieldNotesPanel notes={data.notes.recent} total={data.notes.total} />
            )}

            {/* ── Scoping Snapshot ── */}
            {data.scopingData && (
                <ScopingSnapshot scopingData={data.scopingData} />
            )}
        </div>
    );
}

// ── Stat Card ──

function StatCard({
    icon: Icon,
    label,
    value,
    sublabel,
    color,
}: {
    icon: typeof Camera;
    label: string;
    value: string;
    sublabel?: string;
    color: 'blue' | 'violet' | 'emerald' | 'amber';
}) {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-1">
                <div className={cn('w-6 h-6 rounded flex items-center justify-center', colorMap[color])}>
                    <Icon size={12} />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{value}</p>
            {sublabel && (
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Sparkles size={9} />
                    {sublabel}
                </p>
            )}
        </div>
    );
}

// ── Field Notes Panel ──

function FieldNotesPanel({ notes, total }: { notes: FieldNote[]; total: number }) {
    const [expanded, setExpanded] = useState(false);

    const categoryColors: Record<string, string> = {
        general: 'bg-slate-100 text-slate-600',
        site_condition: 'bg-blue-100 text-blue-700',
        issue: 'bg-red-100 text-red-700',
        photo_analysis: 'bg-violet-100 text-violet-700',
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <StickyNote size={14} className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Field Notes</h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {total}
                    </span>
                </div>
                {expanded
                    ? <ChevronDown size={14} className="text-slate-400" />
                    : <ChevronRight size={14} className="text-slate-400" />
                }
            </button>

            {expanded && (
                <div className="divide-y divide-slate-50">
                    {notes.map(note => (
                        <div key={note.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                                {note.category && (
                                    <span className={cn(
                                        'text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                        categoryColors[note.category] || categoryColors.general,
                                    )}>
                                        {note.category.replace('_', ' ')}
                                    </span>
                                )}
                                {note.aiAssisted && (
                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-0.5">
                                        <Sparkles size={8} />
                                        AI
                                    </span>
                                )}
                                <span className="text-[10px] text-slate-400 ml-auto">
                                    {new Date(note.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {note.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Scoping Snapshot (collapsed by default) ──

function ScopingSnapshot({
    scopingData,
}: {
    scopingData: PMFieldSummary['scopingData'];
}) {
    const [expanded, setExpanded] = useState(false);

    if (!scopingData) return null;

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Scoping Data</h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {scopingData.areas.length} areas
                    </span>
                </div>
                {expanded
                    ? <ChevronDown size={14} className="text-slate-400" />
                    : <ChevronRight size={14} className="text-slate-400" />
                }
            </button>

            {expanded && (
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <ScopingField label="Client" value={scopingData.clientCompany} />
                        <ScopingField label="Project" value={scopingData.projectName} />
                        <ScopingField label="Address" value={scopingData.projectAddress} />
                        <ScopingField label="Floors" value={String(scopingData.numberOfFloors)} />
                        <ScopingField label="Era" value={scopingData.era} />
                        <ScopingField label="Room Density" value={`${scopingData.roomDensity}/10`} />
                        <ScopingField label="BIM Format" value={scopingData.bimDeliverable} />
                        {scopingData.bimVersion && <ScopingField label="BIM Version" value={scopingData.bimVersion} />}
                        <ScopingField label="Georeferencing" value={scopingData.georeferencing ? 'Yes' : 'No'} />
                        <ScopingField label="Dispatch" value={scopingData.dispatchLocation} />
                        <ScopingField label="Distance" value={`${scopingData.oneWayMiles} mi`} />
                        <ScopingField label="Travel Mode" value={scopingData.travelMode} />
                        {scopingData.pricingTier && <ScopingField label="Pricing Tier" value={scopingData.pricingTier} />}
                        {scopingData.estScanDays && <ScopingField label="Est. Scan Days" value={String(scopingData.estScanDays)} />}
                    </div>

                    {/* Scope areas */}
                    {scopingData.areas.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">
                                Scope Areas ({scopingData.areas.length})
                            </p>
                            <div className="space-y-1.5">
                                {scopingData.areas.map(area => (
                                    <div key={area.id} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 rounded text-xs">
                                        <span className="font-medium text-slate-700 truncate">
                                            {area.areaName || area.areaType}
                                        </span>
                                        <span className="text-slate-500 flex-shrink-0 ml-2">
                                            {area.squareFootage.toLocaleString()} SF · {area.projectScope} · LOD {area.lod}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risk factors */}
                    {scopingData.riskFactors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5">
                                Risk Factors
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {scopingData.riskFactors.map(rf => (
                                    <span key={rf} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                        {rf}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ScopingField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-sm text-slate-700 font-medium truncate">{value}</p>
        </div>
    );
}
