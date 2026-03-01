// ── Proposal PDF Generator ──
// Professional proposal PDF with flowing layout using PDFKit.
// Sections flow continuously — only adds pages when space runs out.
// Empty template sections are skipped entirely (no placeholders).
//
// Architecture:
//   - pageAdded event auto-renders header + footer on every new page
//   - Two-pass rendering: pass 1 counts pages, pass 2 renders with "Page X of Y"
//   - ensureSpace() checks remaining room and calls doc.addPage() if needed
//   - Tables handle their own row-level pagination

import PDFDocument from 'pdfkit';
import type { ProposalData, EstimateLineItem } from '../lib/proposalDataMapper';

// ── Brand Colors ──
const BLUE = '#1e40af';
const DARK = '#1e293b';
const MEDIUM = '#64748b';
const LIGHT = '#f1f5f9';
const ACCENT = '#3b82f6';
const WHITE = '#ffffff';
const ROW_ALT = '#f8fafc';
const HIGHLIGHT = '#eff6ff';

// ── Dimensions ──
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 60;
const CONTENT_W = PAGE_W - MARGIN * 2;  // 492
const FOOTER_Y = PAGE_H - 35;           // 757
const HEADER_Y = 25;
const BODY_TOP = 75;

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function substituteVars(text: string, data: ProposalData): string {
    const map: Record<string, string | number> = {
        clientName: data.contactName,
        clientCompany: data.clientCompany,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        buildingType: data.projectUnderstanding.buildingType,
        totalSqft: data.totalSquareFeet.toLocaleString(),
        scope: data.areas.map(a => a.scope).join(', '),
        disciplines: [...new Set(data.areas.flatMap(a => a.disciplines))].join(', '),
        bimDeliverable: data.bimDeliverable,
        bimVersion: data.bimVersion || '',
        lodLevels: data.projectUnderstanding.lodLevels.join(', '),
        timeline: data.projectUnderstanding.timeline,
        total: fmt(data.totalPrice),
        upfrontAmount: fmt(data.payment.upfrontAmount),
        contactEmail: data.template.contactEmail,
        contactPhone: data.template.contactPhone,
        estimatedSqft: data.payment.estimatedSqft.toLocaleString(),
        numberOfFloors: data.numberOfFloors,
        numberOfAreas: data.numberOfAreas,
    };
    return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
        return map[key]?.toString() ?? `{{${key}}}`;
    });
}

function renderBoilerplate(
    doc: PDFKit.PDFDocument,
    text: string,
    data: ProposalData,
    opts: { fontSize?: number; color?: string } = {},
) {
    const fontSize = opts.fontSize || 10;
    const color = opts.color || DARK;
    const processed = substituteVars(text, data);
    for (const line of processed.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) { doc.moveDown(0.4); continue; }
        if (/^[•\-*]\s/.test(trimmed)) {
            const content = trimmed.replace(/^[•\-*]\s*/, '');
            doc.fontSize(fontSize).fillColor(color).font('Helvetica')
                .text(`  \u2022  ${content}`, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        } else {
            doc.fontSize(fontSize).fillColor(color).font('Helvetica')
                .text(trimmed, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        }
    }
}

function fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
        .text(title, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.2);
    const y = doc.y;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W * 0.3, y)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(0.6);
}

function subHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
        .text(title, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
}

/** Check if at least `minSpace` pixels remain. If not, add a new page. */
function ensureSpace(doc: PDFKit.PDFDocument, minSpace: number) {
    if (doc.y > PAGE_H - MARGIN - minSpace) {
        doc.addPage();
    }
}

// ══════════════════════════════════════════════════════════════
// PAGE HEADER & FOOTER (rendered at fixed positions)
// ══════════════════════════════════════════════════════════════

/** Render header — uses lineBreak:false to prevent auto-pagination. */
function renderPageHeader(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.fontSize(7).font('Helvetica').fillColor(MEDIUM);
    const brandText = 'SCAN2PLAN';
    const brandW = doc.widthOfString(brandText);
    doc.text(brandText, MARGIN, HEADER_Y, { lineBreak: false });
    doc.fontSize(7).font('Helvetica').fillColor(ACCENT)
        .text('X', MARGIN + brandW + 3, HEADER_Y, { lineBreak: false });
    // Right-aligned UPID — calculate position manually to avoid wrapping/pagination
    doc.fontSize(7).font('Helvetica').fillColor(MEDIUM);
    const upidW = doc.widthOfString(data.upid);
    doc.text(data.upid, MARGIN + CONTENT_W - upidW, HEADER_Y, { lineBreak: false });
    doc.moveTo(MARGIN, HEADER_Y + 14).lineTo(MARGIN + CONTENT_W, HEADER_Y + 14)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
}

/** Render footer — uses lineBreak:false to prevent auto-pagination. */
function renderPageFooter(doc: PDFKit.PDFDocument, data: ProposalData, pageNum: number, totalPages: number) {
    doc.fontSize(7).font('Helvetica').fillColor(MEDIUM);
    const left = `${data.upid}  |  ${data.template.footerText || 'Scan2Plan -- 3D Scanning & BIM Services'}  |  v${data.version}`;
    doc.text(left, MARGIN, FOOTER_Y, { lineBreak: false });
    const right = `Page ${pageNum} of ${totalPages}`;
    const rightW = doc.widthOfString(right);
    doc.text(right, MARGIN + CONTENT_W - rightW, FOOTER_Y, { lineBreak: false });
}

// ══════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════

function renderCover(doc: PDFKit.PDFDocument, data: ProposalData) {
    // Brand wordmark
    doc.fontSize(32).fillColor(BLUE).font('Helvetica-Bold')
        .text('SCAN2PLAN', MARGIN, 100, { width: CONTENT_W });
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
        .text('3D Scanning & BIM Services', MARGIN, doc.y + 2, { width: CONTENT_W });

    doc.moveDown(1.5);

    // "PROPOSAL" label
    doc.fontSize(11).fillColor(MEDIUM).font('Helvetica')
        .text('PROPOSAL', MARGIN, doc.y, { width: CONTENT_W, characterSpacing: 5 });
    doc.moveDown(0.3);

    // Project name
    doc.fontSize(26).fillColor(DARK).font('Helvetica-Bold')
        .text(data.projectName, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.5);

    // Accent line
    const lineY = doc.y;
    doc.moveTo(MARGIN, lineY).lineTo(MARGIN + CONTENT_W, lineY)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(1);

    // Info grid — two columns
    const colLeft = MARGIN;
    const colRight = MARGIN + CONTENT_W / 2;
    const halfW = CONTENT_W / 2 - 10;

    const leftPairs: [string, string][] = [
        ['Proposal ID', data.upid],
        ['Date', data.date],
        ['Version', `v${data.version}`],
    ];
    const rightPairs: [string, string][] = [
        ['Client', data.clientCompany],
        ['Contact', data.contactName],
        ['Email', data.contactEmail],
    ];

    const startY = doc.y;
    let y = startY;
    for (const [label, value] of leftPairs) {
        doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
            .text(label.toUpperCase(), colLeft, y, { width: halfW });
        y = doc.y;
        doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
            .text(value, colLeft, y, { width: halfW });
        y = doc.y + 6;
    }
    const leftEnd = y;

    y = startY;
    for (const [label, value] of rightPairs) {
        doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
            .text(label.toUpperCase(), colRight, y, { width: halfW });
        y = doc.y;
        doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
            .text(value, colRight, y, { width: halfW });
        y = doc.y + 6;
    }

    doc.y = Math.max(leftEnd, y) + 8;
    doc.x = MARGIN;

    // Project details — 2x2 grid
    const projectPairs: [string, string][] = [
        ['Project Address', data.projectAddress],
        ['Total Area', `${data.totalSquareFeet.toLocaleString()} SF`],
        ['Floors', String(data.numberOfFloors)],
        ['BIM Deliverable', data.bimDeliverable + (data.bimVersion ? ` (${data.bimVersion})` : '')],
    ];

    for (let i = 0; i < projectPairs.length; i += 2) {
        const rowStartY = doc.y;
        const [lbl1, val1] = projectPairs[i];
        doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
            .text(lbl1.toUpperCase(), colLeft, rowStartY, { width: halfW });
        doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
            .text(val1, colLeft, doc.y, { width: halfW });
        const leftBottom = doc.y;

        if (i + 1 < projectPairs.length) {
            const [lbl2, val2] = projectPairs[i + 1];
            doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
                .text(lbl2.toUpperCase(), colRight, rowStartY, { width: halfW });
            doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
                .text(val2, colRight, doc.y, { width: halfW });
        }
        doc.y = Math.max(leftBottom, doc.y) + 6;
    }
    doc.x = MARGIN;

    // Custom message
    if (data.customMessage) {
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
            .text('NOTE', MARGIN, doc.y, { width: CONTENT_W });
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.customMessage, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
    }

    // Total investment box — positioned right after content
    const boxY = doc.y + 20;
    doc.rect(MARGIN, boxY, 3, 55).fillColor(ACCENT).fill();
    doc.rect(MARGIN + 3, boxY, CONTENT_W - 3, 55).fillColor(LIGHT).fill();
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('TOTAL INVESTMENT', MARGIN + 20, boxY + 12, { width: CONTENT_W - 40 });
    doc.fontSize(24).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.totalPrice), MARGIN + 20, boxY + 28, { width: CONTENT_W - 40 });

    doc.y = boxY + 60;
    doc.x = MARGIN;
}

// ══════════════════════════════════════════════════════════════
// ABOUT SCAN2PLAN
// ══════════════════════════════════════════════════════════════

function renderAbout(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'About Scan2Plan');
    renderBoilerplate(doc, data.template.aboutScan2plan!, data);
    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// WHY SCAN2PLAN
// ══════════════════════════════════════════════════════════════

function renderWhy(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Why Scan2Plan?');
    renderBoilerplate(doc, data.template.whyScan2plan!, data);
    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// THE PROJECT
// ══════════════════════════════════════════════════════════════

function renderProject(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'The Project');

    subHeader(doc, 'Project Overview');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.projectDescription, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
    doc.moveDown(0.8);

    subHeader(doc, 'Scope of Work');

    if (data.areas.length === 0) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text('No areas defined.', MARGIN, doc.y, { width: CONTENT_W });
    } else {
        for (const area of data.areas) {
            ensureSpace(doc, 100);
            doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
                .text(`${area.name} -- ${area.type}`, MARGIN, doc.y, { width: CONTENT_W });
            doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
                .text(`${area.squareFootage.toLocaleString()} SF  |  ${area.scope}  |  LoD ${area.lod}`, MARGIN, doc.y, { width: CONTENT_W });
            doc.fontSize(10).fillColor(DARK).font('Helvetica')
                .text(`Disciplines: ${area.disciplines.join(', ')}`, MARGIN, doc.y, { width: CONTENT_W });
            doc.moveDown(0.5);
        }
    }

    doc.moveDown(0.3);
    ensureSpace(doc, 150);

    subHeader(doc, 'Deliverables');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.deliverables, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
    doc.moveDown(0.4);

    if (data.projectUnderstanding.additionalServices.length > 0) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold')
            .text('Additional Services:', MARGIN, doc.y, { width: CONTENT_W });
        for (const svc of data.projectUnderstanding.additionalServices) {
            doc.fontSize(10).fillColor(DARK).font('Helvetica')
                .text(`  \u2022  ${svc}`, MARGIN, doc.y, { width: CONTENT_W });
        }
        doc.moveDown(0.4);
    }

    ensureSpace(doc, 120);

    subHeader(doc, 'Timeline');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.timeline, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });

    if (data.projectTimeline) {
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.projectTimeline, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
    }

    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// ESTIMATE TABLE (5-column)
// ══════════════════════════════════════════════════════════════

function renderEstimate(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Estimate');

    const items = data.estimateLineItems;
    const COL = {
        item:   { x: MARGIN,       w: 120 },
        desc:   { x: MARGIN + 120, w: 160 },
        qty:    { x: MARGIN + 280, w: 60  },
        rate:   { x: MARGIN + 340, w: 72  },
        amount: { x: MARGIN + 412, w: 80  },
    };
    const ROW_H = 22;
    const TABLE_W = CONTENT_W;

    function drawTableHeader(startY: number) {
        doc.rect(MARGIN, startY, TABLE_W, ROW_H).fillColor(BLUE).fill();
        doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold');
        doc.text('ITEM',        COL.item.x + 6,   startY + 7, { width: COL.item.w - 8 });
        doc.text('DESCRIPTION', COL.desc.x + 6,   startY + 7, { width: COL.desc.w - 8 });
        doc.text('QTY',         COL.qty.x + 4,    startY + 7, { width: COL.qty.w - 8, align: 'right' });
        doc.text('RATE',        COL.rate.x + 4,   startY + 7, { width: COL.rate.w - 8, align: 'right' });
        doc.text('AMOUNT',      COL.amount.x + 4, startY + 7, { width: COL.amount.w - 8, align: 'right' });
        return startY + ROW_H;
    }

    let y = drawTableHeader(doc.y + 4);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const descH = doc.heightOfString(item.description, { width: COL.desc.w - 12, fontSize: 9 });
        const itemH = doc.heightOfString(item.item, { width: COL.item.w - 12, fontSize: 9 });
        const rowH = Math.max(ROW_H, Math.max(descH, itemH) + 10);

        // Row-level pagination
        if (y + rowH > PAGE_H - 80) {
            doc.addPage();
            y = drawTableHeader(BODY_TOP);
        }

        if (i % 2 === 0) {
            doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(ROW_ALT).fill();
        }

        doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold');
        doc.text(item.item, COL.item.x + 6, y + 5, { width: COL.item.w - 12 });

        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica');
        doc.text(item.description, COL.desc.x + 6, y + 5, { width: COL.desc.w - 12 });

        doc.fontSize(9).fillColor(DARK).font('Helvetica');
        doc.text(item.qty, COL.qty.x + 4, y + 5, { width: COL.qty.w - 8, align: 'right' });
        doc.text(fmt(item.rate), COL.rate.x + 4, y + 5, { width: COL.rate.w - 8, align: 'right' });

        doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold');
        doc.text(fmt(item.amount), COL.amount.x + 4, y + 5, { width: COL.amount.w - 8, align: 'right' });

        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH)
            .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        y += rowH;
    }

    // Total row
    y += 4;
    if (y + 30 > PAGE_H - 60) {
        doc.addPage();
        y = BODY_TOP;
    }
    doc.rect(MARGIN, y, TABLE_W, 30).fillColor(BLUE).fill();
    doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold');
    doc.text('TOTAL', COL.item.x + 6, y + 9, { width: COL.desc.x + COL.desc.w - COL.item.x - 8 });
    doc.text(fmt(data.totalPrice), COL.amount.x + 4, y + 9, { width: COL.amount.w - 8, align: 'right' });

    doc.y = y + 40;
    doc.x = MARGIN;
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text(`${items.length} line item${items.length !== 1 ? 's' : ''}  |  ${data.totalSquareFeet.toLocaleString()} total SF`,
            MARGIN, doc.y, { width: CONTENT_W });

    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// PAYMENT TERMS
// ══════════════════════════════════════════════════════════════

function renderPaymentTerms(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Payment Terms');

    subHeader(doc, 'Payment Structure');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.payment.structure, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
    doc.moveDown(0.8);

    // Payment breakdown box
    const boxY = doc.y;
    doc.rect(MARGIN, boxY, CONTENT_W, 80).fillColor(LIGHT).fill();
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('DEPOSIT (50%)', MARGIN + 20, boxY + 12, { width: CONTENT_W / 2 - 30 });
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.payment.upfrontAmount), MARGIN + 20, boxY + 26, { width: CONTENT_W / 2 - 30 });
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('TOTAL PROJECT', MARGIN + CONTENT_W / 2, boxY + 12, { width: CONTENT_W / 2 - 30 });
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.payment.totalAmount), MARGIN + CONTENT_W / 2, boxY + 26, { width: CONTENT_W / 2 - 30 });
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text(`Terms: ${data.payment.terms}  |  Estimated: ${data.payment.estimatedSqft.toLocaleString()} SF`,
            MARGIN + 20, boxY + 55, { width: CONTENT_W - 40 });
    doc.y = boxY + 90;
    doc.x = MARGIN;

    // Payment methods
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold')
        .text('Accepted Payment Methods', MARGIN, doc.y, { width: CONTENT_W });
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.payment.methods.join('  \u2022  '), MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.5);

    if (data.template.sfAuditClause) {
        ensureSpace(doc, 120);
        subHeader(doc, 'Square Footage Verification');
        doc.fontSize(9).fillColor(DARK).font('Helvetica')
            .text(substituteVars(data.template.sfAuditClause, data), MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        doc.moveDown(0.5);
    }

    if (data.paymentTerms) {
        ensureSpace(doc, 100);
        subHeader(doc, 'Additional Terms');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.paymentTerms, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        doc.moveDown(0.5);
    }

    if (data.customScope) {
        ensureSpace(doc, 100);
        subHeader(doc, 'Custom Scope Notes');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.customScope, MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        doc.moveDown(0.5);
    }

    // Contact box
    ensureSpace(doc, 120);
    doc.moveDown(0.5);
    doc.rect(MARGIN, doc.y, CONTENT_W, 50).fillColor(LIGHT).fill();
    const ctY = doc.y;
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold')
        .text('QUESTIONS ABOUT THIS PROPOSAL?', MARGIN + 20, ctY + 10, { width: CONTENT_W - 40 });
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(`${data.template.contactEmail}  |  ${data.template.contactPhone}`, MARGIN + 20, ctY + 26, { width: CONTENT_W - 40 });

    doc.y = ctY + 60;
    doc.x = MARGIN;
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text('This proposal is valid for 30 days from the date of issue. Prices are based on the scope described above. ' +
            'Changes to scope may affect pricing. Final invoice will reflect actual services rendered.',
            MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });

    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// CAPABILITIES
// ══════════════════════════════════════════════════════════════

function renderCapabilities(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'Scan2Plan Capabilities');
    renderBoilerplate(doc, data.template.capabilities!, data);
    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// THE SCAN2PLAN DIFFERENCE
// ══════════════════════════════════════════════════════════════

function renderDifference(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'The Scan2Plan Difference');
    renderBoilerplate(doc, data.template.difference!, data);
    doc.moveDown(1);
}

// ══════════════════════════════════════════════════════════════
// BIM MODELING STANDARDS (LoD table)
// ══════════════════════════════════════════════════════════════

interface LodRow {
    level: string;
    description: string;
    elements: string;
    useCases: string;
}

const LOD_TABLE: LodRow[] = [
    {
        level: 'LOD 200',
        description: 'Generic placeholder geometry with approximate quantities, size, shape, location, and orientation.',
        elements: 'Walls (generic thickness), Doors/Windows (approximate openings), Floors, Roofs, Basic MEP routing',
        useCases: 'Conceptual design, space planning, early-stage renovation feasibility',
    },
    {
        level: 'LOD 300',
        description: 'Accurate geometry with specific assemblies, precise quantity, size, shape, location, and orientation.',
        elements: 'Walls (specific assemblies), Doors/Windows (specific types), Structural members, MEP equipment + routing, Ceiling grids',
        useCases: 'Design development, construction documentation, permit drawings, MEP coordination',
    },
    {
        level: 'LOD 350',
        description: 'LOD 300 plus interfaces with other building systems, accurate supports, connections, and necessary clearances.',
        elements: 'All LOD 300 elements + Hangers/Supports, Connection details, Clash-free coordination, Clearance zones',
        useCases: 'Coordination between trades, construction-ready models, fabrication prep, interference detection',
    },
    {
        level: 'LOD 350+',
        description: 'Field-verified high-detail models with as-built conditions, manufacturer-specific components, and operational data.',
        elements: 'All LOD 350 elements + Manufacturer models, Nameplate data, Operational parameters, Asset tags',
        useCases: 'Facility management, asset management, operations & maintenance, digital twin applications',
    },
];

function renderBimStandards(doc: PDFKit.PDFDocument, data: ProposalData) {
    sectionHeader(doc, 'BIM Modeling Standards');

    if (data.template.bimStandardsIntro) {
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(substituteVars(data.template.bimStandardsIntro, data), MARGIN, doc.y, { width: CONTENT_W, lineGap: 3 });
        doc.moveDown(0.8);
    }

    const projectLods = new Set(data.projectUnderstanding.lodLevels.map(l => {
        const normalized = l.replace(/\s+/g, '').toUpperCase();
        if (normalized.includes('350+')) return 'LOD 350+';
        if (normalized.includes('350')) return 'LOD 350';
        if (normalized.includes('300')) return 'LOD 300';
        if (normalized.includes('200')) return 'LOD 200';
        return `LOD ${l}`;
    }));

    const COL = {
        level: { x: MARGIN,       w: 70  },
        desc:  { x: MARGIN + 70,  w: 160 },
        elem:  { x: MARGIN + 230, w: 140 },
        use:   { x: MARGIN + 370, w: 122 },
    };
    const TABLE_W = CONTENT_W;

    function drawBimHeader(startY: number) {
        doc.rect(MARGIN, startY, TABLE_W, 22).fillColor(BLUE).fill();
        doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold');
        doc.text('LOD LEVEL',    COL.level.x + 6, startY + 7, { width: COL.level.w - 8 });
        doc.text('DESCRIPTION',  COL.desc.x + 6,  startY + 7, { width: COL.desc.w - 8 });
        doc.text('ELEMENTS',     COL.elem.x + 6,  startY + 7, { width: COL.elem.w - 8 });
        doc.text('USE CASES',    COL.use.x + 6,   startY + 7, { width: COL.use.w - 8 });
        return startY + 22;
    }

    let y = drawBimHeader(doc.y + 4);

    for (const row of LOD_TABLE) {
        const descH = doc.heightOfString(row.description, { width: COL.desc.w - 12, fontSize: 8 });
        const elemH = doc.heightOfString(row.elements, { width: COL.elem.w - 12, fontSize: 8 });
        const useH = doc.heightOfString(row.useCases, { width: COL.use.w - 12, fontSize: 8 });
        const rowH = Math.max(descH, elemH, useH) + 14;

        if (y + rowH > PAGE_H - 60) {
            doc.addPage();
            y = drawBimHeader(BODY_TOP);
        }

        const isHighlighted = projectLods.has(row.level);
        if (isHighlighted) {
            doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(HIGHLIGHT).fill();
            doc.rect(MARGIN, y, 3, rowH).fillColor(ACCENT).fill();
        }

        doc.fontSize(9).fillColor(isHighlighted ? BLUE : DARK).font('Helvetica-Bold');
        doc.text(row.level, COL.level.x + 8, y + 6, { width: COL.level.w - 14 });

        doc.fontSize(8).fillColor(DARK).font('Helvetica');
        doc.text(row.description, COL.desc.x + 6, y + 6, { width: COL.desc.w - 12, lineGap: 2 });
        doc.text(row.elements, COL.elem.x + 6, y + 6, { width: COL.elem.w - 12, lineGap: 2 });
        doc.text(row.useCases, COL.use.x + 6, y + 6, { width: COL.use.w - 12, lineGap: 2 });

        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH)
            .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        y += rowH;
    }

    doc.y = y + 12;
    doc.x = MARGIN;
    doc.rect(MARGIN, doc.y, 10, 10).fillColor(HIGHLIGHT).fill();
    doc.rect(MARGIN, doc.y, 2, 10).fillColor(ACCENT).fill();
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text('  = LoD levels applicable to this project', MARGIN + 14, doc.y + 1, { width: CONTENT_W - 14 });
}

// ══════════════════════════════════════════════════════════════
// MAIN RENDER PIPELINE
// ══════════════════════════════════════════════════════════════

function renderAllContent(doc: PDFKit.PDFDocument, data: ProposalData) {
    const sv = data.sectionVisibility || {};

    // Page 1: Cover
    renderCover(doc, data);

    // Page 2+: Flowing content
    doc.addPage();

    if (data.template.aboutScan2plan && sv.aboutScan2plan !== false) {
        renderAbout(doc, data);
    }

    if (data.template.whyScan2plan && sv.whyScan2plan !== false) {
        ensureSpace(doc, 180);
        renderWhy(doc, data);
    }

    ensureSpace(doc, 250);
    renderProject(doc, data);

    // Estimate table — fresh page (tables need header row)
    doc.addPage();
    renderEstimate(doc, data);

    // Payment terms — flow or new page
    ensureSpace(doc, 300);
    renderPaymentTerms(doc, data);

    if (data.template.capabilities && sv.capabilities !== false) {
        ensureSpace(doc, 180);
        renderCapabilities(doc, data);
    }

    if (data.template.difference && sv.difference !== false) {
        ensureSpace(doc, 180);
        renderDifference(doc, data);
    }

    if (sv.bimStandards !== false) {
        doc.addPage();
        renderBimStandards(doc, data);
    }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

export function generateProposalPDF(data: ProposalData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // ─── Pass 1: Dry run to count pages ───
        let dryPages = 1;
        const dryDoc = new PDFDocument({
            size: 'LETTER',
            margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        });
        dryDoc.on('data', () => {}); // consume to prevent backpressure
        let inDryHandler = false;
        dryDoc.on('pageAdded', () => {
            if (inDryHandler) return;
            inDryHandler = true;
            dryPages++;
            dryDoc.x = MARGIN;
            dryDoc.y = BODY_TOP;
            inDryHandler = false;
        });
        renderAllContent(dryDoc, data);
        dryDoc.end();
        const totalPages = dryPages;

        // ─── Pass 2: Real render with headers, footers, and page numbers ───
        let pageNum = 1;
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
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

        // Pre-render footer on cover page (page 1 — no header on cover)
        doc.save();
        renderPageFooter(doc, data, 1, totalPages);
        doc.restore();

        // Auto-render header + footer on every subsequent page
        // Guard prevents infinite recursion if footer text triggers auto-pagination
        let inPageHandler = false;
        doc.on('pageAdded', () => {
            if (inPageHandler) return;
            inPageHandler = true;
            pageNum++;
            doc.save();
            renderPageHeader(doc, data);
            renderPageFooter(doc, data, pageNum, totalPages);
            doc.restore();
            doc.x = MARGIN;
            doc.y = BODY_TOP;
            inPageHandler = false;
        });

        renderAllContent(doc, data);
        doc.end();
    });
}
