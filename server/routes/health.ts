import type { Express } from 'express';
import { pool } from '../db.js';

export function registerHealthRoutes(app: Express) {
    app.get('/api/health', async (_req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
        } catch {
            res.status(503).json({ status: 'error', db: 'disconnected' });
        }
    });
}
