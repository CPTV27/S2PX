import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronRight, Building2, Calendar, DollarSign, Banknote } from 'lucide-react';
import { fetchScopingForms, type ScopingFormData } from '@/services/api';
import { DEAL_STAGES, FORM_STATUSES } from '@shared/schema/constants';
import { cn } from '@/lib/utils';

const stageBadgeColors: Record<string, string> = {
    Lead: 'bg-slate-100 text-slate-700',
    Qualified: 'bg-blue-100 text-blue-700',
    Proposal: 'bg-purple-100 text-purple-700',
    Negotiation: 'bg-amber-100 text-amber-700',
    'In Hand': 'bg-green-100 text-green-700',
    Urgent: 'bg-red-100 text-red-700',
    Lost: 'bg-slate-200 text-slate-500',
};

export function ScopingList() {
    const navigate = useNavigate();
    const [forms, setForms] = useState<ScopingFormData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('');

    useEffect(() => {
        fetchScopingForms(stageFilter ? { dealStage: stageFilter } : undefined)
            .then(setForms)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [stageFilter]);

    const filtered = forms.filter(f => {
        if (f.status === 'deleted') return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            f.clientCompany?.toLowerCase().includes(q) ||
            f.projectName?.toLowerCase().includes(q) ||
            f.upid?.toLowerCase().includes(q) ||
            f.projectAddress?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">Scoping Forms</h1>
                    <p className="text-sm text-slate-400 mt-0.5">{filtered.length} forms</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/scoping/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} />
                    New Form
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Search by client, project, or UPID..."
                    />
                </div>

                <div className="relative">
                    <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                        value={stageFilter}
                        onChange={e => setStageFilter(e.target.value)}
                        className="pl-8 pr-8 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-500 focus:outline-none appearance-none"
                    >
                        <option value="">All Stages</option>
                        {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-400 text-sm">No scoping forms yet.</p>
                    <button
                        onClick={() => navigate('/dashboard/scoping/new')}
                        className="mt-3 text-sm text-blue-600 hover:underline"
                    >
                        Create your first one
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(form => (
                        <Link
                            key={form.id}
                            to={`/dashboard/scoping/${form.id}`}
                            className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                                <Building2 size={18} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-slate-900 truncate">{form.projectName || 'Untitled'}</span>
                                    {form.upid && (
                                        <span className="text-[10px] font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{form.upid}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                    <span>{form.clientCompany || '—'}</span>
                                    {form.projectAddress && (
                                        <>
                                            <span className="text-slate-200">|</span>
                                            <span className="truncate">{form.projectAddress}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {form.dealStage && (
                                    <span className={cn(
                                        'text-[10px] font-medium px-2 py-1 rounded-full',
                                        stageBadgeColors[form.dealStage] || 'bg-slate-100 text-slate-600'
                                    )}>
                                        {form.dealStage}
                                    </span>
                                )}

                                <span className={cn(
                                    'text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded',
                                    form.status === 'draft' && 'bg-slate-100 text-slate-500',
                                    form.status === 'complete' && 'bg-green-50 text-green-600',
                                    form.status === 'priced' && 'bg-purple-50 text-purple-600',
                                    form.status === 'quoted' && 'bg-blue-50 text-blue-600',
                                )}>
                                    {form.status}
                                </span>

                                {(form.status === 'complete' || form.status === 'priced') && (
                                    <Link
                                        to={`/dashboard/deals/${form.id}`}
                                        onClick={e => e.stopPropagation()}
                                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                    >
                                        <Banknote size={12} />
                                        Price
                                    </Link>
                                )}

                                <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
