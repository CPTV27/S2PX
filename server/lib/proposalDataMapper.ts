// ── Proposal Data Mapper ──
// Maps scoping form + quote + template data → structured data for PDF generation.

import type { LineItemShell, QuoteTotals } from '../../shared/types/lineItem';

// ── 5-column estimate line item for PDF table ──
export interface EstimateLineItem {
    item: string;
    description: string;
    qty: string;
    rate: number;
    amount: number;
}

// ── Section visibility controls ──
export interface SectionVisibility {
    aboutScan2plan?: boolean;
    whyScan2plan?: boolean;
    capabilities?: boolean;
    difference?: boolean;
    bimStandards?: boolean;
    [key: string]: boolean | undefined;
}

// ── Template boilerplate data ──
export interface TemplateData {
    aboutScan2plan: string | null;
    whyScan2plan: string | null;
    capabilities: string | null;
    difference: string | null;
    bimStandardsIntro: string | null;
    paymentTermsDefault: string | null;
    sfAuditClause: string | null;
    contactEmail: string;
    contactPhone: string;
    footerText: string | null;
    sectionVisibility?: SectionVisibility | null;
}

// ── Full proposal data for PDF rendering ──
export interface ProposalData {
    // Header
    upid: string;
    date: string;
    version: number;

    // Client
    clientCompany: string;
    contactName: string;
    contactEmail: string;
    projectName: string;
    projectAddress: string;

    // Scope summary
    totalSquareFeet: number;
    numberOfAreas: number;
    numberOfFloors: number;
    bimDeliverable: string;
    bimVersion: string | null;
    expedited: boolean;
    georeferencing: boolean;
    travelMode: string;

    // Area summaries
    areas: {
        name: string;
        type: string;
        squareFootage: number;
        scope: string;
        lod: string;
        disciplines: string[];
    }[];

    // Line items (client-facing: no upteam cost) — 2-col legacy
    lineItems: {
        description: string;
        category: string;
        price: number;
    }[];

    // 5-column estimate table
    estimateLineItems: EstimateLineItem[];

    // Totals
    totalPrice: number;
    itemCount: number;

    // Terms
    paymentTerms: string | null;
    estTimeline: string | null;
    projectTimeline: string | null;
    customScope: string | null;
    customMessage: string | null;

    // Project understanding (auto-generated from form data)
    projectUnderstanding: {
        buildingType: string;
        totalSqft: number;
        projectDescription: string;
        deliverables: string;
        additionalServices: string[];
        timeline: string;
        lodLevels: string[];
    };

    // Payment breakdown
    payment: {
        structure: string;
        upfrontAmount: number;
        totalAmount: number;
        methods: string[];
        terms: string;
        estimatedSqft: number;
    };

    // Template boilerplate
    template: TemplateData;

    // Section visibility toggles
    sectionVisibility: SectionVisibility;
}

interface MapperInput {
    form: {
        upid: string;
        clientCompany: string;
        primaryContactName: string;
        contactEmail: string;
        projectName: string;
        projectAddress: string;
        numberOfFloors: number;
        bimDeliverable: string;
        bimVersion?: string | null;
        expedited: boolean;
        georeferencing: boolean;
        travelMode: string;
        era?: string | null;
        roomDensity?: number | null;
        dispatchLocation?: string | null;
        oneWayMiles?: number | null;
        landscapeModeling?: string | null;
        scanRegOnly?: string | null;
        paymentTerms?: string | null;
        estTimeline?: string | null;
        projectTimeline?: string | null;
        customScope?: string | null;
        internalNotes?: string | null;
        areas?: {
            areaName?: string | null;
            areaType: string;
            squareFootage: number;
            projectScope: string;
            lod: string;
            structural?: { enabled: boolean } | null;
            mepf?: { enabled: boolean } | null;
            cadDeliverable: string;
            act?: { enabled: boolean } | null;
            belowFloor?: { enabled: boolean } | null;
        }[];
    };
    lineItems: LineItemShell[];
    totals: QuoteTotals;
    version: number;
    customMessage?: string | null;
    template?: TemplateData | null;
}

export function mapToProposalData(input: MapperInput): ProposalData {
    const { form, lineItems, totals, version, customMessage, template } = input;

    // Build area summaries
    const areas = (form.areas || []).map(a => {
        const disciplines: string[] = ['Architecture'];
        if (a.structural?.enabled) disciplines.push('Structural');
        if (a.mepf?.enabled) disciplines.push('MEPF');
        if (a.cadDeliverable && a.cadDeliverable !== 'No') disciplines.push(`CAD (${a.cadDeliverable})`);
        if (a.act?.enabled) disciplines.push('Above Ceiling');
        if (a.belowFloor?.enabled) disciplines.push('Below Floor');

        return {
            name: a.areaName || a.areaType,
            type: a.areaType,
            squareFootage: a.squareFootage,
            scope: a.projectScope,
            lod: a.lod,
            disciplines,
        };
    });

    // Filter line items for client-facing view (only priced items)
    const clientLineItems = lineItems
        .filter(li => li.clientPrice !== null && li.clientPrice > 0)
        .map(li => ({
            description: li.description,
            category: li.category,
            price: li.clientPrice!,
        }));

    // Build 5-column estimate line items
    const estimateLineItems = buildEstimateLineItems(lineItems, areas);

    const totalSF = areas.reduce((s, a) => s + a.squareFootage, 0);
    const totalPrice = totals.totalClientPrice;

    // Unique LoD levels across all areas
    const lodLevels = [...new Set(areas.map(a => a.lod))];

    // Additional services
    const additionalServices: string[] = [];
    if (form.georeferencing) additionalServices.push('Georeferencing');
    if (form.expedited) additionalServices.push('Expedited delivery (+20% surcharge)');
    if (form.landscapeModeling && form.landscapeModeling !== 'No') additionalServices.push('Landscape modeling');
    if (form.scanRegOnly && form.scanRegOnly !== 'none') additionalServices.push(`Scan & Registration Only (${form.scanRegOnly})`);

    // All disciplines across all areas
    const allDisciplines = [...new Set(areas.flatMap(a => a.disciplines))];

    // Default template with boilerplate from existing proposals.
    // Users can customize these via /dashboard/settings/proposal-template.
    const defaultTemplate: TemplateData = {
        aboutScan2plan: 'We began in 2018 with a simple goal of helping firms focus on design. We\'re an on-demand LiDAR to BIM/CAD team that can model any building in weeks. This can be done within any scope, budget or schedule. We\'ve scanned over 1,000 buildings (~10M sqft).\n\nWe use LiDAR scanners for 3D mapping with extreme accuracy. We deliver professionally drafted 3D BIM and 2D CAD for comprehensive existing conditions documentation. Our Point Cloud datasets serve as a verifiable single-source-of-truth for coordination and risk-mitigation across projects.',
        whyScan2plan: '- Experienced, dedicated team of field techs, drafters (AutoCAD and Revit) and licensed engineers.\n- We take the time to scope each project to suit your priorities.\n- We use the finest precision tools to capture a point cloud with extreme accuracy.\n- Drafted to Scan2Plan\'s rigorous design standards - your design phase begins upon delivery.\n- We take a process driven approach with extensive quality control and team review.\n- Exceptional support from real professionals.\n- Scan2Plan has national and international coverage.\n- We work on a wide range of projects from single family homes to large-scale commercial, industrial and infrastructure.',
        capabilities: 'Scan2Plan is for: Architects, Structural Engineers, MEP Engineers, Interior Designers, Property Managers, Owner/Operators, Landscape Architects, Civil Engineers.\n\n- Scan-to-BIM: Architectural & Structural Existing Conditions Documentation. Deliverables include Revit Model, Colorized Point Cloud, and 360 Photo documentation. Standard LoD options: 200, 300, 350.\n- BIM to CAD Conversion: Pristine CAD drawings converted from Revit Model.\n- MEPF Modeling: Any exposed Mechanical, Electrical, Plumbing and Fire Safety elements documented in BIM or CAD.\n- Landscape: Landscape, grounds, and urban spaces documented in BIM or CAD. Georeferencing and forestry optional.\n- Matterport 3D Tour: High resolution 360 photo documentation and virtual tour walkthrough.\n- Paper to BIM or CAD: Legacy 2D paper drawings converted to functional BIM or CAD documentation.\n- Model Only / Point Cloud Only: You work with our point cloud or we\'ll model from yours. We support Revit, AutoCAD, Sketchup, Rhino, Vectorworks, and others.',
        difference: 'What to look for in a Scan-to-BIM partner.\n\nIn the evolving landscape of scanning and modeling, it\'s important to consider your options to find a service that aligns with your specific needs. Scan2Plan is committed to delivering quality and precision. Here\'s what sets us apart:\n\n- High-Quality Data for Superior Results: We capture all our point cloud data sets in full color, with significant overlap and redundancy. This maximizes point cloud density, leading to more accurate and detailed models.\n- Precision with Terrestrial LiDAR: We use high-end terrestrial LiDAR for unparalleled accuracy. Using the Trimble X7 scanner for every project, we guarantee consistent millimeter accuracy with validation from 0" to 1/8".\n- Setting High Standards in BIM & CAD: We offer the highest standard of Levels of Development (LoD) 200, 300, and 350, for schematic and construction-ready documentation.\n- The Human Touch in Modeling and Drafting: We take pride in our 100% manual approach to modeling and drafting. Our expert team meticulously translates data into detailed models and drawings.\n- Rigorous Quality Control for Trusted Accuracy: Our dedicated QC team conducts multiple checks on every deliverable, ensuring they meet our high standards.\n- Customized to Your Standards: We adapt to your specific needs, integrating your Revit Templates or CAD Standards for a seamless transition from delivery to design.\n- Dedicated Support & Revisions: We offer comprehensive support, including demonstrations and revisions until you\'re completely satisfied.\n- Ready When You Are: Our scanning techs are typically available to be on-site within a week of a signed contract.',
        bimStandardsIntro: 'All BIM models are created in accordance with industry-standard Level of Development (LOD) specifications as defined by the BIM Forum. The table below outlines each LOD level and its applicability to your project.',
        paymentTermsDefault: '50% of the estimated cost will be due at the time of the client engaging the Services. The first invoice will be for half of the estimated cost. The second invoice will be for the outstanding balance based on the total square footage scanned and modeled.',
        sfAuditClause: 'The price estimate is based on a square footage estimate of {{estimatedSqft}} SF. The total cost of the project will be determined by the actual square footage scanned and modeled. We use the BOMA \'Gross Area Standard Method\' and will send a square footage audit approximately one week after scan completion.',
        contactEmail: 'admin@scan2plan.io',
        contactPhone: '(518) 362-2403',
        footerText: 'Scan2Plan -- 3D Scanning & BIM Services -- scan2plan.io',
    };
    const tpl: TemplateData = template || defaultTemplate;

    return {
        upid: form.upid,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        version,

        clientCompany: form.clientCompany,
        contactName: form.primaryContactName,
        contactEmail: form.contactEmail,
        projectName: form.projectName,
        projectAddress: form.projectAddress,

        totalSquareFeet: totalSF,
        numberOfAreas: areas.length,
        numberOfFloors: form.numberOfFloors,
        bimDeliverable: form.bimDeliverable,
        bimVersion: form.bimVersion || null,
        expedited: form.expedited,
        georeferencing: form.georeferencing,
        travelMode: form.travelMode,

        areas,
        lineItems: clientLineItems,
        estimateLineItems,

        totalPrice,
        itemCount: clientLineItems.length,

        paymentTerms: form.paymentTerms || null,
        estTimeline: form.estTimeline || null,
        projectTimeline: form.projectTimeline || null,
        customScope: form.customScope || null,
        customMessage: customMessage || null,

        projectUnderstanding: {
            buildingType: areas.length > 0 ? areas[0].type : 'Unknown',
            totalSqft: totalSF,
            projectDescription: `${form.clientCompany} has engaged Scan2Plan to provide professional 3D laser scanning and BIM modeling services for ${form.projectName}, located at ${form.projectAddress}. The project encompasses ${totalSF.toLocaleString()} square feet across ${form.numberOfFloors} floor(s).`,
            deliverables: `${form.bimDeliverable}${form.bimVersion ? ` (${form.bimVersion})` : ''} — ${allDisciplines.join(', ')} — LoD ${lodLevels.join(', ')}`,
            additionalServices,
            timeline: form.estTimeline || '4-6 weeks from scanning completion',
            lodLevels,
        },

        payment: {
            structure: tpl.paymentTermsDefault || '50% deposit upon project authorization, 50% balance upon delivery of final deliverables',
            upfrontAmount: totalPrice * 0.5,
            totalAmount: totalPrice,
            methods: ['Check', 'Wire Transfer', 'Credit Card'],
            terms: form.paymentTerms || 'Net 30',
            estimatedSqft: totalSF,
        },

        template: tpl,

        // Section visibility (default all visible)
        sectionVisibility: {
            aboutScan2plan: tpl.sectionVisibility?.aboutScan2plan !== false,
            whyScan2plan: tpl.sectionVisibility?.whyScan2plan !== false,
            capabilities: tpl.sectionVisibility?.capabilities !== false,
            difference: tpl.sectionVisibility?.difference !== false,
            bimStandards: tpl.sectionVisibility?.bimStandards !== false,
        },
    };
}

/**
 * Convert LineItemShell[] into 5-column EstimateLineItem[] for the PDF table.
 */
function buildEstimateLineItems(
    lineItems: LineItemShell[],
    areas: { name: string; squareFootage: number }[]
): EstimateLineItem[] {
    const areaMap = new Map(areas.map(a => [a.name, a.squareFootage]));

    return lineItems
        .filter(li => li.clientPrice !== null && li.clientPrice > 0)
        .map(li => {
            const sf = li.squareFeet || areaMap.get(li.areaName) || 0;
            const price = li.clientPrice!;

            // Determine item name and description
            let item = li.areaName;
            let description = li.description;

            // Shorten the description for the table — use discipline if available
            if (li.discipline) {
                item = `${li.areaName} — ${capitalize(li.discipline)}`;
                description = [
                    li.scope ? `${li.scope}` : '',
                    li.lod ? `LoD ${li.lod}` : '',
                    sf > 0 ? `${sf.toLocaleString()} SF` : '',
                ].filter(Boolean).join(' | ');
            } else if (li.category === 'travel') {
                item = 'Travel';
                description = li.description;
            } else if (li.category === 'addOn') {
                item = 'Additional Service';
                description = li.description;
            }

            const qty = sf > 0 ? sf.toLocaleString() : '1';
            const rate = sf > 0 ? price / sf : price;

            return {
                item,
                description: description || li.description,
                qty,
                rate: Math.round(rate * 100) / 100,
                amount: price,
            };
        });
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
