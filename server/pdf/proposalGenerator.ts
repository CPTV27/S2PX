// ── Proposal PDF Generator ──
// Uses PDFKit to generate a professional proposal document.

import PDFDocument from 'pdfkit';
import type { ProposalData } from '../lib/proposalDataMapper';

// Colors
const BLUE = '#1e40af';
const DARK = '#1e293b';
const MEDIUM = '#64748b';
const LIGHT = '#f1f5f9';
const ACCENT = '#3b82f6';

export function generateProposalPDF(data: ProposalData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            info: {
                Title: `Proposal - ${data.projectName}`,
                Author: 'Scan2Plan',
                Subject: `${data.upid} - ${data.clientCompany}`,
            },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Page 1: Cover ──
        renderCover(doc, data);

        // ── Page 2: Scope Summary ──
        doc.addPage();
        renderScopeSummary(doc, data);

        // ── Page 3+: Line Items ──
        doc.addPage();
        renderLineItems(doc, data);

        // ── Final Page: Terms ──
        if (data.paymentTerms || data.estTimeline || data.customScope) {
            doc.addPage();
            renderTerms(doc, data);
        }

        // Footer on all pages
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            renderFooter(doc, data, i + 1, pageCount);
        }

        doc.end();
    });
}

function renderCover(doc: PDFKit.PDFDocument, data: ProposalData) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Company header
    doc.fontSize(28).fillColor(BLUE).font('Helvetica-Bold')
        .text('SCAN2PLAN', { align: 'left' });
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
        .text('3D Scanning & BIM Services', { align: 'left' });

    doc.moveDown(3);

    // Proposal title
    doc.fontSize(11).fillColor(MEDIUM).font('Helvetica')
        .text('PROPOSAL', { characterSpacing: 4 });
    doc.moveDown(0.3);
    doc.fontSize(24).fillColor(DARK).font('Helvetica-Bold')
        .text(data.projectName);
    doc.moveDown(0.5);

    // Divider
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + pageWidth, y)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(1);

    // Details grid
    const details = [
        ['Proposal ID', data.upid],
        ['Date', data.date],
        ['Version', `v${data.version}`],
        ['', ''],
        ['Client', data.clientCompany],
        ['Contact', data.contactName],
        ['Email', data.contactEmail],
        ['', ''],
        ['Project Address', data.projectAddress],
        ['Total Area', `${data.totalSquareFeet.toLocaleString()} SF`],
        ['Floors', String(data.numberOfFloors)],
        ['BIM Deliverable', data.bimDeliverable + (data.bimVersion ? ` (${data.bimVersion})` : '')],
    ];

    for (const [label, value] of details) {
        if (!label) { doc.moveDown(0.5); continue; }
        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
            .text(label.toUpperCase(), doc.page.margins.left, doc.y, { continued: false });
        doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
            .text(value, { indent: 0 });
        doc.moveDown(0.2);
    }

    // Custom message
    if (data.customMessage) {
        doc.moveDown(1);
        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('NOTE');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.customMessage);
    }

    // Total price highlight
    doc.moveDown(2);
    const boxY = doc.y;
    doc.rect(doc.page.margins.left, boxY, pageWidth, 50)
        .fillColor(LIGHT).fill();
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
        .text('TOTAL INVESTMENT', doc.page.margins.left + 20, boxY + 10);
    doc.fontSize(22).fillColor(BLUE).font('Helvetica-Bold')
        .text(`$${data.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, doc.page.margins.left + 20, boxY + 25);
}

function renderScopeSummary(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Scope of Work');

    if (data.areas.length === 0) {
        doc.fontSize(10).fillColor(MEDIUM).text('No areas defined.');
        return;
    }

    for (const area of data.areas) {
        doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
            .text(`${area.name} — ${area.type}`);
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text(`${area.squareFootage.toLocaleString()} SF | ${area.scope} | LoD ${area.lod}`);
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(`Disciplines: ${area.disciplines.join(', ')}`);
        doc.moveDown(0.8);
    }

    // Project-level features
    doc.moveDown(0.5);
    sectionHeader(doc, 'Additional Services');

    const features: string[] = [];
    if (data.georeferencing) features.push('Georeferencing included');
    if (data.expedited) features.push('Expedited delivery (+20% surcharge)');
    features.push(`Travel: ${data.travelMode}`);

    for (const f of features) {
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(`  •  ${f}`);
    }
}

function renderLineItems(doc: PDFKit.PDFDocument, data: ProposalData) {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    sectionHeader(doc, 'Investment Breakdown');

    // Table header
    const tableTop = doc.y + 5;
    doc.rect(doc.page.margins.left, tableTop, pageWidth, 20)
        .fillColor(LIGHT).fill();
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica-Bold');
    doc.text('LINE ITEM', doc.page.margins.left + 8, tableTop + 6, { width: pageWidth - 120 });
    doc.text('PRICE', doc.page.margins.left + pageWidth - 100, tableTop + 6, { width: 92, align: 'right' });

    let y = tableTop + 25;

    for (const item of data.lineItems) {
        // Check if we need a new page
        if (y > doc.page.height - 100) {
            doc.addPage();
            y = doc.page.margins.top;
        }

        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(item.description, doc.page.margins.left + 8, y, { width: pageWidth - 120 });
        doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
            .text(`$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                doc.page.margins.left + pageWidth - 100, y, { width: 92, align: 'right' });

        y += 22;

        // Divider line
        doc.moveTo(doc.page.margins.left, y - 4)
            .lineTo(doc.page.margins.left + pageWidth, y - 4)
            .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    }

    // Total row
    y += 8;
    doc.rect(doc.page.margins.left, y, pageWidth, 28)
        .fillColor(BLUE).fill();
    doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
        .text('TOTAL', doc.page.margins.left + 8, y + 8, { width: pageWidth - 120 });
    doc.text(`$${data.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        doc.page.margins.left + pageWidth - 100, y + 8, { width: 92, align: 'right' });
}

function renderTerms(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Terms & Conditions');

    if (data.paymentTerms) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Payment Terms');
        doc.fontSize(10).fillColor(DARK).font('Helvetica').text(data.paymentTerms);
        doc.moveDown(0.8);
    }

    if (data.estTimeline) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Estimated Timeline');
        doc.fontSize(10).fillColor(DARK).font('Helvetica').text(data.estTimeline);
        doc.moveDown(0.8);
    }

    if (data.projectTimeline) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Project Timeline');
        doc.fontSize(10).fillColor(DARK).font('Helvetica').text(data.projectTimeline);
        doc.moveDown(0.8);
    }

    if (data.customScope) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Custom Scope Notes');
        doc.fontSize(10).fillColor(DARK).font('Helvetica').text(data.customScope);
        doc.moveDown(0.8);
    }

    // Standard terms
    doc.moveDown(1);
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text('This proposal is valid for 30 days from the date of issue. Prices are based on the scope described above. ' +
            'Changes to scope may affect pricing. Final invoice will reflect actual services rendered. ' +
            'Scan2Plan reserves the right to adjust pricing for scope changes discovered during field operations.',
            { lineGap: 2 });
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(14).fillColor(BLUE).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.margins.left + 60, y)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(0.8);
}

function renderFooter(doc: PDFKit.PDFDocument, data: ProposalData, pageNum: number, totalPages: number) {
    const bottom = doc.page.height - 30;
    doc.fontSize(7).fillColor(MEDIUM).font('Helvetica');
    doc.text(`${data.upid} | Scan2Plan Proposal v${data.version}`, doc.page.margins.left, bottom);
    doc.text(`Page ${pageNum} of ${totalPages}`,
        doc.page.margins.left, bottom, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'right' });
}
