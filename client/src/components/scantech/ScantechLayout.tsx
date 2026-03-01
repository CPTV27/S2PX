// ── Scantech Mobile Layout Shell ──
// Full-width mobile-first layout (no sidebar) with bottom navigation bar.
// Pattern: same as FieldCapture.tsx — standalone, outside DashboardLayout.

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import {
    Map, CheckSquare, UploadCloud, FileText, MessageSquare,
    ArrowLeft, Wifi, WifiOff, Loader2,
} from 'lucide-react';
import { fetchScantechProject, type ScantechProjectDetail } from '@/services/api';
import { AuthenticatedScantechApiProvider } from './ScantechApiContext';
import { cn } from '@/lib/utils';

// ── Bottom Nav Definition ──

interface NavItem {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', path: 'overview', icon: Map },
    { label: 'Checklist', path: 'checklist', icon: CheckSquare },
    { label: 'Upload', path: 'upload', icon: UploadCloud },
    { label: 'Scoping', path: 'scoping', icon: FileText },
    { label: 'Notes', path: 'notes', icon: MessageSquare },
];

// ── Layout Component ──

export function ScantechLayout() {
    const { projectId: pid } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const projectId = pid ? parseInt(pid, 10) : undefined;

    const [project, setProject] = useState<ScantechProjectDetail | null>(null);
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

    // Load project data
    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                const data = await fetchScantechProject(projectId);
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
    }, [projectId]);

    // Reload project data (exposed to child tabs via context-like props)
    const reloadProject = async () => {
        if (!projectId) return;
        try {
            const data = await fetchScantechProject(projectId);
            setProject(data);
        } catch { /* silent refresh failure */ }
    };

    // ── Loading / Error states ──

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading project…</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center max-w-sm px-4">
                    <p className="text-red-600 text-sm mb-4">{error || 'Project not found'}</p>
                    <button
                        onClick={() => navigate('/scantech')}
                        className="text-blue-600 text-sm font-medium hover:underline"
                    >
                        ← Back to Projects
                    </button>
                </div>
            </div>
        );
    }

    // ── Stage badge color ──
    const stageBadge = {
        scheduling: 'bg-amber-100 text-amber-800',
        field_capture: 'bg-blue-100 text-blue-800',
        processing: 'bg-purple-100 text-purple-800',
        qa_review: 'bg-indigo-100 text-indigo-800',
    }[project.currentStage] || 'bg-gray-100 text-gray-800';

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 safe-area-pt">
                <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => navigate('/scantech')}
                            className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                            aria-label="Back to project list"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
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
                                {project.scopingData.projectName || project.scopingData.clientCompany}
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

            {/* ── Main Content Area (scrollable) ── */}
            <main className="flex-1 overflow-y-auto pb-20">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <ScantechCtx.Provider value={{ project, reloadProject, online }}>
                        <AuthenticatedScantechApiProvider projectId={project.id}>
                            <Outlet />
                        </AuthenticatedScantechApiProvider>
                    </ScantechCtx.Provider>
                </div>
            </main>

            {/* ── Bottom Navigation Bar ── */}
            <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 safe-area-pb">
                <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-1">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={`/scantech/${projectId}/${item.path}`}
                            className={({ isActive }) => cn(
                                'flex flex-col items-center justify-center p-2 w-full rounded-lg transition-colors touch-manipulation',
                                'min-h-[48px]', // 48px touch target per WCAG
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

// ── Scantech Context ──
// Dedicated React context so both ScantechLayout (authenticated) and
// ScantechPublicLayout (public) can provide the same context to tab components.

import { createContext, useContext } from 'react';

export interface ScantechContext {
    project: ScantechProjectDetail;
    reloadProject: () => Promise<void>;
    online: boolean;
}

export const ScantechCtx = createContext<ScantechContext | null>(null);

export function useScantechContext(): ScantechContext {
    const ctx = useContext(ScantechCtx);
    if (!ctx) throw new Error('useScantechContext must be used within a Scantech layout');
    return ctx;
}
