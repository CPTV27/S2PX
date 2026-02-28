import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormProvider } from 'react-hook-form';
import { ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle, Banknote, FileText, ChevronRight, ArrowRight, ClipboardList, DollarSign, Send } from 'lucide-react';
import { useScopingForm, type SaveStatus } from '@/hooks/useScopingForm';
import { PropertyMap } from '@/components/PropertyMap';
import { SectionA } from '@/components/scoping/SectionA';
import { SectionB } from '@/components/scoping/SectionB';
import { SectionC } from '@/components/scoping/SectionC';
import { SectionD } from '@/components/scoping/SectionD';
import { SectionE } from '@/components/scoping/SectionE';
import { SectionF } from '@/components/scoping/SectionF';
import { SectionG } from '@/components/scoping/SectionG';
import { SectionH } from '@/components/scoping/SectionH';
import { SectionI } from '@/components/scoping/SectionI';
import { SectionM } from '@/components/scoping/SectionM';
import { SectionN } from '@/components/scoping/SectionN';
import { SectionO } from '@/components/scoping/SectionO';
import { cn } from '@/lib/utils';

function SaveIndicator({ status }: { status: SaveStatus }) {
    if (status === 'idle') return null;

    return (
        <div className={cn(
            'flex items-center gap-1.5 text-xs font-mono transition-opacity',
            status === 'saving' && 'text-blue-500',
            status === 'saved' && 'text-green-500',
            status === 'error' && 'text-red-500',
        )}>
            {status === 'saving' && <><Loader2 size={12} className="animate-spin" /> Saving...</>}
            {status === 'saved' && <><CheckCircle2 size={12} /> Saved</>}
            {status === 'error' && <><AlertCircle size={12} /> Save failed</>}
        </div>
    );
}

export function ScopingForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const formId = id ? parseInt(id, 10) : undefined;

    const {
        form,
        areaFields,
        addArea,
        removeAreaAt,
        cloneArea,
        saveStatus,
        serverForm,
        loading,
        createForm,
    } = useScopingForm(formId);

    const isNew = !formId;
    const upid = serverForm?.upid;

    const [createError, setCreateError] = useState<string | null>(null);

    const handleInitialSave = async () => {
        setCreateError(null);
        const valid = await form.trigger();
        if (!valid) {
            // Scroll to the first field with an error
            const firstError = Object.keys(form.formState.errors)[0];
            if (firstError) {
                const el = document.querySelector(`[name="${firstError}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setCreateError('Please fix the highlighted fields before saving.');
            return;
        }

        try {
            const values = form.getValues();
            const created = await createForm(values);
            if (created?.id) {
                navigate(`/dashboard/scoping/${created.id}`, { replace: true });
            } else {
                setCreateError('Save failed — please try again.');
            }
        } catch (err: any) {
            console.error('Create form error:', err);
            setCreateError(err.message || 'Save failed — please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <FormProvider {...form}>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard/scoping')}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">
                                {isNew ? 'New Scoping Form' : `Scoping Form`}
                            </h1>
                            {upid && (
                                <p className="text-xs font-mono text-blue-600 mt-0.5">{upid}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <SaveIndicator status={saveStatus} />

                        {isNew && (
                            <button
                                type="button"
                                onClick={handleInitialSave}
                                disabled={saveStatus === 'saving'}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saveStatus === 'saving' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Save size={16} />
                                )}
                                {saveStatus === 'saving' ? 'Saving...' : 'Create & Save'}
                            </button>
                        )}

                        {serverForm && (
                            <div className="text-xs text-slate-400">
                                Status: <span className="font-medium text-slate-600 capitalize">{serverForm.status}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Validation / save error banner */}
                {createError && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{createError}</span>
                        <button
                            type="button"
                            onClick={() => setCreateError(null)}
                            className="ml-auto text-red-400 hover:text-red-600 text-xs"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* ── Workflow Banner — NEXT STEPS ── */}
                {!isNew && (
                    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-2xl p-5">
                        {/* Step indicators */}
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                <ClipboardList size={12} />
                                <span>1. Scope</span>
                            </div>
                            <ArrowRight size={14} className="text-slate-300" />
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                                <DollarSign size={12} />
                                <span>2. Price</span>
                            </div>
                            <ArrowRight size={14} className="text-slate-300" />
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                                <FileText size={12} />
                                <span>3. Proposal</span>
                            </div>
                            <ArrowRight size={14} className="text-slate-300" />
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                                <Send size={12} />
                                <span>4. Send</span>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Ready to price this deal?</p>
                                <p className="text-xs text-slate-500 mt-0.5">Click below to generate line items and build a quote from your scoping data.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate(`/dashboard/deals/${formId}`)}
                                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 shrink-0 ml-4"
                            >
                                <Banknote size={18} />
                                Price this Deal
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Form Sections */}
                <div className="space-y-3">
                    <SectionA upid={upid} />

                    {/* Property Satellite View — shows after form is saved with an address */}
                    {!isNew && serverForm?.projectAddress && (
                        <PropertyMap
                            address={serverForm.projectAddress}
                            lat={serverForm.projectLat ? Number(serverForm.projectLat) : null}
                            lng={serverForm.projectLng ? Number(serverForm.projectLng) : null}
                            footprintSqft={serverForm.buildingFootprintSqft}
                            scopingFormId={formId}
                            height={250}
                            showFootprint
                            className="rounded-2xl"
                        />
                    )}

                    <SectionB />
                    <SectionC />
                    <SectionD
                        areaFields={areaFields}
                        addArea={addArea}
                        removeAreaAt={removeAreaAt}
                        cloneArea={cloneArea}
                    />
                    <SectionE />
                    <SectionF upid={upid} />
                    <SectionG />
                    <SectionH />
                    <SectionI />
                    <SectionM />
                    <SectionN upid={upid} />
                    <SectionO />
                </div>

                {/* Sticky action bar at bottom */}
                {!isNew && (
                    <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                            <SaveIndicator status={saveStatus} />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(`/dashboard/deals/${formId}`)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                            >
                                <Banknote size={16} />
                                Price this Deal
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </FormProvider>
    );
}
