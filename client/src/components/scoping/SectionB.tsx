import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles } from './FormField';
import { FormSection } from './FormSection';

export function SectionB() {
    const { register, watch, formState: { errors } } = useFormContext<ScopingFormValues>();
    const billingSameAsPrimary = watch('billingSameAsPrimary');

    return (
        <FormSection title="Section B" subtitle="Contacts" badge="7 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Primary Contact Name" required error={errors.primaryContactName?.message}>
                    <input {...register('primaryContactName')} className={inputStyles} placeholder="John Doe" />
                </FormField>

                <FormField label="Contact Email" required error={errors.contactEmail?.message}>
                    <input {...register('contactEmail')} type="email" className={inputStyles} placeholder="john@example.com" />
                </FormField>

                <FormField label="Contact Phone" error={errors.contactPhone?.message}>
                    <input {...register('contactPhone')} type="tel" className={inputStyles} placeholder="(555) 123-4567" />
                </FormField>

                <FormField label="Billing Contact">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('billingSameAsPrimary')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Same as Primary Contact</span>
                    </label>
                </FormField>
            </div>

            {!billingSameAsPrimary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <FormField label="Billing Contact Name" error={errors.billingContactName?.message}>
                        <input {...register('billingContactName')} className={inputStyles} placeholder="Jane Smith" />
                    </FormField>

                    <FormField label="Billing Email" error={errors.billingEmail?.message}>
                        <input {...register('billingEmail')} type="email" className={inputStyles} placeholder="billing@example.com" />
                    </FormField>

                    <FormField label="Billing Phone" error={errors.billingPhone?.message}>
                        <input {...register('billingPhone')} type="tel" className={inputStyles} placeholder="(555) 987-6543" />
                    </FormField>
                </div>
            )}
        </FormSection>
    );
}
