#!/usr/bin/env npx tsx
/**
 * Standalone PDF layout test — generates proposals from mock data.
 * No database required. Just verifies PDF generation and layout.
 *
 * Usage: npx tsx server/scripts/test-pdf-layout.ts
 * Output: test-proposals/ directory
 */

import fs from 'fs';
import path from 'path';
import { generateProposalPDF } from '../pdf/proposalGenerator';
import type { ProposalData } from '../lib/proposalDataMapper';

const OUTPUT_DIR = path.join(process.cwd(), 'test-proposals');

function mockProposal(overrides: Partial<ProposalData> = {}): ProposalData {
    return {
        upid: 'S2P-2025-1234',
        date: 'February 28, 2026',
        version: 1,
        clientCompany: 'Meridian Architecture Group',
        contactName: 'Sarah Chen',
        contactEmail: 'sarah@meridian-arch.com',
        projectName: '425 Park Avenue - Full Building Scan',
        projectAddress: '425 Park Avenue, New York, NY 10022',
        totalSquareFeet: 85000,
        numberOfAreas: 3,
        numberOfFloors: 4,
        bimDeliverable: 'Revit',
        bimVersion: '2024',
        expedited: false,
        georeferencing: true,
        travelMode: 'drive',
        areas: [
            {
                name: 'Main Lobby & Common Areas',
                type: 'Commercial Office',
                squareFootage: 25000,
                scope: 'Interior',
                lod: '300',
                disciplines: ['Architecture', 'Structural', 'MEPF'],
            },
            {
                name: 'Floors 2-3 Office Space',
                type: 'Commercial Office',
                squareFootage: 40000,
                scope: 'Interior',
                lod: '300',
                disciplines: ['Architecture', 'MEPF'],
            },
            {
                name: 'Mechanical Penthouse',
                type: 'Mechanical',
                squareFootage: 20000,
                scope: 'Interior + Exterior',
                lod: '350',
                disciplines: ['Architecture', 'Structural', 'MEPF', 'Above Ceiling'],
            },
        ],
        lineItems: [
            { description: 'Architecture Modeling - Main Lobby', category: 'architecture', price: 12500 },
            { description: 'Architecture Modeling - Office Floors', category: 'architecture', price: 20000 },
            { description: 'Architecture Modeling - Mechanical', category: 'architecture', price: 10000 },
            { description: 'MEPF Modeling', category: 'mepf', price: 15000 },
            { description: 'Structural Modeling', category: 'structural', price: 8000 },
            { description: 'Travel', category: 'travel', price: 2500 },
        ],
        estimateLineItems: [
            { item: 'Main Lobby -- Architecture', description: 'Interior | LoD 300 | 25,000 SF', qty: '25,000', rate: 0.50, amount: 12500 },
            { item: 'Office Floors -- Architecture', description: 'Interior | LoD 300 | 40,000 SF', qty: '40,000', rate: 0.50, amount: 20000 },
            { item: 'Mechanical -- Architecture', description: 'Interior + Exterior | LoD 350 | 20,000 SF', qty: '20,000', rate: 0.50, amount: 10000 },
            { item: 'Main Lobby -- MEPF', description: 'Interior | LoD 300 | 25,000 SF', qty: '25,000', rate: 0.20, amount: 5000 },
            { item: 'Office Floors -- MEPF', description: 'Interior | LoD 300 | 40,000 SF', qty: '40,000', rate: 0.15, amount: 6000 },
            { item: 'Mechanical -- MEPF', description: 'Interior + Exterior | LoD 350 | 20,000 SF', qty: '20,000', rate: 0.20, amount: 4000 },
            { item: 'Main Lobby -- Structural', description: 'Interior | LoD 300 | 25,000 SF', qty: '25,000', rate: 0.12, amount: 3000 },
            { item: 'Mechanical -- Structural', description: 'Interior + Exterior | LoD 350 | 20,000 SF', qty: '20,000', rate: 0.25, amount: 5000 },
            { item: 'Travel', description: 'Drive from Albany, NY to 120 mi', qty: '1', rate: 2500, amount: 2500 },
        ],
        totalPrice: 68000,
        itemCount: 9,
        paymentTerms: 'Net 30',
        estTimeline: '6-8 weeks from scanning completion',
        projectTimeline: 'Scanning scheduled for March 15-19, 2026. Deliverables expected by May 1, 2026.',
        customScope: null,
        customMessage: 'Thank you for considering Scan2Plan for your 3D scanning and BIM needs. We look forward to partnering with Meridian Architecture Group on this exciting project.',
        projectUnderstanding: {
            buildingType: 'Commercial Office',
            totalSqft: 85000,
            projectDescription: 'Meridian Architecture Group has engaged Scan2Plan to provide professional 3D laser scanning and BIM modeling services for 425 Park Avenue - Full Building Scan, located at 425 Park Avenue, New York, NY 10022. The project encompasses 85,000 square feet across 4 floor(s).',
            deliverables: 'Revit (2024) -- Architecture, Structural, MEPF, Above Ceiling -- LoD 300, 350',
            additionalServices: ['Georeferencing'],
            timeline: '6-8 weeks from scanning completion',
            lodLevels: ['300', '350'],
        },
        payment: {
            structure: '50% deposit upon project authorization, 50% balance upon delivery of final deliverables',
            upfrontAmount: 34000,
            totalAmount: 68000,
            methods: ['Check', 'Wire Transfer', 'Credit Card'],
            terms: 'Net 30',
            estimatedSqft: 85000,
        },
        template: {
            aboutScan2plan: null,
            whyScan2plan: null,
            capabilities: null,
            difference: null,
            bimStandardsIntro: null,
            paymentTermsDefault: null,
            sfAuditClause: null,
            contactEmail: 'admin@scan2plan.io',
            contactPhone: '(518) 362-2403',
            footerText: null,
        },
        sectionVisibility: {
            aboutScan2plan: true,
            whyScan2plan: true,
            capabilities: true,
            difference: true,
            bimStandards: true,
        },
        ...overrides,
    };
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const tests = [
        {
            name: 'no-template',
            label: 'No template content (should skip About/Why/Capabilities/Difference)',
            data: mockProposal(),
        },
        {
            name: 'with-template',
            label: 'With full template content',
            data: mockProposal({
                template: {
                    aboutScan2plan: 'Scan2Plan is the Northeast\'s premier 3D scanning and BIM services provider. Founded in 2019, we\'ve completed over 500 projects across commercial, industrial, and residential sectors.\n\nOur team of certified scanning technicians and BIM modelers deliver accurate, reliable as-built documentation using the latest Leica and FARO scanning equipment.\n\n• Industry-leading accuracy (2mm or better)\n• Fast turnaround times\n• Dedicated project management\n• 100% satisfaction guarantee',
                    whyScan2plan: 'What sets Scan2Plan apart:\n\n• Accuracy Guarantee: We guarantee 2mm accuracy or better on every scan, or we rescan at no charge.\n• Speed: Our streamlined workflow delivers results 40% faster than industry average.\n• Experience: 500+ completed projects across all building types.\n• Technology: Latest generation Leica RTC360 and FARO Focus scanners.\n• Support: Dedicated project manager for every engagement.',
                    capabilities: 'Our comprehensive scanning and modeling capabilities include:\n\n• 3D Laser Scanning (terrestrial and handheld)\n• BIM Modeling (LOD 200 through LOD 350+)\n• Point Cloud Processing and Registration\n• Scan-to-CAD Conversion\n• Clash Detection and Coordination\n• As-Built Documentation\n• Facade Surveys\n• Floor Flatness Analysis\n• Deformation Monitoring',
                    difference: 'The Scan2Plan Difference:\n\n• Quality First: Every model undergoes a rigorous QA/QC process before delivery.\n• Transparent Pricing: No hidden fees, no surprise charges. Your quote is your final price.\n• Flexible Delivery: Revit, AutoCAD, Navisworks, or any format you need.\n• Ongoing Support: 30 days of free revisions after delivery.\n• Data Security: All project data stored on encrypted, SOC 2 compliant servers.',
                    bimStandardsIntro: 'All BIM models are created in accordance with industry-standard Level of Development (LOD) specifications as defined by the BIM Forum. The table below outlines each LOD level and its applicability to your project.',
                    paymentTermsDefault: '50% deposit upon project authorization, 50% balance upon delivery of final deliverables.',
                    sfAuditClause: 'Final pricing is based on estimated square footage of {{estimatedSqft}} SF. If actual measured area differs by more than 10%, pricing will be adjusted proportionally based on the per-SF rate established in this proposal.',
                    contactEmail: 'proposals@scan2plan.io',
                    contactPhone: '(518) 362-2403',
                    footerText: 'Scan2Plan -- 3D Scanning & BIM Services -- scan2plan.io',
                },
            }),
        },
        {
            name: 'small-project',
            label: 'Small single-area project',
            data: mockProposal({
                projectName: 'Residential Bathroom Renovation',
                clientCompany: 'HomeWorks Design',
                contactName: 'Mike Torres',
                projectAddress: '15 Oak Street, Saratoga Springs, NY 12866',
                totalSquareFeet: 800,
                numberOfAreas: 1,
                numberOfFloors: 1,
                areas: [
                    {
                        name: 'Master Bathroom',
                        type: 'Residential',
                        squareFootage: 800,
                        scope: 'Interior',
                        lod: '200',
                        disciplines: ['Architecture'],
                    },
                ],
                estimateLineItems: [
                    { item: 'Master Bathroom -- Architecture', description: 'Interior | LoD 200 | 800 SF', qty: '800', rate: 2.50, amount: 2000 },
                    { item: 'Travel', description: 'Drive from Albany to 30 mi', qty: '1', rate: 500, amount: 500 },
                ],
                totalPrice: 2500,
                payment: {
                    structure: '50% deposit, 50% upon delivery',
                    upfrontAmount: 1250,
                    totalAmount: 2500,
                    methods: ['Check', 'Wire Transfer', 'Credit Card'],
                    terms: 'Net 30',
                    estimatedSqft: 800,
                },
                projectUnderstanding: {
                    buildingType: 'Residential',
                    totalSqft: 800,
                    projectDescription: 'HomeWorks Design has engaged Scan2Plan for scanning and BIM modeling of a residential bathroom renovation at 15 Oak Street.',
                    deliverables: 'Revit (2024) -- Architecture -- LoD 200',
                    additionalServices: [],
                    timeline: '2-3 weeks from scanning completion',
                    lodLevels: ['200'],
                },
                customMessage: null,
                sectionVisibility: {
                    aboutScan2plan: true,
                    whyScan2plan: true,
                    capabilities: false,
                    difference: false,
                    bimStandards: true,
                },
            }),
        },
    ];

    console.log('\n\x1b[1m\x1b[34m  S2PX Proposal PDF Layout Test\x1b[0m\n');

    for (const test of tests) {
        try {
            const pdfBuffer = await generateProposalPDF(test.data);
            const filename = `layout-test-${test.name}.pdf`;
            const filepath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filepath, pdfBuffer);

            const pages = pdfBuffer.toString().match(/\/Type\s*\/Page[^s]/g)?.length || 0;
            const sizeKB = Math.round(pdfBuffer.length / 1024);

            console.log(`  \x1b[32m✓\x1b[0m ${test.label}`);
            console.log(`    ${filename} — ${pages} pages, ${sizeKB} KB`);
        } catch (err) {
            console.error(`  \x1b[31m✗\x1b[0m ${test.label}`);
            console.error(`    Error: ${(err as Error).message}`);
        }
    }

    console.log(`\n  Output: ${OUTPUT_DIR}\n`);
}

main().catch(console.error);
