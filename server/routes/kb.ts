// ── Knowledge Base Routes ──
// CRUD for KB sections + full-text search + AI chat (Sprint 3).

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { kbSections, kbEditHistory } from '../../shared/schema/db.js';
import { eq, sql, desc, asc, inArray } from 'drizzle-orm';
import { stripMarkdown, countWords } from '../lib/markdownUtils.js';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// ── List all sections (lightweight — no content body) ──
router.get('/sections', async (_req: Request, res: Response) => {
    try {
        const sections = await db
            .select({
                id: kbSections.id,
                slug: kbSections.slug,
                title: kbSections.title,
                emoji: kbSections.emoji,
                partNumber: kbSections.partNumber,
                partTitle: kbSections.partTitle,
                sectionNumber: kbSections.sectionNumber,
                sortOrder: kbSections.sortOrder,
                wordCount: kbSections.wordCount,
                version: kbSections.version,
                editedBy: kbSections.editedBy,
                updatedAt: kbSections.updatedAt,
            })
            .from(kbSections)
            .orderBy(asc(kbSections.sortOrder));
        res.json(sections);
    } catch (error: any) {
        console.error('KB list error:', error);
        res.status(500).json({ error: error.message || 'Failed to list KB sections' });
    }
});

// ── Get single section by slug (with full content) ──
router.get('/sections/:slug', async (req: Request, res: Response) => {
    try {
        const [section] = await db
            .select()
            .from(kbSections)
            .where(eq(kbSections.slug, req.params.slug));
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }
        res.json(section);
    } catch (error: any) {
        console.error('KB get error:', error);
        res.status(500).json({ error: error.message || 'Failed to get KB section' });
    }
});

// ── Full-text search with headline snippets ──
router.get('/search', async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 2) {
            return res.json({ results: [] });
        }

        const results = await db.execute(sql`
            SELECT
                id,
                slug,
                title,
                emoji,
                part_title,
                section_number,
                ts_headline(
                    'english',
                    content_plain,
                    plainto_tsquery('english', ${q}),
                    'MaxWords=40, MinWords=20, StartSel=<mark>, StopSel=</mark>'
                ) as snippet,
                ts_rank(
                    to_tsvector('english', content_plain),
                    plainto_tsquery('english', ${q})
                ) as rank
            FROM kb_sections
            WHERE to_tsvector('english', content_plain) @@ plainto_tsquery('english', ${q})
            ORDER BY rank DESC
            LIMIT 20
        `);

        res.json({ results: results.rows });
    } catch (error: any) {
        console.error('KB search error:', error);
        res.status(500).json({ error: error.message || 'Search failed' });
    }
});

// ── Update section content ──
router.put('/sections/:slug', async (req: Request, res: Response) => {
    try {
        const { content, editSummary, version, editedBy } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Fetch current version for optimistic locking
        const [current] = await db
            .select()
            .from(kbSections)
            .where(eq(kbSections.slug, req.params.slug));
        if (!current) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Version conflict check
        if (version && current.version !== version) {
            return res.status(409).json({
                error: 'Version conflict — this section was edited by someone else. Reload and try again.',
                currentVersion: current.version,
            });
        }

        const newVersion = (current.version || 1) + 1;
        const plain = stripMarkdown(content);
        const words = countWords(content);

        // Save edit history
        await db.insert(kbEditHistory).values({
            sectionId: current.id,
            previousContent: current.content,
            newContent: content,
            editedBy: editedBy || 'unknown',
            editSummary: editSummary || null,
            version: newVersion,
        });

        // Update section
        const [updated] = await db
            .update(kbSections)
            .set({
                content,
                contentPlain: plain,
                wordCount: words,
                editedBy: editedBy || 'unknown',
                version: newVersion,
                updatedAt: new Date(),
            })
            .where(eq(kbSections.slug, req.params.slug))
            .returning();

        res.json(updated);
    } catch (error: any) {
        console.error('KB update error:', error);
        res.status(400).json({ error: error.message || 'Failed to update section' });
    }
});

// ── Get edit history for a section ──
router.get('/sections/:slug/history', async (req: Request, res: Response) => {
    try {
        const [section] = await db
            .select({ id: kbSections.id })
            .from(kbSections)
            .where(eq(kbSections.slug, req.params.slug));
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const history = await db
            .select({
                id: kbEditHistory.id,
                editedBy: kbEditHistory.editedBy,
                editSummary: kbEditHistory.editSummary,
                version: kbEditHistory.version,
                createdAt: kbEditHistory.createdAt,
            })
            .from(kbEditHistory)
            .where(eq(kbEditHistory.sectionId, section.id))
            .orderBy(desc(kbEditHistory.createdAt));

        res.json(history);
    } catch (error: any) {
        console.error('KB history error:', error);
        res.status(500).json({ error: error.message || 'Failed to get edit history' });
    }
});

// ── AI-proposed edit for a section ──
router.post('/sections/:slug/ai-edit', async (req: Request, res: Response) => {
    try {
        const { instruction } = req.body as { instruction: string };
        if (!instruction?.trim()) {
            return res.status(400).json({ error: 'instruction is required' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        const [section] = await db
            .select()
            .from(kbSections)
            .where(eq(kbSections.slug, req.params.slug));
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `You are an expert editor for the Scan2Plan Master Knowledge Base.

CURRENT SECTION: "${section.title}"

CURRENT CONTENT (markdown):
---
${section.content}
---

USER INSTRUCTION: ${instruction}

RULES:
- Apply the user's instruction to improve the content.
- Preserve the markdown formatting (headings, lists, tables, bold/italic).
- Keep all factual information intact unless instructed to remove it.
- Do NOT add information that isn't already present unless the user explicitly asks.
- If the instruction asks to reduce fluff or tighten language, aggressively cut redundant words and filler.
- If the instruction asks to flag hallucinations, add [⚠️ VERIFY] tags before any claim that seems unsubstantiated.
- Return ONLY the edited markdown content — no explanations, no preamble, no wrapping.`
                }],
            },
        });

        const proposedContent = result.text?.trim() || '';
        if (!proposedContent) {
            return res.status(500).json({ error: 'AI returned empty content' });
        }

        res.json({
            proposedContent,
            originalContent: section.content,
            sectionTitle: section.title,
        });
    } catch (error: any) {
        console.error('KB AI edit error:', error);
        res.status(500).json({ error: error.message || 'AI edit failed' });
    }
});

// ── AI Chat grounded in KB content ──
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const KB_CHAT_SYSTEM = `You are the S2P Knowledge Base Assistant — an AI expert on Scan2Plan's business, operations, technology, pricing, and standards.

YOUR ROLE:
- Answer questions ONLY from the Knowledge Base content provided below.
- Cite specific sections when answering using the format [§N: Section Title].
- If the answer is NOT in the provided KB content, say "I don't have that information in the Knowledge Base."
- Be concise, precise, and technical.
- Format responses with markdown (bold, lists, headers) for readability.

YOUR PERSONALITY:
- Expert and authoritative on Scan2Plan operations.
- Concise — get to the point. No fluff.
- Use data and specifics from the KB when available.`;

router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, history, sectionSlugs } = req.body as {
            message: string;
            history?: { role: 'user' | 'model'; text: string }[];
            sectionSlugs?: string[];
        };

        if (!message?.trim()) {
            return res.status(400).json({ error: 'message is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        }

        // Gather KB context — either specific sections or FTS top-5
        let contextSections: { slug: string; title: string; content_plain: string }[];

        if (sectionSlugs && sectionSlugs.length > 0) {
            const rows = await db
                .select({
                    slug: kbSections.slug,
                    title: kbSections.title,
                    content_plain: kbSections.contentPlain,
                })
                .from(kbSections)
                .where(inArray(kbSections.slug, sectionSlugs));
            contextSections = rows.map(r => ({ slug: r.slug, title: r.title, content_plain: r.content_plain }));
        } else {
            // FTS search for relevant sections
            const ftsResults = await db.execute(sql`
                SELECT slug, title, content_plain,
                    ts_rank(to_tsvector('english', content_plain), plainto_tsquery('english', ${message})) as rank
                FROM kb_sections
                WHERE to_tsvector('english', content_plain) @@ plainto_tsquery('english', ${message})
                ORDER BY rank DESC
                LIMIT 5
            `);
            contextSections = (ftsResults.rows as any[]).map(r => ({
                slug: r.slug,
                title: r.title,
                content_plain: r.content_plain,
            }));

            // If FTS returns nothing, grab the top 3 sections by sort order as fallback
            if (contextSections.length === 0) {
                const fallback = await db
                    .select({
                        slug: kbSections.slug,
                        title: kbSections.title,
                        content_plain: kbSections.contentPlain,
                    })
                    .from(kbSections)
                    .orderBy(asc(kbSections.sortOrder))
                    .limit(3);
                contextSections = fallback.map(r => ({ slug: r.slug, title: r.title, content_plain: r.content_plain }));
            }
        }

        // Build context string (trim each section to ~2000 chars to stay in context window)
        const kbContext = contextSections.map(s => {
            const trimmed = s.content_plain.length > 2000
                ? s.content_plain.slice(0, 2000) + '...'
                : s.content_plain;
            return `--- [${s.title}] (slug: ${s.slug}) ---\n${trimmed}`;
        }).join('\n\n');

        const systemPrompt = `${KB_CHAT_SYSTEM}\n\n=== KNOWLEDGE BASE CONTENT ===\n${kbContext}\n=== END KB CONTENT ===`;

        const chatHistory = (history || []).map(h => ({
            role: h.role as 'user' | 'model',
            parts: [{ text: h.text }],
        }));

        const chat = genai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: systemPrompt },
            history: chatHistory,
        });

        const result = await chat.sendMessage({ message });
        const responseText = result.text || 'I was unable to generate a response.';

        // Extract citations from the response — match [§N: Title] patterns
        const citationRegex = /\[§\d+:\s*([^\]]+)\]/g;
        const citations: { slug: string; title: string }[] = [];
        let match: RegExpExecArray | null;
        while ((match = citationRegex.exec(responseText)) !== null) {
            const citedTitle = match[1].trim();
            const found = contextSections.find(s =>
                s.title.toLowerCase().includes(citedTitle.toLowerCase()) ||
                citedTitle.toLowerCase().includes(s.title.replace(/^Section \d+:\s*/, '').toLowerCase())
            );
            if (found && !citations.some(c => c.slug === found.slug)) {
                citations.push({ slug: found.slug, title: found.title });
            }
        }

        // Also add all context sections as potential sources
        const sources = contextSections.map(s => ({ slug: s.slug, title: s.title }));

        res.json({ response: responseText, citations, sources });
    } catch (error: any) {
        console.error('KB chat error:', error);
        res.status(500).json({ error: error.message || 'Chat failed' });
    }
});

export default router;
