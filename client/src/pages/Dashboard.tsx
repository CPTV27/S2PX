import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, FolderKanban, TrendingUp, Target, Loader2 } from 'lucide-react';
import { fetchKpiStats } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import type { KpiStats } from '@/types';

export function Dashboard() {
    const [stats, setStats] = useState<KpiStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchKpiStats()
            .then(setStats)
            .finally(() => setIsLoading(false));
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    const kpis = [
        { label: 'Total Leads', value: stats?.totalLeads ?? 0, icon: Users, change: 'Pipeline', color: 'text-blue-500 bg-blue-50' },
        { label: 'Active Projects', value: stats?.activeProjects ?? 0, icon: FolderKanban, change: 'In Progress', color: 'text-purple-500 bg-purple-50' },
        { label: 'Revenue (MTD)', value: formatCurrency(stats?.revenueMTD ?? 0), icon: TrendingUp, change: 'Won Deals', color: 'text-green-500 bg-green-50' },
        { label: 'Win Rate', value: `${stats?.winRate ?? 0}%`, icon: Target, change: 'Closed Leads', color: 'text-orange-500 bg-orange-50' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-s2p-fg">Dashboard</h2>
                <p className="text-s2p-muted text-sm mt-1">Overview of your S2PX operations.</p>
            </div>

            {/* KPI Cards */}
            <div data-tour="kpi-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi, i) => (
                    <motion.div
                        key={kpi.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-s2p-border rounded-2xl p-6 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${kpi.color}`}>
                                <kpi.icon size={20} />
                            </div>
                            <span className="text-xs font-mono text-s2p-muted bg-s2p-secondary px-2 py-1 rounded-full">
                                {kpi.change}
                            </span>
                        </div>
                        <div className="text-3xl font-bold text-s2p-fg mb-1">{kpi.value}</div>
                        <div className="text-sm text-s2p-muted">{kpi.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Placeholder sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8"
                >
                    <h3 className="text-lg font-semibold mb-4">Recent Leads</h3>
                    <p className="text-s2p-muted text-sm">Navigate to Pipeline for full lead management →</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8"
                >
                    <h3 className="text-lg font-semibold mb-4">Active Projects</h3>
                    <p className="text-s2p-muted text-sm">Navigate to Projects for delivery tracking →</p>
                </motion.div>
            </div>
        </div>
    );
}
