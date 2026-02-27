// ── Scantech Upload Tab ──
// Camera capture + file picker → signed URL upload → GCS.
// Large files (Trimble .e57/.rcp, 4K video) go direct-to-bucket.

import { useState, useRef, useCallback } from 'react';
import {
    Camera, FileUp, UploadCloud, Loader2, CheckCircle, AlertCircle,
    X, File, Image, Video, HardDrive, Pause, Play, RotateCcw,
} from 'lucide-react';
import { useScantechContext } from './ScantechLayout';
import {
    getFieldUploadSignedUrl,
    confirmFieldUpload,
    type FileCategory,
    type CaptureMethod,
    type FieldUploadRecord,
} from '@/services/api';
import { cn } from '@/lib/utils';

// ── File type → category mapping ──

const SCAN_EXTENSIONS = ['.e57', '.ptx', '.rcp', '.rcs', '.las', '.laz'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

function detectCategory(file: File): FileCategory {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (SCAN_EXTENSIONS.includes(ext)) return 'scan_file';
    if (PHOTO_TYPES.includes(file.type)) return 'photo';
    if (VIDEO_TYPES.includes(file.type)) return 'video';
    return 'document';
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const categoryIcon: Record<FileCategory, React.ComponentType<{ className?: string }>> = {
    photo: Image,
    video: Video,
    scan_file: HardDrive,
    document: File,
};

// ── Upload queue item ──

interface UploadItem {
    id: string;
    file: File;
    category: FileCategory;
    captureMethod: CaptureMethod;
    progress: number;
    status: 'pending' | 'uploading' | 'confirming' | 'done' | 'error' | 'paused';
    error?: string;
    xhr?: XMLHttpRequest;
    signedUrl?: string;
    gcsPath?: string;
    bucket?: string;
    retryCount: number;
}

const MAX_RETRIES = 3;
const ACCEPTED_FILES =
    'image/*,video/*,.e57,.ptx,.rcp,.rcs,.las,.laz,.pdf,.dwg,.rvt';

export function UploadTab() {
    const { project, reloadProject, online } = useScantechContext();
    const [queue, setQueue] = useState<UploadItem[]>([]);
    const cameraRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Add files to queue ──
    const addFiles = useCallback((files: FileList, method: CaptureMethod) => {
        const items: UploadItem[] = Array.from(files).map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            category: detectCategory(file),
            captureMethod: method,
            progress: 0,
            status: 'pending' as const,
            retryCount: 0,
        }));
        setQueue((prev) => [...prev, ...items]);

        // Auto-start uploads
        for (const item of items) {
            startUpload(item);
        }
    }, [project.id, online]);

    // ── Upload a single file ──
    const startUpload = async (item: UploadItem) => {
        if (!online) {
            updateItem(item.id, { status: 'error', error: 'Offline — try again when connected' });
            return;
        }

        updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });

        try {
            // Step 1: Get signed URL
            const { signedUrl, gcsPath, bucket } = await getFieldUploadSignedUrl(project.id, {
                filename: item.file.name,
                contentType: item.file.type || 'application/octet-stream',
                sizeBytes: item.file.size,
                fileCategory: item.category,
                captureMethod: item.captureMethod,
            });

            updateItem(item.id, { signedUrl, gcsPath, bucket });

            // Step 2: XHR PUT directly to GCS
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        updateItem(item.id, { progress: pct });
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error'));
                xhr.onabort = () => reject(new Error('Upload cancelled'));

                xhr.open('PUT', signedUrl, true);
                xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
                xhr.send(item.file);

                updateItem(item.id, { xhr });
            });

            // Step 3: Confirm upload
            updateItem(item.id, { status: 'confirming', progress: 100 });
            await confirmFieldUpload(project.id, {
                filename: item.file.name,
                gcsPath,
                bucket,
                sizeBytes: item.file.size,
                contentType: item.file.type || 'application/octet-stream',
                fileCategory: item.category,
                captureMethod: item.captureMethod,
            });

            updateItem(item.id, { status: 'done' });
            reloadProject();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            const currentRetry = getItem(item.id)?.retryCount ?? 0;

            if (currentRetry < MAX_RETRIES && message !== 'Upload cancelled') {
                // Exponential backoff retry
                updateItem(item.id, { retryCount: currentRetry + 1, status: 'pending' });
                const delay = Math.pow(2, currentRetry) * 1000;
                setTimeout(() => {
                    const updated = getItem(item.id);
                    if (updated && updated.status === 'pending') {
                        startUpload(updated);
                    }
                }, delay);
            } else {
                updateItem(item.id, { status: 'error', error: message });
            }
        }
    };

    // ── Queue helpers ──
    const updateItem = (id: string, patch: Partial<UploadItem>) => {
        setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    };

    const getItem = (id: string): UploadItem | undefined => {
        return queue.find((q) => q.id === id);
    };

    const pauseUpload = (id: string) => {
        const item = queue.find((q) => q.id === id);
        if (item?.xhr) {
            item.xhr.abort();
            updateItem(id, { status: 'paused', xhr: undefined });
        }
    };

    const resumeUpload = (id: string) => {
        const item = queue.find((q) => q.id === id);
        if (item) startUpload(item);
    };

    const retryUpload = (id: string) => {
        const item = queue.find((q) => q.id === id);
        if (item) {
            updateItem(id, { retryCount: 0 });
            startUpload(item);
        }
    };

    const removeItem = (id: string) => {
        const item = queue.find((q) => q.id === id);
        if (item?.xhr) item.xhr.abort();
        setQueue((prev) => prev.filter((q) => q.id !== id));
    };

    // ── Existing uploads from server ──
    const existingUploads = project.uploads;

    return (
        <div className="space-y-4">
            {/* ── Capture Buttons ── */}
            <div className="grid grid-cols-2 gap-3">
                {/* Camera */}
                <button
                    onClick={() => cameraRef.current?.click()}
                    className="bg-blue-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-blue-700 active:bg-blue-800 touch-manipulation transition-colors"
                >
                    <Camera className="w-6 h-6" />
                    <span className="text-sm font-semibold">Camera</span>
                    <span className="text-[10px] opacity-80">Photo or Video</span>
                </button>
                <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files, 'camera')}
                />

                {/* File picker */}
                <button
                    onClick={() => fileRef.current?.click()}
                    className="bg-gray-800 text-white rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-gray-900 active:bg-black touch-manipulation transition-colors"
                >
                    <FileUp className="w-6 h-6" />
                    <span className="text-sm font-semibold">Files</span>
                    <span className="text-[10px] opacity-80">Scans, Docs</span>
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_FILES}
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files, 'file_picker')}
                />
            </div>

            {/* ── Upload Queue ── */}
            {queue.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Upload Queue</h3>
                    <div className="space-y-2">
                        {queue.map((item) => {
                            const Icon = categoryIcon[item.category];
                            return (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-lg border border-gray-200 p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 truncate">{item.file.name}</p>
                                            <p className="text-xs text-gray-500">{formatSize(item.file.size)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {item.status === 'uploading' && (
                                                <button
                                                    onClick={() => pauseUpload(item.id)}
                                                    className="p-1.5 rounded hover:bg-gray-100 touch-manipulation"
                                                >
                                                    <Pause className="w-4 h-4 text-gray-500" />
                                                </button>
                                            )}
                                            {item.status === 'paused' && (
                                                <button
                                                    onClick={() => resumeUpload(item.id)}
                                                    className="p-1.5 rounded hover:bg-gray-100 touch-manipulation"
                                                >
                                                    <Play className="w-4 h-4 text-blue-600" />
                                                </button>
                                            )}
                                            {item.status === 'error' && (
                                                <button
                                                    onClick={() => retryUpload(item.id)}
                                                    className="p-1.5 rounded hover:bg-gray-100 touch-manipulation"
                                                >
                                                    <RotateCcw className="w-4 h-4 text-amber-600" />
                                                </button>
                                            )}
                                            {item.status === 'done' && (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            )}
                                            {item.status !== 'done' && (
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-1.5 rounded hover:bg-gray-100 touch-manipulation"
                                                >
                                                    <X className="w-3.5 h-3.5 text-gray-400" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    {(item.status === 'uploading' || item.status === 'confirming') && (
                                        <div className="mt-2">
                                            <div className="bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                                                {item.status === 'confirming' ? 'Confirming…' : `${item.progress}%`}
                                            </p>
                                        </div>
                                    )}
                                    {item.error && (
                                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> {item.error}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Existing Uploads ── */}
            {existingUploads.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Uploaded Files ({existingUploads.length})
                    </h3>
                    <div className="space-y-2">
                        {existingUploads.map((u) => {
                            const Icon = categoryIcon[u.fileCategory as FileCategory] || File;
                            return (
                                <div
                                    key={u.id}
                                    className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
                                >
                                    <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 truncate">{u.filename}</p>
                                        <p className="text-xs text-gray-500">
                                            {formatSize(parseInt(u.sizeBytes, 10))} • {u.fileCategory}
                                        </p>
                                    </div>
                                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {queue.length === 0 && existingUploads.length === 0 && (
                <div className="text-center py-10">
                    <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No uploads yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                        Capture photos or upload Trimble scan files
                    </p>
                </div>
            )}
        </div>
    );
}
