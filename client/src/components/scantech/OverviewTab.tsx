// ── Scantech Overview Tab ──
// Interactive satellite map (PropertyMap) with Solar API footprint,
// live driving distance via Distance Matrix API, and project summary cards.

import { useState, useEffect } from 'react';
import {
    MapPin, Building2, Layers, Clock, Car, Navigation,
    Ruler, Calendar, Users, AlertTriangle, Shield, Globe,
    Phone, Mail, ExternalLink, Loader2,
} from 'lucide-react';
import { useScantechContext } from './ScantechLayout';
import { PropertyMap } from '@/components/PropertyMap';
import { fetchDrivingDistance } from '@/services/api';
import { DISPATCH_ADDRESSES } from '@shared/schema/constants';
import { cn } from '@/lib/utils';

interface DriveInfo {
    distanceMiles: number;
    durationMinutes: number;
    originAddress: string;
    destinationAddress: string;
}

export function OverviewTab() {
    const { project } = useScantechContext();
    const { scopingData } = project;

    // ── Live driving distance ──
    const [driveInfo, setDriveInfo] = useState<DriveInfo | null>(null);
    const [driveLoading, setDriveLoading] = useState(false);

    useEffect(() => {
        const dispatchAddr = DISPATCH_ADDRESSES[scopingData.dispatchLocation] || scopingData.dispatchLocation;
        const destAddr = scopingData.projectAddress;

        if (dispatchAddr && destAddr) {
            setDriveLoading(true);
            fetchDrivingDistance(dispatchAddr, destAddr)
                .then(setDriveInfo)
                .catch(() => {}) // Non-fatal — we still have oneWayMiles from scoping
                .finally(() => setDriveLoading(false));
        }
    }, [scopingData.dispatchLocation, scopingData.projectAddress]);

    // Total SF across all areas
    const totalSF = scopingData.areas.reduce((sum, a) => sum + a.squareFootage, 0);

    // Drive time display
    const driveTimeDisplay = driveInfo
        ? driveInfo.durationMinutes >= 60
            ? `${Math.floor(driveInfo.durationMinutes / 60)}h ${driveInfo.durationMinutes % 60}m`
            : `${driveInfo.durationMinutes} min`
        : null;

    return (
        <div className="space-y-4">
            {/* ── Interactive Satellite Map with Solar API ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <PropertyMap
                    address={scopingData.projectAddress}
                    lat={project.projectLat ? Number(project.projectLat) : null}
                    lng={project.projectLng ? Number(project.projectLng) : null}
                    footprintSqft={project.buildingFootprintSqft}
                    height={220}
                    interactive
                    showFootprint
                    className="rounded-none border-0"
                />
                <div className="p-3">
                    <p className="text-sm font-medium text-gray-900">{scopingData.projectAddress}</p>
                    {project.buildingFootprintSqft && (
                        <p className="text-xs text-gray-500 mt-0.5">
                            🛰 {project.buildingFootprintSqft.toLocaleString()} SF building footprint (Solar API)
                        </p>
                    )}
                    {/* Open in Google Maps for turn-by-turn */}
                    <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(scopingData.projectAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                        <Navigation className="w-3 h-3" />
                        Navigate in Google Maps
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* ── Travel Card (live Distance Matrix data) ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4 text-gray-400" />
                    Travel
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <InfoCard icon={Navigation} label="Dispatch" value={scopingData.dispatchLocation} />
                    <InfoCard
                        icon={Car}
                        label="Distance"
                        value={
                            driveLoading
                                ? '…'
                                : driveInfo
                                    ? `${driveInfo.distanceMiles} mi`
                                    : `${scopingData.oneWayMiles} mi`
                        }
                        sublabel={
                            driveInfo && driveInfo.distanceMiles !== scopingData.oneWayMiles
                                ? `Scoping: ${scopingData.oneWayMiles} mi`
                                : undefined
                        }
                        highlight={!!driveInfo}
                    />
                    <InfoCard
                        icon={Clock}
                        label="Drive Time"
                        value={driveLoading ? '…' : driveTimeDisplay || '—'}
                        highlight={!!driveInfo}
                    />
                    <InfoCard icon={Shield} label="Travel Mode" value={scopingData.travelMode} />
                </div>
                {driveInfo && (
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                        <Loader2 className="w-3 h-3" />
                        Live distance via Google Distance Matrix API
                    </p>
                )}
            </div>

            {/* ── Project Summary ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    Project Summary
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <InfoCard icon={Building2} label="Era" value={scopingData.era || '—'} />
                    <InfoCard icon={Layers} label="Floors" value={`${scopingData.numberOfFloors}`} />
                    <InfoCard icon={Ruler} label="Total SF" value={totalSF > 0 ? `${totalSF.toLocaleString()}` : '—'} />
                    <InfoCard icon={Ruler} label="Room Density" value={`${scopingData.roomDensity}/10`} />
                    <InfoCard icon={Globe} label="BIM Format" value={scopingData.bimDeliverable} />
                    {scopingData.bimVersion && (
                        <InfoCard icon={Globe} label="BIM Version" value={scopingData.bimVersion} />
                    )}
                    {scopingData.estScanDays && (
                        <InfoCard icon={Calendar} label="Est. Scan Days" value={`${scopingData.estScanDays}`} />
                    )}
                    {scopingData.techsPlanned && (
                        <InfoCard icon={Users} label="Techs Planned" value={`${scopingData.techsPlanned}`} />
                    )}
                    {scopingData.pricingTier && (
                        <InfoCard icon={Shield} label="Pricing Tier" value={scopingData.pricingTier} />
                    )}
                    {scopingData.georeferencing && (
                        <InfoCard icon={MapPin} label="Georeferencing" value="Yes" />
                    )}
                </div>
            </div>

            {/* ── Scope Areas ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-400" />
                    Scope Areas ({scopingData.areas.length})
                </h3>
                <div className="space-y-2">
                    {scopingData.areas.map((area) => (
                        <div
                            key={area.id}
                            className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {area.areaName || area.areaType}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {area.squareFootage.toLocaleString()} SF • {area.projectScope} • LOD {area.lod}
                                </p>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                                {area.areaType}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Risk Factors ── */}
            {scopingData.riskFactors.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-semibold text-amber-900">Risk Factors</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {scopingData.riskFactors.map((rf) => (
                            <span
                                key={rf}
                                className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                            >
                                {rf}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Contact ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    Site Contact
                </h3>
                <p className="text-sm font-medium text-gray-800">{scopingData.primaryContactName}</p>
                <div className="flex flex-col gap-1.5 mt-2">
                    <a
                        href={`mailto:${scopingData.email}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        {scopingData.email}
                    </a>
                    {scopingData.contactPhone && (
                        <a
                            href={`tel:${scopingData.contactPhone}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                            <Phone className="w-3.5 h-3.5" />
                            {scopingData.contactPhone}
                        </a>
                    )}
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="grid grid-cols-2 gap-3 pb-4">
                <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(scopingData.projectAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white rounded-xl p-3 text-center text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 touch-manipulation"
                >
                    🧭 Start Navigation
                </a>
                {scopingData.contactPhone && (
                    <a
                        href={`tel:${scopingData.contactPhone}`}
                        className="bg-green-600 text-white rounded-xl p-3 text-center text-sm font-semibold hover:bg-green-700 active:bg-green-800 touch-manipulation"
                    >
                        📞 Call Site Contact
                    </a>
                )}
            </div>
        </div>
    );
}

// ── Info Card Helper ──

function InfoCard({
    icon: Icon,
    label,
    value,
    sublabel,
    highlight,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    sublabel?: string;
    highlight?: boolean;
}) {
    return (
        <div className={cn(
            'rounded-lg p-2.5',
            highlight ? 'bg-blue-50' : 'bg-gray-50',
        )}>
            <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className={cn('w-3.5 h-3.5', highlight ? 'text-blue-500' : 'text-gray-400')} />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
            </div>
            <p className={cn(
                'text-sm font-semibold truncate',
                highlight ? 'text-blue-900' : 'text-gray-900',
            )}>
                {value}
            </p>
            {sublabel && (
                <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
            )}
        </div>
    );
}
