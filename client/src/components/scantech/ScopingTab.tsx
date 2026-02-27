// ── Scantech Scoping Tab ──
// Read-only display of scoping form data in collapsible sections.

import { useState } from 'react';
import {
    Building2, User, Layers, Globe, MapPin, Ruler,
    Calendar, DollarSign, AlertTriangle, ChevronDown, ChevronUp,
    Shield, Clock, FileText, CheckCircle,
} from 'lucide-react';
import { useScantechContext } from './ScantechLayout';
import { cn } from '@/lib/utils';

// ── Collapsible Section ──

function Section({
    title,
    icon: Icon,
    children,
    defaultOpen = false,
}: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 touch-manipulation"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                </div>
                {open ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
            </button>
            {open && (
                <div className="border-t border-gray-100 p-4 pt-3 space-y-2">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Field Row ──

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex justify-between items-start py-1.5">
            <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-medium">{value}</span>
        </div>
    );
}

export function ScopingTab() {
    const { project } = useScantechContext();
    const s = project.scopingData;

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Scoping Data</h2>

            {/* Project ID */}
            <Section title="Project" icon={FileText} defaultOpen>
                <Field label="Client" value={s.clientCompany} />
                <Field label="Project" value={s.projectName} />
                <Field label="Address" value={s.projectAddress} />
                <Field label="Contact" value={s.primaryContactName} />
                <Field label="Email" value={s.email} />
                <Field label="Phone" value={s.contactPhone} />
            </Section>

            {/* Building Characteristics */}
            <Section title="Building" icon={Building2}>
                <Field label="Era" value={s.era} />
                <Field label="Floors" value={s.numberOfFloors} />
                <Field label="Basement/Attic" value={s.basementAttic?.join(', ')} />
                <Field label="Room Density" value={`${s.roomDensity}/10`} />
            </Section>

            {/* Deliverable */}
            <Section title="Deliverable" icon={Globe}>
                <Field label="BIM Type" value={s.bimDeliverable} />
                <Field label="BIM Version" value={s.bimVersion} />
                <Field label="Georeferencing" value={s.georeferencing ? 'Yes' : 'No'} />
                <Field label="Landscape Modeling" value={s.landscapeModeling} />
                <Field label="Scan Reg Only" value={s.scanRegOnly} />
            </Section>

            {/* Scope Areas */}
            <Section title={`Scope Areas (${s.areas.length})`} icon={Layers}>
                {s.areas.map((area) => (
                    <div key={area.id} className="py-2 border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-900">
                            {area.areaName || area.areaType}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>{area.squareFootage.toLocaleString()} SF</span>
                            <span>{area.projectScope}</span>
                            <span>LOD {area.lod}</span>
                        </div>
                    </div>
                ))}
            </Section>

            {/* Travel */}
            <Section title="Travel" icon={MapPin}>
                <Field label="Dispatch" value={s.dispatchLocation} />
                <Field label="One-Way Miles" value={`${s.oneWayMiles} mi`} />
                <Field label="Travel Mode" value={s.travelMode} />
                <Field label="Pricing Tier" value={s.pricingTier} />
            </Section>

            {/* Planning */}
            <Section title="Planning" icon={Calendar}>
                <Field label="Est. Scan Days" value={s.estScanDays} />
                <Field label="Techs Planned" value={s.techsPlanned} />
                <Field label="Expedited" value={s.expedited ? 'Yes' : 'No'} />
                <Field label="Timeline" value={s.estTimeline} />
                <Field label="Payment Terms" value={s.paymentTerms} />
            </Section>

            {/* Risk Factors */}
            {s.riskFactors.length > 0 && (
                <Section title="Risk Factors" icon={AlertTriangle}>
                    <div className="flex flex-wrap gap-1.5">
                        {s.riskFactors.map((rf) => (
                            <span
                                key={rf}
                                className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                            >
                                {rf}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Internal Notes */}
            {s.internalNotes && (
                <Section title="Internal Notes" icon={Shield}>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.internalNotes}</p>
                </Section>
            )}
        </div>
    );
}
