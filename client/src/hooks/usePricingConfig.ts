// ── usePricingConfig Hook ──
// Fetches the DB-stored pricing config via /api/pricing-config.
// Falls back to compile-time defaults if the API is unreachable.

import { useState, useEffect } from 'react';
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@shared/types/pricingConfig';
import { fetchPricingConfig } from '@/services/api';

interface PricingConfigState {
    config: PricingConfig;
    loading: boolean;
    error: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
}

/**
 * Fetch the active pricing config from the API, merged over defaults.
 * Returns DEFAULT_PRICING_CONFIG synchronously while loading.
 */
export function usePricingConfig(): PricingConfigState {
    const [state, setState] = useState<PricingConfigState>({
        config: DEFAULT_PRICING_CONFIG,
        loading: true,
        error: null,
        updatedAt: null,
        updatedBy: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await fetchPricingConfig();
                if (cancelled) return;

                if (res.config) {
                    // Merge DB config over defaults to ensure new keys are always present
                    const merged: PricingConfig = { ...DEFAULT_PRICING_CONFIG, ...res.config };
                    setState({
                        config: merged,
                        loading: false,
                        error: null,
                        updatedAt: res.updatedAt || null,
                        updatedBy: res.updatedBy || null,
                    });
                } else {
                    setState({
                        config: DEFAULT_PRICING_CONFIG,
                        loading: false,
                        error: null,
                        updatedAt: null,
                        updatedBy: null,
                    });
                }
            } catch (err) {
                if (cancelled) return;
                console.warn('Failed to load pricing config, using defaults:', err);
                setState({
                    config: DEFAULT_PRICING_CONFIG,
                    loading: false,
                    error: err instanceof Error ? err.message : 'Failed to load pricing config',
                    updatedAt: null,
                    updatedBy: null,
                });
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return state;
}
