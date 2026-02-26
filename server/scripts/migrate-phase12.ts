/**
 * Phase 12 migration — create upload_shares + upload_share_files tables
 * and ensure geo columns exist on scoping_forms.
 *
 * Run: npx tsx server/scripts/migrate-phase12.ts
 */
import pg from 'pg';
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:wmh0PMUXgOrcGU9qvNFqZJX@localhost:5433/s2px';

async function main() {
    const client = new Client({ connectionString: DB_URL, ssl: false });
    await client.connect();
    console.log('Connected to database');

    // Upload shares table
    await client.query(`
        CREATE TABLE IF NOT EXISTS upload_shares (
            id SERIAL PRIMARY KEY,
            production_project_id INTEGER NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            label TEXT,
            target_bucket TEXT NOT NULL,
            target_prefix TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id),
            expires_at TIMESTAMP NOT NULL,
            max_upload_bytes TEXT,
            total_uploaded_bytes TEXT DEFAULT '0',
            upload_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `);
    console.log('✓ upload_shares');

    // Upload share files table
    await client.query(`
        CREATE TABLE IF NOT EXISTS upload_share_files (
            id SERIAL PRIMARY KEY,
            share_id INTEGER NOT NULL REFERENCES upload_shares(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            gcs_path TEXT NOT NULL,
            size_bytes TEXT NOT NULL,
            content_type TEXT,
            uploaded_by_name TEXT,
            uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `);
    console.log('✓ upload_share_files');

    // Geo columns on scoping_forms (Phase 11)
    await client.query(`ALTER TABLE scoping_forms ADD COLUMN IF NOT EXISTS project_lat TEXT`);
    await client.query(`ALTER TABLE scoping_forms ADD COLUMN IF NOT EXISTS project_lng TEXT`);
    await client.query(`ALTER TABLE scoping_forms ADD COLUMN IF NOT EXISTS building_footprint_sqft TEXT`);
    console.log('✓ geo columns ensured');

    // Verify
    const res = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'upload%'"
    );
    console.log('Upload tables:', res.rows.map(r => r.table_name));

    await client.end();
    console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
