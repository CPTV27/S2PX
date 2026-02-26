import { useEffect, useRef, useCallback, useState } from 'react';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    createScopingForm,
    updateScopingForm,
    fetchScopingForm,
    addScopeArea,
    updateScopeArea,
    deleteScopeArea,
    type ScopingFormData,
    type ScopeAreaData,
} from '@/services/api';

// ── Zod schema for the form (client-side validation) ──
const scopeAreaSchema = z.object({
    id: z.number().optional(),
    areaType: z.string().min(1, 'Required'),
    areaName: z.string().optional().default(''),
    squareFootage: z.coerce.number().int().positive('Must be > 0'),
    projectScope: z.string().min(1, 'Required'),
    lod: z.string().min(1, 'Required'),
    mixedInteriorLod: z.string().optional().default(''),
    mixedExteriorLod: z.string().optional().default(''),
    structural: z.object({ enabled: z.boolean(), sqft: z.coerce.number().optional() }).default({ enabled: false }),
    mepf: z.object({ enabled: z.boolean(), sqft: z.coerce.number().optional() }).default({ enabled: false }),
    cadDeliverable: z.string().min(1, 'Required'),
    act: z.object({ enabled: z.boolean(), sqft: z.coerce.number().optional() }).default({ enabled: false }),
    belowFloor: z.object({ enabled: z.boolean(), sqft: z.coerce.number().optional() }).default({ enabled: false }),
    customLineItems: z.array(z.object({ description: z.string(), amount: z.coerce.number() })).optional().default([]),
    sortOrder: z.number().optional(),
});

export const scopingFormSchema = z.object({
    // Section A
    clientCompany: z.string().min(1, 'Required'),
    projectName: z.string().min(1, 'Required'),
    projectAddress: z.string().min(1, 'Required'),
    specificBuilding: z.string().optional().default(''),
    email: z.string().email('Valid email required'),
    // Section B
    primaryContactName: z.string().min(1, 'Required'),
    contactEmail: z.string().email('Valid email required'),
    contactPhone: z.string().optional().default(''),
    billingSameAsPrimary: z.boolean().default(true),
    billingContactName: z.string().optional().default(''),
    billingEmail: z.string().optional().default(''),
    billingPhone: z.string().optional().default(''),
    // Section C
    numberOfFloors: z.coerce.number().int().positive('Must be > 0'),
    basementAttic: z.array(z.string()).default([]),
    estSfBasementAttic: z.coerce.number().int().optional(),
    insuranceRequirements: z.string().optional().default(''),
    // Section D — areas
    areas: z.array(scopeAreaSchema).default([]),
    // Section E
    landscapeModeling: z.string().default('No'),
    landscapeAcres: z.coerce.number().optional(),
    landscapeTerrain: z.string().optional().default(''),
    // Section F
    bimDeliverable: z.string().min(1, 'Required'),
    bimVersion: z.string().optional().default(''),
    customTemplate: z.boolean().default(false),
    templateFileUrl: z.string().optional().default(''),
    georeferencing: z.boolean(),
    // Section G
    era: z.string().min(1, 'Required'),
    roomDensity: z.coerce.number().int().min(0).max(4),
    riskFactors: z.array(z.string()).default([]),
    // Section H
    scanRegOnly: z.string().default('none'),
    expedited: z.boolean(),
    // Section I
    dispatchLocation: z.string().min(1, 'Required'),
    oneWayMiles: z.coerce.number().int().min(0),
    travelMode: z.string().min(1, 'Required'),
    customTravelCost: z.coerce.number().optional(),
    // Section M
    estTimeline: z.string().optional().default(''),
    projectTimeline: z.string().optional().default(''),
    timelineNotes: z.string().optional().default(''),
    paymentTerms: z.string().optional().default(''),
    paymentNotes: z.string().optional().default(''),
    // Section N
    sfAssumptionsUrl: z.string().optional().default(''),
    sqftAssumptionsNote: z.string().optional().default(''),
    scopingDocsUrls: z.array(z.string()).default([]),
    internalNotes: z.string().optional().default(''),
    customScope: z.string().optional().default(''),
    // Section O
    leadSource: z.string().min(1, 'Required'),
    sourceNote: z.string().optional().default(''),
    marketingInfluence: z.array(z.string()).default([]),
    proofLinks: z.string().optional().default(''),
    probability: z.coerce.number().int().min(0).max(100),
    dealStage: z.string().min(1, 'Required'),
    priority: z.coerce.number().int().min(1).max(5),
});

export type ScopingFormValues = z.infer<typeof scopingFormSchema>;

// Default empty area
export const emptyArea: z.infer<typeof scopeAreaSchema> = {
    areaType: '',
    areaName: '',
    squareFootage: 0,
    projectScope: '',
    lod: '',
    mixedInteriorLod: '',
    mixedExteriorLod: '',
    structural: { enabled: false },
    mepf: { enabled: false },
    cadDeliverable: '',
    act: { enabled: false },
    belowFloor: { enabled: false },
    customLineItems: [],
};

// ── Autosave status ──
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── Hook ──
export function useScopingForm(formId?: number) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [serverForm, setServerForm] = useState<ScopingFormData | null>(null);
    const [loading, setLoading] = useState(!!formId);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const isCreatingRef = useRef(false);

    const form = useForm<ScopingFormValues>({
        resolver: zodResolver(scopingFormSchema),
        defaultValues: {
            clientCompany: '',
            projectName: '',
            projectAddress: '',
            specificBuilding: '',
            email: '',
            primaryContactName: '',
            contactEmail: '',
            contactPhone: '',
            billingSameAsPrimary: true,
            billingContactName: '',
            billingEmail: '',
            billingPhone: '',
            numberOfFloors: 1,
            basementAttic: [],
            insuranceRequirements: '',
            areas: [],
            landscapeModeling: 'No',
            landscapeTerrain: '',
            bimDeliverable: '',
            bimVersion: '',
            customTemplate: false,
            templateFileUrl: '',
            georeferencing: false,
            era: '',
            roomDensity: 2,
            riskFactors: [],
            scanRegOnly: 'none',
            expedited: false,
            dispatchLocation: '',
            oneWayMiles: 0,
            travelMode: '',
            estTimeline: '',
            projectTimeline: '',
            timelineNotes: '',
            paymentTerms: '',
            paymentNotes: '',
            sfAssumptionsUrl: '',
            sqftAssumptionsNote: '',
            scopingDocsUrls: [],
            internalNotes: '',
            customScope: '',
            leadSource: '',
            sourceNote: '',
            marketingInfluence: [],
            proofLinks: '',
            probability: 50,
            dealStage: 'Lead',
            priority: 3,
        },
        mode: 'onBlur',
    });

    const { fields: areaFields, append: appendArea, remove: removeArea } = useFieldArray({
        control: form.control,
        name: 'areas',
    });

    // Load existing form
    useEffect(() => {
        if (!formId) {
            setLoading(false);
            return;
        }

        fetchScopingForm(formId)
            .then((data) => {
                setServerForm(data);
                const { areas, ...rest } = data;
                form.reset({
                    ...rest,
                    areas: areas || [],
                    numberOfFloors: rest.numberOfFloors || 1,
                    roomDensity: rest.roomDensity ?? 2,
                    probability: rest.probability ?? 50,
                    priority: rest.priority ?? 3,
                    riskFactors: rest.riskFactors || [],
                    basementAttic: rest.basementAttic || [],
                    scopingDocsUrls: rest.scopingDocsUrls || [],
                    marketingInfluence: rest.marketingInfluence || [],
                } as ScopingFormValues);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [formId]);

    // Autosave: 2-second debounce on dirty fields
    const autosave = useCallback(async () => {
        if (!serverForm?.id) return;
        const dirtyFields = form.formState.dirtyFields;
        if (Object.keys(dirtyFields).length === 0) return;

        // Build partial payload from dirty fields only
        const values = form.getValues();
        const payload: Record<string, any> = {};
        for (const key of Object.keys(dirtyFields)) {
            if (key === 'areas') continue; // Areas saved separately
            payload[key] = (values as any)[key];
        }

        if (Object.keys(payload).length === 0) return;

        setSaveStatus('saving');
        try {
            const updated = await updateScopingForm(serverForm.id, payload);
            setServerForm(prev => prev ? { ...prev, ...updated } : updated);
            setSaveStatus('saved');
            // Reset dirty state for saved fields
            form.reset(form.getValues(), { keepValues: true });
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Autosave failed:', err);
            setSaveStatus('error');
        }
    }, [serverForm?.id, form]);

    // Watch all fields and debounce autosave
    useEffect(() => {
        if (!serverForm?.id) return;

        const subscription = form.watch(() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(autosave, 2000);
        });

        return () => {
            subscription.unsubscribe();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [serverForm?.id, autosave, form]);

    // Reconnect: save dirty fields on window focus
    useEffect(() => {
        const handleFocus = () => {
            if (serverForm?.id && Object.keys(form.formState.dirtyFields).length > 0) {
                autosave();
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [serverForm?.id, autosave, form]);

    // Create form (initial save)
    const createForm = useCallback(async (values: ScopingFormValues) => {
        if (isCreatingRef.current) return null;
        isCreatingRef.current = true;
        setSaveStatus('saving');

        try {
            const { areas, ...formData } = values;
            const created = await createScopingForm(formData);
            setServerForm(created);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            return created;
        } catch (err) {
            console.error('Create failed:', err);
            setSaveStatus('error');
            return null;
        } finally {
            isCreatingRef.current = false;
        }
    }, []);

    // Area CRUD operations
    const addArea = useCallback(async (area?: Partial<z.infer<typeof scopeAreaSchema>>) => {
        const newArea = { ...emptyArea, ...area, sortOrder: areaFields.length };

        if (serverForm?.id) {
            try {
                const created = await addScopeArea(serverForm.id, newArea);
                appendArea({ ...newArea, id: created.id });
            } catch (err) {
                console.error('Add area failed:', err);
                appendArea(newArea); // Optimistic
            }
        } else {
            appendArea(newArea);
        }
    }, [serverForm?.id, areaFields.length, appendArea]);

    const removeAreaAt = useCallback(async (index: number) => {
        const area = areaFields[index] as any;
        if (serverForm?.id && area?.id) {
            try {
                await deleteScopeArea(serverForm.id, area.id);
            } catch (err) {
                console.error('Delete area failed:', err);
            }
        }
        removeArea(index);
    }, [serverForm?.id, areaFields, removeArea]);

    const cloneArea = useCallback((index: number) => {
        const values = form.getValues(`areas.${index}`);
        addArea({ ...values, id: undefined, areaName: `${values.areaName || values.areaType} (Copy)` });
    }, [form, addArea]);

    return {
        form,
        areaFields,
        addArea,
        removeAreaAt,
        cloneArea,
        saveStatus,
        serverForm,
        loading,
        createForm,
    };
}
