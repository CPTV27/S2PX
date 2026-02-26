import { useFormContext } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, selectStyles } from './FormField';
import { FormSection } from './FormSection';
import { SCAN_REG_OPTIONS } from '@shared/schema/constants';

export function SectionH() {
    const { register, formState: { errors } } = useFormContext<ScopingFormValues>();

    return (
        <FormSection title="Section H" subtitle="Additional Services" badge="2 fields">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Scanning & Registration Only">
                    <select {...register('scanRegOnly')} className={selectStyles}>
                        {SCAN_REG_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </FormField>

                <FormField label="Expedited Service" required hint="+20% of BIM + add-ons, not travel">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            {...register('expedited')}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">Yes — Rush delivery</span>
                    </label>
                </FormField>
            </div>
        </FormSection>
    );
}
