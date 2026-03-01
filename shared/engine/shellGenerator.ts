// ── Line Item Shell Generator ──
// Pure function: takes a scoping form + areas → generates line item shells.
// 15 rules (8 per-area, 7 project-level). CEO fills prices later.

import type { LineItemShell } from '../types/lineItem';

// Input types — match the DB/form shape
export interface ScopeAreaInput {
    id: number | string;
    areaType: string;
    areaName?: string | null;
    squareFootage: number;
    projectScope: string;
    lod: string;
    mixedInteriorLod?: string | null;
    mixedExteriorLod?: string | null;
    structural?: { enabled: boolean; sqft?: number } | null;
    mepf?: { enabled: boolean; sqft?: number } | null;
    cadDeliverable: string;
    act?: { enabled: boolean; sqft?: number } | null;
    belowFloor?: { enabled: boolean; sqft?: number } | null;
    site?: { enabled: boolean; sqft?: number } | null;
    matterport?: { enabled: boolean; sqft?: number } | null;
    customLineItems?: { description: string; amount: number }[] | null;
}

export interface ScopingFormInput {
    // Section E
    landscapeModeling?: string | null;
    landscapeAcres?: number | string | null;
    landscapeTerrain?: string | null;
    // Section F
    georeferencing: boolean;
    // Section H
    scanRegOnly?: string | null;
    expedited: boolean;
    // Section I
    dispatchLocation: string;
    oneWayMiles: number;
    travelMode: string;
    customTravelCost?: number | string | null;
    mileageRate?: number | string | null;
    scanDayFeeOverride?: number | string | null;
    // Areas
    areas: ScopeAreaInput[];
}

let counter = 0;
function nextId(): string {
    return `li-${++counter}`;
}

/** Reset the ID counter (useful for tests) */
export function resetIdCounter(): void {
    counter = 0;
}

function formatSF(sqft: number): string {
    return sqft.toLocaleString('en-US');
}

function scopeLabel(scope: string): string {
    switch (scope) {
        case 'Full': return 'Full Scope';
        case 'Int Only': return 'Interior Only';
        case 'Ext Only': return 'Exterior Only';
        case 'Mixed': return 'Mixed Scope';
        default: return scope;
    }
}

// ── Per-Area Rules (1-6) ──

function generateAreaShells(area: ScopeAreaInput): LineItemShell[] {
    const shells: LineItemShell[] = [];
    const areaId = String(area.id);
    const areaName = area.areaName || area.areaType;
    const sf = formatSF(area.squareFootage);
    const baseDesc = `${area.areaType} — ${sf} SF — LoD ${area.lod} — ${scopeLabel(area.projectScope)}`;

    // Rule 1: Architecture line — always present for every area
    shells.push({
        id: nextId(),
        areaId,
        areaName,
        category: 'modeling',
        discipline: 'architecture',
        description: `Architecture — ${baseDesc}`,
        buildingType: area.areaType,
        squareFeet: area.squareFootage,
        lod: area.lod,
        scope: area.projectScope,
        upteamCost: null,
        clientPrice: null,
    });

    // Rule 2: Structure line — if structural.enabled
    if (area.structural?.enabled) {
        const sqft = area.structural.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'modeling',
            discipline: 'structural',
            description: `Structural — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 3: MEPF line — if mepf.enabled
    if (area.mepf?.enabled) {
        const sqft = area.mepf.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'modeling',
            discipline: 'mepf',
            description: `MEPF — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 4: CAD line — if cadDeliverable !== 'No'
    if (area.cadDeliverable && area.cadDeliverable !== 'No') {
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'addOn',
            discipline: 'cad',
            description: `CAD Deliverable (${area.cadDeliverable}) — ${area.areaType} — ${sf} SF`,
            buildingType: area.areaType,
            squareFeet: area.squareFootage,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 5: ACT line — if act.enabled
    if (area.act?.enabled) {
        const sqft = area.act.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'addOn',
            discipline: 'act',
            description: `Above Ceiling Tile — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 6: Below Floor line — if belowFloor.enabled
    if (area.belowFloor?.enabled) {
        const sqft = area.belowFloor.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'addOn',
            discipline: 'below-floor',
            description: `Below Floor — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 7: Site / Civil line — if site.enabled
    if (area.site?.enabled) {
        const sqft = area.site.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'modeling',
            discipline: 'site',
            description: `Site / Civil — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 8: Matterport line — if matterport.enabled
    if (area.matterport?.enabled) {
        const sqft = area.matterport.sqft || area.squareFootage;
        shells.push({
            id: nextId(),
            areaId,
            areaName,
            category: 'addOn',
            discipline: 'matterport',
            description: `Matterport Scan — ${area.areaType} — ${formatSF(sqft)} SF`,
            buildingType: area.areaType,
            squareFeet: sqft,
            lod: area.lod,
            scope: area.projectScope,
            upteamCost: null,
            clientPrice: null,
        });
    }

    return shells;
}

// ── Project-Level Rules (7-13) ──

function generateProjectShells(form: ScopingFormInput, areaShells: LineItemShell[]): LineItemShell[] {
    const shells: LineItemShell[] = [];

    // Rule 7: Travel line — always present
    const mileageRate = form.mileageRate != null ? Number(form.mileageRate) : null;
    const rateSuffix = mileageRate != null ? ` — $${mileageRate}/mi` : '';
    shells.push({
        id: nextId(),
        areaId: null,
        areaName: 'Project-Level',
        category: 'travel',
        discipline: 'travel',
        description: `Travel — ${form.dispatchLocation} to ${form.oneWayMiles} mi — ${form.travelMode}${rateSuffix}`,
        buildingType: '',
        upteamCost: null,
        clientPrice: null,
    });

    // Rule 8: Georeferencing line — if georeferencing === true
    if (form.georeferencing) {
        shells.push({
            id: nextId(),
            areaId: null,
            areaName: 'Project-Level',
            category: 'addOn',
            discipline: 'georeferencing',
            description: `Georeferencing — per structure`,
            buildingType: '',
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 9: Expedited surcharge — if expedited === true
    if (form.expedited) {
        shells.push({
            id: nextId(),
            areaId: null,
            areaName: 'Project-Level',
            category: 'addOn',
            discipline: 'expedited',
            description: `Expedited Surcharge — +20% on BIM modeling items`,
            buildingType: '',
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 10: Landscape line — if landscapeModeling !== 'No' and not empty
    if (form.landscapeModeling && form.landscapeModeling !== 'No') {
        const acres = form.landscapeAcres ? ` — ${form.landscapeAcres} acres` : '';
        const terrain = form.landscapeTerrain ? ` — ${form.landscapeTerrain}` : '';
        shells.push({
            id: nextId(),
            areaId: null,
            areaName: 'Project-Level',
            category: 'modeling',
            discipline: 'landscape',
            description: `Landscape (${form.landscapeModeling})${acres}${terrain}`,
            buildingType: '',
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 11: Scan & Reg line — if scanRegOnly !== 'none' and not empty
    if (form.scanRegOnly && form.scanRegOnly !== 'none') {
        const label = form.scanRegOnly === 'full_day' ? 'Full Day' : 'Half Day';
        shells.push({
            id: nextId(),
            areaId: null,
            areaName: 'Project-Level',
            category: 'addOn',
            discipline: 'scan-reg',
            description: `Scan & Registration Only — ${label}`,
            buildingType: '',
            upteamCost: null,
            clientPrice: null,
        });
    }

    // Rule 12: Custom line items — pass-through from each area
    for (const area of form.areas) {
        if (area.customLineItems && area.customLineItems.length > 0) {
            const areaName = area.areaName || area.areaType;
            for (const item of area.customLineItems) {
                shells.push({
                    id: nextId(),
                    areaId: String(area.id),
                    areaName,
                    category: 'custom',
                    description: item.description,
                    buildingType: area.areaType,
                    upteamCost: null,
                    clientPrice: item.amount || null,
                });
            }
        }
    }

    return shells;
}

// ── Main Export ──

/**
 * Generate line item shells from a completed scoping form.
 * All prices are null — the CEO fills them in Phase 3.
 *
 * 15 rules:
 *   Per area: 1) Architecture, 2) Structural, 3) MEPF, 4) CAD, 5) ACT,
 *             6) Below Floor, 7) Site/Civil, 8) Matterport
 *   Project:  9) Travel, 10) Georeferencing, 11) Expedited, 12) Landscape,
 *             13) Scan & Reg, 14) Custom line items
 */
export function generateLineItemShells(form: ScopingFormInput): LineItemShell[] {
    resetIdCounter();

    // Per-area shells
    const areaShells: LineItemShell[] = [];
    for (const area of form.areas) {
        areaShells.push(...generateAreaShells(area));
    }

    // Project-level shells
    const projectShells = generateProjectShells(form, areaShells);

    return [...areaShells, ...projectShells];
}
