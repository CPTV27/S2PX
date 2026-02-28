// KnowledgeBase — Docusaurus-style knowledge base reader page.
// Three-panel layout: sidebar TOC | markdown content | mini-TOC
//
// Deep-linking: ?s=<slug> in the URL loads that section on mount.
// Section content is cached in a ref — no double-fetching on back-nav.
//
// Usage (via router):
//   <Route path="knowledge" element={<KnowledgeBase />} />

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Loader2, BookOpen, Clock, Hash, ChevronDown, Search, X, AlertCircle, Sparkles,
    Pencil, History,
} from 'lucide-react';
import { KBSidebar } from '@/components/kb/KBSidebar';
import { KBContent } from '@/components/kb/KBContent';
import { KBMiniToc } from '@/components/kb/KBMiniToc';
import { KBChatPanel } from '@/components/kb/KBChatPanel';
import { KBEditor } from '@/components/kb/KBEditor';
import { KBHistory } from '@/components/kb/KBHistory';
import { fetchKBSections, fetchKBSection, searchKB } from '@/services/api';
import { cn, formatDate } from '@/lib/utils';
import type { KBSectionMeta, KBSection, KBSearchResult } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

// DashboardLayout wraps content in `p-8` (2rem). Header is ~72px (~4.5rem).
// We subtract header (4.5rem) + top padding (2rem) + bottom padding (2rem) = 8.5rem.
const PANEL_HEIGHT = 'calc(100vh - 8.5rem)';

export function KnowledgeBase() {
    const { user } = useAuth();
    const [sections, setSections] = useState<KBSectionMeta[]>([]);
    const [activeSlug, setActiveSlug] = useState<string>('');
    const [activeSection, setActiveSection] = useState<KBSection | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [contentLoading, setContentLoading] = useState(false);
    const [activeHeadingId, setActiveHeadingId] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [contentError, setContentError] = useState<string | null>(null);

    // Mobile section picker
    const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

    // AI chat panel
    const [chatOpen, setChatOpen] = useState(false);

    // Editor + history state
    const [editMode, setEditMode] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    // Role-based edit access (admin/ceo)
    const canEdit = user?.role === 'admin' || user?.role === 'ceo';

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<KBSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Section content cache — avoids re-fetching previously loaded sections
    const sectionCache = useRef<Map<string, KBSection>>(new Map());

    // Scroll container ref for IntersectionObserver
    const contentRef = useRef<HTMLDivElement>(null);

    const [searchParams, setSearchParams] = useSearchParams();

    // ── Load section list on mount ──
    useEffect(() => {
        setIsLoading(true);
        setLoadError(null);
        fetchKBSections()
            .then(data => {
                setSections(data);
                // Determine which slug to load first
                const urlSlug = searchParams.get('s');
                const initial = urlSlug && data.find(s => s.slug === urlSlug)
                    ? urlSlug
                    : data[0]?.slug ?? '';
                setActiveSlug(initial);
            })
            .catch(err => {
                setLoadError(err instanceof Error ? err.message : 'Failed to load knowledge base');
            })
            .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Respond to ?s= changes from CommandPalette / deep links ──
    useEffect(() => {
        const urlSlug = searchParams.get('s');
        if (urlSlug && urlSlug !== activeSlug && sections.length > 0) {
            const match = sections.find(s => s.slug === urlSlug);
            if (match) {
                setActiveSlug(urlSlug);
            }
        }
    }, [searchParams, sections, activeSlug]);

    // ── Load section content when activeSlug changes ──
    useEffect(() => {
        if (!activeSlug) return;

        // Update URL param for deep-linking (replace, not push)
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('s', activeSlug);
            return next;
        }, { replace: true });

        // Check cache first
        if (sectionCache.current.has(activeSlug)) {
            setActiveSection(sectionCache.current.get(activeSlug)!);
            setActiveHeadingId('');
            setContentError(null);
            return;
        }

        setContentLoading(true);
        setContentError(null);
        setActiveHeadingId('');

        fetchKBSection(activeSlug)
            .then(data => {
                sectionCache.current.set(activeSlug, data);
                setActiveSection(data);
            })
            .catch(err => {
                setContentError(err instanceof Error ? err.message : 'Failed to load section');
            })
            .finally(() => setContentLoading(false));
    }, [activeSlug, setSearchParams]);

    // ── IntersectionObserver — track active heading ──
    useEffect(() => {
        if (!contentRef.current || !activeSection) return;

        const headingEls = contentRef.current.querySelectorAll<HTMLElement>('h2[id], h3[id]');
        if (headingEls.length === 0) return;

        const observer = new IntersectionObserver(
            entries => {
                // Find the topmost intersecting heading
                const visible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible.length > 0) {
                    setActiveHeadingId(visible[0].target.id);
                }
            },
            {
                root: contentRef.current,
                rootMargin: '-10% 0px -80% 0px',
                threshold: 0,
            }
        );

        headingEls.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [activeSection]);

    // ── Search with debounce ──
    const handleSearchChange = useCallback((q: string) => {
        setSearchQuery(q);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        if (!q.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const { results } = await searchKB(q);
                setSearchResults(results);
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 350);
    }, []);

    const handleSelectSection = useCallback((slug: string) => {
        setActiveSlug(slug);
        setMobilePickerOpen(false);
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setEditMode(false);
        // Scroll content back to top
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, []);

    const handleEditorSave = useCallback((updated: KBSection) => {
        // Update cache + active section
        sectionCache.current.set(updated.slug, updated);
        setActiveSection(updated);
        setEditMode(false);
        // Update sidebar meta
        setSections(prev => prev.map(s =>
            s.slug === updated.slug
                ? { ...s, wordCount: updated.wordCount, version: updated.version, editedBy: updated.editedBy, updatedAt: updated.updatedAt }
                : s
        ));
    }, []);

    // ── Derived section meta for the header ──
    const activeMeta = sections.find(s => s.slug === activeSlug);
    const activePartLabel = activeMeta?.partNumber !== null && activeMeta?.partTitle
        ? `PART ${toRoman(activeMeta.partNumber ?? 0)}: ${activeMeta.partTitle}`
        : null;

    // ── Render ──
    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ height: PANEL_HEIGHT }}>
                <div className="text-center">
                    <Loader2 size={32} className="animate-spin text-s2p-primary mx-auto mb-3" />
                    <p className="text-sm text-s2p-muted">Loading knowledge base...</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex items-center justify-center" style={{ height: PANEL_HEIGHT }}>
                <div className="text-center max-w-sm">
                    <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-s2p-fg mb-1">Failed to load knowledge base</p>
                    <p className="text-xs text-s2p-muted">{loadError}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="relative flex border border-s2p-border rounded-2xl overflow-hidden bg-white -mt-2"
            style={{ height: PANEL_HEIGHT }}
        >
            {/* ── LEFT SIDEBAR ── (hidden on < lg) */}
            <div className="w-64 flex-shrink-0 border-r border-s2p-border overflow-y-auto hidden lg:block bg-s2p-secondary/30">
                {/* Search bar inside sidebar header */}
                <div className="sticky top-0 z-10 bg-s2p-secondary/80 backdrop-blur-sm border-b border-s2p-border px-3 py-2.5">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-s2p-muted pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search KB..."
                            value={searchQuery}
                            onChange={e => handleSearchChange(e.target.value)}
                            onFocus={() => setSearchOpen(true)}
                            className="w-full text-xs pl-7 pr-7 py-2 bg-white border border-s2p-border rounded-lg focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); }}
                                className="absolute right-2 top-2 text-s2p-muted hover:text-s2p-fg"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search results overlay */}
                <AnimatePresence>
                    {searchOpen && searchQuery && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="border-b border-s2p-border"
                        >
                            {isSearching ? (
                                <div className="flex items-center gap-2 px-4 py-3 text-xs text-s2p-muted">
                                    <Loader2 size={12} className="animate-spin" />
                                    Searching...
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-s2p-muted">No results found.</div>
                            ) : (
                                <div className="divide-y divide-s2p-border max-h-60 overflow-y-auto">
                                    {searchResults.map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => handleSelectSection(r.slug)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
                                        >
                                            <div className="text-xs font-semibold text-s2p-fg">
                                                {r.emoji && <span className="mr-1">{r.emoji}</span>}
                                                {r.title}
                                            </div>
                                            {r.snippet && (
                                                <div className="text-[10px] text-s2p-muted mt-0.5 line-clamp-2"
                                                    dangerouslySetInnerHTML={{ __html: r.snippet }}
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <KBSidebar
                    sections={sections}
                    activeSlug={activeSlug}
                    onSelect={handleSelectSection}
                />
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 overflow-y-auto min-w-0" ref={contentRef}>
                {/* Mobile section picker — visible on < lg */}
                <div className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-s2p-border px-4 py-2.5">
                    <button
                        onClick={() => setMobilePickerOpen(v => !v)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-s2p-secondary border border-s2p-border rounded-lg text-sm"
                    >
                        <span className="flex items-center gap-2 font-medium text-s2p-fg truncate">
                            <BookOpen size={14} className="text-s2p-muted shrink-0" />
                            {activeMeta?.emoji && <span>{activeMeta.emoji}</span>}
                            <span className="truncate">{activeMeta?.title ?? 'Select section'}</span>
                        </span>
                        <ChevronDown
                            size={14}
                            className={cn('text-s2p-muted shrink-0 transition-transform', mobilePickerOpen && 'rotate-180')}
                        />
                    </button>

                    <AnimatePresence>
                        {mobilePickerOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute left-0 right-0 top-full z-30 bg-white border-b border-s2p-border shadow-xl max-h-72 overflow-y-auto"
                            >
                                <KBSidebar
                                    sections={sections}
                                    activeSlug={activeSlug}
                                    onSelect={handleSelectSection}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content area — edit mode takes over the whole pane */}
                {editMode && activeSection ? (
                    <KBEditor
                        section={activeSection}
                        onSave={handleEditorSave}
                        onCancel={() => setEditMode(false)}
                        editedBy={user?.email ?? 'unknown'}
                    />
                ) : (
                <div className="px-8 py-6 max-w-3xl">
                    {/* Breadcrumbs */}
                    {activePartLabel && (
                        <div className="flex items-center gap-1 text-[11px] text-s2p-muted font-mono uppercase tracking-wider mb-3">
                            <span>{activePartLabel}</span>
                            {activeMeta?.sectionNumber !== null && (
                                <>
                                    <span className="opacity-40 mx-1">›</span>
                                    <span>Section {activeMeta?.sectionNumber}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Section header */}
                    {activeMeta && (
                        <div className="mb-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    {activeMeta.emoji && (
                                        <div className="text-3xl mb-2">{activeMeta.emoji}</div>
                                    )}
                                    <h1 className="text-2xl font-bold text-s2p-fg leading-tight mb-3">
                                        {activeMeta.title}
                                    </h1>
                                </div>

                                {/* Edit + History buttons */}
                                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                                    <button
                                        onClick={() => setHistoryOpen(true)}
                                        className="flex items-center gap-1 text-[11px] text-s2p-muted hover:text-s2p-fg px-2 py-1 rounded-lg hover:bg-s2p-secondary transition-colors"
                                        title="View edit history"
                                    >
                                        <History size={12} />
                                        <span className="hidden sm:inline">History</span>
                                    </button>

                                    {canEdit && (
                                        <button
                                            onClick={() => setEditMode(true)}
                                            className="flex items-center gap-1 text-[11px] text-s2p-primary hover:text-white bg-blue-50 hover:bg-s2p-primary px-2.5 py-1 rounded-lg transition-all"
                                            title="Edit this section"
                                        >
                                            <Pencil size={12} />
                                            <span className="hidden sm:inline">Edit</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Word count */}
                                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-s2p-muted px-2 py-0.5 rounded-full font-mono">
                                    <Hash size={9} />
                                    {activeMeta.wordCount.toLocaleString()} words
                                </span>
                                {/* Version */}
                                <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">
                                    v{activeMeta.version}
                                </span>
                                {/* Last edited */}
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-s2p-muted">
                                    <Clock size={10} />
                                    {formatDate(activeMeta.updatedAt)}
                                    {activeMeta.editedBy && (
                                        <span className="opacity-60">by {activeMeta.editedBy}</span>
                                    )}
                                </span>
                            </div>
                            <div className="mt-4 border-b border-s2p-border" />
                        </div>
                    )}

                    {/* Loading state */}
                    {contentLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-s2p-primary" />
                        </div>
                    )}

                    {/* Content error */}
                    {contentError && !contentLoading && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertCircle size={16} className="shrink-0" />
                            <div>
                                <p className="font-semibold">Failed to load section</p>
                                <p className="text-xs mt-0.5">{contentError}</p>
                            </div>
                        </div>
                    )}

                    {/* Markdown content */}
                    <AnimatePresence mode="wait">
                        {!contentLoading && !contentError && activeSection && (
                            <motion.div
                                key={activeSection.slug}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18 }}
                            >
                                <KBContent content={activeSection.content} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Empty state */}
                    {!contentLoading && !contentError && !activeSection && sections.length > 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-s2p-muted">
                            <BookOpen size={36} className="mb-3 opacity-30" />
                            <p className="text-sm">Select a section from the sidebar</p>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* ── RIGHT MINI-TOC ── (hidden on < xl, hidden when chat open or editing) */}
            {!chatOpen && !editMode && (
                <div className="w-52 flex-shrink-0 hidden xl:block overflow-y-auto border-l border-s2p-border bg-s2p-secondary/20">
                    {activeSection && (
                        <KBMiniToc
                            content={activeSection.content}
                            activeHeadingId={activeHeadingId}
                        />
                    )}
                </div>
            )}

            {/* ── AI CHAT PANEL ── */}
            <KBChatPanel
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                currentSectionSlug={activeSlug}
                onNavigateToSection={handleSelectSection}
            />

            {/* AI Chat toggle button (fixed, visible when chat is closed and not editing) */}
            {!chatOpen && !editMode && (
                <button
                    onClick={() => setChatOpen(true)}
                    className="absolute top-3 right-3 flex items-center gap-1.5 text-xs bg-s2p-primary text-white px-3 py-1.5 rounded-lg hover:bg-s2p-accent shadow-lg shadow-blue-500/20 transition-all z-10"
                    title="AI Chat"
                >
                    <Sparkles size={12} />
                    <span className="hidden sm:inline">AI Chat</span>
                </button>
            )}

            {/* Edit History Modal */}
            <KBHistory
                slug={activeSlug}
                sectionTitle={activeMeta?.title ?? ''}
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
            />
        </div>
    );
}

// Helper: convert integer to Roman numeral (1-10)
function toRoman(n: number): string {
    const map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return map[n] ?? String(n);
}
