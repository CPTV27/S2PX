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
                    lineItems = existingQuote.lineItems as LineItemShell[];
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

    // Update a single line item's price
    const updateLineItem = useCallback((itemId: string, field: 'upteamCost' | 'clientPrice', value: number | null) => {
        setState(prev => {
            const updated = prev.lineItems.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            );
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
            customLineItems: a.customLineItems || null,
        })),
    };
    return generateLineItemShells(input);
}
