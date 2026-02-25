import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { fetchLeads } from '@/services/api';
import { formatCurrency } from '@/lib/utils';

export function Revenue() {
    const [isLoading, setIsLoading] = useState(true);
    const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
    const [totalRevenue, setTotalRevenue] = useState(0);

    useEffect(() => {
        async function loadData() {
            try {
                const leads = await fetchLeads();
                const wonLeads = leads.filter(l => l.status === 'won');
                setTotalRevenue(wonLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0));

                // Group won leads by month
                const byMonth: Record<string, number> = {};
                wonLeads.forEach(l => {
                    const date = new Date(l.createdAt);
                    const key = date.toLocaleDateString('en-US', { month: 'short' });
                    byMonth[key] = (byMonth[key] || 0) + (l.estimatedValue || 0);
                });

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                setRevenueData(months.slice(0, new Date().getMonth() + 1).map(m => ({
                    month: m,
                    revenue: byMonth[m] || 0,
                })));
            } catch (e) {
                console.error('Revenue load failed:', e);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    const stats = [
        { label: 'Total Revenue (YTD)', value: formatCurrency(totalRevenue), change: '+', trend: 'up' as const },
        { label: 'Avg Deal Size', value: formatCurrency(revenueData.length > 0 ? totalRevenue / Math.max(revenueData.filter(r => r.revenue > 0).length, 1) : 0), change: 'Avg', trend: 'up' as const },
        { label: 'Monthly Run Rate', value: formatCurrency(totalRevenue / Math.max(new Date().getMonth() + 1, 1)), change: 'Rate', trend: 'up' as const },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-s2p-fg">Revenue</h2>
                <p className="text-s2p-muted text-sm mt-1">Financial overview from won deals.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-s2p-border rounded-2xl p-6"
                    >
                        <div className="text-sm text-s2p-muted mb-2">{stat.label}</div>
                        <div className="text-3xl font-bold text-s2p-fg mb-2">{stat.value}</div>
                        <div className="flex items-center text-xs font-mono text-green-500">
                            <ArrowUpRight size={14} className="mr-1" />
                            {stat.change}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8 h-[400px] flex flex-col"
                >
                    <h3 className="text-lg font-semibold mb-6">Monthly Revenue</h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#E2E8F0', borderRadius: 12 }}
                                    formatter={(val) => formatCurrency(val as number)}
                                />
                                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} />
                                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                                    {revenueData.map((_, i) => (
                                        <Cell key={i} fill={i === revenueData.length - 1 ? '#2563EB' : '#3B82F6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8 h-[400px] flex flex-col"
                >
                    <h3 className="text-lg font-semibold mb-6">Growth Trajectory</h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueData}>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#E2E8F0', borderRadius: 12 }}
                                    formatter={(val) => formatCurrency(val as number)}
                                />
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} />
                                <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
