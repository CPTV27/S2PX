import type { Express } from 'express';
import { registerHealthRoutes } from './routes/health.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerScopingRoutes } from './routes/scoping.js';
import authRoutes from './routes/auth.js';
import quoteRoutes from './routes/quotes.js';
import proposalRoutes from './routes/proposals.js';
import qboRoutes from './routes/quickbooks.js';
import productionRoutes from './routes/production.js';
import assetRoutes from './routes/assets.js';
import leadRoutes from './routes/leads.js';
import projectBrowseRoutes from './routes/projects-browse.js';
import cpqRoutes from './routes/cpq.js';
import scorecardRoutes from './routes/scorecard.js';

export async function registerRoutes(app: Express) {
    registerHealthRoutes(app);
    app.use('/api/auth', authRoutes);
    registerUploadRoutes(app);
    registerScopingRoutes(app);
    app.use('/api/leads', leadRoutes);
    app.use('/api/projects', projectBrowseRoutes);
    app.use('/api/cpq', cpqRoutes);
    app.use('/api', cpqRoutes); // also mount /api/products
    app.use('/api/quotes', quoteRoutes);
    app.use('/api/proposals', proposalRoutes);
    app.use('/api/qbo', qboRoutes);
    app.use('/api/production', productionRoutes);
    app.use('/api/production', assetRoutes); // /api/production/:id/assets/*
    app.use('/api/scorecard', scorecardRoutes);
}
