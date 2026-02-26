import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { FileUpload } from './FileUpload';
import { BIM_DELIVERABLES } from '@shared/schema/constants';

interface SectionFProps {
    upid?: string;
}

export function SectionF({ upid }: SectionFProps) {
    const { register, watch, setValue, formState: { errors } } = useFormContext<ScopingFormValues>();
    const customTemplate = watch('customTemplate');

    return (
        <FormSection title="Section F" subtitle="Deliverable Format" badge="4 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="BIM Deliverable" required error={errors.bimDeliverable?.message}>
                    <select {...register('bimDeliverable')} className={selectStyles}>
                        <option value="">Select...</option>
                        {BIM_DELIVERABLES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </FormField>

                <FormField label="BIM Version" hint='e.g., "Revit 2024"'>
                    <input {...register('bimVersion')} className={inputStyles} placeholder="Revit 2024" />
                </FormField>

                <FormField label="Custom Template?">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('customTemplate')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Client has a custom Revit/BIM template</span>
                    </label>
                </FormField>

                {customTemplate && upid && (
                    <FormField label="Upload Custom Template">
                        <FileUpload
                            upid={upid}
                            fieldName="template"
                            value={watch('templateFileUrl')}
                            onChange={(url) => setValue('templateFileUrl', url as string, { shouldDirty: true })}
                            accept=".rvt,.rte,.rfa,.dwg,.ifc"
                        />
                    </FormField>
                )}

                <FormField label="Georeferencing?" required>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('georeferencing')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Yes — $1,500/structure</span>
                    </label>
                </FormField>
            </div>
        </FormSection>
    );
}
