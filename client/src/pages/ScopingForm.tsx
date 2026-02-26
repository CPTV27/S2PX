import { useParams, useNavigate } from 'react-router-dom';
import { FormProvider } from 'react-hook-form';
import { ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useScopingForm, type SaveStatus } from '@/hooks/useScopingForm';
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

    const handleInitialSave = async () => {
        const valid = await form.trigger();
        if (!valid) return;

        const values = form.getValues();
        const created = await createForm(values);
        if (created?.id) {
            navigate(`/dashboard/scoping/${created.id}`, { replace: true });
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

                    <div className="flex items-center gap-4">
                        <SaveIndicator status={saveStatus} />

                        {isNew && (
                            <button
                                type="button"
                                onClick={handleInitialSave}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                <Save size={16} />
                                Create & Save
                            </button>
                        )}

                        {serverForm && (
                            <div className="text-xs text-slate-400">
                                Status: <span className="font-medium text-slate-600 capitalize">{serverForm.status}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form Sections */}
                <div className="space-y-3">
                    <SectionA upid={upid} />
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
            </div>
        </FormProvider>
    );
}
