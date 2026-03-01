#!/usr/bin/env tsx
/**
 * ── S2PX Deal Pipeline End-to-End Test Script ──
 *
 * Creates 10 diverse scoping forms with real addresses, generates line items,
 * prices them at $1-3/sqft, computes totals, saves quotes, and generates
 * proposal PDFs locally for review.
 *
 * Usage:
 *   npx tsx server/scripts/test-deal-pipeline.ts
 *
 * Requires: DATABASE_URL environment variable
 * Output:  test-proposals/ directory with PDFs + grading report
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { scopingForms, scopeAreas, quotes, proposalTemplates } from '../../shared/schema/db.js';
import { generateLineItemShells, resetIdCounter, type ScopingFormInput } from '../../shared/engine/shellGenerator.js';
import { computeQuoteTotals } from '../../shared/engine/quoteTotals.js';
import { mapToProposalData, type TemplateData } from '../lib/proposalDataMapper.js';
import { generateProposalPDF } from '../pdf/proposalGenerator.js';
import type { LineItemShell } from '../../shared/types/lineItem.js';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// ── Colors ──
const G = '\x1b[32m';
const R = '\x1b[31m';
const Y = '\x1b[33m';
const B = '\x1b[34m';
const C = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const X = '\x1b[0m';

// ── Test Deal Definitions ──
interface TestDeal {
    name: string;
    description: string;
    form: Record<string, unknown>;
    areas: Record<string, unknown>[];
    pricingStrategy: 'standard' | 'premium' | 'budget' | 'mixed';
}

const TEST_DEALS: TestDeal[] = [
    {
        name: '1. Simple Commercial Office',
        description: 'Basic single-building commercial, LOD 300, full scope',
        form: {
            clientCompany: 'Acme Corporation',
            projectName: 'Acme HQ Office Renovation',
            projectAddress: '123 Main Street, Troy, NY 12180',
            projectLat: '42.7284',
            projectLng: '-73.6918',
            email: 'test@acme.com',
            primaryContactName: 'Jane Smith',
            contactEmail: 'jane@acme.com',
            contactPhone: '(518) 555-0101',
            numberOfFloors: 3,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: false,
            era: 'Modern',
            roomDensity: 2,
            riskFactors: ['None'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 5,
            travelMode: 'Local',
            leadSource: 'Referral',
            probability: 70,
            dealStage: 'qualified',
            priority: 2,
            estTimeline: '4 weeks from scanning completion',
            paymentTerms: 'Net 30',
        },
        areas: [
            {
                areaType: 'Commercial',
                areaName: 'Main Office Building',
                squareFootage: 30000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'No',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'standard',
    },
    {
        name: '2. Multi-Building Education Campus',
        description: '3 buildings, different sizes, LOD 300, education type',
        form: {
            clientCompany: 'State University of New York',
            projectName: 'SUNY Campus Modernization',
            projectAddress: '500 University Avenue, Albany, NY 12203',
            projectLat: '42.6866',
            projectLng: '-73.8240',
            email: 'facilities@suny.edu',
            primaryContactName: 'Dr. Robert Chen',
            contactEmail: 'rchen@suny.edu',
            contactPhone: '(518) 555-0202',
            numberOfFloors: 4,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: true,
            era: 'Modern',
            roomDensity: 3,
            riskFactors: ['High ceilings', 'Complex geometry'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 15,
            travelMode: 'Local',
            leadSource: 'Website',
            probability: 60,
            dealStage: 'proposal',
            priority: 1,
            estTimeline: '6-8 weeks from scanning completion',
            paymentTerms: 'Net 45',
        },
        areas: [
            {
                areaType: 'Education',
                areaName: 'Science Hall',
                squareFootage: 45000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'Basic',
                structural: { enabled: true, sqft: 45000 },
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
            {
                areaType: 'Education',
                areaName: 'Library Building',
                squareFootage: 35000,
                projectScope: 'Int Only',
                lod: '300',
                cadDeliverable: 'No',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
            {
                areaType: 'Education',
                areaName: 'Student Center',
                squareFootage: 20000,
                projectScope: 'Full',
                lod: '200',
                cadDeliverable: 'No',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'standard',
    },
    {
        name: '3. Large Healthcare Complex',
        description: 'All add-ons enabled, LOD 350, 150K SF',
        form: {
            clientCompany: 'Boston Medical Group',
            projectName: 'BMG Main Hospital Expansion',
            projectAddress: '200 Medical Center Drive, Boston, MA 02115',
            projectLat: '42.3386',
            projectLng: '-71.1036',
            email: 'projects@bmg.org',
            primaryContactName: 'Patricia Williams',
            contactEmail: 'pwilliams@bmg.org',
            contactPhone: '(617) 555-0303',
            numberOfFloors: 6,
            basementAttic: ['Basement'],
            estSfBasementAttic: 15000,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: true,
            era: 'Modern',
            roomDensity: 4,
            riskFactors: ['Complex MEPF', 'Active building', 'Security clearance'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 170,
            travelMode: 'Overnight',
            leadSource: 'Cold outreach',
            probability: 45,
            dealStage: 'qualified',
            priority: 1,
            estTimeline: '10-12 weeks from scanning completion',
            paymentTerms: 'Net 60',
            internalNotes: 'Major whale deal — CEO pricing required',
        },
        areas: [
            {
                areaType: 'Healthcare',
                areaName: 'Main Hospital Wing',
                squareFootage: 150000,
                projectScope: 'Full',
                lod: '350',
                cadDeliverable: 'Full',
                structural: { enabled: true, sqft: 150000 },
                mepf: { enabled: true, sqft: 150000 },
                act: { enabled: true, sqft: 80000 },
                belowFloor: { enabled: true, sqft: 50000 },
                customLineItems: null,
            },
        ],
        pricingStrategy: 'premium',
    },
    {
        name: '4. Historic Residential Brownstone',
        description: 'Small, exterior only, LOD 350, historic risk',
        form: {
            clientCompany: 'Heritage Homes LLC',
            projectName: 'Beacon Hill Brownstone Restoration',
            projectAddress: '45 Beacon Street, Boston, MA 02108',
            projectLat: '42.3558',
            projectLng: '-71.0640',
            email: 'info@heritagehomes.com',
            primaryContactName: 'Michael O\'Brien',
            contactEmail: 'mobrien@heritagehomes.com',
            contactPhone: '(617) 555-0404',
            numberOfFloors: 4,
            basementAttic: ['Basement', 'Attic'],
            estSfBasementAttic: 2000,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: false,
            era: 'Historic',
            roomDensity: 3,
            riskFactors: ['Historic building', 'Narrow access', 'Occupied'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 170,
            travelMode: 'Overnight',
            leadSource: 'Referral',
            probability: 80,
            dealStage: 'proposal',
            priority: 2,
            estTimeline: '3 weeks from scanning completion',
            paymentTerms: 'Net 30',
        },
        areas: [
            {
                areaType: 'Residential',
                areaName: 'Brownstone Exterior',
                squareFootage: 4000,
                projectScope: 'Ext Only',
                lod: '350',
                cadDeliverable: 'Basic',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'premium',
    },
    {
        name: '5. Industrial Warehouse with Landscape',
        description: 'Large simple space, LOD 200, landscape add-on',
        form: {
            clientCompany: 'Apex Logistics',
            projectName: 'Apex Distribution Center',
            projectAddress: '1200 Industrial Blvd, Newark, NJ 07114',
            projectLat: '40.6942',
            projectLng: '-74.1600',
            email: 'facilities@apexlogistics.com',
            primaryContactName: 'David Martinez',
            contactEmail: 'dmartinez@apexlogistics.com',
            contactPhone: '(973) 555-0505',
            numberOfFloors: 1,
            bimDeliverable: 'Revit',
            bimVersion: '2023',
            georeferencing: false,
            era: 'Modern',
            roomDensity: 0,
            riskFactors: ['Height hazards', 'Active operations'],
            landscapeModeling: 'LoD 200',
            landscapeAcres: 3,
            landscapeTerrain: 'Flat',
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 160,
            travelMode: 'Overnight',
            leadSource: 'Website',
            probability: 55,
            dealStage: 'qualified',
            priority: 3,
            estTimeline: '5 weeks from scanning completion',
            paymentTerms: 'Net 30',
        },
        areas: [
            {
                areaType: 'Industrial',
                areaName: 'Main Warehouse',
                squareFootage: 200000,
                projectScope: 'Full',
                lod: '200',
                cadDeliverable: 'No',
                structural: { enabled: true, sqft: 200000 },
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'budget',
    },
    {
        name: '6. Mixed-Use Development',
        description: '3 areas with different scopes and building types',
        form: {
            clientCompany: 'Broadway Development Group',
            projectName: 'Broadway Mixed-Use Tower',
            projectAddress: '800 Broadway, New York, NY 10003',
            projectLat: '40.7317',
            projectLng: '-73.9927',
            email: 'projects@broadwaydev.com',
            primaryContactName: 'Sarah Kim',
            contactEmail: 'skim@broadwaydev.com',
            contactPhone: '(212) 555-0606',
            numberOfFloors: 12,
            basementAttic: ['Basement'],
            estSfBasementAttic: 8000,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: true,
            era: 'Modern',
            roomDensity: 3,
            riskFactors: ['Occupied', 'Complex geometry'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 150,
            travelMode: 'Overnight',
            leadSource: 'Conference',
            probability: 50,
            dealStage: 'negotiation',
            priority: 1,
            estTimeline: '8-10 weeks from scanning completion',
            paymentTerms: 'Net 45',
        },
        areas: [
            {
                areaType: 'Retail',
                areaName: 'Ground Floor Retail',
                squareFootage: 15000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'Full',
                structural: null,
                mepf: { enabled: true, sqft: 15000 },
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
            {
                areaType: 'Commercial',
                areaName: 'Office Floors 2-6',
                squareFootage: 50000,
                projectScope: 'Int Only',
                lod: '300',
                cadDeliverable: 'Basic',
                structural: { enabled: true, sqft: 50000 },
                mepf: { enabled: true, sqft: 50000 },
                act: { enabled: true, sqft: 30000 },
                belowFloor: null,
                customLineItems: null,
            },
            {
                areaType: 'Residential',
                areaName: 'Residential Floors 7-12',
                squareFootage: 40000,
                projectScope: 'Mixed',
                lod: '300',
                mixedInteriorLod: '300',
                mixedExteriorLod: '200',
                cadDeliverable: 'No',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'premium',
    },
    {
        name: '7. Government Building — Expedited',
        description: 'Federal project, expedited surcharge, georeferencing',
        form: {
            clientCompany: 'U.S. General Services Administration',
            projectName: 'Federal Office Building Retrofit',
            projectAddress: '1000 Federal Plaza, Washington, DC 20001',
            projectLat: '38.8951',
            projectLng: '-77.0364',
            email: 'projects@gsa.gov',
            primaryContactName: 'Colonel James Harper',
            contactEmail: 'jharper@gsa.gov',
            contactPhone: '(202) 555-0707',
            numberOfFloors: 5,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: true,
            era: 'Historic',
            roomDensity: 2,
            riskFactors: ['Security clearance', 'Occupied', 'Historic building'],
            scanRegOnly: 'none',
            expedited: true,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 250,
            travelMode: 'Fly',
            customTravelCost: 2500,
            leadSource: 'RFP',
            probability: 35,
            dealStage: 'qualified',
            priority: 1,
            estTimeline: '3 weeks — EXPEDITED',
            paymentTerms: 'Net 30 — Government terms',
            customScope: 'Project requires ITAR compliance. All personnel must pass background check prior to site access.',
        },
        areas: [
            {
                areaType: 'Government',
                areaName: 'Federal Office Building',
                squareFootage: 75000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'A+S+Site',
                structural: { enabled: true, sqft: 75000 },
                mepf: { enabled: true, sqft: 75000 },
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'premium',
    },
    {
        name: '8. Retail with Custom Line Items',
        description: 'Custom add-ons for signage survey and fixture inventory',
        form: {
            clientCompany: 'Nordstrom Properties',
            projectName: 'Nordstrom Flagship Store Survey',
            projectAddress: '350 5th Avenue, New York, NY 10118',
            projectLat: '40.7484',
            projectLng: '-73.9857',
            email: 'reno@nordstrom.com',
            primaryContactName: 'Amanda Foster',
            contactEmail: 'afoster@nordstrom.com',
            contactPhone: '(212) 555-0808',
            numberOfFloors: 3,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: false,
            era: 'Modern',
            roomDensity: 1,
            riskFactors: ['Active store', 'Night scan required'],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 150,
            travelMode: 'Overnight',
            leadSource: 'Repeat client',
            probability: 90,
            dealStage: 'proposal',
            priority: 2,
            estTimeline: '4 weeks from scanning completion',
            paymentTerms: 'Net 30',
        },
        areas: [
            {
                areaType: 'Retail',
                areaName: 'Nordstrom Store — All Floors',
                squareFootage: 55000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'Full',
                structural: null,
                mepf: { enabled: true, sqft: 55000 },
                act: { enabled: true, sqft: 55000 },
                belowFloor: null,
                customLineItems: [
                    { description: 'Signage & Wayfinding Survey', amount: 3500 },
                    { description: 'Fixture Inventory & Tagging', amount: 5000 },
                    { description: 'After-hours scanning premium', amount: 2000 },
                ],
            },
        ],
        pricingStrategy: 'standard',
    },
    {
        name: '9. Scan & Reg Only — No BIM',
        description: 'Point cloud delivery only, half day',
        form: {
            clientCompany: 'Vermont Property Management',
            projectName: 'Burlington Office As-Built Survey',
            projectAddress: '100 Main Street, Burlington, VT 05401',
            projectLat: '44.4759',
            projectLng: '-73.2121',
            email: 'info@vtproperty.com',
            primaryContactName: 'Tom Baker',
            contactEmail: 'tbaker@vtproperty.com',
            contactPhone: '(802) 555-0909',
            numberOfFloors: 2,
            bimDeliverable: 'Point Cloud Only',
            georeferencing: false,
            era: 'Modern',
            roomDensity: 2,
            riskFactors: ['None'],
            scanRegOnly: 'half_day',
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 110,
            travelMode: 'Day trip',
            mileageRate: 0.67,
            leadSource: 'Referral',
            probability: 75,
            dealStage: 'qualified',
            priority: 3,
            estTimeline: '1 week — point cloud only',
            paymentTerms: 'Due on delivery',
        },
        areas: [
            {
                areaType: 'Commercial',
                areaName: 'Burlington Office',
                squareFootage: 8000,
                projectScope: 'Full',
                lod: '200',
                cadDeliverable: 'No',
                structural: null,
                mepf: null,
                act: null,
                belowFloor: null,
                customLineItems: null,
            },
        ],
        pricingStrategy: 'budget',
    },
    {
        name: '10. Maximum Complexity — Everything On',
        description: '5 areas, all toggles, landscape, geo, expedited, custom items',
        form: {
            clientCompany: 'Brookfield Asset Management',
            projectName: 'One World Trade Center — Full Survey',
            projectAddress: '1 World Trade Center, New York, NY 10007',
            projectLat: '40.7127',
            projectLng: '-74.0134',
            email: 'surveys@brookfield.com',
            primaryContactName: 'Elizabeth Warren-Chen',
            contactEmail: 'ewarren@brookfield.com',
            contactPhone: '(212) 555-1010',
            numberOfFloors: 25,
            basementAttic: ['Basement'],
            estSfBasementAttic: 30000,
            bimDeliverable: 'Revit',
            bimVersion: '2024',
            georeferencing: true,
            era: 'Modern',
            roomDensity: 3,
            riskFactors: ['Height hazards', 'Security clearance', 'Complex MEPF', 'Active building', 'Occupied'],
            landscapeModeling: 'LoD 300',
            landscapeAcres: 2,
            landscapeTerrain: 'Urban',
            scanRegOnly: 'full_day',
            expedited: true,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 155,
            travelMode: 'Overnight',
            leadSource: 'Conference',
            probability: 25,
            dealStage: 'qualified',
            priority: 1,
            estTimeline: '16-20 weeks — phased delivery',
            paymentTerms: 'Progress billing — 25% milestones',
            customScope: 'Phased access schedule required. Security escort mandatory for all floors above 20. Night scanning for lobby and retail areas.',
            internalNotes: 'WHALE DEAL — This is the biggest project we have ever quoted. Phase carefully.',
        },
        areas: [
            {
                areaType: 'Commercial',
                areaName: 'Lobby & Common Areas',
                squareFootage: 25000,
                projectScope: 'Full',
                lod: '350',
                cadDeliverable: 'Full',
                structural: { enabled: true, sqft: 25000 },
                mepf: { enabled: true, sqft: 25000 },
                act: { enabled: true, sqft: 25000 },
                belowFloor: { enabled: true, sqft: 15000 },
                customLineItems: [
                    { description: 'Security coordination fee', amount: 5000 },
                ],
            },
            {
                areaType: 'Retail',
                areaName: 'Retail Concourse',
                squareFootage: 40000,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'Full',
                structural: null,
                mepf: { enabled: true, sqft: 40000 },
                act: null,
                belowFloor: null,
                customLineItems: [
                    { description: 'Night scanning premium — retail', amount: 4000 },
                ],
            },
            {
                areaType: 'Commercial',
                areaName: 'Office Floors 3-15',
                squareFootage: 180000,
                projectScope: 'Int Only',
                lod: '300',
                cadDeliverable: 'A+S+Site',
                structural: { enabled: true, sqft: 180000 },
                mepf: { enabled: true, sqft: 180000 },
                act: { enabled: true, sqft: 100000 },
                belowFloor: { enabled: true, sqft: 60000 },
                customLineItems: null,
            },
            {
                areaType: 'Commercial',
                areaName: 'Executive Floors 16-20',
                squareFootage: 60000,
                projectScope: 'Full',
                lod: '350',
                cadDeliverable: 'Full',
                structural: { enabled: true, sqft: 60000 },
                mepf: { enabled: true, sqft: 60000 },
                act: { enabled: true, sqft: 60000 },
                belowFloor: null,
                customLineItems: null,
            },
            {
                areaType: 'Commercial',
                areaName: 'Mechanical Floors 21-25',
                squareFootage: 50000,
                projectScope: 'Mixed',
                lod: '300',
                mixedInteriorLod: '350',
                mixedExteriorLod: '200',
                cadDeliverable: 'A+S+Site',
                structural: { enabled: true, sqft: 50000 },
                mepf: { enabled: true, sqft: 50000 },
                act: null,
                belowFloor: null,
                customLineItems: [
                    { description: 'Confined space survey premium', amount: 8000 },
                ],
            },
        ],
        pricingStrategy: 'premium',
    },
];

// ── Pricing Strategies ──
// All ensure margin ≥ 45% (passed integrity check)
// Client price per SF ranges $1-3, upteam cost is ~40-50% of client price

function priceLineItems(items: LineItemShell[], strategy: TestDeal['pricingStrategy']): LineItemShell[] {
    const rates: Record<string, { costMultiplier: number; pricePerSf: number }> = {
        budget:   { costMultiplier: 0.45, pricePerSf: 1.25 },
        standard: { costMultiplier: 0.48, pricePerSf: 1.75 },
        premium:  { costMultiplier: 0.42, pricePerSf: 2.50 },
        mixed:    { costMultiplier: 0.46, pricePerSf: 2.00 },
    };
    const { costMultiplier, pricePerSf } = rates[strategy];

    return items.map(item => {
        let clientPrice: number;
        const sf = item.squareFeet || 0;

        switch (item.category) {
            case 'modeling': {
                // Architecture: base rate per SF
                if (sf > 0) {
                    let rate = pricePerSf;
                    // Premium for higher LoD
                    if (item.lod === '350') rate *= 1.4;
                    if (item.lod === '200') rate *= 0.7;
                    // Adjust for discipline
                    if (item.discipline === 'structural') rate *= 0.6;
                    if (item.discipline === 'mepf') rate *= 0.8;
                    if (item.discipline === 'cad') rate *= 0.3;
                    if (item.discipline === 'act') rate *= 0.4;
                    if (item.discipline === 'below-floor') rate *= 0.35;
                    clientPrice = Math.round(sf * rate * 100) / 100;
                } else {
                    clientPrice = 1500; // flat for non-area items
                }
                break;
            }
            case 'travel': {
                clientPrice = strategy === 'budget' ? 800 :
                    strategy === 'premium' ? 2500 : 1500;
                break;
            }
            case 'addOn': {
                // Georef, expedited, landscape, scan-reg
                if (item.discipline === 'georeferencing') clientPrice = 1500;
                else if (item.discipline === 'expedited') {
                    // 20% surcharge on total modeling — estimate at $5K-20K
                    clientPrice = strategy === 'premium' ? 15000 : 5000;
                }
                else if (item.discipline === 'landscape') clientPrice = 3500;
                else if (item.discipline === 'scan-reg') clientPrice = 2500;
                else clientPrice = 2000;
                break;
            }
            case 'custom': {
                // Custom items already have amount set as clientPrice
                clientPrice = item.clientPrice || 2000;
                break;
            }
            default:
                clientPrice = 1500;
        }

        const upteamCost = Math.round(clientPrice * costMultiplier * 100) / 100;

        return {
            ...item,
            upteamCost,
            clientPrice,
        };
    });
}

// ── Convert form data to ScopingFormInput for shell generator ──
function toShellInput(form: Record<string, unknown>, areas: Record<string, unknown>[]): ScopingFormInput {
    return {
        landscapeModeling: (form.landscapeModeling as string) || 'No',
        landscapeAcres: form.landscapeAcres as number | undefined,
        landscapeTerrain: form.landscapeTerrain as string | undefined,
        georeferencing: form.georeferencing as boolean,
        scanRegOnly: (form.scanRegOnly as string) || 'none',
        expedited: form.expedited as boolean,
        dispatchLocation: (form.dispatchLocation as string) || 'Troy NY',
        oneWayMiles: (form.oneWayMiles as number) || 0,
        travelMode: (form.travelMode as string) || 'Local',
        customTravelCost: form.customTravelCost as number | undefined,
        mileageRate: form.mileageRate as number | undefined,
        scanDayFeeOverride: form.scanDayFeeOverride as number | undefined,
        areas: areas.map((a, i) => ({
            id: i + 1,
            areaType: a.areaType as string,
            areaName: a.areaName as string,
            squareFootage: a.squareFootage as number,
            projectScope: a.projectScope as string,
            lod: a.lod as string,
            mixedInteriorLod: a.mixedInteriorLod as string | undefined,
            mixedExteriorLod: a.mixedExteriorLod as string | undefined,
            cadDeliverable: a.cadDeliverable as string,
            structural: a.structural as { enabled: boolean; sqft?: number } | null,
            mepf: a.mepf as { enabled: boolean; sqft?: number } | null,
            act: a.act as { enabled: boolean; sqft?: number } | null,
            belowFloor: a.belowFloor as { enabled: boolean; sqft?: number } | null,
            customLineItems: a.customLineItems as { description: string; amount: number }[] | null,
        })),
    };
}

// ── UPID generator (matches server/routes/scoping.ts) ──
async function generateUpid(db: ReturnType<typeof drizzle>): Promise<string> {
    const result = await db.execute(sql`SELECT nextval('upid_seq') as seq`);
    const seq = (result.rows[0] as { seq: string }).seq;
    const year = new Date().getFullYear();
    return `S2P-${seq.padStart(4, '0')}-${year}`;
}

// ── Grade a proposal ──
interface ProposalGrade {
    deal: string;
    lineItemCount: number;
    totalPrice: number;
    margin: number;
    marginStatus: string;
    pdfPages: number;
    pdfSize: string;
    issues: string[];
    score: string;
    grade: string;
}

function gradeProposal(
    deal: TestDeal,
    lineItems: LineItemShell[],
    totals: ReturnType<typeof computeQuoteTotals>,
    pdfBuffer: Buffer,
): ProposalGrade {
    const issues: string[] = [];
    let scorePoints = 100;

    // Check integrity
    if (totals.integrityStatus === 'blocked') {
        issues.push('BLOCKED: margin < 40%');
        scorePoints -= 30;
    } else if (totals.integrityStatus === 'warning') {
        issues.push('WARNING: margin 40-45%');
        scorePoints -= 10;
    }

    // Check all items priced
    const unpriced = lineItems.filter(li => li.clientPrice === null || li.upteamCost === null);
    if (unpriced.length > 0) {
        issues.push(`${unpriced.length} unpriced line items`);
        scorePoints -= 20;
    }

    // Check negative margin items
    const negativeMargin = lineItems.filter(li =>
        li.upteamCost !== null && li.clientPrice !== null && li.upteamCost > li.clientPrice
    );
    if (negativeMargin.length > 0) {
        issues.push(`${negativeMargin.length} negative margin items`);
        scorePoints -= 15;
    }

    // Check total price sanity (should be > $0)
    if (totals.totalClientPrice <= 0) {
        issues.push('Total price is $0 or negative');
        scorePoints -= 25;
    }

    // Check PDF size (should be reasonable: 50KB - 2MB)
    const pdfSizeKB = pdfBuffer.length / 1024;
    if (pdfSizeKB < 50) {
        issues.push(`PDF suspiciously small (${pdfSizeKB.toFixed(0)}KB)`);
        scorePoints -= 10;
    }
    if (pdfSizeKB > 2048) {
        issues.push(`PDF unusually large (${(pdfSizeKB / 1024).toFixed(1)}MB)`);
        scorePoints -= 5;
    }

    // Check area count matches
    const expectedAreas = deal.areas.length;
    const generatedAreaItems = lineItems.filter(li => li.discipline === 'architecture');
    if (generatedAreaItems.length !== expectedAreas) {
        issues.push(`Expected ${expectedAreas} architecture lines, got ${generatedAreaItems.length}`);
        scorePoints -= 15;
    }

    // Check travel exists
    const travelItems = lineItems.filter(li => li.category === 'travel');
    if (travelItems.length === 0) {
        issues.push('No travel line item generated');
        scorePoints -= 10;
    }

    // Check conditional items
    if (deal.form.georeferencing && !lineItems.some(li => li.discipline === 'georeferencing')) {
        issues.push('Georeferencing enabled but no line item generated');
        scorePoints -= 10;
    }
    if (deal.form.expedited && !lineItems.some(li => li.discipline === 'expedited')) {
        issues.push('Expedited enabled but no line item generated');
        scorePoints -= 10;
    }
    if (deal.form.landscapeModeling && deal.form.landscapeModeling !== 'No' &&
        !lineItems.some(li => li.discipline === 'landscape')) {
        issues.push('Landscape enabled but no line item generated');
        scorePoints -= 10;
    }
    if (deal.form.scanRegOnly && deal.form.scanRegOnly !== 'none' &&
        !lineItems.some(li => li.discipline === 'scan-reg')) {
        issues.push('Scan & Reg enabled but no line item generated');
        scorePoints -= 10;
    }

    // Check custom line items
    for (const area of deal.areas) {
        const customs = area.customLineItems as { description: string; amount: number }[] | null;
        if (customs && customs.length > 0) {
            const customGenerated = lineItems.filter(li => li.category === 'custom');
            if (customGenerated.length < customs.length) {
                issues.push(`Expected ${customs.length} custom items, got ${customGenerated.length}`);
                scorePoints -= 10;
            }
        }
    }

    if (issues.length === 0) issues.push('No issues found');

    scorePoints = Math.max(0, Math.min(100, scorePoints));

    const grade = scorePoints >= 95 ? 'A+' :
        scorePoints >= 90 ? 'A' :
        scorePoints >= 85 ? 'A-' :
        scorePoints >= 80 ? 'B+' :
        scorePoints >= 75 ? 'B' :
        scorePoints >= 70 ? 'B-' :
        scorePoints >= 60 ? 'C' :
        scorePoints >= 50 ? 'D' : 'F';

    // Rough estimate of PDF pages based on size
    const estPages = Math.max(5, Math.round(pdfSizeKB / 15));

    return {
        deal: deal.name,
        lineItemCount: lineItems.length,
        totalPrice: totals.totalClientPrice,
        margin: totals.grossMarginPercent,
        marginStatus: totals.integrityStatus,
        pdfPages: estPages,
        pdfSize: pdfSizeKB > 1024 ? `${(pdfSizeKB / 1024).toFixed(1)}MB` : `${pdfSizeKB.toFixed(0)}KB`,
        issues,
        score: `${scorePoints}/100`,
        grade,
    };
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${BOLD}${B}══════════════════════════════════════════════════════════════${X}`);
    console.log(`${BOLD}${B}  S2PX Deal Pipeline — End-to-End Test Runner${X}`);
    console.log(`${BOLD}${B}══════════════════════════════════════════════════════════════${X}\n`);

    if (!process.env.DATABASE_URL) {
        console.error(`${R}✗ DATABASE_URL not set. Export it or add to .env${X}`);
        process.exit(1);
    }

    // Connect to DB
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, {});

    try {
        await pool.query('SELECT 1');
        console.log(`${G}✓${X} Database connected\n`);
    } catch (err) {
        const e = err as { code?: string; message?: string };
        console.error(`${R}✗ Cannot connect to database: ${e.code || e.message}${X}`);
        process.exit(1);
    }

    // Create output directory
    const outDir = path.resolve('test-proposals');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Load proposal template (use active or create a minimal one)
    let template: TemplateData | null = null;
    try {
        const templates = await db.select().from(proposalTemplates).limit(1);
        if (templates.length > 0) {
            const t = templates[0];
            template = {
                aboutScan2plan: t.aboutScan2plan,
                whyScan2plan: t.whyScan2plan,
                capabilities: t.capabilities,
                difference: t.difference,
                bimStandardsIntro: t.bimStandardsIntro,
                paymentTermsDefault: t.paymentTermsDefault,
                sfAuditClause: t.sfAuditClause,
                contactEmail: t.contactEmail || 'admin@scan2plan.io',
                contactPhone: t.contactPhone || '(518) 362-2403',
                footerText: t.footerText,
                sectionVisibility: t.sectionVisibility as Record<string, boolean> | null,
            };
            console.log(`${G}✓${X} Loaded proposal template: "${t.name}"\n`);
        }
    } catch {
        // Template table might not exist — that's fine
    }

    const grades: ProposalGrade[] = [];
    const createdFormIds: number[] = [];

    // Process each test deal
    for (let i = 0; i < TEST_DEALS.length; i++) {
        const deal = TEST_DEALS[i];
        console.log(`${BOLD}${C}─── ${deal.name} ───${X}`);
        console.log(`${DIM}${deal.description}${X}`);

        try {
            // 1. Create scoping form
            const upid = await generateUpid(db);
            const [form] = await db.insert(scopingForms).values({
                upid,
                status: 'draft',
                ...(deal.form as any),
            }).returning();

            createdFormIds.push(form.id);
            console.log(`  ${G}✓${X} Created form ${upid} (id: ${form.id})`);

            // 2. Insert areas
            if (deal.areas.length > 0) {
                await db.insert(scopeAreas).values(
                    deal.areas.map((area, idx) => ({
                        ...(area as any),
                        scopingFormId: form.id,
                        sortOrder: idx,
                    }))
                );
                console.log(`  ${G}✓${X} Created ${deal.areas.length} area(s)`);
            }

            // 3. Generate line item shells
            resetIdCounter();
            const shellInput = toShellInput(deal.form, deal.areas);
            const shells = generateLineItemShells(shellInput);
            console.log(`  ${G}✓${X} Generated ${shells.length} line item shells`);

            // 4. Price line items
            const pricedItems = priceLineItems(shells, deal.pricingStrategy);
            const totals = computeQuoteTotals(pricedItems);
            console.log(`  ${G}✓${X} Priced: $${totals.totalClientPrice.toLocaleString()} | Margin: ${totals.grossMarginPercent}% [${totals.integrityStatus}]`);

            // 5. Save quote to DB (only if not blocked)
            if (totals.integrityStatus !== 'blocked') {
                const [quote] = await db.insert(quotes).values({
                    scopingFormId: form.id,
                    lineItems: pricedItems,
                    totals,
                    integrityStatus: totals.integrityStatus,
                }).returning();

                // Update form status
                await db.update(scopingForms)
                    .set({ status: 'priced', updatedAt: new Date() })
                    .where(eq(scopingForms.id, form.id));

                console.log(`  ${G}✓${X} Saved quote (id: ${quote.id})`);

                // 6. Generate proposal PDF
                const formWithAreas = {
                    upid,
                    clientCompany: deal.form.clientCompany as string,
                    primaryContactName: deal.form.primaryContactName as string,
                    contactEmail: deal.form.contactEmail as string,
                    projectName: deal.form.projectName as string,
                    projectAddress: deal.form.projectAddress as string,
                    numberOfFloors: deal.form.numberOfFloors as number,
                    bimDeliverable: deal.form.bimDeliverable as string,
                    bimVersion: (deal.form.bimVersion as string) || null,
                    expedited: deal.form.expedited as boolean,
                    georeferencing: deal.form.georeferencing as boolean,
                    travelMode: deal.form.travelMode as string,
                    era: (deal.form.era as string) || null,
                    roomDensity: deal.form.roomDensity as number | undefined,
                    dispatchLocation: (deal.form.dispatchLocation as string) || null,
                    oneWayMiles: deal.form.oneWayMiles as number | undefined,
                    landscapeModeling: (deal.form.landscapeModeling as string) || null,
                    scanRegOnly: (deal.form.scanRegOnly as string) || null,
                    paymentTerms: (deal.form.paymentTerms as string) || null,
                    estTimeline: (deal.form.estTimeline as string) || null,
                    projectTimeline: (deal.form.projectTimeline as string) || null,
                    customScope: (deal.form.customScope as string) || null,
                    areas: deal.areas.map(a => ({
                        areaName: (a.areaName as string) || null,
                        areaType: a.areaType as string,
                        squareFootage: a.squareFootage as number,
                        projectScope: a.projectScope as string,
                        lod: a.lod as string,
                        structural: a.structural as { enabled: boolean } | null,
                        mepf: a.mepf as { enabled: boolean } | null,
                        cadDeliverable: a.cadDeliverable as string,
                        act: a.act as { enabled: boolean } | null,
                        belowFloor: a.belowFloor as { enabled: boolean } | null,
                    })),
                };

                const proposalData = mapToProposalData({
                    form: formWithAreas,
                    lineItems: pricedItems,
                    totals,
                    version: 1,
                    customMessage: null,
                    template,
                });

                const pdfBuffer = await generateProposalPDF(proposalData);

                // Write PDF to disk
                const safeName = deal.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
                const pdfPath = path.join(outDir, `${safeName}.pdf`);
                fs.writeFileSync(pdfPath, pdfBuffer);
                console.log(`  ${G}✓${X} Generated PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)}KB)`);

                // 7. Grade the proposal
                const grade = gradeProposal(deal, pricedItems, totals, pdfBuffer);
                grades.push(grade);
                console.log(`  ${BOLD}${grade.grade === 'A+' || grade.grade === 'A' ? G : grade.grade.startsWith('B') ? Y : R}Grade: ${grade.grade} (${grade.score})${X}`);
            } else {
                console.log(`  ${Y}⚠${X} Skipped quote save: integrity blocked (margin ${totals.grossMarginPercent}%)`);

                // Still grade the shell generation
                const grade = gradeProposal(deal, pricedItems, totals, Buffer.alloc(0));
                grades.push(grade);
                console.log(`  ${BOLD}${R}Grade: ${grade.grade} (${grade.score})${X}`);
            }

        } catch (err) {
            const e = err as Error;
            console.log(`  ${R}✗ FAILED: ${e.message}${X}`);
            if (e.stack) console.log(`    ${DIM}${e.stack.split('\n').slice(1, 3).join('\n    ')}${X}`);
            grades.push({
                deal: deal.name,
                lineItemCount: 0,
                totalPrice: 0,
                margin: 0,
                marginStatus: 'error',
                pdfPages: 0,
                pdfSize: '0KB',
                issues: [`FATAL: ${e.message}`],
                score: '0/100',
                grade: 'F',
            });
        }

        console.log();
    }

    // ══════════════════════════════════════════════════════════════
    // REPORT CARD
    // ══════════════════════════════════════════════════════════════
    console.log(`\n${BOLD}${B}══════════════════════════════════════════════════════════════${X}`);
    console.log(`${BOLD}${B}  PROPOSAL REPORT CARD${X}`);
    console.log(`${BOLD}${B}══════════════════════════════════════════════════════════════${X}\n`);

    // Summary table header
    console.log(`${BOLD}${'Deal'.padEnd(45)} ${'Items'.padStart(5)} ${'Total'.padStart(12)} ${'Margin'.padStart(8)} ${'Status'.padStart(8)} ${'PDF'.padStart(8)} ${'Grade'.padStart(6)}${X}`);
    console.log('─'.repeat(96));

    for (const g of grades) {
        const dealName = g.deal.length > 44 ? g.deal.substring(0, 42) + '..' : g.deal;
        const gradeColor = g.grade.startsWith('A') ? G : g.grade.startsWith('B') ? Y : R;
        const statusColor = g.marginStatus === 'passed' ? G : g.marginStatus === 'warning' ? Y : R;

        console.log(
            `${dealName.padEnd(45)} ` +
            `${String(g.lineItemCount).padStart(5)} ` +
            `${('$' + g.totalPrice.toLocaleString()).padStart(12)} ` +
            `${(g.margin.toFixed(1) + '%').padStart(8)} ` +
            `${statusColor}${g.marginStatus.padStart(8)}${X} ` +
            `${g.pdfSize.padStart(8)} ` +
            `${gradeColor}${BOLD}${g.grade.padStart(6)}${X}`
        );
    }

    console.log('─'.repeat(96));

    // Overall stats
    const totalDeals = grades.length;
    const passed = grades.filter(g => g.grade.startsWith('A')).length;
    const warned = grades.filter(g => g.grade.startsWith('B')).length;
    const failed = grades.filter(g => !g.grade.startsWith('A') && !g.grade.startsWith('B')).length;
    const avgScore = grades.reduce((s, g) => s + parseInt(g.score), 0) / totalDeals;

    console.log(`\n${BOLD}Summary:${X} ${G}${passed} A-grade${X} | ${Y}${warned} B-grade${X} | ${R}${failed} other${X} | Average: ${avgScore.toFixed(0)}/100`);

    // Issues report
    const hasIssues = grades.filter(g => g.issues.length > 0 && g.issues[0] !== 'No issues found');
    if (hasIssues.length > 0) {
        console.log(`\n${BOLD}${Y}Issues Found:${X}`);
        for (const g of hasIssues) {
            console.log(`  ${BOLD}${g.deal}:${X}`);
            for (const issue of g.issues) {
                if (issue === 'No issues found') continue;
                console.log(`    ${Y}⚠${X} ${issue}`);
            }
        }
    }

    // Created form IDs for cleanup reference
    console.log(`\n${DIM}Created form IDs: [${createdFormIds.join(', ')}]${X}`);
    console.log(`${DIM}PDFs written to: ${outDir}${X}`);
    console.log(`\n${BOLD}${G}Done!${X} Open the PDFs to review each proposal.\n`);

    await pool.end();
}

main().catch(err => {
    console.error(`\n${R}Fatal error:${X}`, err);
    process.exit(1);
});
