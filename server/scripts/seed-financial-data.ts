#!/usr/bin/env npx tsx
/**
 * seed-financial-data.ts
 *
 * Imports all QuickBooks CSV exports from /Financial Records/ into
 * the S2PX QBO tables in Neon. Run with:
 *   npx tsx server/scripts/seed-financial-data.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_OgSaq5wyUi6E@ep-winter-lab-ah4py7xl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const RECORDS_DIR = path.resolve(__dirname, '../../Financial Records');

// ═══════════════════════════════════════════════════════════════
// ── CSV Parser (handles quoted multi-line fields) ──
// ═══════════════════════════════════════════════════════════════

function parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const c = content[i];

        if (inQuotes) {
            if (c === '"') {
                if (content[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else {
            if (c === '"' && field.length === 0) {
                inQuotes = true;
            } else if (c === ',') {
                currentRow.push(field);
                field = '';
            } else if (c === '\n') {
                currentRow.push(field);
                field = '';
                rows.push(currentRow);
                currentRow = [];
            } else if (c === '\r') {
                // skip \r, \n will follow
            } else {
                field += c;
            }
        }
    }

    if (field.length > 0 || currentRow.length > 0) {
        currentRow.push(field);
        rows.push(currentRow);
    }

    return rows;
}

// ═══════════════════════════════════════════════════════════════
// ── Value Helpers ──
// ═══════════════════════════════════════════════════════════════

function parseCurrency(val: string | undefined): number | null {
    if (!val || val.trim() === '') return null;
    const cleaned = val.replace(/[$,"\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function parseQBODate(val: string | undefined): string | null {
    if (!val || val.trim() === '') return null;
    const trimmed = val.trim();
    // MM/DD/YYYY or MM/DD/YYYY HH:MM:SS AM/PM
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const MONTH_MAP: Record<string, string> = {
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12',
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09',
    'Oct': '10', 'Nov': '11', 'Dec': '12',
};

function parseMonthHeader(header: string): string | null {
    if (!header || header === 'Total') return null;
    const h = header.trim();

    // "January 2020" → "2020-01"
    const parts = h.split(/\s+/);
    if (parts.length === 2 && MONTH_MAP[parts[0]]) {
        return `${parts[1]}-${MONTH_MAP[parts[0]]}`;
    }

    // "Feb 1 - Feb 20 2026" → "2026-02"
    const partial = h.match(/^(\w+)\s+\d+\s*-\s*\w+\s+\d+\s+(\d{4})$/);
    if (partial && MONTH_MAP[partial[1]]) {
        return `${partial[2]}-${MONTH_MAP[partial[1]]}`;
    }

    return null;
}

function readFile(filename: string): string {
    const filepath = path.join(RECORDS_DIR, filename);
    return fs.readFileSync(filepath, 'utf-8');
}

function col(row: string[], idx: number): string {
    return (row[idx] || '').trim();
}

// ═══════════════════════════════════════════════════════════════
// ── 1. Import Customers ──
// ═══════════════════════════════════════════════════════════════

async function importCustomers(pool: pg.Pool): Promise<Map<string, number>> {
    console.log('\n── Importing Customers ──');

    const content = readFile('SCAN2PLAN_Customer Contact List_Chronoilogical.csv');
    const rows = parseCSV(content);

    // Row 0: title, Row 1: company, Row 2: blank (or date), Row 3: column headers
    // Data starts at row 4
    const dataStart = rows.findIndex(r => r[0]?.trim() === 'Customer full name') + 1;
    if (dataStart <= 0) throw new Error('Could not find column headers in Customer Contact List');

    let inserted = 0;
    let skipped = 0;

    for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        const customerName = col(r, 0);
        if (!customerName) continue;

        const email = col(r, 2) || null;
        const company = col(r, 6) || null;
        const firstName = col(r, 9) || null;
        const lastName = col(r, 10) || null;
        const phone = col(r, 12) || null;
        const website = col(r, 13) || null;
        const terms = col(r, 14) || null;
        const createdBy = col(r, 25) || null;
        const note = col(r, 27) || null;

        // Build bill address from components (cols 23=street, 20=city, 22=state, 24=zip, 21=country)
        const billParts = [col(r, 23), col(r, 20), col(r, 22), col(r, 24), col(r, 21)].filter(Boolean);
        const billAddress = billParts.length > 0 ? billParts.join(', ') : (col(r, 4) || null);

        // Ship address from components (cols 18=street, 15=city, 17=state, 19=zip, 16=country)
        const shipParts = [col(r, 18), col(r, 15), col(r, 17), col(r, 19), col(r, 16)].filter(Boolean);
        const shipAddress = shipParts.length > 0 ? shipParts.join(', ') : (col(r, 5) || null);

        const createdOn = parseQBODate(col(r, 7));

        try {
            await pool.query(
                `INSERT INTO qbo_customers
                    (customer_name, company, email, phone, bill_address, ship_address,
                     first_name, last_name, website, terms, note, qbo_created_on, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                 ON CONFLICT (customer_name) DO NOTHING`,
                [customerName, company, email, phone, billAddress, shipAddress,
                 firstName, lastName, website, terms, note,
                 createdOn, createdBy]
            );
            inserted++;
        } catch (err: any) {
            if (err.code === '23505') { skipped++; } // unique violation
            else { console.error(`  ⚠ Row ${i}: ${err.message}`); skipped++; }
        }
    }

    // Build name→id map
    const { rows: dbRows } = await pool.query('SELECT id, customer_name FROM qbo_customers');
    const customerMap = new Map<string, number>();
    for (const row of dbRows) {
        customerMap.set(row.customer_name, row.id);
    }

    console.log(`  ✓ ${inserted} customers imported, ${skipped} skipped, ${customerMap.size} total in DB`);
    return customerMap;
}

// ═══════════════════════════════════════════════════════════════
// ── 2. Import Sales Transactions ──
// ═══════════════════════════════════════════════════════════════

async function importSalesTransactions(pool: pg.Pool, customerMap: Map<string, number>): Promise<number> {
    console.log('\n── Importing Sales Transactions ──');

    const content = readFile('SCAN2PLAN_Sales by Customer DetaiL_LARGE.csv');
    const rows = parseCSV(content);

    // Find column headers row (starts with empty, then "Transaction date")
    const headerIdx = rows.findIndex(r => col(r, 1) === 'Transaction date');
    if (headerIdx < 0) throw new Error('Could not find column headers in Sales CSV');

    let currentCustomer = '';
    let inserted = 0;
    let skipped = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const firstCol = col(r, 0);

        // Customer header row: non-empty first col, no date in second col
        if (firstCol && !firstCol.startsWith('Total for') && !col(r, 1)) {
            currentCustomer = firstCol;
            continue;
        }

        // Skip total rows
        if (firstCol.startsWith('Total for')) continue;

        // Transaction row: empty first col, has date
        const dateStr = parseQBODate(col(r, 1));
        if (!dateStr) continue;

        const amount = parseCurrency(col(r, 7));
        if (amount === null) continue; // Must have amount

        const customerId = customerMap.get(currentCustomer) || null;

        try {
            await pool.query(
                `INSERT INTO qbo_sales_transactions
                    (customer_id, customer_name, transaction_date, transaction_type, num,
                     description, quantity, sales_price, amount, balance,
                     account_name, product_service, subject, message)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                [
                    customerId,
                    currentCustomer,
                    dateStr,
                    col(r, 2) || null,  // transaction_type
                    col(r, 3) || null,  // num
                    col(r, 4) || null,  // description (memo)
                    parseCurrency(col(r, 5)),   // quantity
                    parseCurrency(col(r, 6)),   // sales_price
                    amount,
                    parseCurrency(col(r, 8)),   // balance
                    col(r, 10) || null, // account_name
                    col(r, 14) || null, // product/service
                    col(r, 13) || null, // subject
                    col(r, 12) || null, // message
                ]
            );
            inserted++;
        } catch (err: any) {
            console.error(`  ⚠ Row ${i}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`  ✓ ${inserted} transactions imported, ${skipped} skipped`);
    return inserted;
}

// ═══════════════════════════════════════════════════════════════
// ── 3. Import Estimates ──
// ═══════════════════════════════════════════════════════════════

async function importEstimates(pool: pg.Pool, customerMap: Map<string, number>): Promise<number> {
    console.log('\n── Importing Estimates ──');

    const content = readFile('SCAN2PLAN_Estimates by Customer (1).csv');
    const rows = parseCSV(content);

    // Find column headers (starts with empty, then "Date", then "Num")
    const headerIdx = rows.findIndex(r => col(r, 1) === 'Date' && col(r, 2) === 'Num');
    if (headerIdx < 0) throw new Error('Could not find column headers in Estimates CSV');

    let currentCustomer = '';
    let inserted = 0;
    let skipped = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const firstCol = col(r, 0);

        // Customer header row
        if (firstCol && !firstCol.startsWith('Total for') && !col(r, 1)) {
            currentCustomer = firstCol;
            continue;
        }

        // Skip total rows
        if (firstCol.startsWith('Total for')) continue;

        // Estimate row
        const dateStr = parseQBODate(col(r, 1));
        if (!dateStr) continue;

        const amount = parseCurrency(col(r, 7));
        if (amount === null) continue;

        const customerId = customerMap.get(currentCustomer) || null;
        const acceptedOn = parseQBODate(col(r, 4));
        const createdOn = parseQBODate(col(r, 9));

        try {
            await pool.query(
                `INSERT INTO qbo_estimates
                    (customer_id, customer_name, estimate_date, num, status,
                     accepted_on, accepted_by, invoice_number, amount,
                     bill_to, message, subject, description, qbo_created_on)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                [
                    customerId,
                    currentCustomer,
                    dateStr,
                    col(r, 2) || null,   // num
                    col(r, 3) || null,   // status
                    acceptedOn,           // accepted_on
                    col(r, 5) || null,   // accepted_by
                    col(r, 6) || null,   // invoice_number
                    amount,
                    col(r, 8) || null,   // bill_to (may have newlines)
                    col(r, 10) || null,  // message (may have newlines)
                    col(r, 21) || null,  // subject
                    col(r, 15) || null,  // description (memo)
                    createdOn,           // qbo_created_on
                ]
            );
            inserted++;
        } catch (err: any) {
            console.error(`  ⚠ Row ${i}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`  ✓ ${inserted} estimates imported, ${skipped} skipped`);
    return inserted;
}

// ═══════════════════════════════════════════════════════════════
// ── 4. Import P&L Monthly ──
// ═══════════════════════════════════════════════════════════════

const PNL_CATEGORY_MARKERS: Record<string, string> = {
    'Income': 'Income',
    'Cost of Goods Sold': 'COGS',
    'Gross Profit': '_skip',
    'Expenses': 'Expenses',
    'Net Operating Income': '_skip',
    'Other Income': 'Other Income',
    'Other Expenses': 'Other Expenses',
    'Net Other Income': '_skip',
    'Net Income': '_computed',
};

const PNL_SKIP_ROWS = new Set([
    'Income', 'Cost of Goods Sold', 'Gross Profit', 'Expenses',
    'Net Operating Income', 'Other Income', 'Other Expenses',
    'Net Other Income', 'Net Income',
]);

async function importPnlMonthly(pool: pg.Pool): Promise<number> {
    console.log('\n── Importing P&L Monthly ──');

    const content = readFile('SCAN2PLAN_Profit and Loss by Month (1).csv');
    const rows = parseCSV(content);

    // Find column headers row ("Distribution account", "January 2020", ...)
    const headerIdx = rows.findIndex(r => col(r, 0) === 'Distribution account');
    if (headerIdx < 0) throw new Error('Could not find column headers in P&L CSV');

    const headers = rows[headerIdx];
    // Parse month headers (skip col 0 = "Distribution account" and last col = "Total")
    const monthColumns: { idx: number; month: string }[] = [];
    for (let c = 1; c < headers.length; c++) {
        const m = parseMonthHeader(col(headers, c));
        if (m) monthColumns.push({ idx: c, month: m });
    }
    console.log(`  Found ${monthColumns.length} month columns (${monthColumns[0]?.month} → ${monthColumns[monthColumns.length - 1]?.month})`);

    let currentCategory = '';
    let inserted = 0;
    let skipped = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const account = col(r, 0);
        if (!account) continue;

        // Category markers
        if (PNL_CATEGORY_MARKERS[account] !== undefined) {
            currentCategory = PNL_CATEGORY_MARKERS[account];
            continue;
        }

        // Skip "Total for X" rows
        if (account.startsWith('Total for')) continue;

        // Skip section headers without data
        if (PNL_SKIP_ROWS.has(account)) continue;

        // Skip if we're in a _skip zone
        if (currentCategory === '_skip' || currentCategory === '_computed') continue;

        // Check if this row has any non-zero amounts
        const hasData = monthColumns.some(mc => {
            const v = parseCurrency(col(r, mc.idx));
            return v !== null && v !== 0;
        });
        if (!hasData) continue;

        // Insert a row for each month with a non-zero value
        for (const mc of monthColumns) {
            const amount = parseCurrency(col(r, mc.idx));
            if (amount === null || amount === 0) continue;

            try {
                await pool.query(
                    `INSERT INTO qbo_pnl_monthly (account, account_category, month, amount)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (account, month) DO UPDATE SET amount = $4, account_category = $2`,
                    [account, currentCategory, mc.month, amount]
                );
                inserted++;
            } catch (err: any) {
                console.error(`  ⚠ ${account} / ${mc.month}: ${err.message}`);
                skipped++;
            }
        }
    }

    console.log(`  ✓ ${inserted} P&L monthly rows imported, ${skipped} skipped`);
    return inserted;
}

// ═══════════════════════════════════════════════════════════════
// ── 5. Import Balance Sheet ──
// ═══════════════════════════════════════════════════════════════

async function importBalanceSheet(pool: pg.Pool): Promise<number> {
    console.log('\n── Importing Balance Sheet ──');

    const content = readFile('SCAN2PLAN_Balance Sheet.csv');
    const rows = parseCSV(content);

    // Extract snapshot date from row 2: "As of February 17, 2026"
    const dateRow = col(rows[2], 0);
    const dateMatch = dateRow.match(/(\w+)\s+(\d+),\s+(\d{4})/);
    let snapshotDate = '2026-02-17';
    if (dateMatch) {
        const m = MONTH_MAP[dateMatch[1]] || '02';
        snapshotDate = `${dateMatch[3]}-${m}-${dateMatch[2].padStart(2, '0')}`;
    }
    console.log(`  Snapshot date: ${snapshotDate}`);

    // Find column headers
    const headerIdx = rows.findIndex(r => col(r, 0) === 'Distribution account');
    if (headerIdx < 0) throw new Error('Could not find column headers in Balance Sheet CSV');

    const CATEGORY_NAMES = new Set(['Assets', 'Liabilities and Equity', 'Liabilities', 'Equity']);
    let currentCategory = '';
    const subcategoryStack: string[] = [];

    let inserted = 0;
    let skipped = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const account = col(r, 0);
        if (!account) continue;

        // Skip "Total for X" — pop the subcategory stack
        if (account.startsWith('Total for')) {
            if (subcategoryStack.length > 0) subcategoryStack.pop();
            continue;
        }

        // Skip "Accrual Basis..." footer
        if (account.startsWith('Accrual Basis')) break;

        const amountStr = col(r, 1);
        const amount = parseCurrency(amountStr);

        // Category headers
        if (account === 'Assets') { currentCategory = 'Assets'; continue; }
        if (account === 'Liabilities and Equity') { continue; } // just a transition
        if (account === 'Liabilities') { currentCategory = 'Liabilities'; continue; }
        if (account === 'Equity') { currentCategory = 'Equity'; continue; }

        // If no amount value → subcategory header, push to stack
        if (!amountStr || amountStr.trim() === '') {
            subcategoryStack.push(account);
            continue;
        }

        // Data row — insert
        const subcategory = subcategoryStack.length > 0
            ? subcategoryStack[subcategoryStack.length - 1]
            : currentCategory;

        try {
            await pool.query(
                `INSERT INTO qbo_balance_sheet (account, account_category, account_subcategory, total, snapshot_date)
                 VALUES ($1, $2, $3, $4, $5)`,
                [account, currentCategory, subcategory, amount, snapshotDate]
            );
            inserted++;
        } catch (err: any) {
            console.error(`  ⚠ ${account}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`  ✓ ${inserted} balance sheet rows imported, ${skipped} skipped`);
    return inserted;
}

// ═══════════════════════════════════════════════════════════════
// ── 6. Import Expenses by Vendor ──
// ═══════════════════════════════════════════════════════════════

async function importVendorExpenses(
    pool: pg.Pool,
    filename: string,
    period: string,
): Promise<number> {
    const content = readFile(filename);
    const rows = parseCSV(content);

    // Parse date range from row 2: "January 1, 2020-February 17, 2026" or "February 17, 2025-February 17, 2026"
    const dateRange = col(rows[2], 0);
    const rangeMatch = dateRange.match(/(\w+\s+\d+,\s+\d{4})\s*-\s*(\w+\s+\d+,\s+\d{4})/);
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (rangeMatch) {
        const parseQBODateStr = (s: string) => {
            const m = s.match(/(\w+)\s+(\d+),\s+(\d{4})/);
            if (!m) return null;
            const mm = MONTH_MAP[m[1]] || '01';
            return `${m[3]}-${mm}-${m[2].padStart(2, '0')}`;
        };
        periodStart = parseQBODateStr(rangeMatch[1]);
        periodEnd = parseQBODateStr(rangeMatch[2]);
    }

    // Find column headers
    const headerIdx = rows.findIndex(r => col(r, 0) === 'Vendor');
    if (headerIdx < 0) throw new Error(`Could not find column headers in ${filename}`);

    let inserted = 0;
    let skipped = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const vendor = col(r, 0);
        const total = parseCurrency(col(r, 1));

        // Skip blank vendor (grand total row) and rows without amounts
        if (!vendor || total === null) { skipped++; continue; }

        // Skip footer
        if (vendor.startsWith('Accrual Basis')) break;

        try {
            await pool.query(
                `INSERT INTO qbo_expenses_by_vendor (vendor, total, period, period_start, period_end)
                 VALUES ($1, $2, $3, $4, $5)`,
                [vendor, total, period, periodStart, periodEnd]
            );
            inserted++;
        } catch (err: any) {
            console.error(`  ⚠ ${vendor}: ${err.message}`);
            skipped++;
        }
    }

    return inserted;
}

async function importExpensesByVendor(pool: pg.Pool): Promise<number> {
    console.log('\n── Importing Expenses by Vendor ──');

    const allTime = await importVendorExpenses(
        pool,
        'SCAN2PLAN_Expenses by Vendor Summary_all time.csv',
        'all_time'
    );
    console.log(`  ✓ ${allTime} vendors (all-time)`);

    const trailing = await importVendorExpenses(
        pool,
        'SCAN2PLAN_Expenses by Vendor Summary_12mo_trailing_021726.csv',
        'trailing_12mo'
    );
    console.log(`  ✓ ${trailing} vendors (trailing 12mo)`);

    return allTime + trailing;
}

// ═══════════════════════════════════════════════════════════════
// ── Main ──
// ═══════════════════════════════════════════════════════════════

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   S2PX Financial Data Seed — QBO CSV Import     ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`\nDatabase: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
    console.log(`Records:  ${RECORDS_DIR}\n`);

    // Verify files exist
    const requiredFiles = [
        'SCAN2PLAN_Customer Contact List_Chronoilogical.csv',
        'SCAN2PLAN_Sales by Customer DetaiL_LARGE.csv',
        'SCAN2PLAN_Estimates by Customer (1).csv',
        'SCAN2PLAN_Profit and Loss by Month (1).csv',
        'SCAN2PLAN_Balance Sheet.csv',
        'SCAN2PLAN_Expenses by Vendor Summary_all time.csv',
        'SCAN2PLAN_Expenses by Vendor Summary_12mo_trailing_021726.csv',
    ];

    for (const f of requiredFiles) {
        const fp = path.join(RECORDS_DIR, f);
        if (!fs.existsSync(fp)) {
            console.error(`❌ Missing file: ${fp}`);
            process.exit(1);
        }
    }
    console.log('✓ All CSV files found');

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 3,
    });

    try {
        // Test connection
        const { rows: [{ now }] } = await pool.query('SELECT NOW()');
        console.log(`✓ Connected to Neon (${now})`);

        // Truncate all QBO tables
        console.log('\n── Truncating existing QBO data ──');
        await pool.query(`
            TRUNCATE qbo_sales_transactions, qbo_estimates,
                     qbo_pnl_monthly, qbo_balance_sheet,
                     qbo_expenses_by_vendor, qbo_customers
            RESTART IDENTITY CASCADE
        `);
        console.log('  ✓ All QBO tables truncated');

        // Import in dependency order
        const customerMap = await importCustomers(pool);
        const salesCount = await importSalesTransactions(pool, customerMap);
        const estimateCount = await importEstimates(pool, customerMap);
        const pnlCount = await importPnlMonthly(pool);
        const bsCount = await importBalanceSheet(pool);
        const vendorCount = await importExpensesByVendor(pool);

        // Final counts
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║              Import Summary                      ║');
        console.log('╠══════════════════════════════════════════════════╣');

        const tables = [
            'qbo_customers', 'qbo_sales_transactions', 'qbo_estimates',
            'qbo_pnl_monthly', 'qbo_balance_sheet', 'qbo_expenses_by_vendor',
        ];
        for (const t of tables) {
            const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM ${t}`);
            console.log(`║  ${t.padEnd(30)} ${String(count).padStart(8)} rows  ║`);
        }
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\n✅ Financial data seed complete!');
    } catch (err) {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
