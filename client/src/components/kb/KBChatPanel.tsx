// ── KB Chat Panel ──
// NotebookLM-style AI chat grounded in Knowledge Base content.
// Shown as a right-side collapsible panel on the KB page.

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Send, Loader2, BookOpen, Sparkles, X, ChevronRight,
    MessageSquare, ExternalLink,
} from 'lucide-react';
import { sendKBChat } from '@/services/api';
import type { KBChatResponse } from '@/services/api';
import { cn } from '@/lib/utils';

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    citations?: { slug: string; title: string }[];
    sources?: { slug: string; title: string }[];
}

interface KBChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    currentSectionSlug?: string;
    onNavigateToSection: (slug: string) => void;
}

export function KBChatPanel({ isOpen, onClose, currentSectionSlug, onNavigateToSection }: KBChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'model',
            text: "I'm grounded in the S2P Knowledge Base. Ask me anything about Scan2Plan's operations, pricing, standards, technology, or strategy.",
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useCurrentSection, setUseCurrentSection] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const history = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, text: m.text }));

            const sectionSlugs = useCurrentSection && currentSectionSlug
                ? [currentSectionSlug]
                : undefined;

            const data: KBChatResponse = await sendKBChat(userMsg.text, history, sectionSlugs);

            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: data.response,
                    citations: data.citations,
                    sources: data.sources,
                },
            ]);
        } catch (err: any) {
            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: `Error: ${err.message || 'Failed to get response'}`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, messages, useCurrentSection, currentSectionSlug]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 380, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0 border-l border-s2p-border bg-white flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-s2p-border bg-s2p-secondary/30">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-s2p-primary" />
                            <span className="text-sm font-semibold text-s2p-fg">KB Assistant</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-s2p-muted hover:text-s2p-fg rounded-lg hover:bg-s2p-secondary transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                        {messages.map(msg => (
                            <div key={msg.id}>
                                <div
                                    className={cn(
                                        'max-w-[90%] px-3 py-2.5 rounded-xl text-[13px] leading-relaxed',
                                        msg.role === 'user'
                                            ? 'ml-auto bg-s2p-primary text-white rounded-tr-none'
                                            : 'mr-auto bg-s2p-secondary text-s2p-fg rounded-tl-none border border-s2p-border'
                                    )}
                                >
                                    {/* Render text with basic markdown-like bold */}
                                    {msg.text.split('\n').map((line, i) => (
                                        <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                                            {line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                                ? <span dangerouslySetInnerHTML={{
                                                    __html: line
                                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                                        .replace(/\[§(\d+):\s*([^\]]+)\]/g, '<em class="text-blue-600 not-italic cursor-pointer">[$1: $2]</em>')
                                                }} />
                                                : line || '\u00A0'
                                            }
                                        </p>
                                    ))}
                                </div>

                                {/* Citations */}
                                {msg.citations && msg.citations.length > 0 && (
                                    <div className="mt-1.5 ml-0 flex flex-wrap gap-1">
                                        {msg.citations.map(c => (
                                            <button
                                                key={c.slug}
                                                onClick={() => onNavigateToSection(c.slug)}
                                                className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors"
                                            >
                                                <BookOpen size={9} />
                                                {c.title.replace(/^Section \d+:\s*/, '')}
                                                <ExternalLink size={8} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Sources (if no explicit citations but sources returned) */}
                                {msg.sources && msg.sources.length > 0 && (!msg.citations || msg.citations.length === 0) && (
                                    <div className="mt-1.5 ml-0">
                                        <span className="text-[10px] text-s2p-muted">Sources: </span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            {msg.sources.slice(0, 3).map(s => (
                                                <button
                                                    key={s.slug}
                                                    onClick={() => onNavigateToSection(s.slug)}
                                                    className="inline-flex items-center gap-1 text-[10px] text-s2p-muted hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    {s.title.replace(/^Section \d+:\s*/, '').slice(0, 25)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="mr-auto bg-s2p-secondary text-s2p-fg rounded-xl rounded-tl-none px-3 py-2.5 border border-s2p-border">
                                <div className="flex items-center gap-2 text-xs text-s2p-muted">
                                    <Loader2 size={14} className="animate-spin text-s2p-primary" />
                                    Searching KB...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="border-t border-s2p-border bg-white p-3">
                        {/* Section scope toggle */}
                        {currentSectionSlug && (
                            <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useCurrentSection}
                                    onChange={e => setUseCurrentSection(e.target.checked)}
                                    className="rounded text-s2p-primary focus:ring-s2p-primary/20"
                                />
                                <span className="text-[10px] text-s2p-muted">Scope to current section only</span>
                            </label>
                        )}

                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about the Knowledge Base..."
                                className="flex-1 bg-s2p-secondary border border-s2p-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="p-2 bg-s2p-primary text-white rounded-lg hover:bg-s2p-accent disabled:opacity-50 transition-all"
                            >
                                <Send size={14} />
                            </button>
                        </div>

                        <div className="mt-1.5 text-[10px] text-s2p-muted font-mono text-center">
                            Gemini 2.5 Flash • KB-grounded
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
