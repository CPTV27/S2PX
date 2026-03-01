// ── Seed Pricing Config ──
// Inserts DEFAULT_PRICING_CONFIG into the pricing_config table if empty.

import { db } from '../db.js';
import { pricingConfig } from '../../shared/schema/db.js';
import { DEFAULT_PRICING_CONFIG } from '../../shared/types/pricingConfig.js';

async function seed() {
    const existing = await db.select().from(pricingConfig).limit(1);
    if (existing.length > 0) {
        console.log('Pricing config already exists (id:', existing[0].id, '), skipping seed');
        process.exit(0);
    }
    const [row] = await db.insert(pricingConfig).values({
        config: DEFAULT_PRICING_CONFIG as any,
        updatedBy: 'system-seed',
    }).returning();
    console.log('Seeded pricing config, id:', row.id);
    process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
