// ── Seed Scantech Checklists ──
// Run: npx tsx server/scripts/seed-checklists.ts
// Seeds 3 checklist templates: Pre-Scan, Post-Scan, Safety

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { scanChecklists } from '../../shared/schema/db.js';
import type { ChecklistItemDef } from '../../shared/types/scantech.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Pre-Scan Checklist (14 items) ──

const preScanItems: ChecklistItemDef[] = [
    // Equipment
    { itemId: 'PRE-01', label: 'Scanner batteries fully charged', category: 'Equipment', required: true, inputType: 'checkbox' },
    { itemId: 'PRE-02', label: 'Spare batteries packed', category: 'Equipment', required: false, inputType: 'checkbox' },
    { itemId: 'PRE-03', label: 'Tripod in good condition', category: 'Equipment', required: true, inputType: 'checkbox' },
    { itemId: 'PRE-04', label: 'Scanner firmware up to date', category: 'Equipment', required: false, inputType: 'checkbox', helpText: 'Check manufacturer portal for updates' },
    { itemId: 'PRE-05', label: 'SD cards / storage media ready', category: 'Equipment', required: true, inputType: 'checkbox' },
    { itemId: 'PRE-06', label: 'Target spheres / checkerboards packed', category: 'Equipment', required: true, inputType: 'checkbox' },
    // Safety
    { itemId: 'PRE-07', label: 'PPE available (hard hat, vest, safety glasses)', category: 'Safety', required: true, inputType: 'checkbox' },
    { itemId: 'PRE-08', label: 'First aid kit in vehicle', category: 'Safety', required: false, inputType: 'checkbox' },
    // Site Prep
    { itemId: 'PRE-09', label: 'Site contact confirmed', category: 'Site Prep', required: true, inputType: 'checkbox', helpText: 'Call or text site contact before departing' },
    { itemId: 'PRE-10', label: 'Access instructions reviewed', category: 'Site Prep', required: true, inputType: 'checkbox' },
    { itemId: 'PRE-11', label: 'Building plans / scoping doc reviewed', category: 'Site Prep', required: false, inputType: 'checkbox' },
    { itemId: 'PRE-12', label: 'Weather check (outdoor work)', category: 'Site Prep', required: false, inputType: 'checkbox' },
    // Vehicle
    { itemId: 'PRE-13', label: 'Vehicle fueled', category: 'Vehicle', required: false, inputType: 'checkbox' },
    { itemId: 'PRE-14', label: 'Navigation route confirmed', category: 'Vehicle', required: false, inputType: 'checkbox' },
];

// ── Post-Scan Checklist (12 items) ──

const postScanItems: ChecklistItemDef[] = [
    // Data Quality
    { itemId: 'POST-01', label: 'All scan positions captured per scope', category: 'Data Quality', required: true, inputType: 'checkbox' },
    { itemId: 'POST-02', label: 'Registration quality verified', category: 'Data Quality', required: true, inputType: 'checkbox', helpText: 'Check overlap and alignment in field software' },
    { itemId: 'POST-03', label: 'Total scan positions count', category: 'Data Quality', required: true, inputType: 'number' },
    { itemId: 'POST-04', label: 'Coverage photos taken', category: 'Data Quality', required: true, inputType: 'checkbox' },
    { itemId: 'POST-05', label: 'Target placement documented', category: 'Data Quality', required: false, inputType: 'checkbox' },
    // Coverage
    { itemId: 'POST-06', label: 'All rooms / areas scanned', category: 'Coverage', required: true, inputType: 'checkbox' },
    { itemId: 'POST-07', label: 'Exterior captured (if in scope)', category: 'Coverage', required: false, inputType: 'checkbox' },
    { itemId: 'POST-08', label: 'MEP above ceiling captured', category: 'Coverage', required: false, inputType: 'checkbox', helpText: 'If accessible ceiling tiles present' },
    // Closeout
    { itemId: 'POST-09', label: 'Site contact signed off', category: 'Closeout', required: true, inputType: 'checkbox' },
    { itemId: 'POST-10', label: 'Equipment packed and accounted for', category: 'Closeout', required: true, inputType: 'checkbox' },
    { itemId: 'POST-11', label: 'Data transferred to upload drive', category: 'Data Transfer', required: true, inputType: 'checkbox' },
    { itemId: 'POST-12', label: 'Field notes entered', category: 'Data Transfer', required: false, inputType: 'checkbox' },
];

// ── Safety Checklist (10 items) ──

const safetyItems: ChecklistItemDef[] = [
    // PPE
    { itemId: 'SAF-01', label: 'Hard hat worn', category: 'PPE', required: true, inputType: 'checkbox' },
    { itemId: 'SAF-02', label: 'Safety vest worn', category: 'PPE', required: true, inputType: 'checkbox' },
    { itemId: 'SAF-03', label: 'Safety glasses / eye protection', category: 'PPE', required: true, inputType: 'checkbox' },
    { itemId: 'SAF-04', label: 'Steel-toe boots worn', category: 'PPE', required: false, inputType: 'checkbox' },
    // Site Hazards
    { itemId: 'SAF-05', label: 'Site hazards identified', category: 'Site Hazards', required: true, inputType: 'checkbox', helpText: 'Open holes, falling objects, electrical, etc.' },
    { itemId: 'SAF-06', label: 'Hazard details noted', category: 'Site Hazards', required: false, inputType: 'text' },
    { itemId: 'SAF-07', label: 'Work area clear of obstructions', category: 'Site Hazards', required: false, inputType: 'checkbox' },
    // Emergency
    { itemId: 'SAF-08', label: 'Emergency exits located', category: 'Emergency', required: true, inputType: 'checkbox' },
    { itemId: 'SAF-09', label: 'Emergency contact number available', category: 'Emergency', required: true, inputType: 'checkbox' },
    { itemId: 'SAF-10', label: 'Incident reporting procedure understood', category: 'Emergency', required: false, inputType: 'checkbox' },
];

// ── Seed ──

async function seed() {
    console.log('[seed] Seeding Scantech checklists…');

    const templates = [
        {
            slug: 'pre-scan',
            title: 'Pre-Scan Checklist',
            description: 'Equipment, safety, and site preparation checks before scanning begins.',
            checklistType: 'pre_scan',
            items: preScanItems,
        },
        {
            slug: 'post-scan',
            title: 'Post-Scan Checklist',
            description: 'Data quality, coverage verification, and site closeout after scanning.',
            checklistType: 'post_scan',
            items: postScanItems,
        },
        {
            slug: 'safety',
            title: 'Safety Checklist',
            description: 'Personal protective equipment and site safety verification.',
            checklistType: 'safety',
            items: safetyItems,
        },
    ];

    for (const t of templates) {
        // Upsert: delete existing + insert fresh (simple for seed)
        await db.delete(scanChecklists).where(
            eq(scanChecklists.slug, t.slug)
        );

        await db.insert(scanChecklists).values({
            slug: t.slug,
            title: t.title,
            description: t.description,
            checklistType: t.checklistType,
            items: t.items,
            isActive: true,
            version: 1,
        });

        console.log(`  ✓ ${t.title} (${t.items.length} items)`);
    }

    console.log('[seed] Done — 3 checklists seeded.');
    await pool.end();
}

seed().catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
});
