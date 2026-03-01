#!/usr/bin/env npx tsx
/**
 * Debug PDF page count — traces where pages are being created
 */

import fs from 'fs';
import PDFDocument from 'pdfkit';
import type { ProposalData } from '../lib/proposalDataMapper';

const PAGE_H = 792;
const MARGIN = 60;
const BODY_TOP = 75;
const CONTENT_W = 492;

function mockData(): ProposalData {
    return {
        upid: 'S2P-TEST',
        date: 'Feb 28, 2026',
        version: 1,
        clientCompany: 'Test Corp',
        contactName: 'John Doe',
        contactEmail: 'john@test.com',
        projectName: 'Test Project',
        projectAddress: '123 Main St',
        totalSquareFeet: 10000,
        numberOfAreas: 1,
        numberOfFloors: 2,
        bimDeliverable: 'Revit',
        bimVersion: '2024',
        expedited: false,
        georeferencing: false,
        travelMode: 'drive',
        areas: [{ name: 'Area 1', type: 'Office', squareFootage: 10000, scope: 'Interior', lod: '300', disciplines: ['Architecture'] }],
        lineItems: [{ description: 'Test', category: 'architecture', price: 5000 }],
        estimateLineItems: [{ item: 'Area 1 -- Arch', description: 'Interior | LoD 300', qty: '10,000', rate: 0.50, amount: 5000 }],
        totalPrice: 5000,
        itemCount: 1,
        paymentTerms: null,
        estTimeline: '4 weeks',
        projectTimeline: null,
        customScope: null,
        customMessage: null,
        projectUnderstanding: {
            buildingType: 'Office',
            totalSqft: 10000,
            projectDescription: 'Test Corp needs scanning.',
            deliverables: 'Revit (2024) -- Architecture -- LoD 300',
            additionalServices: [],
            timeline: '4 weeks',
            lodLevels: ['300'],
        },
        payment: {
            structure: '50% deposit, 50% upon delivery',
            upfrontAmount: 2500,
            totalAmount: 5000,
            methods: ['Check', 'Wire'],
            terms: 'Net 30',
            estimatedSqft: 10000,
        },
        template: {
            aboutScan2plan: null,
            whyScan2plan: null,
            capabilities: null,
            difference: null,
            bimStandardsIntro: null,
            paymentTermsDefault: null,
            sfAuditClause: null,
            contactEmail: 'admin@test.com',
            contactPhone: '555-1234',
            footerText: null,
        },
        sectionVisibility: {
            aboutScan2plan: true,
            whyScan2plan: true,
            capabilities: true,
            difference: true,
            bimStandards: true,
        },
    };
}

async function main() {
    const data = mockData();

    // Test 1: Minimal — just a doc with addPage calls
    const doc1 = new PDFDocument({ size: 'LETTER', bufferPages: true });
    const chunks1: Buffer[] = [];
    doc1.on('data', (c: Buffer) => chunks1.push(c));

    doc1.text('Cover page', MARGIN, 100);
    console.log(`After cover text: doc.y=${doc1.y}, doc.x=${doc1.x}`);

    doc1.addPage();
    doc1.y = BODY_TOP;
    doc1.text('Page 2 content', MARGIN, BODY_TOP);
    console.log(`After page 2 text: doc.y=${doc1.y}, doc.x=${doc1.x}`);

    doc1.addPage();
    doc1.y = BODY_TOP;
    doc1.text('Page 3 content', MARGIN, BODY_TOP);
    console.log(`After page 3 text: doc.y=${doc1.y}, doc.x=${doc1.x}`);

    const range1 = doc1.bufferedPageRange();
    console.log(`Test 1 (simple): ${range1.count} pages`);
    doc1.end();

    await new Promise(r => doc1.on('end', r));

    // Test 2: Two-column layout on cover, then new page
    const doc2 = new PDFDocument({ size: 'LETTER', bufferPages: true });
    const chunks2: Buffer[] = [];
    doc2.on('data', (c: Buffer) => chunks2.push(c));

    // Simulate cover two-column
    const colRight = MARGIN + CONTENT_W / 2;

    doc2.fontSize(32).font('Helvetica-Bold').text('SCAN2PLAN', MARGIN, 100);
    doc2.fontSize(10).font('Helvetica').text('Subtitle', MARGIN, doc2.y + 2);
    doc2.moveDown(1.5);

    // Two-column info
    const startY = doc2.y;
    const pairs = [['Label 1', 'Value 1'], ['Label 2', 'Value 2'], ['Label 3', 'Value 3']];

    let y = startY;
    for (const [label, value] of pairs) {
        doc2.fontSize(8).font('Helvetica').text(label, MARGIN, y);
        y = doc2.y;
        doc2.fontSize(11).font('Helvetica-Bold').text(value, MARGIN, y, { width: CONTENT_W / 2 - 10 });
        y = doc2.y + 6;
    }
    const leftEnd = y;

    y = startY;
    for (const [label, value] of pairs) {
        doc2.fontSize(8).font('Helvetica').text(label, colRight, y);
        y = doc2.y;
        doc2.fontSize(11).font('Helvetica-Bold').text(value, colRight, y, { width: CONTENT_W / 2 - 10 });
        y = doc2.y + 6;
    }

    doc2.y = Math.max(leftEnd, y) + 8;
    console.log(`After two-column: doc.y=${doc2.y}, doc.x=${doc2.x}`);

    // Box
    const boxY = doc2.y + 20;
    doc2.rect(MARGIN, boxY, CONTENT_W, 55).fillColor('#f1f5f9').fill();
    doc2.fontSize(9).fillColor('#64748b').font('Helvetica').text('TOTAL', MARGIN + 20, boxY + 12);
    doc2.fontSize(24).fillColor('#1e40af').font('Helvetica-Bold').text('$5,000.00', MARGIN + 20, boxY + 28);
    doc2.y = boxY + 60;
    console.log(`After box: doc.y=${doc2.y}, doc.x=${doc2.x}`);

    // Check page count before addPage
    console.log(`Before addPage: pages=${doc2.bufferedPageRange().count}`);

    doc2.addPage();
    doc2.y = BODY_TOP;
    console.log(`After addPage: doc.y=${doc2.y}, pages=${doc2.bufferedPageRange().count}`);

    doc2.fontSize(16).fillColor('#1e40af').font('Helvetica-Bold').text('The Project');
    doc2.fontSize(10).fillColor('#1e293b').font('Helvetica').text('Some project description text here.');
    console.log(`After project text: doc.y=${doc2.y}, pages=${doc2.bufferedPageRange().count}`);

    doc2.addPage();
    doc2.y = BODY_TOP;
    doc2.fontSize(16).fillColor('#1e40af').font('Helvetica-Bold').text('Estimate');
    doc2.fontSize(10).fillColor('#1e293b').font('Helvetica').text('Line items here.');
    console.log(`After estimate text: doc.y=${doc2.y}, pages=${doc2.bufferedPageRange().count}`);

    doc2.addPage();
    doc2.y = BODY_TOP;
    doc2.fontSize(16).fillColor('#1e40af').font('Helvetica-Bold').text('BIM Standards');
    doc2.fontSize(10).fillColor('#1e293b').font('Helvetica').text('LoD table here.');
    console.log(`After BIM text: doc.y=${doc2.y}, pages=${doc2.bufferedPageRange().count}`);

    const range2 = doc2.bufferedPageRange();
    console.log(`Test 2 (two-column cover + 3 pages): ${range2.count} pages`);
    doc2.end();

    await new Promise(r => doc2.on('end', r));

    // Test 3: Now use the actual generator
    const { generateProposalPDF } = await import('../pdf/proposalGenerator');
    const pdfBuffer = await generateProposalPDF(data);

    // Count pages by checking /Type /Page entries (but more carefully)
    const pdfStr = pdfBuffer.toString('binary');
    // More reliable: count page objects
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b(?!\s*s)/g);
    console.log(`\nTest 3 (actual generator): regex found ${pageMatches?.length} page markers`);
    console.log(`Buffer size: ${pdfBuffer.length} bytes`);

    // Write to file and check with mdls
    fs.writeFileSync('/tmp/test-debug.pdf', pdfBuffer);
    console.log('Wrote /tmp/test-debug.pdf');
}

main().catch(console.error);
