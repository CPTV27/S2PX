import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuoteTotals } from '@shared/types/lineItem';

interface IntegrityBadgeProps {
    totals: QuoteTotals | null;
    className?: string;
}

export function IntegrityBadge({ totals, className }: IntegrityBadgeProps) {
    if (!totals) {
        return (
            <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-slate-400', className)}>
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                No pricing data
            </div>
        );
    }

    const { integrityStatus, integrityFlags } = totals;

    const config = {
        passed: {
            icon: CheckCircle2,
            label: 'Integrity Passed',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 border-emerald-200',
        },
        warning: {
            icon: AlertTriangle,
            label: 'Margin Warning',
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200',
        },
        blocked: {
            icon: XCircle,
            label: 'Save Blocked',
            color: 'text-red-600',
            bg: 'bg-red-50 border-red-200',
        },
    }[integrityStatus];

    const Icon = config.icon;

    return (
        <div className={cn('rounded-lg border px-3 py-2', config.bg, className)}>
            <div className={cn('flex items-center gap-1.5 text-sm font-semibold', config.color)}>
                <Icon size={16} />
                {config.label}
            </div>
            {integrityFlags.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                    {integrityFlags.map((flag, i) => (
                        <li key={i} className={cn('text-xs', config.color, 'opacity-80')}>
                            {flag}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
