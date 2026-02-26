import { Save, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuoteTotals } from '@shared/types/lineItem';
import type { SaveState } from '@/hooks/useDealWorkspace';
import { IntegrityBadge } from './IntegrityBadge';
import { useState } from 'react';

interface QuoteTotalsBarProps {
    totals: QuoteTotals | null;
    canSave: boolean;
    saveState: SaveState;
    onSave: () => void;
}

export function QuoteTotalsBar({ totals, canSave, saveState, onSave }: QuoteTotalsBarProps) {
    const [showWarningConfirm, setShowWarningConfirm] = useState(false);

    function handleSaveClick() {
        if (totals?.integrityStatus === 'warning') {
            setShowWarningConfirm(true);
        } else {
            onSave();
        }
    }

    function confirmWarningSave() {
        setShowWarningConfirm(false);
        onSave();
    }

    return (
        <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 shadow-lg">
            <div className="px-6 py-3 flex items-center justify-between gap-6">
                {/* Totals */}
                <div className="flex items-center gap-6">
                    <Stat label="Upteam Cost" value={totals?.totalUpteamCost} />
                    <Stat label="Client Price" value={totals?.totalClientPrice} />
                    <Stat label="Gross Margin" value={totals?.grossMargin} />
                    <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Margin %</div>
                        <div className={cn(
                            'text-lg font-bold font-mono',
                            !totals ? 'text-slate-300' :
                            totals.grossMarginPercent >= 45 ? 'text-emerald-600' :
                            totals.grossMarginPercent >= 40 ? 'text-amber-500' : 'text-red-500',
                        )}>
                            {totals ? `${totals.grossMarginPercent.toFixed(1)}%` : '—'}
                        </div>
                    </div>
                </div>

                {/* Integrity + Save */}
                <div className="flex items-center gap-4">
                    <IntegrityBadge totals={totals} />

                    <SaveIndicator state={saveState} />

                    <button
                        onClick={handleSaveClick}
                        disabled={!canSave || saveState === 'saving'}
                        className={cn(
                            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                            canSave
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                        )}
                    >
                        {saveState === 'saving' ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        Save Quote
                    </button>
                </div>
            </div>

            {/* Warning confirmation dialog */}
            {showWarningConfirm && (
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle size={16} />
                        Margin is {totals?.grossMarginPercent.toFixed(1)}%, below 45% target. Save anyway?
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowWarningConfirm(false)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmWarningSave}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
                        >
                            Save with Warning
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number | undefined | null }) {
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
            <div className="text-lg font-bold font-mono text-slate-800">
                {value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
            </div>
        </div>
    );
}

function SaveIndicator({ state }: { state: SaveState }) {
    if (state === 'idle') return null;
    return (
        <div className={cn(
            'flex items-center gap-1.5 text-xs font-mono',
            state === 'saving' && 'text-blue-500',
            state === 'saved' && 'text-green-500',
            state === 'error' && 'text-red-500',
        )}>
            {state === 'saving' && <><Loader2 size={12} className="animate-spin" /> Saving...</>}
            {state === 'saved' && <><CheckCircle2 size={12} /> Saved</>}
            {state === 'error' && <><AlertCircle size={12} /> Save failed</>}
        </div>
    );
}
