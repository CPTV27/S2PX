/**
 * V2 Pricing Data Loader
 * Loads all 15 pricing tables from PostgreSQL and converts numeric strings to numbers.
 * Returns a typed V2PricingTables object ready for the engine.
 */

import { db } from '../db.js';
import {
    pricingConstants,
    pricingScanBaselines,
    pricingBuildingTypes,
    pricingAddonMarkups,
    pricingCadMarkups,
    pricingScanModifiers,
    pricingTravelParams,
    pricingSlamConfig,
    pricingMegabandBaselines,
    pricingMegabandFactors,
    pricingArchRates,
    pricingAddonRates,
    pricingCadRates,
    pricingMegabandRates,
} from '../../shared/schema/pricing.js';
import type { V2PricingTables } from '../../shared/engine/pricingV2Types.js';

/** Parse a Drizzle numeric string to a JS number. */
function n(val: string | null | undefined): number {
    if (val == null) return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
}

/** Load all V2 pricing tables from the database.
 *  Returns null if the constants row doesn't exist (tables not seeded). */
export async function loadV2PricingTables(): Promise<V2PricingTables | null> {
    // Load all tables in parallel
    const [
        constantsRows,
        scanBaselineRows,
        buildingTypeRows,
        addonMarkupRows,
        cadMarkupRows,
        scanModifierRows,
        travelParamsRows,
        slamConfigRows,
        megabandBaselineRows,
        megabandFactorRows,
        archRateRows,
        addonRateRows,
        cadRateRows,
        megabandRateRows,
    ] = await Promise.all([
        db.select().from(pricingConstants).limit(1),
        db.select().from(pricingScanBaselines),
        db.select().from(pricingBuildingTypes),
        db.select().from(pricingAddonMarkups),
        db.select().from(pricingCadMarkups),
        db.select().from(pricingScanModifiers),
        db.select().from(pricingTravelParams).limit(1),
        db.select().from(pricingSlamConfig).limit(1),
        db.select().from(pricingMegabandBaselines),
        db.select().from(pricingMegabandFactors),
        db.select().from(pricingArchRates),
        db.select().from(pricingAddonRates),
        db.select().from(pricingCadRates),
        db.select().from(pricingMegabandRates),
    ]);

    if (constantsRows.length === 0) return null;

    const c = constantsRows[0];
    const tp = travelParamsRows[0];
    const sc = slamConfigRows[0];

    if (!tp || !sc) return null;

    return {
        constants: {
            taxPct: n(c.taxPct),
            ownerCompPct: n(c.ownerCompPct),
            salesMarketingPct: n(c.salesMarketingPct),
            overheadPct: n(c.overheadPct),
            badDebtPct: n(c.badDebtPct),
            qcPct: n(c.qcPct),
            pmPct: n(c.pmPct),
            cooPct: n(c.cooPct),
            registrationPct: n(c.registrationPct),
            savingsFloorPct: n(c.savingsFloorPct),
            srTechRate: n(c.srTechRate),
            jrTechRate: n(c.jrTechRate),
            bimManagerPct: n(c.bimManagerPct),
            tierAThresholdSqft: c.tierAThresholdSqft,
            archMinimum: n(c.archMinimum),
            fullServiceMinimum: n(c.fullServiceMinimum),
            autoFloorActive: c.autoFloorActive,
            expeditedPct: n(c.expeditedPct),
            matterportPerSqft: n(c.matterportPerSqft),
            georeferencingFee: n(c.georeferencingFee),
            mixedInteriorWeight: n(c.mixedInteriorWeight),
            mixedExteriorWeight: n(c.mixedExteriorWeight),
            scanScopeFullPct: n(c.scanScopeFullPct),
            scanScopeIntOnlyPct: n(c.scanScopeIntOnlyPct),
            scanScopeExtOnlyPct: n(c.scanScopeExtOnlyPct),
            upptScopeIntOnlyPct: n(c.upptScopeIntOnlyPct),
            upptScopeExtOnlyPct: n(c.upptScopeExtOnlyPct),
            slamUnitCost: n(c.slamUnitCost),
            controlEquipCost: n(c.controlEquipCost),
            equipAmortYears: c.equipAmortYears,
            fieldDaysPerYear: c.fieldDaysPerYear,
            includeEquipAmort: c.includeEquipAmort,
        },
        scanBaselines: scanBaselineRows.map((r) => ({
            band: r.band,
            sqftPerHour: r.sqftPerHour,
        })),
        buildingTypes: buildingTypeRows.map((r) => ({
            typeNumber: r.typeNumber,
            name: r.name,
            throughputRatio: n(r.throughputRatio),
            slamEligible: r.slamEligible,
            slamThroughputRatio: r.slamThroughputRatio ? n(r.slamThroughputRatio) : null,
        })),
        addonMarkups: addonMarkupRows.map((r) => ({
            band: r.band,
            structureMarkup: n(r.structureMarkup),
            mepfMarkup: n(r.mepfMarkup),
            gradeMarkup: n(r.gradeMarkup),
        })),
        cadMarkups: cadMarkupRows.map((r) => ({
            band: r.band,
            basicMarkup: n(r.basicMarkup),
            asPlusMarkup: n(r.asPlusMarkup),
            fullMarkup: n(r.fullMarkup),
        })),
        scanModifiers: scanModifierRows.map((r) => ({
            tier: r.tier,
            category: r.category,
            code: r.code,
            label: r.label,
            multiplier: n(r.multiplier),
            isDefault: r.isDefault,
        })),
        travelParams: {
            mileageRate: n(tp.mileageRate),
            overnightThresholdMi: tp.overnightThresholdMi,
            airfareThresholdMi: tp.airfareThresholdMi,
            nycFlatSmall: n(tp.nycFlatSmall),
            nycFlatRegional: n(tp.nycFlatRegional),
            hotelCap: n(tp.hotelCap),
            perDiem: n(tp.perDiem),
            avgAirfare: n(tp.avgAirfare),
            carRental: n(tp.carRental),
            airportParking: n(tp.airportParking),
            vehicleMpg: n(tp.vehicleMpg),
            gasPrice: n(tp.gasPrice),
            srTechTravelRate: n(tp.srTechTravelRate),
            jrTechTravelRate: n(tp.jrTechTravelRate),
            avgTravelSpeed: tp.avgTravelSpeed,
            irsReimbursementRate: n(tp.irsReimbursementRate),
        },
        slamConfig: {
            slamScannerRate: n(sc.slamScannerRate),
            slamAssistRate: n(sc.slamAssistRate),
            controlSurveyRate: n(sc.controlSurveyRate),
            controlAssistRate: n(sc.controlAssistRate),
            slamBaselineSqftPerHour: sc.slamBaselineSqftPerHour,
        },
        megabandBaselines: megabandBaselineRows.map((r) => ({
            band: r.band,
            sqftPerHour: r.sqftPerHour,
        })),
        megabandFactors: megabandFactorRows.map((r) => ({
            band: r.band,
            factor: n(r.factor),
        })),
        archRates: archRateRows.map((r) => ({
            buildingTypeNum: r.buildingTypeNum,
            band: r.band,
            lod: r.lod,
            upptPerSqft: n(r.upptPerSqft),
            scanPerSqft: n(r.scanPerSqft),
        })),
        addonRates: addonRateRows.map((r) => ({
            discipline: r.discipline,
            buildingTypeNum: r.buildingTypeNum,
            band: r.band,
            lod: r.lod,
            upptPerSqft: n(r.upptPerSqft),
        })),
        cadRates: cadRateRows.map((r) => ({
            band: r.band,
            basicUppt: n(r.basicUppt),
            asPlusUppt: n(r.asPlusUppt),
            fullUppt: n(r.fullUppt),
        })),
        megabandRates: megabandRateRows.map((r) => ({
            buildingTypeNum: r.buildingTypeNum,
            megaBand: r.megaBand,
            lod: r.lod,
            upptPerSqft: n(r.upptPerSqft),
        })),
    };
}
