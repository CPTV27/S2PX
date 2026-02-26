import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, textareaStyles } from './FormField';
import { FormSection } from './FormSection';
import { FileUpload } from './FileUpload';

interface SectionNProps {
    upid?: string;
}

export function SectionN({ upid }: SectionNProps) {
    const { register, watch, setValue } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section N" subtitle="Documentation" badge="5 fields">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Upload SF Assumptions" required hint="Screenshots of sqft sources">
                        {upid ? (
                            <FileUpload
                                upid={upid}
                                fieldName="sf-assumptions"
                                value={watch('sfAssumptionsUrl')}
                                onChange={(url) => setValue('sfAssumptionsUrl', url as string, { shouldDirty: true })}
                                accept="image/*,.pdf"
                            />
                        ) : (
                            <p className="text-xs text-slate-400 italic">Save the form first to enable uploads</p>
                        )}
                    </FormField>

                    <FormField label="Assumptions on SqFt Estimate">
                        <textarea {...register('sqftAssumptionsNote')} className={textareaStyles} placeholder="How sqft was estimated..." />
                    </FormField>
                </div>

                <FormField label="Upload Scoping Documents" hint="NDA, RFP, floor plans, etc.">
                    {upid ? (
                        <FileUpload
                            upid={upid}
                            fieldName="scoping-docs"
                            value={watch('scopingDocsUrls')}
                            onChange={(urls) => setValue('scopingDocsUrls', urls as string[], { shouldDirty: true })}
                            multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.rvt,image/*"
                        />
                    ) : (
                        <p className="text-xs text-slate-400 italic">Save the form first to enable uploads</p>
                    )}
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Internal Notes">
                        <textarea {...register('internalNotes')} className={textareaStyles} placeholder="Internal team notes..." />
                    </FormField>

                    <FormField label="Custom Scope / Special Priorities">
                        <textarea {...register('customScope')} className={textareaStyles} placeholder="Any special requirements..." />
                    </FormField>
                </div>
            </div>
        </FormSection>
    );
}
