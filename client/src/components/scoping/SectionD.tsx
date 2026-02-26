import { Plus } from 'lucide-react';
import { FormSection } from './FormSection';
import { ScopeAreaBlock } from './ScopeAreaBlock';
import type { FieldArrayWithId } from 'react-hook-form';
import type { ScopingFormValues } from '@/hooks/useScopingForm';

interface SectionDProps {
    areaFields: FieldArrayWithId<ScopingFormValues, 'areas', 'id'>[];
    addArea: () => void;
    removeAreaAt: (index: number) => void;
    cloneArea: (index: number) => void;
}

export function SectionD({ areaFields, addArea, removeAreaAt, cloneArea }: SectionDProps) {
    return (
        <FormSection
            title="Section D"
            subtitle="Scope Areas"
            badge={`${areaFields.length} area${areaFields.length !== 1 ? 's' : ''}`}
            defaultOpen
        >
            <div className="space-y-4">
                {areaFields.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                        No scope areas added yet. Click below to add one.
                    </div>
                )}

                {areaFields.map((field, index) => (
                    <ScopeAreaBlock
                        key={field.id}
                        index={index}
                        onRemove={() => removeAreaAt(index)}
                        onClone={() => cloneArea(index)}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => addArea()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                    <Plus size={16} />
                    Add Scope Area
                </button>
            </div>
        </FormSection>
    );
}
