import { useState, useEffect } from 'react';
import type { LineItemShell, QuoteTotals } from '@shared/types/lineItem';
import type { ScopingFormData, ProposalTemplateData } from '@/services/api';
import { fetchActiveProposalTemplate } from '@/services/api';
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
    const lodLevels = [...new Set(areas.map(a => a.lod))];

    // Load template for boilerplate preview
    const [template, setTemplate] = useState<ProposalTemplateData | null>(null);
    useEffect(() => {
        fetchActiveProposalTemplate().then(setTemplate).catch(() => {});
    }, []);

    // Build disciplines list
    const allDisciplines = [...new Set(areas.flatMap(a => {
        const d: string[] = ['Architecture'];
        if (a.structural?.enabled) d.push('Structural');
        if (a.mepf?.enabled) d.push('MEPF');
        if (a.cadDeliverable && a.cadDeliverable !== 'No') d.push('CAD');
        if (a.act?.enabled) d.push('ACT');
        if (a.belowFloor?.enabled) d.push('Below Floor');
        return d;
    }))];

    // Build estimate line items (mirrors server mapper)
    const estimateItems = pricedItems.map(li => {
        const sf = li.squareFeet || 0;
        const price = li.clientPrice!;
        let item = li.areaName;
        let desc = li.description;

        if (li.discipline) {
            item = `${li.areaName} — ${li.discipline.charAt(0).toUpperCase() + li.discipline.slice(1)}`;
            desc = [
                li.scope || '',
                li.lod ? `LoD ${li.lod}` : '',
                sf > 0 ? `${sf.toLocaleString()} SF` : '',
            ].filter(Boolean).join(' | ');
        } else if (li.category === 'travel') {
            item = 'Travel';
        } else if (li.category === 'addOn') {
            item = 'Additional Service';
        }

        const qty = sf > 0 ? sf.toLocaleString() : '1';
        const rate = sf > 0 ? price / sf : price;
        return { item, description: desc || li.description, qty, rate: Math.round(rate * 100) / 100, amount: price };
    });

    const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-1">
            {/* Page indicator */}
            <div className="text-[10px] font-mono text-slate-400 text-right pr-1 mb-1">
                Preview — 9-11 page PDF
            </div>

            {/* ── PAGE 1: COVER ── */}
            <PageCard label="Page 1 — Cover">
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

                <div className="mt-4 bg-slate-50 -mx-8 px-8 py-5 border-y border-slate-100">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">PROPOSAL</div>
                    <h3 className="text-xl font-bold text-slate-800">{form.projectName || 'Untitled Project'}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <DetailRow label="Client" value={form.clientCompany} />
                        <DetailRow label="Contact" value={form.primaryContactName} />
                        <DetailRow label="Address" value={form.projectAddress} />
                        <DetailRow label="Total Area" value={`${totalSF.toLocaleString()} SF`} />
                        <DetailRow label="Floors" value={String(form.numberOfFloors || '—')} />
                        <DetailRow label="BIM" value={`${form.bimDeliverable || '—'}${form.bimVersion ? ` (${form.bimVersion})` : ''}`} />
                    </div>
                </div>

                {customMessage && (
                    <p className="text-sm text-slate-600 italic bg-blue-50 rounded-lg px-4 py-3 border-l-3 border-blue-400 mt-4">
                        {customMessage}
                    </p>
                )}

                <div className="mt-4 bg-slate-100 rounded-xl px-6 py-4">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Investment</div>
                    <div className="text-2xl font-bold text-blue-800">{fmt(totals.totalClientPrice)}</div>
                </div>
            </PageCard>

            {/* ── PAGE 2: ABOUT + WHY ── */}
            <PageCard label="Page 2 — About & Why Scan2Plan">
                <SectionTitle>About Scan2Plan</SectionTitle>
                <BoilerplatePreview text={template?.aboutScan2plan} placeholder="Company overview — edit in Settings → Proposal Template" />
                <div className="mt-6">
                    <SectionTitle>Why Scan2Plan?</SectionTitle>
                    <BoilerplatePreview text={template?.whyScan2plan} placeholder="Value proposition — edit in Settings → Proposal Template" />
                </div>
            </PageCard>

            {/* ── PAGES 3-4: THE PROJECT ── */}
            <PageCard label="Pages 3-4 — The Project">
                <SectionTitle>Project Overview</SectionTitle>
                <p className="text-sm text-slate-600 mb-4">
                    {form.clientCompany} has engaged Scan2Plan to provide professional 3D laser scanning
                    and BIM modeling services for {form.projectName}, located at {form.projectAddress}.
                    The project encompasses {totalSF.toLocaleString()} square feet across {form.numberOfFloors} floor(s).
                </p>

                <SectionTitle>Scope of Work</SectionTitle>
                {areas.map((area, i) => {
                    const disciplines: string[] = ['Architecture'];
                    if (area.structural?.enabled) disciplines.push('Structural');
                    if (area.mepf?.enabled) disciplines.push('MEPF');
                    if (area.cadDeliverable && area.cadDeliverable !== 'No') disciplines.push('CAD');
                    if (area.act?.enabled) disciplines.push('ACT');
                    if (area.belowFloor?.enabled) disciplines.push('Below Floor');
                    return (
                        <div key={i} className="mb-3">
                            <div className="text-sm font-semibold text-slate-700">{area.areaName || area.areaType} — {area.areaType}</div>
                            <div className="text-xs text-slate-400">
                                {area.squareFootage.toLocaleString()} SF | {area.projectScope} | LoD {area.lod} | {disciplines.join(', ')}
                            </div>
                        </div>
                    );
                })}

                <div className="mt-4">
                    <SectionTitle>Deliverables</SectionTitle>
                    <p className="text-sm text-slate-600">
                        {form.bimDeliverable}{form.bimVersion ? ` (${form.bimVersion})` : ''} — {allDisciplines.join(', ')} — LoD {lodLevels.join(', ')}
                    </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {form.georeferencing && <Tag>Georeferencing</Tag>}
                    {form.expedited && <Tag color="amber">Expedited (+20%)</Tag>}
                    <Tag color="purple">Travel: {form.travelMode}</Tag>
                </div>

                <div className="mt-4">
                    <SectionTitle>Timeline</SectionTitle>
                    <p className="text-sm text-slate-600">{form.estTimeline || '4-6 weeks from scanning completion'}</p>
                </div>
            </PageCard>

            {/* ── PAGES 5-6: ESTIMATE TABLE ── */}
            <PageCard label="Pages 5-6 — Estimate">
                <SectionTitle>Estimate</SectionTitle>
                <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-sm min-w-[520px]">
                        <thead>
                            <tr className="bg-blue-800 text-white text-left">
                                <th className="py-2 px-3 text-[10px] font-semibold uppercase">Item</th>
                                <th className="py-2 px-3 text-[10px] font-semibold uppercase">Description</th>
                                <th className="py-2 px-3 text-[10px] font-semibold uppercase text-right">Qty</th>
                                <th className="py-2 px-3 text-[10px] font-semibold uppercase text-right">Rate</th>
                                <th className="py-2 px-3 text-[10px] font-semibold uppercase text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {estimateItems.map((item, i) => (
                                <tr key={i} className={cn('border-b border-slate-50', i % 2 === 0 && 'bg-slate-50/50')}>
                                    <td className="py-2 px-3 text-xs font-semibold text-slate-700">{item.item}</td>
                                    <td className="py-2 px-3 text-xs text-slate-500">{item.description}</td>
                                    <td className="py-2 px-3 text-xs text-right text-slate-600">{item.qty}</td>
                                    <td className="py-2 px-3 text-xs text-right text-slate-600">{fmt(item.rate)}</td>
                                    <td className="py-2 px-3 text-xs text-right font-semibold text-slate-800">{fmt(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-blue-800 text-white">
                                <td colSpan={4} className="py-3 px-3 font-bold text-sm">TOTAL</td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                                    {fmt(totals.totalClientPrice)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="mt-2 text-[10px] text-slate-400">
                    {estimateItems.length} line item{estimateItems.length !== 1 ? 's' : ''} | {totalSF.toLocaleString()} total SF
                </div>
            </PageCard>

            {/* ── PAGE 7: PAYMENT TERMS ── */}
            <PageCard label="Page 7 — Payment Terms">
                <SectionTitle>Payment Terms</SectionTitle>
                <div className="bg-slate-50 rounded-xl px-5 py-4 mb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Deposit (50%)</div>
                            <div className="text-lg font-bold text-blue-800">{fmt(totals.totalClientPrice * 0.5)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Project</div>
                            <div className="text-lg font-bold text-blue-800">{fmt(totals.totalClientPrice)}</div>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                        Terms: {form.paymentTerms || 'Net 30'} | Estimated: {totalSF.toLocaleString()} SF
                    </div>
                </div>
                <div className="text-xs text-slate-500 mb-3">
                    <span className="font-semibold">Payment Methods:</span> Check • Wire Transfer • Credit Card
                </div>
                <BoilerplatePreview
                    text={template?.sfAuditClause}
                    placeholder="SF audit clause — edit in Settings → Proposal Template"
                    size="sm"
                />
            </PageCard>

            {/* ── PAGE 8: CAPABILITIES ── */}
            <PageCard label="Page 8 — Capabilities">
                <SectionTitle>Scan2Plan Capabilities</SectionTitle>
                <BoilerplatePreview text={template?.capabilities} placeholder="Capabilities content — edit in Settings → Proposal Template" />
            </PageCard>

            {/* ── PAGE 9: DIFFERENCE ── */}
            <PageCard label="Page 9 — The Difference">
                <SectionTitle>The Scan2Plan Difference</SectionTitle>
                <BoilerplatePreview text={template?.difference} placeholder="Competitive advantage content — edit in Settings → Proposal Template" />
            </PageCard>

            {/* ── PAGES 10-11: BIM STANDARDS ── */}
            <PageCard label="Pages 10-11 — BIM Modeling Standards">
                <SectionTitle>BIM Modeling Standards</SectionTitle>
                <BoilerplatePreview
                    text={template?.bimStandardsIntro}
                    placeholder="BIM standards intro — edit in Settings → Proposal Template"
                    size="sm"
                />
                <div className="mt-3 overflow-x-auto -mx-4">
                    <table className="w-full text-xs min-w-[480px]">
                        <thead>
                            <tr className="bg-blue-800 text-white text-left">
                                <th className="py-2 px-2 text-[10px] font-semibold uppercase">LoD Level</th>
                                <th className="py-2 px-2 text-[10px] font-semibold uppercase">Description</th>
                                <th className="py-2 px-2 text-[10px] font-semibold uppercase">Use Cases</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { level: 'LOD 200', desc: 'Generic placeholder geometry', use: 'Conceptual design, space planning' },
                                { level: 'LOD 300', desc: 'Accurate geometry, specific assemblies', use: 'Design development, construction docs' },
                                { level: 'LOD 350', desc: 'LOD 300 + system interfaces', use: 'Trade coordination, fabrication' },
                                { level: 'LOD 350+', desc: 'Field-verified, manufacturer data', use: 'Facility management, digital twin' },
                            ].map((row) => {
                                const isHighlighted = lodLevels.some(l => {
                                    const norm = l.replace(/\s+/g, '').toUpperCase();
                                    const rowNorm = row.level.replace(/\s+/g, '').toUpperCase();
                                    return norm.includes(rowNorm.replace('LOD', ''));
                                });
                                return (
                                    <tr
                                        key={row.level}
                                        className={cn(
                                            'border-b border-slate-100',
                                            isHighlighted ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                                        )}
                                    >
                                        <td className={cn('py-2 px-2 font-semibold', isHighlighted ? 'text-blue-700' : 'text-slate-700')}>
                                            {row.level}
                                        </td>
                                        <td className="py-2 px-2 text-slate-600">{row.desc}</td>
                                        <td className="py-2 px-2 text-slate-500">{row.use}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="inline-block w-3 h-3 bg-blue-50 border-l-2 border-blue-500 rounded-sm" />
                    LoD levels applicable to this project
                </div>
            </PageCard>

            {/* Footer */}
            <div className="text-[10px] text-slate-400 text-center py-2">
                End of proposal preview — {form.upid || '—'} • v1 • {new Date().toLocaleDateString()}
            </div>
        </div>
    );
}

// ── Sub-components ──

function PageCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] font-mono text-slate-400">{label}</span>
            </div>
            <div className="px-8 py-5">{children}</div>
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

function BoilerplatePreview({ text, placeholder, size = 'md' }: { text?: string | null; placeholder: string; size?: 'sm' | 'md' }) {
    if (!text) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 italic">
                {placeholder}
            </div>
        );
    }
    // Render boilerplate with bullet support
    const lines = text.split('\n');
    return (
        <div className={cn('text-slate-600', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;
                if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    const content = trimmed.replace(/^[•\-*]\s*/, '');
                    return <div key={i} className="ml-2">• {content}</div>;
                }
                return <div key={i}>{trimmed}</div>;
            })}
        </div>
    );
}
