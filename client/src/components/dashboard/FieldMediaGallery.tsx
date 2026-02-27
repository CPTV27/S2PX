// ── Field Media Gallery — PM Dashboard ──
// Masonry-style grid for field photos and videos uploaded from Scantech.
// Lazy-loads signed thumbnail URLs on demand.

import { useState, useCallback, useEffect } from 'react';
import {
    Image, Film, Camera, Download, Eye, Loader2,
    ChevronDown, X, FileText, ExternalLink,
} from 'lucide-react';
import {
    getFieldThumbnailUrl,
    getFieldDownloadUrl,
    type FieldUploadRecord,
} from '@/services/api';
import { cn } from '@/lib/utils';

interface FieldMediaGalleryProps {
    projectId: number;
    uploads: FieldUploadRecord[];
    onViewAll?: () => void;
}

const categoryIcons: Record<string, typeof Image> = {
    photo: Camera,
    video: Film,
    scan_file: FileText,
    document: FileText,
};

const categoryLabels: Record<string, string> = {
    photo: 'Photos',
    video: 'Videos',
    scan_file: 'Scan Files',
    document: 'Documents',
};

function formatBytes(bytes: string | number): string {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ThumbnailCard({
    upload,
    projectId,
}: {
    upload: FieldUploadRecord;
    projectId: number;
}) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);
    const [thumbLoading, setThumbLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [lightbox, setLightbox] = useState(false);

    const isMedia = upload.fileCategory === 'photo' || upload.fileCategory === 'video';

    // Load thumbnail on mount for media files
    useEffect(() => {
        if (!isMedia) return;
        setThumbLoading(true);
        getFieldThumbnailUrl(projectId, upload.id)
            .then(result => setThumbUrl(result.url))
            .catch(() => {}) // Non-fatal — show placeholder
            .finally(() => setThumbLoading(false));
    }, [projectId, upload.id, isMedia]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const { url } = await getFieldDownloadUrl(projectId, upload.id);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    const Icon = categoryIcons[upload.fileCategory] || FileText;

    return (
        <>
            <div className="group relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all">
                {/* Thumbnail area */}
                <div
                    className={cn(
                        'aspect-square flex items-center justify-center cursor-pointer',
                        isMedia && thumbUrl ? '' : 'bg-slate-100',
                    )}
                    onClick={() => isMedia && thumbUrl && setLightbox(true)}
                >
                    {thumbLoading ? (
                        <Loader2 size={20} className="animate-spin text-slate-300" />
                    ) : thumbUrl ? (
                        <img
                            src={thumbUrl}
                            alt={upload.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <Icon size={24} className="text-slate-300" />
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                                {upload.fileCategory.replace('_', ' ')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Info bar */}
                <div className="p-2">
                    <p className="text-[11px] font-medium text-slate-700 truncate" title={upload.filename}>
                        {upload.filename}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-400">
                            {formatBytes(upload.sizeBytes)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                            {new Date(upload.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isMedia && thumbUrl && (
                        <button
                            onClick={() => setLightbox(true)}
                            className="w-6 h-6 bg-black/60 backdrop-blur-sm text-white rounded flex items-center justify-center hover:bg-black/80"
                            title="Preview"
                        >
                            <Eye size={11} />
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="w-6 h-6 bg-black/60 backdrop-blur-sm text-white rounded flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
                        title="Download"
                    >
                        {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    </button>
                </div>

                {/* Upload source badge */}
                {upload.captureMethod === 'camera' && (
                    <div className="absolute top-1.5 left-1.5">
                        <span className="text-[8px] bg-blue-600/80 backdrop-blur-sm text-white px-1.5 py-0.5 rounded font-medium">
                            FIELD
                        </span>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && thumbUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setLightbox(false)}
                >
                    <button
                        onClick={() => setLightbox(false)}
                        className="absolute top-4 right-4 w-8 h-8 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20"
                    >
                        <X size={16} />
                    </button>
                    <img
                        src={thumbUrl}
                        alt={upload.filename}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={e => e.stopPropagation()}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                        <span className="text-sm text-white/80">{upload.filename}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                            className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
                        >
                            <Download size={12} />
                            Download Full
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export function FieldMediaGallery({ projectId, uploads, onViewAll }: FieldMediaGalleryProps) {
    const [filter, setFilter] = useState<string>('all');

    // Separate media from files
    const mediaUploads = uploads.filter(u => u.fileCategory === 'photo' || u.fileCategory === 'video');
    const fileUploads = uploads.filter(u => u.fileCategory === 'scan_file' || u.fileCategory === 'document');

    const filteredUploads = filter === 'all'
        ? uploads
        : uploads.filter(u => u.fileCategory === filter);

    // Category counts
    const categoryCounts = uploads.reduce((acc, u) => {
        acc[u.fileCategory] = (acc[u.fileCategory] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Image size={14} className="text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Field Uploads</h3>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {uploads.length}
                    </span>
                </div>
                {onViewAll && uploads.length > 12 && (
                    <button
                        onClick={onViewAll}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                        View All
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            {uploads.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-50 flex gap-1.5 overflow-x-auto">
                    <FilterPill
                        label="All"
                        count={uploads.length}
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                    />
                    {Object.entries(categoryCounts).map(([cat, count]) => (
                        <FilterPill
                            key={cat}
                            label={categoryLabels[cat] || cat}
                            count={count}
                            active={filter === cat}
                            onClick={() => setFilter(cat)}
                        />
                    ))}
                </div>
            )}

            {/* Gallery grid */}
            {filteredUploads.length > 0 ? (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {filteredUploads.slice(0, 12).map(upload => (
                        <ThumbnailCard
                            key={upload.id}
                            upload={upload}
                            projectId={projectId}
                        />
                    ))}
                </div>
            ) : (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                    {uploads.length === 0
                        ? 'No uploads from the field yet'
                        : 'No uploads match this filter'
                    }
                </div>
            )}
        </div>
    );
}

function FilterPill({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors whitespace-nowrap',
                active
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
            )}
        >
            {label}
            <span className={cn(
                'text-[9px] px-1 py-0 rounded-full',
                active ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600',
            )}>
                {count}
            </span>
        </button>
    );
}
