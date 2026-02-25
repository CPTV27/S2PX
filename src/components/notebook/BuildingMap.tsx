import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Search, Satellite, Building2, Ruler, Loader2 } from 'lucide-react';

interface BuildingMapProps {
  /** Address or location from extraction context */
  address?: string;
  /** Callback with building insights when available */
  onBuildingInsights?: (insights: BuildingInsights) => void;
}

export interface BuildingInsights {
  address: string;
  lat: number;
  lng: number;
  estimatedSqft?: number;
  buildingFootprint?: number;
  roofSegments?: number;
  maxSunshineHours?: number;
}

export function BuildingMap({ address, onBuildingInsights }: BuildingMapProps) {
  const [query, setQuery] = useState(address || '');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [insights, setInsights] = useState<BuildingInsights | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync address prop
  useEffect(() => {
    if (address && address !== query) {
      setQuery(address);
    }
  }, [address]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setMapError(null);

    try {
      // Use Nominatim (free geocoding) for lat/lng lookup
      const encoded = encodeURIComponent(query.trim());
      const geocodeResp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&addressdetails=1`,
        { headers: { 'User-Agent': 'S2P-Studio/1.0' } }
      );
      const geocodeData = await geocodeResp.json();

      if (!geocodeData || geocodeData.length === 0) {
        setMapError('Location not found. Try a more specific address.');
        setIsLoading(false);
        return;
      }

      const result = geocodeData[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      const displayName = result.display_name;

      setLocation({ lat, lng, address: displayName });

      const buildingInsights: BuildingInsights = {
        address: displayName,
        lat,
        lng,
      };
      setInsights(buildingInsights);
      onBuildingInsights?.(buildingInsights);
    } catch {
      setMapError('Failed to look up location. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [query, onBuildingInsights]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Build OpenStreetMap embed URL
  const mapEmbedUrl = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.003}%2C${location.lat - 0.002}%2C${location.lng + 0.003}%2C${location.lat + 0.002}&layer=mapnik&marker=${location.lat}%2C${location.lng}`
    : null;

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <MapPin size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--nb-text-dim)]" />
          <input
            type="text"
            className="nb-input w-full pl-8"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter building address..."
          />
        </div>
        <button
          className="nb-btn nb-btn-primary text-xs py-1.5 px-3"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? <Loader2 size={14} className="nb-spinner" /> : <Search size={14} />}
        </button>
      </div>

      {mapError && (
        <p className="text-xs text-[var(--nb-error)] font-mono mb-2">{mapError}</p>
      )}

      {/* Map display */}
      <div className="nb-map-container">
        {mapEmbedUrl ? (
          <iframe
            ref={iframeRef}
            src={mapEmbedUrl}
            width="100%"
            height="220"
            style={{ border: 0, borderRadius: '10px' }}
            loading="lazy"
            title="Building location"
          />
        ) : (
          <div className="nb-map-placeholder">
            <Satellite size={24} className="opacity-30" />
            <span>Search for a building to see it on the map</span>
          </div>
        )}
      </div>

      {/* Building insights */}
      {insights && (
        <div className="mt-3 space-y-1.5">
          <div className="nb-stat-row">
            <span className="nb-stat-label flex items-center gap-1.5">
              <Building2 size={12} /> Location
            </span>
            <span className="nb-stat-value text-xs truncate max-w-[200px]" title={insights.address}>
              {insights.address.split(',').slice(0, 2).join(',')}
            </span>
          </div>
          <div className="nb-stat-row">
            <span className="nb-stat-label flex items-center gap-1.5">
              <Ruler size={12} /> Coordinates
            </span>
            <span className="nb-stat-value text-xs">
              {insights.lat.toFixed(4)}, {insights.lng.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
