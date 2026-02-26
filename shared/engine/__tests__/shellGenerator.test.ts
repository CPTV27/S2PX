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

describe('Shell Generator — Per-Area Rules', () => {
    it('Rule 1: always generates an architecture line for each area', () => {
        const form = baseForm({ areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const archLines = shells.filter(s => s.discipline === 'architecture');

        expect(archLines).toHaveLength(1);
        expect(archLines[0].areaName).toBe('Main Building');
        expect(archLines[0].category).toBe('modeling');
        expect(archLines[0].description).toContain('Architecture');
        expect(archLines[0].description).toContain('Commercial');
        expect(archLines[0].description).toContain('25,000 SF');
        expect(archLines[0].description).toContain('LoD 300');
        expect(archLines[0].description).toContain('Full Scope');
        expect(archLines[0].upteamCost).toBeNull();
        expect(archLines[0].clientPrice).toBeNull();
    });

    it('Rule 2: generates structural line when enabled', () => {
        const form = baseForm({
            areas: [baseArea({ structural: { enabled: true, sqft: 15000 } })],
        });
        const shells = generateLineItemShells(form);
        const structLines = shells.filter(s => s.discipline === 'structural');

        expect(structLines).toHaveLength(1);
        expect(structLines[0].description).toContain('Structural');
        expect(structLines[0].squareFeet).toBe(15000);
    });

    it('Rule 2: no structural line when disabled', () => {
        const form = baseForm({
            areas: [baseArea({ structural: { enabled: false } })],
        });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'structural')).toHaveLength(0);
    });

    it('Rule 2: structural uses area sqft when no override', () => {
        const form = baseForm({
            areas: [baseArea({ structural: { enabled: true } })],
        });
        const shells = generateLineItemShells(form);
        const structLine = shells.find(s => s.discipline === 'structural');
        expect(structLine?.squareFeet).toBe(25000);
    });

    it('Rule 3: generates MEPF line when enabled', () => {
        const form = baseForm({
            areas: [baseArea({ mepf: { enabled: true, sqft: 20000 } })],
        });
        const shells = generateLineItemShells(form);
        const mepfLines = shells.filter(s => s.discipline === 'mepf');

        expect(mepfLines).toHaveLength(1);
        expect(mepfLines[0].description).toContain('MEPF');
        expect(mepfLines[0].squareFeet).toBe(20000);
    });

    it('Rule 3: no MEPF line when disabled', () => {
        const form = baseForm({
            areas: [baseArea({ mepf: { enabled: false } })],
        });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'mepf')).toHaveLength(0);
    });

    it('Rule 4: generates CAD line when cadDeliverable !== No', () => {
        const form = baseForm({
            areas: [baseArea({ cadDeliverable: 'Full' })],
        });
        const shells = generateLineItemShells(form);
        const cadLines = shells.filter(s => s.discipline === 'cad');

        expect(cadLines).toHaveLength(1);
        expect(cadLines[0].description).toContain('CAD Deliverable (Full)');
        expect(cadLines[0].category).toBe('addOn');
    });

    it('Rule 4: no CAD line when cadDeliverable === No', () => {
        const form = baseForm({
            areas: [baseArea({ cadDeliverable: 'No' })],
        });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'cad')).toHaveLength(0);
    });

    it('Rule 5: generates ACT line when enabled', () => {
        const form = baseForm({
            areas: [baseArea({ act: { enabled: true, sqft: 10000 } })],
        });
        const shells = generateLineItemShells(form);
        const actLines = shells.filter(s => s.discipline === 'act');

        expect(actLines).toHaveLength(1);
        expect(actLines[0].description).toContain('Above Ceiling Tile');
        expect(actLines[0].squareFeet).toBe(10000);
    });

    it('Rule 5: no ACT line when disabled', () => {
        const form = baseForm({
            areas: [baseArea({ act: { enabled: false } })],
        });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'act')).toHaveLength(0);
    });

    it('Rule 6: generates Below Floor line when enabled', () => {
        const form = baseForm({
            areas: [baseArea({ belowFloor: { enabled: true, sqft: 5000 } })],
        });
        const shells = generateLineItemShells(form);
        const bfLines = shells.filter(s => s.discipline === 'below-floor');

        expect(bfLines).toHaveLength(1);
        expect(bfLines[0].description).toContain('Below Floor');
        expect(bfLines[0].squareFeet).toBe(5000);
    });

    it('Rule 6: no Below Floor line when disabled', () => {
        const form = baseForm({
            areas: [baseArea({ belowFloor: { enabled: false } })],
        });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'below-floor')).toHaveLength(0);
    });
});

describe('Shell Generator — Project-Level Rules', () => {
    it('Rule 7: always generates a travel line', () => {
        const form = baseForm({ areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const travelLines = shells.filter(s => s.discipline === 'travel');

        expect(travelLines).toHaveLength(1);
        expect(travelLines[0].areaId).toBeNull();
        expect(travelLines[0].category).toBe('travel');
        expect(travelLines[0].description).toContain('Troy NY');
        expect(travelLines[0].description).toContain('50 mi');
        expect(travelLines[0].description).toContain('Local');
    });

    it('Rule 8: generates georeferencing line when true', () => {
        const form = baseForm({ georeferencing: true, areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const geoLines = shells.filter(s => s.discipline === 'georeferencing');

        expect(geoLines).toHaveLength(1);
        expect(geoLines[0].description).toContain('Georeferencing');
    });

    it('Rule 8: no georeferencing line when false', () => {
        const form = baseForm({ georeferencing: false, areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'georeferencing')).toHaveLength(0);
    });

    it('Rule 9: generates expedited surcharge when true', () => {
        const form = baseForm({ expedited: true, areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const expLines = shells.filter(s => s.discipline === 'expedited');

        expect(expLines).toHaveLength(1);
        expect(expLines[0].description).toContain('Expedited Surcharge');
        expect(expLines[0].description).toContain('+20%');
    });

    it('Rule 9: no expedited line when false', () => {
        const form = baseForm({ expedited: false, areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'expedited')).toHaveLength(0);
    });

    it('Rule 10: generates landscape line when not "No"', () => {
        const form = baseForm({
            landscapeModeling: 'LoD 200',
            landscapeAcres: 3.5,
            landscapeTerrain: 'Urban-Built',
            areas: [baseArea()],
        });
        const shells = generateLineItemShells(form);
        const landLines = shells.filter(s => s.discipline === 'landscape');

        expect(landLines).toHaveLength(1);
        expect(landLines[0].description).toContain('Landscape (LoD 200)');
        expect(landLines[0].description).toContain('3.5 acres');
        expect(landLines[0].description).toContain('Urban-Built');
    });

    it('Rule 10: no landscape line when "No"', () => {
        const form = baseForm({ landscapeModeling: 'No', areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'landscape')).toHaveLength(0);
    });

    it('Rule 11: generates scan & reg line when not "none"', () => {
        const form = baseForm({ scanRegOnly: 'full_day', areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const srLines = shells.filter(s => s.discipline === 'scan-reg');

        expect(srLines).toHaveLength(1);
        expect(srLines[0].description).toContain('Scan & Registration Only');
        expect(srLines[0].description).toContain('Full Day');
    });

    it('Rule 11: half day scan & reg', () => {
        const form = baseForm({ scanRegOnly: 'half_day', areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        const srLine = shells.find(s => s.discipline === 'scan-reg');
        expect(srLine?.description).toContain('Half Day');
    });

    it('Rule 11: no scan & reg line when "none"', () => {
        const form = baseForm({ scanRegOnly: 'none', areas: [baseArea()] });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.discipline === 'scan-reg')).toHaveLength(0);
    });

    it('Rule 12: passes through custom line items', () => {
        const form = baseForm({
            areas: [baseArea({
                customLineItems: [
                    { description: 'Special ceiling survey', amount: 2500 },
                    { description: 'Parking garage addon', amount: 1000 },
                ],
            })],
        });
        const shells = generateLineItemShells(form);
        const customLines = shells.filter(s => s.category === 'custom');

        expect(customLines).toHaveLength(2);
        expect(customLines[0].description).toBe('Special ceiling survey');
        expect(customLines[0].clientPrice).toBe(2500);
        expect(customLines[1].description).toBe('Parking garage addon');
        expect(customLines[1].clientPrice).toBe(1000);
    });

    it('Rule 12: no custom lines when empty', () => {
        const form = baseForm({ areas: [baseArea({ customLineItems: [] })] });
        const shells = generateLineItemShells(form);
        expect(shells.filter(s => s.category === 'custom')).toHaveLength(0);
    });
});

describe('Shell Generator — Multi-Area & Edge Cases', () => {
    it('generates correct shells for multiple areas', () => {
        const form = baseForm({
            areas: [
                baseArea({ id: 1, areaType: 'Commercial', squareFootage: 25000 }),
                baseArea({ id: 2, areaType: 'SFR', areaName: 'Guest House', squareFootage: 3000 }),
            ],
        });
        const shells = generateLineItemShells(form);
        const archLines = shells.filter(s => s.discipline === 'architecture');

        expect(archLines).toHaveLength(2);
        expect(archLines[0].areaName).toBe('Main Building');
        expect(archLines[1].areaName).toBe('Guest House');
    });

    it('full complexity: 2 areas with all disciplines + project add-ons', () => {
        const form = baseForm({
            georeferencing: true,
            expedited: true,
            landscapeModeling: 'LoD 300',
            landscapeAcres: 2,
            scanRegOnly: 'full_day',
            areas: [
                baseArea({
                    id: 1,
                    areaType: 'Commercial',
                    squareFootage: 50000,
                    cadDeliverable: 'Full',
                    structural: { enabled: true, sqft: 50000 },
                    mepf: { enabled: true, sqft: 40000 },
                    act: { enabled: true, sqft: 30000 },
                    belowFloor: { enabled: true, sqft: 20000 },
                }),
                baseArea({
                    id: 2,
                    areaType: 'Warehouse',
                    areaName: 'Storage Wing',
                    squareFootage: 10000,
                    cadDeliverable: 'Basic',
                    structural: { enabled: true },
                }),
            ],
        });
        const shells = generateLineItemShells(form);

        // Area 1: arch + structural + mepf + cad + act + belowFloor = 6
        // Area 2: arch + structural + cad = 3
        // Project: travel + geo + expedited + landscape + scan-reg = 5
        // Total: 14
        expect(shells).toHaveLength(14);

        // Verify categories
        expect(shells.filter(s => s.category === 'modeling')).toHaveLength(6);
        expect(shells.filter(s => s.category === 'addOn')).toHaveLength(7);
        expect(shells.filter(s => s.category === 'travel')).toHaveLength(1);
    });

    it('minimal form: single area, no extras → 2 shells (arch + travel)', () => {
        const form = baseForm({ areas: [baseArea()] });
        const shells = generateLineItemShells(form);

        expect(shells).toHaveLength(2);
        expect(shells[0].discipline).toBe('architecture');
        expect(shells[1].discipline).toBe('travel');
    });

    it('area with no name defaults to areaType', () => {
        const form = baseForm({
            areas: [baseArea({ areaName: null })],
        });
        const shells = generateLineItemShells(form);
        expect(shells[0].areaName).toBe('Commercial');
    });

    it('all shells have unique IDs', () => {
        const form = baseForm({
            georeferencing: true,
            expedited: true,
            areas: [
                baseArea({ id: 1, structural: { enabled: true }, mepf: { enabled: true } }),
                baseArea({ id: 2, structural: { enabled: true } }),
            ],
        });
        const shells = generateLineItemShells(form);
        const ids = shells.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
