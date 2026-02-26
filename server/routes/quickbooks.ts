// ── QuickBooks Routes ──
// OAuth2 auth flow, Estimate CRUD, Invoice conversion.

import { Router } from 'express';
import crypto from 'crypto';
import { quickbooksClient } from '../lib/quickbooksClient.js';
import { db } from '../db.js';
import { quotes, scopingForms, scopeAreas } from '../../shared/schema/db.js';
import { eq } from 'drizzle-orm';
import type { LineItemShell } from '../../shared/types/lineItem.js';

const router = Router();

// ── OAuth2 ──

// GET /api/qbo/status — connection status
router.get('/status', async (_req, res) => {
    try {
        const configured = quickbooksClient.isConfigured();
        const connected = configured ? await quickbooksClient.isConnected() : false;
        const config = quickbooksClient.getConfig();
        const realmId = connected ? await quickbooksClient.getRealmId() : null;

        res.json({ configured, connected, ...config, realmId });
    } catch (error: any) {
        res.json({
            configured: quickbooksClient.isConfigured(),
            connected: false,
            error: error.message,
        });
    }
});

// GET /api/qbo/auth — start OAuth2 flow
router.get('/auth', (req, res) => {
    if (!quickbooksClient.isConfigured()) {
        return res.status(400).json({ message: 'QuickBooks credentials not configured' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    // Store state for CSRF validation — using a simple in-memory approach
    // In production, use session or a temp DB record
    (req as any).__qbState = state;
    qbStateStore.set(state, Date.now());

    const authUrl = quickbooksClient.getAuthUrl(state);
    res.json({ authUrl });
});

// Simple in-memory state store for CSRF protection (valid for 10 min)
const qbStateStore = new Map<string, number>();
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, ts] of qbStateStore) {
        if (ts < cutoff) qbStateStore.delete(key);
    }
}, 60_000);

// GET /api/qbo/callback — OAuth2 callback
router.get('/callback', async (req, res) => {
    try {
        const { code, state, realmId } = req.query;

        if (!code || !realmId) {
            return res.redirect('/dashboard/settings?qb_error=missing_params');
        }

        if (!state || !qbStateStore.has(state as string)) {
            console.error('[QBO] OAuth state mismatch — possible CSRF');
            return res.redirect('/dashboard/settings?qb_error=invalid_state');
        }

        qbStateStore.delete(state as string);

        await quickbooksClient.exchangeCodeForTokens(code as string, realmId as string);
        res.redirect('/dashboard/settings?qb_connected=true');
    } catch (error: any) {
        console.error('[QBO] Callback error:', error.message);
        res.redirect(`/dashboard/settings?qb_error=${encodeURIComponent(error.message)}`);
    }
});

// POST /api/qbo/disconnect — revoke tokens
router.post('/disconnect', async (_req, res) => {
    try {
        await quickbooksClient.disconnect();
        res.json({ message: 'QuickBooks disconnected' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ── Estimates ──

// POST /api/qbo/estimate/:quoteId — create QBO Estimate from a saved quote
router.post('/estimate/:quoteId', async (req, res) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const { forceResync } = req.body || {};

        // Load quote
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        if (!quote) return res.status(404).json({ message: 'Quote not found' });

        // Already synced?
        if (quote.qboEstimateId && !forceResync) {
            return res.status(409).json({
                message: 'Estimate already exists in QuickBooks',
                estimateId: quote.qboEstimateId,
                estimateNumber: quote.qboEstimateNumber,
            });
        }

        // Check connection
        const isConnected = await quickbooksClient.isConnected();
        if (!isConnected) {
            return res.status(401).json({ message: 'QuickBooks not connected', needsReauth: true });
        }

        // Load scoping form
        const [form] = await db.select().from(scopingForms).where(eq(scopingForms.id, quote.scopingFormId));
        if (!form) return res.status(404).json({ message: 'Scoping form not found' });

        // Build line items from quote
        const lineItems = (quote.lineItems as LineItemShell[]) || [];
        const qbLineItems = lineItems
            .filter(li => li.clientPrice !== null && li.clientPrice > 0)
            .map(li => ({
                description: li.description,
                quantity: 1,
                unitPrice: li.clientPrice!,
                amount: li.clientPrice!,
            }));

        if (qbLineItems.length === 0) {
            return res.status(400).json({ message: 'No priced line items to sync' });
        }

        // Create estimate
        const result = await quickbooksClient.createEstimate(
            form.clientCompany,
            form.projectName,
            qbLineItems,
            form.contactEmail,
        );

        // Update quote with QBO refs
        await db.update(quotes)
            .set({
                qboEstimateId: result.estimateId,
                qboEstimateNumber: result.estimateNumber,
                qboCustomerId: result.customerId,
                qboSyncedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(quotes.id, quoteId));

        console.log(`[QBO] Created estimate ${result.estimateNumber} for quote ${quoteId}`);

        res.json({
            message: 'Estimate created successfully',
            estimateId: result.estimateId,
            estimateNumber: result.estimateNumber,
            customerId: result.customerId,
            totalAmount: result.totalAmount,
        });
    } catch (error: any) {
        console.error('[QBO] Create estimate error:', error.message);
        res.status(500).json({ message: error.message || 'Failed to create estimate' });
    }
});

// GET /api/qbo/estimate/:quoteId — get estimate info for a quote
router.get('/estimate/:quoteId', async (req, res) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        if (!quote) return res.status(404).json({ message: 'Quote not found' });

        if (!quote.qboEstimateId) {
            return res.json({ synced: false });
        }

        const isConnected = await quickbooksClient.isConnected();
        const realmId = isConnected ? await quickbooksClient.getRealmId() : null;

        let estimateUrl: string | null = null;
        let estimateStatus: string | null = null;

        if (isConnected && realmId && quote.qboEstimateId) {
            estimateUrl = quickbooksClient.getEstimateUrl(quote.qboEstimateId, realmId);
            try {
                const estimate = await quickbooksClient.getEstimate(quote.qboEstimateId);
                estimateStatus = estimate.TxnStatus || 'Pending';
            } catch {
                estimateStatus = 'unknown';
            }
        }

        res.json({
            synced: true,
            estimateId: quote.qboEstimateId,
            estimateNumber: quote.qboEstimateNumber,
            customerId: quote.qboCustomerId,
            invoiceId: quote.qboInvoiceId,
            syncedAt: quote.qboSyncedAt,
            estimateUrl,
            estimateStatus,
            connected: isConnected,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// ── Invoices ──

// POST /api/qbo/invoice/:quoteId — convert Estimate → Invoice
router.post('/invoice/:quoteId', async (req, res) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        if (!quote) return res.status(404).json({ message: 'Quote not found' });

        if (!quote.qboEstimateId) {
            return res.status(400).json({ message: 'No QBO estimate exists for this quote. Create an estimate first.' });
        }

        if (quote.qboInvoiceId) {
            return res.status(409).json({
                message: 'Invoice already exists',
                invoiceId: quote.qboInvoiceId,
            });
        }

        const isConnected = await quickbooksClient.isConnected();
        if (!isConnected) {
            return res.status(401).json({ message: 'QuickBooks not connected', needsReauth: true });
        }

        const result = await quickbooksClient.convertEstimateToInvoice(quote.qboEstimateId);

        // Update quote with invoice ref
        await db.update(quotes)
            .set({
                qboInvoiceId: result.invoiceId,
                qboSyncedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(quotes.id, quoteId));

        // Update scoping form status to 'won'
        await db.update(scopingForms)
            .set({ status: 'won', updatedAt: new Date() })
            .where(eq(scopingForms.id, quote.scopingFormId));

        console.log(`[QBO] Converted estimate → invoice ${result.invoiceNumber} for quote ${quoteId}`);

        res.json({
            message: 'Invoice created successfully',
            invoiceId: result.invoiceId,
            invoiceNumber: result.invoiceNumber,
        });
    } catch (error: any) {
        console.error('[QBO] Create invoice error:', error.message);
        res.status(500).json({ message: error.message || 'Failed to create invoice' });
    }
});

// POST /api/qbo/email-estimate/:quoteId — email the estimate to the client
router.post('/email-estimate/:quoteId', async (req, res) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const { email } = req.body;

        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        if (!quote) return res.status(404).json({ message: 'Quote not found' });
        if (!quote.qboEstimateId) return res.status(400).json({ message: 'No estimate to email' });

        const [form] = await db.select().from(scopingForms).where(eq(scopingForms.id, quote.scopingFormId));
        const sendTo = email || form?.contactEmail;
        if (!sendTo) return res.status(400).json({ message: 'No email address provided' });

        await quickbooksClient.emailEstimate(quote.qboEstimateId, sendTo);

        res.json({ message: `Estimate emailed to ${sendTo}` });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
