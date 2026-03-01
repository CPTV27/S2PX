// ── Email Sender ──
// Sends proposal emails via nodemailer.
// Uses SMTP config from environment variables.

import nodemailer from 'nodemailer';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (transporter) return transporter;

    // Use env config — supports Gmail, SendGrid, or any SMTP
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!user || !pass) {
        console.warn('SMTP credentials not configured — email sending disabled');
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
    });

    return transporter;
}

export async function sendProposalEmail(options: SendEmailOptions): Promise<void> {
    const transport = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'proposals@scan2plan.com';

    await transport.sendMail({
        from: `Scan2Plan <${from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
    });
}

export function buildProposalEmailHtml(params: {
    contactName: string;
    projectName: string;
    clientCompany: string;
    totalPrice: number;
    portalUrl: string;
    customMessage?: string | null;
}): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
    <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; color: #1e40af; margin: 0;">Scan2Plan</h1>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">3D Scanning & BIM Services</p>
    </div>

    <p>Hi ${params.contactName},</p>

    <p>Thank you for your interest in working with Scan2Plan. Please find attached our proposal for <strong>${params.projectName}</strong>.</p>

    ${params.customMessage ? `<p style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; border-left: 3px solid #3b82f6;">${params.customMessage}</p>` : ''}

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #64748b; padding: 4px 0;">Project</td><td style="font-weight: 600;">${params.projectName}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">Client</td><td style="font-weight: 600;">${params.clientCompany}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">Investment</td><td style="font-weight: 700; color: #1e40af; font-size: 18px;">$${params.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
        </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
        <a href="${params.portalUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            View Full Proposal
        </a>
    </div>

    <p style="font-size: 13px; color: #64748b;">
        This proposal is valid for 30 days. If you have any questions, reply directly to this email.
    </p>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #94a3b8;">
        Scan2Plan | 3D Scanning & BIM Services<br>
        This email was sent to ${params.contactName} at ${params.clientCompany}.
    </div>
</body>
</html>`.trim();
}

// ── Scantech Link Email ──
// Sends a field technician a branded link to the Scantech mobile app.

interface SendScantechLinkOptions {
    to: string;
    techName: string;
    projectName: string;
    projectAddress: string;
    upid: string;
    linkUrl: string;
    expiresAt: Date;
}

export async function sendScantechLink(options: SendScantechLinkOptions): Promise<void> {
    const transport = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'field@scan2plan.com';

    const expiryStr = options.expiresAt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
    <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; color: #1e40af; margin: 0;">Scan2Plan</h1>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Field Operations</p>
    </div>

    <p>Hi ${options.techName},</p>

    <p>You've been assigned a field scanning project. Use the link below to access your checklist, upload photos/scans, and submit field notes — <strong>no login required</strong>.</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #64748b; padding: 4px 0;">Project</td><td style="font-weight: 600;">${options.projectName}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">UPID</td><td style="font-weight: 600; font-family: monospace;">${options.upid}</td></tr>
            ${options.projectAddress ? `<tr><td style="color: #64748b; padding: 4px 0;">Address</td><td style="font-weight: 600;">${options.projectAddress}</td></tr>` : ''}
        </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
        <a href="${options.linkUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 16px;">
            Open Field App
        </a>
    </div>

    <p style="font-size: 13px; color: #64748b;">
        This link expires <strong>${expiryStr}</strong>. If you need a new link, contact your project manager.
    </p>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #94a3b8;">
        Scan2Plan | Field Operations<br>
        This link was sent to ${options.techName} (${options.to}).
    </div>
</body>
</html>`.trim();

    await transport.sendMail({
        from: `Scan2Plan Field Ops <${from}>`,
        to: options.to,
        subject: `[Scan2Plan] Field Assignment: ${options.projectName} (${options.upid})`,
        html,
    });
}

// ── Client Response Notification ──
// Notifies the S2PX team when a client accepts a proposal or requests changes.

interface ClientResponseNotificationParams {
    projectName: string;
    clientCompany: string;
    upid: string;
    version: number;
    action: string; // 'accepted' | 'changes_requested'
    clientMessage?: string | null;
}

export async function sendClientResponseNotification(params: ClientResponseNotificationParams): Promise<void> {
    const notifyTo = process.env.SMTP_FROM || process.env.SMTP_USER || 'admin@scan2plan.io';
    const isAccepted = params.action === 'accepted';

    const statusLabel = isAccepted ? 'Accepted' : 'Changes Requested';
    const statusColor = isAccepted ? '#22c55e' : '#f59e0b';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
    <div style="border-bottom: 3px solid ${statusColor}; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 20px; color: #1e293b; margin: 0;">Proposal ${statusLabel}</h1>
        <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">${params.clientCompany} has responded to your proposal</p>
    </div>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%; font-size: 14px;">
            <tr><td style="color: #64748b; padding: 4px 0;">Project</td><td style="font-weight: 600;">${params.projectName}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">Client</td><td style="font-weight: 600;">${params.clientCompany}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">UPID</td><td style="font-weight: 600;">${params.upid}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">Version</td><td style="font-weight: 600;">v${params.version}</td></tr>
            <tr><td style="color: #64748b; padding: 4px 0;">Response</td><td style="font-weight: 700; color: ${statusColor};">${statusLabel}</td></tr>
        </table>
    </div>

    ${params.clientMessage ? `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 12px; font-weight: 600; color: #92400e; margin: 0 0 8px;">Client Message:</p>
        <p style="font-size: 14px; color: #1e293b; margin: 0;">${params.clientMessage}</p>
    </div>` : ''}

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #94a3b8;">
        S2PX Proposal System | Automated notification
    </div>
</body>
</html>`.trim();

    await sendProposalEmail({
        to: notifyTo,
        subject: `[${params.action === 'accepted' ? 'ACCEPTED' : 'CHANGES'}] ${params.projectName} (${params.upid}) — ${params.clientCompany}`,
        html,
    });
}
