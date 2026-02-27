// ── Scantech Project List ──
// Mobile-optimized card list of assigned projects in scheduling/field_capture stage.
// Route: /scantech (full-width, no sidebar)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, MapPin, Building2, CheckCircle, UploadCloud,
    RefreshCw, Wifi, WifiOff, Search, ChevronRight,
} from 'lucide-react';
import { fetchScantechProjects, type ScantechProject } from '@/services/api';
import { cn } from '@/lib/utils';

export function ScantechList() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<ScantechProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [online, setOnline] = useState(navigator.onLine);

    // Online/offline detection
    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const loadProjects = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const data = await fetchScantechProjects();
            setProjects(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    // ── Filtered projects ──
    const filtered = projects.filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            p.upid.toLowerCase().includes(q) ||
            (p.projectName?.toLowerCase().includes(q)) ||
            (p.clientCompany?.toLowerCase().includes(q)) ||
            (p.projectAddress?.toLowerCase().includes(q))
        );
    });

    // ── Stage badge ──
    const stageBadge = (stage: string) => {
        const map: Record<string, string> = {
            scheduling: 'bg-amber-100 text-amber-800',
            field_capture: 'bg-blue-100 text-blue-800',
        };
        return map[stage] || 'bg-gray-100 text-gray-800';
    };

    // ── Checklist progress bar ──
    const progressPercent = (p: ScantechProject) =>
        p.checklistProgress.total > 0
            ? Math.round((p.checklistProgress.completed / p.checklistProgress.total) * 100)
            : 0;

    return (
        <div className="min-h-screen bg-gray-50 safe-area-pt safe-area-pb">
            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Scantech</h1>
                            <p className="text-xs text-gray-500">Field Operations</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {online ? (
                                <Wifi className="w-4 h-4 text-green-500" />
                            ) : (
                                <WifiOff className="w-4 h-4 text-red-500" />
                            )}
                            <button
                                onClick={() => loadProjects(true)}
                                disabled={refreshing}
                                className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation disabled:opacity-50"
                                aria-label="Refresh projects"
                            >
                                <RefreshCw className={cn('w-4 h-4 text-gray-600', refreshing && 'animate-spin')} />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search projects…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <div className="max-w-2xl mx-auto px-4 py-4">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : error ? (
                    <div className="text-center py-20">
                        <p className="text-red-600 text-sm mb-3">{error}</p>
                        <button
                            onClick={() => loadProjects()}
                            className="text-blue-600 text-sm font-medium hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">
                            {search ? 'No matching projects' : 'No assigned projects'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                            {filtered.length} Project{filtered.length !== 1 ? 's' : ''}
                        </p>

                        {filtered.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => navigate(`/scantech/${p.id}/overview`)}
                                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm active:bg-gray-50 transition-all touch-manipulation"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-gray-900 font-mono">
                                                {p.upid}
                                            </span>
                                            <span className={cn(
                                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap',
                                                stageBadge(p.currentStage),
                                            )}>
                                                {p.currentStage.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-700 truncate">
                                            {p.projectName || p.clientCompany || 'Untitled'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                                </div>

                                {/* Address */}
                                {p.projectAddress && (
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <p className="text-xs text-gray-500 truncate">{p.projectAddress}</p>
                                    </div>
                                )}

                                {/* Stats row */}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    {/* Checklist progress */}
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <CheckCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                                            <div
                                                className={cn(
                                                    'h-1.5 rounded-full transition-all',
                                                    progressPercent(p) === 100
                                                        ? 'bg-green-500'
                                                        : progressPercent(p) > 0
                                                            ? 'bg-blue-500'
                                                            : 'bg-gray-200',
                                                )}
                                                style={{ width: `${progressPercent(p)}%` }}
                                            />
                                        </div>
                                        <span className="tabular-nums whitespace-nowrap">
                                            {p.checklistProgress.completed}/{p.checklistProgress.total}
                                        </span>
                                    </div>

                                    {/* Upload count */}
                                    <div className="flex items-center gap-1">
                                        <UploadCloud className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="tabular-nums">{p.uploadCount}</span>
                                    </div>

                                    {/* Building type */}
                                    {p.buildingType && (
                                        <div className="flex items-center gap-1">
                                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="truncate max-w-[80px]">{p.buildingType}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
