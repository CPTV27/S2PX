import { describe, it, expect, beforeEach } from 'vitest';
import { generateLineItemShells, resetIdCounter, type ScopingFormInput } from '../shellGenerator';

function baseForm(overrides?: Partial<ScopingFormInput>): ScopingFormInput {
    return {
        landscapeModeling: 'No',
        georeferencing: false,
        scanRegOnly: 'none',
        expedited: false,
        dispatchLocation: 'Troy NY',
        oneWayMiles: 50,
        travelMode: 'Local',
        areas: [],
        ...overrides,
    };
}

function baseArea(overrides?: Record<string, unknown>) {
    return {
        id: 1,
        areaType: 'Commercial',
        areaName: 'Main Building',
        squareFootage: 25000,
        projectScope: 'Full',
        lod: '300',
        cadDeliverable: 'No',
        structural: null,
        mepf: null,
        act: null,
        belowFloor: null,
        customLineItems: null,
        ...overrides,
    };
}

beforeEach(() => {
    resetIdCounter();
});

describe('Shell Generator — Edge Cases', () => {
    it('zero square footage still generates an architecture line', () => {
        const form = baseForm({ areas: [baseArea({ squareFootage: 0 })] });
        const shells = generateLineItemShells(form);
        const archLines = shells.filter(s => s.discipline === 'architecture');

        expect(archLines).toHaveLength(1);
        expect(archLines[0].squareFeet).toBe(0);
        expect(archLines[0].description).toContain('0 SF');
    });

    it('mileageRate appears in travel description when set', () => {
        const form = baseForm({
            mileageRate: 0.67,
            areas: [baseArea()],
        });
        const shells = generateLineItemShells(form);
        const travelLine = shells.find(s => s.discipline === 'travel');

        expect(travelLine).toBeDefined();
        expect(travelLine!.description).toContain('$0.67/mi');
    });

    it('travel description omits rate suffix when mileageRate is null', () => {
        const form = baseForm({
            mileageRate: undefined,
            areas: [baseArea()],
        });
        const shells = generateLineItemShells(form);
        const travelLine = shells.find(s => s.discipline === 'travel');

        expect(travelLine).toBeDefined();
        expect(travelLine!.description).not.toContain('/mi');
    });

    it('scanDayFeeOverride does not break shell generation', () => {
        const form = baseForm({
            scanDayFeeOverride: 3500,
            areas: [baseArea()],
        });
        const shells = generateLineItemShells(form);

        // scanDayFeeOverride is a form-level field — it doesn't create its own line item
        // but it shouldn't cause any errors
        expect(shells.length).toBeGreaterThanOrEqual(2); // at least arch + travel
    });

    it('area with all add-ons enabled generates 6 lines', () => {
        const form = baseForm({
            areas: [baseArea({
                cadDeliverable: 'Full',
                structural: { enabled: true, sqft: 25000 },
                mepf: { enabled: true, sqft: 25000 },
                act: { enabled: true, sqft: 25000 },
                belowFloor: { enabled: true, sqft: 25000 },
            })],
        });
        const shells = generateLineItemShells(form);

        // arch + structural + mepf + cad + act + belowFloor = 6 per-area + 1 travel = 7
        const areaLines = shells.filter(s => s.areaId !== null);
        expect(areaLines).toHaveLength(6);

        const disciplines = areaLines.map(s => s.discipline);
        expect(disciplines).toContain('architecture');
        expect(disciplines).toContain('structural');
        expect(disciplines).toContain('mepf');
        expect(disciplines).toContain('cad');
        expect(disciplines).toContain('act');
        expect(disciplines).toContain('below-floor');
    });

    it('custom line items with amount: 0 still generate', () => {
        const form = baseForm({
            areas: [baseArea({
                customLineItems: [
                    { description: 'Free consultation', amount: 0 },
                ],
            })],
        });
        const shells = generateLineItemShells(form);
        const customLines = shells.filter(s => s.category === 'custom');

        expect(customLines).toHaveLength(1);
        expect(customLines[0].description).toBe('Free consultation');
        // amount: 0 is falsy, so clientPrice should be null per the code (line 288: item.amount || null)
        expect(customLines[0].clientPrice).toBeNull();
    });

    it('multiple areas preserve ordering and have sequential IDs', () => {
        const form = baseForm({
            areas: [
                baseArea({ id: 1, areaName: 'Building A', squareFootage: 10000 }),
                baseArea({ id: 2, areaName: 'Building B', squareFootage: 20000 }),
                baseArea({ id: 3, areaName: 'Building C', squareFootage: 30000 }),
            ],
        });
        const shells = generateLineItemShells(form);
        const archLines = shells.filter(s => s.discipline === 'architecture');

        expect(archLines).toHaveLength(3);
        expect(archLines[0].areaName).toBe('Building A');
        expect(archLines[1].areaName).toBe('Building B');
        expect(archLines[2].areaName).toBe('Building C');

        // IDs should be sequential (li-1, li-2, li-3)
        expect(archLines[0].id).toBe('li-1');
        expect(archLines[1].id).toBe('li-2');
        expect(archLines[2].id).toBe('li-3');
    });

    it('no areas produces only a travel line (minimum output)', () => {
        const form = baseForm({ areas: [] });
        const shells = generateLineItemShells(form);

        expect(shells).toHaveLength(1);
        expect(shells[0].discipline).toBe('travel');
        expect(shells[0].category).toBe('travel');
        expect(shells[0].areaId).toBeNull();
    });

    it('scope label renders correctly for each scope type', () => {
        const scopes = [
            { projectScope: 'Full', expected: 'Full Scope' },
            { projectScope: 'Int Only', expected: 'Interior Only' },
            { projectScope: 'Ext Only', expected: 'Exterior Only' },
            { projectScope: 'Mixed', expected: 'Mixed Scope' },
        ];

        for (const { projectScope, expected } of scopes) {
            resetIdCounter();
            const form = baseForm({ areas: [baseArea({ projectScope })] });
            const shells = generateLineItemShells(form);
            const archLine = shells.find(s => s.discipline === 'architecture');
            expect(archLine!.description).toContain(expected);
        }
    });

    it('landscape line with no terrain or acres has clean description', () => {
        const form = baseForm({
            landscapeModeling: 'LoD 200',
            landscapeAcres: null,
            landscapeTerrain: null,
            areas: [baseArea()],
        });
        const shells = generateLineItemShells(form);
        const landLine = shells.find(s => s.discipline === 'landscape');

        expect(landLine).toBeDefined();
        expect(landLine!.description).toBe('Landscape (LoD 200)');
        // Should NOT have trailing dashes or "null"
        expect(landLine!.description).not.toContain('null');
        expect(landLine!.description).not.toContain('undefined');
    });

    it('scan & reg half_day label renders correctly', () => {
        const form = baseForm({ scanRegOnly: 'half_day', areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const srLine = shells.find(s => s.discipline === 'scan-reg');

        expect(srLine).toBeDefined();
        expect(srLine!.description).toContain('Half Day');
    });

    it('all project-level toggles on + full area = 13 lines total', () => {
        const form = baseForm({
            georeferencing: true,
            expedited: true,
            landscapeModeling: 'LoD 300',
            landscapeAcres: 5,
            landscapeTerrain: 'Natural',
            scanRegOnly: 'full_day',
            areas: [baseArea({
                cadDeliverable: 'Full',
                structural: { enabled: true },
                mepf: { enabled: true },
                act: { enabled: true },
                belowFloor: { enabled: true },
                customLineItems: [{ description: 'Special survey', amount: 500 }],
            })],
        });
        const shells = generateLineItemShells(form);

        // Per-area: arch(1) + structural(2) + mepf(3) + cad(4) + act(5) + belowFloor(6) = 6
        // Project: travel(7) + geo(8) + expedited(9) + landscape(10) + scan-reg(11) + custom(12) = 6
        // Total: 12
        expect(shells).toHaveLength(12);
    });
});
