import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Filter, Loader2, Building2, DollarSign, Calendar } from 'lucide-react';
import { fetchLeads } from '@/services/api';
import { cn, formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { Lead } from '@/types';

const STAGES = ['all', 'lead', 'qualified', 'proposal', 'negotiation', 'in_hand', 'urgent', 'won', 'lost'];

export function Pipeline() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeStage, setActiveStage] = useState('all');

    useEffect(() => {
        fetchLeads()
            .then(setLeads)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, []);

    const filteredLeads = leads.filter(lead => {
        const matchesSearch = !search ||
            lead.clientName?.toLowerCase().includes(search.toLowerCase()) ||
            lead.projectName?.toLowerCase().includes(search.toLowerCase());
        const matchesStage = activeStage === 'all' || lead.status === activeStage;
        return matchesSearch && matchesStage;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Pipeline</h2>
                    <p className="text-s2p-muted text-sm mt-1">{leads.length} total leads</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-s2p-primary text-white rounded-xl font-medium text-sm hover:bg-s2p-accent transition-colors shadow-sm">
                    <Plus size={16} />
                    New Lead
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-s2p-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search leads..."
                        className="w-full bg-white border border-s2p-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                    />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {STAGES.map(stage => (
                        <button
                            key={stage}
                            onClick={() => setActiveStage(stage)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                                activeStage === stage
                                    ? "bg-s2p-primary text-white"
                                    : "bg-s2p-secondary text-s2p-muted hover:text-s2p-fg"
                            )}
                        >
                            {stage === 'all' ? 'All' : stage.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lead Cards */}
            <div className="space-y-3">
                {filteredLeads.map((lead, i) => (
                    <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-white border border-s2p-border rounded-xl p-5 hover:shadow-md hover:border-s2p-primary/30 transition-all cursor-pointer group"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-semibold text-s2p-fg group-hover:text-s2p-primary transition-colors">
                                        {lead.projectName || 'Untitled Project'}
                                    </h3>
                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-mono uppercase", getStatusColor(lead.status))}>
                                        {lead.status?.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-s2p-muted">
                                    <span className="flex items-center gap-1">
                                        <Building2 size={13} />
                                        {lead.clientName}
                                    </span>
                                    {lead.estimatedValue && (
                                        <span className="flex items-center gap-1">
                                            <DollarSign size={13} />
                                            {formatCurrency(lead.estimatedValue)}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Calendar size={13} />
                                        {formatDate(lead.createdAt)}
                                    </span>
                                </div>
                            </div>
                            {lead.priority && (
                                <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-mono uppercase",
                                    lead.priority === 'high' ? "bg-red-50 text-red-600" :
                                        lead.priority === 'medium' ? "bg-yellow-50 text-yellow-600" :
                                            "bg-slate-50 text-slate-500"
                                )}>
                                    {lead.priority}
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}

                {filteredLeads.length === 0 && (
                    <div className="text-center py-16 text-s2p-muted">
                        <Filter size={32} className="mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No leads match your filters</p>
                        <p className="text-sm mt-1">Try adjusting your search or filter criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
