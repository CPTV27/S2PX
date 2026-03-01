import { describe, it, expect } from 'vitest';
import { applyAutoCalcPrices } from '../autoCalc';
import type { LineItemShell } from '../../types/lineItem';
import { DEFAULT_PRICING_CONFIG } from '../../types/pricingConfig';

function makeShell(overrides: Partial<LineItemShell> & { id: string }): LineItemShell {
    return {
        areaId: '1',
        areaName: 'Main Building',
        category: 'modeling',
        description: 'Test line',
        buildingType: 'Commercial',
        upteamCost: null,
        clientPrice: null,
        ...overrides,
    };
}

describe('AutoCalc — Expedited Surcharge', () => {
    it('computes 20% of modeling+addOn total when expedited line exists', () => {
        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: 10000 }),
            makeShell({ id: 'li-2', discipline: 'structural', category: 'modeling', clientPrice: 5000 }),
            makeShell({ id: 'li-3', discipline: 'cad', category: 'addOn', clientPrice: 2000 }),
            makeShell({ id: 'li-4', discipline: 'expedited', category: 'addOn', areaId: null, areaName: 'Project-Level', clientPrice: null }),
        ];

        const result = applyAutoCalcPrices(items);
        const expedited = result.find(li => li.discipline === 'expedited');

        // 20% of (10000 + 5000 + 2000) = 20% of 17000 = 3400
        expect(expedited?.clientPrice).toBe(3400);
        expect(expedited?.upteamCost).toBe(0);
    });

    it('excludes travel and custom items from expedited base', () => {
        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: 10000 }),
            makeShell({ id: 'li-2', discipline: 'travel', category: 'travel', areaId: null, clientPrice: 1500 }),
            makeShell({ id: 'li-3', category: 'custom', areaId: null, clientPrice: 500, description: 'Custom item' }),
            makeShell({ id: 'li-4', discipline: 'expedited', category: 'addOn', areaId: null, areaName: 'Project-Level', clientPrice: null }),
        ];

        const result = applyAutoCalcPrices(items);
        const expedited = result.find(li => li.discipline === 'expedited');

        // 20% of 10000 only (travel & custom excluded) = 2000
        expect(expedited?.clientPrice).toBe(2000);
    });

    it('does not overwrite expedited when CEO manually edited it', () => {
        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: 10000 }),
            makeShell({ id: 'li-4', discipline: 'expedited', category: 'addOn', areaId: null, clientPrice: 5000 }),
        ];

        // CEO edited the expedited line directly (editedId = 'li-4')
        const result = applyAutoCalcPrices(items, 'li-4');
        const expedited = result.find(li => li.discipline === 'expedited');

        // Should keep the CEO's manual price of 5000, not recalculate to 2000
        expect(expedited?.clientPrice).toBe(5000);
    });

    it('returns null expedited price when no BIM items have prices yet', () => {
        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: null }),
            makeShell({ id: 'li-2', discipline: 'expedited', category: 'addOn', areaId: null, clientPrice: null }),
        ];

        const result = applyAutoCalcPrices(items);
        const expedited = result.find(li => li.discipline === 'expedited');

        expect(expedited?.clientPrice).toBeNull();
    });

    it('uses configurable surcharge percent from DEFAULT_PRICING_CONFIG', () => {
        // Verify the constant is 0.20 (20%)
        expect(DEFAULT_PRICING_CONFIG.expeditedSurchargePercent).toBe(0.20);

        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: 1000 }),
            makeShell({ id: 'li-2', discipline: 'expedited', category: 'addOn', areaId: null, clientPrice: null }),
        ];

        const result = applyAutoCalcPrices(items);
        const expedited = result.find(li => li.discipline === 'expedited');

        expect(expedited?.clientPrice).toBe(200); // 20% of 1000
    });

    it('works with no expedited line present (no-op)', () => {
        const items: LineItemShell[] = [
            makeShell({ id: 'li-1', discipline: 'architecture', category: 'modeling', clientPrice: 10000 }),
        ];

        const result = applyAutoCalcPrices(items);
        expect(result).toHaveLength(1);
        expect(result[0].clientPrice).toBe(10000);
    });
});

describe('AutoCalc — Below Floor Auto-Suggest', () => {
    it('computes 50% of architecture rate for below floor', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 25000,
                clientPrice: 25000, // $1.00/sqft
                upteamCost: 12500,  // $0.50/sqft
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 10000,
                clientPrice: null,
                upteamCost: null,
            }),
        ];

        const result = applyAutoCalcPrices(items);
        const belowFloor = result.find(li => li.discipline === 'below-floor');

        // 50% of $1.00/sqft × 10,000 sqft = $5,000
        expect(belowFloor?.clientPrice).toBe(5000);
        // 50% of $0.50/sqft × 10,000 sqft = $2,500
        expect(belowFloor?.upteamCost).toBe(2500);
    });

    it('uses architecture sqft when below floor sqft is 0', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 20000,
                clientPrice: 20000, // $1.00/sqft
                upteamCost: 10000,
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 0,
                clientPrice: null,
            }),
        ];

        const result = applyAutoCalcPrices(items);
        const belowFloor = result.find(li => li.discipline === 'below-floor');

        // squareFeet is 0 (falsy), so uses archLine.squareFeet (20000)
        // 50% of $1.00/sqft × 20,000 = $10,000
        expect(belowFloor?.clientPrice).toBe(10000);
    });

    it('does not overwrite below floor when CEO manually edited it', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 25000,
                clientPrice: 25000,
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 10000,
                clientPrice: 8000, // CEO set this manually
            }),
        ];

        const result = applyAutoCalcPrices(items, 'li-2');
        const belowFloor = result.find(li => li.discipline === 'below-floor');

        // Should keep CEO's manual price
        expect(belowFloor?.clientPrice).toBe(8000);
    });

    it('skips below floor when architecture has no price yet', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 25000,
                clientPrice: null, // Not priced yet
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 10000,
                clientPrice: null,
            }),
        ];

        const result = applyAutoCalcPrices(items);
        const belowFloor = result.find(li => li.discipline === 'below-floor');

        // No architecture price → no auto-calc
        expect(belowFloor?.clientPrice).toBeNull();
    });

    it('handles multiple areas independently', () => {
        const items: LineItemShell[] = [
            // Area 1
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                areaName: 'Building A',
                squareFeet: 20000,
                clientPrice: 20000, // $1.00/sqft
                upteamCost: 10000,
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                areaName: 'Building A',
                squareFeet: 5000,
                clientPrice: null,
            }),
            // Area 2
            makeShell({
                id: 'li-3',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '2',
                areaName: 'Building B',
                squareFeet: 10000,
                clientPrice: 30000, // $3.00/sqft
                upteamCost: 15000,
            }),
            makeShell({
                id: 'li-4',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '2',
                areaName: 'Building B',
                squareFeet: 3000,
                clientPrice: null,
            }),
        ];

        const result = applyAutoCalcPrices(items);

        const bf1 = result.find(li => li.id === 'li-2');
        const bf2 = result.find(li => li.id === 'li-4');

        // Area 1: 50% of $1.00/sqft × 5000 = $2,500
        expect(bf1?.clientPrice).toBe(2500);

        // Area 2: 50% of $3.00/sqft × 3000 = $4,500
        expect(bf2?.clientPrice).toBe(4500);
    });

    it('uses upteam multiplier fallback when architecture upteamCost is null', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 10000,
                clientPrice: 10000, // $1.00/sqft
                upteamCost: null,   // No upteam cost set
            }),
            makeShell({
                id: 'li-2',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 10000,
                clientPrice: null,
            }),
        ];

        const result = applyAutoCalcPrices(items);
        const belowFloor = result.find(li => li.discipline === 'below-floor');

        // clientPrice: 50% of $1.00/sqft × 10000 = $5,000
        expect(belowFloor?.clientPrice).toBe(5000);

        // upteamCost: uses fallback multiplier (0.45) on arch rate
        // 50% of ($1.00 × 0.45) × 10000 = $2,250
        const expectedUpteam = Math.round(1.0 * DEFAULT_PRICING_CONFIG.upteamMultiplierFallback * 0.5 * 10000 * 100) / 100;
        expect(belowFloor?.upteamCost).toBe(expectedUpteam);
    });

    it('uses configurable fraction from DEFAULT_PRICING_CONFIG', () => {
        // Verify the constant is 0.50 (50%)
        expect(DEFAULT_PRICING_CONFIG.belowFloorRateFraction).toBe(0.50);
    });
});

describe('AutoCalc — Combined Expedited + Below Floor', () => {
    it('both auto-calcs fire correctly in a single pass', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 20000,
                clientPrice: 20000,
                upteamCost: 10000,
            }),
            makeShell({
                id: 'li-2',
                discipline: 'structural',
                category: 'modeling',
                areaId: '1',
                squareFeet: 20000,
                clientPrice: 8000,
            }),
            makeShell({
                id: 'li-3',
                discipline: 'below-floor',
                category: 'addOn',
                areaId: '1',
                squareFeet: 5000,
                clientPrice: null,
            }),
            makeShell({
                id: 'li-4',
                discipline: 'expedited',
                category: 'addOn',
                areaId: null,
                areaName: 'Project-Level',
                clientPrice: null,
            }),
        ];

        const result = applyAutoCalcPrices(items, 'li-1'); // CEO edited arch price

        const belowFloor = result.find(li => li.discipline === 'below-floor');
        const expedited = result.find(li => li.discipline === 'expedited');

        // Below floor: 50% of ($20000/20000 sqft) × 5000 = 50% of $1/sqft × 5000 = $2,500
        expect(belowFloor?.clientPrice).toBe(2500);

        // Expedited runs before below-floor in the pipeline, so it only sees:
        // 20% of (arch $20,000 + structural $8,000) = 20% of $28,000 = $5,600
        // Below-floor hasn't been auto-priced yet when expedited calculates
        expect(expedited?.clientPrice).toBe(5600);
    });

    it('does not modify items that are not auto-calc targets', () => {
        const items: LineItemShell[] = [
            makeShell({
                id: 'li-1',
                discipline: 'architecture',
                category: 'modeling',
                areaId: '1',
                squareFeet: 20000,
                clientPrice: 20000,
                upteamCost: 10000,
            }),
            makeShell({
                id: 'li-2',
                discipline: 'travel',
                category: 'travel',
                areaId: null,
                clientPrice: 1500,
                upteamCost: 800,
            }),
        ];

        const result = applyAutoCalcPrices(items);

        expect(result[0].clientPrice).toBe(20000);
        expect(result[0].upteamCost).toBe(10000);
        expect(result[1].clientPrice).toBe(1500);
        expect(result[1].upteamCost).toBe(800);
    });
});
