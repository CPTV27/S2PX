// ── Stage Transition Modal ──
// Shows a prefill cascade preview and confirms advancement to the next stage.

import { useState, useEffect } from 'react';
import {
    X, Loader2, ChevronRight, CheckCircle, AlertTriangle, Lock, ArrowRight,
} from 'lucide-react';
import {
    previewProductionAdvance,
    advanceProductionStage,
    type PrefillResultData,
} from '@/services/api';
import { getStageConfig, getNextStage } from '@shared/types/production';
import type { ProductionStage } from '@shared/schema/constants';
import { cn } from '@/lib/utils';

interface Props {
    projectId: number;
    currentStage: ProductionStage;
    onClose: () => void;
    onAdvanced: () => void;
}

const typeIcons: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    direct: { icon: CheckCircle, color: 'text-green-500', label: 'Direct Copy' },
    chain: { icon: CheckCircle, color: 'text-blue-500', label: 'Chain (SSOT)' },
    transform: { icon: ArrowRight, color: 'text-indigo-500', label: 'Transform' },
    calculation: { icon: ArrowRight, color: 'text-violet-500', label: 'Calculation' },
    static: { icon: CheckCircle, color: 'text-slate-400', label: 'Static Default' },
    manual: { icon: AlertTriangle, color: 'text-amber-500', label: 'Manual Entry' },
    blocked: { icon: Lock, color: 'text-red-400', label: 'Blocked' },
};

export function StageTransition({ projectId, currentStage, onClose, onAdvanced }: Props) {
    const [preview, setPreview] = useState<PrefillResultData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [advancing, setAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const nextStage = getNextStage(currentStage)!;
    const fromConfig = getStageConfig(currentStage);
    const toConfig = getStageConfig(nextStage);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await previewProductionAdvance(projectId);
                setPreview(data.results);
                setError(null);
            } catch (err: any) {
                setError(err.message || 'Failed to preview advance');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [projectId]);

    const handleAdvance = async () => {
        try {
            setAdvancing(true);
            await advanceProductionStage(projectId);
            onAdvanced();
        } catch (err: any) {
            setError(err.message || 'Failed to advance');
            setAdvancing(false);
        }
    };

    const filledCount = preview?.filter(r => !r.skipped).length ?? 0;
    const manualCount = preview?.filter(r => r.mapping.type === 'manual').length ?? 0;
    const blockedCount = preview?.filter(r => r.mapping.type === 'blocked').length ?? 0;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Stage Transition</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <StagePill config={fromConfig} />
                            <ChevronRight size={14} className="text-slate-300" />
                            <StagePill config={toConfig} />
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="animate-spin text-blue-500" size={24} />
                            <span className="ml-2 text-sm text-slate-400">Running prefill cascade...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-red-500 text-sm">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            <div className="flex items-center gap-4 mb-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle size={12} className="text-green-500" />
                                    <span className="text-slate-600">{filledCount} auto-filled</span>
                                </div>
                                {manualCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle size={12} className="text-amber-500" />
                                        <span className="text-slate-600">{manualCount} manual</span>
                                    </div>
                                )}
                                {blockedCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Lock size={12} className="text-red-400" />
                                        <span className="text-slate-600">{blockedCount} blocked</span>
                                    </div>
                                )}
                            </div>

                            {/* Mapping list */}
                            <div className="space-y-1">
                                {preview?.map((result, idx) => {
                                    const typeInfo = typeIcons[result.mapping.type] || typeIcons.direct;
                                    const Icon = typeInfo.icon;
                                    return (
                                        <div
                                            key={idx}
                                            className={cn(
                                                'flex items-center justify-between px-3 py-2 rounded text-xs',
                                                result.skipped ? 'bg-slate-50' : 'bg-white border border-slate-100',
                                            )}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <Icon size={12} className={typeInfo.color} />
                                                <span className="text-slate-600 truncate">
                                                    {result.mapping.description}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                                <span className={cn(
                                                    'text-[9px] font-mono px-1.5 py-0.5 rounded uppercase',
                                                    result.skipped
                                                        ? 'bg-slate-100 text-slate-400'
                                                        : 'bg-blue-50 text-blue-600',
                                                )}>
                                                    {result.mapping.targetId || result.mapping.targetField}
                                                </span>
                                                {!result.skipped && (
                                                    <span className="text-slate-700 font-medium max-w-[120px] truncate">
                                                        {formatPreviewValue(result.value)}
                                                    </span>
                                                )}
                                                {result.skipped && (
                                                    <span className="text-slate-400 italic">{result.skipReason}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAdvance}
                        disabled={loading || advancing}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {advancing ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : (
                            <ChevronRight size={13} />
                        )}
                        Advance to {toConfig.label}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Helpers ──

function StagePill({ config }: { config: { label: string; shortLabel: string; color: string } }) {
    const colorMap: Record<string, string> = {
        slate: 'bg-slate-100 text-slate-600',
        blue: 'bg-blue-50 text-blue-700',
        indigo: 'bg-indigo-50 text-indigo-700',
        violet: 'bg-violet-50 text-violet-700',
        amber: 'bg-amber-50 text-amber-700',
        emerald: 'bg-emerald-50 text-emerald-700',
    };
    return (
        <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded',
            colorMap[config.color] || colorMap.slate,
        )}>
            {config.label}
        </span>
    );
}

function formatPreviewValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}
