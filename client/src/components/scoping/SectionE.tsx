import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, selectStyles, inputStyles } from './FormField';
import { FormSection } from './FormSection';
import { LANDSCAPE_OPTIONS, LANDSCAPE_TERRAIN_TYPES } from '@shared/schema/constants';

export function SectionE() {
    const { register, watch, formState: { errors } } = useFormContext<ScopingFormValues>();
    const landscapeModeling = watch('landscapeModeling');
    const showDetails = landscapeModeling && landscapeModeling !== 'No';

    return (
        <FormSection title="Section E" subtitle="Landscape" badge="3 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Landscape Modeling?">
                    <select {...register('landscapeModeling')} className={selectStyles}>
                        {LANDSCAPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </FormField>

                {showDetails && (
                    <>
                        <FormField label="How many acres?" error={errors.landscapeAcres?.message}>
                            <input {...register('landscapeAcres')} type="number" min={0} step="0.1" className={inputStyles} placeholder="2.5" />
                        </FormField>

                        <FormField label="Landscape Terrain Type">
                            <select {...register('landscapeTerrain')} className={selectStyles}>
                                <option value="">Select terrain...</option>
                                {LANDSCAPE_TERRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </FormField>
                    </>
                )}
            </div>
        </FormSection>
    );
}
