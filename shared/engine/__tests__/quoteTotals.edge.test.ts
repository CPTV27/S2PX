import { describe, it, expect } from 'vitest';
import { computeQuoteTotals } from '../quoteTotals';
import type { LineItemShell } from '../../types/lineItem';

function shell(overrides?: Partial<LineItemShell>): LineItemShell {
    return {
        id: 'li-1',
        areaId: '1',
        areaName: 'Test Area',
        category: 'modeling',
        description: 'Test line item',
        buildingType: 'Commercial',
        upteamCost: null,
        clientPrice: null,
        ...overrides,
    };
}

describe('Quote Totals — Edge Cases', () => {
    it('single item at 100% margin (zero cost)', () => {
        const items = [
            shell({ upteamCost: 0, clientPrice: 10000 }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(100);
        expect(totals.grossMargin).toBe(10000);
        expect(totals.integrityStatus).toBe('passed');
    });

    it('very high cost, thin margin at exactly 39.99% = blocked', () => {
        // 39.99% margin: cost = 60.01% of price
        // price = 10000, cost = 6001 → margin = 3999/10000 = 39.99%
        const items = [
            shell({ upteamCost: 6001, clientPrice: 10000 }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(39.99);
        expect(totals.integrityStatus).toBe('blocked');
    });

    it('margin at 44.99% = warning (just under 45%)', () => {
        // 44.99%: cost = 5501, price = 10000 → margin = 4499/10000 = 44.99%
        const items = [
            shell({ upteamCost: 5501, clientPrice: 10000 }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(44.99);
        expect(totals.integrityStatus).toBe('warning');
    });

    it('many items aggregate correctly', () => {
        const items = Array.from({ length: 20 }, (_, i) =>
            shell({
                id: `li-${i + 1}`,
                upteamCost: 100,
                clientPrice: 200,
            })
        );
        const totals = computeQuoteTotals(items);

        expect(totals.totalClientPrice).toBe(4000);
        expect(totals.totalUpteamCost).toBe(2000);
        expect(totals.grossMargin).toBe(2000);
        expect(totals.grossMarginPercent).toBe(50);
        expect(totals.integrityStatus).toBe('passed');
    });

    it('mix of priced and unpriced items is always blocked', () => {
        const items = [
            shell({ id: 'li-1', upteamCost: 1000, clientPrice: 5000 }), // 80% margin
            shell({ id: 'li-2', upteamCost: 500, clientPrice: 3000 }),   // 83% margin
            shell({ id: 'li-3', upteamCost: null, clientPrice: null }),   // unpriced
        ];
        const totals = computeQuoteTotals(items);

        // Priced items sum: client=8000, cost=1500, margin=81.25%
        // But still blocked because 1 unpriced
        expect(totals.integrityStatus).toBe('blocked');
        expect(totals.totalClientPrice).toBe(8000);
        expect(totals.totalUpteamCost).toBe(1500);
        expect(totals.integrityFlags.some(f => f.includes('not yet priced'))).toBe(true);
    });

    it('negative margin items get flagged', () => {
        const items = [
            shell({ id: 'li-1', upteamCost: 12000, clientPrice: 8000 }),  // negative
            shell({ id: 'li-2', upteamCost: 1000, clientPrice: 20000 }),  // positive
        ];
        const totals = computeQuoteTotals(items);

        // Total: client=28000, cost=13000, margin=53.57%
        expect(totals.integrityStatus).toBe('passed');
        expect(totals.integrityFlags.some(f => f.includes('negative margin'))).toBe(true);
    });

    it('fractional prices round to 2 decimal places', () => {
        const items = [
            shell({ upteamCost: 3333.333, clientPrice: 6666.667 }),
        ];
        const totals = computeQuoteTotals(items);

        // round2(3333.333) = 3333.33, round2(6666.667) = 6666.67
        expect(totals.totalUpteamCost).toBe(3333.33);
        expect(totals.totalClientPrice).toBe(6666.67);
        expect(totals.grossMargin).toBe(3333.33);
    });

    it('only upteamCost set (clientPrice null) counts as unpriced', () => {
        const items = [
            shell({ upteamCost: 5000, clientPrice: null }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.integrityStatus).toBe('blocked');
        expect(totals.totalClientPrice).toBe(0);
        expect(totals.totalUpteamCost).toBe(0); // skipped because not fully priced
    });

    it('only clientPrice set (upteamCost null) counts as unpriced', () => {
        const items = [
            shell({ upteamCost: null, clientPrice: 5000 }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.integrityStatus).toBe('blocked');
        expect(totals.totalClientPrice).toBe(0);
        expect(totals.totalUpteamCost).toBe(0); // skipped because not fully priced
    });
});
