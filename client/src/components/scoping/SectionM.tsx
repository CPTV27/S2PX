import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles, textareaStyles } from './FormField';
import { FormSection } from './FormSection';
import { TIMELINE_OPTIONS, PAYMENT_TERMS } from '@shared/schema/constants';

export function SectionM() {
    const { register, formState: { errors } } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section M" subtitle="Timeline & Payment" badge="5 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Est. Timeline" error={errors.estTimeline?.message}>
                    <select {...register('estTimeline')} className={selectStyles}>
                        <option value="">Select...</option>
                        {TIMELINE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </FormField>

                <FormField label="Project Timeline">
                    <select {...register('projectTimeline')} className={selectStyles}>
                        <option value="">Select...</option>
                        {(() => {
                            const currentYear = new Date().getFullYear();
                            const quarters: string[] = [];
                            for (let year = currentYear - 1; year <= currentYear + 1; year++) {
                                for (let q = 1; q <= 4; q++) {
                                    quarters.push(`Q${q} ${year}`);
                                }
                            }
                            return quarters.map(q => <option key={q} value={q}>{q}</option>);
                        })()}
                        <option value="ASAP">ASAP</option>
                        <option value="TBD">TBD</option>
                    </select>
                </FormField>

                <FormField label="Notes on Timeline" className="md:col-span-2">
                    <textarea {...register('timelineNotes')} className={textareaStyles} placeholder="Any timing constraints..." />
                </FormField>

                <FormField label="Payment Terms" error={errors.paymentTerms?.message}>
                    <select {...register('paymentTerms')} className={selectStyles}>
                        <option value="">Select...</option>
                        {PAYMENT_TERMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </FormField>

                <FormField label="Payment Notes">
                    <input {...register('paymentNotes')} className={inputStyles} placeholder="PO required, etc." />
                </FormField>
            </div>
        </FormSection>
    );
}
