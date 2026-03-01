import { useState, useRef, useEffect } from 'react';
import type { LineItemShell } from '@shared/types/lineItem';
import { cn } from '@/lib/utils';

interface LineItemTableProps {
    items: LineItemShell[];
    onUpdate: (itemId: string, field: 'upteamCost' | 'clientPrice', value: number | null) => void;
}

function CurrencyInput({
    value,
    onChange,
    className,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    className?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value != null ? value.toString() : '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!editing) {
            setText(value != null ? value.toString() : '');
        }
    }, [value, editing]);

    function handleBlur() {
        setEditing(false);
        const parsed = parseFloat(text);
        if (text.trim() === '' || isNaN(parsed)) {
            onChange(null);
        } else {
            onChange(Math.round(parsed * 100) / 100);
        }
    }

    function handleFocus() {
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    }

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editing ? text : (value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '')}
            placeholder="—"
            onChange={e => setText(e.target.value.replace(/[^0-9.]/g, ''))}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className={cn(
                'w-28 px-2 py-1.5 text-right text-sm font-mono rounded border border-slate-200 bg-white',
                'focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none',
                'placeholder:text-slate-300',
                className,
            )}
        />
    );
}

function rowMargin(item: LineItemShell): string {
    if (item.upteamCost === null || item.clientPrice === null) return '—';
    if (item.clientPrice === 0) return '0%';
    const margin = ((item.clientPrice - item.upteamCost) / item.clientPrice) * 100;
    return `${margin.toFixed(1)}%`;
}

function marginColor(item: LineItemShell): string {
    if (item.upteamCost === null || item.clientPrice === null) return 'text-slate-400';
    const margin = item.clientPrice > 0 ? ((item.clientPrice - item.upteamCost) / item.clientPrice) * 100 : 0;
    if (margin < 0) return 'text-red-600 font-semibold';
    if (margin < 40) return 'text-red-500';
    if (margin < 45) return 'text-amber-500';
    return 'text-emerald-600';
}

const categoryLabels: Record<string, string> = {
    modeling: 'Modeling',
    travel: 'Travel',
    addOn: 'Add-On',
    custom: 'Custom',
    // Legacy CPQ categories (from Railway migration)
    'add-on': 'Add-On',
    cad: 'CAD',
    summary: 'Summary',
};

const categoryColors: Record<string, string> = {
    modeling: 'bg-blue-50 text-blue-700 border-blue-200',
    travel: 'bg-purple-50 text-purple-700 border-purple-200',
    addOn: 'bg-amber-50 text-amber-700 border-amber-200',
    custom: 'bg-slate-50 text-slate-600 border-slate-200',
    // Legacy CPQ categories
    'add-on': 'bg-amber-50 text-amber-700 border-amber-200',
    cad: 'bg-teal-50 text-teal-700 border-teal-200',
    summary: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function LineItemTable({ items, onUpdate }: LineItemTableProps) {
    // Group by area
    const grouped = groupByArea(items);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 text-left">
                        <th className="py-3 px-3 font-medium text-slate-500 text-xs uppercase tracking-wider">Line Item</th>
                        <th className="py-3 px-2 font-medium text-slate-500 text-xs uppercase tracking-wider w-20">Category</th>
                        <th className="py-3 px-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right w-32">Upteam Cost</th>
                        <th className="py-3 px-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right w-32">Client Price</th>
                        <th className="py-3 px-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right w-20">Margin</th>
                    </tr>
                </thead>
                <tbody>
                    {grouped.map((group) => (
                        <GroupSection
                            key={group.areaName}
                            group={group}
                            onUpdate={onUpdate}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface AreaGroup {
    areaName: string;
    items: LineItemShell[];
}

function groupByArea(items: LineItemShell[]): AreaGroup[] {
    const map = new Map<string, LineItemShell[]>();
    for (const item of items) {
        const key = item.areaName || 'Other';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
    }
    return Array.from(map, ([areaName, items]) => ({ areaName, items }));
}

function GroupSection({ group, onUpdate }: { group: AreaGroup; onUpdate: LineItemTableProps['onUpdate'] }) {
    return (
        <>
            <tr>
                <td colSpan={5} className="pt-4 pb-1 px-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {group.areaName}
                    </div>
                </td>
            </tr>
            {group.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-3">
                        <div className="text-sm text-slate-800">{item.description}</div>
                        {typeof item.squareFeet === 'number' && item.squareFeet > 0 && (
                            <div className="text-xs text-slate-400 mt-0.5">
                                {item.squareFeet.toLocaleString()} SF
                                {item.lod && ` / LoD ${item.lod}`}
                            </div>
                        )}
                    </td>
                    <td className="py-2.5 px-2">
                        <span className={cn(
                            'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border',
                            categoryColors[item.category] || categoryColors.custom,
                        )}>
                            {categoryLabels[item.category] || item.category}
                        </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                        <CurrencyInput
                            value={item.upteamCost}
                            onChange={(v) => onUpdate(item.id, 'upteamCost', v)}
                        />
                    </td>
                    <td className="py-2.5 px-2 text-right">
                        <CurrencyInput
                            value={item.clientPrice}
                            onChange={(v) => onUpdate(item.id, 'clientPrice', v)}
                        />
                    </td>
                    <td className={cn('py-2.5 px-2 text-right font-mono text-xs', marginColor(item))}>
                        {rowMargin(item)}
                    </td>
                </tr>
            ))}
        </>
    );
}
