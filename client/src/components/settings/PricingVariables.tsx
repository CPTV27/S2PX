// ── Pricing Variables Editor ──
// CEO/Admin-editable form for all pricing config values.
// Reads from /api/pricing-config, saves via PUT.
// All computed values (M, margins, prices) are calculated in the engine — never stored.

import { useState, useEffect, useCallback } from 'react';
import {
    ChevronDown,
    Save,
    Loader2,
    CheckCircle,
    RotateCcw,
    AlertTriangle,
} from 'lucide-react';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { updatePricingConfig } from '@/services/api';
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@shared/types/pricingConfig';
import { cn } from '@/lib/utils';

// ── Section Collapse State ──────────────────────────────────────────────────

interface SectionProps {
    title: string;
    subtitle: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

function Section({ title, subtitle, defaultOpen = false, children }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-s2p-border rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-5 hover:bg-s2p-secondary/30 transition-colors"
            >
                <div className="text-left">
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs text-s2p-muted mt-0.5">{subtitle}</div>
                </div>
                <ChevronDown
                    size={16}
                    className={cn('text-s2p-muted transition-transform', open && 'rotate-180')}
                />
            </button>
            {open && <div className="px-5 pb-5 space-y-4 border-t border-s2p-border pt-4">{children}</div>}
        </div>
    );
}

// ── Field Components ────────────────────────────────────────────────────────

interface NumberFieldProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    step?: string;
    suffix?: string;
    prefix?: string;
    min?: number;
    max?: number;
    hint?: string;
}

function NumberField({ label, value, onChange, step = '0.01', suffix, prefix, min, max, hint }: NumberFieldProps) {
    return (
        <div>
            <label className="block text-xs font-medium text-s2p-fg mb-1">{label}</label>
            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-s2p-muted text-sm">{prefix}</span>
                )}
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    step={step}
                    min={min}
                    max={max}
                    className={cn(
                        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
                        'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                        prefix && 'pl-7',
                        suffix && 'pr-8',
                    )}
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-s2p-muted text-xs">{suffix}</span>
                )}
            </div>
            {hint && <p className="text-xs text-s2p-muted mt-1">{hint}</p>}
        </div>
    );
}

interface PercentFieldProps {
    label: string;
    value: number; // stored as decimal (0.45 = 45%)
    onChange: (v: number) => void;
    hint?: string;
}

function PercentField({ label, value, onChange, hint }: PercentFieldProps) {
    // Display as percentage (45), store as decimal (0.45)
    const displayVal = Math.round(value * 10000) / 100; // 0.45 → 45.00
    return (
        <div>
            <label className="block text-xs font-medium text-s2p-fg mb-1">{label}</label>
            <div className="relative">
                <input
                    type="number"
                    value={displayVal}
                    onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
                    step="0.1"
                    min={0}
                    max={100}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 pr-8 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-s2p-muted text-xs">%</span>
            </div>
            {hint && <p className="text-xs text-s2p-muted mt-1">{hint}</p>}
        </div>
    );
}

// ── Record Editor (key-value pairs) ─────────────────────────────────────────

interface RecordFieldProps {
    label: string;
    record: Record<string, number>;
    onChange: (key: string, val: number) => void;
    isPercent?: boolean;
    prefix?: string;
    labels?: Record<string, string>; // human-friendly key labels
}

function RecordField({ label, record, onChange, isPercent, prefix, labels }: RecordFieldProps) {
    return (
        <div>
            <label className="block text-xs font-medium text-s2p-fg mb-2">{label}</label>
            <div className="grid grid-cols-2 gap-2">
                {Object.entries(record).map(([key, val]) => (
                    <div key={key}>
                        {isPercent ? (
                            <PercentField
                                label={labels?.[key] || key}
                                value={val}
                                onChange={(v) => onChange(key, v)}
                            />
                        ) : (
                            <NumberField
                                label={labels?.[key] || key}
                                value={val}
                                onChange={(v) => onChange(key, v)}
                                prefix={prefix}
                                step={prefix === '$' ? '0.01' : '0.001'}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Friendly Labels ─────────────────────────────────────────────────────────

const BASE_RATE_LABELS: Record<string, string> = {
    arch: 'Architecture',
    mepf: 'MEPF',
    structure: 'Structural',
    site: 'Site/Civil',
};

const LOD_LABELS: Record<string, string> = {
    '200': 'LoD 200',
    '300': 'LoD 300',
    '350': 'LoD 350',
};

const RISK_LABELS: Record<string, string> = {
    occupied: 'Occupied',
    hazardous: 'Hazardous',
    no_power: 'No Power',
    no_lighting: 'No Lighting',
    fire_flood: 'Fire / Flood',
};

const SCOPE_PORTION_LABELS: Record<string, string> = {
    full: 'Full (I+E)',
    interior: 'Interior Only',
    exterior: 'Exterior Only',
};

const SCOPE_DISCOUNT_LABELS: Record<string, string> = {
    full: 'Full (I+E)',
    interior: 'Interior Only',
    exterior: 'Exterior Only',
    mixed: 'Mixed',
};

const PAYMENT_LABELS: Record<string, string> = {
    partner: 'Partner',
    owner: 'Owner',
    net30: 'Net 30',
    net60: 'Net 60',
    net90: 'Net 90',
};

const BROOKLYN_LABELS: Record<string, string> = {
    tierC: 'Tier C (<10k sqft)',
    tierB: 'Tier B (10k-50k)',
    tierA: 'Tier A (50k+)',
};

// ── Main Component ──────────────────────────────────────────────────────────

export function PricingVariables() {
    const { config: loadedConfig, loading, error: loadError, updatedAt, updatedBy } = usePricingConfig();
    const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [updatedByInfo, setUpdatedByInfo] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Sync loaded config into local state
    useEffect(() => {
        if (!loading) {
            setConfig(loadedConfig);
            setUpdatedByInfo(updatedBy);
        }
    }, [loading, loadedConfig, updatedBy]);

    // ── Update helpers ──

    const update = useCallback(<K extends keyof PricingConfig>(key: K, val: PricingConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: val }));
        setIsDirty(true);
        setSaveStatus('idle');
    }, []);

    const updateNested = useCallback(<K extends keyof PricingConfig>(
        key: K,
        subKey: string,
        val: number,
    ) => {
        setConfig((prev) => ({
            ...prev,
            [key]: { ...(prev[key] as Record<string, unknown>), [subKey]: val },
        }));
        setIsDirty(true);
        setSaveStatus('idle');
    }, []);

    // ── Save ──

    const handleSave = useCallback(async () => {
        setSaveStatus('saving');
        setSaveError(null);
        try {
            const res = await updatePricingConfig(config);
            setSaveStatus('saved');
            setIsDirty(false);
            setUpdatedByInfo(res.updatedBy || null);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) {
            setSaveStatus('error');
            setSaveError(err instanceof Error ? err.message : 'Failed to save');
        }
    }, [config]);

    // ── Reset to Defaults ──

    const handleReset = useCallback(() => {
        setConfig({ ...DEFAULT_PRICING_CONFIG });
        setIsDirty(true);
        setSaveStatus('idle');
    }, []);

    // ── Loading State ──

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-s2p-muted" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-xl text-sm">
                <AlertTriangle size={16} />
                <span>Failed to load pricing config: {loadError}. Showing defaults.</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Meta info */}
            {updatedAt && (
                <p className="text-xs text-s2p-muted">
                    Last updated{' '}
                    {new Date(updatedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                    })}
                    {updatedByInfo && <> by <span className="font-mono">{updatedByInfo}</span></>}
                </p>
            )}

            {/* ── Section 1: Core Rates ── */}
            <Section title="Core Rates" subtitle="Matterport, ACT, upteam multiplier, minimums" defaultOpen>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <NumberField
                        label="Matterport $/sqft"
                        value={config.matterportRatePerSqft}
                        onChange={(v) => update('matterportRatePerSqft', v)}
                        prefix="$"
                        step="0.01"
                    />
                    <NumberField
                        label="ACT Ceilings $/sqft"
                        value={config.actRatePerSqft}
                        onChange={(v) => update('actRatePerSqft', v)}
                        prefix="$"
                        step="0.01"
                    />
                    <PercentField
                        label="Upteam Multiplier Fallback"
                        value={config.upteamMultiplierFallback}
                        onChange={(v) => update('upteamMultiplierFallback', v)}
                    />
                    <NumberField
                        label="Min Sqft Floor"
                        value={config.minSqftFloor}
                        onChange={(v) => update('minSqftFloor', v)}
                        step="100"
                        suffix="sqft"
                    />
                    <NumberField
                        label="Sqft per Acre"
                        value={config.sqftPerAcre}
                        onChange={(v) => update('sqftPerAcre', v)}
                        step="1"
                    />
                    <NumberField
                        label="Tier A Threshold"
                        value={config.tierAThreshold}
                        onChange={(v) => update('tierAThreshold', v)}
                        step="1000"
                        suffix="sqft"
                        hint="Projects above this are 'whale' tier"
                    />
                </div>
            </Section>

            {/* ── Section 2: Margins ── */}
            <Section title="Margin Controls" subtitle="Floor, guardrail, slider range, default target" defaultOpen>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <PercentField
                        label="FY26 Margin Floor"
                        value={config.fy26MarginFloor}
                        onChange={(v) => update('fy26MarginFloor', v)}
                        hint="Quotes below this are blocked"
                    />
                    <PercentField
                        label="Margin Guardrail"
                        value={config.marginGuardrail}
                        onChange={(v) => update('marginGuardrail', v)}
                        hint="Quotes below this trigger a warning"
                    />
                    <PercentField
                        label="Margin Default"
                        value={config.marginDefault}
                        onChange={(v) => update('marginDefault', v)}
                    />
                    <PercentField
                        label="Slider Min"
                        value={config.marginSliderMin}
                        onChange={(v) => update('marginSliderMin', v)}
                    />
                    <PercentField
                        label="Slider Max"
                        value={config.marginSliderMax}
                        onChange={(v) => update('marginSliderMax', v)}
                    />
                </div>
            </Section>

            {/* ── Section 3: Base Rates ── */}
            <Section title="Base Rates" subtitle="Per-discipline $/sqft rates" defaultOpen>
                <RecordField
                    label="Discipline Base Rates ($/sqft)"
                    record={config.baseRates}
                    onChange={(k, v) => updateNested('baseRates', k, v)}
                    prefix="$"
                    labels={BASE_RATE_LABELS}
                />
            </Section>

            {/* ── Section 4: LoD & Scope ── */}
            <Section title="LoD & Scope" subtitle="Level of detail multipliers, scope portions and discounts">
                <RecordField
                    label="LoD Multipliers"
                    record={config.lodMultipliers}
                    onChange={(k, v) => updateNested('lodMultipliers', k, v)}
                    labels={LOD_LABELS}
                />
                <RecordField
                    label="Scope Portions (Interior/Exterior Split)"
                    record={config.scopePortions}
                    onChange={(k, v) => updateNested('scopePortions', k, v)}
                    isPercent
                    labels={SCOPE_PORTION_LABELS}
                />
                <RecordField
                    label="Scope Discounts"
                    record={config.scopeDiscounts}
                    onChange={(k, v) => updateNested('scopeDiscounts', k, v)}
                    isPercent
                    labels={SCOPE_DISCOUNT_LABELS}
                />
            </Section>

            {/* ── Section 5: Risk & Payment ── */}
            <Section title="Risk & Payment Terms" subtitle="Risk premiums and payment term surcharges">
                <RecordField
                    label="Risk Premiums (Arch scan cost only)"
                    record={config.riskPremiums}
                    onChange={(k, v) => updateNested('riskPremiums', k, v)}
                    isPercent
                    labels={RISK_LABELS}
                />
                <RecordField
                    label="Payment Term Premiums"
                    record={config.paymentTermPremiums}
                    onChange={(k, v) => updateNested('paymentTermPremiums', k, v)}
                    isPercent
                    labels={PAYMENT_LABELS}
                />
            </Section>

            {/* ── Section 6: Travel ── */}
            <Section title="Travel" subtitle="Mileage rates, NYC tiers, overnight thresholds">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <NumberField
                        label="Standard Mileage Rate"
                        value={config.travelRates.standard}
                        onChange={(v) => update('travelRates', { ...config.travelRates, standard: v })}
                        prefix="$"
                        suffix="/mi"
                    />
                    <NumberField
                        label="Brooklyn Mileage Rate"
                        value={config.travelRates.brooklyn}
                        onChange={(v) => update('travelRates', { ...config.travelRates, brooklyn: v })}
                        prefix="$"
                        suffix="/mi"
                    />
                    <NumberField
                        label="Brooklyn Threshold"
                        value={config.travelRates.brooklynThreshold}
                        onChange={(v) => update('travelRates', { ...config.travelRates, brooklynThreshold: v })}
                        suffix="mi"
                        step="1"
                    />
                    <NumberField
                        label="Scan Day Fee Threshold"
                        value={config.travelRates.scanDayFeeThreshold}
                        onChange={(v) => update('travelRates', { ...config.travelRates, scanDayFeeThreshold: v })}
                        suffix="mi"
                        step="1"
                    />
                    <NumberField
                        label="Scan Day Fee"
                        value={config.travelRates.scanDayFee}
                        onChange={(v) => update('travelRates', { ...config.travelRates, scanDayFee: v })}
                        prefix="$"
                    />
                </div>
                <RecordField
                    label="Brooklyn Base Fees"
                    record={config.brooklynBaseFees}
                    onChange={(k, v) => updateNested('brooklynBaseFees', k, v)}
                    prefix="$"
                    labels={BROOKLYN_LABELS}
                />
            </Section>

            {/* ── Section 7: Add-Ons & Extras ── */}
            <Section title="Add-Ons & Extras" subtitle="Georeferencing, scan reg, expedited, below-floor, elevation">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <NumberField
                        label="Georeferencing / Structure"
                        value={config.georeferencingPerStructure}
                        onChange={(v) => update('georeferencingPerStructure', v)}
                        prefix="$"
                    />
                    <NumberField
                        label="Scan & Reg (Full Day)"
                        value={config.scanRegFullDay}
                        onChange={(v) => update('scanRegFullDay', v)}
                        prefix="$"
                    />
                    <NumberField
                        label="Scan & Reg (Half Day)"
                        value={config.scanRegHalfDay}
                        onChange={(v) => update('scanRegHalfDay', v)}
                        prefix="$"
                    />
                    <PercentField
                        label="Expedited Surcharge"
                        value={config.expeditedSurchargePercent}
                        onChange={(v) => update('expeditedSurchargePercent', v)}
                        hint="Applied to BIM + add-ons, not travel"
                    />
                    <PercentField
                        label="Below Floor Rate Fraction"
                        value={config.belowFloorRateFraction}
                        onChange={(v) => update('belowFloorRateFraction', v)}
                        hint="Fraction of Arch rate for below-floor work"
                    />
                </div>

                {/* Elevation Tiers */}
                <div>
                    <label className="block text-xs font-medium text-s2p-fg mb-2">Elevation Tier Pricing</label>
                    <div className="space-y-2">
                        {config.elevationTiers.map((tier, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-s2p-muted w-20">
                                    {i === 0 ? `0–${tier.max}` :
                                     tier.max === Infinity ? `${config.elevationTiers[i - 1].max}+` :
                                     `${config.elevationTiers[i - 1].max}–${tier.max}`} elev
                                </span>
                                <NumberField
                                    label=""
                                    value={tier.rate}
                                    onChange={(v) => {
                                        const newTiers = [...config.elevationTiers];
                                        newTiers[i] = { ...tier, rate: v };
                                        update('elevationTiers', newTiers);
                                    }}
                                    prefix="$"
                                    step="1"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ── Save Bar ── */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-s2p-border -mx-8 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-s2p-muted hover:text-s2p-fg border border-s2p-border rounded-lg hover:bg-s2p-secondary transition-colors"
                    >
                        <RotateCcw size={14} />
                        Reset to Defaults
                    </button>
                    {isDirty && (
                        <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {saveStatus === 'saved' && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={14} /> Saved
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle size={14} /> {saveError}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveStatus === 'saving' || !isDirty}
                        className={cn(
                            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                            isDirty
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-s2p-secondary text-s2p-muted cursor-not-allowed',
                        )}
                    >
                        {saveStatus === 'saving' ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Save size={14} />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
