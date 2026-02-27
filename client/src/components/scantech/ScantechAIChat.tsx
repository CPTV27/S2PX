// ── Scantech AI Chat ──
// Slide-up panel with Gemini-powered field intelligence.
// 4 modes: chat, photo_analysis, audio_to_scoping, checklist_validate

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Bot, X, Send, Camera, Loader2, AlertTriangle, CheckSquare,
    Mic, ChevronDown, Sparkles,
} from 'lucide-react';
import {
    scantechAIAssist,
    type ScantechAIRequest,
    type ScantechAIResponse,
} from '@/services/api';
import type { ScantechProjectDetail, ChecklistResponse } from '@/services/api';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: string;
    photoPreview?: string;
    validationResult?: ScantechAIResponse['validationResult'];
}

interface ScantechAIChatProps {
    project: ScantechProjectDetail;
    onClose: () => void;
    allChecklistResponses?: ChecklistResponse[];
}

export function ScantechAIChat({ project, onClose, allChecklistResponses }: ScantechAIChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'model',
            text: `Hi! I'm your AI field assistant for **${project.upid}**. I can help with:\n\n• **Field questions** — scanning procedures, equipment, building types\n• **Photo analysis** — upload a site photo for AI assessment\n• **Checklist review** — validate completion before sign-off\n\nHow can I help?`,
            timestamp: new Date().toISOString(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'chat' | 'photo'>('chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on open
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 300);
    }, []);

    // Build conversation history for context
    const buildHistory = useCallback(() => {
        return messages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, text: m.text }));
    }, [messages]);

    // Send message
    const sendMessage = async (text: string, photoBase64?: string) => {
        if (!text.trim() && !photoBase64) return;

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            text: text.trim() || 'Analyze this photo',
            timestamp: new Date().toISOString(),
            photoPreview: photoBase64 ? `data:image/jpeg;base64,${photoBase64.slice(0, 100)}...` : undefined,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const req: ScantechAIRequest = {
                intent: photoBase64 ? 'photo_analysis' : 'chat',
                message: text.trim() || 'Analyze this site photo and describe what you see.',
                context: {
                    projectId: project.id,
                    photoBase64,
                    buildingType: project.scopingData.era,
                    riskFactors: project.scopingData.riskFactors,
                },
                history: buildHistory(),
            };

            const response = await scantechAIAssist(req);

            const aiMsg: Message = {
                id: crypto.randomUUID(),
                role: 'model',
                text: response.response,
                timestamp: new Date().toISOString(),
                validationResult: response.validationResult,
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'model',
                text: `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to get AI response'}`,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    // Validate checklists
    const validateChecklists = async () => {
        setLoading(true);
        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            text: '🔍 Validate my checklists for completion',
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);

        try {
            const req: ScantechAIRequest = {
                intent: 'checklist_validate',
                message: 'Validate all checklists for this project',
                context: {
                    projectId: project.id,
                    checklistResponses: allChecklistResponses || [],
                    buildingType: project.scopingData.era,
                    riskFactors: project.scopingData.riskFactors,
                },
            };

            const response = await scantechAIAssist(req);

            const aiMsg: Message = {
                id: crypto.randomUUID(),
                role: 'model',
                text: response.response,
                timestamp: new Date().toISOString(),
                validationResult: response.validationResult,
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'model',
                text: `⚠️ Error: ${err instanceof Error ? err.message : 'Validation failed'}`,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    // Handle photo upload
    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            sendMessage(input || 'Analyze this site photo', base64);
        };
        reader.readAsDataURL(file);
        setMode('chat');

        // Reset input
        if (photoInputRef.current) photoInputRef.current.value = '';
    };

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'photo') {
            photoInputRef.current?.click();
        } else {
            sendMessage(input);
        }
    };

    // Handle Enter key (without shift)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white safe-area-pt safe-area-pb animate-in slide-in-from-bottom duration-300">
            {/* ── Header ── */}
            <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">AI Field Assistant</h3>
                        <p className="text-[10px] text-gray-500">Powered by Gemini</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 touch-manipulation"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </header>

            {/* ── Quick Actions ── */}
            <div className="flex gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto flex-shrink-0">
                <QuickAction
                    icon={CheckSquare}
                    label="Validate Checklists"
                    onClick={validateChecklists}
                    disabled={loading}
                />
                <QuickAction
                    icon={Camera}
                    label="Analyze Photo"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={loading}
                />
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            'max-w-[85%]',
                            msg.role === 'user' ? 'ml-auto' : 'mr-auto',
                        )}
                    >
                        <div
                            className={cn(
                                'rounded-2xl px-3.5 py-2.5 text-sm',
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-md',
                            )}
                        >
                            <p className="whitespace-pre-wrap">{msg.text}</p>

                            {/* Validation result badge */}
                            {msg.validationResult && (
                                <div className={cn(
                                    'mt-2 p-2 rounded-lg text-xs',
                                    msg.validationResult.passed
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800',
                                )}>
                                    <p className="font-semibold">
                                        {msg.validationResult.passed ? '✅ All checks passed' : '❌ Issues found'}
                                    </p>
                                    {msg.validationResult.missingItems.length > 0 && (
                                        <ul className="mt-1 list-disc list-inside">
                                            {msg.validationResult.missingItems.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    )}
                                    {msg.validationResult.warnings.length > 0 && (
                                        <ul className="mt-1 list-disc list-inside text-amber-800">
                                            {msg.validationResult.warnings.map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className={cn(
                            'text-[10px] mt-0.5 px-1',
                            msg.role === 'user' ? 'text-right text-gray-400' : 'text-gray-400',
                        )}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                ))}

                {loading && (
                    <div className="mr-auto max-w-[85%]">
                        <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-sm text-gray-500">Thinking…</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            <form
                onSubmit={handleSubmit}
                className="border-t border-gray-200 px-4 py-3 flex items-end gap-2 flex-shrink-0"
            >
                <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhoto}
                />
                <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="p-2.5 rounded-lg hover:bg-gray-100 touch-manipulation flex-shrink-0"
                    disabled={loading}
                >
                    <Camera className="w-5 h-5 text-gray-500" />
                </button>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything…"
                    rows={1}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-24"
                />
                <button
                    type="submit"
                    disabled={loading || (!input.trim())}
                    className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 touch-manipulation flex-shrink-0"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}

// ── Quick Action Button ──

function QuickAction({
    icon: Icon,
    label,
    onClick,
    disabled,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 whitespace-nowrap disabled:opacity-50 touch-manipulation"
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}
