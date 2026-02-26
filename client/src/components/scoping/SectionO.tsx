import { useFormContext, Controller } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { MultiSelect } from './MultiSelect';
import { LEAD_SOURCES, DEAL_STAGES, PRIORITIES } from '@shared/schema/constants';

export function SectionO() {
    const { register, control, watch, setValue, formState: { errors } } = useFormContext<ScopingFormValues>();
    const probability = watch('probability');

    return (
        <FormSection title="Section O" subtitle="Attribution & Pipeline" badge="7 fields">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Lead Source" required error={errors.leadSource?.message}>
                        <select {...register('leadSource')} className={selectStyles}>
                            <option value="">Select source...</option>
                            {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FormField>

                    <FormField label="Source Note">
                        <input {...register('sourceNote')} className={inputStyles} placeholder="Additional context..." />
                    </FormField>
                </div>

                <FormField label="Marketing Influence" hint="Select all that apply">
                    <Controller
                        name="marketingInfluence"
                        control={control}
                        render={({ field }) => (
                            <MultiSelect
                                options={LEAD_SOURCES}
                                value={field.value || []}
                                onChange={field.onChange}
                                columns={4}
                            />
                        )}
                    />
                </FormField>

                <FormField label="Proof Links">
                    <input {...register('proofLinks')} className={inputStyles} placeholder="Links to proof vault, case studies, etc." />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label={`Probability of Closing: ${probability}%`} required error={errors.probability?.message}>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            {...register('probability')}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </FormField>

                    <FormField label="Deal Stage" required error={errors.dealStage?.message}>
                        <select {...register('dealStage')} className={selectStyles}>
                            <option value="">Select stage...</option>
                            {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FormField>

                    <FormField label="Priority" required error={errors.priority?.message}>
                        <select {...register('priority')} className={selectStyles}>
                            {PRIORITIES.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </FormField>
                </div>
            </div>
        </FormSection>
    );
}
