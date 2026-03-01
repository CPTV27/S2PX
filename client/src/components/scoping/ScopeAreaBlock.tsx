import { useFormContext, Controller } from 'react-hook-form';
import { Trash2, Copy } from 'lucide-react';
import type { ScopingFormValues } from '@/hooks/useScopingForm';
import { FormField, inputStyles, selectStyles } from './FormField';
import { BUILDING_TYPES, PROJECT_SCOPES, LOD_LEVELS, CAD_OPTIONS } from '@shared/schema/constants';

interface ScopeAreaBlockProps {
    index: number;
    onRemove: () => void;
    onClone: () => void;
}

function ToggleSqft({ name, label }: { name: string; label: string }) {
    const { register, watch } = useFormContext<ScopingFormValues>();
    const enabled = watch(`${name}.enabled` as any);

    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    {...register(`${name}.enabled` as any)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">{label}</span>
            </label>
            {enabled && (
                <input
                    {...register(`${name}.sqft` as any)}
                    type="number"
                    min={0}
                    className={inputStyles}
                    placeholder="Square footage"
                />
            )}
        </div>
    );
}

export function ScopeAreaBlock({ index, onRemove, onClone }: ScopeAreaBlockProps) {
    const { register, watch, formState: { errors } } = useFormContext<ScopingFormValues>();
    const prefix = `areas.${index}` as const;
    const areaErrors = errors.areas?.[index];
    const projectScope = watch(`${prefix}.projectScope`);
    const areaType = watch(`${prefix}.areaType`);
    const areaName = watch(`${prefix}.areaName`);

    const displayName = areaName || areaType || `Area ${index + 1}`;

    return (
        <div className="border border-slate-200 rounded-xl bg-white p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                    {displayName}
                    <span className="text-slate-400 font-normal ml-2">#{index + 1}</span>
                </h4>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={onClone} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title="Clone area">
                        <Copy size={14} />
                    </button>
                    <button type="button" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Remove area">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Row 1: Type, Name, Sqft */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Area Type" required error={areaErrors?.areaType?.message}>
                    <select {...register(`${prefix}.areaType`)} className={selectStyles}>
                        <option value="">Select type...</option>
                        {BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </FormField>

                <FormField label="Area Name" hint="Defaults to type name">
                    <input {...register(`${prefix}.areaName`)} className={inputStyles} placeholder="Main Building" />
                </FormField>

                <FormField label="Square Footage" required error={areaErrors?.squareFootage?.message}>
                    <input {...register(`${prefix}.squareFootage`)} type="number" min={1} className={inputStyles} placeholder="25,000" />
                </FormField>
            </div>

            {/* Row 2: Scope + LoD */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Project Scope" required error={areaErrors?.projectScope?.message}>
                    <select {...register(`${prefix}.projectScope`)} className={selectStyles}>
                        <option value="">Select scope...</option>
                        {PROJECT_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>

                <FormField label="Level of Detail (LoD)" required error={areaErrors?.lod?.message}>
                    <select {...register(`${prefix}.lod`)} className={selectStyles}>
                        <option value="">Select LoD...</option>
                        {LOD_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </FormField>

                <FormField label="CAD Deliverable" required error={areaErrors?.cadDeliverable?.message}>
                    <select {...register(`${prefix}.cadDeliverable`)} className={selectStyles}>
                        <option value="">Select...</option>
                        {CAD_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </FormField>
            </div>

            {/* Mixed Scope LoD (conditional) */}
            {projectScope === 'Mixed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <FormField label="Mixed Scope — Interior LoD" required>
                        <select {...register(`${prefix}.mixedInteriorLod`)} className={selectStyles}>
                            <option value="">Select LoD...</option>
                            {LOD_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </FormField>

                    <FormField label="Mixed Scope — Exterior LoD" required>
                        <select {...register(`${prefix}.mixedExteriorLod`)} className={selectStyles}>
                            <option value="">Select LoD...</option>
                            {LOD_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </FormField>
                </div>
            )}

            {/* Row 3: Discipline toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ToggleSqft name={`${prefix}.structural`} label="Structural" />
                <ToggleSqft name={`${prefix}.mepf`} label="MEPF" />
                <ToggleSqft name={`${prefix}.act`} label="ACT (Above Ceiling)" />
                <ToggleSqft name={`${prefix}.belowFloor`} label="Below Floor" />
                <ToggleSqft name={`${prefix}.site`} label="Site / Civil" />
                <ToggleSqft name={`${prefix}.matterport`} label="Matterport" />
            </div>
        </div>
    );
}
