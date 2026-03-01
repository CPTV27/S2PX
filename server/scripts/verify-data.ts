import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://neondb_owner:npg_OgSaq5wyUi6E@ep-winter-lab-ah4py7xl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const tables = [
        'qbo_customers','qbo_sales_transactions','qbo_estimates',
        'qbo_pnl_monthly','qbo_balance_sheet','qbo_expenses_by_vendor',
        'scoping_forms','quotes','proposals','production_projects','users'
    ];

    console.log('═══ Data Verification ═══\n');
    for (const t of tables) {
        const {rows:[{count}]} = await pool.query('SELECT COUNT(*) FROM ' + t);
        console.log(t.padEnd(30), String(count).padStart(6));
    }

    const {rows: topCustomers} = await pool.query(
        'SELECT customer_name, company FROM qbo_customers WHERE company IS NOT NULL LIMIT 5'
    );
    console.log('\nSample customers with company:');
    topCustomers.forEach(r => console.log('  ', r.customer_name, '-', r.company));

    const {rows: recentSales} = await pool.query(
        'SELECT customer_name, transaction_date::date as dt, amount FROM qbo_sales_transactions ORDER BY transaction_date DESC LIMIT 5'
    );
    console.log('\nMost recent sales:');
    recentSales.forEach(r => console.log('  ', r.customer_name, r.dt, '$' + r.amount));

    const {rows: pnlSample} = await pool.query(
        "SELECT account, account_category, month, amount FROM qbo_pnl_monthly WHERE account = '4000 Sales' ORDER BY month DESC LIMIT 5"
    );
    console.log('\nRecent P&L - 4000 Sales:');
    pnlSample.forEach(r => console.log('  ', r.month, '$' + r.amount, '(' + r.account_category + ')'));

    const {rows: bsSample} = await pool.query(
        "SELECT account, account_category, account_subcategory, total FROM qbo_balance_sheet WHERE total::numeric != 0 LIMIT 8"
    );
    console.log('\nBalance Sheet (non-zero):');
    bsSample.forEach(r => console.log('  ', r.account_category, '/', r.account_subcategory, ':', r.account, '$' + r.total));

    const {rows: vendorSample} = await pool.query(
        "SELECT vendor, total, period FROM qbo_expenses_by_vendor WHERE period = 'all_time' ORDER BY total::numeric DESC LIMIT 5"
    );
    console.log('\nTop 5 vendors (all-time):');
    vendorSample.forEach(r => console.log('  ', r.vendor, '$' + r.total));

    await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
