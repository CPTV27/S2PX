// ClientPortal — Public proposal review page (no auth required).
// Clients access via token-based link: /client-portal/:token
// Allows viewing the proposal PDF and accepting or requesting changes.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle2,
    MessageSquare,
    Download,
    FileText,
    Loader2,
    AlertCircle,
    ExternalLink,
} from 'lucide-react';
import {
    fetchClientPortal,
    respondToProposal,
    type ClientPortalData,
} from '@/services/api';

// ── Helpers ──

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// Detect if a pdfUrl is a base64 data URI (legacy) vs a signed GCS https URL
function isDataUri(url: string): boolean {
    return url.startsWith('data:');
}

// ── Sub-components ──

function S2PXLogo() {
    return (
        <span className="font-mono font-bold text-slate-800 tracking-tight select-none">
            S2P<span className="text-blue-600">X</span>
        </span>
    );
}

// ── Main Component ──

export function ClientPortal() {
    const { token } = useParams<{ token: string }>();

    // Data state
    const [data, setData] = useState<ClientPortalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // PDF iframe fallback
    const [pdfFailed, setPdfFailed] = useState(false);

    // Response panel state
    const [showResponsePanel, setShowResponsePanel] = useState(false);
    const [responseAction, setResponseAction] = useState<'accepted' | 'changes_requested' | null>(null);
    const [responseMessage, setResponseMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Fetch portal data on mount
    useEffect(() => {
        if (!token) {
            setError('No proposal token found in the URL.');
            setLoading(false);
            return;
        }

        fetchClientPortal(token)
            .then(setData)
            .catch((e: Error) => setError(e.message || 'Unable to load proposal.'))
            .finally(() => setLoading(false));
    }, [token]);

    // Handle client response (accept or request changes)
    async function handleRespond() {
        if (!token || !responseAction) return;
        setSubmitting(true);
        try {
            await respondToProposal(token, responseAction, responseMessage.trim() || undefined);
            // Optimistically update local status
            setData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    proposal: { ...prev.proposal, status: responseAction },
                };
            });
            setSubmitted(true);
            setShowResponsePanel(false);
        } catch (e: any) {
            alert(e.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    function openPanel(action: 'accepted' | 'changes_requested') {
        setResponseAction(action);
        setResponseMessage('');
        setShowResponsePanel(true);
    }

    function closePanel() {
        setShowResponsePanel(false);
        setResponseAction(null);
        setResponseMessage('');
    }

    // ── Loading State ──
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="text-sm text-slate-400 font-mono">Loading proposal...</p>
                </div>
            </div>
        );
    }

    // ── Error State ──
    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
                    <AlertCircle className="mx-auto mb-4 text-red-400" size={40} />
                    <h1 className="text-lg font-bold text-slate-800 mb-2">Proposal Unavailable</h1>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        {error || 'This proposal link is invalid or has expired.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-4">
                        Contact your Scan2Plan project manager if you believe this is an error.
                    </p>
                </div>
            </div>
        );
    }

    const { proposal, project, totals } = data;
    const proposalStatus = submitted
        ? (responseAction ?? proposal.status)
        : proposal.status;

    const canRespond =
        !submitted &&
        (proposalStatus === 'sent' || proposalStatus === 'viewed');

    const alreadyResponded =
        proposalStatus === 'accepted' || proposalStatus === 'changes_requested';

    const pdfUrl = proposal.pdfUrl;

    // ── Main View ──
    return (
        <div className="min-h-screen bg-slate-50">

            {/* ── Branded Header ── */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
                    {/* Logo mark */}
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black font-mono text-white tracking-tight leading-none">
                            S2P<span className="text-blue-400">X</span>
                        </span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <S2PXLogo />
                            <span className="text-slate-300 text-sm select-none">/</span>
                            <span className="text-sm font-medium text-slate-600">Proposal</span>
                        </div>
                        {project && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {project.client} — {project.name}
                            </p>
                        )}
                    </div>

                    {/* Status pill */}
                    {alreadyResponded && (
                        <div className={[
                            'flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold shrink-0',
                            proposalStatus === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200',
                        ].join(' ')}>
                            {proposalStatus === 'accepted'
                                ? <><CheckCircle2 size={12} /> Accepted</>
                                : <><MessageSquare size={12} /> Changes Requested</>
                            }
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

                {/* ── Project Info Card ── */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                <FileText size={20} className="text-blue-600" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                                    {project?.name ?? 'Scan2Plan Proposal'}
                                </h1>
                                {project?.client && (
                                    <p className="text-sm text-slate-500 mt-0.5">{project.client}</p>
                                )}
                                {project?.address && (
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        {project.address}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Badges + total */}
                        <div className="flex flex-row sm:flex-col items-start gap-2 sm:items-end shrink-0">
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {project?.upid && (
                                    <span className="text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {project.upid}
                                    </span>
                                )}
                                <span className="text-[11px] font-mono font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">
                                    v{proposal.version}
                                </span>
                            </div>
                            {totals && (
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 font-medium">Total Investment</p>
                                    <p className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                        {formatCurrency(totals.totalClientPrice)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Custom Message Block ── */}
                {proposal.customMessage && (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex">
                            <div className="w-1 bg-blue-600 shrink-0 rounded-l-2xl" />
                            <div className="p-5 sm:p-6">
                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                                    Message from your project team
                                </p>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {proposal.customMessage}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PDF Viewer ── */}
                {pdfUrl ? (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={15} className="text-slate-400" />
                                <span className="text-sm font-semibold text-slate-700">Proposal Document</span>
                            </div>
                            {/* Always offer a direct link/download */}
                            {!isDataUri(pdfUrl) ? (
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                >
                                    <ExternalLink size={12} />
                                    Open in new tab
                                </a>
                            ) : (
                                <a
                                    href={pdfUrl}
                                    download="scan2plan-proposal.pdf"
                                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                >
                                    <Download size={12} />
                                    Download PDF
                                </a>
                            )}
                        </div>

                        {/* iframe — will fail silently on some mobile browsers */}
                        {!pdfFailed ? (
                            <iframe
                                src={pdfUrl}
                                title="Proposal PDF"
                                className="w-full min-h-[600px] sm:min-h-[720px] border-0"
                                onError={() => setPdfFailed(true)}
                                // Some browsers fire load even on failure; treat empty content as failure
                                onLoad={(e) => {
                                    try {
                                        const iframe = e.currentTarget;
                                        // Cross-origin GCS URLs won't let us inspect contentDocument,
                                        // so we only mark failed for data URIs that somehow error.
                                        if (isDataUri(pdfUrl) && !iframe.contentDocument) {
                                            setPdfFailed(true);
                                        }
                                    } catch {
                                        // cross-origin access throws — that is fine, PDF is showing
                                    }
                                }}
                            />
                        ) : (
                            /* Fallback when iframe can't render */
                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
                                <FileText size={40} className="text-slate-200" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-1">
                                        Unable to preview PDF in browser
                                    </p>
                                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                                        Your browser may not support inline PDF viewing.
                                        Use the button below to open or download your proposal.
                                    </p>
                                </div>
                                {!isDataUri(pdfUrl) ? (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        <ExternalLink size={14} />
                                        Open PDF
                                    </a>
                                ) : (
                                    <a
                                        href={pdfUrl}
                                        download="scan2plan-proposal.pdf"
                                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                                    >
                                        <Download size={14} />
                                        Download PDF
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* No PDF URL at all */
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
                        <FileText size={36} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 mb-1">PDF Not Yet Available</p>
                        <p className="text-xs text-slate-400">
                            The proposal document is still being prepared. Please check back shortly.
                        </p>
                    </div>
                )}

                {/* ── Already Responded Banner ── */}
                {alreadyResponded && (
                    <div className={[
                        'rounded-2xl px-5 py-4 border shadow-sm flex items-start gap-3',
                        proposalStatus === 'accepted'
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-amber-50 border-amber-200',
                    ].join(' ')}>
                        <div className={[
                            'mt-0.5 shrink-0',
                            proposalStatus === 'accepted' ? 'text-emerald-600' : 'text-amber-600',
                        ].join(' ')}>
                            {proposalStatus === 'accepted'
                                ? <CheckCircle2 size={20} />
                                : <MessageSquare size={20} />
                            }
                        </div>
                        <div>
                            <p className={[
                                'text-sm font-bold',
                                proposalStatus === 'accepted' ? 'text-emerald-800' : 'text-amber-800',
                            ].join(' ')}>
                                {proposalStatus === 'accepted'
                                    ? 'Proposal Accepted'
                                    : 'Changes Requested'
                                }
                            </p>
                            <p className={[
                                'text-xs mt-0.5 leading-relaxed',
                                proposalStatus === 'accepted' ? 'text-emerald-700' : 'text-amber-700',
                            ].join(' ')}>
                                {proposalStatus === 'accepted'
                                    ? 'Thank you! Your acceptance has been recorded. Your Scan2Plan project manager will be in touch shortly to discuss next steps.'
                                    : 'Your change request has been received. Your Scan2Plan project manager will review your feedback and follow up with a revised proposal.'
                                }
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Action Section (only when response is still possible) ── */}
                {canRespond && !showResponsePanel && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                        <p className="text-sm font-semibold text-slate-700 mb-1">Ready to respond?</p>
                        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                            Review the proposal above, then accept or request changes below.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => openPanel('accepted')}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            >
                                <CheckCircle2 size={16} />
                                Accept Proposal
                            </button>
                            <button
                                onClick={() => openPanel('changes_requested')}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                            >
                                <MessageSquare size={16} />
                                Request Changes
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Inline Response Panel ── */}
                {canRespond && showResponsePanel && responseAction && (
                    <div className={[
                        'rounded-2xl border shadow-sm overflow-hidden',
                        responseAction === 'accepted'
                            ? 'border-emerald-200'
                            : 'border-amber-200',
                    ].join(' ')}>
                        {/* Panel header */}
                        <div className={[
                            'px-5 sm:px-6 py-4 border-b flex items-center gap-3',
                            responseAction === 'accepted'
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-amber-50 border-amber-200',
                        ].join(' ')}>
                            <div className={responseAction === 'accepted' ? 'text-emerald-600' : 'text-amber-600'}>
                                {responseAction === 'accepted'
                                    ? <CheckCircle2 size={18} />
                                    : <MessageSquare size={18} />
                                }
                            </div>
                            <div>
                                <p className={[
                                    'text-sm font-bold',
                                    responseAction === 'accepted' ? 'text-emerald-800' : 'text-amber-800',
                                ].join(' ')}>
                                    {responseAction === 'accepted' ? 'Accept Proposal' : 'Request Changes'}
                                </p>
                                <p className={[
                                    'text-xs',
                                    responseAction === 'accepted' ? 'text-emerald-600' : 'text-amber-600',
                                ].join(' ')}>
                                    {responseAction === 'accepted'
                                        ? 'Add an optional message to your acceptance.'
                                        : 'Describe what you would like changed.'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Panel body */}
                        <div className="bg-white px-5 sm:px-6 py-5 space-y-4">
                            <div>
                                <label
                                    htmlFor="response-message"
                                    className="block text-xs font-semibold text-slate-600 mb-1.5"
                                >
                                    {responseAction === 'accepted'
                                        ? 'Message (optional)'
                                        : 'What changes are needed?'
                                    }
                                </label>
                                <textarea
                                    id="response-message"
                                    rows={4}
                                    value={responseMessage}
                                    onChange={e => setResponseMessage(e.target.value)}
                                    placeholder={
                                        responseAction === 'accepted'
                                            ? 'e.g. Looks great — please proceed with scheduling.'
                                            : 'e.g. Please revise the scope to include the basement level...'
                                    }
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none"
                                />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                <button
                                    onClick={closePanel}
                                    disabled={submitting}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRespond}
                                    disabled={submitting || (responseAction === 'changes_requested' && !responseMessage.trim())}
                                    className={[
                                        'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2',
                                        responseAction === 'accepted'
                                            ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                                            : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400',
                                    ].join(' ')}
                                >
                                    {submitting
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : responseAction === 'accepted'
                                            ? <CheckCircle2 size={14} />
                                            : <MessageSquare size={14} />
                                    }
                                    {submitting
                                        ? 'Submitting...'
                                        : responseAction === 'accepted'
                                            ? 'Confirm Acceptance'
                                            : 'Submit Request'
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Footer ── */}
            <footer className="text-center py-8 mt-4">
                <p className="text-[11px] text-slate-300 font-mono tracking-wide select-none">
                    Powered by Scan2Plan OS X
                </p>
            </footer>
        </div>
    );
}
