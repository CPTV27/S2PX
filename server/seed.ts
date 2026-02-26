/**
 * S2PX Comprehensive Database Seed Script
 *
 * Populates the production Cloud SQL database from ALL available data sources:
 *   1. QBO Customer Contact List CSV  →  client contact enrichment map
 *   2. QBO Estimates CSV              →  scoping_forms + scope_areas + quotes
 *   3. QBO Sales CSV                  →  enriches deal stages (invoiced = won)
 *   4. GCS active-projects list       →  production_projects + project_assets
 *
 * Usage:
 *   npx tsx server/seed.ts
 *
 * Requires Cloud SQL Proxy running on localhost:5433
 */

import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { Client } from 'pg';

const DB_URL = 'postgresql://postgres:wmh0PMUXgOrcGU9qvNFqZJX@localhost:5433/s2px';
const FINANCIAL_DIR = 'Financial Records';

// ── Helpers ──

function parseAmount(raw: string): number {
    if (!raw) return 0;
    return parseFloat(raw.replace(/[$,"\s]/g, '')) || 0;
}

function parseDate(raw: string): Date | null {
    if (!raw) return null;
    const datePart = raw.trim().split(/[\s]+/)[0];
    const [m, d, y] = datePart.split('/').map(Number);
    if (!m || !d || !y) return null;
    return new Date(y, m - 1, d);
}

function statusToDealStage(status: string): string {
    switch (status.toLowerCase()) {
        case 'converted': return 'in_hand';
        case 'accepted': return 'in_hand';
        case 'pending': return 'proposal';
        case 'closed': return 'closed_lost';
        case 'rejected': return 'closed_lost';
        default: return 'qualified';
    }
}

function statusToProbability(status: string): number {
    switch (status.toLowerCase()) {
        case 'converted': return 100;
        case 'accepted': return 90;
        case 'pending': return 50;
        case 'closed': return 0;
        case 'rejected': return 0;
        default: return 30;
    }
}

function statusToFormStatus(status: string): string {
    switch (status.toLowerCase()) {
        case 'converted': return 'won';
        case 'accepted': return 'won';
        case 'pending': return 'submitted';
        case 'closed': return 'lost';
        case 'rejected': return 'lost';
        default: return 'draft';
    }
}

function estimateSfFromAmount(amount: number): number {
    // ~$1.50/sqft average for scan2plan work
    if (amount <= 0) return 2000;
    return Math.max(1000, Math.min(Math.round(amount / 1.5), 200000));
}

function extractPhone(raw: string): string {
    if (!raw) return '';
    // Strip "Phone:" / "Mobile:" prefixes, take first number
    const cleaned = raw.replace(/Phone:|Mobile:/gi, '').trim();
    const match = cleaned.match(/[\d().-]+[\d().\s-]{7,}/);
    return match ? match[0].trim() : cleaned.split(/\s+/)[0] || '';
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ══════════════════════════════════════════
// 1. Parse Customer Contact List
// ══════════════════════════════════════════

interface CustomerContact {
    fullName: string;
    phone: string;
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    createdOn: string;
    billCity: string;
    billState: string;
    billStreet: string;
    billZip: string;
    shipCity: string;
    shipState: string;
    shipStreet: string;
    shipZip: string;
    website: string;
    note: string;
}

function parseCustomerContacts(): Map<string, CustomerContact> {
    const filepath = `${FINANCIAL_DIR}/SCAN2PLAN_Customer Contact List_Chronoilogical.csv`;
    const raw = readFileSync(filepath, 'utf-8');
    const records = parse(raw, {
        columns: false,
        skip_empty_lines: false,
        relax_column_count: true,
        relax_quotes: true,
    });

    const contacts = new Map<string, CustomerContact>();
    for (const r of records) {
        const fullName = (r[0] || '').trim();
        if (!fullName || fullName === 'Customer Contact List' || fullName === 'SCAN2PLAN' ||
            fullName === 'Customer full name') continue;

        contacts.set(slugify(fullName), {
            fullName,
            phone: extractPhone(r[1] || ''),
            email: (r[2] || '').trim(),
            firstName: (r[9] || '').trim(),
            lastName: (r[10] || '').trim(),
            company: (r[6] || '').trim(),
            createdOn: (r[7] || '').trim(),
            billCity: (r[20] || '').trim(),
            billState: (r[22] || '').trim(),
            billStreet: (r[23] || '').trim(),
            billZip: (r[24] || '').trim(),
            shipCity: (r[15] || '').trim(),
            shipState: (r[17] || '').trim(),
            shipStreet: (r[18] || '').trim(),
            shipZip: (r[19] || '').trim(),
            website: (r[13] || '').trim(),
            note: (r[27] || '').trim(),
        });
    }
    return contacts;
}

// ══════════════════════════════════════════
// 2. Parse Estimates CSV
// ══════════════════════════════════════════

interface EstimateRow {
    date: string;
    num: string;
    estimateStatus: string;
    acceptedOn: string;
    acceptedBy: string;
    invoiceNumber: string;
    amount: string;
    billTo: string;
    createdOn: string;
    customerMessage: string;
    deliveryAddress: string;
    dueDate: string;
    customerEmail: string;
    phoneNumbers: string;
    memoDescription: string;
    customerMobile: string;
    modifiedBy: string;
    modifiedOn: string;
    name: string;
    phone: string;
    subject: string;
    customerPhone: string;
}

function parseEstimatesCSV(): EstimateRow[] {
    const filepath = `${FINANCIAL_DIR}/SCAN2PLAN_Estimates by Customer (1).csv`;
    const raw = readFileSync(filepath, 'utf-8');
    const records = parse(raw, {
        columns: false,
        skip_empty_lines: false,
        relax_column_count: true,
        relax_quotes: true,
    });

    const rows: EstimateRow[] = [];
    let currentCustomer = '';

    for (const record of records) {
        const firstCol = (record[0] || '').trim();

        // Data row: starts empty, has a date in col 1
        if (firstCol === '' && record[1] && /^\d{2}\/\d{2}\/\d{4}/.test(record[1])) {
            rows.push({
                date: record[1] || '',
                num: record[2] || '',
                estimateStatus: record[3] || '',
                acceptedOn: record[4] || '',
                acceptedBy: record[5] || '',
                invoiceNumber: record[6] || '',
                amount: record[7] || '',
                billTo: record[8] || '',
                createdOn: record[9] || '',
                customerMessage: record[10] || '',
                deliveryAddress: record[11] || '',
                dueDate: record[12] || '',
                customerEmail: record[13] || '',
                phoneNumbers: record[14] || '',
                memoDescription: record[15] || '',
                customerMobile: record[16] || '',
                modifiedBy: record[17] || '',
                modifiedOn: record[18] || '',
                name: currentCustomer || record[19] || '',
                phone: record[20] || '',
                subject: record[21] || '',
                customerPhone: record[22] || '',
            });
            continue;
        }

        // Customer name row
        if (firstCol && !firstCol.startsWith('Total for') &&
            !firstCol.startsWith('Estimates by') && firstCol !== 'SCAN2PLAN' &&
            firstCol !== 'All Dates' && !firstCol.startsWith(',')) {
            currentCustomer = firstCol;
        }
    }
    return rows;
}

// ══════════════════════════════════════════
// 3. Parse Sales CSV (invoiced transactions)
// ══════════════════════════════════════════

interface SalesRow {
    date: string;
    transactionType: string;
    num: string;
    memo: string;
    quantity: string;
    salesPrice: string;
    amount: string;
    balance: string;
    accountName: string;
    customerName: string;
    customerMessage: string;
    subject: string;
    productService: string;
}

function parseSalesCSV(): { rows: SalesRow[]; customerTotals: Map<string, number> } {
    const filepath = `${FINANCIAL_DIR}/SCAN2PLAN_Sales by Customer DetaiL_LARGE.csv`;
    const raw = readFileSync(filepath, 'utf-8');
    const records = parse(raw, {
        columns: false,
        skip_empty_lines: false,
        relax_column_count: true,
        relax_quotes: true,
    });

    const rows: SalesRow[] = [];
    const customerTotals = new Map<string, number>();
    let currentCustomer = '';

    for (const record of records) {
        const firstCol = (record[0] || '').trim();

        // Data row
        if (firstCol === '' && record[1] && /^\d{2}\/\d{2}\/\d{4}/.test(record[1])) {
            const row: SalesRow = {
                date: record[1] || '',
                transactionType: record[2] || '',
                num: record[3] || '',
                memo: record[4] || '',
                quantity: record[5] || '',
                salesPrice: record[6] || '',
                amount: record[7] || '',
                balance: record[8] || '',
                accountName: record[10] || '',
                customerName: currentCustomer,
                customerMessage: record[12] || '',
                subject: record[13] || '',
                productService: record[14] || '',
            };
            rows.push(row);

            // Accumulate per-customer totals
            const amt = parseAmount(row.amount);
            if (amt > 0) {
                const key = slugify(currentCustomer);
                customerTotals.set(key, (customerTotals.get(key) || 0) + amt);
            }
            continue;
        }

        // Total row — grab the actual customer total
        if (firstCol.startsWith('Total for ')) {
            const name = firstCol.replace('Total for ', '');
            const totalAmt = parseAmount(record[7] || '');
            if (totalAmt > 0) {
                customerTotals.set(slugify(name), totalAmt);
            }
            continue;
        }

        // Customer name row
        if (firstCol && !firstCol.startsWith('Sales by') && firstCol !== 'SCAN2PLAN' &&
            !firstCol.startsWith('"') && !/^\d/.test(firstCol)) {
            currentCustomer = firstCol;
        }
    }

    return { rows, customerTotals };
}

// ══════════════════════════════════════════
// 4. Parse GCS Project List
// ══════════════════════════════════════════

interface GCSProject {
    fullPath: string;
    folderName: string;
    address: string;
    date: string | null;
}

function parseGCSProjects(): GCSProject[] {
    const filepath = '/tmp/gcs-projects.txt';
    if (!existsSync(filepath)) return [];
    const lines = readFileSync(filepath, 'utf-8').trim().split('\n');
    return lines.map(line => {
        const path = line.trim();
        const match = path.match(/projects\/([^/]+)\/?$/);
        const folderName = match ? match[1] : '';

        const parts = folderName.split('_');
        const lastPart = parts[parts.length - 1];
        const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(lastPart);

        const address = (hasDate ? parts.slice(0, -1) : parts.filter(p => p !== 'undated'))
            .join(' ')
            .replace(/-/g, ' ');

        return { fullPath: path, folderName, address, date: hasDate ? lastPart : null };
    }).filter(p => p.folderName);
}

// ══════════════════════════════════════════
// 5. Main Seed
// ══════════════════════════════════════════

async function main() {
    console.log('🌱 S2PX Comprehensive Database Seed');
    console.log('====================================\n');

    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    console.log('✓ Connected to Cloud SQL\n');

    // Truncate all tables
    console.log('🗑️  Truncating all tables...');
    await client.query(`
        TRUNCATE project_assets, production_projects, proposals, quotes, scope_areas, scoping_forms, qbo_tokens
        RESTART IDENTITY CASCADE
    `);
    await client.query('ALTER SEQUENCE IF EXISTS upid_seq RESTART WITH 1');
    console.log('   ✓ Tables cleared\n');

    // ── Step 1: Load Customer Contacts ──
    console.log('📇 Step 1: Loading customer contacts...');
    const contacts = parseCustomerContacts();
    console.log(`   ✓ ${contacts.size} customers loaded\n`);

    // ── Step 2: Load Sales Data ──
    console.log('💰 Step 2: Loading sales data...');
    const sales = parseSalesCSV();
    console.log(`   ✓ ${sales.rows.length} sales transactions`);
    console.log(`   ✓ ${sales.customerTotals.size} customers with invoiced revenue\n`);

    // Build a set of invoice numbers from sales for cross-referencing
    const invoicedNums = new Set<string>();
    const invoicesByCustomer = new Map<string, SalesRow[]>();
    for (const row of sales.rows) {
        if (row.num) invoicedNums.add(row.num);
        const key = slugify(row.customerName);
        if (!invoicesByCustomer.has(key)) invoicesByCustomer.set(key, []);
        invoicesByCustomer.get(key)!.push(row);
    }

    // ── Step 3: Load & Insert Estimates ──
    console.log('📄 Step 3: Loading estimates...');
    const estimates = parseEstimatesCSV();
    console.log(`   ✓ ${estimates.length} estimate rows parsed`);

    console.log('   Inserting scoping forms + scope areas + quotes...');

    let formCount = 0;
    let areaCount = 0;
    let quoteCount = 0;
    let seq = 1;
    const seenNums = new Set<string>();

    // Track form IDs by address slug for GCS matching later
    const formsByAddressSlug = new Map<string, { id: number; upid: string }>();
    const formsByCustomerSlug = new Map<string, { id: number; upid: string }[]>();

    for (const est of estimates) {
        if (!est.num || seenNums.has(est.num)) continue;
        seenNums.add(est.num);

        const amount = parseAmount(est.amount);
        if (amount <= 0) continue;

        const createdDate = parseDate(est.date) || new Date();
        const year = createdDate.getFullYear();
        const upid = `S2P-${seq}-${year}`;
        seq++;

        // Enrich from customer contacts
        const contactKey = slugify(est.name);
        const contact = contacts.get(contactKey);

        const email = est.customerEmail || contact?.email || 'noemail@scan2plan.com';
        const phone = extractPhone(est.phone || est.customerPhone || est.phoneNumbers || contact?.phone || '');
        const firstName = contact?.firstName || est.name.split(' ')[0] || '';
        const lastName = contact?.lastName || est.name.split(' ').slice(1).join(' ') || '';
        const company = contact?.company || est.name;

        const projectAddress = est.subject || est.deliveryAddress || 'Address TBD';
        const projectName = projectAddress !== 'Address TBD'
            ? `${est.name} - ${projectAddress}`
            : `${est.name} - Est #${est.num}`;

        // Billing address from contacts
        const billStreet = contact?.billStreet || '';
        const billCity = contact?.billCity || '';
        const billState = contact?.billState || '';
        const billZip = contact?.billZip || '';
        const billingAddress = [billStreet, billCity, billState, billZip].filter(Boolean).join(', ');

        const estSf = estimateSfFromAmount(amount);

        // Check if this estimate was invoiced (confirms won status)
        const hasInvoice = est.invoiceNumber && invoicedNums.has(est.invoiceNumber);
        const isWon = est.estimateStatus.toLowerCase() === 'converted' ||
                      est.estimateStatus.toLowerCase() === 'accepted' || hasInvoice;

        const dealStage = hasInvoice ? 'in_hand' : statusToDealStage(est.estimateStatus);
        const formStatus = hasInvoice ? 'won' : statusToFormStatus(est.estimateStatus);
        const probability = hasInvoice ? 100 : statusToProbability(est.estimateStatus);

        // Determine lead source based on who modified/created
        const leadSource = 'Referral';

        const formResult = await client.query(`
            INSERT INTO scoping_forms (
                upid, status, client_company, project_name, project_address, email,
                primary_contact_name, contact_email, contact_phone,
                billing_same_as_primary, billing_contact_name, billing_email, billing_phone,
                number_of_floors, bim_deliverable, bim_version, georeferencing,
                era, room_density, risk_factors, expedited,
                dispatch_location, one_way_miles, travel_mode,
                lead_source, source_note, probability, deal_stage, priority,
                internal_notes,
                created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9,
                $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20, $21,
                $22, $23, $24,
                $25, $26, $27, $28, $29,
                $30,
                $31, $32, $33
            ) RETURNING id
        `, [
            upid, formStatus, company || est.name, projectName, projectAddress, email,
            `${firstName} ${lastName}`.trim() || est.name, email, phone,
            !billingAddress, est.name, email, phone,
            2, 'Revit', '2024', false,
            'post-1950', 3, JSON.stringify([]), false,
            'Wappingers Falls, NY', 50, 'driving',
            leadSource, contact?.note || null, probability, dealStage, 3,
            est.invoiceNumber ? `QBO Invoice: ${est.invoiceNumber}` : null,
            'seed-import', createdDate, createdDate,
        ]);

        const formId = formResult.rows[0].id;
        formCount++;

        // Track for GCS matching
        const addrSlug = slugify(projectAddress);
        if (addrSlug && addrSlug !== 'address tbd') {
            formsByAddressSlug.set(addrSlug, { id: formId, upid });
        }
        if (!formsByCustomerSlug.has(contactKey)) formsByCustomerSlug.set(contactKey, []);
        formsByCustomerSlug.get(contactKey)!.push({ id: formId, upid });

        // Insert scope_area
        await client.query(`
            INSERT INTO scope_areas (
                scoping_form_id, area_type, area_name, square_footage,
                project_scope, lod, cad_deliverable, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [formId, 'Commercial', projectAddress, estSf, 'Full', '300', 'No', 0]);
        areaCount++;

        // Insert quote
        const lineItems = [{
            id: `li-${est.num}`,
            label: projectName,
            category: 'scanning',
            sqft: estSf,
            rate: Math.round((amount / Math.max(estSf, 1)) * 100) / 100,
            amount,
        }];
        const totals = {
            subtotal: amount,
            travelCost: 0,
            expeditedFee: 0,
            grandTotal: amount,
            marginPct: 45,
            upteamCost: Math.round(amount * 0.55 * 100) / 100,
            grossProfit: Math.round(amount * 0.45 * 100) / 100,
        };

        await client.query(`
            INSERT INTO quotes (
                scoping_form_id, line_items, totals, integrity_status,
                version, qbo_estimate_number, qbo_invoice_id,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            formId, JSON.stringify(lineItems), JSON.stringify(totals), 'passed',
            1, est.num, est.invoiceNumber || null,
            createdDate, createdDate,
        ]);
        quoteCount++;
    }

    console.log(`   ✓ ${formCount} scoping forms`);
    console.log(`   ✓ ${areaCount} scope areas`);
    console.log(`   ✓ ${quoteCount} quotes\n`);

    // ── Step 4: Create scoping forms for customers in Sales but NOT in Estimates ──
    console.log('📊 Step 4: Adding sales-only customers...');
    let salesOnlyCount = 0;

    // Group sales by customer, find those not already in estimates
    const estimateCustomers = new Set(estimates.map(e => slugify(e.name)));

    for (const [custSlug, custSales] of invoicesByCustomer) {
        if (estimateCustomers.has(custSlug) || custSlug === '' || custSlug === 'scan2plan') continue;

        // Group invoices by invoice number to avoid dupes
        const invoiceGroups = new Map<string, SalesRow[]>();
        for (const s of custSales) {
            if (!s.num) continue;
            if (!invoiceGroups.has(s.num)) invoiceGroups.set(s.num, []);
            invoiceGroups.get(s.num)!.push(s);
        }

        for (const [invoiceNum, lineItems] of invoiceGroups) {
            const totalAmount = lineItems.reduce((sum, li) => sum + parseAmount(li.amount), 0);
            if (totalAmount <= 0) continue;

            const firstItem = lineItems[0];
            const createdDate = parseDate(firstItem.date) || new Date();
            const year = createdDate.getFullYear();
            const upid = `S2P-${seq}-${year}`;
            seq++;

            const contact = contacts.get(custSlug);
            const email = contact?.email || 'noemail@scan2plan.com';
            const phone = contact?.phone || '';
            const firstName = contact?.firstName || firstItem.customerName.split(' ')[0] || '';
            const lastName = contact?.lastName || firstItem.customerName.split(' ').slice(1).join(' ') || '';
            const company = contact?.company || firstItem.customerName;

            const projectAddress = firstItem.subject || firstItem.memo || 'Address TBD';
            const projectName = projectAddress !== 'Address TBD'
                ? `${firstItem.customerName} - ${projectAddress}`
                : `${firstItem.customerName} - Inv #${invoiceNum}`;

            const estSf = estimateSfFromAmount(totalAmount);

            const formResult = await client.query(`
                INSERT INTO scoping_forms (
                    upid, status, client_company, project_name, project_address, email,
                    primary_contact_name, contact_email, contact_phone,
                    billing_same_as_primary,
                    number_of_floors, bim_deliverable, georeferencing,
                    era, room_density, risk_factors, expedited,
                    dispatch_location, one_way_miles, travel_mode,
                    lead_source, probability, deal_stage, priority,
                    internal_notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9,
                    $10,
                    $11, $12, $13,
                    $14, $15, $16, $17,
                    $18, $19, $20,
                    $21, $22, $23, $24,
                    $25,
                    $26, $27, $28
                ) RETURNING id
            `, [
                upid, 'won', company, projectName, projectAddress, email,
                `${firstName} ${lastName}`.trim() || firstItem.customerName, email, phone,
                true,
                2, 'Revit', false,
                'post-1950', 3, JSON.stringify([]), false,
                'Wappingers Falls, NY', 50, 'driving',
                'Referral', 100, 'in_hand', 3,
                `QBO Invoice: ${invoiceNum}. Sales-only record (no estimate found).`,
                'seed-import', createdDate, createdDate,
            ]);

            const formId = formResult.rows[0].id;
            formCount++;
            salesOnlyCount++;

            // Scope area
            await client.query(`
                INSERT INTO scope_areas (
                    scoping_form_id, area_type, area_name, square_footage,
                    project_scope, lod, cad_deliverable, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [formId, 'Commercial', projectAddress, estSf, 'Full', '300', 'No', 0]);
            areaCount++;

            // Quote
            const qLineItems = lineItems.map((li, i) => ({
                id: `li-${invoiceNum}-${i}`,
                label: li.memo || projectName,
                category: 'scanning',
                sqft: Math.round(estSf / lineItems.length),
                rate: parseAmount(li.salesPrice) || (parseAmount(li.amount) / Math.max(estSf / lineItems.length, 1)),
                amount: parseAmount(li.amount),
            }));
            const totals = {
                subtotal: totalAmount,
                travelCost: 0,
                expeditedFee: 0,
                grandTotal: totalAmount,
                marginPct: 45,
                upteamCost: Math.round(totalAmount * 0.55 * 100) / 100,
                grossProfit: Math.round(totalAmount * 0.45 * 100) / 100,
            };

            await client.query(`
                INSERT INTO quotes (
                    scoping_form_id, line_items, totals, integrity_status,
                    version, qbo_invoice_id,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                formId, JSON.stringify(qLineItems), JSON.stringify(totals), 'passed',
                1, invoiceNum,
                createdDate, createdDate,
            ]);
            quoteCount++;

            // Track for GCS matching
            const addrSlug = slugify(projectAddress);
            if (addrSlug && addrSlug !== 'address tbd') {
                formsByAddressSlug.set(addrSlug, { id: formId, upid });
            }
        }
    }

    console.log(`   ✓ ${salesOnlyCount} sales-only scoping forms added\n`);

    // ── Step 5: Create scoping forms for contacts not in Estimates OR Sales ──
    console.log('📋 Step 5: Adding contact-only leads...');
    let contactOnlyCount = 0;

    const allSeededCustomers = new Set([
        ...estimates.map(e => slugify(e.name)),
        ...Array.from(invoicesByCustomer.keys()),
    ]);

    for (const [custSlug, contact] of contacts) {
        if (allSeededCustomers.has(custSlug) || !contact.fullName) continue;

        const createdDate = parseDate(contact.createdOn) || new Date();
        const year = createdDate.getFullYear();
        const upid = `S2P-${seq}-${year}`;
        seq++;

        const email = contact.email || 'noemail@scan2plan.com';
        const company = contact.company || contact.fullName;
        const address = [contact.billStreet, contact.billCity, contact.billState, contact.billZip]
            .filter(Boolean).join(', ') || 'Address TBD';

        const formResult = await client.query(`
            INSERT INTO scoping_forms (
                upid, status, client_company, project_name, project_address, email,
                primary_contact_name, contact_email, contact_phone,
                billing_same_as_primary,
                number_of_floors, bim_deliverable, georeferencing,
                era, room_density, risk_factors, expedited,
                dispatch_location, one_way_miles, travel_mode,
                lead_source, probability, deal_stage, priority,
                internal_notes,
                created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9,
                $10,
                $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20,
                $21, $22, $23, $24,
                $25,
                $26, $27, $28
            ) RETURNING id
        `, [
            upid, 'draft', company, `${contact.fullName} - Lead`, address, email,
            `${contact.firstName} ${contact.lastName}`.trim() || contact.fullName, email, contact.phone,
            true,
            2, 'Revit', false,
            'post-1950', 3, JSON.stringify([]), false,
            'Wappingers Falls, NY', 50, 'driving',
            'Referral', 10, 'lead', 5,
            'Contact-only record from QBO. No estimate or invoice found.',
            'seed-import', createdDate, createdDate,
        ]);

        formCount++;
        contactOnlyCount++;

        // Track for GCS matching
        const addrSlug = slugify(address);
        if (addrSlug && addrSlug !== 'address tbd') {
            formsByAddressSlug.set(addrSlug, { id: formResult.rows[0].id, upid });
        }
    }

    console.log(`   ✓ ${contactOnlyCount} contact-only leads added\n`);

    // ── Step 6: Production Projects from GCS ──
    console.log('🏗️  Step 6: Inserting production projects from GCS...');
    const gcsProjects = parseGCSProjects();
    console.log(`   ${gcsProjects.length} GCS project folders to process...`);

    let prodCount = 0;
    let assetCount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const proj of gcsProjects) {
        const projSlug = slugify(proj.address);

        // Try to match to existing scoping form by address
        let scopingFormId: number | null = null;
        let upid: string;

        // Fuzzy address matching — try exact slug, then partial matches
        let match = formsByAddressSlug.get(projSlug);

        if (!match && projSlug) {
            // Try partial match: if GCS slug is contained in any form address or vice versa
            for (const [formSlug, formData] of formsByAddressSlug) {
                if (formSlug.includes(projSlug) || projSlug.includes(formSlug)) {
                    match = formData;
                    break;
                }
            }
        }

        if (match) {
            scopingFormId = match.id;
            upid = match.upid;
            matchedCount++;
        } else {
            // Create a minimal scoping form for unmatched GCS projects
            const projectAddress = proj.address || proj.folderName.replace(/-/g, ' ');
            const year = proj.date ? parseInt(proj.date.split('-')[0]) : 2024;
            upid = `S2P-${seq}-${year}`;
            seq++;

            const formResult = await client.query(`
                INSERT INTO scoping_forms (
                    upid, status, client_company, project_name, project_address, email,
                    primary_contact_name, contact_email,
                    number_of_floors, bim_deliverable, georeferencing,
                    era, room_density, risk_factors, expedited,
                    dispatch_location, one_way_miles, travel_mode,
                    lead_source, probability, deal_stage, priority,
                    internal_notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8,
                    $9, $10, $11,
                    $12, $13, $14, $15,
                    $16, $17, $18,
                    $19, $20, $21, $22,
                    $23,
                    $24, $25, $26
                ) RETURNING id
            `, [
                upid, 'won', 'TBD', projectAddress, projectAddress, 'noemail@scan2plan.com',
                'TBD', 'noemail@scan2plan.com',
                2, 'Revit', false,
                'post-1950', 3, JSON.stringify([]), false,
                'Wappingers Falls, NY', 50, 'driving',
                'Referral', 100, 'in_hand', 3,
                `GCS project folder: ${proj.folderName}. No matching estimate/invoice found.`,
                'seed-import',
                proj.date ? new Date(proj.date) : new Date('2024-01-01'),
                proj.date ? new Date(proj.date) : new Date('2024-01-01'),
            ]);
            scopingFormId = formResult.rows[0].id;
            formCount++;
            unmatchedCount++;
        }

        // Insert production_project
        const stageData: Record<string, any> = {};
        if (proj.date) stageData.fieldDate = proj.date;

        const prodResult = await client.query(`
            INSERT INTO production_projects (
                scoping_form_id, upid, current_stage, stage_data,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            scopingFormId, upid, 'final_delivery', JSON.stringify(stageData),
            proj.date ? new Date(proj.date) : new Date('2024-01-01'),
            proj.date ? new Date(proj.date) : new Date('2024-01-01'),
        ]);
        prodCount++;

        // Insert project_asset
        await client.query(`
            INSERT INTO project_assets (
                production_project_id, bucket, gcs_path, label,
                asset_type, linked_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            prodResult.rows[0].id, 's2p-active-projects',
            `projects/${proj.folderName}`, proj.address || proj.folderName,
            'folder', proj.date ? new Date(proj.date) : new Date('2024-01-01'),
        ]);
        assetCount++;
    }

    console.log(`   ✓ ${prodCount} production projects`);
    console.log(`   ✓ ${assetCount} project assets`);
    console.log(`   ✓ ${matchedCount} matched to existing forms, ${unmatchedCount} new forms created\n`);

    // ── Step 7: Update upid_seq ──
    await client.query(`ALTER SEQUENCE IF EXISTS upid_seq RESTART WITH ${seq}`);
    console.log(`🔢 UPID sequence set to ${seq}\n`);

    // ── Summary ──
    const counts = await Promise.all([
        client.query('SELECT count(*) as c FROM scoping_forms'),
        client.query('SELECT count(*) as c FROM scope_areas'),
        client.query('SELECT count(*) as c FROM quotes'),
        client.query('SELECT count(*) as c FROM production_projects'),
        client.query('SELECT count(*) as c FROM project_assets'),
        client.query('SELECT count(*) as c FROM users'),
    ]);

    const stageBreakdown = await client.query(
        'SELECT deal_stage, count(*) as c FROM scoping_forms GROUP BY deal_stage ORDER BY c DESC'
    );
    const statusBreakdown = await client.query(
        'SELECT status, count(*) as c FROM scoping_forms GROUP BY status ORDER BY c DESC'
    );
    const revTotal = await client.query(
        "SELECT sum((totals->>'grandTotal')::numeric) as total FROM quotes"
    );
    const clientCount = await client.query(
        'SELECT count(DISTINCT client_company) as c FROM scoping_forms'
    );

    console.log('════════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('════════════════════════════════════════════');
    console.log(`  scoping_forms:       ${counts[0].rows[0].c}`);
    console.log(`  scope_areas:         ${counts[1].rows[0].c}`);
    console.log(`  quotes:              ${counts[2].rows[0].c}`);
    console.log(`  production_projects: ${counts[3].rows[0].c}`);
    console.log(`  project_assets:      ${counts[4].rows[0].c}`);
    console.log(`  users:               ${counts[5].rows[0].c}`);
    console.log('────────────────────────────────────────────');
    console.log(`  Unique clients:      ${clientCount.rows[0].c}`);
    console.log(`  Total quoted rev:    $${parseFloat(revTotal.rows[0].total || '0').toLocaleString()}`);
    console.log('');
    console.log('  Deal stages:');
    for (const r of stageBreakdown.rows) {
        console.log(`    ${r.deal_stage.padEnd(15)} ${r.c}`);
    }
    console.log('');
    console.log('  Form statuses:');
    for (const r of statusBreakdown.rows) {
        console.log(`    ${r.status.padEnd(15)} ${r.c}`);
    }
    console.log('════════════════════════════════════════════\n');

    await client.end();
}

main().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
