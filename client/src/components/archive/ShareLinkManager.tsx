// ShareLinkManager — Manage upload share links for a production project.
// Renders inside ArchiveDetail right column.
//
// Features:
//   • Create new share link (label, expiry days, max size)
//   • List existing shares with copy-link, expiry, upload count
//   • Revoke (deactivate) a share link

import { useEffect, useState, useCallback } from 'react';
import {
    Copy,
    ExternalLink,
    Link2,
    Loader2,
    Plus,
    Shield,
    Trash2,
    Upload,
    X,
    CheckCircle2,
    Clock,
    Files,
} from 'lucide-react';
import {
    createUploadShare,
    fetchUploadShares,
    revokeUploadShare,
    type UploadShareData,
} from '@/services/api';
import { cn } from '@/lib/utils';

interface ShareLinkManagerProps {
    projectId: number;
}

function expiryLabel(iso: string): { text: string; isExpired: boolean; isUrgent: boolean } {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', isExpired: true, isUrgent: false };
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return { text: `${Math.ceil(hours)}h left`, isExpired: false, isUrgent: true };
    const days = Math.ceil(hours / 24);
    return { text: `${days}d left`, isExpired: false, isUrgent: days <= 2 };
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ShareLinkManager({ projectId }: ShareLinkManagerProps) {
    const [shares, setShares] = useState<UploadShareData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Create form state
    const [label, setLabel] = useState('');
    const [expiryDays, setExpiryDays] = useState(7);

    const load = useCallback(async () => {
        try {
            const data = await fetchUploadShares(projectId);
            setShares(data);
        } catch (e) {
            console.error('Failed to load shares:', e);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            await createUploadShare({
                projectId,
                label: label || undefined,
                expiresInDays: expiryDays,
            });
            setShowCreate(false);
            setLabel('');
            setExpiryDays(7);
            await load();
        } catch (e) {
            console.error('Failed to create share:', e);
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id: number) => {
        try {
            await revokeUploadShare(id);
            await load();
        } catch (e) {
            console.error('Failed to revoke share:', e);
        }
    };

    const copyLink = (share: UploadShareData) => {
        const url = `${window.location.origin}/upload/${share.token}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(share.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const activeShares = shares.filter(s => s.isActive);
    const expiredShares = shares.filter(s => !s.isActive);

    return (
        <div className="bg-white border border-s2p-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-s2p-border/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-s2p-fg flex items-center gap-2">
                    <Upload size={14} className="text-blue-500" />
                    Upload Links
                </h3>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className={cn(
                        'p-1.5 rounded-lg transition-colors',
                        showCreate
                            ? 'bg-red-50 text-red-500 hover:bg-red-100'
                            : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                    )}
                >
                    {showCreate ? <X size={13} /> : <Plus size={13} />}
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="px-4 py-3 border-b border-s2p-border/50 bg-blue-50/30 space-y-3">
                    <div>
                        <label className="text-[10px] text-s2p-muted uppercase tracking-wider font-medium">
                            Label (optional)
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder="e.g. Point cloud upload for site visit"
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-s2p-border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] text-s2p-muted uppercase tracking-wider font-medium">
                                Expires in
                            </label>
                            <select
                                value={expiryDays}
                                onChange={e => setExpiryDays(Number(e.target.value))}
                                className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-s2p-border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
                            >
                                <option value={1}>1 day</option>
                                <option value={3}>3 days</option>
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                            </select>
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            {creating ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
                            Create
                        </button>
                    </div>
                </div>
            )}

            {/* Share List */}
            <div className="divide-y divide-s2p-border/30">
                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 size={14} className="animate-spin text-s2p-muted" />
                    </div>
                ) : activeShares.length === 0 && expiredShares.length === 0 ? (
                    <div className="text-center py-6 text-s2p-muted text-xs">
                        <Upload size={20} className="mx-auto mb-1 opacity-30" />
                        <p>No upload links yet</p>
                        <p className="text-[10px] mt-0.5">Create one to let team members upload files</p>
                    </div>
                ) : (
                    <>
                        {activeShares.map(share => {
                            const exp = expiryLabel(share.expiresAt);
                            return (
                                <div key={share.id} className="px-4 py-3 group hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-2">
                                        <Shield size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-s2p-fg truncate">
                                                {share.label || 'Upload Link'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-s2p-muted">
                                                <span className={cn(
                                                    'flex items-center gap-0.5',
                                                    exp.isExpired ? 'text-red-400' : exp.isUrgent ? 'text-amber-500' : ''
                                                )}>
                                                    <Clock size={8} />
                                                    {exp.text}
                                                </span>
                                                <span>·</span>
                                                <span className="flex items-center gap-0.5">
                                                    <Files size={8} />
                                                    {share.uploadCount || 0} files
                                                </span>
                                                <span>·</span>
                                                <span>{formatDate(share.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => copyLink(share)}
                                                className="p-1.5 rounded-lg text-s2p-muted hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                title="Copy link"
                                            >
                                                {copiedId === share.id ? (
                                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                                ) : (
                                                    <Copy size={12} />
                                                )}
                                            </button>
                                            <a
                                                href={`/upload/${share.token}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg text-s2p-muted hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                                title="Open portal"
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                            <button
                                                onClick={() => handleRevoke(share.id)}
                                                className="p-1.5 rounded-lg text-s2p-muted hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Revoke"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {expiredShares.length > 0 && (
                            <div className="px-4 py-2 bg-slate-50/50">
                                <p className="text-[10px] text-s2p-muted uppercase tracking-wider font-medium mb-1">
                                    Revoked / Expired ({expiredShares.length})
                                </p>
                                {expiredShares.slice(0, 3).map(share => (
                                    <div key={share.id} className="flex items-center gap-2 py-1 text-xs text-s2p-muted opacity-50">
                                        <Shield size={10} />
                                        <span className="truncate flex-1">{share.label || 'Upload Link'}</span>
                                        <span className="text-[10px]">{share.uploadCount || 0} files</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
