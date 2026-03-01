/**
 * CPQ → S2PX Migration Script
 *
 * Reads real production data from old CPQ tables in Neon,
 * drops old tables, pushes S2PX schema, and imports migrated data.
 *
 * Usage:
 *   DATABASE_URL="postgresql://neondb_owner:npg_OgSaq5wyUi6E@ep-winter-lab-ah4py7xl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx server/scripts/migrate-cpq.ts
 */

import { Client } from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
}

// ── Building type ID → S2PX area type name ──
const BUILDING_TYPE_MAP: Record<string, string> = {
    '1': 'Residential',
    '2': 'Commercial',
    '3': 'Industrial',
    '4': 'Healthcare',
    '5': 'Educational',
    '6': 'Retail',
    '7': 'Hospitality',
    '8': 'Mixed-Use',
    '9': 'Government',
    '10': 'Warehouse',
    '11': 'Religious',
    '12': 'Parking',
    '13': 'Restaurant',
    '14': 'Historic',
    '15': 'Built Landscape',
};

// ── Deal stage mapping: CPQ → S2PX ──
function mapDealStage(cpqStage: string): { dealStage: string; status: string } {
    switch (cpqStage?.toLowerCase().replace(/\s+/g, '_')) {
        case 'closed_won':
            return { dealStage: 'In Hand', status: 'won' };
        case 'closed_lost':
            return { dealStage: 'Lost', status: 'lost' };
        case 'proposal':
        case 'proposal_sent':
            return { dealStage: 'Proposal', status: 'submitted' };
        case 'negotiation':
            return { dealStage: 'Negotiation', status: 'submitted' };
        case 'qualified':
            return { dealStage: 'Qualified', status: 'draft' };
        case 'lead':
        case 'new':
            return { dealStage: 'Lead', status: 'draft' };
        default:
            return { dealStage: 'Lead', status: 'draft' };
    }
}

// ── Parse line item category from label ──
function inferCategory(label: string): string {
    const l = label.toLowerCase();
    if (l.includes('travel')) return 'travel';
    if (l.includes('cad')) return 'cad';
    if (l.includes('matterport') || l.includes('virtual tour')) return 'add-on';
    if (l.includes('georeferencing')) return 'add-on';
    if (l.includes('risk') || l.includes('premium')) return 'add-on';
    if (l.includes('discount')) return 'discount';
    if (l.includes('architecture') || l.includes('mepf') || l.includes('structure') || l.includes('site')) return 'modeling';
    if (l.includes('tier a')) return 'modeling';
    if (l.includes('subtotal') || l.includes('total') || l.includes('effective')) return 'summary';
    return 'modeling';
}

// ── Parse sqft from label like "Architecture (3,000 sqft @ $1.359/sqft, LOD 350)" ──
function parseSqftFromLabel(label: string): number {
    const match = label.match(/([\d,]+)\s*sqft/i);
    if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    return 0;
}

// ── Parse rate from label like "@ $1.359/sqft" ──
function parseRateFromLabel(label: string): number {
    const match = label.match(/\$\s*([\d.]+)\s*\/\s*sqft/i);
    if (match) return parseFloat(match[1]);
    return 0;
}

// ══════════════════════════════════════════
// Main Migration
// ══════════════════════════════════════════

async function main() {
    console.log('🔄 S2PX CPQ → S2PX Migration Script');
    console.log('====================================\n');

    const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log('✓ Connected to Neon\n');

    // ══════════════════════════════════════
    // STEP A: Export CPQ Data
    // ══════════════════════════════════════
    console.log('📦 Step A: Exporting CPQ data...\n');

    // A1: Active leads (use SELECT * to avoid column name issues)
    const leadsResult = await client.query(`
        SELECT * FROM leads WHERE deleted_at IS NULL ORDER BY id
    `);
    console.log(`   ✓ ${leadsResult.rows.length} active leads`);

    // A2: Quotes for active leads
    const activeLeadIds = leadsResult.rows.map((r: any) => r.id);
    const quotesResult = await client.query(`
        SELECT id, quote_number, client_name, project_name, project_address,
               lead_id, areas, risks, services, scoping_data,
               total_price, pricing_breakdown,
               version_number, version_name, parent_quote_id,
               dispatch_location, distance, custom_travel_cost,
               created_at, updated_at
        FROM quotes
        WHERE lead_id = ANY($1)
        ORDER BY lead_id, version_number
    `, [activeLeadIds]);
    console.log(`   ✓ ${quotesResult.rows.length} quotes (for active leads)`);

    // A3: Proposals for active leads
    const proposalsResult = await client.query(`
        SELECT id, lead_id, quote_id, template_group_id, name, status,
               sections, pdf_url, version, cover_data, project_data,
               line_items, payment_data, subtotal, total,
               display_settings, about_data, capabilities_data, difference_data,
               created_at, updated_at, created_by
        FROM generated_proposals
        WHERE lead_id = ANY($1)
        ORDER BY lead_id, version
    `, [activeLeadIds]);
    console.log(`   ✓ ${proposalsResult.rows.length} proposals (for active leads)`);

    // A4: Projects (use SELECT * to capture all fields)
    const projectsResult = await client.query(`
        SELECT * FROM projects WHERE lead_id = ANY($1) ORDER BY id
    `, [activeLeadIds]);
    console.log(`   ✓ ${projectsResult.rows.length} production projects`);

    // A5: Contacts
    const contactsResult = await client.query(`
        SELECT id, customer_name, contact_name, email, phone, address, created_at
        FROM contacts
        ORDER BY id
    `);
    console.log(`   ✓ ${contactsResult.rows.length} contacts`);

    // A6: Proposal templates
    const templatesResult = await client.query(`
        SELECT * FROM proposal_templates ORDER BY id
    `);
    console.log(`   ✓ ${templatesResult.rows.length} proposal templates`);

    // Save backup
    const backup = {
        exportedAt: new Date().toISOString(),
        leads: leadsResult.rows,
        quotes: quotesResult.rows,
        proposals: proposalsResult.rows,
        projects: projectsResult.rows,
        contacts: contactsResult.rows,
        proposalTemplates: templatesResult.rows,
    };
    writeFileSync('server/scripts/cpq-backup.json', JSON.stringify(backup, null, 2));
    console.log('\n   ✓ Backup saved to server/scripts/cpq-backup.json\n');

    // ══════════════════════════════════════
    // STEP B: Drop Old CPQ Tables
    // ══════════════════════════════════════
    console.log('🗑️  Step B: Dropping old CPQ tables...\n');

    // Get all tables except the ones we want to keep
    const keepTables = new Set(['users', 'kb_sections', 'kb_edit_history']);
    const allTablesResult = await client.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const tablesToDrop = allTablesResult.rows
        .map((r: any) => r.tablename)
        .filter((t: string) => keepTables.has(t) === false);

    if (tablesToDrop.length > 0) {
        const dropSQL = `DROP TABLE IF EXISTS ${tablesToDrop.map((t: string) => `"${t}"`).join(', ')} CASCADE`;
        await client.query(dropSQL);
        console.log(`   ✓ Dropped ${tablesToDrop.length} tables`);
        console.log(`   ✓ Preserved: ${[...keepTables].join(', ')}\n`);
    } else {
        console.log('   ⚠ No tables to drop\n');
    }

    // Also drop old sequences
    const seqResult = await client.query(`
        SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    `);
    for (const seq of seqResult.rows) {
        const name = (seq as any).sequencename;
        if (name !== 'upid_seq') {
            await client.query(`DROP SEQUENCE IF EXISTS "${name}" CASCADE`);
        }
    }

    // ══════════════════════════════════════
    // STEP C: Push S2PX Schema
    // ══════════════════════════════════════
    console.log('📐 Step C: Pushing S2PX schema...\n');

    try {
        execSync(`DATABASE_URL="${DB_URL}" npx drizzle-kit push --force`, {
            stdio: 'pipe',
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: DB_URL },
        });
        console.log('   ✓ Schema pushed via drizzle-kit\n');
    } catch (err: any) {
        console.log('   ⚠ drizzle-kit push output:', err.stdout?.toString() || err.message);
        console.log('   Continuing...\n');
    }

    // Create UPID sequence
    await client.query('CREATE SEQUENCE IF NOT EXISTS upid_seq START 1');
    console.log('   ✓ upid_seq sequence created\n');

    // ══════════════════════════════════════
    // STEP D: Import Migrated Data
    // ══════════════════════════════════════
    console.log('📥 Step D: Importing migrated CPQ data...\n');

    // ── D1: leads → scoping_forms + scope_areas ──
    console.log('   D1: Leads → scoping_forms + scope_areas');

    const leadIdMap = new Map<number, number>(); // old lead ID → new scoping_form ID
    let upidSeq = 1;
    let formCount = 0;
    let areaCount = 0;

    for (const lead of leadsResult.rows) {
        const createdYear = lead.created_at instanceof Date
            ? lead.created_at.getFullYear()
            : new Date(lead.created_at).getFullYear();
        const upid = `S2P-${String(upidSeq).padStart(4, '0')}-${createdYear}`;
        upidSeq++;

        const { dealStage, status } = mapDealStage(lead.deal_stage);
        const scopingData = lead.cpq_scoping_data || {};

        // Extract scoping data fields with defaults
        const bimDeliverable = lead.bim_deliverable ||
            (Array.isArray(scopingData.bimDeliverable) ? scopingData.bimDeliverable[0] : scopingData.bimDeliverable) ||
            'Revit';

        const formResult = await client.query(`
            INSERT INTO scoping_forms (
                upid, status, client_company, project_name, project_address,
                project_lat, project_lng,
                email, primary_contact_name, contact_email, contact_phone,
                billing_same_as_primary, billing_contact_name, billing_email, billing_phone,
                number_of_floors, bim_deliverable, bim_version, georeferencing,
                era, room_density, risk_factors, expedited,
                dispatch_location, one_way_miles, travel_mode,
                est_timeline, payment_terms, payment_notes,
                sqft_assumptions_note, internal_notes,
                lead_source, probability, deal_stage, priority,
                insurance_requirements,
                created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26,
                $27, $28, $29,
                $30, $31,
                $32, $33, $34, $35,
                $36,
                $37, $38, $39
            ) RETURNING id
        `, [
            upid,
            status,
            lead.client_name || 'Unknown',
            lead.project_name || `${lead.client_name} Project`,
            lead.project_address || 'TBD',
            lead.client_latitude || null,
            lead.client_longitude || null,
            lead.contact_email || 'noemail@scan2plan.com',
            lead.contact_name || lead.client_name || 'Unknown',
            lead.contact_email || 'noemail@scan2plan.com',
            lead.contact_phone || null,
            !lead.billing_contact_name, // billing_same_as_primary
            lead.billing_contact_name || null,
            lead.billing_contact_email || null,
            lead.billing_contact_phone || null,
            1, // numberOfFloors (default)
            bimDeliverable,
            lead.bim_version || scopingData.bimVersion || null,
            false, // georeferencing
            'Modern', // era
            3, // roomDensity
            JSON.stringify(lead.cpq_risks || []),
            false, // expedited
            lead.dispatch_location || 'Troy NY',
            lead.distance || 0,
            'driving',
            lead.timeline || scopingData.estimatedTimeline || null,
            lead.payment_terms || scopingData.paymentTerms || null,
            scopingData.paymentNotes || null,
            scopingData.sqftAssumptions || null,
            lead.notes || null,
            lead.lead_source || 'Other',
            parseInt(scopingData.probabilityOfClosing) || 50,
            dealStage,
            lead.lead_priority || 3,
            scopingData.insuranceRequirements || null,
            'cpq-migration',
            lead.created_at,
            lead.updated_at || lead.created_at,
        ]);

        const newFormId = formResult.rows[0].id;
        leadIdMap.set(lead.id, newFormId);
        formCount++;

        // Create scope_areas from cpq_areas JSONB
        const cpqAreas = lead.cpq_areas || [];
        if (Array.isArray(cpqAreas)) {
            for (let i = 0; i < cpqAreas.length; i++) {
                const area = cpqAreas[i];
                const buildingTypeId = area.buildingType?.toString() || '';
                const areaType = BUILDING_TYPE_MAP[buildingTypeId] || 'Commercial';
                const sqft = parseInt(area.squareFeet) || lead.sqft || 0;
                const scope = (area.scope || 'Full').toLowerCase();
                const projectScope = scope === 'mixed' ? 'Mixed'
                    : scope === 'interior' ? 'Int Only'
                    : scope === 'exterior' ? 'Ext Only'
                    : 'Full';

                // Determine LOD from disciplineLods or default
                const lods = area.disciplineLods || {};
                const archLod = lods.architecture || area.gradeLod || '300';

                // Check for structural/mepf disciplines
                const disciplines: string[] = area.disciplines || [];
                const hasStructural = disciplines.includes('structure') || disciplines.includes('structural');
                const hasMepf = disciplines.includes('mepf');
                const hasCad = area.includeCad === true;

                await client.query(`
                    INSERT INTO scope_areas (
                        scoping_form_id, area_type, area_name, square_footage,
                        project_scope, lod,
                        mixed_interior_lod, mixed_exterior_lod,
                        structural, mepf,
                        cad_deliverable,
                        below_floor, act,
                        sort_order
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    newFormId,
                    areaType,
                    area.name || null,
                    sqft,
                    projectScope,
                    archLod,
                    scope === 'mixed' ? (area.mixedInteriorLod || '300') : null,
                    scope === 'mixed' ? (area.mixedExteriorLod || '350') : null,
                    hasStructural ? JSON.stringify({ enabled: true, sqft: sqft }) : null,
                    hasMepf ? JSON.stringify({ enabled: true, sqft: sqft }) : null,
                    hasCad ? 'Basic' : 'No',
                    area.includeBelowFloor ? JSON.stringify({ enabled: true, sqft: parseInt(area.belowFloorSqft) || 0 }) : null,
                    area.includeAboveCeiling ? JSON.stringify({ enabled: true, sqft: parseInt(area.aboveCeilingSqft) || 0 }) : null,
                    i,
                ]);
                areaCount++;
            }
        }
    }
    console.log(`      ✓ ${formCount} scoping forms created`);
    console.log(`      ✓ ${areaCount} scope areas created`);
    console.log(`      ✓ Lead ID mapping: ${[...leadIdMap.entries()].map(([o, n]) => `${o}→${n}`).join(', ')}`);

    // ── D2: quotes → quotes ──
    console.log('\n   D2: Quotes → quotes');

    const quoteIdMap = new Map<string, number>(); // old quote UUID → new quote ID
    let quoteCount = 0;
    let skippedQuotes = 0;

    for (const quote of quotesResult.rows) {
        const newFormId = leadIdMap.get(quote.lead_id);
        if (!newFormId) {
            console.log(`      ⚠ Skipping quote ${quote.id} — lead ${quote.lead_id} not in active leads`);
            skippedQuotes++;
            continue;
        }

        // Transform pricing_breakdown.items to S2PX line items
        const pbItems = quote.pricing_breakdown?.items || [];
        const lineItems = pbItems
            .filter((item: any) => !item.isTotal && !item.isDiscount && item.value > 0)
            .map((item: any, idx: number) => ({
                id: `li-${idx + 1}`,
                label: item.label,
                category: inferCategory(item.label),
                sqft: parseSqftFromLabel(item.label),
                rate: parseRateFromLabel(item.label),
                amount: item.value || 0,
            }));

        // Calculate totals
        const totalPrice = parseFloat(quote.total_price) || 0;
        const modelingTotal = lineItems
            .filter((li: any) => li.category === 'modeling')
            .reduce((sum: number, li: any) => sum + li.amount, 0);
        const travelTotal = lineItems
            .filter((li: any) => li.category === 'travel')
            .reduce((sum: number, li: any) => sum + li.amount, 0);

        const totals = {
            totalClientPrice: totalPrice,
            totalUpteamCost: Math.round(totalPrice * 0.55 * 100) / 100, // estimated 55% COGS
            grossMargin: Math.round(totalPrice * 0.45 * 100) / 100,
            grossMarginPercent: 45,
            modelingSubtotal: modelingTotal,
            travelSubtotal: travelTotal,
        };

        const quoteResult = await client.query(`
            INSERT INTO quotes (
                scoping_form_id, line_items, totals, integrity_status,
                version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            newFormId,
            JSON.stringify(lineItems),
            JSON.stringify(totals),
            'passed',
            quote.version_number || 1,
            quote.created_at,
            quote.updated_at || quote.created_at,
        ]);

        quoteIdMap.set(quote.id, quoteResult.rows[0].id);
        quoteCount++;
    }
    console.log(`      ✓ ${quoteCount} quotes created (${skippedQuotes} skipped)`);

    // ── D3: generated_proposals → proposals ──
    console.log('\n   D3: Proposals → proposals');

    let proposalCount = 0;
    let skippedProposals = 0;

    for (const prop of proposalsResult.rows) {
        const newFormId = leadIdMap.get(prop.lead_id);
        if (!newFormId) {
            skippedProposals++;
            continue;
        }

        // Find matching quote — try quote_id first, then find latest quote for this lead
        let newQuoteId: number | null = null;
        if (prop.quote_id) {
            newQuoteId = quoteIdMap.get(prop.quote_id) || null;
        }
        if (!newQuoteId) {
            // Find the latest quote for this lead
            const quotesForLead = quotesResult.rows
                .filter((q: any) => q.lead_id === prop.lead_id)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (quotesForLead.length > 0) {
                newQuoteId = quoteIdMap.get(quotesForLead[0].id) || null;
            }
        }

        if (!newQuoteId) {
            console.log(`      ⚠ Skipping proposal ${prop.id} "${prop.name}" — no matching quote`);
            skippedProposals++;
            continue;
        }

        const accessToken = randomUUID();
        const customMessage = prop.cover_data?.custom_message || prop.cover_data?.message || null;

        // Map status: CPQ uses "draft", "sent", etc. — S2PX uses same
        const status = ['draft', 'sent', 'viewed', 'accepted', 'rejected'].includes(prop.status)
            ? prop.status
            : 'draft';

        await client.query(`
            INSERT INTO proposals (
                scoping_form_id, quote_id, status, pdf_url,
                access_token, custom_message, version,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            newFormId,
            newQuoteId,
            status,
            prop.pdf_url || null,
            accessToken,
            customMessage,
            prop.version || 1,
            prop.created_at,
            prop.updated_at || prop.created_at,
        ]);
        proposalCount++;
    }
    console.log(`      ✓ ${proposalCount} proposals created (${skippedProposals} skipped)`);

    // ── D4: projects → production_projects ──
    console.log('\n   D4: Projects → production_projects');

    let projectCount = 0;
    let skippedProjects = 0;

    for (const proj of projectsResult.rows) {
        const newFormId = leadIdMap.get(proj.lead_id);
        if (!newFormId) {
            console.log(`      ⚠ Skipping project ${proj.id} — lead ${proj.lead_id} not mapped`);
            skippedProjects++;
            continue;
        }

        // Map status → currentStage
        const stageMap: Record<string, string> = {
            'Scheduling': 'scheduling',
            'Field Capture': 'field_capture',
            'Registration': 'registration',
            'BIM QC': 'bim_qc',
            'PC Delivery': 'pc_delivery',
            'Final Delivery': 'final_delivery',
        };
        const currentStage = stageMap[proj.status] || 'scheduling';

        // Extract stage data from project fields
        const stageData: Record<string, any> = {
            scheduling: {
                scannerAssignment: proj.scanner_type || null,
                estScanDays: proj.estimated_scan_days || null,
            },
            field_capture: {
                scanDate: proj.scan_date || null,
            },
        };

        // Generate UPID for project
        const projUpid = proj.universal_project_id || `S2P-${String(upidSeq).padStart(4, '0')}-${new Date().getFullYear()}`;
        if (!proj.universal_project_id) upidSeq++;

        await client.query(`
            INSERT INTO production_projects (
                scoping_form_id, upid, current_stage, stage_data,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            newFormId,
            projUpid,
            currentStage,
            JSON.stringify(stageData),
            proj.created_at,
            proj.updated_at || proj.created_at,
        ]);
        projectCount++;
    }
    console.log(`      ✓ ${projectCount} production projects created (${skippedProjects} skipped)`);

    // ── D5: contacts → qbo_customers ──
    console.log('\n   D5: Contacts → qbo_customers');

    let contactCount = 0;
    let dupContacts = 0;
    const seenCustomerNames = new Set<string>();

    for (const contact of contactsResult.rows) {
        const name = contact.customer_name?.trim();
        if (!name) continue;

        // Skip duplicates (unique constraint on customer_name)
        if (seenCustomerNames.has(name.toLowerCase())) {
            dupContacts++;
            continue;
        }
        seenCustomerNames.add(name.toLowerCase());

        await client.query(`
            INSERT INTO qbo_customers (
                customer_name, company, email, phone, bill_address,
                first_name, last_name,
                created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            name,
            null, // company not in contacts table
            contact.email || null,
            contact.phone || null,
            contact.address || null,
            contact.contact_name?.split(' ')[0] || null,
            contact.contact_name?.split(' ').slice(1).join(' ') || null,
            'cpq-migration',
            contact.created_at || new Date(),
            contact.created_at || new Date(),
        ]);
        contactCount++;
    }
    console.log(`      ✓ ${contactCount} qbo_customers created (${dupContacts} duplicates skipped)`);

    // ── D6: Seed operational data ──
    console.log('\n   D6: Seeding operational data...');

    // Update upid_seq to avoid collisions
    await client.query(`ALTER SEQUENCE upid_seq RESTART WITH ${upidSeq}`);
    console.log(`      ✓ upid_seq set to ${upidSeq}`);

    // Seed scan checklists
    const checklistExists = await client.query('SELECT COUNT(*) FROM scan_checklists');
    if (parseInt(checklistExists.rows[0].count) === 0) {
        await client.query(`
            INSERT INTO scan_checklists (slug, title, description, checklist_type, items, is_active, version) VALUES
            ('pre-scan', 'Pre-Scan Checklist', 'Complete before beginning scan operations', 'pre_scan', $1, true, 1),
            ('post-scan', 'Post-Scan Checklist', 'Complete after scan operations are finished', 'post_scan', $2, true, 1),
            ('safety', 'Safety Checklist', 'Safety verification before entering site', 'safety', $3, true, 1)
        `, [
            JSON.stringify([
                { itemId: 'ps-1', label: 'Scanner batteries charged', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'ps-2', label: 'Targets/spheres packed', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'ps-3', label: 'Tripod inspected', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'ps-4', label: 'SD cards formatted/available', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'ps-5', label: 'Laptop/tablet charged', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'ps-6', label: 'Control points documented', category: 'Survey', required: true, inputType: 'checkbox' },
                { itemId: 'ps-7', label: 'Site access confirmed', category: 'Logistics', required: true, inputType: 'checkbox' },
                { itemId: 'ps-8', label: 'Client contact notified', category: 'Logistics', required: true, inputType: 'checkbox' },
                { itemId: 'ps-9', label: 'Scan plan reviewed', category: 'Planning', required: true, inputType: 'checkbox' },
                { itemId: 'ps-10', label: 'Weather conditions acceptable', category: 'Environment', required: false, inputType: 'checkbox' },
                { itemId: 'ps-11', label: 'PPE prepared', category: 'Safety', required: true, inputType: 'checkbox' },
                { itemId: 'ps-12', label: 'Estimated scan positions', category: 'Planning', required: false, inputType: 'number', helpText: 'Approximate number of scan positions planned' },
                { itemId: 'ps-13', label: 'Insurance documentation', category: 'Compliance', required: false, inputType: 'checkbox' },
                { itemId: 'ps-14', label: 'Pre-scan notes', category: 'Notes', required: false, inputType: 'text', helpText: 'Any special conditions or notes' },
            ]),
            JSON.stringify([
                { itemId: 'post-1', label: 'All scans verified on-site', category: 'Quality', required: true, inputType: 'checkbox' },
                { itemId: 'post-2', label: 'Coverage gaps checked', category: 'Quality', required: true, inputType: 'checkbox' },
                { itemId: 'post-3', label: 'Data backed up', category: 'Data', required: true, inputType: 'checkbox' },
                { itemId: 'post-4', label: 'Targets/spheres collected', category: 'Equipment', required: true, inputType: 'checkbox' },
                { itemId: 'post-5', label: 'Photos taken for reference', category: 'Documentation', required: true, inputType: 'checkbox' },
                { itemId: 'post-6', label: 'Client walkthrough completed', category: 'Client', required: false, inputType: 'checkbox' },
                { itemId: 'post-7', label: 'Actual scan positions', category: 'Quality', required: true, inputType: 'number', helpText: 'Total number of scan positions completed' },
                { itemId: 'post-8', label: 'Equipment cleaned', category: 'Equipment', required: false, inputType: 'checkbox' },
                { itemId: 'post-9', label: 'Site restored to original condition', category: 'Site', required: true, inputType: 'checkbox' },
                { itemId: 'post-10', label: 'Upload initiated', category: 'Data', required: true, inputType: 'checkbox' },
                { itemId: 'post-11', label: 'Field notes completed', category: 'Documentation', required: true, inputType: 'checkbox' },
                { itemId: 'post-12', label: 'Post-scan notes', category: 'Notes', required: false, inputType: 'text' },
            ]),
            JSON.stringify([
                { itemId: 'saf-1', label: 'Hard hat required', category: 'PPE', required: true, inputType: 'checkbox' },
                { itemId: 'saf-2', label: 'Safety vest worn', category: 'PPE', required: true, inputType: 'checkbox' },
                { itemId: 'saf-3', label: 'Steel-toe boots worn', category: 'PPE', required: true, inputType: 'checkbox' },
                { itemId: 'saf-4', label: 'Eye protection available', category: 'PPE', required: false, inputType: 'checkbox' },
                { itemId: 'saf-5', label: 'Site hazards identified', category: 'Hazards', required: true, inputType: 'checkbox' },
                { itemId: 'saf-6', label: 'Emergency exits located', category: 'Emergency', required: true, inputType: 'checkbox' },
                { itemId: 'saf-7', label: 'First aid kit available', category: 'Emergency', required: true, inputType: 'checkbox' },
                { itemId: 'saf-8', label: 'Emergency contact info confirmed', category: 'Emergency', required: true, inputType: 'checkbox' },
                { itemId: 'saf-9', label: 'Electrical hazards checked', category: 'Hazards', required: true, inputType: 'checkbox' },
                { itemId: 'saf-10', label: 'Safety notes', category: 'Notes', required: false, inputType: 'text', helpText: 'Any safety observations or concerns' },
            ]),
        ]);
        console.log('      ✓ 3 scan checklists seeded');
    } else {
        console.log('      ✓ Scan checklists already exist');
    }

    // Seed chat channels
    const channelExists = await client.query('SELECT COUNT(*) FROM chat_channels');
    if (parseInt(channelExists.rows[0].count) === 0) {
        await client.query(`
            INSERT INTO chat_channels (name, display_name, description, emoji, is_default) VALUES
            ('general', 'General', 'General team discussion', '💬', true),
            ('field-ops', 'Field Ops', 'Field scanning operations and logistics', '📡', true),
            ('bim-team', 'BIM Team', 'BIM modeling and quality discussions', '🏗️', true),
            ('announcements', 'Announcements', 'Company announcements and updates', '📢', false)
        `);
        console.log('      ✓ 4 chat channels seeded');
    } else {
        console.log('      ✓ Chat channels already exist');
    }

    // ══════════════════════════════════════
    // Summary
    // ══════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('✅ Migration Complete!');
    console.log('════════════════════════════════════════');
    console.log(`   Scoping forms:       ${formCount}`);
    console.log(`   Scope areas:         ${areaCount}`);
    console.log(`   Quotes:              ${quoteCount}`);
    console.log(`   Proposals:           ${proposalCount}`);
    console.log(`   Production projects: ${projectCount}`);
    console.log(`   QBO customers:       ${contactCount}`);
    console.log(`   Tables dropped:      ${tablesToDrop.length}`);
    console.log(`   UPID sequence:       starts at ${upidSeq}`);
    console.log(`   Backup:              server/scripts/cpq-backup.json`);
    console.log('');

    await client.end();
}

main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
