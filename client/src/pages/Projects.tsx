// Archive — Unified project archive with searchable list + detail drill-down.
// Single interface combining database metadata with GCS asset browsing.

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Loader2,
    FolderKanban,
    Search,
    Folder,
    FileBox,
    HardDrive,
    BarChart3,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    MapPin,
    ArrowUpDown,
} from 'lucide-react';
import { fetchProjects, fetchGcsAnalytics } from '@/services/api';
import { cn, formatDate, getStatusColor } from '@/lib/utils';
import type { Project, ProjectAnalytics } from '@/types';
import { ArchiveDetail } from '@/components/archive/ArchiveDetail';

function formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ── Category Colors ──

const CATEGORY_COLORS: Record<string, string> = {
    'Point Cloud': 'bg-blue-500',
    'BIM / CAD': 'bg-emerald-500',
    'Realworks': 'bg-purple-500',
    'Photos': 'bg-amber-500',
    'Archives': 'bg-slate-500',
    'Documents': 'bg-rose-400',
    'Other': 'bg-gray-400',
};

// ── Analytics Panel ──

function AnalyticsPanel({ analytics }: { analytics: ProjectAnalytics }) {
    const maxMonthCount = Math.max(...analytics.projectsByMonth.map((m) => m.count), 1);
    const maxCatSize = Math.max(...analytics.fileCategories.map((c) => c.totalSize), 1);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'GCS Projects', value: analytics.totalProjects.toLocaleString(), icon: FolderKanban, color: 'text-blue-500 bg-blue-50' },
                    { label: 'Total Files', value: analytics.totalFiles.toLocaleString(), icon: FileBox, color: 'text-emerald-500 bg-emerald-50' },
                    { label: 'Total Storage', value: formatFileSize(analytics.totalSizeBytes), icon: HardDrive, color: 'text-purple-500 bg-purple-50' },
                    { label: 'Avg Files/Project', value: analytics.avgFilesPerProject.toLocaleString(), icon: TrendingUp, color: 'text-amber-500 bg-amber-50' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white border border-s2p-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn('p-1.5 rounded-lg', stat.color)}>
                                <stat.icon size={14} />
                            </div>
                            <span className="text-xs text-s2p-muted">{stat.label}</span>
                        </div>
                        <p className="text-xl font-bold text-s2p-fg">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                        <BarChart3 size={14} className="text-s2p-primary" />
                        Projects by Month
                    </h4>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {analytics.projectsByMonth.slice(-18).map((m) => (
                            <div key={m.month} className="flex items-center gap-2 text-xs">
                                <span className="w-16 text-s2p-muted font-mono shrink-0">{m.month}</span>
                                <div className="flex-1 bg-s2p-secondary rounded-full h-4 overflow-hidden">
                                    <div
                                        className="h-full bg-s2p-primary/70 rounded-full transition-all"
                                        style={{ width: `${(m.count / maxMonthCount) * 100}%` }}
                                    />
                                </div>
                                <span className="w-6 text-right font-mono text-s2p-fg font-medium">{m.count}</span>
                            </div>
                        ))}
                    </div>
                    {analytics.dateRange.earliest !== 'unknown' && (
                        <p className="text-[10px] text-s2p-muted mt-2 font-mono">
                            Range: {analytics.dateRange.earliest} to {analytics.dateRange.latest}
                        </p>
                    )}
                </div>

                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                        <FileBox size={14} className="text-emerald-500" />
                        File Categories
                    </h4>
                    <div className="space-y-2">
                        {analytics.fileCategories.map((cat) => (
                            <div key={cat.category}>
                                <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-s2p-fg font-medium">{cat.category}</span>
                                    <span className="text-s2p-muted font-mono">
                                        {cat.count.toLocaleString()} files &middot; {formatFileSize(cat.totalSize)}
                                    </span>
                                </div>
                                <div className="bg-s2p-secondary rounded-full h-3 overflow-hidden">
                                    <div
                                        className={cn('h-full rounded-full transition-all', CATEGORY_COLORS[cat.category] || 'bg-gray-400')}
                                        style={{ width: `${(cat.totalSize / maxCatSize) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-s2p-fg mb-3">Top Projects by Size</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {analytics.topProjectsBySize.slice(0, 10).map((p, i) => (
                            <div key={p.name} className="flex items-center gap-2 text-xs py-1 border-b border-s2p-border/30 last:border-0">
                                <span className="w-5 text-s2p-muted font-mono">{i + 1}.</span>
                                <span className="flex-1 truncate text-s2p-fg">{p.name}</span>
                                <span className="text-s2p-muted font-mono shrink-0">{p.fileCount} files</span>
                                <span className="font-mono font-medium text-s2p-fg w-16 text-right shrink-0">
                                    {formatFileSize(p.totalSize)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-s2p-fg mb-3">Folder Structure Distribution</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {analytics.folderTypes.slice(0, 15).map((ft) => (
                            <div key={ft.folder} className="flex items-center gap-2 text-xs py-1 border-b border-s2p-border/30 last:border-0">
                                <Folder size={12} className="text-blue-400 shrink-0" />
                                <span className="flex-1 truncate font-mono text-s2p-fg">{ft.folder}</span>
                                <span className="text-s2p-muted font-mono shrink-0">
                                    {ft.projectCount} project{ft.projectCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sort Types ──

type SortField = 'projectName' | 'clientName' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ── Main Archive Page ──

export function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        fetchProjects()
            .then(setProjects)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    // Lazy-load analytics
    useEffect(() => {
        if (analyticsOpen && !analytics && !analyticsLoading) {
            setAnalyticsLoading(true);
            fetchGcsAnalytics()
                .then(setAnalytics)
                .catch(console.error)
                .finally(() => setAnalyticsLoading(false));
        }
    }, [analyticsOpen, analytics, analyticsLoading]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const filtered = useMemo(() => {
        let list = projects;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.projectName.toLowerCase().includes(q) ||
                p.clientName.toLowerCase().includes(q) ||
                (p.projectAddress && p.projectAddress.toLowerCase().includes(q)) ||
                p.status.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => {
            let cmp = 0;
            const av = a[sortField] ?? '';
            const bv = b[sortField] ?? '';
            if (typeof av === 'string' && typeof bv === 'string') {
                cmp = av.localeCompare(bv);
            } else {
                cmp = av < bv ? -1 : av > bv ? 1 : 0;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }, [projects, search, sortField, sortDir]);

    // ── Detail View ──
    if (selectedId !== null) {
        return <ArchiveDetail projectId={selectedId} onBack={() => setSelectedId(null)} />;
    }

    // ── List View ──
    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-s2p-fg">Archive</h2>
                <p className="text-s2p-muted text-sm mt-1">
                    {projects.length} projects
                    {search && ` · ${filtered.length} matching`}
                </p>
            </div>

            {/* Search + Analytics Toggle */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-lg">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-s2p-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by project name, client, address, or status..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-s2p-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-s2p-primary/20 focus:border-s2p-primary transition-all"
                    />
                </div>

                <button
                    onClick={() => setAnalyticsOpen(o => !o)}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-all',
                        analyticsOpen
                            ? 'bg-s2p-primary/5 border-s2p-primary/30 text-s2p-primary'
                            : 'bg-white border-s2p-border text-s2p-muted hover:text-s2p-fg hover:border-s2p-primary/20'
                    )}
                >
                    <BarChart3 size={14} />
                    Analytics
                    {analyticsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>

            {/* Analytics Panel */}
            <AnimatePresence>
                {analyticsOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        {analyticsLoading ? (
                            <div className="flex items-center justify-center py-12 text-s2p-muted">
                                <Loader2 size={20} className="animate-spin mr-2" />
                                <span className="text-sm">Analyzing storage...</span>
                            </div>
                        ) : analytics ? (
                            <AnalyticsPanel analytics={analytics} />
                        ) : (
                            <div className="text-center py-8 text-s2p-muted text-sm">
                                Failed to load analytics.
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-s2p-primary" size={32} />
                </div>
            )}

            {/* Project Table */}
            {!isLoading && (
                <div className="bg-white border border-s2p-border rounded-2xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_1fr_1fr_120px_100px] gap-4 px-4 py-2.5 bg-s2p-secondary/40 border-b border-s2p-border text-xs font-semibold text-s2p-muted uppercase tracking-wider">
                        <SortHeader label="Project" field="projectName" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <SortHeader label="Client" field="clientName" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <span>Address</span>
                        <SortHeader label="Status" field="status" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <SortHeader label="Created" field="createdAt" current={sortField} dir={sortDir} onToggle={toggleSort} />
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-s2p-border/30">
                        {filtered.map((project) => (
                            <button
                                key={project.id}
                                onClick={() => setSelectedId(project.id)}
                                className="w-full text-left grid grid-cols-[1fr_1fr_1fr_120px_100px] gap-4 px-4 py-3 hover:bg-blue-50/40 transition-colors group"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-s2p-fg truncate group-hover:text-s2p-primary transition-colors">
                                        {project.projectName}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-s2p-muted truncate">{project.clientName}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-s2p-muted truncate flex items-center gap-1">
                                        {project.projectAddress && <MapPin size={10} className="shrink-0" />}
                                        {project.projectAddress || '—'}
                                    </p>
                                </div>
                                <div>
                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono uppercase', getStatusColor(project.status))}>
                                        {project.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-s2p-muted font-mono">
                                        {formatDate(project.createdAt)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-s2p-muted">
                            <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
                            <p className="font-medium">No projects found</p>
                            <p className="text-sm mt-1">
                                {search ? 'Try a different search term.' : 'No projects in the database yet.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Sort Header Helper ──

function SortHeader({
    label,
    field,
    current,
    dir,
    onToggle,
}: {
    label: string;
    field: SortField;
    current: SortField;
    dir: SortDir;
    onToggle: (field: SortField) => void;
}) {
    const isActive = current === field;
    return (
        <button
            onClick={() => onToggle(field)}
            className="flex items-center gap-1 hover:text-s2p-fg transition-colors"
        >
            {label}
            <ArrowUpDown size={10} className={isActive ? 'text-s2p-primary' : 'opacity-30'} />
        </button>
    );
}
