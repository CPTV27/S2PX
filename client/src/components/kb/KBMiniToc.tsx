// KBMiniToc — Right-rail within-section heading navigator.
// Parses H2/H3 headings from markdown content and renders a sticky
// mini-TOC. Active heading is tracked by the parent via IntersectionObserver.
//
// Usage:
//   <KBMiniToc content={section.content} activeHeadingId={activeHeadingId} />

import { useMemo } from 'react';
import { AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KBMiniTocProps {
    content: string;
    activeHeadingId: string;
}

interface TocEntry {
    id: string;
    text: string;
    level: 2 | 3;
}

// Generate an ID that matches what rehype-slug produces.
// rehype-slug uses `github-slugger` under the hood:
// lowercase → strip chars that aren't word chars, spaces, or hyphens → spaces→hyphens
function toHeadingId(rawText: string): string {
    return rawText
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function parseHeadings(content: string): TocEntry[] {
    const regex = /^(#{2,3})\s+(.+)/gm;
    const entries: TocEntry[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        const hashes = match[1];
        const rawText = match[2]
            // Strip inline markdown: bold, italic, code, links
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .trim();

        entries.push({
            id: toHeadingId(rawText),
            text: rawText,
            level: hashes.length === 2 ? 2 : 3,
        });
    }

    return entries;
}

export function KBMiniToc({ content, activeHeadingId }: KBMiniTocProps) {
    const headings = useMemo(() => parseHeadings(content), [content]);

    if (headings.length === 0) return null;

    const handleClick = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="py-5 px-3">
            {/* Label */}
            <div className="flex items-center gap-1.5 mb-3 px-1">
                <AlignLeft size={11} className="text-s2p-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-s2p-muted">
                    On this page
                </span>
            </div>

            <nav className="space-y-0.5">
                {headings.map((h) => {
                    const isActive = h.id === activeHeadingId;
                    return (
                        <button
                            key={h.id}
                            onClick={() => handleClick(h.id)}
                            className={cn(
                                'w-full text-left block text-xs leading-snug transition-all duration-150 py-1 rounded',
                                h.level === 2
                                    ? 'pl-2'
                                    : 'pl-4',
                                isActive
                                    ? 'text-blue-600 font-semibold border-l-2 border-blue-500 pl-1.5'
                                    : 'text-s2p-muted hover:text-s2p-fg border-l-2 border-transparent'
                            )}
                        >
                            {h.level === 3 && (
                                <span className="mr-1 text-[9px] text-s2p-muted/60">›</span>
                            )}
                            {h.text}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
