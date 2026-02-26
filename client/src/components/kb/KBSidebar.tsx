// KBSidebar — Docusaurus-style sidebar TOC for the Knowledge Base reader.
// Groups sections by partNumber. Standalone items (partNumber=null) appear ungrouped.
//
// Usage:
//   <KBSidebar sections={sections} activeSlug={activeSlug} onSelect={(slug) => setActiveSlug(slug)} />

import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { KBSectionMeta } from '@/services/api';

interface KBSidebarProps {
    sections: KBSectionMeta[];
    activeSlug: string;
    onSelect: (slug: string) => void;
}

interface PartGroup {
    partNumber: number;
    partTitle: string;
    sections: KBSectionMeta[];
}

function buildGroups(sections: KBSectionMeta[]): { standalone: KBSectionMeta[]; parts: PartGroup[] } {
    const standalone: KBSectionMeta[] = [];
    const partsMap = new Map<number, PartGroup>();

    for (const s of sections) {
        if (s.partNumber === null) {
            standalone.push(s);
        } else {
            if (!partsMap.has(s.partNumber)) {
                partsMap.set(s.partNumber, {
                    partNumber: s.partNumber,
                    partTitle: s.partTitle ?? `Part ${s.partNumber}`,
                    sections: [],
                });
            }
            partsMap.get(s.partNumber)!.sections.push(s);
        }
    }

    const parts = Array.from(partsMap.values()).sort((a, b) => a.partNumber - b.partNumber);
    return { standalone, parts };
}

function wordCountLabel(wc: number): string {
    if (wc >= 1000) return `${(wc / 1000).toFixed(1)}k`;
    return String(wc);
}

// Roman numerals for part headers
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function KBSidebar({ sections, activeSlug, onSelect }: KBSidebarProps) {
    const { standalone, parts } = buildGroups(sections);

    // Track which parts are collapsed — all open by default
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

    const togglePart = (partNumber: number) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(partNumber)) next.delete(partNumber);
            else next.add(partNumber);
            return next;
        });
    };

    const SectionItem = ({ section }: { section: KBSectionMeta }) => {
        const isActive = section.slug === activeSlug;
        return (
            <button
                onClick={() => onSelect(section.slug)}
                className={cn(
                    'w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                    isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                        : 'text-s2p-fg hover:bg-slate-100 border border-transparent'
                )}
            >
                <FileText
                    size={13}
                    className={cn(
                        'mt-0.5 shrink-0',
                        isActive ? 'text-blue-600' : 'text-s2p-muted group-hover:text-s2p-fg'
                    )}
                />
                <span className="flex-1 leading-snug">
                    {section.emoji && (
                        <span className="mr-1.5">{section.emoji}</span>
                    )}
                    {section.sectionNumber !== null && (
                        <span className={cn('mr-1 font-mono text-xs', isActive ? 'text-blue-500' : 'text-s2p-muted')}>
                            {section.sectionNumber}.
                        </span>
                    )}
                    {section.title}
                </span>
                <span className={cn(
                    'text-[10px] font-mono shrink-0 mt-0.5 px-1 py-0.5 rounded',
                    isActive ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-s2p-muted'
                )}>
                    {wordCountLabel(section.wordCount)}w
                </span>
            </button>
        );
    };

    return (
        <div className="py-4 px-2">
            {/* Standalone sections (Overview, Appendix, etc.) */}
            {standalone.length > 0 && (
                <div className="mb-4 space-y-0.5">
                    {standalone.map(s => (
                        <SectionItem key={s.slug} section={s} />
                    ))}
                </div>
            )}

            {/* Part groups */}
            {parts.map(part => {
                const isOpen = !collapsed.has(part.partNumber);
                const roman = ROMAN[part.partNumber] ?? String(part.partNumber);
                const hasActive = part.sections.some(s => s.slug === activeSlug);

                return (
                    <div key={part.partNumber} className="mb-3">
                        {/* Part header / collapse trigger */}
                        <button
                            onClick={() => togglePart(part.partNumber)}
                            className={cn(
                                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 group',
                                hasActive && !isOpen
                                    ? 'bg-blue-50/60 text-blue-700'
                                    : 'text-s2p-muted hover:text-s2p-fg hover:bg-slate-50'
                            )}
                        >
                            <BookOpen size={13} className="shrink-0" />
                            <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider leading-tight">
                                <span className="font-mono mr-1">PART {roman}</span>
                                <span className="block mt-0.5 text-[10px] font-normal normal-case tracking-normal">
                                    {part.partTitle}
                                </span>
                            </span>
                            <span className="shrink-0">
                                {isOpen
                                    ? <ChevronDown size={13} className="opacity-60" />
                                    : <ChevronRight size={13} className="opacity-60" />
                                }
                            </span>
                        </button>

                        {/* Section list with collapse animation */}
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1 ml-3 pl-2 border-l border-s2p-border space-y-0.5">
                                        {part.sections.map(s => (
                                            <SectionItem key={s.slug} section={s} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}

            {sections.length === 0 && (
                <div className="text-center py-8 text-s2p-muted text-sm">
                    <BookOpen size={24} className="mx-auto mb-2 opacity-30" />
                    <p>No sections loaded</p>
                </div>
            )}
        </div>
    );
}
