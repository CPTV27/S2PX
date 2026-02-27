import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    Activity, TrendingUp, Target, DollarSign, Gauge, ShieldCheck, Timer,
    Zap, ArrowUpRight, ArrowDownRight, Loader2, Milestone, Scan, Package,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, PieChart, Pie, Legend,
} from 'recharts';
import {
    fetchScorecardOverview, fetchPipelineReport,
    fetchProductionReport, fetchProfitabilityReport,
} from '@/services/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { ScorecardOverview, PipelineReport, ProductionReport, ProfitabilityReport } from '@shared/types/scorecard';

const TABS = ['Overview', 'Pipeline', 'Production', 'Profitability'] as const;
type Tab = typeof TABS[number];

const TIME_RANGES = [
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: '12M', months: 12 },
    { label: 'All', months: 120 },
];

const STAGE_LABELS: Record<string, string> = {
    scoping: 'Scoping', field_capture: 'Field', registration: 'Registration',
    bim_qc: 'BIM QC', pc_delivery: 'PC Delivery', final_delivery: 'Final',
};

const STAGE_COLORS: Record<string, string> = {
    scoping: '#3B82F6', field_capture: '#06B6D4', registration: '#6366F1',
    bim_qc: '#8B5CF6', pc_delivery: '#F59E0B', final_delivery: '#10B981',
};

const CHART_TOOLTIP = { backgroundColor: '#fff', borderColor: '#E2E8F0', borderRadius: 12 };
const AXIS_STYLE = { stroke: '#94A3B8', fontSize: 12, tickLine: false as const, axisLine: false as const };

export function Scorecard() {
    const [tab, setTab] = useState<Tab>('Overview');
    const [months, setMonths] = useState(12);
    const [isLoading, setIsLoading] = useState(true);
    const [overview, setOverview] = useState<ScorecardOverview | null>(null);
    const [pipeline, setPipeline] = useState<PipelineReport | null>(null);
    const [production, setProduction] = useState<ProductionReport | null>(null);
    const [profitability, setProfitability] = useState<ProfitabilityReport | null>(null);

    useEffect(() => {
        setIsLoading(true);
        const filters = { months };
        Promise.all([
            fetchScorecardOverview(filters).catch(() => null),
            fetchPipelineReport(filters).catch(() => null),
            fetchProductionReport(filters).catch(() => null),
            fetchProfitabilityReport(filters).catch(() => null),
        ]).then(([o, p, pr, prof]) => {
            setOverview(o);
            setPipeline(p);
            setProduction(pr);
            setProfitability(prof);
        }).finally(() => setIsLoading(false));
    }, [months]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Scorecard</h2>
                    <p className="text-s2p-muted text-sm mt-1">Executive operations dashboard.</p>
                </div>
                <div className="flex gap-2">
                    {TIME_RANGES.map(r => (
                        <button
                            key={r.label}
                            onClick={() => setMonths(r.months)}
                            className={cn(
                                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                                months === r.months
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            )}
                        >{r.label}</button>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-s2p-border">
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            tab === t
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-s2p-muted hover:text-s2p-fg'
                        )}
                    >{t}</button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'Overview' && <OverviewTab data={overview} />}
            {tab === 'Pipeline' && <PipelineTab data={pipeline} />}
            {tab === 'Production' && <ProductionTab data={production} />}
            {tab === 'Profitability' && <ProfitabilityTab data={profitability} />}
        </div>
    );
}

// ── KPI Card Component ──
function KpiCard({ label, value, icon: Icon, chip, color, delay = 0 }: {
    label: string; value: string | number; icon: any; chip: string;
    color: string; delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white border border-s2p-border rounded-2xl p-6 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon size={20} />
                </div>
                <span className="text-xs font-mono text-s2p-muted bg-s2p-secondary px-2 py-1 rounded-full">
                    {chip}
                </span>
            </div>
            <div className="text-3xl font-bold text-s2p-fg mb-1">{value}</div>
            <div className="text-sm text-s2p-muted">{label}</div>
        </motion.div>
    );
}

// ── Chart Card Wrapper ──
function ChartCard({ title, delay = 0, children, className = '' }: {
    title: string; delay?: number; children: React.ReactNode; className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
            className={cn('bg-white border border-s2p-border rounded-2xl p-8 flex flex-col', className)}
        >
            <h3 className="text-lg font-semibold mb-6">{title}</h3>
            <div className="flex-1 min-h-0">{children}</div>
        </motion.div>
    );
}

// ═══════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════

function OverviewTab({ data }: { data: ScorecardOverview | null }) {
    if (!data) return <EmptyState />;

    const kpis = [
        { label: 'Win Rate', value: `${data.winRate}%`, icon: Target,
            chip: 'Closed', color: kpiColor(data.winRate, 40, 25) },
        { label: 'Estimated Revenue', value: formatCurrency(data.totalRevenue), icon: DollarSign,
            chip: 'Quotes', color: 'text-slate-500 bg-slate-100' },
        { label: 'Actual Revenue (QBO)', value: formatCurrency(data.actualRevenue), icon: Activity,
            chip: 'All-Time', color: 'text-emerald-500 bg-emerald-50' },
        { label: 'YTD Actual Revenue', value: formatCurrency(data.ytdActualRevenue), icon: ArrowUpRight,
            chip: new Date().getFullYear().toString(), color: 'text-blue-500 bg-blue-50' },
        { label: 'Blended Margin', value: `${data.blendedMarginPct}%`, icon: TrendingUp,
            chip: 'Margin', color: kpiColor(data.blendedMarginPct, 45, 40) },
        { label: 'Avg Deal Size', value: formatCurrency(data.avgDealSize), icon: Zap,
            chip: 'Won', color: 'text-blue-500 bg-blue-50' },
        { label: 'Pipeline Value', value: formatCurrency(data.activePipelineValue), icon: Milestone,
            chip: 'Weighted', color: 'text-purple-500 bg-purple-50' },
        { label: 'Avg Cycle Time', value: `${data.avgCycleDays}d`, icon: Timer,
            chip: 'Delivered', color: kpiColor(data.avgCycleDays, 30, 60, true) },
        { label: 'RMS Pass Rate', value: `${data.rmsPassRate}%`, icon: Scan,
            chip: '≤5mm', color: kpiColor(data.rmsPassRate, 90, 70) },
        { label: 'QC Pass Rate', value: `${data.qcPassRate}%`, icon: ShieldCheck,
            chip: 'BIM QC', color: kpiColor(data.qcPassRate, 85, 70) },
    ];

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {kpis.map((k, i) => (
                    <KpiCard key={k.label} {...k} delay={i * 0.08} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartCard title="Monthly Revenue: Actual vs Estimated" delay={0.3} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.monthlyRevenue}>
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => formatCurrency(v as number)} />
                            <XAxis dataKey="month" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} tickFormatter={v => `$${v / 1000}k`} />
                            <Bar dataKey="actualRevenue" name="Actual (QBO)" fill="#10B981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="revenue" name="Estimated" fill="#3B82F6" radius={[6, 6, 0, 0]} opacity={0.5} />
                            <Bar dataKey="cost" name="Cost" fill="#94A3B8" radius={[6, 6, 0, 0]} opacity={0.4} />
                            <Legend />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Win Rate Trend" delay={0.4} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.monthlyWinRate}>
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v, name) => name === 'rate' ? `${v}%` : v} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="month" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} tickFormatter={v => `${v}%`} />
                            <Line type="monotone" dataKey="rate" name="Win Rate" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
        </>
    );
}

// ═══════════════════════════════════════
// PIPELINE TAB
// ═══════════════════════════════════════

function PipelineTab({ data }: { data: PipelineReport | null }) {
    if (!data) return <EmptyState />;

    const FUNNEL_COLORS: Record<string, string> = {
        Lead: '#3B82F6', Qualified: '#6366F1', Proposal: '#F59E0B',
        Negotiation: '#F97316', 'In Hand': '#10B981', Urgent: '#EF4444', Lost: '#94A3B8',
    };

    return (
        <>
            {/* Tier stat cards */}
            {data.avgDealByTier.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.avgDealByTier.map((t, i) => (
                        <KpiCard
                            key={t.tier}
                            label={`${t.tier} Avg Deal`}
                            value={formatCurrency(t.avgValue)}
                            icon={Package}
                            chip={`${t.count} deals`}
                            color={t.tier === 'Whale' ? 'text-blue-500 bg-blue-50' : t.tier === 'Dolphin' ? 'text-indigo-500 bg-indigo-50' : 'text-slate-500 bg-slate-100'}
                            delay={i * 0.1}
                        />
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartCard title="Deal Funnel" delay={0.2} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.funnel} layout="vertical">
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => formatCurrency(v as number)} />
                            <XAxis type="number" {...AXIS_STYLE} tickFormatter={v => `$${v / 1000}k`} />
                            <YAxis type="category" dataKey="stage" {...AXIS_STYLE} width={90} />
                            <Bar dataKey="totalValue" name="Total Value" radius={[0, 6, 6, 0]}>
                                {data.funnel.map((f, i) => (
                                    <Cell key={i} fill={FUNNEL_COLORS[f.stage] || '#94A3B8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Monthly Pipeline Activity" delay={0.3} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.monthlyTrend}>
                            <Tooltip contentStyle={CHART_TOOLTIP} />
                            <XAxis dataKey="month" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} />
                            <Bar dataKey="newCount" name="New" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="wonCount" name="Won" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="lostCount" name="Lost" fill="#EF4444" radius={[4, 4, 0, 0]} />
                            <Legend />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Win rate by source */}
            {data.winRateBySource.length > 0 && (
                <ChartCard title="Win Rate by Lead Source" delay={0.4} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.winRateBySource} layout="vertical">
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => `${v}%`} />
                            <XAxis type="number" {...AXIS_STYLE} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                            <YAxis type="category" dataKey="source" {...AXIS_STYLE} width={120} />
                            <Bar dataKey="winRate" name="Win Rate" fill="#2563EB" radius={[0, 6, 6, 0]}>
                                {data.winRateBySource.map((s, i) => (
                                    <Cell key={i} fill={s.winRate >= 50 ? '#10B981' : s.winRate >= 25 ? '#F59E0B' : '#EF4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </>
    );
}

// ═══════════════════════════════════════
// PRODUCTION TAB
// ═══════════════════════════════════════

function ProductionTab({ data }: { data: ProductionReport | null }) {
    if (!data) return <EmptyState />;

    const qg = data.qualityGates;

    return (
        <>
            {/* Quality gate cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard
                    label="Field RMS Pass Rate"
                    value={`${qg.fieldRms.passRate}%`}
                    icon={Scan}
                    chip={`${qg.fieldRms.pass}/${qg.fieldRms.total}`}
                    color={kpiColor(qg.fieldRms.passRate, 90, 70)}
                    delay={0}
                />
                <KpiCard
                    label="Avg Overlap Pass Rate"
                    value={`${qg.avgOverlap.passRate}%`}
                    icon={Gauge}
                    chip={`${qg.avgOverlap.pass}/${qg.avgOverlap.total}`}
                    color={kpiColor(qg.avgOverlap.passRate, 90, 70)}
                    delay={0.1}
                />
                <KpiCard
                    label="QC Pass Rate"
                    value={qg.qcStatus.total > 0 ? `${Math.round((qg.qcStatus.pass / qg.qcStatus.total) * 100)}%` : '—'}
                    icon={ShieldCheck}
                    chip={`${qg.qcStatus.pass}P / ${qg.qcStatus.fail}F / ${qg.qcStatus.conditional}C`}
                    color={kpiColor(qg.qcStatus.total > 0 ? (qg.qcStatus.pass / qg.qcStatus.total) * 100 : 0, 85, 70)}
                    delay={0.2}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Stage distribution */}
                <ChartCard title="Stage Distribution" delay={0.3} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.stageDistribution}>
                            <Tooltip contentStyle={CHART_TOOLTIP} />
                            <XAxis dataKey="stage" {...AXIS_STYLE} tickFormatter={v => STAGE_LABELS[v] || v} />
                            <YAxis {...AXIS_STYLE} />
                            <Bar dataKey="count" name="Projects" radius={[6, 6, 0, 0]}>
                                {data.stageDistribution.map((s, i) => (
                                    <Cell key={i} fill={STAGE_COLORS[s.stage] || '#94A3B8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Monthly throughput */}
                <ChartCard title="Monthly Throughput" delay={0.4} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.monthlyThroughput}>
                            <Tooltip contentStyle={CHART_TOOLTIP} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="month" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} />
                            <Line type="monotone" dataKey="started" name="Started" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                            <Legend />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Estimate vs Actual SF table */}
            {data.estimateVsActual.byProject.length > 0 && (
                <ChartCard title="Estimate vs Actual SF" delay={0.5}>
                    <div className="flex items-center gap-6 mb-4 text-sm">
                        <div>Est Total: <span className="font-bold">{data.estimateVsActual.totalEstSF.toLocaleString()} SF</span></div>
                        <div>Actual: <span className="font-bold">{data.estimateVsActual.totalActualSF.toLocaleString()} SF</span></div>
                        <div className={cn(
                            'font-mono font-bold',
                            data.estimateVsActual.variancePct > 0 ? 'text-amber-600' : 'text-green-600'
                        )}>
                            {data.estimateVsActual.variancePct > 0 ? '+' : ''}{data.estimateVsActual.variancePct}%
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-s2p-border bg-slate-50/50">
                                    <th className="text-left py-2 px-3 font-medium text-s2p-muted">UPID</th>
                                    <th className="text-left py-2 px-3 font-medium text-s2p-muted">Project</th>
                                    <th className="text-right py-2 px-3 font-medium text-s2p-muted">Est SF</th>
                                    <th className="text-right py-2 px-3 font-medium text-s2p-muted">Actual SF</th>
                                    <th className="text-right py-2 px-3 font-medium text-s2p-muted">Variance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.estimateVsActual.byProject.map(p => (
                                    <tr key={p.upid} className="border-b border-s2p-border/50 hover:bg-blue-50/40">
                                        <td className="py-2 px-3 font-mono text-xs">{p.upid}</td>
                                        <td className="py-2 px-3">{p.projectName}</td>
                                        <td className="py-2 px-3 text-right font-mono">{p.estSF.toLocaleString()}</td>
                                        <td className="py-2 px-3 text-right font-mono">{p.actualSF.toLocaleString()}</td>
                                        <td className={cn(
                                            'py-2 px-3 text-right font-mono font-bold',
                                            p.variancePct > 5 ? 'text-amber-600' : p.variancePct < -5 ? 'text-green-600' : 'text-slate-500'
                                        )}>
                                            {p.variancePct > 0 ? '+' : ''}{p.variancePct}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>
            )}
        </>
    );
}

// ═══════════════════════════════════════
// PROFITABILITY TAB
// ═══════════════════════════════════════

function ProfitabilityTab({ data }: { data: ProfitabilityReport | null }) {
    if (!data) return <EmptyState />;

    return (
        <>
            {/* Margin by tier cards */}
            {data.avgMarginByTier.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.avgMarginByTier.map((t, i) => (
                        <KpiCard
                            key={t.tier}
                            label={`${t.tier} Avg Margin`}
                            value={`${t.avgMargin}%`}
                            icon={TrendingUp}
                            chip={`${t.count} deals`}
                            color={kpiColor(t.avgMargin, 45, 40)}
                            delay={i * 0.1}
                        />
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Margin distribution */}
                <ChartCard title="Margin Distribution" delay={0.2} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.marginDistribution}>
                            <Tooltip contentStyle={CHART_TOOLTIP} />
                            <XAxis dataKey="range" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} />
                            <Bar dataKey="count" name="Deals" radius={[6, 6, 0, 0]}>
                                {data.marginDistribution.map((d, i) => (
                                    <Cell key={i} fill={d.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Monthly margin trend */}
                <ChartCard title="Monthly Margin Trend" delay={0.3} className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.monthlyMarginTrend}>
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v, name) => name === 'avgMargin' ? `${v}%` : formatCurrency(v as number)} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="month" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} tickFormatter={v => `${v}%`} />
                            <Line type="monotone" dataKey="avgMargin" name="Avg Margin" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Cost per SF */}
            {data.costPerSF.length > 0 && (
                <ChartCard title="Cost & Price per SF by Tier" delay={0.4} className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.costPerSF}>
                            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => `$${(v as number).toFixed(2)}/SF`} />
                            <XAxis dataKey="tier" {...AXIS_STYLE} />
                            <YAxis {...AXIS_STYLE} tickFormatter={v => `$${v}`} />
                            <Bar dataKey="avgCostPerSF" name="Avg Cost/SF" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="avgPricePerSF" name="Avg Price/SF" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            <Legend />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Travel cost breakdown */}
            <ChartCard title="Travel Cost Breakdown" delay={0.5}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Miles', value: data.travelCostBreakdown.totalMilesDriven.toLocaleString() },
                        { label: 'Hotel/Per Diem', value: formatCurrency(data.travelCostBreakdown.totalHotelPerDiem) },
                        { label: 'Tolls/Parking', value: formatCurrency(data.travelCostBreakdown.totalTollsParking) },
                        { label: 'Other Costs', value: formatCurrency(data.travelCostBreakdown.totalOtherCosts) },
                        { label: 'Avg/Project', value: formatCurrency(data.travelCostBreakdown.avgTravelCostPerProject) },
                    ].map(item => (
                        <div key={item.label} className="text-center p-4 bg-slate-50 rounded-xl">
                            <div className="text-xl font-bold text-s2p-fg">{item.value}</div>
                            <div className="text-xs text-s2p-muted mt-1">{item.label}</div>
                        </div>
                    ))}
                </div>
            </ChartCard>
        </>
    );
}

// ── Helpers ──

function EmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-s2p-muted"
        >
            <Activity size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No data available</p>
            <p className="text-sm mt-1">Start adding scoping forms and closing deals to see metrics.</p>
        </motion.div>
    );
}

/** Returns tailwind color classes for KPI thresholds.
 *  For "lower is better" metrics (like cycle time), pass invert=true. */
function kpiColor(value: number, greenThreshold: number, redThreshold: number, invert = false): string {
    if (invert) {
        if (value <= greenThreshold) return 'text-green-500 bg-green-50';
        if (value <= redThreshold) return 'text-amber-500 bg-amber-50';
        return 'text-red-500 bg-red-50';
    }
    if (value >= greenThreshold) return 'text-green-500 bg-green-50';
    if (value >= redThreshold) return 'text-amber-500 bg-amber-50';
    return 'text-red-500 bg-red-50';
}
