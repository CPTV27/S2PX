// ── Scantech Notes Tab ──
// Field notes with autosave + AI assistant button.

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Plus, Save, Loader2, CheckCircle, Bot, Trash2,
    MessageSquare, AlertTriangle, MapPin, Camera, Clock, Sparkles,
} from 'lucide-react';
import { useScantechContext } from './ScantechLayout';
import { ScantechAIChat } from './ScantechAIChat';
import { saveFieldNotes, type FieldNote } from '@/services/api';
import { cn } from '@/lib/utils';

const AUTOSAVE_MS = 5000;

const CATEGORY_CONFIG = {
    general: { icon: MessageSquare, label: 'General', color: 'bg-blue-100 text-blue-800' },
    site_condition: { icon: MapPin, label: 'Site Condition', color: 'bg-green-100 text-green-800' },
    issue: { icon: AlertTriangle, label: 'Issue', color: 'bg-red-100 text-red-800' },
    photo_analysis: { icon: Camera, label: 'AI Analysis', color: 'bg-purple-100 text-purple-800' },
};

export function NotesTab() {
    const { project, reloadProject, online } = useScantechContext();
    const [notes, setNotes] = useState<FieldNote[]>(project.notes || []);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [showNewNote, setShowNewNote] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState<FieldNote['category']>('general');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dirty = useRef(false);
    const [showAI, setShowAI] = useState(false);

    // Sync from project on load
    useEffect(() => {
        setNotes(project.notes || []);
    }, [project.notes]);

    // Autosave
    const doSave = useCallback(async (notesToSave: FieldNote[]) => {
        if (!online) return;
        setSaving(true);
        try {
            await saveFieldNotes(project.id, notesToSave);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    }, [project.id, online]);

    const triggerSave = useCallback((updatedNotes: FieldNote[]) => {
        dirty.current = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => doSave(updatedNotes), AUTOSAVE_MS);
    }, [doSave]);

    // Cleanup
    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    // Add note
    const addNote = () => {
        if (!newContent.trim()) return;
        const note: FieldNote = {
            id: crypto.randomUUID(),
            content: newContent.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            aiAssisted: false,
            category: newCategory,
        };
        const updated = [note, ...notes];
        setNotes(updated);
        setNewContent('');
        setShowNewNote(false);
        triggerSave(updated);
    };

    // Delete note
    const deleteNote = (id: string) => {
        const updated = notes.filter((n) => n.id !== id);
        setNotes(updated);
        triggerSave(updated);
    };

    // Update note content
    const updateNote = (id: string, content: string) => {
        const updated = notes.map((n) =>
            n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n
        );
        setNotes(updated);
        triggerSave(updated);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Field Notes</h2>
                <div className="flex items-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {saveStatus === 'saved' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {saveStatus === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    <button
                        onClick={() => setShowNewNote(true)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-blue-700 active:bg-blue-800 touch-manipulation"
                    >
                        <Plus className="w-4 h-4" />
                        Add Note
                    </button>
                </div>
            </div>

            {/* ── New Note Form ── */}
            {showNewNote && (
                <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
                    <div className="flex gap-1.5 flex-wrap">
                        {(Object.keys(CATEGORY_CONFIG) as FieldNote['category'][]).map((cat) => {
                            if (!cat) return null;
                            const cfg = CATEGORY_CONFIG[cat];
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setNewCategory(cat)}
                                    className={cn(
                                        'text-[10px] font-semibold px-2 py-1 rounded-full transition-colors touch-manipulation',
                                        newCategory === cat
                                            ? cfg.color
                                            : 'bg-gray-100 text-gray-500',
                                    )}
                                >
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>
                    <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="Write a field note…"
                        rows={3}
                        autoFocus
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => { setShowNewNote(false); setNewContent(''); }}
                            className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700 touch-manipulation"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={addNote}
                            disabled={!newContent.trim()}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 touch-manipulation"
                        >
                            Save Note
                        </button>
                    </div>
                </div>
            )}

            {/* ── Notes List ── */}
            {notes.length === 0 && !showNewNote ? (
                <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No field notes yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                        Add notes about site conditions, issues, or observations
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notes.map((note) => {
                        const cat = note.category && CATEGORY_CONFIG[note.category]
                            ? CATEGORY_CONFIG[note.category]
                            : CATEGORY_CONFIG.general;

                        return (
                            <div
                                key={note.id}
                                className="bg-white rounded-xl border border-gray-200 p-4"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                            cat.color,
                                        )}>
                                            {cat.label}
                                        </span>
                                        {note.aiAssisted && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 flex items-center gap-0.5">
                                                <Bot className="w-3 h-3" /> AI
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => deleteNote(note.id)}
                                        className="p-1 rounded hover:bg-gray-100 touch-manipulation"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                    {note.content}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
                                    <Clock className="w-3 h-3" />
                                    {new Date(note.createdAt).toLocaleString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── AI Assistant FAB ── */}
            <button
                onClick={() => setShowAI(true)}
                className="fixed bottom-20 right-4 z-20 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:bg-blue-800 touch-manipulation transition-transform active:scale-95"
                aria-label="Open AI Assistant"
            >
                <Sparkles className="w-6 h-6" />
            </button>

            {/* ── AI Chat Panel ── */}
            {showAI && (
                <ScantechAIChat
                    project={project}
                    onClose={() => setShowAI(false)}
                />
            )}
        </div>
    );
}
