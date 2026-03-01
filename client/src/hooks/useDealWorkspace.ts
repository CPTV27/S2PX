import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    fetchScopingForm,
    fetchQuotesByForm,
    createQuoteDeal,
    updateQuoteDeal,
    updateScopingForm,
    type ScopingFormData,
    type QuoteData,
} from '@/services/api';
import { generateLineItemShells, type ScopingFormInput } from '@shared/engine/shellGenerator';
import { computeQuoteTotals } from '@shared/engine/quoteTotals';
import { applyAutoCalcPrices } from '@shared/engine/autoCalc';
import type { LineItemShell, QuoteTotals } from '@shared/types/lineItem';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface DealWorkspaceState {
    form: ScopingFormData | null;
    quote: QuoteData | null;
    lineItems: LineItemShell[];
    totals: QuoteTotals | null;
    loading: boolean;
    saveState: SaveState;
    error: string | null;
}

export function useDealWorkspace(formId: number | undefined) {
    const [state, setState] = useState<DealWorkspaceState>({
        form: null,
        quote: null,
        lineItems: [],
        totals: null,
        loading: true,
        saveState: 'idle',
        error: null,
    });

    // Load scoping form + existing quote
    useEffect(() => {
        if (!formId) return;

        let cancelled = false;

        async function load() {
            setState(s => ({ ...s, loading: true, error: null }));
            try {
                const [form, quotes] = await Promise.all([
                    fetchScopingForm(formId!),
                    fetchQuotesByForm(formId!),
                ]);

                if (cancelled) return;

                // Use latest quote if one exists
                const existingQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;

                let lineItems: LineItemShell[];
                if (existingQuote?.lineItems) {
                    // Use saved line items (preserves CEO-entered prices)
                    // Normalize legacy CPQ format (label/amount/rate/sqft) to current shell format
                    lineItems = (existingQuote.lineItems as unknown as Record<string, unknown>[]).map(normalizeLineItem);
                } else {
                    // Generate fresh shells from scoping form
                    lineItems = generateShellsFromForm(form);
                }

                const totals = computeQuoteTotals(lineItems);

                setState({
                    form,
                    quote: existingQuote,
                    lineItems,
                    totals,
                    loading: false,
                    saveState: 'idle',
                    error: null,
                });
            } catch (err) {
                if (cancelled) return;
                setState(s => ({
                    ...s,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load deal',
                }));
            }
        }

        load();
        return () => { cancelled = true; };
    }, [formId]);

    // Update a single line item's price, then auto-calc dependent items
    const updateLineItem = useCallback((itemId: string, field: 'upteamCost' | 'clientPrice', value: number | null) => {
        setState(prev => {
            const manual = prev.lineItems.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            );
            // Auto-compute expedited surcharge & below floor suggestions
            const updated = applyAutoCalcPrices(manual, itemId);
            const totals = computeQuoteTotals(updated);
            return { ...prev, lineItems: updated, totals, saveState: 'idle' };
        });
    }, []);

    // Regenerate shells from form (discards prices)
    const regenerateShells = useCallback(() => {
        if (!state.form) return;
        const lineItems = generateShellsFromForm(state.form);
        const totals = computeQuoteTotals(lineItems);
        setState(prev => ({ ...prev, lineItems, totals, saveState: 'idle' }));
    }, [state.form]);

    // Save quote to backend
    const saveQuote = useCallback(async () => {
        if (!state.form?.id) return;

        setState(s => ({ ...s, saveState: 'saving' }));

        try {
            const totals = computeQuoteTotals(state.lineItems);
            const payload = {
                lineItems: state.lineItems,
                totals,
                integrityStatus: totals.integrityStatus,
            };

            let saved: QuoteData;
            if (state.quote?.id) {
                saved = await updateQuoteDeal(state.quote.id, payload);
            } else {
                saved = await createQuoteDeal({
                    scopingFormId: state.form.id,
                    ...payload,
                });
            }

            setState(s => ({ ...s, quote: saved, totals, saveState: 'saved' }));

            // Reset save indicator after 2s
            setTimeout(() => {
                setState(s => s.saveState === 'saved' ? { ...s, saveState: 'idle' } : s);
            }, 2000);
        } catch (err) {
            setState(s => ({
                ...s,
                saveState: 'error',
                error: err instanceof Error ? err.message : 'Failed to save quote',
            }));
        }
    }, [state.form, state.quote, state.lineItems]);

    // Update CEO sections (J, K, L) on the scoping form
    const updateCeoFields = useCallback(async (fields: Partial<ScopingFormData>) => {
        if (!state.form?.id) return;
        try {
            const updated = await updateScopingForm(state.form.id, fields);
            setState(s => ({ ...s, form: { ...s.form!, ...updated } }));
        } catch (err) {
            console.error('Failed to update CEO fields:', err);
        }
    }, [state.form?.id]);

    // Computed: can we save?
    const canSave = useMemo(() => {
        if (!state.totals) return false;
        return state.totals.integrityStatus !== 'blocked';
    }, [state.totals]);

    return {
        ...state,
        updateLineItem,
        regenerateShells,
        saveQuote,
        updateCeoFields,
        canSave,
    };
}

/** Convert ScopingFormData → ScopingFormInput for the shell generator */
function generateShellsFromForm(form: ScopingFormData): LineItemShell[] {
    const input: ScopingFormInput = {
        landscapeModeling: form.landscapeModeling || 'No',
        landscapeAcres: form.landscapeAcres,
        landscapeTerrain: form.landscapeTerrain,
        georeferencing: form.georeferencing ?? false,
        scanRegOnly: form.scanRegOnly || 'none',
        expedited: form.expedited ?? false,
        dispatchLocation: form.dispatchLocation || 'Troy NY',
        oneWayMiles: form.oneWayMiles || 0,
        travelMode: form.travelMode || 'Local',
        customTravelCost: form.customTravelCost,
        areas: (form.areas || []).map(a => ({
            id: a.id || 0,
            areaType: a.areaType,
            areaName: a.areaName,
            squareFootage: a.squareFootage,
            projectScope: a.projectScope,
            lod: a.lod,
            mixedInteriorLod: a.mixedInteriorLod,
            mixedExteriorLod: a.mixedExteriorLod,
            structural: a.structural || null,
            mepf: a.mepf || null,
            cadDeliverable: a.cadDeliverable,
            act: a.act || null,
            belowFloor: a.belowFloor || null,
            site: a.site || null,
            matterport: a.matterport || null,
            customLineItems: a.customLineItems || null,
        })),
    };
    return generateLineItemShells(input);
}

/**
 * Normalize a line item from either the legacy CPQ format or the current shell format.
 *
 * Legacy CPQ format (from Railway migration):
 *   { id, label, amount, rate, sqft, category }
 *   Categories: "modeling", "add-on", "summary", "travel", "cad"
 *
 * Current shell format:
 *   { id, areaId, areaName, category, discipline, description, buildingType, squareFeet, upteamCost, clientPrice, ... }
 *   Categories: "modeling" | "travel" | "addOn" | "custom"
 */
function normalizeLineItem(raw: Record<string, unknown>): LineItemShell {
    // Detect legacy format: has "label" but no "description"
    const isLegacy = 'label' in raw && !('description' in raw);

    if (!isLegacy) {
        // Current format — just sanitize nulls
        const item = raw as unknown as LineItemShell;
        return {
            ...item,
            upteamCost: item.upteamCost ?? null,
            clientPrice: item.clientPrice ?? null,
        };
    }

    // ── Legacy CPQ → LineItemShell mapping ──
    const label = (raw.label as string) || '';
    const amount = typeof raw.amount === 'number' ? raw.amount : null;
    const sqft = typeof raw.sqft === 'number' ? raw.sqft : undefined;
    const oldCategory = (raw.category as string) || '';

    // Map legacy categories to current enum
    const categoryMap: Record<string, LineItemShell['category']> = {
        'modeling': 'modeling',
        'travel': 'travel',
        'add-on': 'addOn',
        'cad': 'addOn',
        'summary': 'custom',  // summary rows become custom (non-editable display)
    };
    const category = categoryMap[oldCategory] || 'custom';

    // Infer discipline from label
    let discipline: string | undefined;
    const labelLower = label.toLowerCase();
    if (labelLower.startsWith('architecture')) discipline = 'architecture';
    else if (labelLower.startsWith('mepf')) discipline = 'mepf';
    else if (labelLower.startsWith('structural')) discipline = 'structural';
    else if (labelLower.startsWith('landscape')) discipline = 'landscape';
    else if (labelLower.startsWith('cad') || oldCategory === 'cad') discipline = 'cad';
    else if (labelLower.startsWith('travel') || oldCategory === 'travel') discipline = 'travel';

    // Extract LoD from label if present (e.g., "LOD 350")
    const lodMatch = label.match(/LOD\s*(\d+)/i);
    const lod = lodMatch ? lodMatch[1] : undefined;

    return {
        id: (raw.id as string) || `legacy-${Math.random().toString(36).slice(2, 8)}`,
        areaId: null,
        areaName: oldCategory === 'travel' ? 'Project-Level' : 'Migrated',
        category,
        discipline,
        description: label,
        buildingType: '',
        squareFeet: sqft,
        lod,
        upteamCost: null,  // Legacy format didn't have separate cost/price
        clientPrice: amount,
    };
}
