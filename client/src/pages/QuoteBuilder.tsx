import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Send, Sparkles, Loader2, BrainCircuit, FileText,
    Save, RotateCcw, Shield, Layers,
} from 'lucide-react';
import { sendPricingMessage } from '@/services/gemini';
import { createQuote } from '@/services/api';
import { loadPricingConfig, pricingConfigToPrompt, calcCOGSMultiplier } from '@/services/pricingConfig';
import { cn, formatCurrency } from '@/lib/utils';
import type { GeneratedQuote, QuoteLineItem } from '@/types';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

export function QuoteBuilder() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'model',
            text: "I'm the S2P Pricing Engine. Describe a project and I'll generate a quote using our profit-first pricing model.\n\nFor example: \"50,000 sq ft warehouse, scan-to-BIM LOD 300, include MEP, need it in 2 weeks\"",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useReasoning, setUseReasoning] = useState(false);
    const [quote, setQuote] = useState<GeneratedQuote | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const pricingConfig = loadPricingConfig();
            const pricingContext = pricingConfigToPrompt(pricingConfig);
            const configMultiplier = calcCOGSMultiplier(pricingConfig);
            const history = messages.map(m => ({ role: m.role, text: m.text }));

            const responseText = await sendPricingMessage(
                history,
                userMessage.text,
                { useReasoning, pricingContext },
                (quoteArgs) => {
                    // Build the structured quote from function call args
                    const lineItems: QuoteLineItem[] = (quoteArgs.lineItems || []).map((li: any) => {
                        const vendorCostTotal = li.vendorCostPerUnit * li.quantity;
                        const clientPriceTotal = li.clientPricePerUnit * li.quantity;
                        return {
                            service: li.service,
                            description: li.description,
                            quantity: li.quantity,
                            unit: li.unit,
                            vendorCostPerUnit: li.vendorCostPerUnit,
                            vendorCostTotal,
                            marginPct: li.marginPct,
                            clientPricePerUnit: li.clientPricePerUnit,
                            clientPriceTotal,
                            isPrimary: li.isPrimary ?? true,
                        };
                    });

                    const totalCOGS = lineItems.reduce((s, li) => s + li.vendorCostTotal, 0);
                    let totalClientPrice = lineItems.reduce((s, li) => s + li.clientPriceTotal, 0);
                    const subtotal = totalClientPrice;

                    // Apply situational multipliers
                    const multipliers = (quoteArgs.appliedMultipliers || []).map((m: any) => ({
                        name: m.name,
                        factor: m.factor,
                    }));
                    const combinedMultiplier = multipliers.reduce((acc: number, m: any) => acc * m.factor, 1);
                    totalClientPrice = totalClientPrice * combinedMultiplier;

                    // Enforce minimum
                    if (totalClientPrice < pricingConfig.minimumProjectValue) {
                        totalClientPrice = pricingConfig.minimumProjectValue;
                    }

                    // Build profit breakdown from config allocations
                    const allAllocations = [
                        ...pricingConfig.personnelAllocations.map(p => ({ label: `${p.name} (${p.role})`, pct: p.pct })),
                        ...pricingConfig.profitAllocations.map(p => ({ label: p.label, pct: p.pct })),
                    ];
                    const profitBreakdown = allAllocations.map(a => ({
                        label: a.label,
                        pct: a.pct,
                        amount: Math.round(totalClientPrice * (a.pct / 100)),
                    }));

                    const overheadPct = pricingConfig.overhead.manualOverridePct ??
                        (() => {
                            const entries = pricingConfig.overhead.monthlyEntries.slice(-pricingConfig.overhead.rollingMonths);
                            if (entries.length === 0) return 20;
                            const avgRev = entries.reduce((s, e) => s + e.revenue, 0) / entries.length;
                            const avgOH = entries.reduce((s, e) => s + e.overhead, 0) / entries.length;
                            return avgRev > 0 ? Math.round((avgOH / avgRev) * 100 * 10) / 10 : 20;
                        })();

                    setQuote({
                        projectName: quoteArgs.projectName || 'Untitled Project',
                        clientName: quoteArgs.clientName || '',
                        lineItems,
                        subtotal,
                        totalCOGS: totalCOGS,
                        totalClientPrice,
                        cogsMultiplier: configMultiplier,
                        overheadPct,
                        profitBreakdown,
                        multipliers,
                        notes: quoteArgs.notes || '',
                    });
                }
            );

            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: responseText || "I've updated the quote. Check the breakdown on the right.",
                    timestamp: new Date(),
                },
            ]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: 'Something went wrong generating the quote. Please try again.',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveQuote = async () => {
        if (!quote) return;
        setIsSaving(true);
        try {
            await createQuote({
                totalPrice: quote.totalClientPrice,
                pricingBreakdown: {
                    lineItems: quote.lineItems,
                    multipliers: quote.multipliers,
                    totalCOGS: quote.totalCOGS,
                    cogsMultiplier: quote.cogsMultiplier,
                    overheadPct: quote.overheadPct,
                    profitBreakdown: quote.profitBreakdown,
                    notes: quote.notes,
                },
                areas: quote.lineItems.map(li => ({
                    name: li.service,
                    sqft: li.unit === 'sq ft' ? li.quantity : undefined,
                    price: li.clientPriceTotal,
                })),
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            console.error('Failed to save quote:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearQuote = () => {
        setQuote(null);
        setSaveSuccess(false);
    };

    const grossProfit = quote ? quote.totalClientPrice - quote.totalCOGS : 0;
    const grossMarginPct = quote && quote.totalClientPrice > 0
        ? Math.round((grossProfit / quote.totalClientPrice) * 100)
        : 0;

    return (
        <div className="flex gap-6 h-[calc(100vh-180px)]">
            {/* Left: Chat */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                    "flex flex-col bg-white border border-s2p-border rounded-2xl overflow-hidden transition-all duration-300",
                    quote ? "w-1/2" : "w-full max-w-4xl mx-auto"
                )}
            >
                {/* Chat Header */}
                <div className="p-4 border-b border-s2p-border bg-s2p-secondary/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-s2p-primary/10 flex items-center justify-center">
                            <Sparkles size={16} className="text-s2p-primary" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm">S2P Pricing Engine</div>
                            <div className="text-[10px] font-mono text-s2p-muted">
                                {useReasoning ? 'Gemini 2.5 Pro (Deep Analysis)' : 'Gemini 2.5 Flash'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setUseReasoning(!useReasoning)}
                        className={cn(
                            "p-2 rounded-lg transition-colors",
                            useReasoning ? "bg-s2p-primary text-white" : "text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary"
                        )}
                        title="Deep Thinking Mode — uses Gemini Pro for complex scope analysis"
                    >
                        <BrainCircuit size={16} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map(msg => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "max-w-[85%] p-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap",
                                msg.role === 'user'
                                    ? "ml-auto bg-s2p-primary text-white rounded-tr-none"
                                    : "mr-auto bg-s2p-secondary text-s2p-fg rounded-tl-none border border-s2p-border"
                            )}
                        >
                            {msg.text}
                        </motion.div>
                    ))}
                    {isLoading && (
                        <div className="mr-auto bg-s2p-secondary rounded-xl rounded-tl-none p-3 border border-s2p-border inline-flex gap-1.5 items-center">
                            <Loader2 size={14} className="animate-spin text-s2p-primary" />
                            <span className="text-xs text-s2p-muted">
                                {useReasoning ? 'Analyzing scope...' : 'Calculating...'}
                            </span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-s2p-border bg-white shrink-0">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Describe a project to get a quote..."
                            className="flex-1 bg-s2p-secondary border border-s2p-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="px-4 py-2.5 bg-s2p-primary text-white rounded-lg hover:bg-s2p-accent disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                        {[
                            '50K sqft warehouse, BIM LOD 300',
                            '10K sqft office, 2D CAD plans',
                            'Add structural modeling',
                            'What if we rush it?',
                        ].map(suggestion => (
                            <button
                                key={suggestion}
                                onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                                className="text-[11px] px-2.5 py-1 bg-s2p-secondary text-s2p-muted rounded-full hover:bg-s2p-primary/10 hover:text-s2p-primary transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Right: Live Quote Panel */}
            <AnimatePresence>
                {quote && (
                    <motion.div
                        initial={{ opacity: 0, x: 40, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: '50%' }}
                        exit={{ opacity: 0, x: 40, width: 0 }}
                        className="flex flex-col bg-white border border-s2p-border rounded-2xl overflow-hidden"
                    >
                        {/* Quote Header */}
                        <div className="p-4 border-b border-s2p-border bg-s2p-secondary/30 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <FileText size={16} className="text-s2p-primary" />
                                <div>
                                    <div className="font-semibold text-sm">{quote.projectName}</div>
                                    {quote.clientName && (
                                        <div className="text-[10px] text-s2p-muted font-mono">{quote.clientName}</div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleClearQuote}
                                className="p-2 text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary rounded-lg transition-colors"
                                title="Clear quote"
                            >
                                <RotateCcw size={14} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* KPI Strip */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="bg-s2p-secondary/50 border border-s2p-border rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-s2p-muted mb-1">Client Price</div>
                                    <div className="text-lg font-bold text-s2p-fg font-mono">{formatCurrency(quote.totalClientPrice)}</div>
                                </div>
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-orange-600 mb-1">COGS</div>
                                    <div className="text-lg font-bold text-orange-700 font-mono">{formatCurrency(quote.totalCOGS)}</div>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-green-600 mb-1">Gross Profit</div>
                                    <div className="text-lg font-bold text-green-700 font-mono">{formatCurrency(grossProfit)}</div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                                    <div className="text-[10px] font-mono uppercase text-blue-600 mb-1">COGS Multi</div>
                                    <div className="text-lg font-bold text-blue-700 font-mono">{quote.cogsMultiplier}x</div>
                                </div>
                            </div>

                            {/* Primary Line Items */}
                            {quote.lineItems.filter(li => li.isPrimary).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield size={12} className="text-s2p-primary" />
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted">Primary (Full Profit)</span>
                                    </div>
                                    <div className="space-y-2">
                                        {quote.lineItems.filter(li => li.isPrimary).map((li, i) => (
                                            <motion.div
                                                key={`p-${i}`}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="bg-blue-50/50 border border-blue-200 rounded-xl p-3"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-medium text-sm">{li.service}</div>
                                                    <div className="font-mono font-semibold text-sm text-s2p-primary">
                                                        {formatCurrency(li.clientPriceTotal)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-s2p-muted mb-2">{li.description}</div>
                                                <div className="flex gap-3 text-[10px] font-mono text-s2p-muted flex-wrap">
                                                    <span>{li.quantity.toLocaleString()} {li.unit}</span>
                                                    <span>@ {formatCurrency(li.clientPricePerUnit)}/{li.unit}</span>
                                                    <span className="text-orange-500">COGS: {formatCurrency(li.vendorCostTotal)}</span>
                                                    <span className="text-green-600">{li.marginPct}% margin</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add-On Line Items */}
                            {quote.lineItems.filter(li => !li.isPrimary).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers size={12} className="text-s2p-muted" />
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted">Add-Ons (Lean Markup)</span>
                                    </div>
                                    <div className="space-y-2">
                                        {quote.lineItems.filter(li => !li.isPrimary).map((li, i) => (
                                            <motion.div
                                                key={`a-${i}`}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: (quote.lineItems.filter(l => l.isPrimary).length + i) * 0.05 }}
                                                className="bg-s2p-secondary/30 border border-s2p-border rounded-xl p-3"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-medium text-sm">{li.service}</div>
                                                    <div className="font-mono font-semibold text-sm text-s2p-fg">
                                                        {formatCurrency(li.clientPriceTotal)}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-s2p-muted mb-2">{li.description}</div>
                                                <div className="flex gap-3 text-[10px] font-mono text-s2p-muted flex-wrap">
                                                    <span>{li.quantity.toLocaleString()} {li.unit}</span>
                                                    <span>@ {formatCurrency(li.clientPricePerUnit)}/{li.unit}</span>
                                                    <span className="text-orange-500">COGS: {formatCurrency(li.vendorCostTotal)}</span>
                                                    <span className="text-amber-600">{li.marginPct}% markup</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Multipliers */}
                            {quote.multipliers.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted mb-2">Situational Multipliers</div>
                                    <div className="flex gap-2 flex-wrap">
                                        {quote.multipliers.map((m, i) => (
                                            <span
                                                key={i}
                                                className={cn(
                                                    "text-xs font-mono px-2.5 py-1 rounded-full",
                                                    m.factor > 1
                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                        : "bg-green-50 text-green-700 border border-green-200"
                                                )}
                                            >
                                                {m.name}: {m.factor}x
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Profit Allocation Breakdown */}
                            {quote.profitBreakdown.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-mono uppercase tracking-wider text-s2p-muted mb-2">Revenue Allocation</div>
                                    <div className="bg-s2p-secondary/30 border border-s2p-border rounded-xl p-3 space-y-1.5">
                                        {quote.profitBreakdown.map((item, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span className="text-s2p-muted">{item.label} ({item.pct}%)</span>
                                                <span className="font-mono text-s2p-fg">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-xs border-t border-s2p-border pt-1.5">
                                            <span className="text-s2p-muted">Overhead ({quote.overheadPct}%)</span>
                                            <span className="font-mono text-s2p-fg">
                                                {formatCurrency(Math.round(quote.totalClientPrice * (quote.overheadPct / 100)))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-s2p-border pt-1.5 font-medium">
                                            <span className="text-orange-600">COGS</span>
                                            <span className="font-mono text-orange-600">{formatCurrency(quote.totalCOGS)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {quote.notes && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                    <div className="text-[10px] font-mono uppercase text-blue-600 mb-1">Notes & Assumptions</div>
                                    <div className="text-xs text-blue-800 leading-relaxed">{quote.notes}</div>
                                </div>
                            )}

                            {/* Subtotal vs Final (if multipliers applied) */}
                            {quote.multipliers.length > 0 && (
                                <div className="border-t border-s2p-border pt-3 space-y-1">
                                    <div className="flex justify-between text-sm text-s2p-muted">
                                        <span>Subtotal (before multipliers)</span>
                                        <span className="font-mono">{formatCurrency(quote.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-s2p-muted">
                                        <span>Multiplier adjustment</span>
                                        <span className="font-mono">
                                            {formatCurrency(quote.totalClientPrice - quote.subtotal)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t-2 border-s2p-fg bg-white shrink-0">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <span className="font-bold text-lg">Quote Total</span>
                                    <span className="text-xs font-mono text-green-600 ml-2">{grossMarginPct}% gross margin</span>
                                </div>
                                <span className="font-bold text-2xl text-s2p-primary font-mono">
                                    {formatCurrency(quote.totalClientPrice)}
                                </span>
                            </div>
                            <button
                                onClick={handleSaveQuote}
                                disabled={isSaving}
                                className={cn(
                                    "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                                    saveSuccess
                                        ? "bg-green-500 text-white"
                                        : "bg-s2p-primary text-white hover:bg-s2p-accent shadow-sm"
                                )}
                            >
                                {isSaving ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : saveSuccess ? (
                                    <>Saved to Pipeline</>
                                ) : (
                                    <><Save size={16} /> Save Quote</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
