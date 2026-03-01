// ── Scantech Checklist Tab ──
// Interactive checklists with autosave. Renders each template as a ChecklistCard.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Loader2, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
    Camera, Check, X,
} from 'lucide-react';
import { useScantechContext } from './ScantechLayout';
import { useScantechApi } from './ScantechApiContext';
import type {
    ChecklistTemplate,
    ChecklistSubmission,
    ChecklistResponse,
} from '@/services/api';
import { cn } from '@/lib/utils';

const AUTOSAVE_MS = 5000; // 5-second debounce

export function ChecklistTab() {
    const { project, reloadProject, online } = useScantechContext();
    const api = useScantechApi();
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.fetchChecklists();
                setTemplates(data);
            } catch { /* handled in UI */ }
            finally { setLoading(false); }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Checklists</h2>
            {templates.map((template) => {
                const existing = project.checklists.find(
                    (c) => c.checklistId === template.id
                );
                return (
                    <ChecklistCard
                        key={template.id}
                        template={template}
                        existing={existing ?? null}
                        projectId={project.id}
                        online={online}
                        onSaved={reloadProject}
                        submitChecklist={api.submitChecklist}
                    />
                );
            })}
            {templates.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-10">
                    No checklists configured
                </p>
            )}
        </div>
    );
}

// ── ChecklistCard ──

function ChecklistCard({
    template,
    existing,
    projectId,
    online,
    onSaved,
    submitChecklist,
}: {
    template: ChecklistTemplate;
    existing: ChecklistSubmission | null;
    projectId: number;
    online: boolean;
    onSaved: () => Promise<void>;
    submitChecklist: (data: { checklistId: number; responses: ChecklistResponse[]; status: 'in_progress' | 'complete' | 'flagged' }) => Promise<ChecklistSubmission>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [responses, setResponses] = useState<Record<string, ChecklistResponse>>({});
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dirty = useRef(false);

    // Initialize responses from existing submission
    useEffect(() => {
        if (existing?.responses) {
            const map: Record<string, ChecklistResponse> = {};
            for (const r of existing.responses) {
                map[r.itemId] = r;
            }
            setResponses(map);
        }
    }, [existing]);

    // Status info
    const status = existing?.status || 'not_started';
    const completedCount = Object.values(responses).filter((r) => r.checked).length;
    const totalItems = template.items.length;
    const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    // Autosave
    const autosave = useCallback(async () => {
        if (!dirty.current || !online) return;
        dirty.current = false;
        setSaving(true);
        try {
            const respArray = Object.values(responses);
            await submitChecklist({
                checklistId: template.id,
                responses: respArray,
                status: 'in_progress',
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    }, [responses, template.id, online, submitChecklist]);

    // Debounced save trigger
    const triggerSave = useCallback(() => {
        dirty.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(autosave, AUTOSAVE_MS);
    }, [autosave]);

    // Cleanup timer
    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    // Toggle item
    const toggleItem = (itemId: string) => {
        setResponses((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                itemId,
                checked: !prev[itemId]?.checked,
                completedAt: !prev[itemId]?.checked ? new Date().toISOString() : undefined,
            },
        }));
        triggerSave();
    };

    // Update text/number value
    const updateValue = (itemId: string, value: string | number) => {
        setResponses((prev) => ({
            ...prev,
            [itemId]: { ...prev[itemId], itemId, checked: prev[itemId]?.checked ?? false, value },
        }));
        triggerSave();
    };

    // Update note
    const updateNote = (itemId: string, note: string) => {
        setResponses((prev) => ({
            ...prev,
            [itemId]: { ...prev[itemId], itemId, checked: prev[itemId]?.checked ?? false, note },
        }));
        triggerSave();
    };

    // Mark complete
    const markComplete = async () => {
        const requiredItems = template.items.filter((i) => i.required);
        const missingRequired = requiredItems.filter((i) => !responses[i.itemId]?.checked);
        if (missingRequired.length > 0) {
            alert(`Missing required items:\n${missingRequired.map((i) => `• ${i.label}`).join('\n')}`);
            return;
        }

        setSaving(true);
        try {
            await submitChecklist({
                checklistId: template.id,
                responses: Object.values(responses),
                status: 'complete',
            });
            await onSaved();
            setSaveStatus('saved');
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    // ── Status badge ──
    const statusBadge = {
        not_started: { bg: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Not Started' },
        in_progress: { bg: 'bg-amber-100 text-amber-800', icon: Clock, label: 'In Progress' },
        complete: { bg: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Complete' },
        flagged: { bg: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Flagged' },
    }[status] || { bg: 'bg-gray-100 text-gray-600', icon: Clock, label: status };

    // Group items by category
    const categories = [...new Set(template.items.map((i) => i.category))];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header — always visible */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 touch-manipulation"
            >
                <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{template.title}</h3>
                        <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            statusBadge.bg,
                        )}>
                            {statusBadge.label}
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                                className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    progressPct === 100 ? 'bg-green-500' : 'bg-blue-500',
                                )}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">
                            {completedCount}/{totalItems}
                        </span>
                    </div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {saveStatus === 'saved' && <Check className="w-4 h-4 text-green-500" />}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Expanded items */}
            {expanded && (
                <div className="border-t border-gray-100 px-4 pb-4">
                    {categories.map((category) => (
                        <div key={category} className="mt-3">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                {category}
                            </p>
                            <div className="space-y-2">
                                {template.items
                                    .filter((item) => item.category === category)
                                    .map((item) => {
                                        const resp = responses[item.itemId];
                                        return (
                                            <div
                                                key={item.itemId}
                                                className={cn(
                                                    'flex items-start gap-3 p-2.5 rounded-lg transition-colors',
                                                    resp?.checked ? 'bg-green-50' : 'bg-gray-50',
                                                )}
                                            >
                                                <button
                                                    onClick={() => toggleItem(item.itemId)}
                                                    className={cn(
                                                        'w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 touch-manipulation',
                                                        resp?.checked
                                                            ? 'bg-green-500 border-green-500'
                                                            : 'border-gray-300 bg-white',
                                                    )}
                                                >
                                                    {resp?.checked && <Check className="w-4 h-4 text-white" />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        'text-sm',
                                                        resp?.checked ? 'text-gray-500 line-through' : 'text-gray-900',
                                                    )}>
                                                        {item.label}
                                                        {item.required && (
                                                            <span className="text-red-500 ml-0.5">*</span>
                                                        )}
                                                    </p>
                                                    {item.helpText && (
                                                        <p className="text-xs text-gray-400 mt-0.5">{item.helpText}</p>
                                                    )}
                                                    {/* Extra input for text/number types */}
                                                    {(item.inputType === 'text' || item.inputType === 'number') && (
                                                        <input
                                                            type={item.inputType}
                                                            value={resp?.value ?? ''}
                                                            onChange={(e) => updateValue(item.itemId, e.target.value)}
                                                            placeholder={`Enter ${item.inputType}…`}
                                                            className="mt-1.5 w-full text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}

                    {/* Complete button */}
                    {status !== 'complete' && (
                        <button
                            onClick={markComplete}
                            disabled={saving || !online}
                            className="mt-4 w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-50 touch-manipulation transition-colors"
                        >
                            {saving ? 'Saving…' : 'Mark Complete'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
