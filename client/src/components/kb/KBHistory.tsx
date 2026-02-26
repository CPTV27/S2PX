// ── KB Edit History ──
// Timeline of edits for a knowledge base section.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, User, Loader2, History, X } from 'lucide-react';
import { fetchKBHistory } from '@/services/api';
import type { KBEditHistoryEntry } from '@/services/api';
import { formatDate } from '@/lib/utils';

interface KBHistoryProps {
    slug: string;
    sectionTitle: string;
    isOpen: boolean;
    onClose: () => void;
}

export function KBHistory({ slug, sectionTitle, isOpen, onClose }: KBHistoryProps) {
    const [entries, setEntries] = useState<KBEditHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !slug) return;

        setLoading(true);
        setError(null);

        fetchKBHistory(slug)
            .then(data => setEntries(data))
            .catch(err => setError(err.message || 'Failed to load history'))
            .finally(() => setLoading(false));
    }, [isOpen, slug]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-s2p-border overflow-hidden max-h-[80vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-s2p-border">
                            <div className="flex items-center gap-2">
                                <History size={18} className="text-s2p-primary" />
                                <div>
                                    <h3 className="text-sm font-semibold text-s2p-fg">Edit History</h3>
                                    <p className="text-[10px] text-s2p-muted">{sectionTitle}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 text-s2p-muted hover:text-s2p-fg rounded-lg hover:bg-s2p-secondary transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-s2p-primary" />
                                </div>
                            )}

                            {error && !loading && (
                                <div className="text-center py-8">
                                    <p className="text-xs text-red-600">{error}</p>
                                </div>
                            )}

                            {!loading && !error && entries.length === 0 && (
                                <div className="text-center py-12 text-s2p-muted">
                                    <History size={28} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">No edits recorded yet</p>
                                </div>
                            )}

                            {!loading && !error && entries.length > 0 && (
                                <div className="space-y-0">
                                    {entries.map((entry, i) => (
                                        <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                                            {/* Timeline line */}
                                            {i < entries.length - 1 && (
                                                <div className="absolute left-[9px] top-5 bottom-0 w-px bg-s2p-border" />
                                            )}

                                            {/* Timeline dot */}
                                            <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2 border-s2p-primary bg-white flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-s2p-primary" />
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-semibold text-s2p-fg">v{entry.version}</span>
                                                    <span className="text-[10px] text-s2p-muted">
                                                        {formatDate(entry.createdAt)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 text-[11px] text-s2p-muted mb-1">
                                                    <User size={10} />
                                                    <span>{entry.editedBy}</span>
                                                </div>

                                                {entry.editSummary && (
                                                    <p className="text-xs text-s2p-fg/80 bg-s2p-secondary/50 rounded-lg px-2.5 py-1.5 border border-s2p-border">
                                                        {entry.editSummary}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
