import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, BookOpen, ArrowRight } from 'lucide-react';
import { searchKB } from '@/services/api';
import type { KBSearchResult } from '@/services/api';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<KBSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => inputRef.current?.focus());
            // Reset state on each open
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!query.trim() || query.trim().length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const { results: data } = await searchKB(query);
                setResults(data);
                setSelectedIndex(0);
            } catch {
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const selectResult = useCallback((result: KBSearchResult) => {
        onClose();
        navigate(`/dashboard/knowledge?s=${result.slug}`);
    }, [onClose, navigate]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    selectResult(results[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [results, selectedIndex, selectResult, onClose]);

    // Scroll selected result into view
    useEffect(() => {
        const el = document.querySelector(`[data-cmd-index="${selectedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-s2p-border overflow-hidden"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                    >
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-s2p-border">
                            <Search size={18} className="text-s2p-muted shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search the Knowledge Base..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="flex-1 text-sm outline-none bg-transparent text-s2p-fg placeholder:text-s2p-muted"
                            />
                            {isSearching && (
                                <Loader2 size={16} className="animate-spin text-s2p-muted shrink-0" />
                            )}
                            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-s2p-muted bg-s2p-secondary px-1.5 py-0.5 rounded border border-s2p-border font-mono">
                                ESC
                            </kbd>
                        </div>

                        {/* Results area */}
                        <div className="max-h-80 overflow-y-auto">
                            {/* Empty state — no query */}
                            {!query.trim() && (
                                <div className="flex flex-col items-center justify-center py-12 text-s2p-muted">
                                    <BookOpen size={28} className="mb-2 opacity-30" />
                                    <p className="text-xs">Type to search the Knowledge Base</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-s2p-muted/60">
                                        <kbd className="bg-s2p-secondary px-1 py-0.5 rounded border border-s2p-border font-mono">↑</kbd>
                                        <kbd className="bg-s2p-secondary px-1 py-0.5 rounded border border-s2p-border font-mono">↓</kbd>
                                        <span>navigate</span>
                                        <kbd className="bg-s2p-secondary px-1 py-0.5 rounded border border-s2p-border font-mono ml-1">↵</kbd>
                                        <span>select</span>
                                    </div>
                                </div>
                            )}

                            {/* No results */}
                            {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-s2p-muted">
                                    <Search size={28} className="mb-2 opacity-30" />
                                    <p className="text-xs">No results for "{query}"</p>
                                </div>
                            )}

                            {/* Query too short */}
                            {query.trim().length > 0 && query.trim().length < 2 && (
                                <div className="flex items-center justify-center py-8 text-s2p-muted">
                                    <p className="text-xs">Type at least 2 characters to search</p>
                                </div>
                            )}

                            {/* Results */}
                            {results.length > 0 && (
                                <div className="py-1">
                                    {results.map((r, i) => (
                                        <button
                                            key={r.id}
                                            data-cmd-index={i}
                                            onClick={() => selectResult(r)}
                                            onMouseEnter={() => setSelectedIndex(i)}
                                            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                                                i === selectedIndex
                                                    ? 'bg-s2p-primary/5 border-l-2 border-s2p-primary'
                                                    : 'border-l-2 border-transparent hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {r.emoji && <span className="text-sm">{r.emoji}</span>}
                                                    <span className="text-sm font-semibold text-s2p-fg truncate">{r.title}</span>
                                                </div>
                                                {r.part_title && (
                                                    <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-s2p-muted bg-s2p-secondary px-1.5 py-0.5 rounded mb-1">
                                                        {r.part_title}
                                                    </span>
                                                )}
                                                {r.snippet && (
                                                    <div
                                                        className="text-xs text-s2p-muted line-clamp-2 mt-0.5 [&>mark]:bg-yellow-200/80 [&>mark]:px-0.5 [&>mark]:rounded"
                                                        dangerouslySetInnerHTML={{ __html: r.snippet }}
                                                    />
                                                )}
                                            </div>
                                            {i === selectedIndex && (
                                                <ArrowRight size={14} className="text-s2p-primary shrink-0 mt-1" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {results.length > 0 && (
                            <div className="border-t border-s2p-border px-4 py-2 flex items-center justify-between text-[10px] text-s2p-muted">
                                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                        <kbd className="bg-s2p-secondary px-1 py-0.5 rounded border border-s2p-border font-mono">↵</kbd>
                                        open
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
