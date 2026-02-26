import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Building2, MapPin, ChevronRight,
    CheckCircle, AlertCircle, Lock, Pencil, Eye,
} from 'lucide-react';
import {
    fetchProductionProject,
    updateProductionProject,
    type ProductionProjectData,
} from '@/services/api';
import { STAGE_CONFIGS, getStageConfig, getNextStage } from '@shared/types/production';
import type { ProductionStage } from '@shared/schema/constants';
import { StageTransition } from '@/components/production/StageTransition';
import { ProjectAssets } from '@/components/production/ProjectAssets';
import { cn } from '@/lib/utils';

// ── Field definition per stage (what to render in the form) ──

interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'checkbox' | 'tags' | 'readonly';
    prefilled?: boolean; // true = prefilled from cascade, show source indicator
    options?: string[];
    unit?: string;
}

const STAGE_FIELDS: Record<string, FieldDef[]> = {
    field_capture: [
        // Prefilled section
        { key: 'projectCode', label: 'Project Code (UPID)', type: 'readonly', prefilled: true },
        { key: 'address', label: 'Address', type: 'readonly', prefilled: true },
        { key: 'buildingType', label: 'Building Type', type: 'readonly', prefilled: true },
        { key: 'estSF', label: 'Est. Square Footage', type: 'readonly', prefilled: true, unit: 'SF' },
        { key: 'floors', label: 'Floors', type: 'readonly', prefilled: true },
        { key: 'estScans', label: 'Est. Scan Positions', type: 'readonly', prefilled: true },
        { key: 'scope', label: 'Scope', type: 'tags', prefilled: true },
        { key: 'baseLocation', label: 'Base Location', type: 'readonly', prefilled: true },
        { key: 'era', label: 'Era', type: 'readonly', prefilled: true },
        { key: 'density', label: 'Room Density', type: 'readonly', prefilled: true },
        { key: 'scanDays', label: 'Est. Scan Days (CEO)', type: 'readonly', prefilled: true },
        { key: 'numTechs', label: '# Techs Planned (CEO)', type: 'readonly', prefilled: true },
        { key: 'pricingTier', label: 'Pricing Tier (CEO)', type: 'readonly', prefilled: true },
        { key: 'actPresent', label: 'ACT Present', type: 'readonly', prefilled: true },
        { key: 'belowFloor', label: 'Below Floor', type: 'readonly', prefilled: true },
        // Manual / Tech fills
        { key: 'fieldDate', label: 'Field Date', type: 'text' },
        { key: 'fieldTech', label: 'Field Tech', type: 'text' },
        { key: 'scannerSN', label: 'Scanner S/N', type: 'text' },
        { key: 'rooms', label: 'Rooms', type: 'number' },
        { key: 'hoursScanned', label: 'Hours Scanned', type: 'number', unit: 'hrs' },
        { key: 'hoursDelayed', label: 'Hours Delayed', type: 'number', unit: 'hrs' },
        { key: 'fieldRMS', label: 'Field RMS', type: 'number', unit: 'mm' },
        { key: 'avgOverlap', label: 'Avg Overlap', type: 'number', unit: '%' },
        { key: 'fieldSignOff', label: 'Field Sign-Off', type: 'select', options: ['Pass', 'Conditional', 'Rejected'] },
        { key: 'hoursTraveled', label: 'Hours Traveled', type: 'number', unit: 'hrs' },
        { key: 'milesDriven', label: 'Miles Driven', type: 'number', unit: 'mi' },
        { key: 'hotelPerDiem', label: 'Hotel Per Diem', type: 'number', unit: '$' },
        { key: 'tollsParking', label: 'Tolls/Parking', type: 'number', unit: '$' },
        { key: 'otherFieldCosts', label: 'Other Field Costs', type: 'number', unit: '$' },
        { key: 'actualObservedSF', label: 'Actual Observed SF', type: 'number', unit: 'SF' },
        { key: 'hrsScannedInt', label: 'Hrs Scanned (Int)', type: 'number', unit: 'hrs' },
        { key: 'hrsScannedExt', label: 'Hrs Scanned (Ext)', type: 'number', unit: 'hrs' },
        { key: 'hrsScannedLandscape', label: 'Hrs Scanned (Landscape)', type: 'number', unit: 'hrs' },
        { key: 'scanPtsInt', label: 'Scan Points (Int)', type: 'number' },
        { key: 'scanPtsExt', label: 'Scan Points (Ext)', type: 'number' },
        { key: 'scanPtsLandscape', label: 'Scan Points (Landscape)', type: 'number' },
    ],
    registration: [
        { key: 'projectCode', label: 'Project Code', type: 'readonly', prefilled: true },
        { key: 'projectName', label: 'Project Name', type: 'readonly', prefilled: true },
        { key: 'estSF', label: 'Est. SF', type: 'readonly', prefilled: true, unit: 'SF' },
        { key: 'fieldTech', label: 'Field Tech', type: 'readonly', prefilled: true },
        { key: 'fieldDate', label: 'Field Date', type: 'readonly', prefilled: true },
        { key: 'cloudLoA', label: 'Cloud LoA', type: 'readonly', prefilled: true },
        { key: 'modelLoD', label: 'Model LoD', type: 'readonly', prefilled: true },
        { key: 'platform', label: 'BIM Platform', type: 'readonly', prefilled: true },
        { key: 'geoRefTier', label: 'GeoRef Tier', type: 'readonly', prefilled: true },
        { key: 'fieldRMS', label: 'Field RMS (carried)', type: 'readonly', prefilled: true, unit: 'mm' },
        // Manual
        { key: 'scanCount', label: 'Scan Count', type: 'number' },
        { key: 'software', label: 'Registration Software', type: 'text' },
        { key: 'regTech', label: 'Reg Tech', type: 'text' },
        { key: 'regDate', label: 'Reg Date', type: 'text' },
        { key: 'regRMS', label: 'Reg RMS', type: 'number', unit: 'mm' },
        { key: 'regSignOff', label: 'Reg Sign-Off', type: 'select', options: ['Pass', 'Conditional', 'Rejected'] },
    ],
    bim_qc: [
        { key: 'projectName', label: 'Project Name', type: 'readonly', prefilled: true },
        { key: 'projectCode', label: 'Project Code', type: 'readonly', prefilled: true },
        { key: 'estSF', label: 'Est. SF', type: 'readonly', prefilled: true, unit: 'SF' },
        { key: 'georeferenced', label: 'Georeferenced', type: 'readonly', prefilled: true },
        { key: 'modelLoD', label: 'Model LoD', type: 'readonly', prefilled: true },
        { key: 'revitVersion', label: 'Revit Version', type: 'readonly', prefilled: true },
        { key: 'scopeDiscipline', label: 'Disciplines', type: 'tags', prefilled: true },
        // Manual
        { key: 'actualSF', label: 'Actual SF', type: 'number', unit: 'SF' },
        { key: 'qcTech', label: 'QC Tech', type: 'text' },
        { key: 'qcDate', label: 'QC Date', type: 'text' },
        { key: 'qcStatus', label: 'QC Status', type: 'select', options: ['Pass', 'Fail', 'Conditional'] },
        { key: 'qcNotes', label: 'QC Notes', type: 'text' },
    ],
    pc_delivery: [
        { key: 'projectCode', label: 'Project Code', type: 'readonly', prefilled: true },
        { key: 'client', label: 'Client', type: 'readonly', prefilled: true },
        { key: 'projectName', label: 'Project Name', type: 'readonly', prefilled: true },
        { key: 'deliverySF', label: 'Delivery SF', type: 'readonly', prefilled: true, unit: 'SF' },
        { key: 'projectTier', label: 'Project Tier', type: 'readonly', prefilled: true },
        { key: 'geoRefTier', label: 'GeoRef Tier', type: 'readonly', prefilled: true },
        { key: 'platform', label: 'Platform', type: 'readonly', prefilled: true },
        { key: 'securityTier', label: 'Security Tier', type: 'readonly', prefilled: true },
        // Manual
        { key: 'deliveryDate', label: 'Delivery Date', type: 'text' },
        { key: 'deliveredBy', label: 'Delivered By', type: 'text' },
        { key: 'deliveryNotes', label: 'Delivery Notes', type: 'text' },
    ],
    final_delivery: [
        { key: 'projectCode', label: 'Project Code', type: 'readonly', prefilled: true },
        { key: 'client', label: 'Client', type: 'readonly', prefilled: true },
        { key: 'projectName', label: 'Project Name', type: 'readonly', prefilled: true },
        { key: 'deliverySF', label: 'Delivery SF', type: 'readonly', prefilled: true, unit: 'SF' },
        { key: 'scopeTier', label: 'Scope Tier', type: 'readonly', prefilled: true },
        { key: 'disciplines', label: 'Disciplines', type: 'tags', prefilled: true },
        { key: 'formats', label: 'Formats', type: 'tags', prefilled: true },
        // Manual
        { key: 'finalDeliveryDate', label: 'Final Delivery Date', type: 'text' },
        { key: 'clientSignOff', label: 'Client Sign-Off', type: 'select', options: ['Accepted', 'Revision Requested', 'Rejected'] },
        { key: 'finalNotes', label: 'Final Notes', type: 'text' },
    ],
};

// ── Stage color maps ──

const stageColorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// ── Main Page ──

export function ProductionDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const projectId = id ? parseInt(id, 10) : undefined;

    const [project, setProject] = useState<ProductionProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, unknown>>({});
    const [saving, setSaving] = useState(false);
    const [showTransition, setShowTransition] = useState(false);

    const loadProject = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const data = await fetchProductionProject(projectId);
            setProject(data);
            // Initialize edit values from current stage data
            const stageData = (data.stageData as Record<string, Record<string, unknown>>)?.[data.currentStage] ?? {};
            setEditValues(stageData);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load project');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { loadProject(); }, [loadProject]);

    const handleFieldChange = (key: string, value: unknown) => {
        setEditValues(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!projectId) return;
        try {
            setSaving(true);
            await updateProductionProject(projectId, editValues);
            await loadProject();
        } catch (err: any) {
            setError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleAdvanced = () => {
        setShowTransition(false);
        loadProject();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="max-w-2xl mx-auto mt-16 text-center">
                <p className="text-red-500 text-sm mb-4">{error || 'Project not found'}</p>
                <button onClick={() => navigate('/dashboard/production')} className="text-sm text-blue-600 hover:underline">
                    Back to Pipeline
                </button>
            </div>
        );
    }

    const currentConfig = getStageConfig(project.currentStage as ProductionStage);
    const nextStage = getNextStage(project.currentStage as ProductionStage);
    const nextConfig = nextStage ? getStageConfig(nextStage) : null;
    const fields = STAGE_FIELDS[project.currentStage] || [];
    const prefilledFields = fields.filter(f => f.prefilled);
    const manualFields = fields.filter(f => !f.prefilled);

    return (
        <div className="flex flex-col min-h-[calc(100vh-5rem)]">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <button
                        onClick={() => navigate('/dashboard/production')}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors mb-2"
                    >
                        <ArrowLeft size={14} />
                        Back to Pipeline
                    </button>
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                            {project.upid}
                        </span>
                        <span className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded',
                            stageColorMap[currentConfig.color],
                        )}>
                            {currentConfig.label}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {project.projectName || 'Untitled Project'}
                    </h1>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Building2 size={13} />{project.clientCompany}</span>
                        {project.projectAddress && (
                            <span className="flex items-center gap-1"><MapPin size={13} />{project.projectAddress}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Save Stage Data
                    </button>
                    {nextConfig && (
                        <button
                            onClick={() => setShowTransition(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            Advance to {nextConfig.shortLabel}
                            <ChevronRight size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Stage progress bar */}
            <StageProgressBar currentStage={project.currentStage as ProductionStage} />

            {/* Content grid */}
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6 mt-4">
                {/* Prefilled fields (read-only) */}
                {prefilledFields.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Eye size={14} className="text-blue-500" />
                            <h2 className="text-sm font-semibold text-slate-700">Prefilled from Cascade</h2>
                            <span className="text-[10px] text-slate-400 ml-auto">{prefilledFields.length} fields</span>
                        </div>
                        <div className="p-4 space-y-3">
                            {prefilledFields.map(field => (
                                <PrefilledField
                                    key={field.key}
                                    field={field}
                                    value={editValues[field.key]}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Manual entry fields */}
                {manualFields.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                            <Pencil size={14} className="text-emerald-500" />
                            <h2 className="text-sm font-semibold text-slate-700">Manual Entry</h2>
                            <span className="text-[10px] text-slate-400 ml-auto">{manualFields.length} fields</span>
                        </div>
                        <div className="p-4 space-y-3">
                            {manualFields.map(field => (
                                <EditableField
                                    key={field.key}
                                    field={field}
                                    value={editValues[field.key]}
                                    onChange={(val) => handleFieldChange(field.key, val)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Scoping stage: no fields, show summary */}
                {project.currentStage === 'scoping' && (
                    <div className="col-span-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 text-center">
                        <p className="text-sm text-slate-500 mb-2">
                            This project is at the Scoping stage. The scoping form is the source of truth.
                        </p>
                        <button
                            onClick={() => navigate(`/dashboard/scoping/${project.scopingFormId}`)}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            View Scoping Form
                        </button>
                    </div>
                )}
            </div>

            {/* Project Assets */}
            {projectId && (
                <div className="mt-6 bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <ProjectAssets projectId={projectId} upid={project.upid} />
                </div>
            )}

            {/* Stage Transition Modal */}
            {showTransition && projectId && (
                <StageTransition
                    projectId={projectId}
                    currentStage={project.currentStage as ProductionStage}
                    onClose={() => setShowTransition(false)}
                    onAdvanced={handleAdvanced}
                />
            )}
        </div>
    );
}

// ── Stage Progress Bar ──

function StageProgressBar({ currentStage }: { currentStage: ProductionStage }) {
    const currentConfig = getStageConfig(currentStage);

    return (
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-2">
            {STAGE_CONFIGS.map((stage, idx) => {
                const isComplete = stage.order < currentConfig.order;
                const isCurrent = stage.id === currentStage;
                return (
                    <div key={stage.id} className="flex items-center flex-1">
                        <div className={cn(
                            'flex-1 h-8 rounded flex items-center justify-center text-[10px] font-semibold transition-colors',
                            isComplete && 'bg-emerald-100 text-emerald-700',
                            isCurrent && cn(stageColorMap[stage.color], 'ring-2 ring-offset-1', `ring-${stage.color}-400`),
                            !isComplete && !isCurrent && 'bg-slate-50 text-slate-300',
                        )}>
                            {isComplete ? (
                                <CheckCircle size={12} className="mr-1" />
                            ) : isCurrent ? (
                                <AlertCircle size={12} className="mr-1" />
                            ) : (
                                <Lock size={10} className="mr-1" />
                            )}
                            {stage.shortLabel}
                        </div>
                        {idx < STAGE_CONFIGS.length - 1 && (
                            <ChevronRight size={12} className={cn(
                                'mx-0.5 flex-shrink-0',
                                isComplete ? 'text-emerald-400' : 'text-slate-200',
                            )} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Prefilled Field (read-only) ──

function PrefilledField({ field, value }: { field: FieldDef; value: unknown }) {
    const displayValue = formatFieldValue(field, value);

    return (
        <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-400 bg-blue-50 px-1 py-0.5 rounded">PRE</span>
                <span className="text-xs text-slate-500">{field.label}</span>
            </div>
            <span className="text-xs font-medium text-slate-700">
                {displayValue}
                {field.unit && <span className="text-slate-400 ml-1">{field.unit}</span>}
            </span>
        </div>
    );
}

// ── Editable Field ──

function EditableField({
    field,
    value,
    onChange,
}: {
    field: FieldDef;
    value: unknown;
    onChange: (val: unknown) => void;
}) {
    if (field.type === 'select') {
        return (
            <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">{field.label}</label>
                <select
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value || null)}
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                >
                    <option value="">— Select —</option>
                    {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (field.type === 'number') {
        return (
            <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">{field.label}</label>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        value={value !== null && value !== undefined ? String(value) : ''}
                        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
                        className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                        placeholder="—"
                    />
                    {field.unit && <span className="text-[10px] text-slate-400 flex-shrink-0">{field.unit}</span>}
                </div>
            </div>
        );
    }

    // Default: text
    return (
        <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">{field.label}</label>
            <input
                type="text"
                value={String(value ?? '')}
                onChange={e => onChange(e.target.value || null)}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none"
                placeholder="—"
            />
        </div>
    );
}

// ── Helpers ──

function formatFieldValue(field: FieldDef, value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (field.type === 'tags' && Array.isArray(value)) {
        return value.join(', ') || '—';
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}
