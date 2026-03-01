#!/usr/bin/env npx tsx
/**
 * Test: Does switchToPage create duplicate pages?
 */
import fs from 'fs';
import PDFDocument from 'pdfkit';

async function testWithFooters() {
    const doc = new PDFDocument({ size: 'LETTER', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // Page 1
    doc.text('Page 1 content', 60, 100);
    // Page 2
    doc.addPage();
    doc.text('Page 2 content', 60, 75);
    // Page 3
    doc.addPage();
    doc.text('Page 3 content', 60, 75);
    // Page 4
    doc.addPage();
    doc.text('Page 4 content', 60, 75);

    console.log(`Before footer loop: ${doc.bufferedPageRange().count} pages`);

    // Add footers via switchToPage
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).text(`Page ${i + 1} of ${range.count}`, 60, 757, { width: 492, align: 'right' });
    }

    doc.end();
    await new Promise(r => doc.on('end', r));

    const buf = Buffer.concat(chunks);
    fs.writeFileSync('/tmp/test-with-footers.pdf', buf);
    console.log(`With footers: ${buf.length} bytes`);
}

async function testWithoutFooters() {
    const doc = new PDFDocument({ size: 'LETTER', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // Page 1
    doc.text('Page 1 content', 60, 100);
    // Page 2
    doc.addPage();
    doc.text('Page 2 content', 60, 75);
    // Page 3
    doc.addPage();
    doc.text('Page 3 content', 60, 75);
    // Page 4
    doc.addPage();
    doc.text('Page 4 content', 60, 75);

    // NO footer loop
    doc.end();
    await new Promise(r => doc.on('end', r));

    const buf = Buffer.concat(chunks);
    fs.writeFileSync('/tmp/test-without-footers.pdf', buf);
    console.log(`Without footers: ${buf.length} bytes`);
}

async function testNoBufPages() {
    const doc = new PDFDocument({ size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    // Page 1
    doc.text('Page 1 content', 60, 100);
    // Page 2
    doc.addPage();
    doc.text('Page 2 content', 60, 75);
    // Page 3
    doc.addPage();
    doc.text('Page 3 content', 60, 75);
    // Page 4
    doc.addPage();
    doc.text('Page 4 content', 60, 75);

    doc.end();
    await new Promise(r => doc.on('end', r));

    const buf = Buffer.concat(chunks);
    fs.writeFileSync('/tmp/test-no-bufpages.pdf', buf);
    console.log(`No bufferPages: ${buf.length} bytes`);
}

async function main() {
    await testWithFooters();
    await testWithoutFooters();
    await testNoBufPages();

    // Check page counts
    const { execSync } = await import('child_process');
    for (const f of ['test-with-footers.pdf', 'test-without-footers.pdf', 'test-no-bufpages.pdf']) {
        const result = execSync(`exiftool -PageCount /tmp/${f}`).toString().trim();
        console.log(`${f}: ${result}`);
    }
}

main().catch(console.error);
