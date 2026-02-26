import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Save, Loader2, CheckCircle, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    fetchActiveProposalTemplate,
    updateProposalTemplate,
    type ProposalTemplateData,
} from '@/services/api';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type TemplateFields = Omit<ProposalTemplateData, 'id' | 'name' | 'isActive' | 'createdAt' | 'updatedAt'>;

interface SectionField {
    key: keyof TemplateFields;
    label: string;
    description: string;
    rows: number;
    isTextarea: true;
}

interface InputField {
    key: keyof TemplateFields;
    label: string;
    description: string;
    placeholder: string;
    isTextarea: false;
}

type FieldDef = SectionField | InputField;

// ── Field Definitions ────────────────────────────────────────────────────────

const TEXTAREA_SECTIONS: SectionField[] = [
    {
        key: 'aboutScan2plan',
        label: 'About Scan2Plan',
        description: 'Company overview paragraph shown in proposal introductions.',
        rows: 10,
        isTextarea: true,
    },
    {
        key: 'whyScan2plan',
        label: 'Why Scan2Plan?',
        description: 'Value proposition copy used in the proposal body.',
        rows: 10,
        isTextarea: true,
    },
    {
        key: 'capabilities',
        label: 'Capabilities',
        description: 'Services and technology capabilities listed in the proposal.',
        rows: 10,
        isTextarea: true,
    },
    {
        key: 'difference',
        label: 'The Scan2Plan Difference',
        description: 'Differentiator section highlighting what sets Scan2Plan apart.',
        rows: 10,
        isTextarea: true,
    },
    {
        key: 'bimStandardsIntro',
        label: 'BIM Standards Intro',
        description: 'Introductory copy that precedes the BIM standards table.',
        rows: 8,
        isTextarea: true,
    },
    {
        key: 'paymentTermsDefault',
        label: 'Payment Terms Default',
        description: 'Default payment terms boilerplate appended to every proposal.',
        rows: 6,
        isTextarea: true,
    },
    {
        key: 'sfAuditClause',
        label: 'SF Audit Clause',
        description: 'Square footage audit clause included in proposals with SF assumptions.',
        rows: 6,
        isTextarea: true,
    },
    {
        key: 'footerText',
        label: 'Footer Text',
        description: 'Text displayed in the PDF footer on every page.',
        rows: 4,
        isTextarea: true,
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

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FieldLabel({ label, description }: { label: string; description: string }) {
    return (
        <div className="mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                {label}
            </span>
            <span className="text-xs text-slate-400 mt-0.5 block">{description}</span>
        </div>
    );
}

const textareaClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none resize-y bg-white text-slate-800 placeholder-slate-300';

const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none bg-white text-slate-800 placeholder-slate-300';

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * Usage: mount at a route like /settings/proposal-template
 * Expects fetchActiveProposalTemplate and updateProposalTemplate to be wired to /api/proposal-templates
 */
export function ProposalTemplateSettings() {
    const navigate = useNavigate();

    const [template, setTemplate] = useState<ProposalTemplateData | null>(null);
    const [draft, setDraft] = useState<Partial<TemplateFields>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

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

    // ── Field change handler ───────────────────────────────────────────────────
    const handleChange = useCallback((key: keyof TemplateFields, value: string) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    }, []);

    // ── Save handler ───────────────────────────────────────────────────────────
    async function handleSave() {
        if (!template) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await updateProposalTemplate(template.id, draft);
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
                        onClick={() => navigate('/settings')}
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
                            Edit boilerplate content used across all generated PDF proposals.
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

                    {TEXTAREA_SECTIONS.map((field, index) => (
                        <motion.div
                            key={field.key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                            className="bg-white border border-slate-200 rounded-xl p-6"
                        >
                            <FieldLabel label={field.label} description={field.description} />
                            <textarea
                                rows={field.rows}
                                className={textareaClass}
                                value={(draft[field.key] as string) ?? ''}
                                onChange={e => handleChange(field.key, e.target.value)}
                                placeholder={`Enter ${field.label.toLowerCase()} content...`}
                                aria-label={field.label}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Right column — contact info + metadata */}
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

                    {/* Template metadata card */}
                    {template && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
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

                    {/* Save shortcut card */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28 }}
                        className="bg-blue-50 border border-blue-100 rounded-xl p-5"
                    >
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Changes saved here will apply to all <strong>newly generated</strong> proposals.
                            Existing proposal PDFs are not retroactively updated.
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
