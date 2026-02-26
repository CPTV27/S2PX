import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles } from './FormField';
import { FormSection } from './FormSection';

interface SectionAProps {
    upid?: string;
}

export function SectionA({ upid }: SectionAProps) {
    const { register, formState: { errors } } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section A" subtitle="Project Identification" badge="6 fields" defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Client / Company" required error={errors.clientCompany?.message}>
                    <input {...register('clientCompany')} className={inputStyles} placeholder="Acme Corp" />
                </FormField>

                <FormField label="Project Name" required error={errors.projectName?.message}>
                    <input {...register('projectName')} className={inputStyles} placeholder="HQ Renovation" />
                </FormField>

                <FormField label="Project Address" required error={errors.projectAddress?.message} className="md:col-span-2">
                    <input {...register('projectAddress')} className={inputStyles} placeholder="123 Main St, Troy, NY 12180" />
                </FormField>

                <FormField label="Specific Building or Unit" error={errors.specificBuilding?.message}>
                    <input {...register('specificBuilding')} className={inputStyles} placeholder="Building A, Suite 200" />
                </FormField>

                <FormField label="Email" required error={errors.email?.message}>
                    <input {...register('email')} type="email" className={inputStyles} placeholder="client@example.com" />
                </FormField>
            </div>

            {upid && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">UPID</span>
                    <span className="text-sm font-mono font-semibold text-blue-600">{upid}</span>
                </div>
            )}
        </FormSection>
    );
}
