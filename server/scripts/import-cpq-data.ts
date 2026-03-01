/**
 * Import CPQ data from backup JSON into clean S2PX schema.
 *
 * Prerequisites:
 *   - S2PX schema already pushed to Neon (all 25 tables exist, empty)
 *   - cpq-backup.json exists from prior export
 *
 * Usage:
 *   DATABASE_URL="postgresql://neondb_owner:npg_OgSaq5wyUi6E@ep-winter-lab-ah4py7xl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx server/scripts/import-cpq-data.ts
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
}

// ── Building type ID → S2PX area type name ──
const BUILDING_TYPE_MAP: Record<string, string> = {
    '1': 'Residential', '2': 'Commercial', '3': 'Industrial',
    '4': 'Healthcare', '5': 'Educational', '6': 'Retail',
    '7': 'Hospitality', '8': 'Mixed-Use', '9': 'Government',
    '10': 'Warehouse', '11': 'Religious', '12': 'Parking',
    '13': 'Restaurant', '14': 'Historic', '15': 'Built Landscape',
};

function mapDealStage(cpqStage: string): { dealStage: string; status: string } {
    switch (cpqStage?.toLowerCase().replace(/\s+/g, '_')) {
        case 'closed_won': return { dealStage: 'In Hand', status: 'won' };
        case 'closed_lost': return { dealStage: 'Lost', status: 'lost' };
        case 'proposal': case 'proposal_sent': return { dealStage: 'Proposal', status: 'submitted' };
        case 'negotiation': return { dealStage: 'Negotiation', status: 'submitted' };
        case 'qualified': return { dealStage: 'Qualified', status: 'draft' };
        case 'lead': case 'new': return { dealStage: 'Lead', status: 'draft' };
        default: return { dealStage: 'Lead', status: 'draft' };
    }
}

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

function parseSqftFromLabel(label: string): number {
    const match = label.match(/([\d,]+)\s*sqft/i);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
}

function parseRateFromLabel(label: string): number {
    const match = label.match(/\$\s*([\d.]+)\s*\/\s*sqft/i);
    return match ? parseFloat(match[1]) : 0;
}

// ══════════════════════════════════════════
// Main Import
// ══════════════════════════════════════════

async function main() {
    console.log('📥 S2PX CPQ Data Import (from backup)');
    console.log('======================================\n');

    // Load backup
    const backupRaw = readFileSync('server/scripts/cpq-backup.json', 'utf-8');
    const backup = JSON.parse(backupRaw);
    console.log(`✓ Loaded backup from ${backup.exportedAt}`);
    console.log(`  ${backup.leads.length} leads, ${backup.quotes.length} quotes, ${backup.proposals.length} proposals`);
    console.log(`  ${backup.projects.length} projects, ${backup.contacts.length} contacts, ${backup.proposalTemplates.length} templates\n`);

    const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log('✓ Connected to Neon\n');

    // ══════════════════════════════════════
    // Step 0: Create sequence + Insert users
    // ══════════════════════════════════════
    console.log('🔧 Step 0: Sequence + Users\n');

    await client.query('CREATE SEQUENCE IF NOT EXISTS upid_seq START 1');
    console.log('   ✓ upid_seq created');

    // Insert the 5 real team members
    const teamUsers = [
        { firebase_uid: 'd294f715-4c4d-4b25-806f-90cc07e04785', email: 'elijah@scan2plan.io', first_name: 'Elijah', last_name: null, role: 'ceo' },
        { firebase_uid: '0045af22-590b-4741-81ab-0dc4c5f0f658', email: 'chase@scan2plan.io', first_name: 'Chase', last_name: null, role: 'ceo' },
        { firebase_uid: '3de62029-83e6-4dee-9131-f7c6b4f54da1', email: 'v@scan2plan.io', first_name: 'V Owen', last_name: 'Bush', role: 'ceo' },
        { firebase_uid: '47d55de3-dc28-4d24-a9be-82521c7f345e', email: 'kurt@scan2plan.io', first_name: 'Kurt', last_name: 'Przybilla', role: 'sales' },
        { firebase_uid: '792ef1d1-023f-42c5-96e1-04ce8260e3ac', email: 'dev@scan2plan.io', first_name: 'Dev', last_name: null, role: 'ceo' },
    ];

    for (const u of teamUsers) {
        await client.query(`
            INSERT INTO users (firebase_uid, email, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (firebase_uid) DO NOTHING
        `, [u.firebase_uid, u.email, u.first_name, u.last_name, u.role]);
    }
    console.log(`   ✓ ${teamUsers.length} team users inserted\n`);

    // ══════════════════════════════════════
    // Step 1: leads → scoping_forms + scope_areas
    // ══════════════════════════════════════
    console.log('📋 Step 1: Leads → scoping_forms + scope_areas\n');

    const leadIdMap = new Map<number, number>();
    let upidSeq = 1;
    let formCount = 0;
    let areaCount = 0;

    for (const lead of backup.leads) {
        const createdYear = new Date(lead.created_at).getFullYear();
        const upid = `S2P-${String(upidSeq).padStart(4, '0')}-${createdYear}`;
        upidSeq++;

        const { dealStage, status } = mapDealStage(lead.deal_stage);
        const scopingData = lead.cpq_scoping_data || {};
        const travel = lead.cpq_travel || {};

        const bimDeliverable = lead.bim_deliverable ||
            (Array.isArray(scopingData.bimDeliverable) ? scopingData.bimDeliverable[0] : scopingData.bimDeliverable) ||
            'Revit';

        const dispatchLocation = travel.dispatchLocation || lead.dispatch_location || 'Troy NY';
        const oneWayMiles = travel.distance || lead.distance || 0;

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
            lead.contact_email || lead.billing_contact_email || 'noemail@scan2plan.com',
            lead.contact_name || lead.client_name || 'Unknown',
            lead.contact_email || lead.billing_contact_email || 'noemail@scan2plan.com',
            lead.contact_phone || null,
            !lead.billing_contact_name,
            lead.billing_contact_name || null,
            lead.billing_contact_email || null,
            lead.billing_contact_phone || null,
            1,
            bimDeliverable,
            lead.bim_version || scopingData.bimVersion || null,
            false,
            'Modern',
            3,
            JSON.stringify(lead.cpq_risks || []),
            false,
            dispatchLocation,
            oneWayMiles,
            'driving',
            lead.timeline || scopingData.estimatedTimeline || null,
            lead.payment_terms || scopingData.paymentTerms || null,
            scopingData.paymentNotes || null,
            scopingData.sqftAssumptions || null,
            lead.notes || null,
            lead.lead_source || scopingData.source || 'Other',
            parseInt(scopingData.probabilityOfClosing) || lead.probability || 50,
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

        // Create scope_areas from cpq_areas
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

                const lods = area.disciplineLods || {};
                const archLod = lods.architecture || area.gradeLod || '300';
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
                    hasStructural ? JSON.stringify({ enabled: true, sqft }) : null,
                    hasMepf ? JSON.stringify({ enabled: true, sqft }) : null,
                    hasCad ? 'Basic' : 'No',
                    area.includeBelowFloor ? JSON.stringify({ enabled: true, sqft: parseInt(area.belowFloorSqft) || 0 }) : null,
                    area.includeAboveCeiling ? JSON.stringify({ enabled: true, sqft: parseInt(area.aboveCeilingSqft) || 0 }) : null,
                    i,
                ]);
                areaCount++;
            }
        }
    }
    console.log(`   ✓ ${formCount} scoping forms`);
    console.log(`   ✓ ${areaCount} scope areas`);
    console.log(`   ✓ Lead ID map: ${[...leadIdMap.entries()].map(([o, n]) => `${o}→${n}`).join(', ')}\n`);

    // ══════════════════════════════════════
    // Step 2: quotes → quotes
    // ══════════════════════════════════════
    console.log('💰 Step 2: Quotes → quotes\n');

    const quoteIdMap = new Map<string, number>();
    let quoteCount = 0;
    let skippedQuotes = 0;

    for (const quote of backup.quotes) {
        const newFormId = leadIdMap.get(quote.lead_id);
        if (!newFormId) {
            console.log(`   ⚠ Skipping quote ${quote.id} — lead ${quote.lead_id} not mapped`);
            skippedQuotes++;
            continue;
        }

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

        const totalPrice = parseFloat(quote.total_price) || 0;
        const modelingTotal = lineItems.filter((li: any) => li.category === 'modeling').reduce((s: number, li: any) => s + li.amount, 0);
        const travelTotal = lineItems.filter((li: any) => li.category === 'travel').reduce((s: number, li: any) => s + li.amount, 0);

        const totals = {
            totalClientPrice: totalPrice,
            totalUpteamCost: Math.round(totalPrice * 0.55 * 100) / 100,
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
    console.log(`   ✓ ${quoteCount} quotes (${skippedQuotes} skipped)\n`);

    // ══════════════════════════════════════
    // Step 3: proposals → proposals
    // ══════════════════════════════════════
    console.log('📄 Step 3: Proposals → proposals\n');

    let proposalCount = 0;
    let skippedProposals = 0;

    for (const prop of backup.proposals) {
        const newFormId = leadIdMap.get(prop.lead_id);
        if (!newFormId) { skippedProposals++; continue; }

        // Find matching quote
        let newQuoteId: number | null = null;
        if (prop.quote_id) newQuoteId = quoteIdMap.get(prop.quote_id) || null;
        if (!newQuoteId) {
            const quotesForLead = backup.quotes
                .filter((q: any) => q.lead_id === prop.lead_id)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (quotesForLead.length > 0) newQuoteId = quoteIdMap.get(quotesForLead[0].id) || null;
        }
        if (!newQuoteId) {
            console.log(`   ⚠ Skipping proposal "${prop.name}" — no matching quote`);
            skippedProposals++;
            continue;
        }

        const accessToken = randomUUID();
        const customMessage = prop.cover_data?.custom_message || prop.cover_data?.message || null;
        const status = ['draft', 'sent', 'viewed', 'accepted', 'rejected'].includes(prop.status) ? prop.status : 'draft';

        await client.query(`
            INSERT INTO proposals (
                scoping_form_id, quote_id, status, pdf_url,
                access_token, custom_message, version,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            newFormId, newQuoteId, status, prop.pdf_url || null,
            accessToken, customMessage, prop.version || 1,
            prop.created_at, prop.updated_at || prop.created_at,
        ]);
        proposalCount++;
    }
    console.log(`   ✓ ${proposalCount} proposals (${skippedProposals} skipped)\n`);

    // ══════════════════════════════════════
    // Step 4: projects → production_projects
    // ══════════════════════════════════════
    console.log('🏗️  Step 4: Projects → production_projects\n');

    let projectCount = 0;
    let skippedProjects = 0;

    for (const proj of backup.projects) {
        const newFormId = leadIdMap.get(proj.lead_id);
        if (!newFormId) {
            console.log(`   ⚠ Skipping project ${proj.id} — lead ${proj.lead_id} not mapped`);
            skippedProjects++;
            continue;
        }

        const stageMap: Record<string, string> = {
            'Scheduling': 'scheduling', 'Field Capture': 'field_capture',
            'Registration': 'registration', 'BIM QC': 'bim_qc',
            'PC Delivery': 'pc_delivery', 'Final Delivery': 'final_delivery',
        };
        const currentStage = stageMap[proj.status] || 'scheduling';

        const stageData: Record<string, any> = {
            scheduling: {
                scannerAssignment: proj.scanner_type || null,
                estScanDays: proj.estimated_scan_days || null,
            },
            field_capture: { scanDate: proj.scan_date || null },
        };

        const projUpid = proj.universal_project_id || `S2P-${String(upidSeq).padStart(4, '0')}-${new Date().getFullYear()}`;
        if (!proj.universal_project_id) upidSeq++;

        await client.query(`
            INSERT INTO production_projects (
                scoping_form_id, upid, current_stage, stage_data,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            newFormId, projUpid, currentStage, JSON.stringify(stageData),
            proj.created_at, proj.updated_at || proj.created_at,
        ]);
        projectCount++;
    }
    console.log(`   ✓ ${projectCount} production projects (${skippedProjects} skipped)\n`);

    // ══════════════════════════════════════
    // Step 5: contacts → qbo_customers
    // ══════════════════════════════════════
    console.log('👥 Step 5: Contacts → qbo_customers\n');

    let contactCount = 0;
    let dupContacts = 0;
    const seenNames = new Set<string>();

    for (const contact of backup.contacts) {
        const name = contact.customer_name?.trim();
        if (!name) continue;

        if (seenNames.has(name.toLowerCase())) { dupContacts++; continue; }
        seenNames.add(name.toLowerCase());

        await client.query(`
            INSERT INTO qbo_customers (
                customer_name, company, email, phone, bill_address,
                first_name, last_name,
                created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            name,
            null,
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
    console.log(`   ✓ ${contactCount} qbo_customers (${dupContacts} duplicates skipped)\n`);

    // ══════════════════════════════════════
    // Step 6: Seed operational data
    // ══════════════════════════════════════
    console.log('🌱 Step 6: Seeding operational data\n');

    // Update upid_seq
    await client.query(`ALTER SEQUENCE upid_seq RESTART WITH ${upidSeq}`);
    console.log(`   ✓ upid_seq → ${upidSeq}`);

    // Seed scan checklists
    const checklistCount = await client.query('SELECT COUNT(*) FROM scan_checklists');
    if (parseInt(checklistCount.rows[0].count) === 0) {
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
        console.log('   ✓ 3 scan checklists seeded');
    }

    // Seed chat channels
    const channelCount = await client.query('SELECT COUNT(*) FROM chat_channels');
    if (parseInt(channelCount.rows[0].count) === 0) {
        await client.query(`
            INSERT INTO chat_channels (name, display_name, description, emoji, is_default) VALUES
            ('general', 'General', 'General team discussion', '💬', true),
            ('field-ops', 'Field Ops', 'Field scanning operations and logistics', '📡', true),
            ('bim-team', 'BIM Team', 'BIM modeling and quality discussions', '🏗️', true),
            ('announcements', 'Announcements', 'Company announcements and updates', '📢', false)
        `);
        console.log('   ✓ 4 chat channels seeded');
    }

    // ══════════════════════════════════════
    // Summary
    // ══════════════════════════════════════
    console.log('\n════════════════════════════════════════');
    console.log('✅ Import Complete!');
    console.log('════════════════════════════════════════');
    console.log(`   Users:              ${teamUsers.length}`);
    console.log(`   Scoping forms:      ${formCount}`);
    console.log(`   Scope areas:        ${areaCount}`);
    console.log(`   Quotes:             ${quoteCount}`);
    console.log(`   Proposals:          ${proposalCount}`);
    console.log(`   Production projects:${projectCount}`);
    console.log(`   QBO customers:      ${contactCount}`);
    console.log(`   UPID sequence:      starts at ${upidSeq}`);
    console.log('');

    await client.end();
}

main().catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
});
