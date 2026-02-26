import type { LineItemShell, QuoteTotals } from '@shared/types/lineItem';
import type { ScopingFormData } from '@/services/api';
import { cn } from '@/lib/utils';

interface ProposalPreviewProps {
    form: ScopingFormData;
    lineItems: LineItemShell[];
    totals: QuoteTotals;
    customMessage?: string;
}

export function ProposalPreview({ form, lineItems, totals, customMessage }: ProposalPreviewProps) {
    const areas = form.areas || [];
    const pricedItems = lineItems.filter(li => li.clientPrice !== null && li.clientPrice > 0);
    const totalSF = areas.reduce((s, a) => s + (a.squareFootage || 0), 0);

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-blue-800">SCAN2PLAN</h2>
                        <p className="text-xs text-slate-400">3D Scanning & BIM Services</p>
                    </div>
                    <div className="text-right text-xs text-slate-400 space-y-0.5">
                        <div className="font-mono text-blue-600 font-semibold">{form.upid || '—'}</div>
                        <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </div>
            </div>

            {/* Project info */}
            <div className="px-8 py-5 bg-slate-50 border-b border-slate-100">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">PROPOSAL</div>
                <h3 className="text-xl font-bold text-slate-800">{form.projectName || 'Untitled Project'}</h3>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <DetailRow label="Client" value={form.clientCompany} />
                    <DetailRow label="Contact" value={form.primaryContactName} />
                    <DetailRow label="Address" value={form.projectAddress} />
                    <DetailRow label="Total Area" value={`${totalSF.toLocaleString()} SF`} />
                    <DetailRow label="Floors" value={String(form.numberOfFloors || '—')} />
                    <DetailRow label="BIM Deliverable" value={form.bimDeliverable || '—'} />
                </div>
            </div>

            {/* Custom message */}
            {customMessage && (
                <div className="px-8 py-4 border-b border-slate-100">
                    <p className="text-sm text-slate-600 italic bg-blue-50 rounded-lg px-4 py-3 border-l-3 border-blue-400">
                        {customMessage}
                    </p>
                </div>
            )}

            {/* Scope summary */}
            <div className="px-8 py-5 border-b border-slate-100">
                <SectionTitle>Scope of Work</SectionTitle>
                {areas.map((area, i) => {
                    const disciplines: string[] = ['Architecture'];
                    if (area.structural?.enabled) disciplines.push('Structural');
                    if (area.mepf?.enabled) disciplines.push('MEPF');
                    if (area.cadDeliverable && area.cadDeliverable !== 'No') disciplines.push(`CAD`);
                    if (area.act?.enabled) disciplines.push('ACT');
                    if (area.belowFloor?.enabled) disciplines.push('Below Floor');

                    return (
                        <div key={i} className="mb-3">
                            <div className="text-sm font-semibold text-slate-700">
                                {area.areaName || area.areaType} — {area.areaType}
                            </div>
                            <div className="text-xs text-slate-400">
                                {area.squareFootage.toLocaleString()} SF | {area.projectScope} | LoD {area.lod} | {disciplines.join(', ')}
                            </div>
                        </div>
                    );
                })}

                <div className="mt-4 flex flex-wrap gap-2">
                    {form.georeferencing && <Tag>Georeferencing</Tag>}
                    {form.expedited && <Tag color="amber">Expedited (+20%)</Tag>}
                    <Tag color="purple">Travel: {form.travelMode}</Tag>
                </div>
            </div>

            {/* Line items */}
            <div className="px-8 py-5 border-b border-slate-100">
                <SectionTitle>Investment Breakdown</SectionTitle>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-left">
                            <th className="py-2 px-3 text-xs font-semibold text-slate-400 uppercase">Line Item</th>
                            <th className="py-2 px-3 text-xs font-semibold text-slate-400 uppercase text-right">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pricedItems.map((item, i) => (
                            <tr key={i} className="border-b border-slate-50">
                                <td className="py-2 px-3 text-slate-700">{item.description}</td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                                    ${item.clientPrice!.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-blue-800 text-white">
                            <td className="py-3 px-3 font-bold">TOTAL</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-lg">
                                ${totals.totalClientPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Terms */}
            {(form.paymentTerms || form.estTimeline) && (
                <div className="px-8 py-5 border-b border-slate-100">
                    <SectionTitle>Terms</SectionTitle>
                    {form.paymentTerms && <DetailRow label="Payment Terms" value={form.paymentTerms} />}
                    {form.estTimeline && <DetailRow label="Timeline" value={form.estTimeline} />}
                </div>
            )}

            {/* Footer */}
            <div className="px-8 py-4 text-[10px] text-slate-400">
                This proposal is valid for 30 days from date of issue. Prices are based on the scope described above.
            </div>
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-3">
            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider">{children}</h4>
            <div className="w-12 h-0.5 bg-blue-500 mt-1" />
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <span className="text-xs text-slate-400">{label}: </span>
            <span className="text-sm font-medium text-slate-700">{value || '—'}</span>
        </div>
    );
}

function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
    };
    return (
        <span className={cn('inline-block text-[10px] font-semibold px-2 py-0.5 rounded border', colors[color] || colors.blue)}>
            {children}
        </span>
    );
}
