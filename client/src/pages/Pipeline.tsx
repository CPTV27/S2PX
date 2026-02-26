import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Plus, Search, Loader2, Building2, DollarSign, Calendar,
    X, ExternalLink, ArrowRight, ChevronRight, MapPin,
    Mail, Phone, FileText, Hash,
} from 'lucide-react';
import { fetchLeads, fetchLead } from '@/services/api';
import { cn, formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { Lead } from '@/types';

// ── Kanban stage definitions ──

interface StageColumn {
    id: string;
    label: string;
    color: string;       // dot + badge
    headerBg: string;    // column header accent
}

const KANBAN_STAGES: StageColumn[] = [
    { id: 'lead',        label: 'Lead',         color: 'slate',  headerBg: 'bg-slate-400' },
    { id: 'contacted',   label: 'Contacted',    color: 'sky',    headerBg: 'bg-sky-400' },
    { id: 'qualified',   label: 'Qualified',    color: 'blue',   headerBg: 'bg-blue-400' },
    { id: 'proposal',    label: 'Proposal',     color: 'indigo', headerBg: 'bg-indigo-400' },
    { id: 'negotiation', label: 'Negotiation',  color: 'violet', headerBg: 'bg-violet-400' },
    { id: 'in_hand',     label: 'In Hand',      color: 'amber',  headerBg: 'bg-amber-400' },
    { id: 'won',         label: 'Won',          color: 'emerald',headerBg: 'bg-emerald-500' },
    { id: 'lost',        label: 'Lost',         color: 'red',    headerBg: 'bg-red-400' },
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

// Map lead status to a kanban column
function mapToKanbanStage(status: string): string {
    // Normalize: "leads" → "lead", "closed_won" → "won", etc.
    const s = status.toLowerCase().replace(/ /g, '_');
    if (s === 'leads' || s === 'new') return 'lead';
    if (s === 'closed_won') return 'won';
    if (s === 'closed_lost') return 'lost';
    if (s === 'urgent') return 'in_hand'; // urgent maps to in_hand column
    // Direct matches
    if (KANBAN_STAGES.some(ks => ks.id === s)) return s;
    return 'lead'; // fallback
}

// ── Main Component ──

export function Pipeline() {
    const navigate = useNavigate();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [drawerLoading, setDrawerLoading] = useState(false);

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

    const handleCardClick = async (lead: Lead) => {
        setSelectedLead(lead);
        try {
            setDrawerLoading(true);
            const full = await fetchLead(lead.id);
            setSelectedLead(full);
        } catch {
            // keep basic data
        } finally {
            setDrawerLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-s2p-fg">Pipeline</h2>
                    <p className="text-xs text-s2p-muted mt-0.5">
                        {leads.length} leads · {formatCurrency(leads.reduce((s, l) => s + (l.estimatedValue || 0), 0))} total value
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-s2p-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search leads..."
                            className="bg-white border border-s2p-border rounded-lg pl-8 pr-3 py-1.5 text-xs w-48 focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                        />
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-s2p-primary text-white rounded-lg font-medium text-xs hover:bg-s2p-accent transition-colors shadow-sm">
                        <Plus size={14} />
                        New Lead
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-3 h-full min-w-max pb-2">
                    {KANBAN_STAGES.map(stage => {
                        const stageLeads = leadsByStage(stage.id);
                        const count = stageCount(stage.id);
                        const value = stageValue(stage.id);
                        return (
                            <div key={stage.id} className="w-72 flex-shrink-0 flex flex-col h-full">
                                {/* Column header */}
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg bg-white border border-slate-200 border-b-0 flex-shrink-0">
                                    <div className={cn('w-2 h-2 rounded-full', stageDotMap[stage.color])} />
                                    <span className="text-xs font-semibold text-slate-700 flex-1">{stage.label}</span>
                                    <span className={cn(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center',
                                        stageBadgeMap[stage.color],
                                    )}>
                                        {count}
                                    </span>
                                </div>
                                {/* Value bar */}
                                {value > 0 && (
                                    <div className="px-3 py-1 bg-white border-x border-slate-200 flex-shrink-0">
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {formatCurrency(value)}
                                        </span>
                                    </div>
                                )}

                                {/* Cards scroll container */}
                                <div className="flex-1 min-h-0 bg-slate-50/70 rounded-b-lg border border-slate-200 border-t-0 overflow-y-auto p-2 space-y-2">
                                    {stageLeads.map(lead => (
                                        <LeadCard
                                            key={lead.id}
                                            lead={lead}
                                            stageColor={stage.color}
                                            isSelected={lead.id === selectedLead?.id}
                                            onClick={() => handleCardClick(lead)}
                                        />
                                    ))}
                                    {stageLeads.length === 0 && (
                                        <div className="flex items-center justify-center py-12 text-xs text-slate-300 italic">
                                            No leads
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Lead Detail Drawer */}
            <AnimatePresence>
                {selectedLead && (
                    <LeadDrawer
                        lead={selectedLead}
                        loading={drawerLoading}
                        onClose={() => setSelectedLead(null)}
                        onNavigate={(id) => navigate(`/dashboard/scoping/${id}`)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Lead Card ──

function LeadCard({
    lead,
    stageColor,
    isSelected,
    onClick,
}: {
    lead: Lead;
    stageColor: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full text-left bg-white rounded-lg border p-3 transition-all group cursor-pointer',
                isSelected
                    ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
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
                    className={cn(
                        'flex-shrink-0 mt-0.5 transition-colors',
                        isSelected ? 'text-blue-400' : 'text-slate-300 group-hover:text-blue-400',
                    )}
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
                        lead.priority === 'high' ? 'bg-red-50 text-red-500' :
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
        </button>
    );
}

// ── Lead Drawer ──

function LeadDrawer({
    lead,
    loading,
    onClose,
    onNavigate,
}: {
    lead: Lead;
    loading: boolean;
    onClose: () => void;
    onNavigate: (id: number) => void;
}) {
    const stageInfo = KANBAN_STAGES.find(s => s.id === mapToKanbanStage(lead.status));

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/20 z-50"
                onClick={onClose}
            />

            {/* Drawer */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                        <button
                            onClick={() => onNavigate(lead.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Open Scoping Form
                            <ExternalLink size={12} />
                        </button>
                    </div>

                    {stageInfo && (
                        <span className={cn(
                            'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-2',
                            stageBadgeMap[stageInfo.color],
                        )}>
                            {stageInfo.label}
                        </span>
                    )}

                    <h2 className="text-lg font-bold text-slate-800 leading-tight">
                        {lead.projectName || 'Untitled Project'}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {lead.clientName || '—'}
                        </span>
                        {lead.projectAddress && (
                            <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {lead.projectAddress}
                            </span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="animate-spin text-blue-400" size={18} />
                        </div>
                    )}

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-slate-100">
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Value</div>
                            <div className="text-sm font-bold text-slate-700">
                                {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : '—'}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">SqFt</div>
                            <div className="text-sm font-bold text-slate-700">
                                {lead.squareFootage ? lead.squareFootage.toLocaleString() : '—'}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Priority</div>
                            <div className={cn(
                                'text-sm font-bold capitalize',
                                lead.priority === 'high' ? 'text-red-500' :
                                lead.priority === 'medium' ? 'text-amber-500' : 'text-slate-400',
                            )}>
                                {lead.priority || '—'}
                            </div>
                        </div>
                    </div>

                    {/* Contact info */}
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact</h3>
                        <div className="space-y-2">
                            {lead.contactName && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Hash size={12} className="text-slate-400" />
                                    {lead.contactName}
                                </div>
                            )}
                            {lead.contactEmail && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Mail size={12} className="text-slate-400" />
                                    {lead.contactEmail}
                                </div>
                            )}
                            {lead.contactPhone && (
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Phone size={12} className="text-slate-400" />
                                    {lead.contactPhone}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="px-5 py-4">
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Details</h3>
                        <div className="space-y-2">
                            {lead.buildingType && (
                                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                    <span className="text-xs text-slate-500">Building Type</span>
                                    <span className="text-xs font-medium text-slate-700">{lead.buildingType}</span>
                                </div>
                            )}
                            {lead.source && (
                                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                    <span className="text-xs text-slate-500">Source</span>
                                    <span className="text-xs font-medium text-slate-700">{lead.source}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                <span className="text-xs text-slate-500">Created</span>
                                <span className="text-xs font-medium text-slate-700">{formatDate(lead.createdAt)}</span>
                            </div>
                            {lead.updatedAt && (
                                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                    <span className="text-xs text-slate-500">Updated</span>
                                    <span className="text-xs font-medium text-slate-700">{formatDate(lead.updatedAt)}</span>
                                </div>
                            )}
                            {lead.notes && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Notes</span>
                                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0">
                    <button
                        onClick={() => onNavigate(lead.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Open Scoping Form
                        <ArrowRight size={13} />
                    </button>
                </div>
            </motion.div>
        </>
    );
}
