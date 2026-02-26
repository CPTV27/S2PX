import { cn } from '@/lib/utils';

interface MultiSelectProps {
    options: readonly string[];
    value: string[];
    onChange: (value: string[]) => void;
    columns?: 2 | 3 | 4;
}

export function MultiSelect({ options, value, onChange, columns = 3 }: MultiSelectProps) {
    const toggle = (item: string) => {
        if (value.includes(item)) {
            onChange(value.filter(v => v !== item));
        } else {
            onChange([...value, item]);
        }
    };

    return (
        <div className={cn(
            'grid gap-2',
            columns === 2 && 'grid-cols-1 sm:grid-cols-2',
            columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
            columns === 4 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        )}>
            {options.map((opt) => (
                <label
                    key={opt}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                        value.includes(opt)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    )}
                >
                    <input
                        type="checkbox"
                        checked={value.includes(opt)}
                        onChange={() => toggle(opt)}
                        className="sr-only"
                    />
                    <div className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                        value.includes(opt)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300'
                    )}>
                        {value.includes(opt) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    {opt}
                </label>
            ))}
        </div>
    );
}
