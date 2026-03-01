// ── Auto-Calc Engine ──
// Auto-computes derived line item prices based on user-entered values:
//   1) Expedited Surcharge: +20% of all BIM modeling + add-on clientPrices
//   2) Below Floor: 50% of the Architecture rate for the same area
//
// These are auto-suggestions. The CEO can manually override by editing
// the auto-computed line item directly. The override sticks until
// the source prices change.

import type { LineItemShell } from '../types/lineItem';
import { DEFAULT_PRICING_CONFIG } from '../types/pricingConfig';

/**
 * Apply auto-calc rules to line items after a manual price edit.
 *
 * @param items  - The full line items array (with the manual edit already applied)
 * @param editedId - The ID of the item the CEO just edited (so we don't overwrite manual edits to auto-calc items)
 * @returns Updated line items array with auto-calculated prices
 */
export function applyAutoCalcPrices(items: LineItemShell[], editedId?: string): LineItemShell[] {
    let result = [...items];

    // ── 1) Expedited Surcharge Auto-Calc ──
    // If there's an expedited line item and the user didn't just manually edit it,
    // auto-compute its clientPrice as expeditedSurchargePercent × sum of modeling+addOn clientPrices.
    const expeditedIndex = result.findIndex(li => li.discipline === 'expedited');
    if (expeditedIndex >= 0 && result[expeditedIndex].id !== editedId) {
        const modelingAddOnTotal = result
            .filter(li =>
                li.discipline !== 'expedited' &&
                li.category !== 'travel' &&
                li.category !== 'custom' &&
                (li.category === 'modeling' || li.category === 'addOn')
            )
            .reduce((sum, li) => sum + (li.clientPrice || 0), 0);

        const pct = DEFAULT_PRICING_CONFIG.expeditedSurchargePercent;
        const expeditedPrice = modelingAddOnTotal > 0
            ? Math.round(modelingAddOnTotal * pct * 100) / 100
            : null;

        result = result.map((li, i) =>
            i === expeditedIndex
                ? { ...li, clientPrice: expeditedPrice, upteamCost: 0 }
                : li
        );
    }

    // ── 2) Below Floor Auto-Suggest ──
    // For each below-floor line, find the architecture line for the same area.
    // Auto-suggest: belowFloorRateFraction × (archClientPrice / archSqft) × belowFloorSqft
    for (let i = 0; i < result.length; i++) {
        const li = result[i];
        if (li.discipline !== 'below-floor' || !li.areaId) continue;
        if (li.id === editedId) continue; // CEO manually edited this — don't override

        // Find the architecture line for this area
        const archLine = result.find(
            a => a.areaId === li.areaId && a.discipline === 'architecture' && a.clientPrice != null && a.clientPrice > 0
        );

        if (archLine && archLine.squareFeet && archLine.squareFeet > 0) {
            const archRatePerSqft = archLine.clientPrice! / archLine.squareFeet;
            const belowFloorSqft = li.squareFeet || archLine.squareFeet;
            const fraction = DEFAULT_PRICING_CONFIG.belowFloorRateFraction;
            const suggestedPrice = Math.round(archRatePerSqft * fraction * belowFloorSqft * 100) / 100;

            // Also compute upteam cost as the same fraction
            const archUpteamRate = archLine.upteamCost != null && archLine.squareFeet > 0
                ? archLine.upteamCost / archLine.squareFeet
                : archRatePerSqft * DEFAULT_PRICING_CONFIG.upteamMultiplierFallback;
            const suggestedUpteam = Math.round(archUpteamRate * fraction * belowFloorSqft * 100) / 100;

            result = result.map((item, idx) =>
                idx === i
                    ? { ...item, clientPrice: suggestedPrice, upteamCost: suggestedUpteam }
                    : item
            );
        }
    }

    return result;
}
