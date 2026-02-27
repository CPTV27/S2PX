// ── Geocoding + Solar API Routes ──
// Geocodes addresses via Google Geocoding API, fetches building footprint via Solar API.

import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { scopingForms } from '../../shared/schema/db.js';
import { eq } from 'drizzle-orm';

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

interface GeoLookupResult {
    lat: number;
    lng: number;
    footprintSqft: number | null;
    formattedAddress: string;
    placeId: string | null;
}

// ── Geocode + Solar lookup ──
router.post('/lookup', async (req: Request, res: Response) => {
    try {
        const { address, scopingFormId } = req.body as {
            address: string;
            scopingFormId?: number;
        };

        if (!address?.trim()) {
            return res.status(400).json({ error: 'address is required' });
        }

        if (!GOOGLE_MAPS_API_KEY) {
            return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
        }

        // Step 1: Geocode address → lat/lng
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
        const geoResp = await fetch(geoUrl);
        const geoData = await geoResp.json();

        if (geoData.status !== 'OK' || !geoData.results?.length) {
            return res.status(404).json({
                error: `Geocoding failed: ${geoData.status}`,
                detail: geoData.error_message || 'Address not found',
            });
        }

        const location = geoData.results[0].geometry.location;
        const lat: number = location.lat;
        const lng: number = location.lng;
        const formattedAddress: string = geoData.results[0].formatted_address;
        const placeId: string | null = geoData.results[0].place_id || null;

        // Step 2: Solar API → building footprint
        let footprintSqft: number | null = null;
        try {
            const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${GOOGLE_MAPS_API_KEY}`;
            const solarResp = await fetch(solarUrl);

            if (solarResp.ok) {
                const solarData = await solarResp.json();
                const groundAreaM2 = solarData?.solarPotential?.buildingStats?.areaMeters2;
                if (groundAreaM2 && groundAreaM2 > 0) {
                    footprintSqft = Math.round(groundAreaM2 * 10.7639);
                }
            } else {
                // Solar API may not have data for all buildings — that's fine
                console.warn(`Solar API returned ${solarResp.status} for ${lat},${lng}`);
            }
        } catch (solarError) {
            console.warn('Solar API error (non-fatal):', solarError);
        }

        // Step 3: Optionally persist to scoping form
        if (scopingFormId) {
            try {
                await db
                    .update(scopingForms)
                    .set({
                        projectLat: String(lat),
                        projectLng: String(lng),
                        buildingFootprintSqft: footprintSqft,
                        updatedAt: new Date(),
                    })
                    .where(eq(scopingForms.id, scopingFormId));
            } catch (dbError) {
                console.warn('Failed to persist geo data:', dbError);
            }
        }

        const result: GeoLookupResult = {
            lat,
            lng,
            footprintSqft,
            formattedAddress,
            placeId,
        };

        res.json(result);
    } catch (error: any) {
        console.error('Geo lookup error:', error);
        res.status(500).json({ error: error.message || 'Geo lookup failed' });
    }
});

// ── Batch geocode (for backfilling existing projects) ──
router.post('/batch', async (req: Request, res: Response) => {
    try {
        const { scopingFormIds } = req.body as { scopingFormIds: number[] };

        if (!scopingFormIds?.length) {
            return res.status(400).json({ error: 'scopingFormIds array required' });
        }

        if (!GOOGLE_MAPS_API_KEY) {
            return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
        }

        const results: { id: number; status: string; lat?: number; lng?: number; footprintSqft?: number | null }[] = [];

        for (const id of scopingFormIds.slice(0, 25)) { // cap at 25 per batch
            try {
                const [form] = await db
                    .select({ id: scopingForms.id, address: scopingForms.projectAddress })
                    .from(scopingForms)
                    .where(eq(scopingForms.id, id));

                if (!form) {
                    results.push({ id, status: 'not_found' });
                    continue;
                }

                // Geocode
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(form.address)}&key=${GOOGLE_MAPS_API_KEY}`;
                const geoResp = await fetch(geoUrl);
                const geoData = await geoResp.json();

                if (geoData.status !== 'OK' || !geoData.results?.length) {
                    results.push({ id, status: `geocode_failed: ${geoData.status}` });
                    continue;
                }

                const location = geoData.results[0].geometry.location;
                const lat = location.lat;
                const lng = location.lng;

                // Solar
                let footprintSqft: number | null = null;
                try {
                    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${GOOGLE_MAPS_API_KEY}`;
                    const solarResp = await fetch(solarUrl);
                    if (solarResp.ok) {
                        const solarData = await solarResp.json();
                        const areaM2 = solarData?.solarPotential?.buildingStats?.areaMeters2;
                        if (areaM2 > 0) footprintSqft = Math.round(areaM2 * 10.7639);
                    }
                } catch { /* non-fatal */ }

                // Persist
                await db
                    .update(scopingForms)
                    .set({
                        projectLat: String(lat),
                        projectLng: String(lng),
                        buildingFootprintSqft: footprintSqft,
                        updatedAt: new Date(),
                    })
                    .where(eq(scopingForms.id, id));

                results.push({ id, status: 'ok', lat, lng, footprintSqft });

                // Rate limit: 50ms between requests
                await new Promise(r => setTimeout(r, 50));
            } catch (err: any) {
                results.push({ id, status: `error: ${err.message}` });
            }
        }

        res.json({ results, processed: results.length });
    } catch (error: any) {
        console.error('Batch geo error:', error);
        res.status(500).json({ error: error.message || 'Batch geocode failed' });
    }
});

// ── Distance Matrix — driving distance between two addresses ──
router.post('/distance', async (req: Request, res: Response) => {
    try {
        const { origin, destination } = req.body as {
            origin: string;
            destination: string;
        };

        if (!origin?.trim() || !destination?.trim()) {
            return res.status(400).json({ error: 'origin and destination are required' });
        }

        if (!GOOGLE_MAPS_API_KEY) {
            return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;

        const resp = await fetch(url);
        const data = await resp.json();

        if (data.status !== 'OK') {
            return res.status(502).json({
                error: `Distance Matrix API error: ${data.status}`,
                detail: data.error_message || 'Request failed',
            });
        }

        const element = data.rows?.[0]?.elements?.[0];
        if (!element || element.status !== 'OK') {
            return res.status(404).json({
                error: `No route found: ${element?.status || 'UNKNOWN'}`,
                detail: 'Could not calculate driving distance between the addresses',
            });
        }

        // distance.value is in meters, convert to miles
        const distanceMiles = Math.round(element.distance.value / 1609.34);
        // duration.value is in seconds, convert to minutes
        const durationMinutes = Math.round(element.duration.value / 60);

        res.json({
            distanceMiles,
            durationMinutes,
            originAddress: data.origin_addresses?.[0] || origin,
            destinationAddress: data.destination_addresses?.[0] || destination,
        });
    } catch (error: any) {
        console.error('Distance matrix error:', error);
        res.status(500).json({ error: error.message || 'Distance calculation failed' });
    }
});

export default router;
