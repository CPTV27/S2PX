// ── Project Assets Component ──
// Browse and link GCS folders/files to a production project.
// Shows linked assets with file counts, sizes, and folder browsing.

import { useState, useEffect, useCallback } from 'react';
import {
    Folder, File, Link2, Unlink, RefreshCw, Download,
    Loader2, ChevronRight, ArrowLeft, Plus, HardDrive,
    Image, FileText, Archive, Film,
} from 'lucide-react';
import {
    fetchProjectAssets,
    linkProjectAsset,
    unlinkProjectAsset,
    refreshProjectAsset,
    browseProjectAsset,
    getAssetDownloadUrl,
    type ProjectAsset,
    type AssetBrowseResult,
} from '@/services/api';
import { cn } from '@/lib/utils';

const BUCKETS = [
    { id: 's2p-active-projects', label: 'Active Projects' },
    { id: 's2p-incoming-staging', label: 'Incoming Staging' },
    { id: 's2p-core-vault', label: 'Core Vault' },
];

interface Props {
    projectId: number;
    upid: string;
}

export function ProjectAssets({ projectId, upid }: Props) {
    const [assets, setAssets] = useState<ProjectAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [linking, setLinking] = useState(false);
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [browsingAsset, setBrowsingAsset] = useState<{ asset: ProjectAsset; result: AssetBrowseResult; path: string } | null>(null);
    const [browseLoading, setBrowseLoading] = useState(false);

    const loadAssets = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchProjectAssets(projectId);
            setAssets(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load assets');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { loadAssets(); }, [loadAssets]);

    const handleLink = async (bucket: string, gcsPath: string, label?: string) => {
        try {
            setLinking(true);
            await linkProjectAsset(projectId, { bucket, gcsPath, label });
            setShowLinkForm(false);
            await loadAssets();
        } catch (err: any) {
            setError(err.message || 'Failed to link asset');
        } finally {
            setLinking(false);
        }
    };

    const handleUnlink = async (assetId: number) => {
        try {
            await unlinkProjectAsset(projectId, assetId);
            await loadAssets();
            if (browsingAsset?.asset.id === assetId) setBrowsingAsset(null);
        } catch (err: any) {
            setError(err.message || 'Failed to unlink');
        }
    };

    const handleRefresh = async (assetId: number) => {
        try {
            await refreshProjectAsset(projectId, assetId);
            await loadAssets();
        } catch (err: any) {
            setError(err.message || 'Failed to refresh');
        }
    };

    const handleBrowse = async (asset: ProjectAsset, subPath?: string) => {
        try {
            setBrowseLoading(true);
            const result = await browseProjectAsset(projectId, asset.id, subPath);
            setBrowsingAsset({ asset, result, path: subPath || '' });
        } catch (err: any) {
            setError(err.message || 'Failed to browse');
        } finally {
            setBrowseLoading(false);
        }
    };

    const handleDownload = async (assetId: number, filePath: string) => {
        try {
            const { url } = await getAssetDownloadUrl(projectId, assetId, filePath);
            window.open(url, '_blank');
        } catch (err: any) {
            setError(err.message || 'Failed to get download URL');
        }
    };

    // ── Browsing view ──
    if (browsingAsset) {
        return (
            <BrowseView
                asset={browsingAsset.asset}
                result={browsingAsset.result}
                currentPath={browsingAsset.path}
                loading={browseLoading}
                onNavigate={(path) => handleBrowse(browsingAsset.asset, path)}
                onBack={() => setBrowsingAsset(null)}
                onDownload={(path) => handleDownload(browsingAsset.asset.id, path)}
            />
        );
    }

    // ── Asset list view ──
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <HardDrive size={16} className="text-blue-500" />
                    <h2 className="text-sm font-bold text-slate-700">Project Assets</h2>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {assets.length} linked
                    </span>
                </div>
                <button
                    onClick={() => setShowLinkForm(!showLinkForm)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    <Plus size={12} />
                    Link Folder
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Link form */}
            {showLinkForm && (
                <LinkForm
                    upid={upid}
                    linking={linking}
                    onLink={handleLink}
                    onCancel={() => setShowLinkForm(false)}
                />
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <HardDrive size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No assets linked yet.</p>
                    <p className="text-[10px] text-slate-300 mt-1">
                        Link a GCS folder to track project deliverables.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {assets.map(asset => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            onBrowse={() => handleBrowse(asset)}
                            onRefresh={() => handleRefresh(asset.id)}
                            onUnlink={() => handleUnlink(asset.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Asset Card ──

function AssetCard({
    asset,
    onBrowse,
    onRefresh,
    onUnlink,
}: {
    asset: ProjectAsset;
    onBrowse: () => void;
    onRefresh: () => void;
    onUnlink: () => void;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between">
                <button onClick={onBrowse} className="flex items-start gap-2.5 text-left min-w-0 flex-1 group">
                    <Folder size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                            {asset.label || asset.gcsPath.split('/').filter(Boolean).pop() || asset.gcsPath}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {asset.bucket}/{asset.gcsPath}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            {asset.fileCount !== null && (
                                <span className="text-[10px] text-slate-500">
                                    {asset.fileCount.toLocaleString()} file{asset.fileCount !== 1 ? 's' : ''}
                                </span>
                            )}
                            {asset.totalSizeBytes && (
                                <span className="text-[10px] text-slate-500">
                                    {formatBytes(parseInt(asset.totalSizeBytes))}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-300">
                                Linked {new Date(asset.linkedAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                        onClick={onRefresh}
                        className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                        title="Refresh counts"
                    >
                        <RefreshCw size={12} />
                    </button>
                    <button
                        onClick={onUnlink}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Unlink"
                    >
                        <Unlink size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Link Form ──

function LinkForm({
    upid,
    linking,
    onLink,
    onCancel,
}: {
    upid: string;
    linking: boolean;
    onLink: (bucket: string, path: string, label?: string) => void;
    onCancel: () => void;
}) {
    const [bucket, setBucket] = useState(BUCKETS[0].id);
    const [gcsPath, setGcsPath] = useState('');
    const [label, setLabel] = useState('');

    return (
        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-3">
            <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bucket</label>
                <select
                    value={bucket}
                    onChange={e => setBucket(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white"
                >
                    {BUCKETS.map(b => (
                        <option key={b.id} value={b.id}>{b.label} ({b.id})</option>
                    ))}
                </select>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    GCS Path
                </label>
                <input
                    type="text"
                    value={gcsPath}
                    onChange={e => setGcsPath(e.target.value)}
                    placeholder={`e.g. ${upid}/`}
                    className="w-full text-xs font-mono border border-slate-200 rounded-md px-2 py-1.5"
                />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Label <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Scan Data, Point Clouds"
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5"
                />
            </div>
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={() => onLink(bucket, gcsPath, label || undefined)}
                    disabled={!gcsPath.trim() || linking}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {linking ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    Link
                </button>
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 text-[11px] font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── Browse View ──

function BrowseView({
    asset,
    result,
    currentPath,
    loading,
    onNavigate,
    onBack,
    onDownload,
}: {
    asset: ProjectAsset;
    result: AssetBrowseResult;
    currentPath: string;
    loading: boolean;
    onNavigate: (path: string) => void;
    onBack: () => void;
    onDownload: (path: string) => void;
}) {
    // Build breadcrumb segments
    const segments = currentPath ? currentPath.split('/').filter(Boolean) : [];

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onBack}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                <Folder size={16} className="text-amber-500" />
                <span className="text-sm font-bold text-slate-700 truncate">
                    {asset.label || asset.gcsPath}
                </span>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[10px] text-slate-400 overflow-x-auto">
                <button
                    onClick={() => onNavigate('')}
                    className="hover:text-blue-600 transition-colors flex-shrink-0"
                >
                    root
                </button>
                {segments.map((seg, idx) => (
                    <div key={idx} className="flex items-center gap-1 flex-shrink-0">
                        <ChevronRight size={10} />
                        <button
                            onClick={() => onNavigate(segments.slice(0, idx + 1).join('/') + '/')}
                            className="hover:text-blue-600 transition-colors"
                        >
                            {seg}
                        </button>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                </div>
            ) : (
                <div className="space-y-1">
                    {/* Folders */}
                    {result.folders.map(folder => (
                        <button
                            key={folder.path}
                            onClick={() => onNavigate(folder.path)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors text-left group"
                        >
                            <Folder size={16} className="text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-slate-700 group-hover:text-blue-600 truncate">
                                {folder.name}
                            </span>
                            <ChevronRight size={12} className="text-slate-300 ml-auto flex-shrink-0" />
                        </button>
                    ))}

                    {/* Files */}
                    {result.files.map(file => (
                        <div
                            key={file.path}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <FileIcon contentType={file.contentType} />
                            <div className="min-w-0 flex-1">
                                <span className="text-xs text-slate-700 truncate block">{file.name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span>{formatBytes(file.size)}</span>
                                    {file.updated && (
                                        <span>{new Date(file.updated).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => onDownload(file.path)}
                                className="p-1 text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                                title="Download"
                            >
                                <Download size={14} />
                            </button>
                        </div>
                    ))}

                    {result.folders.length === 0 && result.files.length === 0 && (
                        <div className="text-center py-6 text-xs text-slate-400">
                            Empty folder
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Helpers ──

function FileIcon({ contentType }: { contentType: string }) {
    if (contentType.startsWith('image/')) return <Image size={16} className="text-purple-400 flex-shrink-0" />;
    if (contentType === 'application/pdf') return <FileText size={16} className="text-red-400 flex-shrink-0" />;
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('tar'))
        return <Archive size={16} className="text-amber-400 flex-shrink-0" />;
    if (contentType.startsWith('video/')) return <Film size={16} className="text-blue-400 flex-shrink-0" />;
    return <File size={16} className="text-slate-400 flex-shrink-0" />;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
