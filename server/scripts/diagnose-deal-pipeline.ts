/**
 * Deal Pipeline Diagnostic Script
 *
 * Tests the complete deal pipeline end-to-end against the real database:
 *   scoping form CRUD → area integrity → shell generation → pricing → quote totals
 *
 * Run: npx tsx server/scripts/diagnose-deal-pipeline.ts
 *
 * Non-destructive: only reads + one reversible write test on `internalNotes`.
 * Requires DATABASE_URL environment variable.
 */

import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, sql } from 'drizzle-orm';
import { scopingForms, scopeAreas, quotes } from '../../shared/schema/db.js';
import { generateLineItemShells, resetIdCounter, type ScopingFormInput, type ScopeAreaInput } from '../../shared/engine/shellGenerator.js';
import { computeQuoteTotals } from '../../shared/engine/quoteTotals.js';

const { Pool } = pg;

// ── Colors ──
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    details?: string;
}

const results: TestResult[] = [];

function pass(name: string, message: string) {
    results.push({ name, passed: true, message });
    console.log(`  ${GREEN}✅ ${name}${RESET} — ${DIM}${message}${RESET}`);
}

function fail(name: string, message: string, details?: string) {
    results.push({ name, passed: false, message, details });
    console.log(`  ${RED}❌ ${name}${RESET} — ${message}`);
    if (details) console.log(`     ${DIM}${details}${RESET}`);
}

function errMsg(e: unknown): string {
    if (e instanceof Error) {
        // pg errors often have empty .message but useful .code
        const pgErr = e as any;
        const parts: string[] = [];
        if (e.message) parts.push(e.message);
        if (pgErr.code) parts.push(`[${pgErr.code}]`);
        if (pgErr.detail) parts.push(pgErr.detail);
        return parts.join(' ') || e.stack?.split('\n')[0] || 'Unknown error';
    }
    if (typeof e === 'string') return e;
    try { return JSON.stringify(e); } catch { return String(e); }
}

// ── Main ──

async function main() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error(`${RED}ERROR: DATABASE_URL environment variable is required${RESET}`);
        process.exit(1);
    }

    console.log(`\n${BOLD}${CYAN}═══ S2PX Deal Pipeline Diagnostic ═══${RESET}`);
    console.log(`${DIM}Connecting to database...${RESET}\n`);

    const pool = new Pool({ connectionString: dbUrl });
    const db = drizzle(pool);

    // Pre-check: verify DB connectivity
    try {
        await pool.query('SELECT 1');
        const dbHost = new URL(dbUrl).hostname;
        console.log(`${GREEN}Connected to ${dbHost}${RESET}\n`);
    } catch (e: unknown) {
        console.error(`${RED}Cannot connect to database: ${errMsg(e)}${RESET}`);
        console.error(`${DIM}Make sure PostgreSQL is running and DATABASE_URL is correct.${RESET}\n`);
        await pool.end();
        process.exit(1);
    }

    try {
        // ──────────────────────────────────────────────
        // Test 1: DB Column Existence
        // ──────────────────────────────────────────────
        console.log(`${BOLD}Test 1: DB Column Existence${RESET}`);
        try {
            const criticalColumns = [
                { table: 'scoping_forms', column: 'mileage_rate' },
                { table: 'scoping_forms', column: 'scan_day_fee' },
                { table: 'scoping_forms', column: 'custom_travel_cost' },
                { table: 'scoping_forms', column: 'pricing_tier' },
                { table: 'scoping_forms', column: 'bim_manager' },
                { table: 'scoping_forms', column: 'scanner_assignment' },
                { table: 'scoping_forms', column: 'est_scan_days' },
                { table: 'scoping_forms', column: 'techs_planned' },
                { table: 'scoping_forms', column: 'm_override' },
                { table: 'scoping_forms', column: 'whale_scan_cost' },
                { table: 'scoping_forms', column: 'whale_model_cost' },
                { table: 'scoping_forms', column: 'assumed_savings_m' },
                { table: 'scoping_forms', column: 'caveats_profitability' },
                { table: 'scope_areas', column: 'structural' },
                { table: 'scope_areas', column: 'mepf' },
                { table: 'scope_areas', column: 'act' },
                { table: 'scope_areas', column: 'below_floor' },
                { table: 'scope_areas', column: 'custom_line_items' },
                { table: 'quotes', column: 'line_items' },
                { table: 'quotes', column: 'totals' },
                { table: 'quotes', column: 'integrity_status' },
            ];

            const missing: string[] = [];
            for (const { table, column } of criticalColumns) {
                const result = await pool.query(
                    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
                    [table, column]
                );
                if (result.rows.length === 0) {
                    missing.push(`${table}.${column}`);
                }
            }

            if (missing.length === 0) {
                pass('DB Column Existence', `All ${criticalColumns.length} critical columns exist`);
            } else {
                fail('DB Column Existence', `Missing columns: ${missing.join(', ')}`, 'Run db:push or ALTER TABLE to add them');
            }
        } catch (e: unknown) {
            fail('DB Column Existence', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 2: Scoping Form Read
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 2: Scoping Form Read${RESET}`);
        let testFormId: number | null = null;
        let testForm: any = null;

        try {
            // Pick the most recently updated form
            const forms = await db
                .select()
                .from(scopingForms)
                .orderBy(desc(scopingForms.updatedAt))
                .limit(1);

            if (forms.length === 0) {
                fail('Scoping Form Read', 'No scoping forms found in database');
            } else {
                testForm = forms[0];
                testFormId = testForm.id;

                // Verify critical fields are present
                const requiredFields = ['id', 'upid', 'clientCompany', 'projectName', 'projectAddress', 'email'];
                const presentFields = requiredFields.filter(f => (testForm as any)[f] != null);

                if (presentFields.length === requiredFields.length) {
                    pass('Scoping Form Read', `Form #${testFormId} (${testForm.upid}) loaded — ${testForm.clientCompany} / ${testForm.projectName}`);
                } else {
                    const missingFields = requiredFields.filter(f => (testForm as any)[f] == null);
                    fail('Scoping Form Read', `Form #${testFormId} missing required fields: ${missingFields.join(', ')}`);
                }
            }
        } catch (e: unknown) {
            fail('Scoping Form Read', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 3: Scoping Form Write (Reversible)
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 3: Scoping Form Write${RESET}`);
        if (testFormId) {
            try {
                const originalNotes = testForm.internalNotes;
                const testValue = `[DIAGNOSTIC] ${new Date().toISOString()}`;

                // Write test value
                const [updated] = await db
                    .update(scopingForms)
                    .set({ internalNotes: testValue, updatedAt: new Date() })
                    .where(eq(scopingForms.id, testFormId))
                    .returning();

                if (updated.internalNotes === testValue) {
                    // Revert immediately
                    await db
                        .update(scopingForms)
                        .set({ internalNotes: originalNotes, updatedAt: new Date() })
                        .where(eq(scopingForms.id, testFormId));

                    pass('Scoping Form Write', 'PATCH + revert succeeded — autosave target works');
                } else {
                    fail('Scoping Form Write', `Written value not returned. Expected: "${testValue}", Got: "${updated.internalNotes}"`);
                    // Revert anyway
                    await db
                        .update(scopingForms)
                        .set({ internalNotes: originalNotes, updatedAt: new Date() })
                        .where(eq(scopingForms.id, testFormId));
                }
            } catch (e: unknown) {
                fail('Scoping Form Write', errMsg(e));
            }
        } else {
            fail('Scoping Form Write', 'Skipped — no form available');
        }

        // ──────────────────────────────────────────────
        // Test 4: Area Data Integrity
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 4: Area Data Integrity${RESET}`);
        let testAreas: any[] = [];

        try {
            // Get all areas from recent forms
            const recentForms = await db
                .select({ id: scopingForms.id })
                .from(scopingForms)
                .orderBy(desc(scopingForms.updatedAt))
                .limit(10);

            const formIds = recentForms.map(f => f.id);
            const allAreas: any[] = [];

            for (const fid of formIds) {
                const areas = await db
                    .select()
                    .from(scopeAreas)
                    .where(eq(scopeAreas.scopingFormId, fid));
                allAreas.push(...areas);
            }

            if (allAreas.length === 0) {
                fail('Area Data Integrity', `No scope areas found across ${formIds.length} recent forms — this is likely why line items aren't generating`);
            } else {
                const issues: string[] = [];
                for (const area of allAreas) {
                    if (!area.areaType) issues.push(`Area #${area.id}: missing areaType`);
                    if (area.squareFootage == null) issues.push(`Area #${area.id}: missing squareFootage`);
                    if (!area.projectScope) issues.push(`Area #${area.id}: missing projectScope`);
                    if (!area.lod) issues.push(`Area #${area.id}: missing lod`);
                    if (!area.cadDeliverable) issues.push(`Area #${area.id}: missing cadDeliverable`);
                }

                if (issues.length === 0) {
                    pass('Area Data Integrity', `${allAreas.length} areas across ${formIds.length} forms — all have required fields`);
                } else {
                    fail('Area Data Integrity', `${issues.length} issues found`, issues.slice(0, 5).join('\n     '));
                }

                testAreas = allAreas;
            }
        } catch (e: unknown) {
            fail('Area Data Integrity', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 5: Shell Generation — Minimum (Empty Areas)
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 5: Shell Generation — Minimum${RESET}`);
        try {
            resetIdCounter();
            const emptyForm: ScopingFormInput = {
                landscapeModeling: 'No',
                georeferencing: false,
                scanRegOnly: 'none',
                expedited: false,
                dispatchLocation: 'Troy NY',
                oneWayMiles: 50,
                travelMode: 'Local',
                areas: [],
            };
            const shells = generateLineItemShells(emptyForm);

            if (shells.length === 1 && shells[0].discipline === 'travel') {
                pass('Shell Gen — Minimum', 'Empty areas → 1 travel line (correct)');
            } else {
                fail('Shell Gen — Minimum', `Expected 1 travel line, got ${shells.length} items: ${shells.map(s => s.discipline).join(', ')}`);
            }
        } catch (e: unknown) {
            fail('Shell Gen — Minimum', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 6: Shell Generation — Real Form Data
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 6: Shell Generation — Real Form Data${RESET}`);
        if (testForm && testAreas.length > 0) {
            try {
                // Find areas for the test form
                const formAreas = testAreas.filter(a => a.scopingFormId === testFormId);

                if (formAreas.length === 0) {
                    // Try any form with areas
                    const formsWithAreas = await db
                        .select()
                        .from(scopingForms)
                        .where(eq(scopingForms.id, testAreas[0].scopingFormId));

                    if (formsWithAreas.length > 0) {
                        testForm = formsWithAreas[0];
                        testFormId = testForm.id;
                    }
                }

                const areasForForm = testAreas.filter(a => a.scopingFormId === testFormId);

                resetIdCounter();
                const input: ScopingFormInput = {
                    landscapeModeling: testForm.landscapeModeling || 'No',
                    landscapeAcres: testForm.landscapeAcres,
                    landscapeTerrain: testForm.landscapeTerrain,
                    georeferencing: testForm.georeferencing ?? false,
                    scanRegOnly: testForm.scanRegOnly || 'none',
                    expedited: testForm.expedited ?? false,
                    dispatchLocation: testForm.dispatchLocation || 'Troy NY',
                    oneWayMiles: testForm.oneWayMiles || 0,
                    travelMode: testForm.travelMode || 'Local',
                    customTravelCost: testForm.customTravelCost,
                    mileageRate: testForm.mileageRate,
                    scanDayFeeOverride: testForm.scanDayFeeOverride,
                    areas: areasForForm.map((a: any): ScopeAreaInput => ({
                        id: a.id,
                        areaType: a.areaType,
                        areaName: a.areaName,
                        squareFootage: a.squareFootage,
                        projectScope: a.projectScope,
                        lod: a.lod,
                        mixedInteriorLod: a.mixedInteriorLod,
                        mixedExteriorLod: a.mixedExteriorLod,
                        structural: a.structural,
                        mepf: a.mepf,
                        cadDeliverable: a.cadDeliverable,
                        act: a.act,
                        belowFloor: a.belowFloor,
                        customLineItems: a.customLineItems,
                    })),
                };

                const shells = generateLineItemShells(input);

                // Verify: at least 1 architecture line per area + 1 travel
                const archCount = shells.filter(s => s.discipline === 'architecture').length;
                const travelCount = shells.filter(s => s.discipline === 'travel').length;

                if (archCount === areasForForm.length && travelCount === 1) {
                    const categories = shells.reduce((acc, s) => {
                        acc[s.category] = (acc[s.category] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    const catSummary = Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(', ');

                    pass('Shell Gen — Real Data', `${shells.length} shells from ${areasForForm.length} areas (${catSummary})`);
                } else {
                    fail('Shell Gen — Real Data', `Expected ${areasForForm.length} arch + 1 travel, got ${archCount} arch + ${travelCount} travel`);
                }
            } catch (e: unknown) {
                fail('Shell Gen — Real Data', errMsg(e));
            }
        } else {
            fail('Shell Gen — Real Data', 'Skipped — no form with areas available');
        }

        // ──────────────────────────────────────────────
        // Test 7: Shell Generation — Full Rule Coverage
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 7: Shell Generation — Full Rule Coverage${RESET}`);
        try {
            resetIdCounter();
            const fullForm: ScopingFormInput = {
                landscapeModeling: 'LoD 300',
                landscapeAcres: 5,
                landscapeTerrain: 'Natural',
                georeferencing: true,
                scanRegOnly: 'full_day',
                expedited: true,
                dispatchLocation: 'Troy NY',
                oneWayMiles: 120,
                travelMode: 'Standard',
                mileageRate: 0.67,
                areas: [{
                    id: 1,
                    areaType: 'Commercial',
                    areaName: 'HQ',
                    squareFootage: 50000,
                    projectScope: 'Full',
                    lod: '300',
                    cadDeliverable: 'Full',
                    structural: { enabled: true, sqft: 50000 },
                    mepf: { enabled: true, sqft: 40000 },
                    act: { enabled: true, sqft: 30000 },
                    belowFloor: { enabled: true, sqft: 20000 },
                    customLineItems: [{ description: 'Rooftop survey', amount: 2000 }],
                }],
            };

            const shells = generateLineItemShells(fullForm);

            // Expected: arch(1) + struct(2) + mepf(3) + cad(4) + act(5) + bf(6)
            //         + travel(7) + geo(8) + expedited(9) + landscape(10) + scan-reg(11) + custom(12)
            const disciplines = shells.map(s => s.discipline || s.category);
            const expectedDisciplines = [
                'architecture', 'structural', 'mepf', 'cad', 'act', 'below-floor',
                'travel', 'georeferencing', 'expedited', 'landscape', 'scan-reg',
            ];

            const missing = expectedDisciplines.filter(d => !disciplines.includes(d));
            const customCount = shells.filter(s => s.category === 'custom').length;

            if (missing.length === 0 && customCount === 1) {
                pass('Shell Gen — Full Coverage', `All 12 rule types fired — ${shells.length} total shells`);
            } else {
                const issues = [];
                if (missing.length > 0) issues.push(`Missing disciplines: ${missing.join(', ')}`);
                if (customCount !== 1) issues.push(`Expected 1 custom line, got ${customCount}`);
                fail('Shell Gen — Full Coverage', issues.join('; '));
            }
        } catch (e: unknown) {
            fail('Shell Gen — Full Coverage', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 8: Quote Totals — Margin Math
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 8: Quote Totals — Margin Math${RESET}`);
        try {
            resetIdCounter();
            const form: ScopingFormInput = {
                landscapeModeling: 'No',
                georeferencing: false,
                scanRegOnly: 'none',
                expedited: false,
                dispatchLocation: 'Troy NY',
                oneWayMiles: 50,
                travelMode: 'Local',
                areas: [{
                    id: 1, areaType: 'Commercial', areaName: 'Office',
                    squareFootage: 20000, projectScope: 'Full', lod: '300',
                    cadDeliverable: 'No', structural: null, mepf: null,
                    act: null, belowFloor: null, customLineItems: null,
                }],
            };

            const shells = generateLineItemShells(form);

            // Set test prices: arch = 10k client / 4k cost, travel = 2k/1k
            shells[0].upteamCost = 4000;
            shells[0].clientPrice = 10000;
            shells[1].upteamCost = 1000;
            shells[1].clientPrice = 2000;

            const totals = computeQuoteTotals(shells);

            const checks = [
                totals.totalClientPrice === 12000,
                totals.totalUpteamCost === 5000,
                totals.grossMargin === 7000,
                Math.abs(totals.grossMarginPercent - 58.33) < 0.01,
                totals.integrityStatus === 'passed',
            ];

            if (checks.every(Boolean)) {
                pass('Quote Totals — Math', `$12,000 revenue, $5,000 cost, 58.33% margin → passed`);
            } else {
                fail('Quote Totals — Math',
                    `client=$${totals.totalClientPrice}, cost=$${totals.totalUpteamCost}, ` +
                    `margin=${totals.grossMarginPercent}%, status=${totals.integrityStatus}`
                );
            }
        } catch (e: unknown) {
            fail('Quote Totals — Math', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 9: Quote Totals — Integrity Gates
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 9: Quote Totals — Integrity Gates${RESET}`);
        try {
            // Test blocked (<40%)
            const blocked = computeQuoteTotals([
                { id: 'li-1', areaId: '1', areaName: 'A', category: 'modeling', description: 'test', buildingType: 'C', upteamCost: 7000, clientPrice: 10000 },
            ]);

            // Test warning (40-45%)
            const warning = computeQuoteTotals([
                { id: 'li-1', areaId: '1', areaName: 'A', category: 'modeling', description: 'test', buildingType: 'C', upteamCost: 5800, clientPrice: 10000 },
            ]);

            // Test passed (>=45%)
            const passed = computeQuoteTotals([
                { id: 'li-1', areaId: '1', areaName: 'A', category: 'modeling', description: 'test', buildingType: 'C', upteamCost: 5000, clientPrice: 10000 },
            ]);

            // Test unpriced = blocked
            const unpriced = computeQuoteTotals([
                { id: 'li-1', areaId: '1', areaName: 'A', category: 'modeling', description: 'test', buildingType: 'C', upteamCost: null, clientPrice: null },
            ]);

            const checks = [
                blocked.integrityStatus === 'blocked',
                warning.integrityStatus === 'warning',
                passed.integrityStatus === 'passed',
                unpriced.integrityStatus === 'blocked',
            ];

            if (checks.every(Boolean)) {
                pass('Quote Totals — Gates', 'blocked(<40%), warning(40-45%), passed(>=45%), unpriced=blocked — all correct');
            } else {
                fail('Quote Totals — Gates',
                    `30%=${blocked.integrityStatus}, 42%=${warning.integrityStatus}, ` +
                    `50%=${passed.integrityStatus}, null=${unpriced.integrityStatus}`
                );
            }
        } catch (e: unknown) {
            fail('Quote Totals — Gates', errMsg(e));
        }

        // ──────────────────────────────────────────────
        // Test 10: Round-Trip — Real Deal Data
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Test 10: Round-Trip — Real Deal Data${RESET}`);
        if (testForm && testAreas.length > 0) {
            try {
                const areasForForm = testAreas.filter(a => a.scopingFormId === testFormId);

                if (areasForForm.length === 0) {
                    fail('Round-Trip', 'No areas for test form — can\'t generate shells');
                } else {
                    resetIdCounter();
                    const input: ScopingFormInput = {
                        landscapeModeling: testForm.landscapeModeling || 'No',
                        landscapeAcres: testForm.landscapeAcres,
                        landscapeTerrain: testForm.landscapeTerrain,
                        georeferencing: testForm.georeferencing ?? false,
                        scanRegOnly: testForm.scanRegOnly || 'none',
                        expedited: testForm.expedited ?? false,
                        dispatchLocation: testForm.dispatchLocation || 'Troy NY',
                        oneWayMiles: testForm.oneWayMiles || 0,
                        travelMode: testForm.travelMode || 'Local',
                        customTravelCost: testForm.customTravelCost,
                        mileageRate: testForm.mileageRate,
                        scanDayFeeOverride: testForm.scanDayFeeOverride,
                        areas: areasForForm.map((a: any): ScopeAreaInput => ({
                            id: a.id,
                            areaType: a.areaType,
                            areaName: a.areaName,
                            squareFootage: a.squareFootage,
                            projectScope: a.projectScope,
                            lod: a.lod,
                            mixedInteriorLod: a.mixedInteriorLod,
                            mixedExteriorLod: a.mixedExteriorLod,
                            structural: a.structural,
                            mepf: a.mepf,
                            cadDeliverable: a.cadDeliverable,
                            act: a.act,
                            belowFloor: a.belowFloor,
                            customLineItems: a.customLineItems,
                        })),
                    };

                    // Step 1: Generate shells
                    const shells = generateLineItemShells(input);

                    // Step 2: Set mock prices (55% margin)
                    for (const shell of shells) {
                        shell.clientPrice = 5000;
                        shell.upteamCost = 2250; // 55% margin
                    }

                    // Step 3: Compute totals
                    const totals = computeQuoteTotals(shells);

                    // Verify consistency
                    const expectedClient = shells.length * 5000;
                    const expectedCost = shells.length * 2250;

                    const consistent =
                        totals.totalClientPrice === expectedClient &&
                        totals.totalUpteamCost === expectedCost &&
                        totals.integrityStatus === 'passed' &&
                        totals.grossMarginPercent === 55;

                    if (consistent) {
                        pass('Round-Trip', `${shells.length} shells → $${totals.totalClientPrice} revenue, $${totals.totalUpteamCost} cost, ${totals.grossMarginPercent}% margin → ${totals.integrityStatus}`);
                    } else {
                        fail('Round-Trip',
                            `Inconsistency: ${shells.length} shells, client=$${totals.totalClientPrice} (exp $${expectedClient}), ` +
                            `cost=$${totals.totalUpteamCost} (exp $${expectedCost}), ` +
                            `margin=${totals.grossMarginPercent}%, status=${totals.integrityStatus}`
                        );
                    }
                }
            } catch (e: unknown) {
                fail('Round-Trip', errMsg(e));
            }
        } else {
            fail('Round-Trip', 'Skipped — no form with areas available');
        }

        // ──────────────────────────────────────────────
        // Bonus: Check existing quotes in DB
        // ──────────────────────────────────────────────
        console.log(`\n${BOLD}Bonus: Existing Quotes Check${RESET}`);
        try {
            const allQuotes = await db
                .select({
                    id: quotes.id,
                    scopingFormId: quotes.scopingFormId,
                    integrityStatus: quotes.integrityStatus,
                    lineItems: quotes.lineItems,
                    createdAt: quotes.createdAt,
                })
                .from(quotes)
                .orderBy(desc(quotes.createdAt))
                .limit(10);

            if (allQuotes.length === 0) {
                console.log(`  ${YELLOW}⚠  No quotes in database yet${RESET}`);
            } else {
                let emptyLineItems = 0;
                let invalidStatus = 0;
                for (const q of allQuotes) {
                    const items = q.lineItems as any[];
                    if (!items || !Array.isArray(items) || items.length === 0) emptyLineItems++;
                    if (q.integrityStatus && !['passed', 'warning', 'blocked'].includes(q.integrityStatus)) invalidStatus++;
                }

                if (emptyLineItems === 0 && invalidStatus === 0) {
                    pass('Existing Quotes', `${allQuotes.length} quotes found — all have valid line items and status`);
                } else {
                    const issues = [];
                    if (emptyLineItems > 0) issues.push(`${emptyLineItems} with empty/missing lineItems`);
                    if (invalidStatus > 0) issues.push(`${invalidStatus} with invalid integrityStatus`);
                    fail('Existing Quotes', issues.join(', '));
                }
            }
        } catch (e: unknown) {
            fail('Existing Quotes', errMsg(e));
        }

    } finally {
        await pool.end();
    }

    // ── Summary ──
    console.log(`\n${BOLD}${CYAN}═══ Summary ═══${RESET}`);
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    if (failed === 0) {
        console.log(`  ${GREEN}${BOLD}All ${total} tests passed ✅${RESET}\n`);
    } else {
        console.log(`  ${RED}${BOLD}${failed}/${total} tests failed ❌${RESET}`);
        console.log(`  ${GREEN}${passed}/${total} tests passed${RESET}\n`);

        console.log(`${BOLD}Failed tests:${RESET}`);
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  ${RED}• ${r.name}${RESET}: ${r.message}`);
            if (r.details) console.log(`    ${DIM}${r.details}${RESET}`);
        }
        console.log();
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`${RED}Fatal error:${RESET}`, err);
    process.exit(1);
});
