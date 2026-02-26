import { useState, useEffect } from 'react';
import {
    Loader2, ExternalLink, CheckCircle2, AlertCircle,
    FileSpreadsheet, Receipt, Link2, Unlink, RefreshCw,
} from 'lucide-react';
import {
    fetchQBOStatus,
    fetchQBOEstimate,
    startQBOAuth,
    createQBOEstimate,
    convertQBOToInvoice,
    disconnectQBO,
    type QBOStatus,
    type QBOEstimateInfo,
} from '@/services/api';
import { cn } from '@/lib/utils';

interface QBOSyncButtonProps {
    quoteId: number | undefined;
}

export function QBOSyncButton({ quoteId }: QBOSyncButtonProps) {
    const [status, setStatus] = useState<QBOStatus | null>(null);
    const [estimate, setEstimate] = useState<QBOEstimateInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [converting, setConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStatus();
    }, [quoteId]);

    async function loadStatus() {
        setLoading(true);
        try {
            const qboStatus = await fetchQBOStatus();
            setStatus(qboStatus);

            if (qboStatus.connected && quoteId) {
                const estInfo = await fetchQBOEstimate(quoteId);
                setEstimate(estInfo);
            }
        } catch {
            // QBO not available — show connect state
            setStatus({ configured: false, connected: false });
        } finally {
            setLoading(false);
        }
    }

    async function handleConnect() {
        setError(null);
        try {
            const { authUrl } = await startQBOAuth();
            window.open(authUrl, '_blank', 'width=600,height=700');
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function handleDisconnect() {
        setError(null);
        try {
            await disconnectQBO();
            setStatus(prev => prev ? { ...prev, connected: false } : prev);
            setEstimate(null);
        } catch (err: any) {
            setError(err.message);
        }
    }

    async function handleSync() {
        if (!quoteId) return;
        setSyncing(true);
        setError(null);
        try {
            const result = await createQBOEstimate(quoteId);
            setEstimate({
                synced: true,
                estimateId: result.estimateId,
                estimateNumber: result.estimateNumber,
                customerId: result.customerId,
                connected: true,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSyncing(false);
        }
    }

    async function handleConvertToInvoice() {
        if (!quoteId) return;
        setConverting(true);
        setError(null);
        try {
            const result = await convertQBOToInvoice(quoteId);
            setEstimate(prev => prev ? { ...prev, invoiceId: result.invoiceId } : prev);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setConverting(false);
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    Checking QuickBooks...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">QuickBooks</h3>
                <StatusDot connected={status?.connected ?? false} />
            </div>

            {error && (
                <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 flex items-center gap-1.5">
                    <AlertCircle size={12} />
                    {error}
                </div>
            )}

            {/* Not connected */}
            {!status?.connected && (
                <div className="space-y-2">
                    {!status?.configured ? (
                        <p className="text-xs text-slate-400">QBO credentials not configured. Add QBO_CLIENT_ID and QBO_CLIENT_SECRET to .env</p>
                    ) : (
                        <button
                            onClick={handleConnect}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                            <Link2 size={13} />
                            Connect QuickBooks
                        </button>
                    )}
                </div>
            )}

            {/* Connected — show estimate controls */}
            {status?.connected && (
                <div className="space-y-2">
                    {!estimate?.synced ? (
                        // No estimate yet — create one
                        <button
                            onClick={handleSync}
                            disabled={syncing || !quoteId}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            {syncing ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                            Create QBO Estimate
                        </button>
                    ) : (
                        // Estimate exists
                        <>
                            <div className="flex items-center gap-2 text-xs">
                                <CheckCircle2 size={13} className="text-emerald-500" />
                                <span className="font-medium text-slate-700">
                                    Estimate #{estimate.estimateNumber}
                                </span>
                                {estimate.estimateUrl && (
                                    <a
                                        href={estimate.estimateUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>

                            {/* Re-sync */}
                            <button
                                onClick={() => { createQBOEstimate(quoteId!, true).then(loadStatus); }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-medium text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                            >
                                <RefreshCw size={11} />
                                Re-sync Estimate
                            </button>

                            {/* Convert to Invoice */}
                            {!estimate.invoiceId ? (
                                <button
                                    onClick={handleConvertToInvoice}
                                    disabled={converting}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                                >
                                    {converting ? <Loader2 size={13} className="animate-spin" /> : <Receipt size={13} />}
                                    Convert to Invoice
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 text-xs">
                                    <CheckCircle2 size={13} className="text-amber-500" />
                                    <span className="font-medium text-slate-700">Invoice created</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Disconnect */}
                    <button
                        onClick={handleDisconnect}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Unlink size={10} />
                        Disconnect
                    </button>
                </div>
            )}
        </div>
    );
}

function StatusDot({ connected }: { connected: boolean }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                connected ? 'bg-emerald-500' : 'bg-slate-300',
            )} />
            <span className="text-[10px] text-slate-400">
                {connected ? 'Connected' : 'Not connected'}
            </span>
        </div>
    );
}
