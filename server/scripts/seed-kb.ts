/**
 * Seed Knowledge Base — imports the 15 Docusaurus markdown files
 * plus End Matter & Appendix C into kb_sections.
 *
 * Run: npx tsx server/scripts/seed-kb.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:wmh0PMUXgOrcGU9qvNFqZJX@localhost:5433/s2px';
const DOCS_ROOT = path.resolve(__dirname, '../../knowledge-base/docs');

// ── Markdown stripping (same logic as server/lib/markdownUtils.ts) ──
function stripMarkdown(md: string): string {
    return md
        .replace(/^---[\s\S]*?---\n*/m, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
        .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\|?-{3,}\|?/g, '')
        .replace(/\|/g, ' ')
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function countWords(md: string): number {
    return stripMarkdown(md).split(/\s+/).filter(w => w.length > 0).length;
}

function extractFrontmatter(content: string): { meta: Record<string, string>; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };
    const meta: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
        const kv = line.match(/^(\w+):\s*"?(.+?)"?\s*$/);
        if (kv) meta[kv[1]] = kv[2];
    }
    return { meta, body: match[2] };
}

// ── Section definitions (maps filesystem → metadata) ──
interface SectionDef {
    file: string;
    slug: string;
    title: string;
    emoji: string;
    partNumber: number | null;
    partTitle: string | null;
    sectionNumber: number | null;
    sortOrder: number;
}

const SECTIONS: SectionDef[] = [
    {
        file: 'intro.md',
        slug: 'overview',
        title: 'Overview',
        emoji: '📑',
        partNumber: null, partTitle: null, sectionNumber: null,
        sortOrder: 0,
    },
    {
        file: 'part-1-foundation/section-01-company-identity-positioning.md',
        slug: 'section-01-company-identity',
        title: 'Section 1: Company Identity & Positioning',
        emoji: '🏛️',
        partNumber: 1, partTitle: 'PART I: COMPANY FOUNDATION', sectionNumber: 1,
        sortOrder: 1,
    },
    {
        file: 'part-1-foundation/section-02-organization-team.md',
        slug: 'section-02-organization-team',
        title: 'Section 2: Organization & Team',
        emoji: '👥',
        partNumber: 1, partTitle: 'PART I: COMPANY FOUNDATION', sectionNumber: 2,
        sortOrder: 2,
    },
    // Section 3 (Financial Profile) excluded — contains sensitive financial data
    {
        file: 'part-2-sales/section-04-discovery-sales-process.md',
        slug: 'section-04-discovery-sales',
        title: 'Section 4: Discovery & Sales Process',
        emoji: '🔍',
        partNumber: 2, partTitle: 'PART II: SALES & GO-TO-MARKET', sectionNumber: 4,
        sortOrder: 3,
    },
    {
        file: 'part-2-sales/section-05-client-journey-project-execution.md',
        slug: 'section-05-client-journey',
        title: 'Section 5: Client Journey & Project Execution',
        emoji: '👣',
        partNumber: 2, partTitle: 'PART II: SALES & GO-TO-MARKET', sectionNumber: 5,
        sortOrder: 4,
    },
    {
        file: 'part-2-sales/section-06-buyer-personas.md',
        slug: 'section-06-buyer-personas',
        title: 'Section 6: Buyer Personas',
        emoji: '🎯',
        partNumber: 2, partTitle: 'PART II: SALES & GO-TO-MARKET', sectionNumber: 6,
        sortOrder: 5,
    },
    {
        file: 'part-3-technology/section-07-technology-operations-infrastructure.md',
        slug: 'section-07-technology-ops',
        title: 'Section 7: Technology & Operations Infrastructure',
        emoji: '⚙️',
        partNumber: 3, partTitle: 'PART III: TECHNOLOGY, STANDARDS & DELIVERY', sectionNumber: 7,
        sortOrder: 6,
    },
    {
        file: 'part-3-technology/section-08-standards-technical-framework.md',
        slug: 'section-08-standards',
        title: 'Section 8: Standards & Technical Framework',
        emoji: '📐',
        partNumber: 3, partTitle: 'PART III: TECHNOLOGY, STANDARDS & DELIVERY', sectionNumber: 8,
        sortOrder: 7,
    },
    {
        file: 'part-3-technology/section-09-services-deliverables-coverage.md',
        slug: 'section-09-services',
        title: 'Section 9: Services, Deliverables & Coverage',
        emoji: '📦',
        partNumber: 3, partTitle: 'PART III: TECHNOLOGY, STANDARDS & DELIVERY', sectionNumber: 9,
        sortOrder: 8,
    },
    // Section 10 (FY2026 Strategy) excluded — contains sensitive financial targets
    {
        file: 'part-4-strategy/section-11-competitive-landscape.md',
        slug: 'section-11-competitive',
        title: 'Section 11: Competitive Landscape',
        emoji: '🏁',
        partNumber: 4, partTitle: 'PART IV: STRATEGY & GROWTH', sectionNumber: 11,
        sortOrder: 9,
    },
    {
        file: 'part-4-strategy/section-12-content-brand-systems.md',
        slug: 'section-12-brand',
        title: 'Section 12: Content & Brand Systems',
        emoji: '🎨',
        partNumber: 4, partTitle: 'PART IV: STRATEGY & GROWTH', sectionNumber: 12,
        sortOrder: 10,
    },
    {
        file: 'part-5-operations/section-13-systems-architecture-operations.md',
        slug: 'section-13-systems',
        title: 'Section 13: Systems Architecture & Operations',
        emoji: '🗄️',
        partNumber: 5, partTitle: 'PART V: OPERATIONS & SYSTEMS', sectionNumber: 13,
        sortOrder: 11,
    },
    // Appendix B (Data Dictionary) excluded — contains cost model, rate cards, pricing multipliers
];

async function main() {
    const client = new Client({ connectionString: DB_URL, ssl: false });
    await client.connect();
    console.log('Connected to Cloud SQL');

    // Create table if not exists
    await client.query(`
        CREATE TABLE IF NOT EXISTS kb_sections (
            id SERIAL PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            emoji TEXT,
            part_number INTEGER,
            part_title TEXT,
            section_number INTEGER,
            sort_order INTEGER NOT NULL,
            content TEXT NOT NULL,
            content_plain TEXT NOT NULL,
            word_count INTEGER DEFAULT 0,
            edited_by TEXT,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS kb_edit_history (
            id SERIAL PRIMARY KEY,
            section_id INTEGER NOT NULL REFERENCES kb_sections(id) ON DELETE CASCADE,
            previous_content TEXT NOT NULL,
            new_content TEXT NOT NULL,
            edited_by TEXT NOT NULL,
            edit_summary TEXT,
            version INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
    `);

    // Create FTS index
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_fts
        ON kb_sections
        USING GIN (to_tsvector('english', content_plain))
    `);

    console.log('Tables + index created');

    // Clear existing data
    await client.query('DELETE FROM kb_edit_history');
    await client.query('DELETE FROM kb_sections');
    console.log('Cleared existing KB data');

    let imported = 0;

    for (const def of SECTIONS) {
        const filePath = path.join(DOCS_ROOT, def.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`  ⚠ Missing: ${def.file}`);
            continue;
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        const { body } = extractFrontmatter(raw);
        const content = body.trim();
        const plain = stripMarkdown(content);
        const words = countWords(content);

        await client.query(`
            INSERT INTO kb_sections (slug, title, emoji, part_number, part_title, section_number, sort_order, content, content_plain, word_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [def.slug, def.title, def.emoji, def.partNumber, def.partTitle, def.sectionNumber, def.sortOrder, content, plain, words]);

        console.log(`  ✓ ${def.emoji} ${def.title} (${words} words)`);
        imported++;
    }

    console.log(`\n=== Imported ${imported} sections ===`);

    // Show summary
    const result = await client.query('SELECT slug, title, word_count FROM kb_sections ORDER BY sort_order');
    let totalWords = 0;
    for (const row of result.rows) {
        totalWords += row.word_count;
    }
    console.log(`Total: ${totalWords} words across ${result.rows.length} sections`);

    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
