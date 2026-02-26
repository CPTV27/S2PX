import { describe, it, expect } from 'vitest';
import {
    executePrefillCascade,
    PREFILL_MAPPINGS,
    TRANSFORM_FUNCTIONS,
    getMappingsForTransition,
    getMappingSummary,
} from '../prefillCascade';

// ── Test fixtures ──

function baseForm(overrides?: Record<string, unknown>) {
    return {
        upid: 'S2P-42-2026',
        projectName: 'Test Building',
        projectAddress: '123 Main St, Troy NY',
        clientCompany: 'Acme Corp',
        numberOfFloors: 3,
        dispatchLocation: 'Troy NY',
        era: 'Modern',
        roomDensity: 2,
        estScanDays: 4,
        techsPlanned: 2,
        pricingTier: 'Standard',
        lod: '300',
        bimDeliverable: 'Revit',
        bimVersion: '2024',
        georeferencing: true,
        cadDeliverable: 'AutoCAD',
        areas: [baseArea()],
        ...overrides,
    };
}

function baseArea(overrides?: Record<string, unknown>) {
    return {
        areaType: 'Commercial',
        squareFootage: 25000,
        projectScope: 'Full',
        lod: '300',
        cadDeliverable: 'AutoCAD',
        structural: { enabled: true, sqft: 25000 },
        mepf: { enabled: true, sqft: 25000 },
        act: { enabled: true, sqft: 15000 },
        belowFloor: { enabled: false },
        ...overrides,
    };
}

// ── Mapping counts ──

describe('Prefill Cascade — Mapping Declarations', () => {
    it('has exactly 49 total mappings', () => {
        expect(PREFILL_MAPPINGS.length).toBe(49);
    });

    it('has 15 scheduling→field_capture mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.transition === 'scheduling_to_field_capture').length;
        expect(count).toBe(15);
    });

    it('has 12 field_capture→registration mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.transition === 'field_capture_to_registration').length;
        expect(count).toBe(12);
    });

    it('has 7 registration→bim_qc mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.transition === 'registration_to_bim_qc').length;
        expect(count).toBe(7);
    });

    it('has 8 bim_qc→pc_delivery mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.transition === 'bim_qc_to_pc_delivery').length;
        expect(count).toBe(8);
    });

    it('has 7 pc_delivery→final_delivery mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.transition === 'pc_delivery_to_final_delivery').length;
        expect(count).toBe(7);
    });

    it('has 33 direct/chain mappings', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'direct' || m.type === 'chain').length;
        expect(count).toBe(33);
    });

    it('has 7 transforms', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'transform').length;
        expect(count).toBe(7);
    });

    it('has 5 calculations', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'calculation').length;
        expect(count).toBe(5);
    });

    it('has 2 manual entries', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'manual').length;
        expect(count).toBe(2);
    });

    it('has 1 blocked field', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'blocked').length;
        expect(count).toBe(1);
    });

    it('has 1 static default', () => {
        const count = PREFILL_MAPPINGS.filter(m => m.type === 'static').length;
        expect(count).toBe(1);
    });

    it('every mapping with a transformKey has a matching function', () => {
        for (const m of PREFILL_MAPPINGS) {
            if (m.transformKey) {
                expect(TRANSFORM_FUNCTIONS).toHaveProperty(m.transformKey);
            }
        }
    });
});

// ── Transform functions ──

describe('Transform Functions', () => {
    const form = baseForm() as any;

    describe('scopeToCheckboxArray', () => {
        const fn = TRANSFORM_FUNCTIONS.scopeToCheckboxArray;
        it('Full → [Interior, Exterior]', () => {
            expect(fn('Full', form, null)).toEqual(['Interior', 'Exterior']);
        });
        it('Int Only → [Interior]', () => {
            expect(fn('Int Only', form, null)).toEqual(['Interior']);
        });
        it('Ext Only → [Exterior]', () => {
            expect(fn('Ext Only', form, null)).toEqual(['Exterior']);
        });
        it('Mixed → [Interior, Exterior, Mixed]', () => {
            expect(fn('Mixed', form, null)).toEqual(['Interior', 'Exterior', 'Mixed']);
        });
    });

    describe('calcEstScans', () => {
        const fn = TRANSFORM_FUNCTIONS.calcEstScans;
        it('density 2, 25000 SF → ceil(8 * 25000 / 1000) = 200', () => {
            expect(fn(25000, form, null)).toBe(200);
        });
        it('density 0 (Wide Open), 10000 SF → ceil(3 * 10000 / 1000) = 30', () => {
            const f = baseForm({ roomDensity: 0, areas: [baseArea({ squareFootage: 10000 })] });
            expect(fn(10000, f as any, null)).toBe(30);
        });
        it('density 4 (Extreme), 5000 SF → ceil(18 * 5000 / 1000) = 90', () => {
            const f = baseForm({ roomDensity: 4, areas: [baseArea({ squareFootage: 5000 })] });
            expect(fn(5000, f as any, null)).toBe(90);
        });
    });

    describe('toggleSqftToBoolean', () => {
        const fn = TRANSFORM_FUNCTIONS.toggleSqftToBoolean;
        it('{ enabled: true, sqft: 1000 } → true', () => {
            expect(fn({ enabled: true, sqft: 1000 }, form, null)).toBe(true);
        });
        it('{ enabled: false } → false', () => {
            expect(fn({ enabled: false }, form, null)).toBe(false);
        });
        it('null → false', () => {
            expect(fn(null, form, null)).toBe(false);
        });
    });

    describe('staticLoA40', () => {
        it('returns LoA-40 always', () => {
            expect(TRANSFORM_FUNCTIONS.staticLoA40(undefined, form, null)).toBe('LoA-40');
        });
    });

    describe('georefToTier', () => {
        const fn = TRANSFORM_FUNCTIONS.georefToTier;
        it('true → Tier-20', () => {
            expect(fn(true, form, null)).toBe('Tier-20');
        });
        it('false → Tier-0', () => {
            expect(fn(false, form, null)).toBe('Tier-0');
        });
        it('null → Tier-0', () => {
            expect(fn(null, form, null)).toBe('Tier-0');
        });
    });

    describe('geoRefTierToBoolean', () => {
        const fn = TRANSFORM_FUNCTIONS.geoRefTierToBoolean;
        it('Tier-20 → true', () => {
            expect(fn('Tier-20', form, null)).toBe(true);
        });
        it('Tier-60 → true', () => {
            expect(fn('Tier-60', form, null)).toBe(true);
        });
        it('Tier-0 → false', () => {
            expect(fn('Tier-0', form, null)).toBe(false);
        });
    });

    describe('disciplinesToArray', () => {
        const fn = TRANSFORM_FUNCTIONS.disciplinesToArray;
        it('both enabled → [Architecture, Structural, MEPF]', () => {
            expect(fn([{ enabled: true }, { enabled: true }], form, null)).toEqual([
                'Architecture', 'Structural', 'MEPF',
            ]);
        });
        it('structural only → [Architecture, Structural]', () => {
            expect(fn([{ enabled: true }, { enabled: false }], form, null)).toEqual([
                'Architecture', 'Structural',
            ]);
        });
        it('neither → [Architecture]', () => {
            expect(fn([null, null], form, null)).toEqual(['Architecture']);
        });
    });

    describe('preferActualSF', () => {
        const fn = TRANSFORM_FUNCTIONS.preferActualSF;
        it('number → returns as-is', () => {
            expect(fn(32000, form, null)).toBe(32000);
        });
        it('null → 0', () => {
            expect(fn(null, form, null)).toBe(0);
        });
    });

    describe('calcProjectTier', () => {
        const fn = TRANSFORM_FUNCTIONS.calcProjectTier;
        it('≥50K → Whale', () => {
            expect(fn(50000, form, null)).toBe('Whale');
            expect(fn(100000, form, null)).toBe('Whale');
        });
        it('10K-50K → Dolphin', () => {
            expect(fn(10000, form, null)).toBe('Dolphin');
            expect(fn(25000, form, null)).toBe('Dolphin');
        });
        it('<10K → Minnow', () => {
            expect(fn(5000, form, null)).toBe('Minnow');
            expect(fn(0, form, null)).toBe('Minnow');
        });
    });

    describe('cadBimToFormats', () => {
        const fn = TRANSFORM_FUNCTIONS.cadBimToFormats;
        it('Revit + AutoCAD → [Revit, CAD (AutoCAD)]', () => {
            expect(fn(['AutoCAD', 'Revit'], form, null)).toEqual(['Revit', 'CAD (AutoCAD)']);
        });
        it('BIM only → [Revit]', () => {
            expect(fn(['No', 'Revit'], form, null)).toEqual(['Revit']);
        });
        it('Other BIM ignored → [CAD (AutoCAD)]', () => {
            expect(fn(['AutoCAD', 'Other'], form, null)).toEqual(['CAD (AutoCAD)']);
        });
    });
});

// ── Cascade execution: Scheduling → Field Capture ──

describe('Cascade: scheduling → field_capture', () => {
    it('prefills 15 fields (12 filled + 3 skipped)', () => {
        const form = baseForm();
        const { data, results } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(results.length).toBe(15);
        const filled = results.filter(r => !r.skipped);
        expect(filled.length).toBe(15); // All 15 are direct/transform/calc — no manual/blocked in this transition
    });

    it('FC-01: projectCode = UPID', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.projectCode).toBe('S2P-42-2026');
    });

    it('FC-02: address = projectAddress', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.address).toBe('123 Main St, Troy NY');
    });

    it('FC-06: estSF = total area SF', () => {
        const form = baseForm({
            areas: [
                baseArea({ squareFootage: 10000 }),
                baseArea({ squareFootage: 15000 }),
            ],
        });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.estSF).toBe(25000);
    });

    it('FC-07: scope transformed from dropdown', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.scope).toEqual(['Interior', 'Exterior']); // "Full" → [Interior, Exterior]
    });

    it('FC-08: floors from numberOfFloors', () => {
        const form = baseForm({ numberOfFloors: 5 });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.floors).toBe(5);
    });

    it('FC-09: estScans calculated from density × SF', () => {
        const form = baseForm({ roomDensity: 2, areas: [baseArea({ squareFootage: 25000 })] });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.estScans).toBe(200); // ceil(8 * 25000 / 1000)
    });

    it('FC-18: baseLocation from dispatchLocation', () => {
        const form = baseForm({ dispatchLocation: 'Albany NY' });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.baseLocation).toBe('Albany NY');
    });

    it('FC-22: era from era', () => {
        const form = baseForm({ era: 'Historic' });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.era).toBe('Historic');
    });

    it('FC-24: buildingType from first area', () => {
        const form = baseForm({ areas: [baseArea({ areaType: 'Hospital' })] });
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.buildingType).toBe('Hospital');
    });

    it('FC-35: actPresent transformed from toggle+sqft', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.actPresent).toBe(true);
    });

    it('FC-36: belowFloor transformed from toggle+sqft', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('scheduling', 'field_capture', form as any, {});
        expect(data.belowFloor).toBe(false); // baseArea has belowFloor: { enabled: false }
    });
});

// ── Cascade execution: Field Capture → Registration ──

describe('Cascade: field_capture → registration', () => {
    const fcStageData = {
        field_capture: {
            fieldDate: '2026-01-15',
            fieldTech: 'John Doe',
            fieldRMS: 3.2,
        },
    };

    it('prefills chain fields from SSOT (scoping form)', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.projectCode).toBe('S2P-42-2026');
        expect(data.projectName).toBe('Test Building');
        expect(data.estSF).toBe(25000);
    });

    it('carries forward FC fields (fieldTech, fieldDate, fieldRMS)', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.fieldTech).toBe('John Doe');
        expect(data.fieldDate).toBe('2026-01-15');
        expect(data.fieldRMS).toBe(3.2);
    });

    it('RG-08: cloudLoA = static LoA-40', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.cloudLoA).toBe('LoA-40');
    });

    it('RG-09: modelLoD from scoping form', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.modelLoD).toBe('300');
    });

    it('RG-10: platform from bimDeliverable', () => {
        const form = baseForm({ bimDeliverable: 'ArchiCAD' });
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.platform).toBe('ArchiCAD');
    });

    it('RG-13: geoRefTier = Tier-20 when georeferencing is true', () => {
        const form = baseForm({ georeferencing: true });
        const { data } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        expect(data.geoRefTier).toBe('Tier-20');
    });

    it('skips manual fields (scanCount, software)', () => {
        const form = baseForm();
        const { results } = executePrefillCascade('field_capture', 'registration', form as any, fcStageData);
        const manual = results.filter(r => r.mapping.type === 'manual');
        expect(manual.length).toBe(2);
        expect(manual.every(r => r.skipped)).toBe(true);
    });
});

// ── Cascade execution: Registration → BIM QC ──

describe('Cascade: registration → bim_qc', () => {
    const regStageData = {
        field_capture: { fieldDate: '2026-01-15', fieldTech: 'Tech1' },
        registration: { geoRefTier: 'Tier-20', platform: 'Revit' },
    };

    it('BQ-11: georeferenced = true when Tier-20', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('registration', 'bim_qc', form as any, regStageData);
        expect(data.georeferenced).toBe(true);
    });

    it('BQ-11: georeferenced = false when Tier-0', () => {
        const data2 = { ...regStageData, registration: { geoRefTier: 'Tier-0', platform: 'Revit' } };
        const form = baseForm();
        const { data } = executePrefillCascade('registration', 'bim_qc', form as any, data2);
        expect(data.georeferenced).toBe(false);
    });

    it('BQ-13: revitVersion from scoping', () => {
        const form = baseForm({ bimVersion: '2024' });
        const { data } = executePrefillCascade('registration', 'bim_qc', form as any, regStageData);
        expect(data.revitVersion).toBe('2024');
    });

    it('BQ-14: scopeDiscipline from structural + mepf toggles', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('registration', 'bim_qc', form as any, regStageData);
        expect(data.scopeDiscipline).toEqual(['Architecture', 'Structural', 'MEPF']);
    });

    it('BQ-14: no structural/mepf → [Architecture] only', () => {
        const form = baseForm({
            areas: [baseArea({ structural: null, mepf: null })],
        });
        const { data } = executePrefillCascade('registration', 'bim_qc', form as any, regStageData);
        expect(data.scopeDiscipline).toEqual(['Architecture']);
    });
});

// ── Cascade execution: BIM QC → PC Delivery ──

describe('Cascade: bim_qc → pc_delivery', () => {
    const bqStageData = {
        bim_qc: { actualSF: 24500, scopeDiscipline: ['Architecture', 'Structural'] },
        registration: { geoRefTier: 'Tier-20', platform: 'Revit' },
    };

    it('PD-04: deliverySF prefers actual from BQ-04', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        expect(data.deliverySF).toBe(24500);
    });

    it('PD-04: deliverySF falls back to estimated SF when no actual', () => {
        const data2 = { ...bqStageData, bim_qc: { actualSF: null } };
        const form = baseForm();
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, data2);
        expect(data.deliverySF).toBe(25000); // fallback to total SF
    });

    it('PD-09: projectTier = Dolphin for 25K SF', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        expect(data.projectTier).toBe('Dolphin');
    });

    it('PD-09: projectTier = Whale for 60K SF', () => {
        const form = baseForm({ areas: [baseArea({ squareFootage: 60000 })] });
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        expect(data.projectTier).toBe('Whale');
    });

    it('PD-09: projectTier = Minnow for 5K SF', () => {
        const form = baseForm({ areas: [baseArea({ squareFootage: 5000 })] });
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        expect(data.projectTier).toBe('Minnow');
    });

    it('PD-10: geoRefTier from registration stage', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        expect(data.geoRefTier).toBe('Tier-20');
    });

    it('PD-11: securityTier is blocked (skipped)', () => {
        const form = baseForm();
        const { results } = executePrefillCascade('bim_qc', 'pc_delivery', form as any, bqStageData);
        const blocked = results.find(r => r.mapping.targetId === 'PD-11');
        expect(blocked?.skipped).toBe(true);
        expect(blocked?.skipReason).toContain('Blocked');
    });
});

// ── Cascade execution: PC Delivery → Final Delivery ──

describe('Cascade: pc_delivery → final_delivery', () => {
    const pdStageData = {
        bim_qc: { actualSF: 24500, scopeDiscipline: ['Architecture', 'Structural'] },
        registration: { geoRefTier: 'Tier-20', platform: 'Revit' },
        pc_delivery: {
            projectCode: 'S2P-42-2026',
            client: 'Acme Corp',
            projectName: 'Test Building',
        },
    };

    it('DR-01 through DR-03: chains from PC delivery', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('pc_delivery', 'final_delivery', form as any, pdStageData);
        expect(data.projectCode).toBe('S2P-42-2026');
        expect(data.client).toBe('Acme Corp');
        expect(data.projectName).toBe('Test Building');
    });

    it('DR-10: disciplines from BQ stage', () => {
        const form = baseForm();
        const { data } = executePrefillCascade('pc_delivery', 'final_delivery', form as any, pdStageData);
        expect(data.disciplines).toEqual(['Architecture', 'Structural']);
    });

    it('DR-11: formats from CAD + BIM', () => {
        const form = baseForm({ bimDeliverable: 'Revit', cadDeliverable: 'AutoCAD' });
        const { data } = executePrefillCascade('pc_delivery', 'final_delivery', form as any, pdStageData);
        expect(data.formats).toEqual(['Revit', 'CAD (AutoCAD)']);
    });
});

// ── Utility functions ──

describe('Utility Functions', () => {
    it('getMappingsForTransition returns correct subset', () => {
        const mappings = getMappingsForTransition('scheduling', 'field_capture');
        expect(mappings.length).toBe(15);
        expect(mappings.every(m => m.transition === 'scheduling_to_field_capture')).toBe(true);
    });

    it('getMappingSummary counts by type', () => {
        const summary = getMappingSummary('scheduling', 'field_capture');
        expect(summary.total).toBe(15);
        expect(summary.byType.direct).toBe(11);
        expect(summary.byType.transform).toBe(3);
        expect(summary.byType.calculation).toBe(1);
        const total = Object.values(summary.byType).reduce((a, b) => a + b, 0);
        expect(total).toBe(15);
    });
});
