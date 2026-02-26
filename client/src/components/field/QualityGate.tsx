// ── Quality Gate Component ──
// Hard gates: RMS ≤5mm, Overlap ≥50%. Blocks sign-off until both pass.

import { AlertTriangle, CheckCircle, XCircle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    fieldRMS: number | null;
    avgOverlap: number | null;
    fieldSignOff: string | null;
    onChange: (key: string, value: unknown) => void;
}

const RMS_THRESHOLD = 5;    // mm — hard gate
const OVERLAP_THRESHOLD = 50; // % — hard gate

export function QualityGate({ fieldRMS, avgOverlap, fieldSignOff, onChange }: Props) {
    const rmsPass = fieldRMS !== null && fieldRMS <= RMS_THRESHOLD;
    const rmsFail = fieldRMS !== null && fieldRMS > RMS_THRESHOLD;
    const overlapPass = avgOverlap !== null && avgOverlap >= OVERLAP_THRESHOLD;
    const overlapFail = avgOverlap !== null && avgOverlap < OVERLAP_THRESHOLD;
    const bothEntered = fieldRMS !== null && avgOverlap !== null;
    const allPass = rmsPass && overlapPass;
    const anyFail = rmsFail || overlapFail;

    return (
        <div className="space-y-4">
            {/* Gate status banner */}
            <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium',
                !bothEntered && 'bg-slate-100 text-slate-500',
                bothEntered && allPass && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                bothEntered && anyFail && 'bg-red-50 text-red-700 border border-red-200',
            )}>
                {!bothEntered ? (
                    <>
                        <Shield size={18} className="text-slate-400" />
                        Enter RMS and Overlap to check quality gates
                    </>
                ) : allPass ? (
                    <>
                        <CheckCircle size={18} />
                        Quality gates passed — ready for sign-off
                    </>
                ) : (
                    <>
                        <XCircle size={18} />
                        Quality gate{rmsFail && overlapFail ? 's' : ''} failed — review before sign-off
                    </>
                )}
            </div>

            {/* RMS input */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">
                        Field RMS
                    </label>
                    <span className="text-xs text-slate-400">
                        Threshold: ≤{RMS_THRESHOLD} mm
                    </span>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        step="0.1"
                        value={fieldRMS !== null ? String(fieldRMS) : ''}
                        onChange={e => onChange('fieldRMS', e.target.value ? Number(e.target.value) : null)}
                        placeholder="0.0"
                        className={cn(
                            'w-full text-lg font-mono px-4 py-3 rounded-xl border-2 outline-none transition-colors',
                            !fieldRMS && fieldRMS !== 0 && 'border-slate-200 focus:border-blue-400',
                            rmsPass && 'border-emerald-300 bg-emerald-50/50 focus:border-emerald-400',
                            rmsFail && 'border-red-300 bg-red-50/50 focus:border-red-400',
                        )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-sm text-slate-400">mm</span>
                        {rmsPass && <CheckCircle size={18} className="text-emerald-500" />}
                        {rmsFail && <AlertTriangle size={18} className="text-red-500" />}
                    </div>
                </div>
                {rmsFail && (
                    <p className="text-xs text-red-500 font-medium">
                        RMS {fieldRMS} mm exceeds {RMS_THRESHOLD} mm threshold. Rescan may be required.
                    </p>
                )}
            </div>

            {/* Overlap input */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">
                        Average Overlap
                    </label>
                    <span className="text-xs text-slate-400">
                        Threshold: ≥{OVERLAP_THRESHOLD}%
                    </span>
                </div>
                <div className="relative">
                    <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={avgOverlap !== null ? String(avgOverlap) : ''}
                        onChange={e => onChange('avgOverlap', e.target.value ? Number(e.target.value) : null)}
                        placeholder="0"
                        className={cn(
                            'w-full text-lg font-mono px-4 py-3 rounded-xl border-2 outline-none transition-colors',
                            !avgOverlap && avgOverlap !== 0 && 'border-slate-200 focus:border-blue-400',
                            overlapPass && 'border-emerald-300 bg-emerald-50/50 focus:border-emerald-400',
                            overlapFail && 'border-red-300 bg-red-50/50 focus:border-red-400',
                        )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-sm text-slate-400">%</span>
                        {overlapPass && <CheckCircle size={18} className="text-emerald-500" />}
                        {overlapFail && <AlertTriangle size={18} className="text-red-500" />}
                    </div>
                </div>
                {overlapFail && (
                    <p className="text-xs text-red-500 font-medium">
                        Overlap {avgOverlap}% below {OVERLAP_THRESHOLD}% threshold. Additional scans needed.
                    </p>
                )}
            </div>

            {/* Sign-off dropdown */}
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Field Sign-Off</label>
                <select
                    value={fieldSignOff ?? ''}
                    onChange={e => onChange('fieldSignOff', e.target.value || null)}
                    disabled={!bothEntered}
                    className={cn(
                        'w-full text-base px-4 py-3 rounded-xl border-2 outline-none transition-colors appearance-none bg-white',
                        !bothEntered && 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed',
                        bothEntered && !fieldSignOff && 'border-slate-200 focus:border-blue-400',
                        fieldSignOff === 'Pass' && 'border-emerald-300 text-emerald-700',
                        fieldSignOff === 'Conditional' && 'border-amber-300 text-amber-700',
                        fieldSignOff === 'Rejected' && 'border-red-300 text-red-700',
                    )}
                >
                    <option value="">— Select Sign-Off —</option>
                    <option value="Pass">Pass</option>
                    <option value="Conditional">Conditional</option>
                    <option value="Rejected">Rejected</option>
                </select>
                {!bothEntered && (
                    <p className="text-xs text-slate-400">
                        Enter RMS and Overlap values before sign-off.
                    </p>
                )}
                {anyFail && fieldSignOff === 'Pass' && (
                    <p className="text-xs text-amber-600 font-medium">
                        Warning: Signing off as Pass with failed quality gate(s).
                    </p>
                )}
            </div>
        </div>
    );
}
