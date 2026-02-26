import { useState, useEffect } from 'react';
import type { ScopingFormData } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Lock } from 'lucide-react';

interface CEOSectionsProps {
    form: ScopingFormData;
    onUpdate: (fields: Partial<ScopingFormData>) => void;
}

export function CEOSections({ form, onUpdate }: CEOSectionsProps) {
    const { user } = useAuth();
    const isCeo = user?.role === 'ceo' || user?.role === 'admin';

    if (!isCeo) {
        return (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Lock size={14} />
                    CEO-only sections (J, K, L) — restricted
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SectionJ form={form} onUpdate={onUpdate} />
            <SectionK form={form} onUpdate={onUpdate} />
            <SectionL form={form} onUpdate={onUpdate} />
        </div>
    );
}

/** Section J: Resource Assignment */
function SectionJ({ form, onUpdate }: CEOSectionsProps) {
    return (
        <FieldGroup title="J — Resource Assignment">
            <Field label="Pricing Tier" value={form.pricingTier} onChange={v => onUpdate({ pricingTier: v })} />
            <Field label="BIM Manager" value={form.bimManager} onChange={v => onUpdate({ bimManager: v })} />
            <Field label="Scanner Assignment" value={form.scannerAssignment} onChange={v => onUpdate({ scannerAssignment: v })} />
            <NumberField label="Est. Scan Days" value={form.estScanDays} onChange={v => onUpdate({ estScanDays: v })} />
            <NumberField label="Techs Planned" value={form.techsPlanned} onChange={v => onUpdate({ techsPlanned: v })} />
        </FieldGroup>
    );
}

/** Section K: Whale Override */
function SectionK({ form, onUpdate }: CEOSectionsProps) {
    return (
        <FieldGroup title="K — Whale Override">
            <CurrencyField label="M Override" value={form.mOverride} onChange={v => onUpdate({ mOverride: v })} />
            <CurrencyField label="Whale Scan Cost" value={form.whaleScanCost} onChange={v => onUpdate({ whaleScanCost: v })} />
            <CurrencyField label="Whale Model Cost" value={form.whaleModelCost} onChange={v => onUpdate({ whaleModelCost: v })} />
        </FieldGroup>
    );
}

/** Section L: Profitability Notes */
function SectionL({ form, onUpdate }: CEOSectionsProps) {
    return (
        <FieldGroup title="L — Profitability">
            <CurrencyField label="Assumed Savings (M)" value={form.assumedSavingsM} onChange={v => onUpdate({ assumedSavingsM: v })} />
            <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Caveats / Profitability Notes</label>
                <textarea
                    value={form.caveatsProfitability || ''}
                    onChange={e => onUpdate({ caveatsProfitability: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none resize-none"
                />
            </div>
        </FieldGroup>
    );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-2.5 border-b border-slate-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
                {children}
            </div>
        </div>
    );
}

function Field({ label, value, onChange }: { label: string; value?: string | null; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
            />
        </div>
    );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input
                type="number"
                value={value ?? ''}
                onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
            />
        </div>
    );
}

function CurrencyField({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                    type="number"
                    step="0.01"
                    value={value ?? ''}
                    onChange={e => onChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
                />
            </div>
        </div>
    );
}
