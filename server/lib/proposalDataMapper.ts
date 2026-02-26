// ── Proposal Data Mapper ──
// Maps scoping form + quote data → structured data for PDF generation.

import type { LineItemShell, QuoteTotals } from '../../shared/types/lineItem';

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

    // Line items (client-facing: no upteam cost)
    lineItems: {
        description: string;
        category: string;
        price: number;
    }[];

    // Totals
    totalPrice: number;
    itemCount: number;

    // Terms
    paymentTerms: string | null;
    estTimeline: string | null;
    projectTimeline: string | null;
    customScope: string | null;
    customMessage: string | null;
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
        paymentTerms?: string | null;
        estTimeline?: string | null;
        projectTimeline?: string | null;
        customScope?: string | null;
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
}

export function mapToProposalData(input: MapperInput): ProposalData {
    const { form, lineItems, totals, version, customMessage } = input;

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

    // Filter line items for client-facing view (only priced items, no upteam cost)
    const clientLineItems = lineItems
        .filter(li => li.clientPrice !== null && li.clientPrice > 0)
        .map(li => ({
            description: li.description,
            category: li.category,
            price: li.clientPrice!,
        }));

    const totalSF = areas.reduce((s, a) => s + a.squareFootage, 0);

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

        totalPrice: totals.totalClientPrice,
        itemCount: clientLineItems.length,

        paymentTerms: form.paymentTerms || null,
        estTimeline: form.estTimeline || null,
        projectTimeline: form.projectTimeline || null,
        customScope: form.customScope || null,
        customMessage: customMessage || null,
    };
}
