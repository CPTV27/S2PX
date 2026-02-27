import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Save, Loader2, CheckCircle, FileText, ArrowLeft, Eye, EyeOff, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    fetchActiveProposalTemplate,
    updateProposalTemplate,
    type ProposalTemplateData,
    type SectionVisibility,
} from '@/services/api';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type TemplateFields = Omit<ProposalTemplateData, 'id' | 'name' | 'isActive' | 'createdAt' | 'updatedAt' | 'sectionVisibility'>;

interface SectionField {
    key: keyof TemplateFields;
    label: string;
    description: string;
    rows: number;
    isTextarea: true;
    visibilityKey?: string;
    pdfPage: string;
}

interface InputField {
    key: keyof TemplateFields;
    label: string;
    description: string;
    placeholder: string;
    isTextarea: false;
}

// ── Field Definitions ────────────────────────────────────────────────────────

const TEXTAREA_SECTIONS: SectionField[] = [
    {
        key: 'aboutScan2plan',
        label: 'About Scan2Plan',
        description: 'Company overview paragraph shown in proposal introductions.',
        rows: 10,
        isTextarea: true,
        visibilityKey: 'aboutScan2plan',
        pdfPage: 'Page 2',
    },
    {
        key: 'whyScan2plan',
        label: 'Why Scan2Plan?',
        description: 'Value proposition copy used in the proposal body.',
        rows: 10,
        isTextarea: true,
        visibilityKey: 'whyScan2plan',
        pdfPage: 'Page 2',
    },
    {
        key: 'capabilities',
        label: 'Capabilities',
        description: 'Services and technology capabilities listed in the proposal.',
        rows: 10,
        isTextarea: true,
        visibilityKey: 'capabilities',
        pdfPage: 'Page 8',
    },
    {
        key: 'difference',
        label: 'The Scan2Plan Difference',
        description: 'Differentiator section highlighting what sets Scan2Plan apart.',
        rows: 10,
        isTextarea: true,
        visibilityKey: 'difference',
        pdfPage: 'Page 9',
    },
    {
        key: 'bimStandardsIntro',
        label: 'BIM Standards Intro',
        description: 'Introductory copy that precedes the BIM standards table.',
        rows: 8,
        isTextarea: true,
        visibilityKey: 'bimStandards',
        pdfPage: 'Pages 10-11',
    },
    {
        key: 'paymentTermsDefault',
        label: 'Payment Terms Default',
        description: 'Default payment terms boilerplate appended to every proposal.',
        rows: 6,
        isTextarea: true,
        pdfPage: 'Page 7',
    },
    {
        key: 'sfAuditClause',
        label: 'SF Audit Clause',
        description: 'Square footage audit clause included in proposals with SF assumptions.',
        rows: 6,
        isTextarea: true,
        pdfPage: 'Page 7',
    },
    {
        key: 'footerText',
        label: 'Footer Text',
        description: 'Text displayed in the PDF footer on every page.',
        rows: 4,
        isTextarea: true,
        pdfPage: 'All pages',
    },
];

const INPUT_FIELDS: InputField[] = [
    {
        key: 'contactEmail',
        label: 'Contact Email',
        description: 'Primary contact email printed on proposal cover and footer.',
        placeholder: 'proposals@scan2plan.com',
        isTextarea: false,
    },
    {
        key: 'contactPhone',
        label: 'Contact Phone',
        description: 'Primary contact phone number printed on proposals.',
        placeholder: '(555) 000-0000',
        isTextarea: false,
    },
];

// ── Template Variables ───────────────────────────────────────────────────────

const TEMPLATE_VARIABLES = [
    { variable: '{{projectName}}', description: 'Project name from scoping form' },
    { variable: '{{clientCompany}}', description: 'Client company name' },
    { variable: '{{contactName}}', description: 'Primary contact name' },
    { variable: '{{upid}}', description: 'Unique project identifier' },
    { variable: '{{totalPrice}}', description: 'Total investment amount' },
    { variable: '{{squareFeet}}', description: 'Total square footage' },
    { variable: '{{buildingType}}', description: 'Building type classification' },
    { variable: '{{floors}}', description: 'Number of floors' },
    { variable: '{{lod}}', description: 'Level of Development' },
    { variable: '{{deliverable}}', description: 'BIM deliverable format' },
    { variable: '{{version}}', description: 'Proposal version number' },
    { variable: '{{date}}', description: 'Proposal generation date' },
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FieldLabel({ label, description, pdfPage }: { label: string; description: string; pdfPage?: string }) {
    return (
        <div className="mb-2 flex-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    {label}
                </span>
                {pdfPage && (
                    <span className="text-[10px] font-medium text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded">
                        {pdfPage}
                    </span>
                )}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">{description}</span>
        </div>
    );
}

function SectionToggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors flex-shrink-0',
                enabled
                    ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-slate-400 bg-slate-100 hover:bg-slate-200',
            )}
            title={enabled ? `Hide "${label}" in generated PDFs` : `Show "${label}" in generated PDFs`}
        >
            {enabled ? <Eye size={12} /> : <EyeOff size={12} />}
            {enabled ? 'Visible' : 'Hidden'}
        </button>
    );
}

const textareaClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none resize-y bg-white text-slate-800 placeholder-slate-300';

const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none bg-white text-slate-800 placeholder-slate-300';

// ── Main Component ────────────────────────────────────────────────────────────

export function ProposalTemplateSettings() {
    const navigate = useNavigate();

    const [template, setTemplate] = useState<ProposalTemplateData | null>(null);
    const [draft, setDraft] = useState<Partial<TemplateFields>>({});
    const [visibility, setVisibility] = useState<SectionVisibility>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [showVarRef, setShowVarRef] = useState(false);

    // ── Load on mount ──────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchActiveProposalTemplate();
                if (cancelled) return;
                setTemplate(data);
                setDraft({
                    aboutScan2plan: data.aboutScan2plan ?? '',
                    whyScan2plan: data.whyScan2plan ?? '',
                    capabilities: data.capabilities ?? '',
                    difference: data.difference ?? '',
                    bimStandardsIntro: data.bimStandardsIntro ?? '',
                    paymentTermsDefault: data.paymentTermsDefault ?? '',
                    sfAuditClause: data.sfAuditClause ?? '',
                    footerText: data.footerText ?? '',
                    contactEmail: data.contactEmail ?? '',
                    contactPhone: data.contactPhone ?? '',
                });
                // Default all toggleable sections to visible if no sectionVisibility saved
                const sv = (data.sectionVisibility as SectionVisibility) || {};
                setVisibility({
                    aboutScan2plan: sv.aboutScan2plan !== false,
                    whyScan2plan: sv.whyScan2plan !== false,
                    capabilities: sv.capabilities !== false,
                    difference: sv.difference !== false,
                    bimStandards: sv.bimStandards !== false,
                });
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load proposal template.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    // ── Handlers ────────────────────────────────────────────────────────────────
    const handleChange = useCallback((key: keyof TemplateFields, value: string) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    }, []);

    const toggleVisibility = useCallback((key: string) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    async function handleSave() {
        if (!template) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateProposalTemplate(template.id, {
                ...draft,
                sectionVisibility: visibility,
            } as Partial<ProposalTemplateData>);
            setTemplate(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save template.');
        } finally {
            setSaving(false);
        }
    }

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                    <span className="text-sm">Loading template...</span>
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 pb-16">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate('/dashboard/settings')}
                        className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        aria-label="Back to Settings"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <FileText size={20} className="text-blue-500" />
                            <h2 className="text-2xl font-bold text-slate-900">Proposal Template</h2>
                        </div>
                        <p className="text-slate-400 text-sm mt-1 ml-0.5">
                            Edit boilerplate content and control section visibility for generated PDF proposals.
                        </p>
                    </div>
                </div>

                {/* Save button + success indicator */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {saved && (
                        <motion.div
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-green-600 text-sm font-medium"
                        >
                            <CheckCircle size={15} />
                            Saved
                        </motion.div>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className={cn(
                            'flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors',
                            (saving || loading) && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Save size={14} />
                        )}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
                    role="alert"
                >
                    <span className="font-semibold">Error:</span>
                    <span>{error}</span>
                </motion.div>
            )}

            {/* Two-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left column — boilerplate sections (takes 2/3 width on lg) */}
                <div className="lg:col-span-2 space-y-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Boilerplate Sections
                    </h3>

                    {TEXTAREA_SECTIONS.map((field, index) => {
                        const isToggleable = !!field.visibilityKey;
                        const isVisible = !isToggleable || visibility[field.visibilityKey!] !== false;

                        return (
                            <motion.div
                                key={field.key}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04 }}
                                className={cn(
                                    'bg-white border rounded-xl p-6 transition-opacity',
                                    isVisible ? 'border-slate-200' : 'border-slate-200/60 opacity-60',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <FieldLabel label={field.label} description={field.description} pdfPage={field.pdfPage} />
                                    {isToggleable && (
                                        <SectionToggle
                                            enabled={isVisible}
                                            onToggle={() => toggleVisibility(field.visibilityKey!)}
                                            label={field.label}
                                        />
                                    )}
                                </div>
                                <textarea
                                    rows={field.rows}
                                    className={cn(textareaClass, !isVisible && 'opacity-50')}
                                    value={(draft[field.key] as string) ?? ''}
                                    onChange={e => handleChange(field.key, e.target.value)}
                                    placeholder={`Enter ${field.label.toLowerCase()} content...`}
                                    aria-label={field.label}
                                    disabled={!isVisible}
                                />
                            </motion.div>
                        );
                    })}
                </div>

                {/* Right column — contact info + metadata + variable reference */}
                <div className="space-y-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Contact Information
                    </h3>

                    {INPUT_FIELDS.map((field, index) => (
                        <motion.div
                            key={field.key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 + 0.08 }}
                            className="bg-white border border-slate-200 rounded-xl p-6"
                        >
                            <FieldLabel label={field.label} description={field.description} />
                            <input
                                type="text"
                                className={inputClass}
                                value={(draft[field.key] as string) ?? ''}
                                onChange={e => handleChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                aria-label={field.label}
                            />
                        </motion.div>
                    ))}

                    {/* Variable Reference */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16 }}
                        className="bg-white border border-slate-200 rounded-xl p-5"
                    >
                        <button
                            onClick={() => setShowVarRef(!showVarRef)}
                            className="flex items-center justify-between w-full text-left"
                        >
                            <div className="flex items-center gap-2">
                                <Info size={14} className="text-blue-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Available Variables
                                </span>
                            </div>
                            <span className="text-xs text-slate-400">{showVarRef ? 'Hide' : 'Show'}</span>
                        </button>

                        {showVarRef && (
                            <div className="mt-3 space-y-1.5">
                                {TEMPLATE_VARIABLES.map(v => (
                                    <div key={v.variable} className="flex items-start gap-2 text-xs">
                                        <code className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">
                                            {v.variable}
                                        </code>
                                        <span className="text-slate-400">{v.description}</span>
                                    </div>
                                ))}
                                <p className="text-[10px] text-slate-300 mt-2 pt-2 border-t border-slate-100">
                                    Use these variables in any text section. They are replaced with actual project data when generating a PDF.
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {/* Section Visibility Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white border border-slate-200 rounded-xl p-5"
                    >
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                            PDF Sections
                        </span>
                        <div className="space-y-2">
                            {[
                                { label: 'Cover Page', always: true },
                                { label: 'About / Why', key: 'aboutScan2plan' },
                                { label: 'Project Scope', always: true },
                                { label: 'Estimate Table', always: true },
                                { label: 'Payment Terms', always: true },
                                { label: 'Capabilities', key: 'capabilities' },
                                { label: 'Difference', key: 'difference' },
                                { label: 'BIM Standards', key: 'bimStandards' },
                            ].map(section => {
                                const isAlways = 'always' in section && section.always;
                                const isOn = isAlways || visibility[section.key!] !== false;
                                return (
                                    <div key={section.label} className="flex items-center justify-between text-xs">
                                        <span className={cn('text-slate-600', !isOn && 'text-slate-300 line-through')}>
                                            {section.label}
                                        </span>
                                        {isAlways ? (
                                            <span className="text-[10px] text-slate-300">Always</span>
                                        ) : (
                                            <span className={cn(
                                                'text-[10px] font-medium',
                                                isOn ? 'text-emerald-500' : 'text-slate-300',
                                            )}>
                                                {isOn ? 'On' : 'Off'}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Template metadata card */}
                    {template && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.24 }}
                            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                        >
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                                Template Info
                            </span>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Name</span>
                                    <span className="font-medium text-slate-700 font-mono text-xs">{template.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Status</span>
                                    <span className={cn(
                                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                                        template.isActive
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-slate-100 text-slate-500'
                                    )}>
                                        {template.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Last updated</span>
                                    <span className="text-slate-500 text-xs">
                                        {new Date(template.updatedAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Template ID</span>
                                    <span className="font-mono text-xs text-slate-400">#{template.id}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Info card */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28 }}
                        className="bg-blue-50 border border-blue-100 rounded-xl p-5"
                    >
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Changes saved here will apply to all <strong>newly generated</strong> proposals.
                            Existing proposal PDFs are not retroactively updated.
                            Toggle section visibility to control which boilerplate sections appear in PDFs.
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
