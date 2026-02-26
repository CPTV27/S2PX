/**
 * Phase 13 migration — create proposal_templates table and seed default template.
 *
 * Run: npx tsx server/scripts/migrate-phase13.ts
 */
import pg from 'pg';
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:wmh0PMUXgOrcGU9qvNFqZJX@localhost:5433/s2px';

async function main() {
    const client = new Client({ connectionString: DB_URL, ssl: false });
    await client.connect();
    console.log('Connected to database');

    // Proposal templates table
    await client.query(`
        CREATE TABLE IF NOT EXISTS proposal_templates (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'default',
            about_scan2plan TEXT,
            why_scan2plan TEXT,
            capabilities TEXT,
            difference TEXT,
            bim_standards_intro TEXT,
            payment_terms_default TEXT,
            sf_audit_clause TEXT,
            contact_email TEXT DEFAULT 'admin@scan2plan.io',
            contact_phone TEXT DEFAULT '(518) 362-2403',
            footer_text TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    `);
    console.log('✓ proposal_templates table created');

    // Check if default template exists
    const existing = await client.query(
        "SELECT id FROM proposal_templates WHERE name = 'default' LIMIT 1"
    );

    if (existing.rows.length === 0) {
        await client.query(`
            INSERT INTO proposal_templates (
                name,
                about_scan2plan,
                why_scan2plan,
                capabilities,
                difference,
                bim_standards_intro,
                payment_terms_default,
                sf_audit_clause,
                contact_email,
                contact_phone,
                footer_text
            ) VALUES (
                'default',
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
        `, [
            // about_scan2plan
            `Scan2Plan is a leading provider of 3D laser scanning and BIM modeling services. We combine cutting-edge technology with deep construction industry expertise to deliver accurate, reliable as-built documentation.\n\nOur mission is simple: let designers focus on design. We handle the complex reality capture and BIM production so our clients can spend their time on what matters most — creating great buildings.`,

            // why_scan2plan
            `• Accuracy Guaranteed — Sub-centimeter point cloud accuracy with rigorous QC processes\n• Fast Turnaround — Industry-leading delivery timelines without sacrificing quality\n• BIM Expertise — Our modelers are certified professionals with years of experience across all major platforms\n• Scalable Capacity — From single-room surveys to campus-wide documentation projects\n• End-to-End Service — Scanning, registration, modeling, and delivery all under one roof\n• Transparent Pricing — No hidden fees, no surprise charges`,

            // capabilities
            `Scan2Plan offers a comprehensive suite of 3D scanning and BIM services:\n\n• 3D Laser Scanning — High-definition reality capture using Leica and FARO scanners\n• Point Cloud Registration — Precision alignment and georeferencing\n• BIM Modeling — Revit, ArchiCAD, and AutoCAD deliverables at LOD 200-350+\n• Architectural Documentation — As-built floor plans, sections, and elevations\n• MEP Documentation — Mechanical, electrical, and plumbing system modeling\n• Structural Documentation — Structural framing and foundation modeling\n• Matterport 3D Tours — Immersive virtual walkthroughs\n• Site Photography — Professional documentation photography\n\nIndustries Served: Commercial Real Estate, Architecture, Engineering, Construction, Facilities Management, Historic Preservation`,

            // difference
            `What sets Scan2Plan apart:\n\n• Quality First — Every deliverable passes through our multi-stage QC pipeline before reaching your desk\n• Industry Veterans — Our team brings decades of combined experience in scanning, modeling, and construction\n• Technology Leaders — We invest in the latest scanning hardware and software to deliver the best results\n• Client Partnership — We don't just deliver files; we work with you to ensure the data serves your project goals\n• Proven Track Record — Hundreds of successful projects across the Northeast and beyond`,

            // bim_standards_intro
            `The following table outlines the standard Level of Development (LoD) specifications used in our BIM deliverables. Highlighted rows indicate the LoD levels applicable to this project.`,

            // payment_terms_default
            `Payment is due in two installments:\n• 50% deposit upon project authorization\n• 50% balance upon delivery of final deliverables\n\nAccepted payment methods: Check, Wire Transfer, Credit Card\nStandard terms: Net 30`,

            // sf_audit_clause
            `Final square footage will be verified during scanning. Pricing will be adjusted if actual square footage differs by more than 10% from the estimate provided. Client will be notified of any adjustments before additional work proceeds.`,

            // contact_email
            'admin@scan2plan.io',

            // contact_phone
            '(518) 362-2403',

            // footer_text
            'Scan2Plan — 3D Scanning & BIM Services'
        ]);
        console.log('✓ Default template seeded');
    } else {
        console.log('✓ Default template already exists, skipping seed');
    }

    // Verify
    const res = await client.query(
        "SELECT id, name FROM proposal_templates"
    );
    console.log('Templates:', res.rows);

    await client.end();
    console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
