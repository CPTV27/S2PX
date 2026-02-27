// ── Proposal Routes ──
// Generate PDF proposals, upload to GCS, email to clients, client portal access.

import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import { db } from '../db';
import { proposals, quotes, scopingForms, scopeAreas, proposalTemplates } from '../../shared/schema/db';
import { eq } from 'drizzle-orm';
import type { TemplateData } from '../lib/proposalDataMapper';
import { generateProposalPDF } from '../pdf/proposalGenerator';
import { mapToProposalData } from '../lib/proposalDataMapper';
import { sendProposalEmail, buildProposalEmailHtml, sendClientResponseNotification } from '../lib/emailSender';
import type { LineItemShell, QuoteTotals } from '../../shared/types/lineItem';

const router = Router();
const GCS_BUCKET = process.env.GCS_BUCKET || 's2p-core-vault';

// ── Helpers ──

/** Upload PDF buffer to GCS and return the gcs path (not a signed URL). */
async function uploadPdfToGcs(pdfBuffer: Buffer, upid: string, version: number): Promise<string> {
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const timestamp = Date.now();
    const gcsPath = `proposals/${upid}/proposal-v${version}-${timestamp}.pdf`;
    const blob = bucket.file(gcsPath);

    await blob.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: { upid, version: String(version) },
    });

    return gcsPath;
}

/** Resolve a proposal's pdfUrl to a downloadable Buffer (handles both GCS path and legacy base64). */
async function resolvePdfBuffer(pdfUrl: string | null): Promise<Buffer | null> {
    if (!pdfUrl) return null;

    // Legacy base64 format
    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
        const base64 = pdfUrl.replace('data:application/pdf;base64,', '');
        return Buffer.from(base64, 'base64');
    }

    // GCS path
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const [buffer] = await bucket.file(pdfUrl).download();
    return buffer;
}

/** Generate a short-lived signed URL for a GCS path. Returns the URL directly for legacy base64. */
async function resolveSignedUrl(pdfUrl: string | null): Promise<string | null> {
    if (!pdfUrl) return null;

    // Legacy base64 — return as-is (client can handle data URIs)
    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
        return pdfUrl;
    }

    // GCS path — generate 1-hour signed URL
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const [signedUrl] = await bucket.file(pdfUrl).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
    return signedUrl;
}


// ══════════════════════════════════════════════════════════════
// POST /api/proposals/:quoteId/generate — Generate a proposal PDF
// ══════════════════════════════════════════════════════════════
router.post('/:quoteId/generate', async (req: Request, res: Response) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const { customMessage, templateId } = req.body;

        // Load quote
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
        if (!quote) return res.status(404).json({ message: 'Quote not found' });

        // Load scoping form + areas
        const [form] = await db.select().from(scopingForms).where(eq(scopingForms.id, quote.scopingFormId));
        if (!form) return res.status(404).json({ message: 'Scoping form not found' });

        const areas = await db.select().from(scopeAreas)
            .where(eq(scopeAreas.scopingFormId, form.id));

        // Load proposal template (by ID or active default)
        let template: TemplateData | null = null;
        if (templateId) {
            const [tpl] = await db.select().from(proposalTemplates)
                .where(eq(proposalTemplates.id, templateId));
            if (tpl) template = tpl as unknown as TemplateData;
        }
        if (!template) {
            const [tpl] = await db.select().from(proposalTemplates)
                .where(eq(proposalTemplates.isActive, true))
                .limit(1);
            if (tpl) template = tpl as unknown as TemplateData;
        }

        // Count existing proposals for versioning
        const existing = await db.select().from(proposals)
            .where(eq(proposals.quoteId, quoteId));
        const version = existing.length + 1;

        // Map data
        const proposalData = mapToProposalData({
            form: {
                ...form,
                upid: form.upid,
                areas: areas.map(a => ({
                    areaName: a.areaName,
                    areaType: a.areaType,
                    squareFootage: a.squareFootage,
                    projectScope: a.projectScope,
                    lod: a.lod,
                    structural: a.structural,
                    mepf: a.mepf,
                    cadDeliverable: a.cadDeliverable,
                    act: a.act,
                    belowFloor: a.belowFloor,
                })),
            },
            lineItems: quote.lineItems as LineItemShell[],
            totals: (quote.totals as QuoteTotals) || {
                totalClientPrice: 0,
                totalUpteamCost: 0,
                grossMargin: 0,
                grossMarginPercent: 0,
                integrityStatus: 'blocked',
                integrityFlags: [],
            },
            version,
            customMessage,
            template,
        });

        // Generate PDF
        const pdfBuffer = await generateProposalPDF(proposalData);

        // Generate access token for client portal
        const accessToken = crypto.randomBytes(32).toString('hex');

        // Upload PDF to GCS
        const upid = form.upid || `form-${form.id}`;
        const pdfUrl = await uploadPdfToGcs(pdfBuffer, upid, version);

        // Create proposal record
        const [proposal] = await db.insert(proposals).values({
            scopingFormId: form.id,
            quoteId,
            status: 'draft',
            pdfUrl,
            accessToken,
            customMessage: customMessage || null,
            version,
        }).returning();

        // Update scoping form status
        await db.update(scopingForms)
            .set({ status: 'quoted', updatedAt: new Date() })
            .where(eq(scopingForms.id, form.id));

        res.status(201).json({
            id: proposal.id,
            status: proposal.status,
            version: proposal.version,
            accessToken: proposal.accessToken,
            pdfSize: pdfBuffer.length,
        });
    } catch (err) {
        console.error('Error generating proposal:', err);
        res.status(500).json({ message: 'Failed to generate proposal' });
    }
});


// ══════════════════════════════════════════════════════════════
// POST /api/proposals/:id/send — Email the proposal to the client
// ══════════════════════════════════════════════════════════════
router.post('/:id/send', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { email } = req.body;

        const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
        if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

        // Load form for email content
        const [form] = await db.select().from(scopingForms)
            .where(eq(scopingForms.id, proposal.scopingFormId));
        if (!form) return res.status(404).json({ message: 'Form not found' });

        // Load quote for totals
        const [quote] = await db.select().from(quotes)
            .where(eq(quotes.id, proposal.quoteId));
        const totals = quote?.totals as QuoteTotals | null;

        const sendTo = email || form.contactEmail;
        const portalUrl = `${process.env.APP_URL || 'http://localhost:5173'}/client-portal/${proposal.accessToken}`;

        // Build email
        const html = buildProposalEmailHtml({
            contactName: form.primaryContactName,
            projectName: form.projectName,
            clientCompany: form.clientCompany,
            totalPrice: totals?.totalClientPrice || 0,
            portalUrl,
            customMessage: proposal.customMessage,
        });

        // Download PDF from GCS (or decode legacy base64) for email attachment
        let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
        const pdfBuffer = await resolvePdfBuffer(proposal.pdfUrl);
        if (pdfBuffer) {
            attachments = [{
                filename: `${form.upid}-proposal-v${proposal.version}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }];
        }

        // Send email
        await sendProposalEmail({
            to: sendTo,
            subject: `Scan2Plan Proposal: ${form.projectName} (${form.upid})`,
            html,
            attachments,
        });

        // Update proposal status
        await db.update(proposals)
            .set({ status: 'sent', sentTo: sendTo, sentAt: new Date(), updatedAt: new Date() })
            .where(eq(proposals.id, id));

        res.json({ sent: true, to: sendTo });
    } catch (err) {
        console.error('Error sending proposal:', err);
        res.status(500).json({ message: 'Failed to send proposal' });
    }
});


// ══════════════════════════════════════════════════════════════
// GET /api/proposals/:id/download — Download proposal PDF (authenticated)
// ══════════════════════════════════════════════════════════════
router.get('/:id/download', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
        if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

        const [form] = await db.select().from(scopingForms)
            .where(eq(scopingForms.id, proposal.scopingFormId));

        const pdfBuffer = await resolvePdfBuffer(proposal.pdfUrl);
        if (!pdfBuffer) return res.status(404).json({ message: 'PDF not found' });

        const filename = `${form?.upid || 'proposal'}-v${proposal.version}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Error downloading proposal:', err);
        res.status(500).json({ message: 'Failed to download proposal' });
    }
});


// ══════════════════════════════════════════════════════════════
// GET /api/proposals/:quoteId/status — Get proposal status for a quote
// ══════════════════════════════════════════════════════════════
router.get('/:quoteId/status', async (req: Request, res: Response) => {
    try {
        const quoteId = parseInt(req.params.quoteId, 10);
        const results = await db.select().from(proposals)
            .where(eq(proposals.quoteId, quoteId))
            .orderBy(proposals.createdAt);

        res.json(results.map(p => ({
            id: p.id,
            status: p.status,
            version: p.version,
            accessToken: p.accessToken,
            sentTo: p.sentTo,
            sentAt: p.sentAt,
            viewedAt: p.viewedAt,
            respondedAt: p.respondedAt,
            clientMessage: p.clientMessage,
            createdAt: p.createdAt,
        })));
    } catch (err) {
        console.error('Error fetching proposal status:', err);
        res.status(500).json({ message: 'Failed to fetch proposal status' });
    }
});


// ══════════════════════════════════════════════════════════════
// GET /api/proposals/client-portal/:token — Client magic link (public, no auth)
// ══════════════════════════════════════════════════════════════
router.get('/client-portal/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const [proposal] = await db.select().from(proposals)
            .where(eq(proposals.accessToken, token));

        if (!proposal) return res.status(404).json({ message: 'Proposal not found or link expired' });

        // Check expiry
        if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
            return res.status(410).json({ message: 'This proposal link has expired' });
        }

        // Mark as viewed if first time
        if (!proposal.viewedAt) {
            await db.update(proposals)
                .set({ status: 'viewed', viewedAt: new Date(), updatedAt: new Date() })
                .where(eq(proposals.id, proposal.id));
        }

        // Load form for display
        const [form] = await db.select().from(scopingForms)
            .where(eq(scopingForms.id, proposal.scopingFormId));

        const [quote] = await db.select().from(quotes)
            .where(eq(quotes.id, proposal.quoteId));

        // Generate signed URL for PDF (1 hour)
        const signedPdfUrl = await resolveSignedUrl(proposal.pdfUrl);

        res.json({
            proposal: {
                id: proposal.id,
                status: proposal.viewedAt ? proposal.status : 'viewed',
                version: proposal.version,
                customMessage: proposal.customMessage,
                pdfUrl: signedPdfUrl,
            },
            project: form ? {
                name: form.projectName,
                client: form.clientCompany,
                address: form.projectAddress,
                upid: form.upid,
            } : null,
            totals: quote?.totals || null,
        });
    } catch (err) {
        console.error('Error loading client portal:', err);
        res.status(500).json({ message: 'Failed to load proposal' });
    }
});


// ══════════════════════════════════════════════════════════════
// POST /api/proposals/client-portal/:token/respond — Client accepts or requests changes
// ══════════════════════════════════════════════════════════════
router.post('/client-portal/:token/respond', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { action, message } = req.body as { action: string; message?: string };

        if (!action || !['accepted', 'changes_requested'].includes(action)) {
            return res.status(400).json({ message: 'action must be "accepted" or "changes_requested"' });
        }

        const [proposal] = await db.select().from(proposals)
            .where(eq(proposals.accessToken, token));

        if (!proposal) return res.status(404).json({ message: 'Proposal not found or link expired' });

        // Check expiry
        if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
            return res.status(410).json({ message: 'This proposal link has expired' });
        }

        // Update proposal with client response
        await db.update(proposals).set({
            status: action,
            clientMessage: message || null,
            respondedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(proposals.id, proposal.id));

        // Load form for notification email
        const [form] = await db.select().from(scopingForms)
            .where(eq(scopingForms.id, proposal.scopingFormId));

        // Notify S2PX team
        if (form) {
            await sendClientResponseNotification({
                projectName: form.projectName || 'Unnamed Project',
                clientCompany: form.clientCompany || 'Unknown Client',
                upid: form.upid || '',
                version: proposal.version || 1,
                action,
                clientMessage: message,
            }).catch(err => console.error('Failed to send response notification:', err));
        }

        res.json({
            success: true,
            status: action,
        });
    } catch (err) {
        console.error('Error recording client response:', err);
        res.status(500).json({ message: 'Failed to record response' });
    }
});

export default router;
