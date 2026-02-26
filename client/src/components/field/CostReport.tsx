// ── Cost Report Component ──
// Travel costs, hotel, tolls, and other field expenses.

import { DollarSign, Car, Hotel, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
}

interface CostField {
    key: string;
    label: string;
    icon: typeof DollarSign;
    unit: string;
    step?: string;
}

const costFields: CostField[] = [
    { key: 'hoursTraveled', label: 'Hours Traveled', icon: Car, unit: 'hrs', step: '0.5' },
    { key: 'milesDriven', label: 'Miles Driven', icon: Car, unit: 'mi' },
    { key: 'hotelPerDiem', label: 'Hotel / Per Diem', icon: Hotel, unit: '$', step: '0.01' },
    { key: 'tollsParking', label: 'Tolls & Parking', icon: Receipt, unit: '$', step: '0.01' },
    { key: 'otherFieldCosts', label: 'Other Field Costs', icon: DollarSign, unit: '$', step: '0.01' },
];

export function CostReport({ values, onChange }: Props) {
    // Compute expense total (only dollar fields)
    const dollarFields = ['hotelPerDiem', 'tollsParking', 'otherFieldCosts'];
    const expenseTotal = dollarFields.reduce((sum, key) => {
        const val = values[key];
        return sum + (typeof val === 'number' ? val : 0);
    }, 0);

    return (
        <div className="space-y-4">
            {/* Fields */}
            <div className="space-y-3">
                {costFields.map(field => {
                    const Icon = field.icon;
                    const val = values[field.key];
                    const isDollar = field.unit === '$';

                    return (
                        <div key={field.key} className="space-y-1">
                            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <Icon size={14} className="text-slate-400" />
                                {field.label}
                            </label>
                            <div className="relative">
                                {isDollar && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                                )}
                                <input
                                    type="number"
                                    step={field.step ?? '1'}
                                    min="0"
                                    value={val !== null && val !== undefined ? String(val) : ''}
                                    onChange={e => onChange(field.key, e.target.value ? Number(e.target.value) : null)}
                                    placeholder="0"
                                    className={cn(
                                        'w-full text-base py-2.5 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-colors',
                                        isDollar ? 'pl-7 pr-3' : 'px-3',
                                    )}
                                />
                                {!isDollar && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                        {field.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Expense total */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-sm font-medium text-slate-600">Expense Total</span>
                <span className={cn(
                    'text-lg font-bold font-mono',
                    expenseTotal > 0 ? 'text-slate-800' : 'text-slate-300',
                )}>
                    ${expenseTotal.toFixed(2)}
                </span>
            </div>
        </div>
    );
}
