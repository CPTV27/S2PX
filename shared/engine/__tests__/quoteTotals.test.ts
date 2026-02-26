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

describe('Quote Totals — Margin Guardrails', () => {
    it('passed: margin >= 45%', () => {
        const items = [
            shell({ upteamCost: 5000, clientPrice: 10000 }), // 50% margin
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.totalClientPrice).toBe(10000);
        expect(totals.totalUpteamCost).toBe(5000);
        expect(totals.grossMargin).toBe(5000);
        expect(totals.grossMarginPercent).toBe(50);
        expect(totals.integrityStatus).toBe('passed');
        expect(totals.integrityFlags).toHaveLength(0);
    });

    it('warning: margin 40-45%', () => {
        const items = [
            shell({ upteamCost: 5800, clientPrice: 10000 }), // 42% margin
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(42);
        expect(totals.integrityStatus).toBe('warning');
        expect(totals.integrityFlags.some(f => f.includes('below 45%'))).toBe(true);
    });

    it('blocked: margin < 40%', () => {
        const items = [
            shell({ upteamCost: 7000, clientPrice: 10000 }), // 30% margin
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(30);
        expect(totals.integrityStatus).toBe('blocked');
        expect(totals.integrityFlags.some(f => f.includes('below 40%'))).toBe(true);
    });

    it('blocked: unpriced items present', () => {
        const items = [
            shell({ upteamCost: 3000, clientPrice: 10000 }), // priced
            shell({ upteamCost: null, clientPrice: null }),   // unpriced
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.integrityStatus).toBe('blocked');
        expect(totals.integrityFlags.some(f => f.includes('not yet priced'))).toBe(true);
    });

    it('blocked: no priced items (all null)', () => {
        const items = [
            shell({ upteamCost: null, clientPrice: null }),
            shell({ upteamCost: null, clientPrice: null }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.totalClientPrice).toBe(0);
        expect(totals.totalUpteamCost).toBe(0);
        expect(totals.integrityStatus).toBe('blocked');
    });

    it('exactly 40% margin = warning (not blocked)', () => {
        const items = [
            shell({ upteamCost: 6000, clientPrice: 10000 }), // 40% margin
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(40);
        expect(totals.integrityStatus).toBe('warning');
    });

    it('exactly 45% margin = passed', () => {
        const items = [
            shell({ upteamCost: 5500, clientPrice: 10000 }), // 45% margin
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.grossMarginPercent).toBe(45);
        expect(totals.integrityStatus).toBe('passed');
    });
});

describe('Quote Totals — Aggregation', () => {
    it('sums multiple items correctly', () => {
        const items = [
            shell({ id: 'li-1', upteamCost: 3000, clientPrice: 6000 }),
            shell({ id: 'li-2', upteamCost: 2000, clientPrice: 4000 }),
            shell({ id: 'li-3', upteamCost: 1000, clientPrice: 2000 }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.totalClientPrice).toBe(12000);
        expect(totals.totalUpteamCost).toBe(6000);
        expect(totals.grossMargin).toBe(6000);
        expect(totals.grossMarginPercent).toBe(50);
    });

    it('skips unpriced items in totals', () => {
        const items = [
            shell({ id: 'li-1', upteamCost: 2000, clientPrice: 5000 }),
            shell({ id: 'li-2', upteamCost: null, clientPrice: null }),
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.totalClientPrice).toBe(5000);
        expect(totals.totalUpteamCost).toBe(2000);
    });

    it('flags negative margin on individual items', () => {
        const items = [
            shell({ id: 'li-1', upteamCost: 8000, clientPrice: 5000 }),  // negative
            shell({ id: 'li-2', upteamCost: 1000, clientPrice: 10000 }), // positive
        ];
        const totals = computeQuoteTotals(items);

        expect(totals.integrityFlags.some(f => f.includes('negative margin'))).toBe(true);
    });

    it('handles empty items array', () => {
        const totals = computeQuoteTotals([]);

        expect(totals.totalClientPrice).toBe(0);
        expect(totals.totalUpteamCost).toBe(0);
        expect(totals.grossMargin).toBe(0);
        expect(totals.integrityStatus).toBe('blocked');
    });
});
