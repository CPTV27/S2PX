// ── Scan Metrics Component ──
// Hours, positions, performance data collected during field scanning.

import { Clock, Target, BarChart3 } from 'lucide-react';

interface Props {
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
}

interface MetricField {
    key: string;
    label: string;
    unit?: string;
    placeholder?: string;
    step?: string;
}

const setupFields: MetricField[] = [
    { key: 'fieldDate', label: 'Field Date', placeholder: 'YYYY-MM-DD' },
    { key: 'fieldTech', label: 'Field Tech', placeholder: 'Tech name' },
    { key: 'scannerSN', label: 'Scanner S/N', placeholder: 'Serial number' },
    { key: 'rooms', label: 'Rooms Scanned', unit: 'rooms' },
];

const timeFields: MetricField[] = [
    { key: 'hoursScanned', label: 'Total Hours Scanned', unit: 'hrs', step: '0.5' },
    { key: 'hoursDelayed', label: 'Hours Delayed', unit: 'hrs', step: '0.5' },
    { key: 'hrsScannedInt', label: 'Hours — Interior', unit: 'hrs', step: '0.5' },
    { key: 'hrsScannedExt', label: 'Hours — Exterior', unit: 'hrs', step: '0.5' },
    { key: 'hrsScannedLandscape', label: 'Hours — Landscape', unit: 'hrs', step: '0.5' },
];

const pointFields: MetricField[] = [
    { key: 'scanPtsInt', label: 'Scan Points — Interior' },
    { key: 'scanPtsExt', label: 'Scan Points — Exterior' },
    { key: 'scanPtsLandscape', label: 'Scan Points — Landscape' },
    { key: 'actualObservedSF', label: 'Actual Observed SF', unit: 'SF' },
];

function MetricInput({ field, value, onChange }: {
    field: MetricField;
    value: unknown;
    onChange: (key: string, value: unknown) => void;
}) {
    const isNumber = field.unit !== undefined || field.step !== undefined ||
        ['rooms', 'scanPtsInt', 'scanPtsExt', 'scanPtsLandscape', 'actualObservedSF'].includes(field.key);
    const inputType = isNumber ? 'number' : 'text';

    return (
        <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">{field.label}</label>
            <div className="flex items-center gap-2">
                <input
                    type={inputType}
                    step={field.step}
                    value={value !== null && value !== undefined ? String(value) : ''}
                    onChange={e => {
                        const raw = e.target.value;
                        if (!raw) return onChange(field.key, null);
                        onChange(field.key, isNumber ? Number(raw) : raw);
                    }}
                    placeholder={field.placeholder ?? '—'}
                    className="w-full text-base px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-colors"
                />
                {field.unit && (
                    <span className="text-xs text-slate-400 flex-shrink-0 min-w-[2rem]">{field.unit}</span>
                )}
            </div>
        </div>
    );
}

export function ScanMetrics({ values, onChange }: Props) {
    // Compute totals for display
    const totalHours = (
        (values.hrsScannedInt as number || 0) +
        (values.hrsScannedExt as number || 0) +
        (values.hrsScannedLandscape as number || 0)
    );
    const totalPoints = (
        (values.scanPtsInt as number || 0) +
        (values.scanPtsExt as number || 0) +
        (values.scanPtsLandscape as number || 0)
    );

    return (
        <div className="space-y-6">
            {/* Setup */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Scan Setup</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {setupFields.map(field => (
                        <MetricInput
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                            onChange={onChange}
                        />
                    ))}
                </div>
            </div>

            {/* Time breakdown */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Time Breakdown</h3>
                    {totalHours > 0 && (
                        <span className="ml-auto text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {totalHours.toFixed(1)} hrs total
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {timeFields.map(field => (
                        <MetricInput
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                            onChange={onChange}
                        />
                    ))}
                </div>
            </div>

            {/* Points & SF */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={16} className="text-violet-500" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Scan Points & SF</h3>
                    {totalPoints > 0 && (
                        <span className="ml-auto text-xs font-mono text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                            {totalPoints.toLocaleString()} pts total
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pointFields.map(field => (
                        <MetricInput
                            key={field.key}
                            field={field}
                            value={values[field.key]}
                            onChange={onChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
