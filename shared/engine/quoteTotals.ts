// ── Quote Totals & Integrity Engine ──
// Computes totals from priced line items and enforces margin guardrails.
// <40% margin = blocked (save disabled)
// 40-45% margin = warning (save with confirmation)
// >=45% margin = passed

import type { LineItemShell, QuoteTotals } from '../types/lineItem';

/**
 * Compute quote totals from a set of line item shells.
 * Only items with both upteamCost and clientPrice are included in totals.
 */
export function computeQuoteTotals(items: LineItemShell[]): QuoteTotals {
    let totalClientPrice = 0;
    let totalUpteamCost = 0;
    let unpricedCount = 0;
    const flags: string[] = [];

    for (const item of items) {
        if (item.clientPrice !== null && item.upteamCost !== null) {
            totalClientPrice += item.clientPrice;
            totalUpteamCost += item.upteamCost;
        } else {
            unpricedCount++;
        }
    }

    // Gross margin = (revenue - cost) / revenue
    const grossMargin = totalClientPrice > 0
        ? totalClientPrice - totalUpteamCost
        : 0;
    const grossMarginPercent = totalClientPrice > 0
        ? (grossMargin / totalClientPrice) * 100
        : 0;

    // Integrity flags
    if (unpricedCount > 0) {
        flags.push(`${unpricedCount} line item${unpricedCount > 1 ? 's' : ''} not yet priced`);
    }

    if (totalClientPrice > 0 && grossMarginPercent < 40) {
        flags.push(`Margin ${grossMarginPercent.toFixed(1)}% is below 40% minimum`);
    } else if (totalClientPrice > 0 && grossMarginPercent < 45) {
        flags.push(`Margin ${grossMarginPercent.toFixed(1)}% is below 45% target`);
    }

    // Check for negative margins on individual items
    const negativeItems = items.filter(
        i => i.clientPrice !== null && i.upteamCost !== null && i.clientPrice < i.upteamCost
    );
    if (negativeItems.length > 0) {
        flags.push(`${negativeItems.length} line item${negativeItems.length > 1 ? 's have' : ' has'} negative margin`);
    }

    // Determine integrity status
    let integrityStatus: QuoteTotals['integrityStatus'];

    if (unpricedCount > 0) {
        // Can't pass integrity if items are unpriced
        integrityStatus = 'blocked';
    } else if (totalClientPrice === 0) {
        // No priced items at all
        integrityStatus = 'blocked';
    } else if (grossMarginPercent < 40) {
        integrityStatus = 'blocked';
    } else if (grossMarginPercent < 45) {
        integrityStatus = 'warning';
    } else {
        integrityStatus = 'passed';
    }

    return {
        totalClientPrice: round2(totalClientPrice),
        totalUpteamCost: round2(totalUpteamCost),
        grossMargin: round2(grossMargin),
        grossMarginPercent: round2(grossMarginPercent),
        integrityStatus,
        integrityFlags: flags,
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
