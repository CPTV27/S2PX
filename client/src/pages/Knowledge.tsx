import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Sparkles, Search, BookOpen, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { sendMessageToGemini } from '@/services/gemini';
import { fetchWikiPages, subscribeToWikiPages } from '@/services/firestore';
import { cn } from '@/lib/utils';
import type { WikiPage } from '@/types';

export function Knowledge() {
    const [pages, setPages] = useState<WikiPage[]>([]);
    const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [liveMode, setLiveMode] = useState(false);

    // Initial fetch
    useEffect(() => {
        loadPages();
    }, []);

    // Real-time listener (toggled by user)
    useEffect(() => {
        if (!liveMode) return;
        const unsub = subscribeToWikiPages((updated) => {
            setPages(updated);
            setLoading(false);
            setError(null);
        });
        return unsub;
    }, [liveMode]);

    async function loadPages() {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchWikiPages();
            setPages(data);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to connect to Firestore';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    const handleAsk = async () => {
        if (!chatInput.trim()) return;

        const userMsg = { role: 'user' as const, text: chatInput };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput('');
        setIsProcessing(true);

        try {
            const context = pages.length > 0
                ? `Knowledge Base Context (from Firestore wiki_pages):\n${pages.map(p => `## ${p.title}\n${p.content}`).join('\n\n')}\n\nUser Question: ${chatInput}`
                : `No knowledge base documents loaded. User Question: ${chatInput}`;

            const response = await sendMessageToGemini(
                chatHistory,
                context,
                { useReasoning: true }
            );

            setChatHistory(prev => [...prev, { role: 'model', text: response || "I couldn't find an answer." }]);
        } catch (e) {
            console.error(e);
            setChatHistory(prev => [...prev, { role: 'model', text: 'Error processing your question.' }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-6 h-[calc(100vh-200px)] flex flex-col">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Knowledge Base</h2>
                    <p className="text-s2p-muted text-sm mt-1">
                        {pages.length > 0
                            ? `${pages.length} wiki pages from Firestore`
                            : 'Ask questions about S2P docs and pricing.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setLiveMode(!liveMode)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-xs transition-colors border",
                            liveMode
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-s2p-secondary text-s2p-muted border-s2p-border hover:border-s2p-muted"
                        )}
                    >
                        <Database size={12} />
                        {liveMode ? 'Live' : 'Static'}
                    </button>
                    <button
                        onClick={loadPages}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-s2p-primary text-white rounded-xl font-medium text-sm hover:bg-s2p-accent transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Sync
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Sources */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white border border-s2p-border rounded-2xl p-5 flex flex-col overflow-hidden"
                >
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-s2p-muted uppercase tracking-wider">
                        <BookOpen size={14} />
                        Wiki Pages ({pages.length})
                    </h3>
                    <div className="space-y-2 overflow-y-auto flex-1">
                        {loading && pages.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-s2p-muted">
                                <RefreshCw size={20} className="animate-spin" />
                            </div>
                        ) : pages.length === 0 ? (
                            <div className="text-center py-8 text-s2p-muted text-sm">
                                <Database size={24} className="mx-auto mb-2 opacity-50" />
                                <p>No wiki pages found.</p>
                                <p className="text-xs mt-1">Check Firestore connection.</p>
                            </div>
                        ) : (
                            pages.map(page => (
                                <div
                                    key={page.id}
                                    onClick={() => setSelectedPage(page)}
                                    className={cn(
                                        "p-3 rounded-xl border cursor-pointer transition-all",
                                        selectedPage?.id === page.id
                                            ? "bg-blue-50 border-s2p-primary"
                                            : "bg-s2p-secondary/50 border-s2p-border hover:border-s2p-muted"
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <FileText size={16} className="text-s2p-muted mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{page.title}</div>
                                            {page.category && (
                                                <div className="text-[10px] text-s2p-muted font-mono mt-0.5">{page.category}</div>
                                            )}
                                            {page.tags && page.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {page.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Chat */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="lg:col-span-2 bg-white border border-s2p-border rounded-2xl p-5 flex flex-col overflow-hidden"
                >
                    {/* Selected page preview */}
                    {selectedPage && (
                        <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <div className="text-xs text-blue-600 font-mono uppercase tracking-wider mb-1">Viewing</div>
                            <div className="text-sm font-semibold">{selectedPage.title}</div>
                            <div className="text-xs text-s2p-muted mt-1 line-clamp-3 whitespace-pre-wrap">{selectedPage.content}</div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-s2p-muted opacity-50">
                                <Sparkles size={40} className="mb-3" />
                                <p className="font-medium">Ask anything about your wiki</p>
                                <p className="text-sm mt-1">"What are the QC standards for BIM deliverables?"</p>
                                <p className="text-sm">"Summarize pricing tiers for scanning projects"</p>
                            </div>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "max-w-[80%] p-3 rounded-xl text-sm leading-relaxed",
                                        msg.role === 'user'
                                            ? "ml-auto bg-s2p-primary text-white rounded-tr-none"
                                            : "mr-auto bg-s2p-secondary text-s2p-fg rounded-tl-none border border-s2p-border"
                                    )}
                                >
                                    {msg.text}
                                </div>
                            ))
                        )}
                        {isProcessing && (
                            <div className="mr-auto bg-s2p-secondary rounded-xl rounded-tl-none p-3 border border-s2p-border inline-flex gap-1">
                                <div className="w-2 h-2 bg-s2p-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 bg-s2p-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 bg-s2p-muted rounded-full animate-bounce" />
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAsk()}
                            placeholder="Ask about your wiki pages..."
                            className="w-full bg-s2p-secondary border border-s2p-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                        />
                        <button
                            onClick={handleAsk}
                            disabled={!chatInput.trim() || isProcessing}
                            className="absolute right-2 top-2 p-2 bg-s2p-primary text-white rounded-lg hover:bg-s2p-accent disabled:opacity-50 transition-all"
                        >
                            <Search size={16} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
