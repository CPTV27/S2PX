import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, Loader2, BrainCircuit, Volume2 } from 'lucide-react';
import { sendMessageToGemini, generateSpeech } from '@/services/gemini';
import { createLead } from '@/services/api';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'model',
            text: "I'm the S2P Operator. I can help with lead intake, project scoping, pricing questions, and more. How can I assist?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useReasoning, setUseReasoning] = useState(false);
    const [useSearch, setUseSearch] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, text: m.text }));

            const responseText = await sendMessageToGemini(
                history,
                userMessage.text,
                { useReasoning, useSearch },
                async (toolName, args) => {
                    if (toolName === 'createLead') {
                        try {
                            await createLead({
                                clientName: args.clientName,
                                projectName: args.projectName,
                                contactName: args.contactName,
                                contactEmail: args.contactEmail,
                                estimatedValue: args.estimatedValue,
                                notes: args.notes,
                                status: 'new',
                            });
                        } catch (e) {
                            console.error('Failed to create lead via chat:', e);
                        }
                    }
                }
            );

            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    text: responseText || "I've processed your request.",
                    timestamp: new Date(),
                },
            ]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTTS = async (text: string) => {
        try {
            const audioUrl = await generateSpeech(text);
            if (audioUrl) {
                const audio = new Audio(audioUrl);
                audio.play();
            }
        } catch (e) {
            console.error('TTS failed', e);
        }
    };

    return (
        <>
            {/* Toggle */}
            <motion.button
                data-tour="chat-widget"
                className="fixed bottom-6 right-6 w-14 h-14 bg-s2p-primary text-white rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center z-50"
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-6 w-96 h-[600px] max-h-[80vh] bg-white border border-s2p-border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-s2p-border bg-s2p-secondary/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className="text-s2p-primary" />
                                <span className="font-semibold text-s2p-fg">S2P Operator</span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setUseReasoning(!useReasoning)}
                                    className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        useReasoning ? "bg-s2p-primary text-white" : "text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary"
                                    )}
                                    title="Deep Thinking Mode"
                                >
                                    <BrainCircuit size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "max-w-[85%] p-3 rounded-xl text-sm leading-relaxed relative group",
                                        msg.role === 'user'
                                            ? "ml-auto bg-s2p-primary text-white rounded-tr-none"
                                            : "mr-auto bg-s2p-secondary text-s2p-fg rounded-tl-none border border-s2p-border"
                                    )}
                                >
                                    {msg.text}
                                    {msg.role === 'model' && (
                                        <button
                                            onClick={() => handleTTS(msg.text)}
                                            className="absolute -right-7 top-2 opacity-0 group-hover:opacity-100 text-s2p-muted hover:text-s2p-primary transition-opacity"
                                        >
                                            <Volume2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="mr-auto bg-s2p-secondary text-s2p-fg rounded-xl rounded-tl-none p-3 border border-s2p-border">
                                    <Loader2 size={16} className="animate-spin text-s2p-primary" />
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-s2p-border bg-white">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder={useReasoning ? "Ask complex questions..." : "Ask about leads, pricing..."}
                                    className="flex-1 bg-s2p-secondary border border-s2p-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 bg-s2p-primary text-white rounded-lg hover:bg-s2p-accent disabled:opacity-50 transition-all"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                            <div className="mt-2 flex justify-between text-[10px] text-s2p-muted font-mono">
                                <span>{useReasoning ? "Gemini 2.5 Pro (Thinking)" : "Gemini 2.5 Flash"}</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useSearch}
                                        onChange={e => setUseSearch(e.target.checked)}
                                        className="rounded"
                                    />
                                    <span>Search</span>
                                </label>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
