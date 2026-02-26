import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, Send, Loader2, CheckCircle2, Eye, Clock,
    AlertCircle, Mail,
} from 'lucide-react';
import {
    fetchScopingForm,
    fetchQuotesByForm,
    generateProposal,
    sendProposal,
    fetchProposalStatus,
    type ScopingFormData,
    type QuoteData,
    type ProposalSummary,
} from '@/services/api';
import { ProposalPreview } from '@/components/proposal/ProposalPreview';
import type { LineItemShell, QuoteTotals } from '@shared/types/lineItem';
import { cn } from '@/lib/utils';

export function ProposalBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const formId = id ? parseInt(id, 10) : undefined;

    const [form, setForm] = useState<ScopingFormData | null>(null);
    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [customMessage, setCustomMessage] = useState('');
    const [sendEmail, setSendEmail] = useState('');
    const [generating, setGenerating] = useState(false);
    const [sending, setSending] = useState(false);
    const [latestProposal, setLatestProposal] = useState<ProposalSummary | null>(null);

    // Load data
    useEffect(() => {
        if (!formId) return;

        async function load() {
            try {
                const [formData, quotesData] = await Promise.all([
                    fetchScopingForm(formId!),
                    fetchQuotesByForm(formId!),
                ]);

                setForm(formData);
                setSendEmail(formData.contactEmail || '');

                if (quotesData.length > 0) {
                    const latest = quotesData[quotesData.length - 1];
                    setQuote(latest);

                    // Load existing proposals
                    if (latest.id) {
                        const statuses = await fetchProposalStatus(latest.id);
                        setProposals(statuses);
                        if (statuses.length > 0) {
                            setLatestProposal(statuses[statuses.length - 1]);
                        }
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [formId]);

    // Generate proposal
    async function handleGenerate() {
        if (!quote?.id) return;
        setGenerating(true);
        setError(null);
        try {
            const result = await generateProposal(quote.id, customMessage || undefined);
            setLatestProposal(result);
            setProposals(prev => [...prev, result]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate proposal');
        } finally {
            setGenerating(false);
        }
    }

    // Send proposal
    async function handleSend() {
        if (!latestProposal?.id) return;
        setSending(true);
        setError(null);
        try {
            await sendProposal(latestProposal.id, sendEmail || undefined);
            setLatestProposal(prev => prev ? { ...prev, status: 'sent', sentTo: sendEmail } : prev);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send proposal');
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (!form || !quote) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center">
                <p className="text-red-500 text-sm mb-4">
                    {error || 'No priced quote found. Price the deal first.'}
                </p>
                <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Go back</button>
            </div>
        );
    }

    const lineItems = (quote.lineItems || []) as LineItemShell[];
    const totals = (quote.totals || { totalClientPrice: 0, totalUpteamCost: 0, grossMargin: 0, grossMarginPercent: 0, integrityStatus: 'blocked', integrityFlags: [] }) as QuoteTotals;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors mb-2"
                    >
                        <ArrowLeft size={14} />
                        Back
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Proposal Builder</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {form.upid} — {form.projectName} — {form.clientCompany}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                {/* Left: Preview */}
                <div>
                    <ProposalPreview
                        form={form}
                        lineItems={lineItems}
                        totals={totals}
                        customMessage={customMessage}
                    />
                </div>

                {/* Right: Controls */}
                <div className="space-y-4">
                    {/* Custom message */}
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Cover Note</h3>
                        <textarea
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            placeholder="Optional message to include with the proposal..."
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none resize-none"
                        />
                    </div>

                    {/* Generate */}
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {latestProposal ? 'Regenerate PDF' : 'Generate PDF'}
                    </button>

                    {/* Send controls */}
                    {latestProposal && (
                        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Send Proposal</h3>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={sendEmail}
                                    onChange={e => setSendEmail(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={sending || !sendEmail}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                Send to Client
                            </button>
                        </div>
                    )}

                    {/* Proposal history */}
                    {proposals.length > 0 && (
                        <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">History</h3>
                            <div className="space-y-2">
                                {proposals.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <StatusIcon status={p.status} />
                                            <span className="font-medium text-slate-600">v{p.version}</span>
                                        </div>
                                        <div className="text-slate-400">
                                            {p.sentTo ? `Sent to ${p.sentTo}` : p.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'sent': return <Mail size={12} className="text-blue-500" />;
        case 'viewed': return <Eye size={12} className="text-purple-500" />;
        case 'accepted': return <CheckCircle2 size={12} className="text-emerald-500" />;
        default: return <Clock size={12} className="text-slate-400" />;
    }
}
