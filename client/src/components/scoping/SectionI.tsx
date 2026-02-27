import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { DISPATCH_LOCATIONS, DISPATCH_ADDRESSES, TRAVEL_MODES } from '@shared/schema/constants';
import { TRAVEL_RATES } from '@/engine/constants';
import { calculateStandardTravel, calculateBrooklynTravel } from '@/engine/pricing';
import { fetchDrivingDistance } from '@/services/api';
import { MapPin, Loader2 } from 'lucide-react';

export function SectionI() {
    const { register, formState: { errors }, watch, setValue } = useFormContext<ScopingFormValues>();
    const [calculating, setCalculating] = useState(false);
    const [driveTime, setDriveTime] = useState<string | null>(null);
    const [distanceError, setDistanceError] = useState<string | null>(null);

    const dispatchLocation = watch('dispatchLocation');
    const oneWayMiles = watch('oneWayMiles') || 0;
    const travelMode = watch('travelMode');
    const mileageRate = watch('mileageRate');
    const scanDayFeeOverride = watch('scanDayFeeOverride');
    const projectAddress = watch('projectAddress' as any);

    // Determine effective rate for preview
    const isBrooklyn = dispatchLocation?.toUpperCase()?.includes('BROOKLYN');
    const effectiveRate = mileageRate ?? (isBrooklyn ? TRAVEL_RATES.brooklyn : TRAVEL_RATES.standard);
    const effectiveScanDayFee = scanDayFeeOverride ?? TRAVEL_RATES.scanDayFee;

    // Calculate travel cost preview
    const travelPreview = oneWayMiles > 0
        ? isBrooklyn
            ? calculateBrooklynTravel(oneWayMiles, 0, mileageRate)
            : calculateStandardTravel(oneWayMiles, mileageRate, scanDayFeeOverride)
        : null;

    const canCalculateDistance = dispatchLocation && dispatchLocation !== 'Other' && projectAddress?.trim();

    async function handleCalculateDistance() {
        if (!canCalculateDistance || calculating) return;

        const originAddress = DISPATCH_ADDRESSES[dispatchLocation] || dispatchLocation;
        if (!originAddress) return;

        setCalculating(true);
        setDistanceError(null);
        setDriveTime(null);

        try {
            const result = await fetchDrivingDistance(originAddress, projectAddress);
            setValue('oneWayMiles', result.distanceMiles, { shouldValidate: true, shouldDirty: true });

            // Format drive time
            const hours = Math.floor(result.durationMinutes / 60);
            const mins = result.durationMinutes % 60;
            const timeStr = hours > 0 ? `~${hours}h ${mins}m drive` : `~${mins}m drive`;
            setDriveTime(timeStr);
        } catch (err: any) {
            console.error('Distance calc error:', err);
            setDistanceError(err.message || 'Could not calculate distance');
        } finally {
            setCalculating(false);
        }
    }

    return (
        <FormSection title="Section I" subtitle="Travel" badge="6 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Dispatch Location" required error={errors.dispatchLocation?.message}>
                    <select {...register('dispatchLocation')} className={selectStyles}>
                        <option value="">Select...</option>
                        {DISPATCH_LOCATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </FormField>

                <FormField label="One-Way Miles to Site" required error={errors.oneWayMiles?.message}>
                    <div className="flex gap-2">
                        <input {...register('oneWayMiles')} type="number" min={0} className={`${inputStyles} flex-1`} placeholder="150" />
                        <button
                            type="button"
                            onClick={handleCalculateDistance}
                            disabled={!canCalculateDistance || calculating}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={!canCalculateDistance ? 'Select a dispatch location and enter a project address first' : 'Calculate driving distance via Google Maps'}
                        >
                            {calculating ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <MapPin size={14} />
                            )}
                            <span className="hidden sm:inline">{calculating ? 'Calculating...' : 'Calculate'}</span>
                        </button>
                    </div>
                    {driveTime && (
                        <p className="text-xs text-green-600 mt-1 font-medium">{driveTime}</p>
                    )}
                    {distanceError && (
                        <p className="text-xs text-red-500 mt-1">{distanceError}</p>
                    )}
                </FormField>

                <FormField label="Travel Mode" required error={errors.travelMode?.message}>
                    <select {...register('travelMode')} className={selectStyles}>
                        <option value="">Select...</option>
                        {TRAVEL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </FormField>

                <FormField label="Custom Travel Cost Override" hint="Overrides calculated travel cost">
                    <input {...register('customTravelCost')} type="number" min={0} step="0.01" className={inputStyles} placeholder="$0.00" />
                </FormField>

                <FormField label="Mileage Rate ($/mi)" hint={`Default: $${isBrooklyn ? TRAVEL_RATES.brooklyn : TRAVEL_RATES.standard}/mi`}>
                    <input {...register('mileageRate')} type="number" min={0} step="0.50" className={inputStyles} placeholder={String(isBrooklyn ? TRAVEL_RATES.brooklyn : TRAVEL_RATES.standard)} />
                </FormField>

                <FormField label="Scan Day Fee ($)" hint={`Default: $${TRAVEL_RATES.scanDayFee} (applies ≥${TRAVEL_RATES.scanDayFeeThreshold} mi)`}>
                    <input {...register('scanDayFeeOverride')} type="number" min={0} step="50" className={inputStyles} placeholder={String(TRAVEL_RATES.scanDayFee)} />
                </FormField>
            </div>

            {/* Travel Cost Preview */}
            {travelPreview && travelPreview.totalCost > 0 && (
                <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">
                        Estimated Travel Cost
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {travelPreview.label}
                    </p>
                    <p className="text-lg font-bold text-blue-600 mt-1">
                        ${travelPreview.totalCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                </div>
            )}
        </FormSection>
    );
}
