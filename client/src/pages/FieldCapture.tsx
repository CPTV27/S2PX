// ── Scantech Field Capture App ──
// Mobile-first form for scan technicians in the field.
// 15 prefilled fields from scoping cascade + 23 manual tech entries.
// Route: /field/:projectId (no sidebar — full-width mobile layout)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Loader2, MapPin, Building2, Layers, CheckCircle, Save,
    ChevronDown, ChevronUp, Shield, Clock, DollarSign, BarChart3,
    AlertTriangle, ArrowLeft, Wifi, WifiOff,
} from 'lucide-react';
import {
    fetchProductionProject,
    updateProductionProject,
    type ProductionProjectData,
} from '@/services/api';
import { QualityGate } from '@/components/field/QualityGate';
import { ScanMetrics } from '@/components/field/ScanMetrics';
import { CostReport } from '@/components/field/CostReport';
import { cn } from '@/lib/utils';

// ── Prefilled field definitions (read-only from cascade) ──

interface PrefilledFieldDef {
    key: string;
    label: string;
    unit?: string;
    format?: 'array' | 'boolean' | 'number';
}

const PREFILLED_FIELDS: PrefilledFieldDef[] = [
    { key: 'projectCode', label: 'Project Code (UPID)' },
    { key: 'address', label: 'Address' },
    { key: 'buildingType', label: 'Building Type' },
    { key: 'estSF', label: 'Est. Square Footage', unit: 'SF', format: 'number' },
    { key: 'floors', label: 'Floors', format: 'number' },
    { key: 'estScans', label: 'Est. Scan Positions', format: 'number' },
    { key: 'scope', label: 'Scope', format: 'array' },
    { key: 'baseLocation', label: 'Base Location' },
    { key: 'era', label: 'Era' },
    { key: 'density', label: 'Room Density', format: 'number' },
    { key: 'scanDays', label: 'Est. Scan Days (CEO)', format: 'number' },
    { key: 'numTechs', label: '# Techs Planned', format: 'number' },
    { key: 'pricingTier', label: 'Pricing Tier' },
    { key: 'actPresent', label: 'ACT Present', format: 'boolean' },
    { key: 'belowFloor', label: 'Below Floor', format: 'boolean' },
];

// ── Main Page ──

export function FieldCapture() {
    const { projectId: pid } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const projectId = pid ? parseInt(pid, 10) : undefined;

    const [project, setProject] = useState<ProductionProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [prefilledOpen, setPrefilledOpen] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Online/offline detection
    useEffect(() => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const loadProject = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const data = await fetchProductionProject(projectId);

            // Must be at field_capture stage
            if (data.currentStage !== 'field_capture') {
                setError(`This project is at the "${data.currentStage}" stage, not Field Capture.`);
                setLoading(false);
                return;
            }

            setProject(data);
            const stageData = (data.stageData as Record<string, Record<string, unknown>>)?.field_capture ?? {};
            setValues(stageData);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load project');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { loadProject(); }, [loadProject]);

    const handleChange = (key: string, value: unknown) => {
        setValues(prev => ({ ...prev, [key]: value }));
        setSaveStatus('idle');

        // Debounced autosave (5 seconds for field — conserve battery/bandwidth)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            handleSave({ ...values, [key]: value });
        }, 5000);
    };

    const handleSave = async (data?: Record<string, unknown>) => {
        if (!projectId) return;
        try {
            setSaving(true);
            await updateProductionProject(projectId, data ?? values);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err: any) {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const handleManualSave = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        handleSave();
    };

    // ── Loading / Error states ──

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin text-blue-500 mx-auto" size={32} />
                    <p className="text-sm text-slate-400 mt-3">Loading field capture...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <AlertTriangle className="text-amber-500 mx-auto mb-3" size={32} />
                    <p className="text-sm text-red-600 mb-4">{error || 'Project not found'}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        {project.upid}
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded uppercase">
                                        Field Capture
                                    </span>
                                </div>
                                <h1 className="text-sm font-bold text-slate-800 truncate mt-0.5">
                                    {project.projectName || 'Untitled'}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Online indicator */}
                            {online ? (
                                <Wifi size={14} className="text-emerald-500" />
                            ) : (
                                <WifiOff size={14} className="text-red-400" />
                            )}
                            {/* Save status */}
                            <span className={cn(
                                'text-[10px] font-medium',
                                saveStatus === 'saved' && 'text-emerald-500',
                                saveStatus === 'error' && 'text-red-500',
                                saveStatus === 'idle' && 'text-transparent',
                            )}>
                                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : '.'}
                            </span>
                        </div>
                    </div>
                    {/* Compact project info */}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 overflow-hidden">
                        <span className="flex items-center gap-1 truncate">
                            <Building2 size={10} />
                            {project.clientCompany || '—'}
                        </span>
                        {project.projectAddress && (
                            <span className="flex items-center gap-1 truncate">
                                <MapPin size={10} />
                                {project.projectAddress}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
                {/* Prefilled section (collapsible) */}
                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button
                        onClick={() => setPrefilledOpen(!prefilledOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-700">Prefilled from Scoping</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {PREFILLED_FIELDS.length} fields
                            </span>
                        </div>
                        {prefilledOpen ? (
                            <ChevronUp size={16} className="text-slate-400" />
                        ) : (
                            <ChevronDown size={16} className="text-slate-400" />
                        )}
                    </button>
                    {prefilledOpen && (
                        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                            {PREFILLED_FIELDS.map(field => (
                                <div key={field.key} className="flex items-center justify-between py-1">
                                    <span className="text-xs text-slate-500">{field.label}</span>
                                    <span className="text-xs font-medium text-slate-700 text-right max-w-[60%] truncate">
                                        {formatPrefilled(values[field.key], field)}
                                        {field.unit && (
                                            <span className="text-slate-400 ml-1">{field.unit}</span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Scan Metrics section */}
                <FieldSection
                    icon={BarChart3}
                    iconColor="text-indigo-500"
                    title="Scan Metrics"
                    defaultOpen
                >
                    <ScanMetrics values={values} onChange={handleChange} />
                </FieldSection>

                {/* Quality Gate section */}
                <FieldSection
                    icon={Shield}
                    iconColor="text-emerald-500"
                    title="Quality Gates"
                    badge={getQualityBadge(values)}
                    defaultOpen
                >
                    <QualityGate
                        fieldRMS={values.fieldRMS as number | null ?? null}
                        avgOverlap={values.avgOverlap as number | null ?? null}
                        fieldSignOff={values.fieldSignOff as string | null ?? null}
                        onChange={handleChange}
                    />
                </FieldSection>

                {/* Cost Report section */}
                <FieldSection
                    icon={DollarSign}
                    iconColor="text-amber-500"
                    title="Travel & Costs"
                >
                    <CostReport values={values} onChange={handleChange} />
                </FieldSection>
            </main>

            {/* ── Sticky Save Bar ── */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-30">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400 min-w-0">
                        {getCompletionText(values)}
                    </div>
                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                        {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Collapsible Section Wrapper ──

function FieldSection({
    icon: Icon,
    iconColor,
    title,
    badge,
    defaultOpen = false,
    children,
}: {
    icon: typeof Clock;
    iconColor: string;
    title: string;
    badge?: { label: string; color: string } | null;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <Icon size={16} className={iconColor} />
                    <span className="text-sm font-bold text-slate-700">{title}</span>
                    {badge && (
                        <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            badge.color,
                        )}>
                            {badge.label}
                        </span>
                    )}
                </div>
                {open ? (
                    <ChevronUp size={16} className="text-slate-400" />
                ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                )}
            </button>
            {open && (
                <div className="border-t border-slate-100 px-4 py-4">
                    {children}
                </div>
            )}
        </section>
    );
}

// ── Helpers ──

function formatPrefilled(value: unknown, field: PrefilledFieldDef): string {
    if (value === null || value === undefined) return '—';
    if (field.format === 'array' && Array.isArray(value)) return value.join(', ') || '—';
    if (field.format === 'boolean') return value ? 'Yes' : 'No';
    if (field.format === 'number' && typeof value === 'number') return value.toLocaleString();
    return String(value);
}

function getQualityBadge(values: Record<string, unknown>): { label: string; color: string } | null {
    const rms = values.fieldRMS as number | null;
    const overlap = values.avgOverlap as number | null;
    if (rms === null || rms === undefined || overlap === null || overlap === undefined) return null;

    const rmsOk = rms <= 5;
    const overlapOk = overlap >= 50;

    if (rmsOk && overlapOk) return { label: 'PASS', color: 'bg-emerald-100 text-emerald-700' };
    return { label: 'FAIL', color: 'bg-red-100 text-red-700' };
}

function getCompletionText(values: Record<string, unknown>): string {
    // Count filled manual fields (non-prefilled)
    const manualKeys = [
        'fieldDate', 'fieldTech', 'scannerSN', 'rooms',
        'hoursScanned', 'hoursDelayed', 'fieldRMS', 'avgOverlap', 'fieldSignOff',
        'hoursTraveled', 'milesDriven', 'hotelPerDiem', 'tollsParking', 'otherFieldCosts',
        'actualObservedSF', 'hrsScannedInt', 'hrsScannedExt', 'hrsScannedLandscape',
        'scanPtsInt', 'scanPtsExt', 'scanPtsLandscape',
    ];
    const filled = manualKeys.filter(k => values[k] !== null && values[k] !== undefined && values[k] !== '').length;
    return `${filled}/${manualKeys.length} fields completed`;
}
