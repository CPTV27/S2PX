// ── Proposal PDF Generator ──
// 9-11 page professional proposal using PDFKit.
// Pages: Cover, About/Why, Project (1-2pp), Estimate (1-2pp),
//        Payment Terms, Capabilities, Difference, BIM Standards (1-2pp)

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
const HIGHLIGHT = '#eff6ff'; // light blue for LoD highlight rows

// ── Dimensions ──
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 60;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 35;
const HEADER_Y = 25;
const BODY_TOP = 75; // below page header

// ── Variable substitution ──
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
        total: `$${data.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        upfrontAmount: `$${data.payment.upfrontAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
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

// ── Render boilerplate text (paragraphs + bullets) ──
function renderBoilerplate(
    doc: PDFKit.PDFDocument,
    text: string,
    data: ProposalData,
    opts: { fontSize?: number; color?: string } = {},
) {
    const fontSize = opts.fontSize || 10;
    const color = opts.color || DARK;
    const processed = substituteVars(text, data);

    const lines = processed.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            doc.moveDown(0.4);
            continue;
        }
        // Bullet line
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
            const content = trimmed.replace(/^[•\-*]\s*/, '');
            doc.fontSize(fontSize).fillColor(color).font('Helvetica')
                .text(`  •  ${content}`, { lineGap: 3 });
        } else {
            doc.fontSize(fontSize).fillColor(color).font('Helvetica')
                .text(trimmed, { lineGap: 3 });
        }
    }
}

// ── Format currency ──
function fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Section Header ──
function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text(title);
    doc.moveDown(0.2);
    const y = doc.y;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 80, y)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(0.8);
}

// ── Sub-header ──
function subHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text(title);
    doc.moveDown(0.3);
}

// ── Page Header (all pages except cover) ──
function renderPageHeader(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.save();
    doc.fontSize(7).fillColor(MEDIUM).font('Helvetica');
    doc.text('SCAN2PLAN', MARGIN, HEADER_Y, { continued: true })
        .fillColor(ACCENT).text('  X', { continued: false });
    doc.fontSize(7).fillColor(MEDIUM).font('Helvetica')
        .text(data.upid, MARGIN, HEADER_Y, { width: CONTENT_W, align: 'right' });
    // thin line
    doc.moveTo(MARGIN, HEADER_Y + 14).lineTo(MARGIN + CONTENT_W, HEADER_Y + 14)
        .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.restore();
}

// ── Page Footer ──
function renderPageFooter(
    doc: PDFKit.PDFDocument,
    data: ProposalData,
    pageNum: number,
    totalPages: number,
) {
    doc.save();
    doc.fontSize(7).fillColor(MEDIUM).font('Helvetica');
    const left = `${data.upid}  |  ${data.template.footerText || 'Scan2Plan — 3D Scanning & BIM Services'}  |  v${data.version}`;
    doc.text(left, MARGIN, FOOTER_Y, { width: CONTENT_W * 0.7 });
    doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN, FOOTER_Y, { width: CONTENT_W, align: 'right' });
    doc.restore();
}

// ══════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ══════════════════════════════════════════════════════════════
function renderCover(doc: PDFKit.PDFDocument, data: ProposalData) {
    // Brand wordmark
    doc.fontSize(32).fillColor(BLUE).font('Helvetica-Bold')
        .text('SCAN2PLAN', MARGIN, 100);
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
        .text('3D Scanning & BIM Services', MARGIN, doc.y + 2);

    doc.moveDown(4);

    // "PROPOSAL" label
    doc.fontSize(11).fillColor(MEDIUM).font('Helvetica')
        .text('PROPOSAL', { characterSpacing: 5 });
    doc.moveDown(0.3);

    // Project name
    doc.fontSize(26).fillColor(DARK).font('Helvetica-Bold')
        .text(data.projectName);
    doc.moveDown(0.5);

    // Accent line
    const lineY = doc.y;
    doc.moveTo(MARGIN, lineY).lineTo(MARGIN + CONTENT_W, lineY)
        .strokeColor(ACCENT).lineWidth(2).stroke();
    doc.moveDown(1.5);

    // Info grid
    const pairs: [string, string][] = [
        ['Proposal ID', data.upid],
        ['Date', data.date],
        ['Version', `v${data.version}`],
    ];
    const pairs2: [string, string][] = [
        ['Client', data.clientCompany],
        ['Contact', data.contactName],
        ['Email', data.contactEmail],
    ];
    const pairs3: [string, string][] = [
        ['Project Address', data.projectAddress],
        ['Total Area', `${data.totalSquareFeet.toLocaleString()} SF`],
        ['Floors', String(data.numberOfFloors)],
        ['BIM Deliverable', data.bimDeliverable + (data.bimVersion ? ` (${data.bimVersion})` : '')],
    ];

    for (const group of [pairs, pairs2, pairs3]) {
        for (const [label, value] of group) {
            doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
                .text(label.toUpperCase(), MARGIN, doc.y);
            doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
                .text(value);
            doc.moveDown(0.15);
        }
        doc.moveDown(0.6);
    }

    // Custom message
    if (data.customMessage) {
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('NOTE');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.customMessage, { lineGap: 2 });
    }

    // Total investment box at bottom
    const boxY = Math.max(doc.y + 20, PAGE_H - MARGIN - 80);
    doc.rect(MARGIN, boxY, CONTENT_W, 55).fillColor(LIGHT).fill();
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('TOTAL INVESTMENT', MARGIN + 20, boxY + 12);
    doc.fontSize(24).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.totalPrice), MARGIN + 20, boxY + 28);
}

// ══════════════════════════════════════════════════════════════
// PAGE 2 — ABOUT + WHY SCAN2PLAN
// ══════════════════════════════════════════════════════════════
function renderAboutWhy(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'About Scan2Plan');
    if (data.template.aboutScan2plan) {
        renderBoilerplate(doc, data.template.aboutScan2plan, data);
    } else {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text('Company overview content will be configured in Proposal Template Settings.');
    }

    doc.moveDown(2);

    sectionHeader(doc, 'Why Scan2Plan?');
    if (data.template.whyScan2plan) {
        renderBoilerplate(doc, data.template.whyScan2plan, data);
    } else {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text('Value proposition content will be configured in Proposal Template Settings.');
    }
}

// ══════════════════════════════════════════════════════════════
// PAGES 3-4 — THE PROJECT
// ══════════════════════════════════════════════════════════════
function renderProject(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'The Project');

    // Project Understanding / Overview
    subHeader(doc, 'Project Overview');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.projectDescription, { lineGap: 3 });
    doc.moveDown(1);

    // Scope of Work
    subHeader(doc, 'Scope of Work');

    if (data.areas.length === 0) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica').text('No areas defined.');
    } else {
        for (const area of data.areas) {
            // Check for page overflow
            if (doc.y > PAGE_H - 150) {
                doc.addPage();
                renderPageHeader(doc, data);
                doc.y = BODY_TOP;
            }

            doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
                .text(`${area.name} — ${area.type}`);
            doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
                .text(`${area.squareFootage.toLocaleString()} SF  |  ${area.scope}  |  LoD ${area.lod}`);
            doc.fontSize(10).fillColor(DARK).font('Helvetica')
                .text(`Disciplines: ${area.disciplines.join(', ')}`);
            doc.moveDown(0.7);
        }
    }

    // Check space
    if (doc.y > PAGE_H - 250) {
        doc.addPage();
        renderPageHeader(doc, data);
        doc.y = BODY_TOP;
    }

    doc.moveDown(0.5);

    // Deliverables
    subHeader(doc, 'Deliverables');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.deliverables, { lineGap: 3 });
    doc.moveDown(0.5);

    // Additional Services
    if (data.projectUnderstanding.additionalServices.length > 0) {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Additional Services:');
        for (const svc of data.projectUnderstanding.additionalServices) {
            doc.fontSize(10).fillColor(DARK).font('Helvetica')
                .text(`  •  ${svc}`);
        }
        doc.moveDown(0.5);
    }

    // Timeline
    if (doc.y > PAGE_H - 150) {
        doc.addPage();
        renderPageHeader(doc, data);
        doc.y = BODY_TOP;
    }

    subHeader(doc, 'Timeline');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.projectUnderstanding.timeline, { lineGap: 3 });

    if (data.projectTimeline) {
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.projectTimeline, { lineGap: 3 });
    }
}

// ══════════════════════════════════════════════════════════════
// PAGES 5-6 — ESTIMATE TABLE (5-column)
// ══════════════════════════════════════════════════════════════
function renderEstimate(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'Estimate');

    const items = data.estimateLineItems;

    // Column widths: ITEM (120) | DESCRIPTION (160) | QTY (60) | RATE (72) | AMOUNT (80)
    const COL = {
        item:   { x: MARGIN,       w: 120 },
        desc:   { x: MARGIN + 120, w: 160 },
        qty:    { x: MARGIN + 280, w: 60  },
        rate:   { x: MARGIN + 340, w: 72  },
        amount: { x: MARGIN + 412, w: 80  },
    };
    const ROW_H = 22;
    const TABLE_W = CONTENT_W;

    // Table header
    function drawTableHeader(y: number) {
        doc.rect(MARGIN, y, TABLE_W, ROW_H).fillColor(BLUE).fill();
        doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold');
        doc.text('ITEM',        COL.item.x + 6,   y + 7, { width: COL.item.w - 8 });
        doc.text('DESCRIPTION', COL.desc.x + 6,   y + 7, { width: COL.desc.w - 8 });
        doc.text('QTY',         COL.qty.x + 4,    y + 7, { width: COL.qty.w - 8, align: 'right' });
        doc.text('RATE',        COL.rate.x + 4,    y + 7, { width: COL.rate.w - 8, align: 'right' });
        doc.text('AMOUNT',      COL.amount.x + 4,  y + 7, { width: COL.amount.w - 8, align: 'right' });
        return y + ROW_H;
    }

    let y = drawTableHeader(doc.y + 4);

    // Data rows
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Calculate row height based on description text
        const descHeight = doc.heightOfString(item.description, { width: COL.desc.w - 12, fontSize: 9 });
        const itemHeight = doc.heightOfString(item.item, { width: COL.item.w - 12, fontSize: 9 });
        const rowH = Math.max(ROW_H, Math.max(descHeight, itemHeight) + 10);

        // Check pagination
        if (y + rowH > PAGE_H - 80) {
            doc.addPage();
            renderPageHeader(doc, data);
            y = drawTableHeader(BODY_TOP);
        }

        // Alternating row background
        if (i % 2 === 0) {
            doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(ROW_ALT).fill();
        }

        // Cell text
        doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold');
        doc.text(item.item, COL.item.x + 6, y + 5, { width: COL.item.w - 12 });

        doc.fontSize(9).fillColor(MEDIUM).font('Helvetica');
        doc.text(item.description, COL.desc.x + 6, y + 5, { width: COL.desc.w - 12 });

        doc.fontSize(9).fillColor(DARK).font('Helvetica');
        doc.text(item.qty, COL.qty.x + 4, y + 5, { width: COL.qty.w - 8, align: 'right' });
        doc.text(fmt(item.rate), COL.rate.x + 4, y + 5, { width: COL.rate.w - 8, align: 'right' });

        doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold');
        doc.text(fmt(item.amount), COL.amount.x + 4, y + 5, { width: COL.amount.w - 8, align: 'right' });

        // Row border
        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH)
            .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        y += rowH;
    }

    // Total row
    y += 4;
    if (y + 30 > PAGE_H - 60) {
        doc.addPage();
        renderPageHeader(doc, data);
        y = BODY_TOP;
    }
    doc.rect(MARGIN, y, TABLE_W, 30).fillColor(BLUE).fill();
    doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold');
    doc.text('TOTAL', COL.item.x + 6, y + 9, { width: COL.desc.x + COL.desc.w - COL.item.x - 8 });
    doc.text(fmt(data.totalPrice), COL.amount.x + 4, y + 9, { width: COL.amount.w - 8, align: 'right' });

    // Item count note below table
    doc.y = y + 40;
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text(`${items.length} line item${items.length !== 1 ? 's' : ''}  |  ${data.totalSquareFeet.toLocaleString()} total SF`);
}

// ══════════════════════════════════════════════════════════════
// PAGE 7 — PAYMENT TERMS
// ══════════════════════════════════════════════════════════════
function renderPaymentTerms(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'Payment Terms');

    // Payment structure
    subHeader(doc, 'Payment Structure');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.payment.structure, { lineGap: 3 });
    doc.moveDown(1);

    // Payment breakdown box
    const boxY = doc.y;
    doc.rect(MARGIN, boxY, CONTENT_W, 80).fillColor(LIGHT).fill();
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('DEPOSIT (50%)', MARGIN + 20, boxY + 12);
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.payment.upfrontAmount), MARGIN + 20, boxY + 26);
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text('TOTAL PROJECT', MARGIN + CONTENT_W / 2, boxY + 12);
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold')
        .text(fmt(data.payment.totalAmount), MARGIN + CONTENT_W / 2, boxY + 26);
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica')
        .text(`Terms: ${data.payment.terms}  |  Estimated: ${data.payment.estimatedSqft.toLocaleString()} SF`,
            MARGIN + 20, boxY + 55);
    doc.y = boxY + 90;

    // Payment methods
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(MEDIUM).font('Helvetica-Bold').text('Accepted Payment Methods');
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(data.payment.methods.join('  •  '));
    doc.moveDown(1.5);

    // SF Audit clause
    if (data.template.sfAuditClause) {
        subHeader(doc, 'Square Footage Verification');
        doc.fontSize(9).fillColor(DARK).font('Helvetica')
            .text(substituteVars(data.template.sfAuditClause, data), { lineGap: 3 });
        doc.moveDown(1.5);
    }

    // Custom payment terms from form
    if (data.paymentTerms) {
        subHeader(doc, 'Additional Terms');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.paymentTerms, { lineGap: 3 });
        doc.moveDown(1);
    }

    // Custom scope notes
    if (data.customScope) {
        subHeader(doc, 'Custom Scope Notes');
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(data.customScope, { lineGap: 3 });
        doc.moveDown(1);
    }

    // Contact for questions
    doc.moveDown(1);
    doc.rect(MARGIN, doc.y, CONTENT_W, 50).fillColor(LIGHT).fill();
    const ctY = doc.y;
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold')
        .text('QUESTIONS ABOUT THIS PROPOSAL?', MARGIN + 20, ctY + 10);
    doc.fontSize(10).fillColor(DARK).font('Helvetica')
        .text(`${data.template.contactEmail}  |  ${data.template.contactPhone}`, MARGIN + 20, ctY + 26);

    // Standard validity notice
    doc.y = ctY + 65;
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text('This proposal is valid for 30 days from the date of issue. Prices are based on the scope described above. ' +
            'Changes to scope may affect pricing. Final invoice will reflect actual services rendered.', { lineGap: 2 });
}

// ══════════════════════════════════════════════════════════════
// PAGE 8 — CAPABILITIES
// ══════════════════════════════════════════════════════════════
function renderCapabilities(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'Scan2Plan Capabilities');

    if (data.template.capabilities) {
        renderBoilerplate(doc, data.template.capabilities, data);
    } else {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text('Capabilities content will be configured in Proposal Template Settings.');
    }
}

// ══════════════════════════════════════════════════════════════
// PAGE 9 — THE SCAN2PLAN DIFFERENCE
// ══════════════════════════════════════════════════════════════
function renderDifference(doc: PDFKit.PDFDocument, data: ProposalData) {
    doc.y = BODY_TOP;

    sectionHeader(doc, 'The Scan2Plan Difference');

    if (data.template.difference) {
        renderBoilerplate(doc, data.template.difference, data);
    } else {
        doc.fontSize(10).fillColor(MEDIUM).font('Helvetica')
            .text('Competitive advantage content will be configured in Proposal Template Settings.');
    }
}

// ══════════════════════════════════════════════════════════════
// PAGES 10-11 — BIM MODELING STANDARDS (LoD table)
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
    doc.y = BODY_TOP;

    sectionHeader(doc, 'BIM Modeling Standards');

    // Intro text
    if (data.template.bimStandardsIntro) {
        doc.fontSize(10).fillColor(DARK).font('Helvetica')
            .text(substituteVars(data.template.bimStandardsIntro, data), { lineGap: 3 });
        doc.moveDown(1);
    }

    // Determine which LoD levels are highlighted
    const projectLods = new Set(data.projectUnderstanding.lodLevels.map(l => {
        const normalized = l.replace(/\s+/g, '').toUpperCase();
        if (normalized.includes('350+')) return 'LOD 350+';
        if (normalized.includes('350')) return 'LOD 350';
        if (normalized.includes('300')) return 'LOD 300';
        if (normalized.includes('200')) return 'LOD 200';
        return `LOD ${l}`;
    }));

    // Table columns: LoD Level (70) | Description (160) | Elements (140) | Use Cases (122)
    const COL = {
        level: { x: MARGIN,       w: 70  },
        desc:  { x: MARGIN + 70,  w: 160 },
        elem:  { x: MARGIN + 230, w: 140 },
        use:   { x: MARGIN + 370, w: 122 },
    };
    const TABLE_W = CONTENT_W;

    // Table header
    function drawBimHeader(y: number) {
        doc.rect(MARGIN, y, TABLE_W, 22).fillColor(BLUE).fill();
        doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold');
        doc.text('LOD LEVEL',    COL.level.x + 6, y + 7, { width: COL.level.w - 8 });
        doc.text('DESCRIPTION',  COL.desc.x + 6,  y + 7, { width: COL.desc.w - 8 });
        doc.text('ELEMENTS',     COL.elem.x + 6,  y + 7, { width: COL.elem.w - 8 });
        doc.text('USE CASES',    COL.use.x + 6,   y + 7, { width: COL.use.w - 8 });
        return y + 22;
    }

    let y = drawBimHeader(doc.y + 4);

    for (const row of LOD_TABLE) {
        // Calculate row height from tallest cell
        const descH = doc.heightOfString(row.description, { width: COL.desc.w - 12, fontSize: 8 });
        const elemH = doc.heightOfString(row.elements, { width: COL.elem.w - 12, fontSize: 8 });
        const useH = doc.heightOfString(row.useCases, { width: COL.use.w - 12, fontSize: 8 });
        const rowH = Math.max(40, Math.max(descH, elemH, useH) + 14);

        // Pagination
        if (y + rowH > PAGE_H - 60) {
            doc.addPage();
            renderPageHeader(doc, data);
            y = drawBimHeader(BODY_TOP);
        }

        // Highlight row?
        const isHighlighted = projectLods.has(row.level);
        if (isHighlighted) {
            doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(HIGHLIGHT).fill();
            // Left accent bar
            doc.rect(MARGIN, y, 3, rowH).fillColor(ACCENT).fill();
        }

        // Cell content
        doc.fontSize(9).fillColor(isHighlighted ? BLUE : DARK).font('Helvetica-Bold');
        doc.text(row.level, COL.level.x + 8, y + 6, { width: COL.level.w - 14 });

        doc.fontSize(8).fillColor(DARK).font('Helvetica');
        doc.text(row.description, COL.desc.x + 6, y + 6, { width: COL.desc.w - 12, lineGap: 2 });
        doc.text(row.elements, COL.elem.x + 6, y + 6, { width: COL.elem.w - 12, lineGap: 2 });
        doc.text(row.useCases, COL.use.x + 6, y + 6, { width: COL.use.w - 12, lineGap: 2 });

        // Row border
        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH)
            .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        y += rowH;
    }

    // Legend
    doc.y = y + 15;
    doc.rect(MARGIN, doc.y, 10, 10).fillColor(HIGHLIGHT).fill();
    doc.rect(MARGIN, doc.y, 2, 10).fillColor(ACCENT).fill();
    doc.fontSize(8).fillColor(MEDIUM).font('Helvetica')
        .text('  = LoD levels applicable to this project', MARGIN + 14, doc.y + 1);
}

// ══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════
export function generateProposalPDF(data: ProposalData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
            bufferPages: true,
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

        // ── Page 2: About + Why ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderAboutWhy(doc, data);

        // ── Pages 3-4: The Project ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderProject(doc, data);

        // ── Pages 5-6: Estimate Table ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderEstimate(doc, data);

        // ── Page 7: Payment Terms ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderPaymentTerms(doc, data);

        // ── Page 8: Capabilities ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderCapabilities(doc, data);

        // ── Page 9: Difference ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderDifference(doc, data);

        // ── Pages 10-11: BIM Standards ──
        doc.addPage();
        renderPageHeader(doc, data);
        renderBimStandards(doc, data);

        // ── Apply footers to all pages ──
        const range = doc.bufferedPageRange();
        const totalPages = range.count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            renderPageFooter(doc, data, i + 1, totalPages);
        }

        doc.end();
    });
}
