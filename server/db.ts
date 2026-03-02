import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../shared/schema/db.js';
import * as pricingSchema from '../shared/schema/pricing.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

const isLocal = process.env.DATABASE_URL?.includes('localhost') ||
                process.env.DATABASE_URL?.includes('127.0.0.1');

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Ensure unqualified table names resolve in environments where search_path is empty.
pool.on('connect', (client) => {
    client.query('SET search_path TO public').catch((error: Error) => {
        console.error('[db] failed to set search_path:', error.message);
    });
});

export const db = drizzle(pool, { schema: { ...schema, ...pricingSchema } });
