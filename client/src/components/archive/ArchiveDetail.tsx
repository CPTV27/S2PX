// ArchiveDetail — Full project metadata view with scoping form data + GCS assets.
// Used as a slide-over panel from the Archive list.

import { useEffect, useState } from 'react';
import {
    ArrowLeft,
    Building2,
    Calendar,
    Download,
    ExternalLink,
    File,
    FileArchive,
    FileText,
    Folder,
    HardDrive,
    Image,
    Loader2,
    MapPin,
    ChevronRight,
    Home,
    Share2,
    User,
    Phone,
    Mail,
    Ruler,
    AlertTriangle,
    Wrench,
    Clock,
    DollarSign,
} from 'lucide-react';
import { fetchProjectDetail, fetchGcsFolderContents, getGcsDownloadUrl } from '@/services/api';
import { cn, formatDate, getStatusColor } from '@/lib/utils';
import type { ProjectDetailResponse } from '@/types';
import type { GcsFolderEntry } from '@/types';
import { ShareLinkManager } from './ShareLinkManager';

interface ArchiveDetailProps {
    projectId: number;
    onBack: () => void;
}

function formatFileSize(bytes: number): string {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDateTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileIcon(contentType?: string) {
    if (!contentType) return File;
    if (contentType === 'folder') return Folder;
    if (contentType.startsWith('image/')) return Image;
    if (contentType.includes('zip') || contentType.includes('archive')) return FileArchive;
    if (contentType.includes('pdf') || contentType.includes('text')) return FileText;
    return File;
}

// ── Metadata Row ──
function MetaRow({ label, value, icon: Icon }: { label: string; value?: string | number | boolean | null; icon?: any }) {
    if (value === undefined || value === null || value === '') return null;
    const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    return (
        <div className="flex items-start gap-2 py-1.5">
            {Icon && <Icon size={13} className="text-s2p-muted mt-0.5 shrink-0" />}
            <span className="text-xs text-s2p-muted w-32 shrink-0">{label}</span>
            <span className="text-sm text-s2p-fg flex-1">{display}</span>
        </div>
    );
}

// ── Inline Asset Browser ──
function AssetBrowser({ bucket, gcsPath, label }: { bucket: string; gcsPath: string; label: string | null }) {
    const [entries, setEntries] = useState<GcsFolderEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const basePath = gcsPath.endsWith('/') ? gcsPath : `${gcsPath}/`;
    const [currentPath, setCurrentPath] = useState(basePath);
    const [pathHistory, setPathHistory] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchGcsFolderContents(bucket, currentPath)
            .then(data => { if (!cancelled) setEntries(data); })
            .catch(console.error)
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [bucket, currentPath]);

    const navigateTo = (folderPath: string) => {
        setPathHistory(prev => [...prev, currentPath]);
        setCurrentPath(folderPath);
    };

    const navigateBack = () => {
        const prev = pathHistory[pathHistory.length - 1];
        if (prev !== undefined) {
            setPathHistory(h => h.slice(0, -1));
            setCurrentPath(prev);
        }
    };

    const handleDownload = async (entry: GcsFolderEntry) => {
        try {
            const { url } = await getGcsDownloadUrl(bucket, entry.fullPath);
            window.open(url, '_blank');
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    const relativePath = currentPath.replace(basePath, '');
    const crumbs = relativePath.split('/').filter(Boolean);

    return (
        <div className="border border-s2p-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-s2p-secondary/30 border-b border-s2p-border flex items-center gap-2">
                <HardDrive size={13} className="text-s2p-muted" />
                <span className="text-xs font-medium text-s2p-fg">{label || gcsPath}</span>
                <span className="text-[10px] font-mono text-s2p-muted ml-auto">{bucket}</span>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 px-3 py-1.5 text-xs border-b border-s2p-border/50 bg-white overflow-x-auto">
                {pathHistory.length > 0 && (
                    <button onClick={navigateBack} className="p-1 rounded hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg transition-colors mr-1">
                        <ArrowLeft size={11} />
                    </button>
                )}
                <button
                    onClick={() => { setCurrentPath(basePath); setPathHistory([]); }}
                    className="flex items-center gap-1 text-s2p-muted hover:text-s2p-primary transition-colors shrink-0"
                >
                    <Home size={10} />
                    <span className="font-mono">root</span>
                </button>
                {crumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1 shrink-0">
                        <ChevronRight size={9} className="text-s2p-muted" />
                        <span className="font-mono text-s2p-muted">{crumb}</span>
                    </span>
                ))}
            </div>

            {/* File list */}
            <div className="max-h-64 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-s2p-muted">
                        <Loader2 size={16} className="animate-spin" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-6 text-s2p-muted text-xs">Empty folder</div>
                ) : (
                    entries.map(entry => {
                        const Icon = entry.isFolder ? Folder : getFileIcon(entry.contentType);
                        return (
                            <div
                                key={entry.fullPath}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 border-b border-s2p-border/20 group transition-colors',
                                    entry.isFolder ? 'hover:bg-blue-50/40 cursor-pointer' : 'hover:bg-s2p-secondary/20'
                                )}
                                onClick={entry.isFolder ? () => navigateTo(entry.fullPath) : undefined}
                            >
                                <Icon size={14} className={entry.isFolder ? 'text-blue-500 shrink-0' : 'text-s2p-muted shrink-0'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{entry.name}</p>
                                    {!entry.isFolder && (
                                        <p className="text-[10px] text-s2p-muted font-mono">
                                            {formatFileSize(entry.size || 0)}
                                            {entry.updated && ` · ${formatDateTime(entry.updated)}`}
                                        </p>
                                    )}
                                </div>
                                {!entry.isFolder && (
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDownload(entry); }}
                                        className="p-1 rounded hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <Download size={12} />
                                    </button>
                                )}
                                {entry.isFolder && (
                                    <ChevronRight size={12} className="text-s2p-muted opacity-0 group-hover:opacity-100" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── Main Detail Component ──

export function ArchiveDetail({ projectId, onBack }: ArchiveDetailProps) {
    const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchProjectDetail(projectId)
            .then(data => { if (!cancelled) setDetail(data); })
            .catch(e => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-s2p-primary" size={24} />
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="text-center py-12">
                <p className="text-s2p-muted text-sm">{error || 'Project not found'}</p>
                <button onClick={onBack} className="mt-4 text-sm text-s2p-primary hover:underline">
                    ← Back to archive
                </button>
            </div>
        );
    }

    const { project, scopingForm: sf, stageData, assets } = detail;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <button
                    onClick={onBack}
                    className="mt-1 p-2 rounded-xl hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg transition-colors shrink-0"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-bold text-s2p-fg">{project.projectName}</h2>
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase', getStatusColor(project.status))}>
                            {project.status}
                        </span>
                    </div>
                    <p className="text-sm text-s2p-muted mt-0.5">{project.clientName}</p>
                    {sf.projectAddress && (
                        <p className="text-xs text-s2p-muted mt-1 flex items-center gap-1">
                            <MapPin size={11} />
                            {sf.projectAddress}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Left Column: Metadata ── */}
                <div className="space-y-4">
                    {/* Project Info */}
                    <div className="bg-white border border-s2p-border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                            <Building2 size={14} className="text-blue-500" />
                            Project Information
                        </h3>
                        <div className="divide-y divide-s2p-border/30">
                            <MetaRow label="Client" value={sf.clientCompany} icon={Building2} />
                            <MetaRow label="Address" value={sf.projectAddress} icon={MapPin} />
                            <MetaRow label="Building Sqft" value={sf.buildingFootprintSqft ? `${Number(sf.buildingFootprintSqft).toLocaleString()} SF` : null} icon={Ruler} />
                            <MetaRow label="Floors" value={sf.numberOfFloors} icon={Building2} />
                            <MetaRow label="Era" value={sf.era} icon={Clock} />
                            <MetaRow label="Room Density" value={sf.roomDensity} />
                            <MetaRow label="Risk Factors" value={Array.isArray(sf.riskFactors) ? sf.riskFactors.join(', ') : sf.riskFactors} icon={AlertTriangle} />
                            <MetaRow label="Insurance" value={sf.insuranceRequirements} />
                        </div>
                    </div>

                    {/* Contacts */}
                    <div className="bg-white border border-s2p-border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                            <User size={14} className="text-emerald-500" />
                            Contacts
                        </h3>
                        <div className="divide-y divide-s2p-border/30">
                            <MetaRow label="Primary Contact" value={sf.primaryContactName} icon={User} />
                            <MetaRow label="Email" value={sf.contactEmail} icon={Mail} />
                            <MetaRow label="Phone" value={sf.contactPhone} icon={Phone} />
                            <MetaRow label="Account Email" value={sf.email} icon={Mail} />
                            {sf.billingContactName && !sf.billingSameAsPrimary && (
                                <>
                                    <MetaRow label="Billing Contact" value={sf.billingContactName} icon={User} />
                                    <MetaRow label="Billing Email" value={sf.billingEmail} icon={Mail} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Deliverables */}
                    <div className="bg-white border border-s2p-border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                            <Wrench size={14} className="text-purple-500" />
                            Deliverables & Specs
                        </h3>
                        <div className="divide-y divide-s2p-border/30">
                            <MetaRow label="BIM Deliverable" value={sf.bimDeliverable} icon={Wrench} />
                            <MetaRow label="BIM Version" value={sf.bimVersion} />
                            <MetaRow label="Georeferencing" value={sf.georeferencing} />
                            <MetaRow label="Custom Template" value={sf.customTemplate} />
                            <MetaRow label="Scan & Reg Only" value={sf.scanRegOnly} />
                            <MetaRow label="Expedited" value={sf.expedited} />
                            <MetaRow label="Landscape" value={sf.landscapeModeling} />
                            {sf.landscapeAcres && <MetaRow label="Landscape Acres" value={sf.landscapeAcres} />}
                        </div>
                    </div>

                    {/* Timeline & Operations */}
                    <div className="bg-white border border-s2p-border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                            <Calendar size={14} className="text-amber-500" />
                            Timeline & Operations
                        </h3>
                        <div className="divide-y divide-s2p-border/30">
                            <MetaRow label="Scan Date" value={project.scanDate ? formatDate(project.scanDate) : null} icon={Calendar} />
                            <MetaRow label="Delivery Date" value={project.deliveryDate ? formatDate(project.deliveryDate) : null} icon={Calendar} />
                            <MetaRow label="Est Timeline" value={sf.estTimeline} icon={Clock} />
                            <MetaRow label="Project Timeline" value={sf.projectTimeline} />
                            <MetaRow label="Dispatch From" value={sf.dispatchLocation} icon={MapPin} />
                            <MetaRow label="One-Way Miles" value={sf.oneWayMiles} />
                            <MetaRow label="Travel Mode" value={sf.travelMode} />
                            <MetaRow label="Payment Terms" value={sf.paymentTerms} icon={DollarSign} />
                        </div>
                    </div>

                    {/* CEO / Pricing */}
                    {sf.pricingTier && (
                        <div className="bg-white border border-s2p-border rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                                <DollarSign size={14} className="text-green-500" />
                                Pricing & Assignment
                            </h3>
                            <div className="divide-y divide-s2p-border/30">
                                <MetaRow label="Pricing Tier" value={sf.pricingTier} icon={DollarSign} />
                                <MetaRow label="BIM Manager" value={sf.bimManager} />
                                <MetaRow label="Scanner" value={sf.scannerAssignment} />
                                <MetaRow label="Est Scan Days" value={sf.estScanDays} />
                                <MetaRow label="Techs Planned" value={sf.techsPlanned} />
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {sf.internalNotes && (
                        <div className="bg-white border border-s2p-border rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-s2p-fg mb-2">Internal Notes</h3>
                            <p className="text-sm text-s2p-fg whitespace-pre-wrap">{sf.internalNotes}</p>
                        </div>
                    )}
                </div>

                {/* ── Right Column: Files & Assets ── */}
                <div className="space-y-4">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white border border-s2p-border rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-s2p-fg">{sf.numberOfFloors || '—'}</p>
                            <p className="text-[10px] text-s2p-muted uppercase tracking-wider">Floors</p>
                        </div>
                        <div className="bg-white border border-s2p-border rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-s2p-fg">
                                {sf.buildingFootprintSqft
                                    ? `${(Number(sf.buildingFootprintSqft) / 1000).toFixed(0)}k`
                                    : '—'}
                            </p>
                            <p className="text-[10px] text-s2p-muted uppercase tracking-wider">Sqft</p>
                        </div>
                        <div className="bg-white border border-s2p-border rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-s2p-fg">{assets.length}</p>
                            <p className="text-[10px] text-s2p-muted uppercase tracking-wider">Asset Links</p>
                        </div>
                    </div>

                    {/* Linked GCS Assets */}
                    {assets.length > 0 ? (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-s2p-fg flex items-center gap-2">
                                <HardDrive size={14} className="text-blue-500" />
                                Linked Assets
                            </h3>
                            {assets.map(asset => (
                                <AssetBrowser
                                    key={asset.id}
                                    bucket={asset.bucket}
                                    gcsPath={asset.gcsPath}
                                    label={asset.label}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-s2p-border rounded-xl p-6 text-center">
                            <HardDrive size={28} className="mx-auto mb-2 text-s2p-muted opacity-30" />
                            <p className="text-sm font-medium text-s2p-muted">No linked assets</p>
                            <p className="text-xs text-s2p-muted mt-1">
                                Link GCS folders from the production pipeline to see files here.
                            </p>
                        </div>
                    )}

                    {/* Stage Data Summary */}
                    {stageData && Object.keys(stageData).length > 0 && (
                        <div className="bg-white border border-s2p-border rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                                <Share2 size={14} className="text-s2p-primary" />
                                Stage Data
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(stageData).map(([stage, data]) => (
                                    <div key={stage} className="bg-s2p-secondary/30 rounded-lg p-3">
                                        <p className="text-xs font-semibold text-s2p-fg uppercase tracking-wider mb-1">
                                            {stage.replace(/([A-Z])/g, ' $1').trim()}
                                        </p>
                                        <div className="space-y-0.5">
                                            {Object.entries(data as Record<string, any>)
                                                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                                .slice(0, 8)
                                                .map(([key, val]) => (
                                                    <div key={key} className="flex items-center gap-2 text-xs">
                                                        <span className="text-s2p-muted w-32 shrink-0">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                                        </span>
                                                        <span className="text-s2p-fg truncate">
                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Links */}
                    <ShareLinkManager projectId={project.id} />

                    {/* Links */}
                    <div className="bg-white border border-s2p-border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-s2p-fg mb-3 flex items-center gap-2">
                            <ExternalLink size={14} className="text-s2p-primary" />
                            Quick Links
                        </h3>
                        <div className="space-y-2">
                            {project.leadId && (
                                <a
                                    href={`/dashboard/deals/${project.leadId}`}
                                    className="flex items-center gap-2 text-sm text-s2p-primary hover:underline"
                                >
                                    <ExternalLink size={12} />
                                    View Deal Workspace
                                </a>
                            )}
                            <a
                                href={`/dashboard/production/${project.id}`}
                                className="flex items-center gap-2 text-sm text-s2p-primary hover:underline"
                            >
                                <ExternalLink size={12} />
                                View Production Detail
                            </a>
                            {project.leadId && (
                                <a
                                    href={`/dashboard/scoping/${project.leadId}`}
                                    className="flex items-center gap-2 text-sm text-s2p-primary hover:underline"
                                >
                                    <ExternalLink size={12} />
                                    View Scoping Form
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
