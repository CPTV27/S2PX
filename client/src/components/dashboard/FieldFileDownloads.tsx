// ── Field File Downloads — PM Dashboard ──
// Dedicated view for large scan files (.e57, .rcp, .las, etc.)
// with signed GCS download URLs. PM clicks → browser downloads direct from bucket.

import { useState } from 'react';
import {
    Download, Loader2, FileText, HardDrive,
    Clock, User, ExternalLink, ScanLine,
} from 'lucide-react';
import { getFieldDownloadUrl, type FieldUploadRecord } from '@/services/api';
import { cn } from '@/lib/utils';

interface FieldFileDownloadsProps {
    projectId: number;
    uploads: FieldUploadRecord[];
}

function formatBytes(bytes: string | number): string {
    const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

const scanExtensions = new Set(['e57', 'ptx', 'rcp', 'rcs', 'las', 'laz', 'pts', 'ply', 'xyz']);
const bimExtensions = new Set(['rvt', 'dwg', 'ifc', 'nwd', 'nwc', 'nwf']);

function getFileTypeInfo(filename: string): { label: string; color: string; bgColor: string } {
    const ext = getFileExtension(filename);
    if (scanExtensions.has(ext)) {
        return { label: ext.toUpperCase(), color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' };
    }
    if (bimExtensions.has(ext)) {
        return { label: ext.toUpperCase(), color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' };
    }
    return { label: ext.toUpperCase() || 'FILE', color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' };
}

function FileDownloadRow({
    upload,
    projectId,
}: {
    upload: FieldUploadRecord;
    projectId: number;
}) {
    const [downloading, setDownloading] = useState(false);
    const typeInfo = getFileTypeInfo(upload.filename);
    const ext = getFileExtension(upload.filename);
    const isScanFile = scanExtensions.has(ext);
    const sizeBytes = parseInt(upload.sizeBytes || '0', 10);
    const isLarge = sizeBytes > 100 * 1024 * 1024; // > 100MB

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const { url } = await getFieldDownloadUrl(projectId, upload.id);
            // Open in new tab — browser handles the download from GCS directly
            window.open(url, '_blank');
        } catch (err) {
            console.error('Download URL generation failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
            {/* File type badge */}
            <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0',
                typeInfo.bgColor,
            )}>
                {isScanFile ? (
                    <ScanLine size={16} className={typeInfo.color} />
                ) : (
                    <FileText size={16} className={typeInfo.color} />
                )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate" title={upload.filename}>
                    {upload.filename}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                    <span className={cn(
                        'font-semibold px-1.5 py-0 rounded',
                        typeInfo.bgColor, typeInfo.color,
                    )}>
                        {typeInfo.label}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <HardDrive size={9} />
                        {formatBytes(upload.sizeBytes)}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Clock size={9} />
                        {new Date(upload.createdAt).toLocaleDateString()}
                    </span>
                    {upload.uploadedByName && (
                        <span className="flex items-center gap-0.5">
                            <User size={9} />
                            {upload.uploadedByName}
                        </span>
                    )}
                </div>
            </div>

            {/* Size indicator for large files */}
            {isLarge && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                    Large File
                </span>
            )}

            {/* Download button */}
            <button
                onClick={handleDownload}
                disabled={downloading}
                className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0',
                    'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
                )}
            >
                {downloading ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <Download size={12} />
                )}
                {downloading ? 'Generating...' : 'Download'}
            </button>
        </div>
    );
}

export function FieldFileDownloads({ projectId, uploads }: FieldFileDownloadsProps) {
    // Filter to scan files and documents only
    const fileUploads = uploads.filter(
        u => u.fileCategory === 'scan_file' || u.fileCategory === 'document'
    );

    // Summary
    const totalSize = fileUploads.reduce((sum, u) => sum + parseInt(u.sizeBytes || '0', 10), 0);
    const scanFiles = fileUploads.filter(u => u.fileCategory === 'scan_file');
    const documents = fileUploads.filter(u => u.fileCategory === 'document');

    if (fileUploads.length === 0) {
        return null; // Don't render if no files
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <HardDrive size={14} className="text-violet-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Scan Files & Documents</h3>
                </div>
                <div className="flex items-center gap-2">
                    {scanFiles.length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                            {scanFiles.length} Scan {scanFiles.length === 1 ? 'File' : 'Files'}
                        </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                        {formatBytes(totalSize)} total
                    </span>
                </div>
            </div>

            {/* File list */}
            <div>
                {fileUploads.map(upload => (
                    <FileDownloadRow
                        key={upload.id}
                        upload={upload}
                        projectId={projectId}
                    />
                ))}
            </div>
        </div>
    );
}
