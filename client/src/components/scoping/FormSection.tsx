import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
    title: string;
    subtitle?: string;
    badge?: string;
    defaultOpen?: boolean;
    fieldCount?: number;
    completedCount?: number;
    children: ReactNode;
}

export function FormSection({
    title,
    subtitle,
    badge,
    defaultOpen = false,
    fieldCount,
    completedCount,
    children,
}: FormSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    const completionPct = fieldCount && completedCount !== undefined
        ? Math.round((completedCount / fieldCount) * 100)
        : null;

    return (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    {subtitle && (
                        <span className="text-xs text-slate-400">{subtitle}</span>
                    )}
                    {badge && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {completionPct !== null && (
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all',
                                        completionPct === 100 ? 'bg-green-500' : 'bg-blue-500'
                                    )}
                                    style={{ width: `${completionPct}%` }}
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{completionPct}%</span>
                        </div>
                    )}
                    <ChevronDown
                        size={16}
                        className={cn(
                            'text-slate-400 transition-transform',
                            open && 'rotate-180'
                        )}
                    />
                </div>
            </button>
            {open && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                    {children}
                </div>
            )}
        </div>
    );
}
