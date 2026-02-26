import { useFormContext, Controller } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { MultiSelect } from './MultiSelect';
import { ERAS, ROOM_DENSITIES, RISK_FACTORS } from '@shared/schema/constants';

export function SectionG() {
    const { register, control, formState: { errors } } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section G" subtitle="Site Conditions" badge="3 fields">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Era" required error={errors.era?.message}>
                        <select {...register('era')} className={selectStyles}>
                            <option value="">Select...</option>
                            {ERAS.map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </FormField>

                    <FormField label="Room Density" required error={errors.roomDensity?.message}>
                        <select {...register('roomDensity')} className={selectStyles}>
                            {ROOM_DENSITIES.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </FormField>
                </div>

                <FormField label="Risk Factors" required error={errors.riskFactors?.message}>
                    <Controller
                        name="riskFactors"
                        control={control}
                        render={({ field }) => (
                            <MultiSelect
                                options={RISK_FACTORS}
                                value={field.value || []}
                                onChange={field.onChange}
                                columns={4}
                            />
                        )}
                    />
                </FormField>
            </div>
        </FormSection>
    );
}
