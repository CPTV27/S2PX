// ── Checklist Progress — PM Dashboard ──
// Shows at-a-glance checklist completion status across all templates.
// Color-coded progress bars + required-item tracking.

import {
    CheckCircle, Clock, AlertTriangle, Shield, ClipboardList,
    ChevronDown, ChevronRight, User, Calendar,
} from 'lucide-react';
import { useState } from 'react';
import type { PMFieldSummary } from '@/services/api';
import { cn } from '@/lib/utils';

interface ChecklistProgressProps {
    checklists: PMFieldSummary['checklists'];
}

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
    complete: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle, label: 'Complete' },
    in_progress: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'In Progress' },
    flagged: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertTriangle, label: 'Flagged' },
    not_started: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: ClipboardList, label: 'Not Started' },
};

const typeIcons: Record<string, typeof Shield> = {
    pre_scan: ClipboardList,
    post_scan: CheckCircle,
    safety: Shield,
};

export function ChecklistProgress({ checklists }: ChecklistProgressProps) {
    const [expanded, setExpanded] = useState<number | null>(null);

    // Overall stats
    const totalChecklists = checklists.length;
    const completedChecklists = checklists.filter(c => c.status === 'complete').length;
    const flaggedChecklists = checklists.filter(c => c.status === 'flagged').length;
    const allRequiredMet = checklists.every(c => c.requiredCompleted >= c.requiredItems);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Checklist Status</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        completedChecklists === totalChecklists
                            ? 'bg-emerald-100 text-emerald-700'
                            : flaggedChecklists > 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700',
                    )}>
                        {completedChecklists}/{totalChecklists} Complete
                    </span>
                    {!allRequiredMet && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Missing Required
                        </span>
                    )}
                </div>
            </div>

            {/* Checklist cards */}
            <div className="divide-y divide-slate-100">
                {checklists.map(checklist => {
                    const config = statusConfig[checklist.status] || statusConfig.not_started;
                    const StatusIcon = config.icon;
                    const TypeIcon = typeIcons[checklist.checklistType] || ClipboardList;
                    const isExpanded = expanded === checklist.id;
                    const progressPct = checklist.totalItems > 0
                        ? Math.round((checklist.completedItems / checklist.totalItems) * 100)
                        : 0;
                    const reqPct = checklist.requiredItems > 0
                        ? Math.round((checklist.requiredCompleted / checklist.requiredItems) * 100)
                        : 100;

                    return (
                        <div key={checklist.id}>
                            <button
                                onClick={() => setExpanded(isExpanded ? null : checklist.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left"
                            >
                                {/* Type icon */}
                                <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border',
                                    config.bg,
                                )}>
                                    <TypeIcon size={14} className={config.color} />
                                </div>

                                {/* Title + progress */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                            {checklist.title}
                                        </p>
                                        <StatusIcon size={12} className={config.color} />
                                    </div>

                                    {/* Progress bar */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-500',
                                                    progressPct === 100
                                                        ? 'bg-emerald-500'
                                                        : checklist.status === 'flagged'
                                                            ? 'bg-red-500'
                                                            : 'bg-blue-500',
                                                )}
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
                                            {checklist.completedItems}/{checklist.totalItems}
                                        </span>
                                    </div>
                                </div>

                                {/* Expand chevron */}
                                {isExpanded
                                    ? <ChevronDown size={14} className="text-slate-400" />
                                    : <ChevronRight size={14} className="text-slate-400" />
                                }
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                                <div className="px-4 pb-3 pt-0 ml-11 space-y-2 text-xs">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 rounded-md p-2">
                                            <p className="text-slate-400 text-[10px] uppercase tracking-wider">All Items</p>
                                            <p className="font-semibold text-slate-700">
                                                {checklist.completedItems} / {checklist.totalItems}
                                                <span className="text-slate-400 font-normal ml-1">({progressPct}%)</span>
                                            </p>
                                        </div>
                                        <div className={cn(
                                            'rounded-md p-2',
                                            reqPct === 100 ? 'bg-emerald-50' : 'bg-red-50',
                                        )}>
                                            <p className={cn(
                                                'text-[10px] uppercase tracking-wider',
                                                reqPct === 100 ? 'text-emerald-500' : 'text-red-500',
                                            )}>
                                                Required
                                            </p>
                                            <p className={cn(
                                                'font-semibold',
                                                reqPct === 100 ? 'text-emerald-700' : 'text-red-700',
                                            )}>
                                                {checklist.requiredCompleted} / {checklist.requiredItems}
                                                <span className="font-normal ml-1">({reqPct}%)</span>
                                            </p>
                                        </div>
                                    </div>

                                    {checklist.respondedByName && (
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <User size={11} />
                                            <span>{checklist.respondedByName}</span>
                                        </div>
                                    )}
                                    {checklist.completedAt && (
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Calendar size={11} />
                                            <span>Completed {new Date(checklist.completedAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    {checklist.updatedAt && !checklist.completedAt && (
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Clock size={11} />
                                            <span>Last updated {new Date(checklist.updatedAt).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {checklists.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                        No checklists assigned yet
                    </div>
                )}
            </div>
        </div>
    );
}
