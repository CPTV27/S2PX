import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Loader2,
    FolderKanban,
    Calendar,
    Search,
    Folder,
    FileText,
    File,
    Image,
    FileArchive,
    Download,
    ChevronRight,
    Home,
    HardDrive,
    Database,
    ArrowLeft,
    BarChart3,
    ChevronDown,
    ChevronUp,
    FileBox,
    TrendingUp,
} from 'lucide-react';
import { fetchProjects, fetchGcsProjectFolders, fetchGcsFolderContents, getGcsDownloadUrl, fetchGcsAnalytics } from '@/services/api';
import { cn, formatDate, getStatusColor } from '@/lib/utils';
import type { Project, GcsProjectFolder, GcsFolderEntry, ProjectAnalytics } from '@/types';

type DataSource = 'gcs' | 'database';

function formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function getFileIcon(contentType?: string) {
    if (!contentType) return File;
    if (contentType === 'folder') return Folder;
    if (contentType.startsWith('image/')) return Image;
    if (contentType.includes('zip') || contentType.includes('archive')) return FileArchive;
    if (contentType.includes('pdf') || contentType.includes('text')) return FileText;
    return File;
}

// ── GCS File Browser Panel ──

function FileBrowser({ project }: { project: GcsProjectFolder }) {
    const [entries, setEntries] = useState<GcsFolderEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPath, setCurrentPath] = useState(project.folderPath);
    const [pathHistory, setPathHistory] = useState<string[]>([]);

    useEffect(() => {
        setCurrentPath(project.folderPath);
        setPathHistory([]);
    }, [project.folderPath]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchGcsFolderContents(project.bucket, currentPath)
            .then((data) => { if (!cancelled) setEntries(data); })
            .catch(console.error)
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [project.bucket, currentPath]);

    const navigateTo = (folderPath: string) => {
        setPathHistory((prev) => [...prev, currentPath]);
        setCurrentPath(folderPath);
    };

    const navigateBack = () => {
        const prev = pathHistory[pathHistory.length - 1];
        if (prev !== undefined) {
            setPathHistory((h) => h.slice(0, -1));
            setCurrentPath(prev);
        }
    };

    const handleDownload = async (entry: GcsFolderEntry) => {
        try {
            const { url } = await getGcsDownloadUrl(project.bucket, entry.fullPath);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    // Build breadcrumb from project root
    const relativePath = currentPath.replace(project.folderPath, '');
    const crumbs = relativePath.split('/').filter(Boolean);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-s2p-border bg-s2p-secondary/30">
                <h3 className="font-semibold text-s2p-fg truncate">{project.name}</h3>
                <p className="text-xs text-s2p-muted font-mono mt-0.5">
                    {project.scanDate !== 'undated' ? `Scanned ${project.scanDate}` : 'Undated'}
                </p>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 px-4 py-2 text-xs border-b border-s2p-border/50 bg-white overflow-x-auto">
                {pathHistory.length > 0 && (
                    <button onClick={navigateBack} className="p-1 rounded hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg transition-colors mr-1">
                        <ArrowLeft size={12} />
                    </button>
                )}
                <button
                    onClick={() => { setCurrentPath(project.folderPath); setPathHistory([]); }}
                    className="flex items-center gap-1 text-s2p-muted hover:text-s2p-primary transition-colors shrink-0"
                >
                    <Home size={11} />
                    <span className="font-mono">root</span>
                </button>
                {crumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1 shrink-0">
                        <ChevronRight size={10} className="text-s2p-muted" />
                        <button
                            onClick={() => {
                                const target = project.folderPath + crumbs.slice(0, i + 1).join('/') + '/';
                                setPathHistory((h) => [...h, currentPath]);
                                setCurrentPath(target);
                            }}
                            className="font-mono text-s2p-muted hover:text-s2p-primary transition-colors"
                        >
                            {crumb}
                        </button>
                    </span>
                ))}
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-s2p-muted">
                        <Loader2 size={20} className="animate-spin" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-s2p-muted">
                        <Folder size={28} className="mb-2 opacity-30" />
                        <p className="text-sm">Empty folder</p>
                    </div>
                ) : (
                    <div>
                        {entries.map((entry) => {
                            const Icon = entry.isFolder ? Folder : getFileIcon(entry.contentType);
                            return (
                                <div
                                    key={entry.fullPath}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 border-b border-s2p-border/30 group transition-colors",
                                        entry.isFolder ? "hover:bg-blue-50/40 cursor-pointer" : "hover:bg-s2p-secondary/30"
                                    )}
                                    onClick={entry.isFolder ? () => navigateTo(entry.fullPath) : undefined}
                                >
                                    <Icon size={16} className={entry.isFolder ? "text-blue-500 shrink-0" : "text-s2p-muted shrink-0"} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{entry.name}</p>
                                        {!entry.isFolder && (
                                            <p className="text-[11px] text-s2p-muted font-mono">
                                                {formatFileSize(entry.size || 0)}
                                                {entry.updated && ` · ${formatDateTime(entry.updated)}`}
                                            </p>
                                        )}
                                    </div>
                                    {!entry.isFolder && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownload(entry); }}
                                            className="p-1.5 rounded-lg hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Download"
                                        >
                                            <Download size={14} />
                                        </button>
                                    )}
                                    {entry.isFolder && (
                                        <ChevronRight size={14} className="text-s2p-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
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
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Projects', value: analytics.totalProjects.toLocaleString(), icon: FolderKanban, color: 'text-blue-500 bg-blue-50' },
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
                {/* Projects by Month */}
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

                {/* File Categories */}
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

            {/* Top Projects by Size + Folder Types */}
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

// ── Main Projects Page ──

export function Projects() {
    const [dataSource, setDataSource] = useState<DataSource>('gcs');
    const [gcsFolders, setGcsFolders] = useState<GcsProjectFolder[]>([]);
    const [dbProjects, setDbProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<GcsProjectFolder | null>(null);
    const [analyticsOpen, setAnalyticsOpen] = useState(false);
    const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    useEffect(() => {
        if (dataSource === 'gcs') {
            setIsLoading(true);
            fetchGcsProjectFolders()
                .then(setGcsFolders)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(true);
            fetchProjects()
                .then(setDbProjects)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        }
    }, [dataSource]);

    // Lazy-load analytics when panel is opened
    useEffect(() => {
        if (analyticsOpen && !analytics && !analyticsLoading) {
            setAnalyticsLoading(true);
            fetchGcsAnalytics()
                .then(setAnalytics)
                .catch(console.error)
                .finally(() => setAnalyticsLoading(false));
        }
    }, [analyticsOpen, analytics, analyticsLoading]);

    const filteredFolders = useMemo(() => {
        if (!search) return gcsFolders;
        const q = search.toLowerCase();
        return gcsFolders.filter(
            (f) => f.name.toLowerCase().includes(q) || f.scanDate.includes(q)
        );
    }, [gcsFolders, search]);

    const filteredProjects = useMemo(() => {
        if (!search) return dbProjects;
        const q = search.toLowerCase();
        return dbProjects.filter(
            (p) =>
                p.projectName.toLowerCase().includes(q) ||
                p.clientName.toLowerCase().includes(q)
        );
    }, [dbProjects, search]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-s2p-fg">Projects</h2>
                <p className="text-s2p-muted text-sm mt-1">
                    {dataSource === 'gcs'
                        ? `${gcsFolders.length} project folders in cloud storage`
                        : `${dbProjects.length} projects in database`}
                </p>
            </div>

            {/* Data Source Tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-s2p-secondary rounded-xl p-1">
                    <button
                        onClick={() => { setDataSource('gcs'); setSelectedFolder(null); }}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            dataSource === 'gcs'
                                ? "bg-white text-s2p-fg shadow-sm"
                                : "text-s2p-muted hover:text-s2p-fg"
                        )}
                    >
                        <HardDrive size={14} />
                        Cloud Storage
                        {gcsFolders.length > 0 && (
                            <span className="text-[10px] font-mono bg-s2p-secondary px-1.5 py-0.5 rounded-full">
                                {gcsFolders.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setDataSource('database')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            dataSource === 'database'
                                ? "bg-white text-s2p-fg shadow-sm"
                                : "text-s2p-muted hover:text-s2p-fg"
                        )}
                    >
                        <Database size={14} />
                        Database
                    </button>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-s2p-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-s2p-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-s2p-primary/20 focus:border-s2p-primary transition-all"
                    />
                </div>
            </div>

            {/* Analytics Toggle + Panel */}
            {dataSource === 'gcs' && !isLoading && (
                <>
                    <button
                        onClick={() => setAnalyticsOpen((o) => !o)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all w-full",
                            analyticsOpen
                                ? "bg-s2p-primary/5 border-s2p-primary/30 text-s2p-primary"
                                : "bg-white border-s2p-border text-s2p-muted hover:text-s2p-fg hover:border-s2p-primary/20"
                        )}
                    >
                        <BarChart3 size={16} />
                        Project Analytics
                        {analyticsOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                    </button>
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
                                        <span className="text-sm">Analyzing {gcsFolders.length} projects...</span>
                                    </div>
                                ) : analytics ? (
                                    <AnalyticsPanel analytics={analytics} />
                                ) : (
                                    <div className="text-center py-8 text-s2p-muted text-sm">
                                        Failed to load analytics. Check backend connection.
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-s2p-primary" size={32} />
                </div>
            )}

            {/* GCS Split View */}
            {!isLoading && dataSource === 'gcs' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex bg-white border border-s2p-border rounded-2xl overflow-hidden"
                    style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
                >
                    {/* Left Panel — Project List */}
                    <div className="w-80 shrink-0 border-r border-s2p-border flex flex-col">
                        <div className="px-3 py-2 border-b border-s2p-border/50 bg-s2p-secondary/30">
                            <p className="text-xs font-semibold text-s2p-muted uppercase tracking-wider">
                                {filteredFolders.length} projects
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredFolders.map((folder) => (
                                <button
                                    key={folder.folderPath}
                                    onClick={() => setSelectedFolder(folder)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 border-b border-s2p-border/30 transition-colors",
                                        selectedFolder?.folderPath === folder.folderPath
                                            ? "bg-blue-50 border-l-2 border-l-s2p-primary"
                                            : "hover:bg-s2p-secondary/30 border-l-2 border-l-transparent"
                                    )}
                                >
                                    <p className="text-sm font-medium text-s2p-fg truncate leading-snug">
                                        {folder.name}
                                    </p>
                                    <p className="text-[11px] text-s2p-muted mt-0.5 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {folder.scanDate !== 'undated' ? folder.scanDate : 'Undated'}
                                    </p>
                                </button>
                            ))}
                            {filteredFolders.length === 0 && (
                                <div className="text-center py-12 text-s2p-muted">
                                    <Search size={24} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No projects match your search.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel — File Browser */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {selectedFolder ? (
                            <FileBrowser project={selectedFolder} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-s2p-muted">
                                <FolderKanban size={40} className="mb-3 opacity-20" />
                                <p className="font-medium">Select a project</p>
                                <p className="text-sm mt-1">Choose a project from the left to browse its files.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Database Card Grid (existing view) */}
            {!isLoading && dataSource === 'database' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project, i) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white border border-s2p-border rounded-2xl p-6 hover:shadow-lg hover:border-s2p-primary/30 transition-all group cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-blue-50 text-blue-500 rounded-xl">
                                    <FolderKanban size={20} />
                                </div>
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono uppercase", getStatusColor(project.status))}>
                                    {project.status}
                                </span>
                            </div>

                            <h3 className="font-semibold text-s2p-fg mb-1 group-hover:text-s2p-primary transition-colors">
                                {project.projectName}
                            </h3>
                            <p className="text-sm text-s2p-muted mb-4">{project.clientName}</p>

                            <div className="space-y-2 text-sm text-s2p-muted">
                                {project.scanDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={13} />
                                        <span>Scanned: {formatDate(project.scanDate)}</span>
                                    </div>
                                )}
                                {project.deliveryDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar size={13} />
                                        <span>Delivery: {formatDate(project.deliveryDate)}</span>
                                    </div>
                                )}
                            </div>

                            {project.potreePath && (
                                <div className="mt-4 pt-3 border-t border-s2p-border">
                                    <span className="text-xs font-mono text-s2p-primary">3D Model Available</span>
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {filteredProjects.length === 0 && (
                        <div className="col-span-full text-center py-16 text-s2p-muted">
                            <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
                            <p className="font-medium">No projects found</p>
                            <p className="text-sm mt-1">
                                {search ? 'Try a different search term.' : 'Win a deal to create your first project.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
