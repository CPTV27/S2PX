/**
 * Phase 15 — QBO Financial Data Ingestion
 *
 * Parses 7 QBO CSV exports and loads them into the 6 financial tables.
 * Run: npx tsx server/scripts/ingest-qbo-financials.ts
 *
 * CSV files parsed (from /Financial Records/):
 *   1. Customer Contact List  → qbo_customers
 *   2. Sales by Customer LARGE → qbo_sales_transactions
 *   3. Estimates by Customer   → qbo_estimates
 *   4. P&L by Month            → qbo_pnl_monthly (pivoted wide → tall)
 *   5. Expenses All Time        → qbo_expenses_by_vendor (period=all_time)
 *   6. Expenses 12mo Trailing   → qbo_expenses_by_vendor (period=trailing_12mo)
 *   7. Balance Sheet            → qbo_balance_sheet
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:wmh0PMUXgOrcGU9qvNFqZJX@localhost:5433/s2px';

const BASE_DIR = path.resolve(__dirname, '../../Financial Records');

// ── Utility helpers ──

function parseQBOAmount(raw: string): number {
    if (!raw || raw.trim() === '') return 0;
    // Remove $, quotes, commas, whitespace; keep negative sign
    const cleaned = raw.replace(/[$",\s]/g, '').trim();
    if (cleaned === '' || cleaned === '-') return 0;
    return parseFloat(cleaned) || 0;
}

function parseQBODate(raw: string): string | null {
    if (!raw || raw.trim() === '') return null;
    const s = raw.trim();
    // MM/DD/YYYY or MM/DD/YYYY HH:MM:SS AM/PM
    const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const [, mm, dd, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Parse CSV handling quoted fields with commas and newlines.
 * Returns an array of rows, each row an array of string fields.
 */
function parseCSV(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    // Normalize line endings
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field);
                field = '';
            } else if (ch === '\n') {
                row.push(field);
                field = '';
                rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
    }
    // Last field/row
    if (field || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function readCSV(filename: string): string[][] {
    const filepath = path.join(BASE_DIR, filename);
    if (!fs.existsSync(filepath)) {
        console.error(`  ✗ File not found: ${filepath}`);
        return [];
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    return parseCSV(content);
}

// ── DDL ──

const DDL = `
-- QBO Customers
CREATE TABLE IF NOT EXISTS qbo_customers (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL UNIQUE,
    company TEXT,
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    bill_address TEXT,
    ship_address TEXT,
    website TEXT,
    terms TEXT,
    note TEXT,
    created_by TEXT,
    qbo_created_on TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- QBO Sales Transactions
CREATE TABLE IF NOT EXISTS qbo_sales_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES qbo_customers(id),
    customer_name TEXT NOT NULL,
    transaction_date DATE,
    transaction_type TEXT,
    num TEXT,
    description TEXT,
    quantity NUMERIC(10,2),
    sales_price NUMERIC(12,2),
    amount NUMERIC(12,2) NOT NULL,
    balance NUMERIC(12,2),
    account_name TEXT,
    product_service TEXT,
    subject TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- QBO Estimates
CREATE TABLE IF NOT EXISTS qbo_estimates (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES qbo_customers(id),
    customer_name TEXT NOT NULL,
    estimate_date DATE,
    num TEXT,
    status TEXT,
    accepted_on DATE,
    accepted_by TEXT,
    invoice_number TEXT,
    amount NUMERIC(12,2),
    subject TEXT,
    memo TEXT,
    bill_to TEXT,
    created_on TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- QBO P&L Monthly (tall format)
CREATE TABLE IF NOT EXISTS qbo_pnl_monthly (
    id SERIAL PRIMARY KEY,
    account TEXT NOT NULL,
    account_category TEXT NOT NULL,
    month TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS qbo_pnl_account_month_idx ON qbo_pnl_monthly (account, month);

-- QBO Expenses by Vendor
CREATE TABLE IF NOT EXISTS qbo_expenses_by_vendor (
    id SERIAL PRIMARY KEY,
    vendor TEXT NOT NULL,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'all_time',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- QBO Balance Sheet
CREATE TABLE IF NOT EXISTS qbo_balance_sheet (
    id SERIAL PRIMARY KEY,
    account TEXT NOT NULL,
    account_category TEXT NOT NULL,
    account_subcategory TEXT,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    snapshot_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
`;

// ── Table-specific ingestion ──

async function ingestCustomers(client: pg.Client) {
    console.log('\n── Ingesting Customers ──');
    const rows = readCSV('SCAN2PLAN_Customer Contact List_Chronoilogical.csv');
    if (rows.length === 0) return;

    // Skip first 2 metadata rows; row index 2 is the header
    // Header: Customer full name,Phone numbers,Email,Full name,Bill address,Ship address,Company,Created on,...
    const header = rows[2];
    const dataRows = rows.slice(3);

    await client.query('TRUNCATE qbo_customers CASCADE');

    let inserted = 0;
    for (const r of dataRows) {
        const customerName = (r[0] || '').trim();
        if (!customerName) continue;

        const phone = (r[1] || '').trim();
        const email = (r[2] || '').trim();
        const billAddress = (r[4] || '').trim();
        const shipAddress = (r[5] || '').trim();
        const company = (r[6] || '').trim();
        const createdOn = (r[7] || '').trim();
        const firstName = (r[9] || '').trim();
        const lastName = (r[10] || '').trim();
        const website = (r[13] || '').trim();
        const terms = (r[14] || '').trim();
        const createdBy = (r[25] || '').trim();
        const note = (r[27] || '').trim();

        const qboCreatedOn = parseQBODate(createdOn);

        try {
            await client.query(
                `INSERT INTO qbo_customers (customer_name, company, email, phone, first_name, last_name, bill_address, ship_address, website, terms, note, created_by, qbo_created_on)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                 ON CONFLICT (customer_name) DO NOTHING`,
                [customerName, company || null, email || null, phone || null, firstName || null, lastName || null,
                 billAddress || null, shipAddress || null, website || null, terms || null, note || null,
                 createdBy || null, qboCreatedOn]
            );
            inserted++;
        } catch (e: any) {
            console.error(`  ⚠ Customer "${customerName}": ${e.message}`);
        }
    }
    console.log(`  ✓ Inserted ${inserted} customers`);
}

async function ingestSalesTransactions(client: pg.Client) {
    console.log('\n── Ingesting Sales Transactions ──');
    const rows = readCSV('SCAN2PLAN_Sales by Customer DetaiL_LARGE.csv');
    if (rows.length === 0) return;

    // Row 0-2 are metadata; row 3 is the header
    // Header: ,Transaction date,Transaction type,Num,Memo/Description,Quantity,Sales price,Amount,Balance,Transaction type,Account full name,Customer full name,Customer/Vendor message,Subject,Product/Service
    const dataRows = rows.slice(4);

    await client.query('TRUNCATE qbo_sales_transactions');

    // Build customer name → id map
    const custRes = await client.query('SELECT id, customer_name FROM qbo_customers');
    const custMap = new Map<string, number>();
    for (const r of custRes.rows) {
        custMap.set(r.customer_name.toLowerCase(), r.id);
    }

    let currentCustomer = '';
    let inserted = 0;
    let skipped = 0;
    const batchSize = 100;
    let batch: any[][] = [];

    const flushBatch = async () => {
        if (batch.length === 0) return;
        // Build multi-row INSERT
        const values: any[] = [];
        const placeholders: string[] = [];
        let idx = 1;
        for (const row of batch) {
            const ph = [];
            for (const v of row) {
                ph.push(`$${idx++}`);
                values.push(v);
            }
            placeholders.push(`(${ph.join(',')})`);
        }
        await client.query(
            `INSERT INTO qbo_sales_transactions (customer_id, customer_name, transaction_date, transaction_type, num, description, quantity, sales_price, amount, balance, account_name, product_service, subject)
             VALUES ${placeholders.join(',')}`,
            values
        );
        inserted += batch.length;
        batch = [];
    };

    for (const r of dataRows) {
        const col0 = (r[0] || '').trim();
        const col1 = (r[1] || '').trim();

        // Customer group header: col0 has text, col1 is empty → set current customer
        if (col0 && !col1 && !col0.startsWith('Total for ') && !col0.startsWith('TOTAL')) {
            currentCustomer = col0;
            continue;
        }

        // Skip "Total for X" rows, blank rows, TOTAL row
        if (col0.startsWith('Total for ') || col0 === 'TOTAL' || col0 === '') {
            // Only skip if this is actually a total row or truly empty data
            if (!col1) {
                skipped++;
                continue;
            }
        }

        // Transaction data row: col0 is empty, col1 has date
        const transDate = parseQBODate(col1);
        if (!transDate) {
            skipped++;
            continue;
        }

        const transType = (r[2] || '').trim();
        const num = (r[3] || '').trim();
        const desc = (r[4] || '').trim();
        const qty = parseQBOAmount(r[5] || '');
        const price = parseQBOAmount(r[6] || '');
        const amount = parseQBOAmount(r[7] || '');
        const balance = parseQBOAmount(r[8] || '');
        const accountName = (r[10] || '').trim();
        const customerFullName = (r[11] || '').trim() || currentCustomer;
        const subject = (r[13] || '').trim();
        const productService = (r[14] || '').trim();

        const custId = custMap.get(customerFullName.toLowerCase()) || null;

        batch.push([
            custId, customerFullName, transDate, transType || null, num || null, desc || null,
            qty || null, price || null, amount, balance || null, accountName || null,
            productService || null, subject || null
        ]);

        if (batch.length >= batchSize) {
            await flushBatch();
        }
    }
    await flushBatch();

    console.log(`  ✓ Inserted ${inserted} sales transactions (skipped ${skipped} non-data rows)`);
}

async function ingestEstimates(client: pg.Client) {
    console.log('\n── Ingesting Estimates ──');
    const rows = readCSV('SCAN2PLAN_Estimates by Customer (1).csv');
    if (rows.length === 0) return;

    // Rows 0-2 metadata; row 3 header
    // Header: ,Date,Num,Estimate status,Accepted on,Accepted by,Invoice number,Amount,Bill to,Created on,...,Memo/Description,...,Subject,...
    const dataRows = rows.slice(4);

    await client.query('TRUNCATE qbo_estimates');

    const custRes = await client.query('SELECT id, customer_name FROM qbo_customers');
    const custMap = new Map<string, number>();
    for (const r of custRes.rows) {
        custMap.set(r.customer_name.toLowerCase(), r.id);
    }

    let currentCustomer = '';
    let inserted = 0;
    let skipped = 0;

    for (const r of dataRows) {
        const col0 = (r[0] || '').trim();
        const col1 = (r[1] || '').trim();

        // Customer group header
        if (col0 && !col1 && !col0.startsWith('Total for ') && !col0.startsWith('TOTAL')) {
            currentCustomer = col0;
            continue;
        }

        if (col0.startsWith('Total for ') || col0 === 'TOTAL' || (!col0 && !col1)) {
            skipped++;
            continue;
        }

        const estDate = parseQBODate(col1);
        if (!estDate) {
            skipped++;
            continue;
        }

        const num = (r[2] || '').trim();
        const status = (r[3] || '').trim();
        const acceptedOn = parseQBODate(r[4] || '');
        const acceptedBy = (r[5] || '').trim();
        const invoiceNum = (r[6] || '').trim();
        const amount = parseQBOAmount(r[7] || '');
        const billTo = (r[8] || '').trim();
        const createdOn = (r[9] || '').trim();
        const memo = (r[15] || '').trim();
        const subject = (r[21] || '').trim();

        const customerName = currentCustomer;
        const custId = custMap.get(customerName.toLowerCase()) || null;
        const createdOnTs = parseQBODate(createdOn);

        try {
            await client.query(
                `INSERT INTO qbo_estimates (customer_id, customer_name, estimate_date, num, status, accepted_on, accepted_by, invoice_number, amount, subject, memo, bill_to, created_on)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [custId, customerName, estDate, num || null, status || null,
                 acceptedOn, acceptedBy || null, invoiceNum || null, amount || null,
                 subject || null, memo || null, billTo || null, createdOnTs]
            );
            inserted++;
        } catch (e: any) {
            console.error(`  ⚠ Estimate "${num}" for "${customerName}": ${e.message}`);
        }
    }
    console.log(`  ✓ Inserted ${inserted} estimates (skipped ${skipped})`);
}

async function ingestPnlMonthly(client: pg.Client) {
    console.log('\n── Ingesting P&L by Month ──');
    const rows = readCSV('SCAN2PLAN_Profit and Loss by Month (1).csv');
    if (rows.length === 0) return;

    // Row 0-3 metadata; row 4 is the header
    // Header: Distribution account, January 2020, February 2020, ..., Total
    const headerRow = rows[4];
    if (!headerRow) { console.error('  ✗ No header row found'); return; }

    // Parse month columns from header (skip first col "Distribution account" and last col "Total")
    const months: string[] = [];
    for (let i = 1; i < headerRow.length - 1; i++) {
        const raw = headerRow[i].trim();
        if (!raw) continue;
        // Convert "January 2020" → "2020-01", "Feb 1 - Feb 20 2026" → "2026-02"
        const match = raw.match(/^(\w+)\s+(\d{4})$/);
        if (match) {
            const monthNames: Record<string, string> = {
                'January': '01', 'February': '02', 'March': '03', 'April': '04',
                'May': '05', 'June': '06', 'July': '07', 'August': '08',
                'September': '09', 'October': '10', 'November': '11', 'December': '12'
            };
            const mm = monthNames[match[1]];
            if (mm) {
                months.push(`${match[2]}-${mm}`);
                continue;
            }
        }
        // Partial month like "Feb 1 - Feb 20 2026"
        const partialMatch = raw.match(/(\d{4})$/);
        if (partialMatch) {
            const yearStr = partialMatch[1];
            const monthName = raw.match(/^(\w+)/)?.[1] || '';
            const monthNames2: Record<string, string> = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };
            const mm = monthNames2[monthName];
            if (mm) months.push(`${yearStr}-${mm}`);
            else months.push(`${yearStr}-99`); // fallback
        }
    }
    console.log(`  Found ${months.length} month columns (${months[0]} → ${months[months.length - 1]})`);

    await client.query('TRUNCATE qbo_pnl_monthly');

    const dataRows = rows.slice(5);

    // Category tracking based on QBO P&L section headers
    let currentCategory = 'Income';
    const sectionHeaders = new Set([
        'Income', 'Cost of Goods Sold', 'Expenses', 'Other Income', 'Other Expenses'
    ]);
    const categoryMap: Record<string, string> = {
        'Income': 'Income',
        'Cost of Goods Sold': 'COGS',
        'Expenses': 'Expenses',
        'Other Income': 'Other Income',
        'Other Expenses': 'Other Expenses',
    };

    // Skip rows: section headers, "Total for X", "Gross Profit", "Net Operating Income", "Net Other Income", "Net Income", blank
    const skipPrefixes = ['Total for ', 'Gross Profit', 'Net Operating Income', 'Net Other Income', 'Net Income'];

    let inserted = 0;
    let batchValues: any[] = [];
    let batchPlaceholders: string[] = [];
    let paramIdx = 1;

    const flushPnlBatch = async () => {
        if (batchPlaceholders.length === 0) return;
        await client.query(
            `INSERT INTO qbo_pnl_monthly (account, account_category, month, amount)
             VALUES ${batchPlaceholders.join(',')}
             ON CONFLICT (account, month) DO UPDATE SET amount = EXCLUDED.amount, account_category = EXCLUDED.account_category`,
            batchValues
        );
        inserted += batchPlaceholders.length;
        batchValues = [];
        batchPlaceholders = [];
        paramIdx = 1;
    };

    for (const r of dataRows) {
        const account = (r[0] || '').trim();
        if (!account) continue;

        // Check if this is a section header
        if (sectionHeaders.has(account)) {
            currentCategory = categoryMap[account] || account;
            continue;
        }

        // Skip total/summary rows
        if (skipPrefixes.some(p => account.startsWith(p))) continue;

        const cat = currentCategory;

        // Insert one row per month with a non-zero amount
        for (let i = 0; i < months.length; i++) {
            const val = parseQBOAmount(r[i + 1] || '');
            if (val === 0) continue;

            batchPlaceholders.push(`($${paramIdx},$${paramIdx + 1},$${paramIdx + 2},$${paramIdx + 3})`);
            batchValues.push(account, cat, months[i], val);
            paramIdx += 4;

            // Flush every 200 rows to avoid too many params
            if (batchPlaceholders.length >= 200) {
                await flushPnlBatch();
            }
        }
    }
    await flushPnlBatch();

    console.log(`  ✓ Inserted ${inserted} P&L rows`);
}

async function ingestExpenses(client: pg.Client) {
    console.log('\n── Ingesting Expenses by Vendor ──');

    await client.query('TRUNCATE qbo_expenses_by_vendor');

    // All-time expenses
    const allTimeRows = readCSV('SCAN2PLAN_Expenses by Vendor Summary_all time.csv');
    if (allTimeRows.length > 0) {
        // Rows 0-3 metadata; row 4 is header "Vendor,Total"; data starts at 5
        // But row 5 might be the grand total (no vendor), skip it
        const dataRows = allTimeRows.slice(5);
        let inserted = 0;
        for (const r of dataRows) {
            const vendor = (r[0] || '').trim();
            const total = parseQBOAmount(r[1] || '');
            if (!vendor || vendor === 'TOTAL' || vendor.startsWith('Accrual Basis')) continue;
            if (total === 0) continue;

            await client.query(
                `INSERT INTO qbo_expenses_by_vendor (vendor, total, period)
                 VALUES ($1, $2, 'all_time')`,
                [vendor, total]
            );
            inserted++;
        }
        console.log(`  ✓ Inserted ${inserted} all-time vendor expenses`);
    }

    // Trailing 12mo expenses
    const trailingRows = readCSV('SCAN2PLAN_Expenses by Vendor Summary_12mo_trailing_021726.csv');
    if (trailingRows.length > 0) {
        const dataRows = trailingRows.slice(5);
        let inserted = 0;
        for (const r of dataRows) {
            const vendor = (r[0] || '').trim();
            const total = parseQBOAmount(r[1] || '');
            if (!vendor || vendor === 'TOTAL' || vendor.startsWith('Accrual Basis')) continue;
            if (total === 0) continue;

            await client.query(
                `INSERT INTO qbo_expenses_by_vendor (vendor, total, period)
                 VALUES ($1, $2, 'trailing_12mo')`,
                [vendor, total]
            );
            inserted++;
        }
        console.log(`  ✓ Inserted ${inserted} trailing 12mo vendor expenses`);
    }
}

async function ingestBalanceSheet(client: pg.Client) {
    console.log('\n── Ingesting Balance Sheet ──');
    const rows = readCSV('SCAN2PLAN_Balance Sheet.csv');
    if (rows.length === 0) return;

    // Row 0-1 metadata; row 2: "As of February 17, 2026"
    const dateStr = (rows[2]?.[0] || '').replace(/^"?As of\s+/i, '').replace(/"$/, '').trim();
    // Parse "February 17, 2026"
    let snapshotDate: string | null = null;
    const dateMatch = dateStr.match(/(\w+)\s+(\d+),\s*(\d{4})/);
    if (dateMatch) {
        const monthNames: Record<string, string> = {
            'January': '01', 'February': '02', 'March': '03', 'April': '04',
            'May': '05', 'June': '06', 'July': '07', 'August': '08',
            'September': '09', 'October': '10', 'November': '11', 'December': '12'
        };
        const mm = monthNames[dateMatch[1]];
        if (mm) snapshotDate = `${dateMatch[3]}-${mm}-${dateMatch[2].padStart(2, '0')}`;
    }
    console.log(`  Snapshot date: ${snapshotDate}`);

    await client.query('TRUNCATE qbo_balance_sheet');

    // Rows 3 is blank; row 4 is header "Distribution account,Total"; data from row 5
    const dataRows = rows.slice(5);

    let currentCategory = '';
    let currentSubcategory = '';
    let inserted = 0;

    // Categories: Assets, Liabilities, Equity
    // Subcategories: Current Assets, Bank Accounts, Accounts Receivable, Other Current Assets, Fixed Assets, Other Assets
    //                Current Liabilities, Long-term Liabilities
    //                (Equity has no sub really, or 3300 Dividends Paid etc.)

    const topCategories = new Set(['Assets', 'Liabilities', 'Equity']);
    const subCategories = new Set([
        'Current Assets', 'Bank Accounts', 'Accounts Receivable', 'Other Current Assets',
        'Fixed Assets', 'Other Assets',
        'Current Liabilities', 'Accounts Payable', 'Credit Cards', 'Other Current Liabilities',
        'Long-term Liabilities',
    ]);

    for (const r of dataRows) {
        const account = (r[0] || '').trim();
        const totalStr = (r[1] || '').trim();

        if (!account) continue;

        // Skip "Total for X" rows, blank totals as section headers, footer
        if (account.startsWith('Total for ') || account === 'TOTAL' || account.startsWith('Accrual Basis')) continue;
        if (account === 'Total for Liabilities and Equity') continue;
        if (account === 'Net Income') {
            // Special: Net Income goes into Equity
            const total = parseQBOAmount(totalStr);
            await client.query(
                `INSERT INTO qbo_balance_sheet (account, account_category, account_subcategory, total, snapshot_date)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['Net Income', 'Equity', null, total, snapshotDate]
            );
            inserted++;
            continue;
        }

        // Top-level category
        if (topCategories.has(account)) {
            currentCategory = account;
            currentSubcategory = '';
            continue;
        }

        // Subcategory
        if (subCategories.has(account)) {
            currentSubcategory = account;
            continue;
        }

        // Data row
        const total = parseQBOAmount(totalStr);
        if (total === 0 && !totalStr) continue; // Skip empty header-like rows

        await client.query(
            `INSERT INTO qbo_balance_sheet (account, account_category, account_subcategory, total, snapshot_date)
             VALUES ($1, $2, $3, $4, $5)`,
            [account, currentCategory || 'Unknown', currentSubcategory || null, total, snapshotDate]
        );
        inserted++;
    }
    console.log(`  ✓ Inserted ${inserted} balance sheet rows`);
}

// ── Main ──

async function main() {
    console.log('═══ S2PX Phase 15 — QBO Financial Data Ingestion ═══');
    console.log(`CSV source: ${BASE_DIR}`);

    // Verify files exist
    const files = [
        'SCAN2PLAN_Customer Contact List_Chronoilogical.csv',
        'SCAN2PLAN_Sales by Customer DetaiL_LARGE.csv',
        'SCAN2PLAN_Estimates by Customer (1).csv',
        'SCAN2PLAN_Profit and Loss by Month (1).csv',
        'SCAN2PLAN_Expenses by Vendor Summary_all time.csv',
        'SCAN2PLAN_Expenses by Vendor Summary_12mo_trailing_021726.csv',
        'SCAN2PLAN_Balance Sheet.csv',
    ];
    for (const f of files) {
        const fp = path.join(BASE_DIR, f);
        if (!fs.existsSync(fp)) {
            console.error(`✗ Missing: ${f}`);
        } else {
            const stat = fs.statSync(fp);
            console.log(`  ✓ ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
    }

    const client = new Client({ connectionString: DB_URL, ssl: false });
    await client.connect();
    console.log('\nConnected to database');

    // Create tables (DDL)
    console.log('\n── Creating tables ──');
    await client.query(DDL);
    console.log('  ✓ All 6 tables created');

    // Ingest in order (customers first for FK)
    await ingestCustomers(client);
    await ingestSalesTransactions(client);
    await ingestEstimates(client);
    await ingestPnlMonthly(client);
    await ingestExpenses(client);
    await ingestBalanceSheet(client);

    // Verification
    console.log('\n── Verification ──');
    const counts = [
        { table: 'qbo_customers', expected: '~556' },
        { table: 'qbo_sales_transactions', expected: '~5,000+' },
        { table: 'qbo_estimates', expected: '~1,500+' },
        { table: 'qbo_pnl_monthly', expected: '~3,000+' },
        { table: 'qbo_expenses_by_vendor', expected: '~1,000+' },
        { table: 'qbo_balance_sheet', expected: '~70+' },
    ];
    for (const { table, expected } of counts) {
        const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ${table}: ${res.rows[0].count} rows (expected ${expected})`);
    }

    // Revenue cross-check
    const revRes = await client.query(`SELECT SUM(amount) as total FROM qbo_sales_transactions WHERE account_name = '4000 Sales'`);
    console.log(`\n  Revenue cross-check (4000 Sales): $${Number(revRes.rows[0].total || 0).toLocaleString()}`);
    console.log('  Expected: ~$4,120,811.37');

    await client.end();
    console.log('\n═══ Ingestion complete ═══');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
