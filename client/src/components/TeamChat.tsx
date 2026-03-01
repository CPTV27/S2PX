/**
 * TeamChat — S2PX Team Messaging Panel
 *
 * A floating panel for real-time team messaging with channels.
 * Sits above the AI ChatWidget FAB at bottom-6 right-20.
 *
 * Phase 17: Channel creation, channel settings, Google Chat webhook config,
 * message edit/delete, connection indicators.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Users,
    Hash,
    Send,
    Plus,
    Settings,
    X,
    ChevronDown,
    Loader2,
    Pencil,
    Trash2,
    Check,
    AlertCircle,
    ExternalLink,
    ArrowLeft,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
    fetchChatChannels,
    fetchChannelMessages,
    pollChannelMessages,
    sendTeamMessage,
    seedChatChannels,
    createChatChannel,
    updateChatChannel,
    editTeamMessage,
    deleteTeamMessage,
    testChatWebhook,
    type ChatChannel,
    type TeamMessage,
} from '@/services/api';

// ── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_EMOJIS = [
    '💬', '📡', '🏗️', '💰', '🎯', '📋', '🔔', '⚡',
    '🔧', '📊', '🗂️', '🚀', '📍', '🤝', '💡', '🏠',
    '📐', '🎨', '📦', '✅',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: string): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return new Date(date).toLocaleDateString();
}

function getInitials(firstName: string | null, lastName: string | null, email: string): string {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    return email.slice(0, 2).toUpperCase();
}

function getDisplayName(firstName: string | null, lastName: string | null, email: string): string {
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return email;
}

function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Deterministic avatar color from user id/email so it stays stable
const AVATAR_COLORS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500',
];

function avatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AvatarProps {
    firstName: string | null;
    lastName: string | null;
    email: string;
    size?: 'sm' | 'md';
}

function Avatar({ firstName, lastName, email, size = 'md' }: AvatarProps) {
    const initials = getInitials(firstName, lastName, email);
    const color = avatarColor(email);
    const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
    return (
        <div
            className={cn(
                'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
                color,
                sizeClass,
            )}
            aria-label={getDisplayName(firstName, lastName, email)}
        >
            {initials}
        </div>
    );
}

interface MessageBubbleProps {
    msg: TeamMessage;
    isOwn: boolean;
    showAvatar: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    isEditing?: boolean;
    editContent?: string;
    onEditChange?: (value: string) => void;
    onEditSave?: () => void;
    onEditCancel?: () => void;
}

function MessageBubble({
    msg, isOwn, showAvatar, onEdit, onDelete,
    isEditing, editContent, onEditChange, onEditSave, onEditCancel,
}: MessageBubbleProps) {
    if (msg.messageType === 'system') {
        return (
            <div className="flex justify-center my-2">
                <span className="text-[11px] text-s2p-muted bg-s2p-secondary px-3 py-1 rounded-full">
                    {msg.content}
                </span>
            </div>
        );
    }

    if (isOwn) {
        return (
            <div className="flex justify-end items-end gap-2 mb-1 group">
                {/* Hover actions */}
                {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 mr-1">
                        <button
                            onClick={onEdit}
                            className="p-1 rounded text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary transition-colors"
                            title="Edit message"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1 rounded text-s2p-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete message"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
                <div className="flex flex-col items-end gap-0.5 max-w-[75%]">
                    {showAvatar && (
                        <span className="text-[10px] text-s2p-muted mr-1">
                            {relativeTime(msg.createdAt)}
                        </span>
                    )}
                    {isEditing ? (
                        <div className="flex flex-col gap-1 w-full min-w-[180px]">
                            <input
                                value={editContent}
                                onChange={(e) => onEditChange?.(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onEditSave?.();
                                    if (e.key === 'Escape') onEditCancel?.();
                                }}
                                className="bg-white border border-s2p-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-s2p-primary/30"
                                autoFocus
                            />
                            <div className="flex gap-1 justify-end">
                                <button onClick={onEditCancel} className="text-[10px] text-s2p-muted hover:text-s2p-fg px-2 py-0.5">
                                    Cancel
                                </button>
                                <button onClick={onEditSave} className="text-[10px] text-s2p-primary font-medium px-2 py-0.5">
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="bg-s2p-primary text-white rounded-2xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                            role="article"
                            aria-label={`Your message: ${msg.content}`}
                        >
                            {msg.content}
                        </div>
                    )}
                    {msg.editedAt && !isEditing && (
                        <span className="text-[10px] text-s2p-muted mr-1">edited</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-end gap-2 mb-1">
            <div className="flex-shrink-0 w-8">
                {showAvatar && (
                    <Avatar firstName={msg.firstName} lastName={msg.lastName} email={msg.email} />
                )}
            </div>
            <div className="flex flex-col gap-0.5 max-w-[75%]">
                {showAvatar && (
                    <div className="flex items-baseline gap-1.5 ml-1">
                        <span className="text-xs font-semibold text-s2p-fg">
                            {getDisplayName(msg.firstName, msg.lastName, msg.email)}
                        </span>
                        <span className="text-[10px] text-s2p-muted">
                            {relativeTime(msg.createdAt)}
                        </span>
                    </div>
                )}
                <div
                    className="bg-s2p-secondary border border-s2p-border text-s2p-fg rounded-2xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                    role="article"
                    aria-label={`${getDisplayName(msg.firstName, msg.lastName, msg.email)}: ${msg.content}`}
                >
                    {msg.content}
                </div>
                {msg.editedAt && (
                    <span className="text-[10px] text-s2p-muted ml-1">edited</span>
                )}
            </div>
        </div>
    );
}

interface ChannelItemProps {
    channel: ChatChannel;
    isActive: boolean;
    onClick: () => void;
}

function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                isActive
                    ? 'bg-s2p-primary/10 text-s2p-primary font-medium'
                    : 'text-s2p-fg hover:bg-s2p-secondary',
            )}
            aria-current={isActive ? 'true' : undefined}
        >
            <span className="text-base leading-none flex-shrink-0" aria-hidden="true">
                {channel.emoji || '#'}
            </span>
            <span className="flex-1 truncate">{channel.displayName}</span>
            {channel.googleChatWebhookUrl && (
                <span className="text-green-500 flex-shrink-0" title="Connected to Google Chat">
                    <ExternalLink size={10} />
                </span>
            )}
            {channel.recentCount && channel.recentCount > 0 ? (
                <span className="text-[10px] bg-s2p-primary text-white rounded-full px-1.5 py-0.5 font-mono leading-none">
                    {channel.recentCount > 99 ? '99+' : channel.recentCount}
                </span>
            ) : null}
        </button>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TeamChat() {
    const { user } = useAuth();

    // Panel state
    const [isOpen, setIsOpen] = useState(false);
    const [showChannelList, setShowChannelList] = useState(true);
    const [showChannelDropdown, setShowChannelDropdown] = useState(false);

    // Data state
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
    const [messages, setMessages] = useState<TeamMessage[]>([]);

    // UI state
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    // Create channel state
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelEmoji, setNewChannelEmoji] = useState('💬');
    const [newChannelDescription, setNewChannelDescription] = useState('');
    const [creatingChannel, setCreatingChannel] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Channel settings state
    const [showChannelSettings, setShowChannelSettings] = useState(false);
    const [settingsDisplayName, setSettingsDisplayName] = useState('');
    const [settingsEmoji, setSettingsEmoji] = useState('');
    const [settingsDescription, setSettingsDescription] = useState('');
    const [settingsWebhookUrl, setSettingsWebhookUrl] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'error' | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    // Message edit/delete state
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Auto-scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // ── Load channels on first open ──────────────────────────────────────────
    const loadChannels = useCallback(async () => {
        setLoading(true);
        try {
            let fetched = await fetchChatChannels();
            if (fetched.length === 0) {
                fetched = await seedChatChannels();
            }
            setChannels(fetched);
            if (!activeChannel) {
                const defaultCh = fetched.find(c => c.isDefault) ?? fetched[0] ?? null;
                setActiveChannel(defaultCh);
            }
        } catch (err) {
            console.error('[TeamChat] Failed to load channels:', err);
        } finally {
            setLoading(false);
        }
    }, [activeChannel]);

    useEffect(() => {
        if (isOpen && channels.length === 0) {
            loadChannels();
        }
    }, [isOpen, channels.length, loadChannels]);

    // ── Load messages when channel changes ───────────────────────────────────
    useEffect(() => {
        if (!activeChannel) return;
        let cancelled = false;
        (async () => {
            try {
                const msgs = await fetchChannelMessages(activeChannel.id);
                if (!cancelled) setMessages(msgs);
            } catch (err) {
                console.error('[TeamChat] Failed to load messages:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [activeChannel]);

    // ── Poll for new messages every 3 seconds ────────────────────────────────
    useEffect(() => {
        if (!isOpen || !activeChannel) return;
        const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
        const interval = setInterval(async () => {
            try {
                const newMsgs = await pollChannelMessages(activeChannel.id, lastId);
                if (newMsgs.length > 0) {
                    setMessages(prev => [
                        ...prev,
                        ...newMsgs.filter(m => !prev.find(p => p.id === m.id)),
                    ]);
                    if (!isOpen) setHasUnread(true);
                }
            } catch {
                // Swallow poll errors silently — network blip
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen, activeChannel, messages]);

    // Clear unread badge on open
    useEffect(() => {
        if (isOpen) setHasUnread(false);
    }, [isOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowChannelDropdown(false);
            }
        }
        if (showChannelDropdown) {
            document.addEventListener('mousedown', handleClick);
        }
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showChannelDropdown]);

    // ── Send message ─────────────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        if (!input.trim() || sending || !activeChannel || !user) return;
        const content = input.trim();
        setInput('');
        setSending(true);

        // Optimistic update
        const optimistic: TeamMessage = {
            id: Date.now(), // temp id — will be replaced by poll
            channelId: activeChannel.id,
            userId: Number(user.id),
            content,
            messageType: 'text',
            parentId: null,
            editedAt: null,
            createdAt: new Date().toISOString(),
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            email: user.email,
            profileImageUrl: user.profileImageUrl ?? null,
        };
        setMessages(prev => [...prev, optimistic]);

        try {
            const sent = await sendTeamMessage(activeChannel.id, {
                content,
                userId: Number(user.id),
            });
            // Replace optimistic message with real one
            setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
        } catch (err) {
            console.error('[TeamChat] Failed to send message:', err);
            // Remove optimistic on failure
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
            setInput(content); // restore
        } finally {
            setSending(false);
        }
    }, [input, sending, activeChannel, user]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleChannelSelect = useCallback((channel: ChatChannel) => {
        setActiveChannel(channel);
        setMessages([]);
        setShowChannelDropdown(false);
        setShowChannelSettings(false);
        setEditingMessageId(null);
    }, []);

    // ── Create channel ───────────────────────────────────────────────────────
    const handleCreateChannel = useCallback(async () => {
        if (!newChannelName.trim()) {
            setCreateError('Channel name is required');
            return;
        }
        setCreateError(null);
        setCreatingChannel(true);
        try {
            const slug = slugify(newChannelName);
            const created = await createChatChannel({
                name: slug,
                displayName: newChannelName.trim(),
                emoji: newChannelEmoji,
                description: newChannelDescription.trim() || undefined,
            });
            // Reload channels and select the new one
            const fetched = await fetchChatChannels();
            setChannels(fetched);
            const newCh = fetched.find(c => c.id === created.id) ?? created;
            setActiveChannel(newCh);
            // Reset form
            setNewChannelName('');
            setNewChannelEmoji('💬');
            setNewChannelDescription('');
            setShowCreateChannel(false);
        } catch (err: any) {
            setCreateError(err?.message ?? 'Failed to create channel');
        } finally {
            setCreatingChannel(false);
        }
    }, [newChannelName, newChannelEmoji, newChannelDescription]);

    // ── Channel settings ─────────────────────────────────────────────────────
    const openChannelSettings = useCallback(() => {
        if (!activeChannel) return;
        setSettingsDisplayName(activeChannel.displayName);
        setSettingsEmoji(activeChannel.emoji || '💬');
        setSettingsDescription(activeChannel.description || '');
        setSettingsWebhookUrl(activeChannel.googleChatWebhookUrl || '');
        setWebhookTestResult(null);
        setSettingsError(null);
        setShowChannelSettings(true);
    }, [activeChannel]);

    const handleSaveSettings = useCallback(async () => {
        if (!activeChannel) return;
        setSavingSettings(true);
        setSettingsError(null);
        try {
            const updated = await updateChatChannel(activeChannel.id, {
                displayName: settingsDisplayName.trim(),
                emoji: settingsEmoji,
                description: settingsDescription.trim() || null,
                googleChatWebhookUrl: settingsWebhookUrl.trim() || null,
            } as any);
            // Refresh channels list
            const fetched = await fetchChatChannels();
            setChannels(fetched);
            const refreshed = fetched.find(c => c.id === activeChannel.id) ?? updated;
            setActiveChannel(refreshed);
            setShowChannelSettings(false);
        } catch (err: any) {
            setSettingsError(err?.message ?? 'Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    }, [activeChannel, settingsDisplayName, settingsEmoji, settingsDescription, settingsWebhookUrl]);

    const handleTestWebhook = useCallback(async () => {
        if (!activeChannel) return;
        setTestingWebhook(true);
        setWebhookTestResult(null);
        try {
            // Save webhook URL first if it changed
            if (settingsWebhookUrl.trim() !== (activeChannel.googleChatWebhookUrl || '')) {
                await updateChatChannel(activeChannel.id, {
                    googleChatWebhookUrl: settingsWebhookUrl.trim() || null,
                } as any);
            }
            await testChatWebhook(activeChannel.id);
            setWebhookTestResult('success');
        } catch {
            setWebhookTestResult('error');
        } finally {
            setTestingWebhook(false);
        }
    }, [activeChannel, settingsWebhookUrl]);

    // ── Message edit/delete ───────────────────────────────────────────────────
    const handleEditStart = useCallback((msg: TeamMessage) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
    }, []);

    const handleEditSave = useCallback(async () => {
        if (!editingMessageId || !editContent.trim()) return;
        try {
            const updated = await editTeamMessage(editingMessageId, editContent.trim());
            setMessages(prev => prev.map(m =>
                m.id === editingMessageId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m
            ));
        } catch (err) {
            console.error('[TeamChat] Edit failed:', err);
        }
        setEditingMessageId(null);
        setEditContent('');
    }, [editingMessageId, editContent]);

    const handleEditCancel = useCallback(() => {
        setEditingMessageId(null);
        setEditContent('');
    }, []);

    const handleDelete = useCallback(async (msgId: number) => {
        if (!confirm('Delete this message?')) return;
        try {
            await deleteTeamMessage(msgId);
            setMessages(prev => prev.filter(m => m.id !== msgId));
        } catch (err) {
            console.error('[TeamChat] Delete failed:', err);
        }
    }, []);

    // ── Should we show an avatar for this message? ───────────────────────────
    function shouldShowAvatar(msgs: TeamMessage[], idx: number): boolean {
        if (idx === 0) return true;
        const prev = msgs[idx - 1];
        const curr = msgs[idx];
        if (prev.userId !== curr.userId) return true;
        const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
        return timeDiff > 5 * 60 * 1000;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className={cn(
                    'fixed bottom-6 right-24 w-12 h-12 rounded-full shadow-xl flex items-center justify-center z-40',
                    'bg-indigo-600 text-white',
                    'transition-transform duration-150 hover:scale-110 active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
                )}
                aria-label={isOpen ? 'Close team chat' : 'Open team chat'}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                {isOpen ? <X size={20} /> : <Users size={20} />}
                {hasUnread && !isOpen && (
                    <span
                        className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"
                        aria-label="Unread messages"
                    />
                )}
            </button>

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Team Chat"
                className={cn(
                    'fixed bottom-24 right-6 w-[420px] h-[600px] max-h-[80vh]',
                    'bg-white border border-s2p-border rounded-2xl shadow-2xl flex z-50 overflow-hidden',
                    'transition-all duration-200 origin-bottom-right',
                    isOpen
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-95 pointer-events-none',
                )}
            >
                {/* Channel Sidebar */}
                <div
                    className={cn(
                        'border-r border-s2p-border bg-s2p-secondary/40 flex flex-col transition-all duration-200 overflow-hidden',
                        showChannelList ? 'w-[140px]' : 'w-0',
                    )}
                    aria-hidden={!showChannelList}
                >
                    <div className="px-3 py-3 border-b border-s2p-border">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-s2p-muted">
                            Channels
                        </span>
                    </div>

                    {/* Channel list or create form */}
                    {showCreateChannel ? (
                        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
                            <div className="flex items-center gap-1 mb-1">
                                <button
                                    onClick={() => { setShowCreateChannel(false); setCreateError(null); }}
                                    className="p-0.5 rounded text-s2p-muted hover:text-s2p-fg"
                                >
                                    <ArrowLeft size={12} />
                                </button>
                                <span className="text-[10px] font-semibold text-s2p-fg">New Channel</span>
                            </div>
                            <input
                                type="text"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                                placeholder="Channel name"
                                className="w-full text-xs border border-s2p-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-s2p-primary/30 focus:border-s2p-primary"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel(); }}
                            />
                            {newChannelName.trim() && (
                                <p className="text-[9px] text-s2p-muted font-mono px-0.5">
                                    #{slugify(newChannelName)}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-1">
                                {CHANNEL_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => setNewChannelEmoji(emoji)}
                                        className={cn(
                                            'w-6 h-6 text-sm flex items-center justify-center rounded transition-colors',
                                            newChannelEmoji === emoji
                                                ? 'bg-s2p-primary/20 ring-1 ring-s2p-primary'
                                                : 'hover:bg-s2p-secondary',
                                        )}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={newChannelDescription}
                                onChange={(e) => setNewChannelDescription(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                className="w-full text-xs border border-s2p-border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-s2p-primary/30 focus:border-s2p-primary"
                            />
                            {createError && (
                                <p className="text-[10px] text-red-600 flex items-center gap-1">
                                    <AlertCircle size={10} /> {createError}
                                </p>
                            )}
                            <button
                                onClick={handleCreateChannel}
                                disabled={creatingChannel || !newChannelName.trim()}
                                className="w-full flex items-center justify-center gap-1 bg-s2p-primary text-white text-xs font-medium py-1.5 rounded-lg disabled:opacity-50 hover:bg-s2p-accent transition-colors"
                            >
                                {creatingChannel ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                {creatingChannel ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    ) : (
                        <nav
                            className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5"
                            aria-label="Channel list"
                        >
                            {loading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 size={16} className="animate-spin text-s2p-muted" />
                                </div>
                            ) : (
                                channels.map(ch => (
                                    <ChannelItem
                                        key={ch.id}
                                        channel={ch}
                                        isActive={activeChannel?.id === ch.id}
                                        onClick={() => handleChannelSelect(ch)}
                                    />
                                ))
                            )}
                        </nav>
                    )}

                    {/* Add channel button */}
                    {!showCreateChannel && (
                        <div className="p-2 border-t border-s2p-border">
                            <button
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary rounded-lg transition-colors"
                                aria-label="Add channel"
                                title="Add channel"
                                onClick={() => setShowCreateChannel(true)}
                            >
                                <Plus size={13} />
                                <span>Add channel</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Main pane */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-s2p-border bg-s2p-secondary/30 flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Sidebar toggle */}
                            <button
                                onClick={() => setShowChannelList(prev => !prev)}
                                className="p-1 rounded text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary transition-colors flex-shrink-0"
                                aria-label={showChannelList ? 'Hide channels' : 'Show channels'}
                                title={showChannelList ? 'Hide channels' : 'Show channels'}
                            >
                                <Hash size={16} />
                            </button>

                            {/* Channel selector dropdown */}
                            <div className="relative min-w-0" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowChannelDropdown(prev => !prev)}
                                    className="flex items-center gap-1.5 font-semibold text-s2p-fg hover:text-s2p-primary transition-colors truncate max-w-[160px]"
                                    aria-haspopup="listbox"
                                    aria-expanded={showChannelDropdown}
                                >
                                    <span className="text-base leading-none" aria-hidden="true">
                                        {activeChannel?.emoji ?? '#'}
                                    </span>
                                    <span className="truncate text-sm">
                                        {activeChannel?.displayName ?? 'Select channel'}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={cn(
                                            'flex-shrink-0 transition-transform duration-150',
                                            showChannelDropdown && 'rotate-180',
                                        )}
                                    />
                                </button>

                                {/* Dropdown list */}
                                {showChannelDropdown && (
                                    <div
                                        role="listbox"
                                        aria-label="Select channel"
                                        className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-s2p-border rounded-xl shadow-lg z-10 py-1 overflow-hidden"
                                    >
                                        {channels.map(ch => (
                                            <button
                                                key={ch.id}
                                                role="option"
                                                aria-selected={activeChannel?.id === ch.id}
                                                onClick={() => handleChannelSelect(ch)}
                                                className={cn(
                                                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                                                    activeChannel?.id === ch.id
                                                        ? 'bg-s2p-primary/10 text-s2p-primary font-medium'
                                                        : 'text-s2p-fg hover:bg-s2p-secondary',
                                                )}
                                            >
                                                <span aria-hidden="true">{ch.emoji ?? '#'}</span>
                                                <span className="flex-1 truncate">{ch.displayName}</span>
                                                {ch.googleChatWebhookUrl && (
                                                    <ExternalLink size={10} className="text-green-500 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Header actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    showChannelSettings
                                        ? 'text-s2p-primary bg-s2p-primary/10'
                                        : 'text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary',
                                )}
                                aria-label="Channel settings"
                                title="Channel settings"
                                onClick={() => showChannelSettings ? setShowChannelSettings(false) : openChannelSettings()}
                            >
                                <Settings size={16} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary transition-colors"
                                aria-label="Close team chat"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Channel Settings Panel (replaces messages area) */}
                    {showChannelSettings && activeChannel ? (
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowChannelSettings(false)}
                                    className="p-1 rounded text-s2p-muted hover:text-s2p-fg hover:bg-s2p-secondary"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <h3 className="text-sm font-semibold text-s2p-fg">Channel Settings</h3>
                            </div>

                            {/* Display Name */}
                            <div>
                                <label className="text-[11px] font-medium text-s2p-muted block mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={settingsDisplayName}
                                    onChange={(e) => setSettingsDisplayName(e.target.value)}
                                    className="w-full text-sm border border-s2p-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-s2p-primary/30 focus:border-s2p-primary"
                                />
                            </div>

                            {/* Emoji */}
                            <div>
                                <label className="text-[11px] font-medium text-s2p-muted block mb-1">Emoji</label>
                                <div className="flex flex-wrap gap-1">
                                    {CHANNEL_EMOJIS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => setSettingsEmoji(emoji)}
                                            className={cn(
                                                'w-7 h-7 text-sm flex items-center justify-center rounded transition-colors',
                                                settingsEmoji === emoji
                                                    ? 'bg-s2p-primary/20 ring-1 ring-s2p-primary'
                                                    : 'hover:bg-s2p-secondary',
                                            )}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[11px] font-medium text-s2p-muted block mb-1">Description</label>
                                <textarea
                                    value={settingsDescription}
                                    onChange={(e) => setSettingsDescription(e.target.value)}
                                    rows={2}
                                    className="w-full text-sm border border-s2p-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-s2p-primary/30 focus:border-s2p-primary"
                                    placeholder="Channel description..."
                                />
                            </div>

                            {/* Google Chat Webhook */}
                            <div className="border-t border-s2p-border pt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={14} className="text-s2p-muted" />
                                    <span className="text-[11px] font-medium text-s2p-muted">Google Chat Integration</span>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                        settingsWebhookUrl.trim()
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-500',
                                    )}>
                                        {settingsWebhookUrl.trim() ? '● Connected' : '○ Not connected'}
                                    </span>
                                </div>
                                <input
                                    type="url"
                                    value={settingsWebhookUrl}
                                    onChange={(e) => { setSettingsWebhookUrl(e.target.value); setWebhookTestResult(null); }}
                                    className="w-full text-xs font-mono border border-s2p-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-s2p-primary/30 focus:border-s2p-primary"
                                    placeholder="https://chat.googleapis.com/v1/spaces/..."
                                />
                                <p className="text-[9px] text-s2p-muted mt-1">
                                    Paste a Google Chat incoming webhook URL. Messages sent here will forward to that space.
                                </p>
                                {settingsWebhookUrl.trim() && (
                                    <button
                                        onClick={handleTestWebhook}
                                        disabled={testingWebhook}
                                        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-s2p-primary hover:text-s2p-accent disabled:opacity-50 transition-colors"
                                    >
                                        {testingWebhook ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : webhookTestResult === 'success' ? (
                                            <Check size={12} className="text-green-600" />
                                        ) : webhookTestResult === 'error' ? (
                                            <AlertCircle size={12} className="text-red-500" />
                                        ) : (
                                            <Zap size={12} />
                                        )}
                                        {testingWebhook ? 'Sending test...'
                                            : webhookTestResult === 'success' ? 'Test sent!'
                                            : webhookTestResult === 'error' ? 'Test failed — check URL'
                                            : 'Send test message'}
                                    </button>
                                )}
                            </div>

                            {/* Error */}
                            {settingsError && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle size={12} /> {settingsError}
                                </p>
                            )}

                            {/* Save */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowChannelSettings(false)}
                                    className="flex-1 text-sm text-s2p-muted py-2 rounded-lg hover:bg-s2p-secondary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings || !settingsDisplayName.trim()}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-s2p-primary text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50 hover:bg-s2p-accent transition-colors"
                                >
                                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {savingSettings ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Messages area */}
                            <div
                                className="flex-1 overflow-y-auto px-4 py-3"
                                role="log"
                                aria-live="polite"
                                aria-label="Messages"
                            >
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-s2p-muted">
                                        <Loader2 size={24} className="animate-spin text-s2p-primary" />
                                        <span className="text-sm">Loading messages...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-s2p-muted">
                                        <span className="text-3xl" aria-hidden="true">
                                            {activeChannel?.emoji ?? '💬'}
                                        </span>
                                        <p className="text-sm font-medium">
                                            {activeChannel
                                                ? `No messages in ${activeChannel.displayName} yet`
                                                : 'Select a channel to start chatting'}
                                        </p>
                                        <p className="text-xs">Be the first to say something!</p>
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((msg, idx) => (
                                            <MessageBubble
                                                key={msg.id}
                                                msg={msg}
                                                isOwn={String(msg.userId) === String(user?.id)}
                                                showAvatar={shouldShowAvatar(messages, idx)}
                                                onEdit={() => handleEditStart(msg)}
                                                onDelete={() => handleDelete(msg.id)}
                                                isEditing={editingMessageId === msg.id}
                                                editContent={editContent}
                                                onEditChange={setEditContent}
                                                onEditSave={handleEditSave}
                                                onEditCancel={handleEditCancel}
                                            />
                                        ))}
                                    </>
                                )}
                                <div ref={messagesEndRef} aria-hidden="true" />
                            </div>

                            {/* Input area */}
                            <div className="px-3 py-3 border-t border-s2p-border bg-white flex-shrink-0">
                                {/* Channel context label */}
                                <div className="flex items-center gap-1 mb-2">
                                    <Hash size={11} className="text-s2p-muted" />
                                    <span className="text-[11px] text-s2p-muted font-mono">
                                        {activeChannel?.displayName ?? 'No channel selected'}
                                    </span>
                                    {activeChannel?.googleChatWebhookUrl && (
                                        <span className="text-[9px] text-green-600 flex items-center gap-0.5 ml-auto">
                                            <ExternalLink size={8} /> Google Chat
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={
                                            activeChannel
                                                ? `Message ${activeChannel.displayName}...`
                                                : 'Select a channel first...'
                                        }
                                        disabled={!activeChannel || sending}
                                        aria-label="Message input"
                                        className={cn(
                                            'flex-1 bg-s2p-secondary border border-s2p-border rounded-xl px-3 py-2 text-sm',
                                            'focus:outline-none focus:border-s2p-primary focus:ring-1 focus:ring-s2p-primary/20',
                                            'placeholder:text-s2p-muted transition-all',
                                            'disabled:opacity-50 disabled:cursor-not-allowed',
                                        )}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || sending || !activeChannel}
                                        aria-label="Send message"
                                        className={cn(
                                            'w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0',
                                            'bg-s2p-primary text-white transition-all',
                                            'hover:bg-s2p-accent disabled:opacity-40 disabled:cursor-not-allowed',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-s2p-primary focus-visible:ring-offset-1',
                                        )}
                                    >
                                        {sending ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Send size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
