// UploadPortal — Public upload page (no auth required).
// Remote team members access via token-based share link: /upload/:token
// Files are uploaded directly to GCS via signed URLs.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    Upload,
    CheckCircle2,
    XCircle,
    Loader2,
    FileUp,
    Clock,
    HardDrive,
    AlertTriangle,
    Files,
    User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──

interface ShareInfo {
    id: number;
    label: string | null;
    projectUpid: string;
    targetBucket: string;
    expiresAt: string;
    maxUploadBytes: string | null;
    totalUploadedBytes: string | null;
    uploadCount: number;
    files: {
        filename: string;
        sizeBytes: string;
        contentType: string | null;
        uploadedByName: string | null;
        uploadedAt: string;
    }[];
}

interface FileUploadState {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    error?: string;
}

// ── Public API helpers (no Firebase auth) ──

async function publicFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
}

function formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
}

function expiryLabel(iso: string): { text: string; isExpired: boolean; isUrgent: boolean } {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', isExpired: true, isUrgent: false };
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return { text: `${Math.ceil(hours)}h remaining`, isExpired: false, isUrgent: true };
    const days = Math.ceil(hours / 24);
    return { text: `${days} day${days > 1 ? 's' : ''} remaining`, isExpired: false, isUrgent: days <= 2 };
}

// ── Component ──

export function UploadPortal() {
    const { token } = useParams<{ token: string }>();
    const [share, setShare] = useState<ShareInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploads, setUploads] = useState<FileUploadState[]>([]);
    const [uploaderName, setUploaderName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch share info
    useEffect(() => {
        if (!token) return;
        publicFetch<ShareInfo>(`/api/public/upload/${token}`)
            .then(setShare)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    // Upload a single file
    const uploadFile = useCallback(async (fileState: FileUploadState, idx: number) => {
        if (!token) return;

        // Update status to uploading
        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'uploading', progress: 0 } : u));

        try {
            // 1. Get signed URL
            const { signedUrl, gcsPath } = await publicFetch<{ signedUrl: string; gcsPath: string; bucket: string }>(
                `/api/public/upload/${token}/signed-url`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        filename: fileState.file.name,
                        contentType: fileState.file.type || 'application/octet-stream',
                        sizeBytes: fileState.file.size,
                        uploaderName: uploaderName || undefined,
                    }),
                }
            );

            // 2. Upload directly to GCS via PUT
            const xhr = new XMLHttpRequest();
            await new Promise<void>((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        setUploads(prev => prev.map((u, i) => i === idx ? { ...u, progress: pct } : u));
                    }
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload failed: ${xhr.status}`));
                });
                xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                xhr.open('PUT', signedUrl);
                xhr.setRequestHeader('Content-Type', fileState.file.type || 'application/octet-stream');
                xhr.send(fileState.file);
            });

            // 3. Confirm upload
            await publicFetch(`/api/public/upload/${token}/confirm`, {
                method: 'POST',
                body: JSON.stringify({
                    filename: fileState.file.name,
                    gcsPath,
                    sizeBytes: fileState.file.size,
                    contentType: fileState.file.type || 'application/octet-stream',
                    uploaderName: uploaderName || undefined,
                }),
            });

            setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'complete', progress: 100 } : u));
        } catch (e: any) {
            setUploads(prev => prev.map((u, i) => i === idx ? { ...u, status: 'error', error: e.message } : u));
        }
    }, [token, uploaderName]);

    // Handle file selection
    const handleFiles = useCallback((files: FileList | File[]) => {
        const newUploads: FileUploadState[] = Array.from(files).map(file => ({
            file,
            progress: 0,
            status: 'pending' as const,
        }));
        setUploads(prev => [...prev, ...newUploads]);
    }, []);

    // Start all pending uploads
    const startUploads = useCallback(() => {
        uploads.forEach((u, idx) => {
            if (u.status === 'pending') uploadFile(u, idx);
        });
    }, [uploads, uploadFile]);

    // Drag & drop handlers
    const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
    const onDragLeave = useCallback(() => setDragOver(false), []);
    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const pendingCount = uploads.filter(u => u.status === 'pending').length;
    const activeCount = uploads.filter(u => u.status === 'uploading').length;
    const completeCount = uploads.filter(u => u.status === 'complete').length;

    // ── Loading / Error States ──
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
                    <XCircle className="mx-auto mb-4 text-red-400" size={40} />
                    <h1 className="text-lg font-bold text-slate-800 mb-2">Link Unavailable</h1>
                    <p className="text-sm text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    if (!share) return null;

    const expiry = expiryLabel(share.expiresAt);

    // ── Expired State ──
    if (expiry.isExpired) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="bg-white border border-amber-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
                    <AlertTriangle className="mx-auto mb-4 text-amber-400" size={40} />
                    <h1 className="text-lg font-bold text-slate-800 mb-2">Link Expired</h1>
                    <p className="text-sm text-slate-500">
                        This upload link has expired. Contact the project team for a new link.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                        <Upload size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-bold text-slate-800 tracking-tight">
                            S2PX Upload Portal
                        </h1>
                        <p className="text-[11px] text-slate-400 font-mono">Scan2Plan OS X</p>
                    </div>
                    <div className={cn(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
                        expiry.isUrgent ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    )}>
                        <Clock size={11} />
                        {expiry.text}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                {/* Project Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <HardDrive size={20} className="text-blue-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-slate-800">
                                {share.label || `Upload for ${share.projectUpid}`}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                Project: {share.projectUpid}
                            </p>
                            <p className="text-xs text-slate-400">
                                Destination: <span className="font-mono">{share.targetBucket}</span>
                            </p>
                            {share.maxUploadBytes && (
                                <p className="text-xs text-slate-400 mt-1">
                                    Size limit: {formatFileSize(parseInt(share.maxUploadBytes))}
                                    {share.totalUploadedBytes && parseInt(share.totalUploadedBytes) > 0 && (
                                        <> · Used: {formatFileSize(parseInt(share.totalUploadedBytes))}</>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Uploader Name */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                        <User size={14} className="text-slate-400" />
                        Your Name <span className="text-slate-400 font-normal text-xs">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={uploaderName}
                        onChange={e => setUploaderName(e.target.value)}
                        placeholder="Enter your name to identify uploads"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    />
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        'bg-white border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all shadow-sm',
                        dragOver
                            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/50'
                    )}
                >
                    <FileUp size={36} className={cn(
                        'mx-auto mb-3 transition-colors',
                        dragOver ? 'text-blue-500' : 'text-slate-300'
                    )} />
                    <p className="text-sm font-medium text-slate-700">
                        Drop files here or <span className="text-blue-500 underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Point clouds, scans, and project files
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleFiles(e.target.files);
                                e.target.value = '';
                            }
                        }}
                    />
                </div>

                {/* Upload Queue */}
                {uploads.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Files size={14} className="text-slate-400" />
                                Upload Queue
                                <span className="text-xs font-normal text-slate-400">
                                    {completeCount}/{uploads.length} complete
                                </span>
                            </h3>
                            {pendingCount > 0 && (
                                <button
                                    onClick={startUploads}
                                    disabled={activeCount > 0}
                                    className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {activeCount > 0 ? 'Uploading...' : `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''}`}
                                </button>
                            )}
                        </div>

                        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                            {uploads.map((u, i) => (
                                <div key={`${u.file.name}-${i}`} className="px-5 py-3 flex items-center gap-3">
                                    <div className="shrink-0">
                                        {u.status === 'complete' ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        ) : u.status === 'error' ? (
                                            <XCircle size={16} className="text-red-400" />
                                        ) : u.status === 'uploading' ? (
                                            <Loader2 size={16} className="text-blue-500 animate-spin" />
                                        ) : (
                                            <FileUp size={16} className="text-slate-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 truncate">{u.file.name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                            {formatFileSize(u.file.size)}
                                            {u.error && <span className="text-red-400 ml-2">· {u.error}</span>}
                                        </p>
                                        {u.status === 'uploading' && (
                                            <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${u.progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400 tabular-nums shrink-0">
                                        {u.status === 'uploading' ? `${u.progress}%` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Previously Uploaded Files */}
                {share.files.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                Previously Uploaded
                                <span className="text-xs font-normal text-slate-400">{share.files.length} files</span>
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                            {share.files.map((f, i) => (
                                <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 truncate">{f.filename}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                            {formatFileSize(parseInt(f.sizeBytes))}
                                            {f.uploadedByName && <> · {f.uploadedByName}</>}
                                            {f.uploadedAt && <> · {formatDate(f.uploadedAt)}</>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="text-center py-6 text-[10px] text-slate-300 font-mono">
                S2PX · Scan2Plan OS X
            </footer>
        </div>
    );
}
