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

    // Default template if none provided
    const tpl: TemplateData = template || {
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
    };

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
