import { useFormContext, Controller } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles } from './FormField';
import { FormSection } from './FormSection';
import { MultiSelect } from './MultiSelect';
import { BASEMENT_ATTIC_OPTIONS } from '@shared/schema/constants';

export function SectionC() {
    const { register, control, watch, formState: { errors } } = useFormContext<ScopingFormValues>();
    const basementAttic = watch('basementAttic') || [];
    const hasBasementOrAttic = basementAttic.length > 0 && !basementAttic.includes('Neither');

    return (
        <FormSection title="Section C" subtitle="Building Characteristics" badge="4 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Number of Floors" required error={errors.numberOfFloors?.message}>
                    <input {...register('numberOfFloors')} type="number" min={1} className={inputStyles} />
                </FormField>

                <FormField label="Basement / Attic" required>
                    <Controller
                        name="basementAttic"
                        control={control}
                        render={({ field }) => (
                            <MultiSelect
                                options={BASEMENT_ATTIC_OPTIONS}
                                value={field.value || []}
                                onChange={field.onChange}
                                columns={3}
                            />
                        )}
                    />
                </FormField>

                {hasBasementOrAttic && (
                    <FormField label="Est. SF of Basement / Attic" error={errors.estSfBasementAttic?.message}>
                        <input {...register('estSfBasementAttic')} type="number" min={0} className={inputStyles} placeholder="5,000" />
                    </FormField>
                )}

                <FormField label="Insurance Requirements" error={errors.insuranceRequirements?.message} className="md:col-span-2">
                    <input {...register('insuranceRequirements')} className={inputStyles} placeholder="COI, additional insured, etc." />
                </FormField>
            </div>
        </FormSection>
    );
}
