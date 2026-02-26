// KBSidebar — Flat card-style navigation for the Knowledge Base reader.
// Each of the 4 v4.1 KB sections renders as a prominent, well-spaced nav item.
//
// Usage:
//   <KBSidebar sections={sections} activeSlug={activeSlug} onSelect={(slug) => setActiveSlug(slug)} />

import { cn } from '@/lib/utils';
import type { KBSectionMeta } from '@/services/api';

interface KBSidebarProps {
    sections: KBSectionMeta[];
    activeSlug: string;
    onSelect: (slug: string) => void;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function wordCountLabel(wc: number): string {
    if (wc >= 1000) return `${(wc / 1000).toFixed(1)}k`;
    return String(wc);
}

export function KBSidebar({ sections, activeSlug, onSelect }: KBSidebarProps) {
    return (
        <div className="py-3 px-2 space-y-1">
            {sections.map(section => {
                const isActive = section.slug === activeSlug;
                const roman = section.partNumber ? ROMAN[section.partNumber] : null;

                return (
                    <button
                        key={section.slug}
                        onClick={() => onSelect(section.slug)}
                        className={cn(
                            'w-full text-left flex items-start gap-2.5 px-3 py-3 rounded-lg transition-all duration-150',
                            isActive
                                ? 'border-l-[3px] border-blue-500 bg-blue-50/60 text-blue-700'
                                : 'border-l-[3px] border-transparent text-s2p-fg hover:bg-slate-50'
                        )}
                    >
                        <span className="text-lg leading-none mt-0.5 shrink-0">
                            {section.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className={cn(
                                'text-sm leading-snug',
                                isActive ? 'font-medium' : 'font-normal'
                            )}>
                                {section.title}
                            </div>
                            <div className={cn(
                                'text-[10px] font-mono uppercase tracking-wider mt-0.5',
                                isActive ? 'text-blue-500' : 'text-s2p-muted'
                            )}>
                                {roman && `PART ${roman}  ·  `}
                                {wordCountLabel(section.wordCount)} words
                            </div>
                        </div>
                    </button>
                );
            })}

            {sections.length === 0 && (
                <div className="text-center py-8 text-s2p-muted text-sm">
                    <p>No sections loaded</p>
                </div>
            )}
        </div>
    );
}
