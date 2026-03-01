// ── Scantech Public Page ──
// Token-validated, no Firebase auth required.
// Renders the same tab components as the authenticated Scantech app
// but uses the PublicScantechApiProvider for API calls.

import { useState, useEffect, lazy, Suspense } from 'react';
import { NavLink, Routes, Route, Navigate, useParams } from 'react-router-dom';
import {
    Map, CheckSquare, UploadCloud, MessageSquare,
    Wifi, WifiOff, Loader2, AlertTriangle,
} from 'lucide-react';
import { fetchPublicScantechProject, type ScantechProjectDetail } from '@/services/api';

// Public endpoint returns extra fields from the token record
type PublicProjectData = ScantechProjectDetail & {
    techName?: string;
    techEmail?: string;
};
import { PublicScantechApiProvider } from '@/components/scantech/ScantechApiContext';
import { ScantechCtx } from '@/components/scantech/ScantechLayout';
import { cn } from '@/lib/utils';

const OverviewTab = lazy(() => import('@/components/scantech/OverviewTab').then(m => ({ default: m.OverviewTab })));
const ChecklistTab = lazy(() => import('@/components/scantech/ChecklistTab').then(m => ({ default: m.ChecklistTab })));
const UploadTab = lazy(() => import('@/components/scantech/UploadTab').then(m => ({ default: m.UploadTab })));
const NotesTab = lazy(() => import('@/components/scantech/NotesTab').then(m => ({ default: m.NotesTab })));

// ── Bottom Nav (no Scoping tab for public — internal data) ──

interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', path: 'overview', icon: Map },
    { label: 'Checklist', path: 'checklist', icon: CheckSquare },
    { label: 'Upload', path: 'upload', icon: UploadCloud },
    { label: 'Notes', path: 'notes', icon: MessageSquare },
];

export function ScantechPublic() {
    const { token } = useParams<{ token: string }>();
    const [project, setProject] = useState<PublicProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    // Load project
    useEffect(() => {
        if (!token) return;
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                const data = await fetchPublicScantechProject(token) as PublicProjectData;
                if (!cancelled) {
                    setProject(data);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load project');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [token]);

    // Reload
    const reloadProject = async () => {
        if (!token) return;
        try {
            const data = await fetchPublicScantechProject(token) as PublicProjectData;
            setProject(data);
        } catch { /* silent */ }
    };

    // ── Loading ──
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading project...</p>
                </div>
            </div>
        );
    }

    // ── Error / Expired / Invalid ──
    if (error || !project) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center max-w-sm px-6">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-900 mb-2">
                        {error?.includes('expired') ? 'Link Expired' :
                         error?.includes('revoked') ? 'Link Revoked' :
                         error?.includes('Invalid') ? 'Invalid Link' : 'Error'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {error || 'This link is no longer valid. Please contact your project manager for a new link.'}
                    </p>
                </div>
            </div>
        );
    }

    // Stage badge
    const stageBadge = {
        scheduling: 'bg-amber-100 text-amber-800',
        field_capture: 'bg-blue-100 text-blue-800',
        processing: 'bg-purple-100 text-purple-800',
        qa_review: 'bg-indigo-100 text-indigo-800',
    }[project.currentStage] || 'bg-gray-100 text-gray-800';

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 safe-area-pt">
                <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded-lg bg-blue-50">
                            <span className="text-blue-600 text-xs font-bold font-mono">S2P</span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 font-mono">
                                    {project.upid}
                                </span>
                                <span className={cn(
                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                                    stageBadge,
                                )}>
                                    {project.currentStage.replace('_', ' ')}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                                {project.techName && <span className="font-medium">{project.techName} &middot; </span>}
                                {project.scopingData?.projectName || project.scopingData?.clientCompany}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {online ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                        ) : (
                            <WifiOff className="w-4 h-4 text-red-500" />
                        )}
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <main className="flex-1 overflow-y-auto pb-20">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <ScantechCtx.Provider value={{ project, reloadProject, online }}>
                        <PublicScantechApiProvider token={token!}>
                            <Suspense fallback={
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                </div>
                            }>
                                <Routes>
                                    <Route index element={<Navigate to="overview" replace />} />
                                    <Route path="overview" element={<OverviewTab />} />
                                    <Route path="checklist" element={<ChecklistTab />} />
                                    <Route path="upload" element={<UploadTab />} />
                                    <Route path="notes" element={<NotesTab />} />
                                </Routes>
                            </Suspense>
                        </PublicScantechApiProvider>
                    </ScantechCtx.Provider>
                </div>
            </main>

            {/* ── Bottom Nav ── */}
            <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
                <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={`/scantech-link/${token}/${item.path}`}
                            className={({ isActive }) => cn(
                                'flex flex-col items-center justify-center p-2 w-full rounded-lg transition-colors touch-manipulation',
                                'min-h-[48px]',
                                isActive
                                    ? 'text-blue-600'
                                    : 'text-gray-400 hover:text-gray-600 active:text-gray-700',
                            )}
                        >
                            <item.icon className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
