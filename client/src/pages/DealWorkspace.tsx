import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2, MapPin, Building2, Hash, FileText } from 'lucide-react';
import { useDealWorkspace } from '@/hooks/useDealWorkspace';
import { LineItemTable } from '@/components/pricing/LineItemTable';
import { QuoteTotalsBar } from '@/components/pricing/QuoteTotalsBar';
import { CEOSections } from '@/components/pricing/CEOSections';
import { QBOSyncButton } from '@/components/pricing/QBOSyncButton';
import { PropertyMap } from '@/components/PropertyMap';
import { cn } from '@/lib/utils';

export function DealWorkspace() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const formId = id ? parseInt(id, 10) : undefined;

    const {
        form,
        quote,
        lineItems,
        totals,
        loading,
        error,
        saveState,
        canSave,
        updateLineItem,
        regenerateShells,
        saveQuote,
        updateCeoFields,
    } = useDealWorkspace(formId);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (error || !form) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center">
                <p className="text-red-500 text-sm mb-4">{error || 'Deal not found'}</p>
                <button onClick={() => navigate('/dashboard/pipeline')} className="text-sm text-blue-600 hover:underline">
                    Back to Pipeline
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-5rem)]">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <button
                        onClick={() => navigate('/dashboard/pipeline')}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors mb-2"
                    >
                        <ArrowLeft size={14} />
                        Back to Pipeline
                    </button>
                    <div className="flex items-center gap-3 mb-1">
                        {form.upid && (
                            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                {form.upid}
                            </span>
                        )}
                        <StageBadge stage={form.status || 'draft'} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {form.projectName || 'Untitled Deal'}
                    </h1>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Building2 size={13} />{form.clientCompany}</span>
                        {form.projectAddress && (
                            <span className="flex items-center gap-1"><MapPin size={13} />{form.projectAddress}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={regenerateShells}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Regenerate line items from scoping form (discards entered prices)"
                    >
                        <RefreshCw size={13} />
                        Regenerate Shells
                    </button>
                    {quote?.id ? (
                        <Link
                            to={`/dashboard/proposals/${formId}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <FileText size={13} />
                            Create Proposal
                        </Link>
                    ) : (
                        <div className="relative group">
                            <button
                                disabled
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-400 rounded-lg cursor-not-allowed opacity-60"
                            >
                                <FileText size={13} />
                                Create Proposal
                            </button>
                            <div className="absolute right-0 top-full mt-1.5 bg-slate-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                Save your quote first to create a proposal
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                {/* Left: Scoping summary + Line items */}
                <div className="space-y-4">
                    {/* Scoping Summary */}
                    <ScopingSummary form={form} />

                    {/* Line Item Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-700">
                                Line Items ({lineItems.length})
                            </h2>
                            <span className="text-xs text-slate-400 font-mono">
                                {lineItems.filter(i => i.upteamCost !== null && i.clientPrice !== null).length}/{lineItems.length} priced
                            </span>
                        </div>
                        <LineItemTable items={lineItems} onUpdate={updateLineItem} />
                    </div>
                </div>

                {/* Right: CEO Sections */}
                <div className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">CEO Controls</h2>
                    <CEOSections form={form} onUpdate={updateCeoFields} />

                    {/* QuickBooks Sync */}
                    {quote?.id && <QBOSyncButton quoteId={quote.id} />}

                    {/* Link to full scoping form */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <Link
                            to={`/dashboard/scoping/${form.id}`}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            View Full Scoping Form
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom totals bar */}
            <QuoteTotalsBar
                totals={totals}
                canSave={canSave}
                saveState={saveState}
                onSave={saveQuote}
            />
        </div>
    );
}

function ScopingSummary({ form }: { form: import('@/services/api').ScopingFormData }) {
    const areas = form.areas || [];
    return (
        <div className="space-y-4">
            {/* Map */}
            {form.projectAddress && (
                <PropertyMap
                    address={form.projectAddress}
                    lat={form.projectLat != null ? Number(form.projectLat) : undefined}
                    lng={form.projectLng != null ? Number(form.projectLng) : undefined}
                    footprintSqft={form.buildingFootprintSqft != null ? Number(form.buildingFootprintSqft) : undefined}
                    scopingFormId={form.id}
                    height={240}
                />
            )}

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-700">Scoping Summary</h2>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <SummaryItem label="Areas" value={String(areas.length)} />
                    <SummaryItem label="Total SF" value={areas.reduce((s, a) => s + (a.squareFootage || 0), 0).toLocaleString()} />
                    <SummaryItem label="Floors" value={String(form.numberOfFloors || '—')} />
                    <SummaryItem label="Travel" value={`${form.oneWayMiles || 0} mi — ${form.travelMode || '—'}`} />
                    <SummaryItem label="Dispatch" value={form.dispatchLocation || '—'} />
                    <SummaryItem label="BIM" value={form.bimDeliverable || '—'} />
                    <SummaryItem label="Expedited" value={form.expedited ? 'Yes (+20%)' : 'No'} />
                    <SummaryItem label="Geo-Ref" value={form.georeferencing ? 'Yes' : 'No'} />
                </div>
            </div>
        </div>
    );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
            <div className="text-sm font-medium text-slate-700">{value}</div>
        </div>
    );
}

const stageColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    complete: 'bg-blue-50 text-blue-700',
    priced: 'bg-emerald-50 text-emerald-700',
    quoted: 'bg-purple-50 text-purple-700',
    won: 'bg-green-50 text-green-700',
    lost: 'bg-red-50 text-red-700',
};

function StageBadge({ stage }: { stage: string }) {
    return (
        <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
            stageColors[stage] || stageColors.draft,
        )}>
            {stage}
        </span>
    );
}
