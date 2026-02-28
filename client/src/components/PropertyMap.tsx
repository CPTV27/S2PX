// ── PropertyMap ──
// Google Maps satellite view with Solar API building footprint detection.
// Reusable across DealWorkspace, ProductionDetail, Archive, and ScopingForm.

import { useState, useCallback, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Maximize2, Building2 } from 'lucide-react';
import { geoLookup, type GeoLookupResult } from '@/services/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface PropertyMapProps {
    address: string;
    lat?: number | null;
    lng?: number | null;
    footprintSqft?: number | null;
    scopingFormId?: number;
    onGeoResult?: (result: GeoLookupResult) => void;
    height?: number;
    interactive?: boolean;
    showFootprint?: boolean;
    className?: string;
}

export function PropertyMap({
    address,
    lat,
    lng,
    footprintSqft,
    scopingFormId,
    onGeoResult,
    height = 300,
    interactive = true,
    showFootprint = true,
    className = '',
}: PropertyMapProps) {
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : null
    );
    const [sqft, setSqft] = useState<number | null>(footprintSqft ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-geocode on mount if no coordinates
    useEffect(() => {
        if (!coords && address && GOOGLE_MAPS_API_KEY) {
            handleLookup();
        }
    }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLookup = useCallback(async () => {
        if (!address?.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const result = await geoLookup(address, scopingFormId);
            setCoords({ lat: result.lat, lng: result.lng });
            setSqft(result.footprintSqft);
            onGeoResult?.(result);
        } catch (err: any) {
            setError(err.message || 'Geocoding failed');
        } finally {
            setLoading(false);
        }
    }, [address, scopingFormId, onGeoResult]);

    // No API key configured
    if (!GOOGLE_MAPS_API_KEY) {
        return (
            <div
                className={`flex items-center justify-center bg-s2p-muted/30 rounded-lg border border-s2p-border ${className}`}
                style={{ height }}
            >
                <div className="text-center text-sm text-s2p-fg/50 px-4">
                    <MapPin className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p>Google Maps API key not configured</p>
                    <p className="text-xs mt-1 opacity-60">Add VITE_GOOGLE_MAPS_API_KEY to .env</p>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div
                className={`flex items-center justify-center bg-s2p-muted/30 rounded-lg border border-s2p-border ${className}`}
                style={{ height }}
            >
                <div className="flex items-center gap-2 text-sm text-s2p-fg/60">
                    <Loader2 className="w-4 h-4 animate-spin text-s2p-primary" />
                    <span>Locating property...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div
                className={`flex items-center justify-center bg-s2p-muted/30 rounded-lg border border-s2p-border ${className}`}
                style={{ height }}
            >
                <div className="text-center text-sm px-4">
                    <MapPin className="w-6 h-6 mx-auto mb-2 text-red-400" />
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={handleLookup}
                        className="mt-2 text-xs text-s2p-primary hover:underline"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // No coords yet — show manual trigger
    if (!coords) {
        return (
            <div
                className={`flex items-center justify-center bg-s2p-muted/30 rounded-lg border border-s2p-border ${className}`}
                style={{ height }}
            >
                <button
                    onClick={handleLookup}
                    className="flex items-center gap-2 text-sm text-s2p-primary hover:text-s2p-primary/80 transition-colors"
                >
                    <MapPin className="w-5 h-5" />
                    <span>Load satellite view</span>
                </button>
            </div>
        );
    }

    // Map loaded
    return (
        <div className={`relative rounded-lg overflow-hidden border border-s2p-border ${className}`} style={{ height }}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                    mapId="s2p-property-map"
                    defaultCenter={coords}
                    defaultZoom={18}
                    mapTypeId="hybrid"
                    disableDefaultUI={!interactive}
                    gestureHandling={interactive ? 'auto' : 'none'}
                    zoomControl={interactive}
                    streetViewControl={false}
                    fullscreenControl={interactive}
                    style={{ width: '100%', height: '100%' }}
                >
                    <AdvancedMarker position={coords} />
                </Map>
            </APIProvider>

            {/* Footprint badge */}
            {showFootprint && sqft && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg">
                    <Building2 className="w-4 h-4 text-blue-300" />
                    <span>{sqft.toLocaleString()} sqft footprint</span>
                </div>
            )}

            {/* Detect footprint button (if no sqft yet) */}
            {showFootprint && !sqft && !loading && (
                <button
                    onClick={handleLookup}
                    className="absolute top-3 left-3 flex items-center gap-1.5 bg-s2p-primary/90 hover:bg-s2p-primary text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors"
                >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Detect footprint</span>
                </button>
            )}

            {/* Address label */}
            <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg truncate">
                <MapPin className="w-3 h-3 inline mr-1 opacity-60" />
                {address}
            </div>
        </div>
    );
}
