import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
    HardDrive,
    Folder,
    FileText,
    Upload,
    Download,
    Trash2,
    RefreshCw,
    ChevronRight,
    Home,
    AlertCircle,
    File,
    Image,
    FileArchive,
} from 'lucide-react';
import { listFiles, uploadFile, getFileDownloadUrl, deleteFile, BUCKETS, type BucketKey } from '@/services/storage';
import { cn } from '@/lib/utils';
import type { StorageFile } from '@/types';

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getFileIcon(contentType: string) {
    if (contentType === 'folder') return Folder;
    if (contentType.startsWith('image/')) return Image;
    if (contentType.includes('zip') || contentType.includes('archive')) return FileArchive;
    if (contentType.includes('pdf') || contentType.includes('text')) return FileText;
    return File;
}

export function StorageBrowser() {
    const [activeBucket, setActiveBucket] = useState<BucketKey>('active' as BucketKey);
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const bucketName = BUCKETS[activeBucket];

    const loadFiles = useCallback(async (bucket?: string, path?: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listFiles(bucket ?? bucketName, path ?? currentPath);
            setFiles(result);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to list files';
            setError(msg);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [bucketName, currentPath]);

    const handleBucketChange = (key: BucketKey) => {
        setActiveBucket(key);
        setCurrentPath('');
        setFiles([]);
        setError(null);
        // Load files for new bucket
        const newBucket = BUCKETS[key];
        setLoading(true);
        listFiles(newBucket, '')
            .then(setFiles)
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Failed to list files');
                setFiles([]);
            })
            .finally(() => setLoading(false));
    };

    const navigateToFolder = (folderPath: string) => {
        setCurrentPath(folderPath);
        setLoading(true);
        listFiles(bucketName, folderPath)
            .then(setFiles)
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Failed to list files');
                setFiles([]);
            })
            .finally(() => setLoading(false));
    };

    const navigateUp = () => {
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        const parentPath = parts.join('/');
        navigateToFolder(parentPath);
    };

    const handleFileUpload = async (fileList: FileList) => {
        setUploading(true);
        setError(null);
        try {
            for (const file of Array.from(fileList)) {
                const path = currentPath ? `${currentPath}/${file.name}` : file.name;
                await uploadFile(bucketName, path, file);
            }
            await loadFiles();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (file: StorageFile) => {
        try {
            const url = await getFileDownloadUrl(file.bucket, file.fullPath);
            window.open(url, '_blank');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Download failed');
        }
    };

    const handleDelete = async (file: StorageFile) => {
        try {
            await deleteFile(file.bucket, file.fullPath);
            setDeleteConfirm(null);
            await loadFiles();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Delete failed');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    };

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Cloud Storage</h2>
                    <p className="text-s2p-muted text-sm mt-1">Browse and manage files across GCS buckets.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2.5 bg-s2p-primary text-white rounded-xl font-medium text-sm hover:bg-s2p-accent transition-colors cursor-pointer">
                        <Upload size={16} />
                        Upload
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        />
                    </label>
                    <button
                        onClick={() => loadFiles()}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-s2p-secondary text-s2p-fg rounded-xl font-medium text-sm hover:bg-s2p-border transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Bucket Tabs */}
            <div className="flex gap-2">
                {(Object.keys(BUCKETS) as BucketKey[]).map((key) => (
                    <button
                        key={key}
                        onClick={() => handleBucketChange(key)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                            activeBucket === key
                                ? "bg-s2p-primary text-white border-s2p-primary shadow-md shadow-blue-500/10"
                                : "bg-white text-s2p-muted border-s2p-border hover:border-s2p-muted hover:text-s2p-fg"
                        )}
                    >
                        <HardDrive size={14} />
                        {BUCKETS[key]}
                    </button>
                ))}
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1 text-sm">
                <button
                    onClick={() => navigateToFolder('')}
                    className="flex items-center gap-1 text-s2p-muted hover:text-s2p-primary transition-colors"
                >
                    <Home size={14} />
                    <span className="font-mono">{bucketName}</span>
                </button>
                {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                        <ChevronRight size={12} className="text-s2p-muted" />
                        <button
                            onClick={() => navigateToFolder(breadcrumbs.slice(0, i + 1).join('/'))}
                            className="text-s2p-muted hover:text-s2p-primary transition-colors font-mono"
                        >
                            {crumb}
                        </button>
                    </span>
                ))}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* File List / Drop Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "bg-white border rounded-2xl overflow-hidden transition-colors",
                    dragOver ? "border-s2p-primary border-dashed bg-blue-50/30" : "border-s2p-border"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-s2p-secondary/50 border-b border-s2p-border text-xs font-semibold text-s2p-muted uppercase tracking-wider">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-2">Modified</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-16 text-s2p-muted">
                        <RefreshCw size={24} className="animate-spin" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && files.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center py-16 text-s2p-muted">
                        {dragOver ? (
                            <>
                                <Upload size={40} className="mb-3 text-s2p-primary" />
                                <p className="font-medium text-s2p-primary">Drop files here to upload</p>
                            </>
                        ) : (
                            <>
                                <HardDrive size={40} className="mb-3 opacity-30" />
                                <p className="font-medium">No files found</p>
                                <p className="text-sm mt-1">Click "Refresh" to load files, or drag & drop to upload.</p>
                            </>
                        )}
                    </div>
                )}

                {/* Uploading overlay */}
                {uploading && (
                    <div className="flex items-center gap-2 px-6 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
                        <RefreshCw size={14} className="animate-spin" />
                        Uploading...
                    </div>
                )}

                {/* Go Up */}
                {currentPath && !loading && (
                    <button
                        onClick={navigateUp}
                        className="grid grid-cols-12 gap-4 px-6 py-3 w-full text-left hover:bg-s2p-secondary/30 transition-colors border-b border-s2p-border/50"
                    >
                        <div className="col-span-6 flex items-center gap-3 text-sm text-s2p-muted">
                            <Folder size={18} />
                            ..
                        </div>
                        <div className="col-span-6" />
                    </button>
                )}

                {/* File Rows */}
                {!loading && files.map((file) => {
                    const Icon = getFileIcon(file.contentType);
                    return (
                        <div
                            key={file.fullPath}
                            className={cn(
                                "grid grid-cols-12 gap-4 px-6 py-3 border-b border-s2p-border/50 transition-colors group",
                                file.isFolder ? "hover:bg-blue-50/30 cursor-pointer" : "hover:bg-s2p-secondary/30"
                            )}
                            onClick={file.isFolder ? () => navigateToFolder(file.fullPath) : undefined}
                        >
                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                <Icon
                                    size={18}
                                    className={cn(
                                        file.isFolder ? "text-blue-500" : "text-s2p-muted"
                                    )}
                                />
                                <span className="text-sm font-medium truncate">
                                    {file.name}
                                </span>
                            </div>
                            <div className="col-span-2 text-sm text-s2p-muted font-mono self-center">
                                {formatFileSize(file.size)}
                            </div>
                            <div className="col-span-2 text-sm text-s2p-muted self-center">
                                {formatDate(file.updated)}
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!file.isFolder && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                            className="p-1.5 rounded-lg hover:bg-s2p-secondary text-s2p-muted hover:text-s2p-fg transition-colors"
                                            title="Download"
                                        >
                                            <Download size={14} />
                                        </button>
                                        {deleteConfirm === file.fullPath ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                                                className="px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-medium"
                                            >
                                                Confirm
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.fullPath); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-s2p-muted hover:text-red-500 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
}
