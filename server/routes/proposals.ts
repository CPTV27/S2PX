// ── Proposal Routes ──
// Generate PDF proposals, email to clients, client portal access.

import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { proposals, quotes, scopingForms, scopeAreas, proposalTemplates } from '../../shared/schema/db';
import { eq } from 'drizzle-orm';
import type { TemplateData } from '../lib/proposalDataMapper';
import { generateProposalPDF } from '../pdf/proposalGenerator';
import { mapToProposalData } from '../lib/proposalDataMapper';
import { sendProposalEmail, buildProposalEmailHtml } from '../lib/emailSender';
import type { LineItemShell, QuoteTotals } from '../../shared/types/lineItem';

const router = Router();

// POST /api/proposals/:quoteId/generate — Generate a proposal PDF
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

        // TODO: Upload to GCS and store URL
        // For now, we store the PDF inline as base64 (will be replaced with GCS upload)
        const pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

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

// POST /api/proposals/:id/send — Email the proposal to the client
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

        // Build PDF attachment
        let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
        if (proposal.pdfUrl?.startsWith('data:application/pdf;base64,')) {
            const base64 = proposal.pdfUrl.replace('data:application/pdf;base64,', '');
            attachments = [{
                filename: `${form.upid}-proposal-v${proposal.version}.pdf`,
                content: Buffer.from(base64, 'base64'),
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

// GET /api/proposals/:quoteId/status — Get proposal status for a quote
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
            sentTo: p.sentTo,
            sentAt: p.sentAt,
            viewedAt: p.viewedAt,
            respondedAt: p.respondedAt,
            createdAt: p.createdAt,
        })));
    } catch (err) {
        console.error('Error fetching proposal status:', err);
        res.status(500).json({ message: 'Failed to fetch proposal status' });
    }
});

// GET /api/client-portal/:token — Client magic link (public, no auth)
router.get('/client-portal/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const [proposal] = await db.select().from(proposals)
            .where(eq(proposals.accessToken, token));

        if (!proposal) return res.status(404).json({ message: 'Proposal not found or link expired' });

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

        res.json({
            proposal: {
                id: proposal.id,
                status: proposal.viewedAt ? proposal.status : 'viewed',
                version: proposal.version,
                customMessage: proposal.customMessage,
                pdfUrl: proposal.pdfUrl,
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

export default router;
