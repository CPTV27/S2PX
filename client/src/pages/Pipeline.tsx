import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
    Plus, Search, Loader2, Building2, DollarSign,
    ChevronRight,
} from 'lucide-react';
import { fetchLeads, updateLead } from '@/services/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Lead } from '@/types';

// ── Kanban stage definitions ──

interface StageColumn {
    id: string;
    label: string;
    color: string;       // dot + badge
    headerBg: string;    // column header accent
}

const KANBAN_STAGES: StageColumn[] = [
    { id: 'lead',        label: 'Lead',        color: 'slate',   headerBg: 'bg-slate-400' },
    { id: 'contacted',   label: 'Contacted',   color: 'sky',     headerBg: 'bg-sky-400' },
    { id: 'qualified',   label: 'Qualified',   color: 'blue',    headerBg: 'bg-blue-400' },
    { id: 'proposal',    label: 'Proposal',    color: 'indigo',  headerBg: 'bg-indigo-400' },
    { id: 'negotiation', label: 'Negotiation', color: 'violet',  headerBg: 'bg-violet-400' },
    { id: 'in_hand',     label: 'In Hand',     color: 'amber',   headerBg: 'bg-amber-400' },
    { id: 'won',         label: 'Won',         color: 'emerald', headerBg: 'bg-emerald-500' },
    { id: 'lost',        label: 'Lost',        color: 'red',     headerBg: 'bg-red-400' },
];

const stageBadgeMap: Record<string, string> = {
    slate:   'bg-slate-100 text-slate-600',
    sky:     'bg-sky-50 text-sky-600',
    blue:    'bg-blue-50 text-blue-600',
    indigo:  'bg-indigo-50 text-indigo-600',
    violet:  'bg-violet-50 text-violet-600',
    amber:   'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    red:     'bg-red-50 text-red-600',
};

const stageDotMap: Record<string, string> = {
    slate:   'bg-slate-400',
    sky:     'bg-sky-400',
    blue:    'bg-blue-400',
    indigo:  'bg-indigo-400',
    violet:  'bg-violet-400',
    amber:   'bg-amber-400',
    emerald: 'bg-emerald-500',
    red:     'bg-red-400',
};

// Map lead status (API value) → kanban column id
function mapToKanbanStage(status: string): string {
    const s = status.toLowerCase().replace(/ /g, '_');
    if (s === 'leads' || s === 'new') return 'lead';
    if (s === 'closed_won') return 'won';
    if (s === 'closed_lost') return 'lost';
    if (s === 'urgent') return 'in_hand';
    if (KANBAN_STAGES.some(ks => ks.id === s)) return s;
    return 'lead';
}

// Map kanban column id → API status value
const KANBAN_TO_API_STATUS: Record<string, string> = {
    lead:        'leads',
    contacted:   'contacted',
    qualified:   'qualified',
    proposal:    'proposal',
    negotiation: 'negotiation',
    in_hand:     'urgent',
    won:         'closed_won',
    lost:        'closed_lost',
};

// ── Main Component ──

export function Pipeline() {
    const navigate = useNavigate();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);
    // Track which lead id is currently being dragged so the card can style itself
    const draggingLeadId = useRef<number | null>(null);

    useEffect(() => {
        fetchLeads()
            .then(setLeads)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const filteredLeads = leads.filter(lead => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            lead.clientName?.toLowerCase().includes(q) ||
            lead.projectName?.toLowerCase().includes(q) ||
            lead.contactName?.toLowerCase().includes(q)
        );
    });

    const leadsByStage = useCallback(
        (stageId: string) =>
            filteredLeads.filter(l => mapToKanbanStage(l.status) === stageId),
        [filteredLeads],
    );

    const stageCount = useCallback(
        (stageId: string) =>
            leads.filter(l => mapToKanbanStage(l.status) === stageId).length,
        [leads],
    );

    const stageValue = useCallback(
        (stageId: string) =>
            leads
                .filter(l => mapToKanbanStage(l.status) === stageId)
                .reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
        [leads],
    );

    // ── Drag and drop handlers ──

    const handleDragStart = useCallback((leadId: number) => {
        draggingLeadId.current = leadId;
    }, []);

    const handleDragEnd = useCallback(() => {
        draggingLeadId.current = null;
        setDragOverStage(null);
    }, []);

    const handleDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>, stageId: string) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverStage(stageId);
        },
        [],
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            // Only clear when leaving the column entirely (not a child element)
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverStage(null);
            }
        },
        [],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>, targetStageId: string) => {
            e.preventDefault();
            setDragOverStage(null);

            const leadId = draggingLeadId.current;
            if (leadId === null) return;

            const lead = leads.find(l => l.id === leadId);
            if (!lead) return;

            const currentStageId = mapToKanbanStage(lead.status);
            if (currentStageId === targetStageId) return;

            const newApiStatus = KANBAN_TO_API_STATUS[targetStageId];
            if (!newApiStatus) return;

            // Optimistic update — swap the status in local state immediately
            setLeads(prev =>
                prev.map(l =>
                    l.id === leadId ? { ...l, status: newApiStatus } : l,
                ),
            );

            // Persist to API; on failure, roll back
            updateLead(leadId, { status: newApiStatus }).catch(() => {
                setLeads(prev =>
                    prev.map(l =>
                        l.id === leadId ? { ...l, status: lead.status } : l,
                    ),
                );
            });
        },
        [leads],
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col min-h-0 min-w-0 overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
            {/* Header */}
            <div className="mb-3 flex w-full flex-shrink-0 min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-s2p-fg">Pipeline</h2>
                    <p className="text-xs text-s2p-muted mt-0.5">
                        {leads.length} leads · {formatCurrency(leads.reduce((s, l) => s + (l.estimatedValue || 0), 0))} total value
                    </p>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative w-full sm:w-auto">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-s2p-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search leads..."
                            className="w-full max-w-full rounded-lg border border-s2p-border bg-white py-1.5 pl-8 pr-3 text-xs transition-all focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 sm:w-48"
                        />
                    </div>
                    <button
                        onClick={() => navigate('/dashboard/scoping/new')}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-s2p-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-s2p-accent sm:w-auto whitespace-nowrap"
                    >
                        <Plus size={14} />
                        New Opportunity
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div data-tour="pipeline-board" className="flex-1 w-full min-w-0 min-h-0 overflow-x-auto overflow-y-hidden xl:overflow-x-hidden">
                <div className="flex h-full min-w-max gap-3 pb-2 xl:min-w-0 xl:grid xl:grid-cols-8">
                    {KANBAN_STAGES.map(stage => {
                        const stageLeads = leadsByStage(stage.id);
                        const count = stageCount(stage.id);
                        const value = stageValue(stage.id);
                        const isOver = dragOverStage === stage.id;

                        return (
                            <div
                                key={stage.id}
                                className="w-72 flex-shrink-0 flex flex-col h-full xl:w-auto xl:min-w-0"
                                onDragOver={e => handleDragOver(e, stage.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, stage.id)}
                            >
                                {/* Column header */}
                                <div className={cn(
                                    'flex items-center gap-2 px-3 py-2.5 rounded-t-lg bg-white border border-slate-200 border-b-0 flex-shrink-0 transition-colors',
                                    isOver && 'border-blue-300',
                                )}>
                                    <div className={cn('w-2 h-2 rounded-full', stageDotMap[stage.color])} />
                                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{stage.label}</span>
                                    <span className={cn(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center',
                                        stageBadgeMap[stage.color],
                                    )}>
                                        {count}
                                    </span>
                                </div>

                                {/* Value bar */}
                                {value > 0 && (
                                    <div className={cn(
                                        'px-3 py-1 bg-white border-x border-slate-200 flex-shrink-0 transition-colors',
                                        isOver && 'border-blue-300',
                                    )}>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {formatCurrency(value)}
                                        </span>
                                    </div>
                                )}

                                {/* Cards scroll container */}
                                <div className={cn(
                                    'flex-1 min-h-0 rounded-b-lg border border-slate-200 border-t-0 overflow-y-auto p-2 space-y-2 transition-all duration-150',
                                    isOver
                                        ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-200 ring-inset'
                                        : 'bg-slate-50/70',
                                )}>
                                    {stageLeads.map(lead => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            stageColor={stage.color}
                                            onDragStart={() => handleDragStart(lead.id)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => navigate(`/dashboard/scoping/${lead.id}`)}
                                        />
                                    ))}
                                    {stageLeads.length === 0 && (
                                        <div className={cn(
                                            'flex items-center justify-center py-12 text-xs italic transition-colors',
                                            isOver ? 'text-blue-300' : 'text-slate-300',
                                        )}>
                                            {isOver ? 'Drop here' : 'No leads'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Lead Card ──

function LeadCard({
    lead,
    stageColor,
    onDragStart,
    onDragEnd,
    onClick,
}: {
    lead: Lead;
    stageColor: string;
    onDragStart: () => void;
    onDragEnd: () => void;
    onClick: () => void;
}) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        // Store the lead id in dataTransfer as a fallback (not read, but required for Firefox)
        e.dataTransfer.setData('text/plain', String(lead.id));
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
        onDragStart();
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        onDragEnd();
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
            transition={{ duration: 0.15 }}
        >
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            aria-label={`Open scoping form for ${lead.projectName || 'Untitled Project'}`}
            className={cn(
                'w-full text-left bg-white rounded-lg border p-3 transition-all group cursor-pointer select-none',
                isDragging
                    ? 'border-blue-300 shadow-lg ring-2 ring-blue-100 opacity-40'
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-sm',
            )}
        >
            {/* Project name */}
            <div className="flex items-start justify-between mb-1">
                <div className="text-xs font-semibold text-slate-700 truncate flex-1 mr-2">
                    {lead.projectName || 'Untitled Project'}
                </div>
                <ChevronRight
                    size={12}
                    className="flex-shrink-0 mt-0.5 text-slate-300 group-hover:text-blue-400 transition-colors"
                />
            </div>

            {/* Client */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate mb-1">
                <Building2 size={10} className="flex-shrink-0" />
                <span className="truncate">{lead.clientName || '—'}</span>
            </div>

            {/* Value */}
            {lead.estimatedValue ? (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium mb-1">
                    <DollarSign size={10} className="flex-shrink-0" />
                    {formatCurrency(lead.estimatedValue)}
                </div>
            ) : null}

            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                {lead.priority && (
                    <span className={cn(
                        'text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded',
                        lead.priority === 'high'   ? 'bg-red-50 text-red-500' :
                        lead.priority === 'medium' ? 'bg-amber-50 text-amber-500' :
                                                     'bg-slate-50 text-slate-400',
                    )}>
                        {lead.priority}
                    </span>
                )}
                <span className="text-[9px] text-slate-300 font-mono ml-auto">
                    {formatDate(lead.createdAt)}
                </span>
            </div>
        </div>
        </motion.div>
    );
}
