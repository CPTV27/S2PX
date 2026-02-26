// KBContent — Styled markdown renderer for the Knowledge Base reader.
// Uses react-markdown + remark-gfm + rehype-slug for GitHub-flavored
// markdown with auto-generated heading IDs for anchor scrolling.
//
// Usage:
//   <KBContent content={section.content} />

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface KBContentProps {
    content: string;
    className?: string;
}

// Slugify identical to rehype-slug: lowercase, strip non-word chars, spaces → hyphens
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

const components: Components = {
    h1: ({ children }) => (
        <h1
            id={slugify(String(children))}
            className="text-2xl font-bold text-s2p-fg mt-8 mb-4 pb-3 border-b-2 border-s2p-border"
        >
            {children}
        </h1>
    ),

    h2: ({ children }) => (
        <h2
            id={slugify(String(children))}
            className="text-lg font-bold text-s2p-fg mt-8 mb-3 pb-2 border-b border-s2p-border scroll-mt-4"
        >
            {children}
        </h2>
    ),

    h3: ({ children }) => (
        <h3
            id={slugify(String(children))}
            className="text-base font-semibold text-s2p-fg mt-6 mb-2 pl-3 border-l-2 border-blue-400 scroll-mt-4"
        >
            {children}
        </h3>
    ),

    h4: ({ children }) => (
        <h4
            id={slugify(String(children))}
            className="text-sm font-semibold text-s2p-fg mt-5 mb-2 uppercase tracking-wide scroll-mt-4"
        >
            {children}
        </h4>
    ),

    p: ({ children }) => (
        <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>
    ),

    ul: ({ children }) => (
        <ul className="text-sm text-slate-600 list-disc ml-5 space-y-1 mb-3">{children}</ul>
    ),

    ol: ({ children }) => (
        <ol className="text-sm text-slate-600 list-decimal ml-5 space-y-1 mb-3">{children}</ol>
    ),

    li: ({ children }) => (
        <li className="leading-relaxed">{children}</li>
    ),

    strong: ({ children }) => (
        <strong className="font-semibold text-slate-800">{children}</strong>
    ),

    em: ({ children }) => (
        <em className="italic text-slate-600">{children}</em>
    ),

    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-blue-300 pl-4 py-1 my-4 bg-blue-50/40 rounded-r-lg text-sm text-slate-600 italic">
            {children}
        </blockquote>
    ),

    table: ({ children }) => (
        <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-s2p-border rounded-lg overflow-hidden">
                {children}
            </table>
        </div>
    ),

    thead: ({ children }) => (
        <thead className="bg-slate-50">{children}</thead>
    ),

    th: ({ children }) => (
        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-s2p-border">
            {children}
        </th>
    ),

    td: ({ children }) => (
        <td className="px-3 py-2 text-slate-600 border-b border-slate-100">{children}</td>
    ),

    tr: ({ children }) => (
        <tr className="hover:bg-slate-50/60 transition-colors">{children}</tr>
    ),

    // Inline code
    code: ({ children, className }) => {
        // Block code (has a language class like `language-js`)
        const isBlock = className?.startsWith('language-');
        if (isBlock) {
            return (
                <code className={cn(
                    'block bg-slate-900 text-slate-100 rounded-lg px-4 py-3 text-xs font-mono overflow-x-auto mb-3 leading-relaxed',
                    className
                )}>
                    {children}
                </code>
            );
        }
        return (
            <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">
                {children}
            </code>
        );
    },

    pre: ({ children }) => (
        <pre className="bg-slate-900 rounded-xl mb-4 overflow-x-auto">
            {children}
        </pre>
    ),

    a: ({ children, href }) => (
        <a
            href={href}
            className="text-blue-600 hover:text-blue-800 underline underline-offset-2 text-sm transition-colors"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
            {children}
        </a>
    ),

    hr: () => (
        <hr className="my-6 border-s2p-border" />
    ),
};

export function KBContent({ content, className }: KBContentProps) {
    return (
        <div className={cn('prose-none max-w-none', className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
