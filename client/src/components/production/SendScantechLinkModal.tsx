// ── Send Scantech Link Modal ──
// Creates and manages shareable scantech links for field technicians.
// Techs without Google accounts can access checklists, uploads, and notes via token-based URLs.

import { useState, useEffect } from 'react';
import {
    X, Link2, Send, Copy, Check, Loader2, Trash2,
    Clock, ExternalLink, AlertCircle,
} from 'lucide-react';
import {
    createScantechToken,
    fetchScantechTokens,
    revokeScantechToken,
    sendScantechTokenEmail,
    type ScantechTokenData,
} from '@/services/api';
import { cn } from '@/lib/utils';

interface SendScantechLinkModalProps {
    projectId: number;
    upid: string;
    projectName: string;
    onClose: () => void;
}

const EXPIRY_OPTIONS = [
    { label: '3 days', days: 3 },
    { label: '7 days', days: 7 },
    { label: '14 days', days: 14 },
    { label: '30 days', days: 30 },
];

export function SendScantechLinkModal({
    projectId,
    upid,
    projectName,
    onClose,
}: SendScantechLinkModalProps) {
    // Form state
    const [techName, setTechName] = useState('');
    const [techEmail, setTechEmail] = useState('');
    const [techPhone, setTechPhone] = useState('');
    const [expiryDays, setExpiryDays] = useState(7);

    // Actions
    const [creating, setCreating] = useState(false);
    const [sending, setSending] = useState<number | null>(null);
    const [revoking, setRevoking] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [createdLink, setCreatedLink] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Existing tokens
    const [tokens, setTokens] = useState<ScantechTokenData[]>([]);
    const [loadingTokens, setLoadingTokens] = useState(true);

    // Load existing tokens
    useEffect(() => {
        loadTokens();
    }, [projectId]);

    const loadTokens = async () => {
        try {
            setLoadingTokens(true);
            const data = await fetchScantechTokens(projectId);
            setTokens(data);
        } catch {
            /* silent */
        } finally {
            setLoadingTokens(false);
        }
    };

    const buildLinkUrl = (token: string) => {
        const base = window.location.origin;
        return `${base}/scantech-link/${token}`;
    };

    // Create token
    const handleCreate = async () => {
        if (!techName.trim()) {
            setError('Tech name is required');
            return;
        }
        setError(null);
        setCreating(true);
        try {
            const result = await createScantechToken({
                productionProjectId: projectId,
                techName: techName.trim(),
                techEmail: techEmail.trim() || undefined,
                techPhone: techPhone.trim() || undefined,
                expiresInDays: expiryDays,
            });
            const link = buildLinkUrl(result.token);
            setCreatedLink(link);
            await loadTokens();
            // Reset form
            setTechName('');
            setTechEmail('');
            setTechPhone('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create link');
        } finally {
            setCreating(false);
        }
    };

    // Copy to clipboard
    const handleCopy = async (link: string) => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Send via email
    const handleSendEmail = async (tokenId: number) => {
        setSending(tokenId);
        try {
            await sendScantechTokenEmail(tokenId);
            await loadTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send email');
        } finally {
            setSending(null);
        }
    };

    // Revoke token
    const handleRevoke = async (tokenId: number) => {
        setRevoking(tokenId);
        try {
            await revokeScantechToken(tokenId);
            await loadTokens();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke link');
        } finally {
            setRevoking(null);
        }
    };

    const activeTokens = tokens.filter(t => t.isActive && new Date(t.expiresAt) > new Date());
    const expiredTokens = tokens.filter(t => !t.isActive || new Date(t.expiresAt) <= new Date());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Send Field Link</h2>
                        <p className="text-xs text-gray-500 font-mono">{upid} &middot; {projectName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-5">
                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Created link success */}
                    {createdLink && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm font-medium text-green-800 mb-2">Link created!</p>
                            <div className="flex items-center gap-2">
                                <input
                                    value={createdLink}
                                    readOnly
                                    className="flex-1 text-xs font-mono bg-white border border-green-300 rounded px-2 py-1.5 text-green-900"
                                />
                                <button
                                    onClick={() => handleCopy(createdLink)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Create new link form */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Create New Link</h3>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Tech Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={techName}
                                onChange={(e) => setTechName(e.target.value)}
                                placeholder="e.g. John Smith"
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={techEmail}
                                    onChange={(e) => setTechEmail(e.target.value)}
                                    placeholder="tech@example.com"
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={techPhone}
                                    onChange={(e) => setTechPhone(e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Link Expiry
                            </label>
                            <div className="flex gap-2">
                                {EXPIRY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.days}
                                        onClick={() => setExpiryDays(opt.days)}
                                        className={cn(
                                            'flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors',
                                            expiryDays === opt.days
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !techName.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {creating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Link2 className="w-4 h-4" />
                            )}
                            {creating ? 'Creating...' : 'Create Link'}
                        </button>
                    </div>

                    {/* Active tokens */}
                    {loadingTokens ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : activeTokens.length > 0 ? (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-900">Active Links</h3>
                            {activeTokens.map((t) => (
                                <div key={t.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-medium text-gray-900">{t.techName}</span>
                                        <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Expires {new Date(t.expiresAt).toLocaleDateString()}
                                        </span>
                                        {t.accessCount > 0 && (
                                            <span>{t.accessCount} view{t.accessCount !== 1 ? 's' : ''}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleCopy(buildLinkUrl(t.token))}
                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                        >
                                            <Copy className="w-3 h-3" /> Copy
                                        </button>
                                        {t.techEmail && (
                                            <button
                                                onClick={() => handleSendEmail(t.id)}
                                                disabled={sending === t.id}
                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                                            >
                                                {sending === t.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Send className="w-3 h-3" />
                                                )}
                                                Email
                                            </button>
                                        )}
                                        <button
                                            onClick={() => window.open(buildLinkUrl(t.token), '_blank')}
                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                        >
                                            <ExternalLink className="w-3 h-3" /> Open
                                        </button>
                                        <button
                                            onClick={() => handleRevoke(t.id)}
                                            disabled={revoking === t.id}
                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 ml-auto"
                                        >
                                            {revoking === t.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3 h-3" />
                                            )}
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Expired / revoked tokens */}
                    {expiredTokens.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Expired / Revoked
                            </h3>
                            {expiredTokens.slice(0, 3).map((t) => (
                                <div key={t.id} className="p-2.5 bg-gray-50/50 border border-gray-100 rounded-lg opacity-60">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">{t.techName}</span>
                                        <span className="text-[10px] text-gray-400">
                                            {!t.isActive ? 'Revoked' : 'Expired'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
