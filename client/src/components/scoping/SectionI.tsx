import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { DISPATCH_LOCATIONS, TRAVEL_MODES } from '@shared/schema/constants';

export function SectionI() {
    const { register, formState: { errors } } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section I" subtitle="Travel" badge="4 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Dispatch Location" required error={errors.dispatchLocation?.message}>
                    <select {...register('dispatchLocation')} className={selectStyles}>
                        <option value="">Select...</option>
                        {DISPATCH_LOCATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </FormField>

                <FormField label="One-Way Miles to Site" required error={errors.oneWayMiles?.message}>
                    <input {...register('oneWayMiles')} type="number" min={0} className={inputStyles} placeholder="150" />
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
            </div>
        </FormSection>
    );
}
