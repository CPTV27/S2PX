/**
 * Firestore → Docusaurus Sync Script
 *
 * Fetches wiki_pages from Firestore and writes them as markdown files
 * in docs/wiki/. Run before `docusaurus build` to include live wiki content.
 *
 * Usage:
 *   npx tsx scripts/sync-firestore.ts
 *
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
 *   - OR a service-account.json file in the knowledge-base/ directory
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const WIKI_DIR = join(__dirname, '..', 'docs', 'wiki');
const COLLECTION = 'wiki_pages';

async function main() {
    // Initialize Firebase Admin
    let credential;
    const saPath = join(__dirname, '..', 'service-account.json');

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use env var (standard for CI/CD)
        credential = cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as unknown as ServiceAccount);
    } else if (existsSync(saPath)) {
        // Use local service account file
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sa = require(saPath);
        credential = cert(sa);
    } else {
        console.error('❌ No Firebase credentials found.');
        console.error('   Set GOOGLE_APPLICATION_CREDENTIALS or place service-account.json in knowledge-base/');
        process.exit(1);
    }

    initializeApp({ credential });
    const db = getFirestore();

    console.log(`📖 Fetching ${COLLECTION} from Firestore...`);
    const snapshot = await db.collection(COLLECTION).get();

    if (snapshot.empty) {
        console.log('⚠️  No wiki pages found in Firestore. Skipping sync.');
        return;
    }

    console.log(`   Found ${snapshot.size} pages.`);

    // Ensure wiki directory exists
    mkdirSync(WIKI_DIR, { recursive: true });

    // Track which files we write (for cleanup)
    const writtenFiles = new Set<string>();

    // Write category metadata
    const categoryJson = {
        label: 'Wiki',
        position: 20,
        link: { type: 'generated-index', description: 'Wiki pages synced from Firestore.' },
    };
    const categoryPath = join(WIKI_DIR, '_category_.json');
    writeFileSync(categoryPath, JSON.stringify(categoryJson, null, 2));
    writtenFiles.add('_category_.json');

    // Write each page as a markdown file
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const slug = doc.id;
        const title = data.title || slug;
        const content = data.content || '';
        const category = data.category || '';
        const tags = data.tags || [];

        const frontmatter = [
            '---',
            `title: "${title.replace(/"/g, '\\"')}"`,
            category ? `description: "Category: ${category}"` : '',
            tags.length > 0 ? `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]` : '',
            '---',
            '',
        ].filter(Boolean).join('\n');

        const markdown = `${frontmatter}\n${content}\n`;
        const filename = `${slug}.md`;
        const filepath = join(WIKI_DIR, filename);

        writeFileSync(filepath, markdown);
        writtenFiles.add(filename);
        console.log(`   ✅ ${filename} (${title})`);
    }

    // Clean up stale files (pages removed from Firestore)
    if (existsSync(WIKI_DIR)) {
        const existing = readdirSync(WIKI_DIR);
        for (const file of existing) {
            if (!writtenFiles.has(file)) {
                unlinkSync(join(WIKI_DIR, file));
                console.log(`   🗑️  Removed stale: ${file}`);
            }
        }
    }

    console.log(`\n✨ Synced ${snapshot.size} wiki pages to ${WIKI_DIR}`);
}

main().catch((err) => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
