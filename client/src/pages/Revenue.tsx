import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Loader2,
    BarChart3, PieChart, Users, FileText, Scale, Bot, Send, X,
    Sparkles, ChevronRight, RefreshCw,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, AreaChart, Area, Legend,
    ComposedChart,
} from 'recharts';
import {
    fetchActualRevenue,
    fetchPnlSummary,
    fetchExpensesSummary,
    fetchQBOCustomers,
    fetchEstimateConversion,
    fetchBalanceSheet,
} from '@/services/api';
import type {
    ActualRevenueData,
    PnlSummary,
    ExpenseSummaryData,
    QBOCustomerListData,
    EstimateConversionData,
    BalanceSheetData,
} from '@shared/types/financials';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { auth } from '@/services/firebase';

// ── Tabs ──
const TABS = [
    { key: 'revenue', label: 'Revenue', icon: TrendingUp },
    { key: 'pnl', label: 'P&L', icon: BarChart3 },
    { key: 'expenses', label: 'Expenses', icon: PieChart },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'estimates', label: 'Estimates', icon: FileText },
    { key: 'balance', label: 'Balance Sheet', icon: Scale },
] as const;

type TabKey = typeof TABS[number]['key'];

// ── Tab data cache shape ──
interface TabCache {
    revenue?: ActualRevenueData;
    pnl?: PnlSummary;
    expenses?: ExpenseSummaryData;
    customers?: QBOCustomerListData;
    estimates?: EstimateConversionData;
    balance?: BalanceSheetData;
}

// ── CFO Agent Chat ──

interface CFOMessage {
    role: 'user' | 'assistant';
    content: string;
}

function CFOAgent({ context }: { context: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<CFOMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/kb/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    message: userMsg,
                    systemContext: `You are the S2PX CFO Agent — a senior financial analyst for Scan2Plan. You have access to the company's actual QuickBooks financial data. Answer concisely with data-driven insights. Use specific numbers when available.\n\nFinancial Context:\n${context}`,
                    mode: 'financial',
                }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Sorry, I could not generate a response.' }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to the AI service. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const prompts = [
        'What is our monthly burn rate?',
        'Which customers drive the most revenue?',
        'How does this year compare to last year?',
        'What is our gross margin trend?',
    ];

    return (
        <>
            {/* FAB */}
            <motion.button
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                    'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-white font-medium text-sm transition-colors',
                    'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400',
                    isOpen && 'hidden',
                )}
                data-tour="cfo-agent"
            >
                <Bot size={18} />
                <span className="hidden md:inline">CFO Agent</span>
            </motion.button>

            {/* Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: 400, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 400, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 right-0 top-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <Bot size={16} className="text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">CFO Agent</h3>
                                    <p className="text-[10px] text-slate-400 font-mono uppercase">Gemini 2.5 Flash</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center py-8">
                                    <Sparkles size={24} className="mx-auto text-emerald-400 mb-3" />
                                    <p className="text-sm text-slate-500 mb-4">Ask me anything about your financials</p>
                                    <div className="space-y-2">
                                        {prompts.map(p => (
                                            <button
                                                key={p}
                                                onClick={() => { setInput(p); }}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-600 bg-slate-50 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors flex items-center gap-2"
                                            >
                                                <ChevronRight size={12} className="text-emerald-400 shrink-0" />
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {messages.map((m, i) => (
                                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                    <div className={cn(
                                        'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                                        m.role === 'user'
                                            ? 'bg-emerald-600 text-white rounded-br-md'
                                            : 'bg-slate-100 text-slate-700 rounded-bl-md',
                                    )}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                                        <Loader2 size={14} className="animate-spin text-emerald-500" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder="Ask about financials..."
                                    className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// ── Main Revenue Page ──

export function Revenue() {
    const [activeTab, setActiveTab] = useState<TabKey>('revenue');
    const [tabLoading, setTabLoading] = useState(false);

    // Per-tab data states
    const [revenueData, setRevenueData] = useState<ActualRevenueData | null>(null);
    const [pnlData, setPnlData] = useState<PnlSummary | null>(null);
    const [expenseData, setExpenseData] = useState<ExpenseSummaryData | null>(null);
    const [customerData, setCustomerData] = useState<QBOCustomerListData | null>(null);
    const [estimateData, setEstimateData] = useState<EstimateConversionData | null>(null);
    const [balanceData, setBalanceData] = useState<BalanceSheetData | null>(null);

    // Track errors per tab
    const [tabError, setTabError] = useState<string | null>(null);

    // Cache of which tabs have already been fetched — switching back is instant
    const fetchedTabs = useRef<Set<TabKey>>(new Set());

    const fetchTab = useCallback(async (tab: TabKey) => {
        if (fetchedTabs.current.has(tab)) return;
        setTabLoading(true);
        setTabError(null);
        try {
            switch (tab) {
                case 'revenue': {
                    const data = await fetchActualRevenue();
                    setRevenueData(data);
                    break;
                }
                case 'pnl': {
                    const data = await fetchPnlSummary();
                    setPnlData(data);
                    break;
                }
                case 'expenses': {
                    const data = await fetchExpensesSummary();
                    setExpenseData(data);
                    break;
                }
                case 'customers': {
                    const data = await fetchQBOCustomers();
                    setCustomerData(data);
                    break;
                }
                case 'estimates': {
                    const data = await fetchEstimateConversion();
                    setEstimateData(data);
                    break;
                }
                case 'balance': {
                    const data = await fetchBalanceSheet();
                    setBalanceData(data);
                    break;
                }
            }
            fetchedTabs.current.add(tab);
        } catch (e: any) {
            console.error(`Financial data load failed for tab "${tab}":`, e);
            setTabError(`Failed to load ${TABS.find(t => t.key === tab)?.label ?? tab} data. The QuickBooks data may not be synced yet.`);
        } finally {
            setTabLoading(false);
        }
    }, []);

    // On mount: fetch only the default active tab
    useEffect(() => {
        fetchTab('revenue');
    }, [fetchTab]);

    const handleTabSwitch = (tab: TabKey) => {
        setActiveTab(tab);
        setTabError(null);
        fetchTab(tab);
    };

    const retryTab = () => {
        fetchedTabs.current.delete(activeTab);
        setTabError(null);
        fetchTab(activeTab);
    };

    // Build CFO context from whatever data is available so far
    const cfoContext = [
        revenueData && `Total all-time revenue: ${formatCurrency(revenueData.totalRevenue)}`,
        revenueData && `YTD revenue: ${formatCurrency(revenueData.ytdRevenue)}`,
        pnlData && `Net income (all-time): ${formatCurrency(pnlData.netIncome)}`,
        pnlData && `Total COGS: ${formatCurrency(pnlData.totalCOGS)}`,
        pnlData && `Total expenses: ${formatCurrency(pnlData.totalExpenses)}`,
        customerData && `Total customers: ${customerData.totalCustomers}`,
        customerData && `Active customers (12mo): ${customerData.activeCustomers}`,
        estimateData && `Estimate conversion rate: ${(estimateData.conversionRate * 100).toFixed(1)}%`,
        balanceData && `Total assets: ${formatCurrency(balanceData.totalAssets)}`,
        balanceData && `Total liabilities: ${formatCurrency(balanceData.totalLiabilities)}`,
        revenueData && revenueData.topCustomers.slice(0, 5).map(c => `${c.customerName}: ${formatCurrency(c.revenue)}`).join(', '),
    ].filter(Boolean).join('\n');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Financial Dashboard</h2>
                    <p className="text-s2p-muted text-sm mt-1">
                        Actual revenue and P&L from QuickBooks &mdash; {revenueData?.monthlyRevenue?.length ?? 0} months of data
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-s2p-muted bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <DollarSign size={12} />
                    QBO Synced
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => handleTabSwitch(tab.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                                isActive
                                    ? 'bg-white text-s2p-fg shadow-sm'
                                    : 'text-s2p-muted hover:text-s2p-fg',
                            )}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div>
                {tabLoading && (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-s2p-primary" size={24} />
                    </div>
                )}
                {!tabLoading && tabError && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <BarChart3 size={20} className="text-red-400" />
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{tabError}</p>
                        <button
                            onClick={retryTab}
                            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                        >
                            <RefreshCw size={12} />
                            Retry
                        </button>
                    </div>
                )}
                {!tabLoading && !tabError && activeTab === 'revenue' && revenueData && <RevenueTab data={revenueData} />}
                {!tabLoading && !tabError && activeTab === 'pnl' && pnlData && <PnlTab data={pnlData} />}
                {!tabLoading && !tabError && activeTab === 'expenses' && expenseData && <ExpensesTab data={expenseData} />}
                {!tabLoading && !tabError && activeTab === 'customers' && customerData && <CustomersTab data={customerData} />}
                {!tabLoading && !tabError && activeTab === 'estimates' && estimateData && <EstimatesTab data={estimateData} />}
                {!tabLoading && !tabError && activeTab === 'balance' && balanceData && <BalanceTab data={balanceData} />}
            </div>

            {/* CFO Agent */}
            <CFOAgent context={cfoContext} />
        </div>
    );
}

// ── Revenue Tab ──

function RevenueTab({ data }: { data: ActualRevenueData }) {
    // Get last 24 months for chart
    const chartData = data.monthlyRevenue.slice(-24).map(m => ({
        month: m.month.slice(5), // "01", "02", etc. for display
        label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: m.revenue,
    }));

    const ytdMonths = data.monthlyRevenue.filter(m => m.month.startsWith(new Date().getFullYear().toString()));
    const lastYearMonths = data.monthlyRevenue.filter(m => m.month.startsWith((new Date().getFullYear() - 1).toString()));
    const lastYearTotal = lastYearMonths.reduce((s, m) => s + m.revenue, 0);
    const yoyGrowth = lastYearTotal > 0 ? ((data.ytdRevenue - lastYearTotal) / lastYearTotal) * 100 : 0;
    const avgMonthly = data.ytdRevenue / Math.max(ytdMonths.length, 1);

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'All-Time Revenue', value: formatCurrency(data.totalRevenue), sub: `${data.monthlyRevenue.length} months` },
                    { label: 'YTD Revenue', value: formatCurrency(data.ytdRevenue), sub: `${ytdMonths.length} months` },
                    { label: 'Monthly Avg (YTD)', value: formatCurrency(avgMonthly), sub: 'run rate' },
                    { label: 'YoY Growth', value: `${yoyGrowth >= 0 ? '+' : ''}${yoyGrowth.toFixed(1)}%`, sub: `vs ${new Date().getFullYear() - 1}` },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-s2p-border rounded-2xl p-5">
                        <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">{kpi.label}</div>
                        <div className="text-2xl font-bold text-s2p-fg">{kpi.value}</div>
                        <div className="text-xs text-s2p-muted mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="bg-white border border-s2p-border rounded-2xl p-6 h-[380px]">
                <h3 className="text-sm font-semibold text-s2p-fg mb-4">Monthly Revenue (Last 24 Months)</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0' }} formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#3B82F6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Top Customers */}
            <div className="bg-white border border-s2p-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-s2p-fg mb-4">Top Revenue Customers</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-s2p-border">
                                <th className="text-left py-2 text-s2p-muted font-medium">#</th>
                                <th className="text-left py-2 text-s2p-muted font-medium">Customer</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Revenue</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Transactions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.topCustomers.slice(0, 15).map((c, i) => (
                                <tr key={c.customerName} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-2 text-s2p-muted">{i + 1}</td>
                                    <td className="py-2 font-medium text-s2p-fg">{c.customerName}</td>
                                    <td className="py-2 text-right font-mono">{formatCurrency(c.revenue)}</td>
                                    <td className="py-2 text-right text-s2p-muted">{c.transactionCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── P&L Tab ──

function PnlTab({ data }: { data: PnlSummary }) {
    const grossProfit = data.totalIncome - data.totalCOGS;
    const grossMargin = data.totalIncome > 0 ? (grossProfit / data.totalIncome) * 100 : 0;

    // Chart data: last 24 months
    const chartData = data.monthlyPnl.slice(-24).map(m => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        income: m.income,
        cogs: m.cogs,
        expenses: m.expenses,
        netIncome: m.netIncome,
    }));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                    { label: 'Income', value: formatCurrency(data.totalIncome), color: 'text-green-600' },
                    { label: 'COGS', value: formatCurrency(data.totalCOGS), color: 'text-orange-600' },
                    { label: 'Gross Profit', value: formatCurrency(grossProfit), color: 'text-blue-600' },
                    { label: 'Gross Margin', value: `${grossMargin.toFixed(1)}%`, color: 'text-blue-600' },
                    { label: 'Expenses', value: formatCurrency(data.totalExpenses), color: 'text-red-600' },
                    { label: 'Net Income', value: formatCurrency(data.netIncome), color: data.netIncome >= 0 ? 'text-green-600' : 'text-red-600' },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-s2p-border rounded-xl p-4">
                        <div className="text-[10px] text-s2p-muted font-mono uppercase tracking-wider mb-1">{kpi.label}</div>
                        <div className={cn('text-lg font-bold', kpi.color)}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-s2p-border rounded-2xl p-6 h-[400px]">
                <h3 className="text-sm font-semibold text-s2p-fg mb-4">Monthly P&L (Last 24 Months)</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0' }} formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
                        <Legend />
                        <Bar dataKey="income" name="Income" fill="#22C55E" radius={[3, 3, 0, 0]} opacity={0.7} />
                        <Bar dataKey="cogs" name="COGS" fill="#F97316" radius={[3, 3, 0, 0]} opacity={0.7} />
                        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} opacity={0.7} />
                        <Line type="monotone" dataKey="netIncome" name="Net Income" stroke="#2563EB" strokeWidth={2} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── Expenses Tab ──

function ExpensesTab({ data }: { data: ExpenseSummaryData }) {
    const topVendors = data.topVendors.slice(0, 25);
    const maxExpense = Math.max(...topVendors.map(v => v.totalAllTime), 1);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Expenses (All Time)', value: formatCurrency(data.totalAllTime) },
                    { label: 'Trailing 12 Months', value: formatCurrency(data.totalTrailing12mo) },
                    { label: 'Vendor Count', value: data.vendorCount.toString() },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-s2p-border rounded-2xl p-5">
                        <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">{kpi.label}</div>
                        <div className="text-2xl font-bold text-s2p-fg">{kpi.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-s2p-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-s2p-fg mb-4">Top Vendors by Spend</h3>
                <div className="space-y-2">
                    {topVendors.map((v, i) => {
                        const percentage = (v.totalAllTime / maxExpense) * 100;
                        return (
                            <div key={v.vendor} className="flex items-center gap-3">
                                <span className="text-xs text-s2p-muted w-6 text-right">{i + 1}</span>
                                <span className="text-sm font-medium w-48 truncate">{v.vendor}</span>
                                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500/70 rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="text-xs font-mono text-s2p-muted w-24 text-right">{formatCurrency(v.totalAllTime)}</span>
                                <span className="text-xs font-mono text-emerald-600 w-24 text-right">{formatCurrency(v.totalTrailing12mo)}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-8 mt-3 text-[10px] font-mono text-s2p-muted">
                    <span>All Time</span>
                    <span className="text-emerald-600">12mo Trailing</span>
                </div>
            </div>
        </div>
    );
}

// ── Customers Tab ──

function CustomersTab({ data }: { data: QBOCustomerListData }) {
    const [search, setSearch] = useState('');
    const filtered = data.customers.filter(c =>
        c.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (c.company?.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Total Customers', value: data.totalCustomers },
                    { label: 'Active (12mo)', value: data.activeCustomers },
                    { label: 'Inactive', value: data.totalCustomers - data.activeCustomers },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-s2p-border rounded-2xl p-5">
                        <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">{kpi.label}</div>
                        <div className="text-2xl font-bold text-s2p-fg">{kpi.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-s2p-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-s2p-fg">Customer Directory</h3>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search customers..."
                        className="px-3 py-1.5 text-sm border border-s2p-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-s2p-border">
                                <th className="text-left py-2 text-s2p-muted font-medium">Customer</th>
                                <th className="text-left py-2 text-s2p-muted font-medium">Email</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Revenue</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Txns</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Estimates</th>
                                <th className="text-right py-2 text-s2p-muted font-medium">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 100).map(c => (
                                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-2 font-medium text-s2p-fg">{c.customerName}</td>
                                    <td className="py-2 text-s2p-muted text-xs">{c.email || '-'}</td>
                                    <td className="py-2 text-right font-mono">{formatCurrency(c.totalRevenue)}</td>
                                    <td className="py-2 text-right text-s2p-muted">{c.transactionCount}</td>
                                    <td className="py-2 text-right text-s2p-muted">{c.estimateCount}</td>
                                    <td className="py-2 text-right text-xs text-s2p-muted">{c.lastTransactionDate ? new Date(c.lastTransactionDate).toLocaleDateString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Estimates Tab ──

function EstimatesTab({ data }: { data: EstimateConversionData }) {
    const chartData = data.monthlyEstimates.slice(-18).map(m => ({
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count: m.count,
        accepted: m.acceptedCount,
        value: m.totalValue,
    }));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total Estimates', value: data.totalEstimates },
                    { label: 'Accepted', value: data.acceptedCount },
                    { label: 'Invoiced', value: data.invoicedCount },
                    { label: 'Conversion Rate', value: `${(data.conversionRate * 100).toFixed(1)}%` },
                    { label: 'Estimate Value', value: formatCurrency(data.totalEstimateValue) },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white border border-s2p-border rounded-xl p-4">
                        <div className="text-[10px] text-s2p-muted font-mono uppercase tracking-wider mb-1">{kpi.label}</div>
                        <div className="text-lg font-bold text-s2p-fg">{kpi.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white border border-s2p-border rounded-2xl p-6 h-[380px]">
                <h3 className="text-sm font-semibold text-s2p-fg mb-4">Monthly Estimates</h3>
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E2E8F0' }} />
                        <Legend />
                        <Bar dataKey="count" name="Total" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="accepted" name="Accepted" fill="#22C55E" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── Balance Sheet Tab ──

function BalanceTab({ data }: { data: BalanceSheetData }) {
    const assets = data.items.filter(i => i.category === 'Assets');
    const liabilities = data.items.filter(i => i.category === 'Liabilities');
    const equity = data.items.filter(i => i.category === 'Equity');

    const renderSection = (title: string, items: typeof data.items, total: number, color: string) => (
        <div className="bg-white border border-s2p-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-s2p-fg">{title}</h3>
                <span className={cn('text-lg font-bold', color)}>{formatCurrency(total)}</span>
            </div>
            <div className="space-y-1">
                {items.map((item, i) => (
                    <div key={`${item.account}-${i}`} className="flex justify-between py-1 text-sm border-b border-slate-50 last:border-0">
                        <span className="text-s2p-muted truncate mr-4">
                            {item.subcategory && <span className="text-xs text-slate-400 mr-1">{item.subcategory} &rsaquo;</span>}
                            {item.account}
                        </span>
                        <span className={cn('font-mono whitespace-nowrap', item.total < 0 ? 'text-red-500' : 'text-s2p-fg')}>
                            {formatCurrency(item.total)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="text-xs text-s2p-muted font-mono">
                Snapshot as of {data.snapshotDate ? new Date(data.snapshotDate).toLocaleDateString() : 'N/A'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <div className="text-[10px] text-s2p-muted font-mono uppercase mb-1">Total Assets</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(data.totalAssets)}</div>
                </div>
                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <div className="text-[10px] text-s2p-muted font-mono uppercase mb-1">Total Liabilities</div>
                    <div className="text-xl font-bold text-red-600">{formatCurrency(data.totalLiabilities)}</div>
                </div>
                <div className="bg-white border border-s2p-border rounded-xl p-4">
                    <div className="text-[10px] text-s2p-muted font-mono uppercase mb-1">Total Equity</div>
                    <div className="text-xl font-bold text-blue-600">{formatCurrency(data.totalEquity)}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderSection('Assets', assets, data.totalAssets, 'text-green-600')}
                {renderSection('Liabilities', liabilities, data.totalLiabilities, 'text-red-600')}
                {renderSection('Equity', equity, data.totalEquity, 'text-blue-600')}
            </div>
        </div>
    );
}
