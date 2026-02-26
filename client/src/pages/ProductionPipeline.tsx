import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, ChevronRight, Building2, MapPin, LayoutGrid, List,
    HardDrive,
} from 'lucide-react';
import {
    fetchProductionProjects, fetchProductionStageSummary,
    type ProductionProjectData, type StageSummary,
} from '@/services/api';
import { STAGE_CONFIGS, getStageConfig } from '@shared/types/production';
import type { ProductionStage } from '@shared/schema/constants';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

// ── Stage color tokens ──

const stageColorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const stageHeaderBg: Record<string, string> = {
    slate: 'bg-slate-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
};

const stageDotColor: Record<string, string> = {
    slate: 'bg-slate-400',
    blue: 'bg-blue-400',
    indigo: 'bg-indigo-400',
    violet: 'bg-violet-400',
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-400',
};

// ── Main Component ──

export function ProductionPipeline() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<ProductionProjectData[]>([]);
    const [stageSummary, setStageSummary] = useState<StageSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'kanban' | 'table'>('kanban');
    const [stageFilter, setStageFilter] = useState<ProductionStage | 'all'>('all');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [projectsList, summary] = await Promise.all([
                fetchProductionProjects(stageFilter !== 'all' ? stageFilter : undefined),
                fetchProductionStageSummary(),
            ]);
            setProjects(projectsList);
            setStageSummary(summary);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load production projects');
        } finally {
            setLoading(false);
        }
    }, [stageFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    const getStageCount = (stageId: string) =>
        stageSummary.find(s => s.current_stage === stageId)?.count ?? 0;

    const projectsByStage = (stageId: string) =>
        projects.filter(p => p.currentStage === stageId);

    const handleProjectClick = (id: number) => {
        navigate(`/dashboard/production/${id}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center">
                <p className="text-red-500 text-sm mb-4">{error}</p>
                <button onClick={loadData} className="text-sm text-blue-600 hover:underline">Retry</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Production Pipeline</h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {projects.length} project{projects.length !== 1 ? 's' : ''} across {STAGE_CONFIGS.length} stages
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Stage filter chips */}
                    <div className="hidden md:flex items-center gap-1 mr-2">
                        <button
                            onClick={() => setStageFilter('all')}
                            className={cn(
                                'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                                stageFilter === 'all'
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                            )}
                        >
                            All
                        </button>
                        {STAGE_CONFIGS.map(sc => (
                            <button
                                key={sc.id}
                                onClick={() => setStageFilter(sc.id)}
                                className={cn(
                                    'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                                    stageFilter === sc.id
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                                )}
                            >
                                {sc.shortLabel} ({getStageCount(sc.id)})
                            </button>
                        ))}
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center rounded border border-slate-200 overflow-hidden">
                        <button
                            onClick={() => setView('kanban')}
                            className={cn(
                                'p-1.5 transition-colors',
                                view === 'kanban' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600',
                            )}
                            title="Kanban view"
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            onClick={() => setView('table')}
                            className={cn(
                                'p-1.5 transition-colors',
                                view === 'table' ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600',
                            )}
                            title="Table view"
                        >
                            <List size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {view === 'kanban' ? (
                    <KanbanBoard
                        projectsByStage={projectsByStage}
                        getStageCount={getStageCount}
                        stageFilter={stageFilter}
                        onProjectClick={handleProjectClick}
                    />
                ) : (
                    <TableView
                        projects={projects}
                        onProjectClick={handleProjectClick}
                    />
                )}
            </div>
        </div>
    );
}

// ── Kanban Board ──

function KanbanBoard({
    projectsByStage,
    getStageCount,
    stageFilter,
    onProjectClick,
}: {
    projectsByStage: (stageId: string) => ProductionProjectData[];
    getStageCount: (stageId: string) => number;
    stageFilter: ProductionStage | 'all';
    onProjectClick: (id: number) => void;
}) {
    const stages = stageFilter === 'all'
        ? STAGE_CONFIGS
        : STAGE_CONFIGS.filter(s => s.id === stageFilter);

    return (
        <div className="h-full overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full min-w-max pb-2">
                {stages.map(stage => {
                    const stageProjects = projectsByStage(stage.id);
                    return (
                        <div key={stage.id} className="w-72 flex-shrink-0 flex flex-col h-full">
                            {/* Column header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg bg-white border border-slate-200 border-b-0 flex-shrink-0">
                                <div className={cn('w-2 h-2 rounded-full', stageDotColor[stage.color])} />
                                <span className="text-xs font-semibold text-slate-700 flex-1">{stage.label}</span>
                                <span className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center',
                                    stageColorMap[stage.color],
                                )}>
                                    {getStageCount(stage.id)}
                                </span>
                            </div>

                            {/* Cards scroll container */}
                            <div className="flex-1 min-h-0 bg-slate-50/70 rounded-b-lg border border-slate-200 border-t-0 overflow-y-auto p-2 space-y-2">
                                {stageProjects.map(project => (
                                    <KanbanCard
                                        key={project.id}
                                        project={project}
                                        stageColor={stage.color}
                                        onClick={() => onProjectClick(project.id)}
                                    />
                                ))}
                                {stageProjects.length === 0 && (
                                    <div className="flex items-center justify-center py-12 text-xs text-slate-300 italic">
                                        No projects
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Kanban Card ──

function KanbanCard({
    project,
    stageColor,
    onClick,
}: {
    project: ProductionProjectData;
    stageColor: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-white rounded-lg border border-slate-200 p-3 transition-all group cursor-pointer hover:border-blue-300 hover:shadow-sm"
        >
            {/* Top row: UPID + chevron */}
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                    {project.upid}
                </span>
                <ChevronRight
                    size={12}
                    className="text-slate-300 group-hover:text-blue-400 transition-colors"
                />
            </div>

            {/* Project name */}
            <div className="text-xs font-semibold text-slate-700 truncate mb-1">
                {project.projectName || 'Untitled'}
            </div>

            {/* Client */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                <Building2 size={10} className="flex-shrink-0" />
                <span className="truncate">{project.clientCompany || '—'}</span>
            </div>

            {/* Address */}
            {project.projectAddress && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate mt-0.5">
                    <MapPin size={10} className="flex-shrink-0" />
                    <span className="truncate">{project.projectAddress}</span>
                </div>
            )}

            {/* Footer: assets + date */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                {(project.assetCount ?? 0) > 0 ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                        <HardDrive size={9} />
                        {project.assetCount} asset{project.assetCount !== 1 ? 's' : ''}
                    </span>
                ) : (
                    <span className="text-[10px] text-slate-300">No assets</span>
                )}
                <span className="text-[9px] text-slate-300 font-mono">
                    {new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
            </div>
        </button>
    );
}

// ── Table View ──

function TableView({
    projects,
    onProjectClick,
}: {
    projects: ProductionProjectData[];
    onProjectClick: (id: number) => void;
}) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 overflow-auto h-full">
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">UPID</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Project</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Client</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Stage</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Assets</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {projects.map(project => {
                        const config = getStageConfig(project.currentStage as ProductionStage);
                        return (
                            <tr
                                key={project.id}
                                onClick={() => onProjectClick(project.id)}
                                className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2 font-mono text-blue-600">{project.upid}</td>
                                <td className="px-3 py-2 font-medium text-slate-700">{project.projectName || 'Untitled'}</td>
                                <td className="px-3 py-2 text-slate-500">{project.clientCompany || '—'}</td>
                                <td className="px-3 py-2">
                                    <span className={cn(
                                        'text-[10px] font-semibold px-2 py-0.5 rounded',
                                        stageColorMap[config.color],
                                    )}>
                                        {config.label}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                    {(project.assetCount ?? 0) > 0 ? (
                                        <span className="flex items-center gap-1 text-emerald-500">
                                            <HardDrive size={10} />
                                            {project.assetCount}
                                        </span>
                                    ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                    {new Date(project.updatedAt).toLocaleDateString()}
                                </td>
                            </tr>
                        );
                    })}
                    {projects.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                                No production projects yet. Projects are created when deals close.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
