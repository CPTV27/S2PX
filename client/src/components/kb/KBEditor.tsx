// ── KB Editor ──
// Split-pane markdown editor with live preview.
// Includes AI-assisted editing via /api/kb/sections/:slug/ai-edit.

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
    Save, X, Loader2, Sparkles, Eye, Code, AlertTriangle,
} from 'lucide-react';
import { KBContent } from './KBContent';
import { updateKBSection, requestKBAIEdit } from '@/services/api';
import type { KBSection } from '@/services/api';
import { cn } from '@/lib/utils';

interface KBEditorProps {
    section: KBSection;
    onSave: (updated: KBSection) => void;
    onCancel: () => void;
    editedBy: string;
}

export function KBEditor({ section, onSave, onCancel, editedBy }: KBEditorProps) {
    const [content, setContent] = useState(section.content);
    const [editSummary, setEditSummary] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // AI edit state
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProposed, setAiProposed] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    // View mode: 'split' | 'code' | 'preview'
    const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');

    const hasChanges = content !== section.content;

    const handleSave = useCallback(async () => {
        if (!hasChanges || saving) return;
        setSaving(true);
        setSaveError(null);

        try {
            const updated = await updateKBSection(section.slug, {
                content,
                editSummary: editSummary || 'Manual edit',
                version: section.version,
                editedBy,
            });
            onSave(updated);
        } catch (err: any) {
            setSaveError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }, [content, editSummary, section, editedBy, hasChanges, saving, onSave]);

    const handleAIEdit = useCallback(async () => {
        if (!aiInstruction.trim() || aiLoading) return;
        setAiLoading(true);
        setAiError(null);
        setAiProposed(null);

        try {
            const data = await requestKBAIEdit(section.slug, aiInstruction);
            setAiProposed(data.proposedContent);
        } catch (err: any) {
            setAiError(err.message || 'AI edit failed');
        } finally {
            setAiLoading(false);
        }
    }, [aiInstruction, aiLoading, section.slug]);

    const acceptAIEdit = useCallback(() => {
        if (aiProposed) {
            setContent(aiProposed);
            setEditSummary(`AI edit: ${aiInstruction}`);
            setAiProposed(null);
            setAiInstruction('');
        }
    }, [aiProposed, aiInstruction]);

    const rejectAIEdit = useCallback(() => {
        setAiProposed(null);
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-s2p-border bg-s2p-secondary/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-s2p-muted">Editing:</span>
                    <span className="text-sm font-semibold text-s2p-fg">{section.title}</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex rounded-lg border border-s2p-border overflow-hidden">
                        <button
                            onClick={() => setViewMode('code')}
                            className={cn('px-2 py-1 text-[10px]', viewMode === 'code' ? 'bg-s2p-primary text-white' : 'text-s2p-muted hover:bg-s2p-secondary')}
                            title="Code only"
                        >
                            <Code size={12} />
                        </button>
                        <button
                            onClick={() => setViewMode('split')}
                            className={cn('px-2 py-1 text-[10px] border-x border-s2p-border', viewMode === 'split' ? 'bg-s2p-primary text-white' : 'text-s2p-muted hover:bg-s2p-secondary')}
                            title="Split view"
                        >
                            Split
                        </button>
                        <button
                            onClick={() => setViewMode('preview')}
                            className={cn('px-2 py-1 text-[10px]', viewMode === 'preview' ? 'bg-s2p-primary text-white' : 'text-s2p-muted hover:bg-s2p-secondary')}
                            title="Preview only"
                        >
                            <Eye size={12} />
                        </button>
                    </div>

                    <button
                        onClick={onCancel}
                        className="flex items-center gap-1 text-xs text-s2p-muted hover:text-s2p-fg px-2 py-1 rounded-lg hover:bg-s2p-secondary transition-colors"
                    >
                        <X size={14} />
                        Cancel
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="flex items-center gap-1 text-xs bg-s2p-primary text-white px-3 py-1.5 rounded-lg hover:bg-s2p-accent disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                    </button>
                </div>
            </div>

            {/* Save error */}
            {saveError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
                    <AlertTriangle size={12} />
                    {saveError}
                </div>
            )}

            {/* AI Edit bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-s2p-border bg-gradient-to-r from-purple-50/50 to-blue-50/50">
                <Sparkles size={14} className="text-purple-500 shrink-0" />
                <input
                    type="text"
                    value={aiInstruction}
                    onChange={e => setAiInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAIEdit()}
                    placeholder="AI instruction: e.g. 'Tighten language, remove filler' or 'Flag unverified claims'"
                    className="flex-1 text-xs bg-white border border-s2p-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition-all"
                    disabled={aiLoading}
                />
                <button
                    onClick={handleAIEdit}
                    disabled={!aiInstruction.trim() || aiLoading}
                    className="flex items-center gap-1 text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-all"
                >
                    {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    AI Edit
                </button>
            </div>

            {/* AI error */}
            {aiError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700">
                    <AlertTriangle size={12} />
                    {aiError}
                </div>
            )}

            {/* AI proposed diff review */}
            {aiProposed && (
                <div className="border-b border-purple-200 bg-purple-50/50 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-purple-700">AI proposed changes — review before accepting</span>
                        <div className="flex gap-2">
                            <button
                                onClick={rejectAIEdit}
                                className="text-xs text-s2p-muted hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                                Reject
                            </button>
                            <button
                                onClick={acceptAIEdit}
                                className="text-xs bg-purple-500 text-white px-3 py-1 rounded-lg hover:bg-purple-600 transition-colors"
                            >
                                Accept Changes
                            </button>
                        </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-purple-200 p-3">
                        <div className="prose prose-sm prose-slate max-w-none">
                            <KBContent content={aiProposed} />
                        </div>
                    </div>
                </div>
            )}

            {/* Editor area */}
            <div className="flex-1 flex min-h-0">
                {/* Code editor */}
                {(viewMode === 'code' || viewMode === 'split') && (
                    <div className={cn('flex flex-col min-h-0', viewMode === 'split' ? 'w-1/2 border-r border-s2p-border' : 'w-full')}>
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-s2p-border text-[10px] text-s2p-muted font-mono uppercase tracking-wider">
                            Markdown
                        </div>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="flex-1 w-full resize-none p-4 text-xs font-mono leading-relaxed text-s2p-fg bg-white focus:outline-none"
                            spellCheck={false}
                        />
                    </div>
                )}

                {/* Preview */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className={cn('flex flex-col min-h-0 overflow-y-auto', viewMode === 'split' ? 'w-1/2' : 'w-full')}>
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-s2p-border text-[10px] text-s2p-muted font-mono uppercase tracking-wider">
                            Preview
                        </div>
                        <div className="p-4">
                            <KBContent content={content} />
                        </div>
                    </div>
                )}
            </div>

            {/* Edit summary */}
            {hasChanges && (
                <div className="border-t border-s2p-border px-4 py-2 bg-s2p-secondary/20">
                    <input
                        type="text"
                        value={editSummary}
                        onChange={e => setEditSummary(e.target.value)}
                        placeholder="Edit summary (optional): e.g. 'Updated pricing section'"
                        className="w-full text-xs bg-white border border-s2p-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                    />
                </div>
            )}
        </div>
    );
}
