// ── Markdown Utility Functions ──
// Used for KB content indexing, heading extraction, and word counting.

/** Strip markdown syntax to produce plain text for full-text search indexing. */
export function stripMarkdown(md: string): string {
    return md
        // Remove frontmatter
        .replace(/^---[\s\S]*?---\n*/m, '')
        // Remove headings markers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
        // Remove links [text](url)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove images
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Remove table separators
        .replace(/\|?-{3,}\|?/g, '')
        // Remove pipe chars from table rows but keep content
        .replace(/\|/g, ' ')
        // Remove list markers
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Collapse whitespace
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

export interface Heading {
    level: number;
    text: string;
    id: string;
}

/** Extract H2 and H3 headings from markdown for mini-TOC generation. */
export function extractHeadings(md: string): Heading[] {
    const headings: Heading[] = [];
    const lines = md.split('\n');
    for (const line of lines) {
        const match = line.match(/^(#{2,3})\s+(.+)/);
        if (match) {
            const level = match[1].length;
            // Strip emoji and formatting
            const raw = match[2].replace(/\*{1,2}/g, '').replace(/[🏛️👥💰🤝🔍👣🎯🔧⚙️📐📦📈🚀🏁🎨⚡🗄️📊📋]/g, '').trim();
            const id = raw
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            headings.push({ level, text: raw, id });
        }
    }
    return headings;
}

/** Count words in plain text. */
export function countWords(text: string): number {
    const plain = stripMarkdown(text);
    const words = plain.split(/\s+/).filter(w => w.length > 0);
    return words.length;
}
