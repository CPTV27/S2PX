// ── User Management ──
// Team management table for CEO/admin. Lists all users with role dropdowns.
// Renders inside Settings page.

import { useState, useEffect } from 'react';
import { Loader2, Users, Shield, AlertCircle, Check } from 'lucide-react';
import { fetchUsers, updateUserRole } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, type AppRole, APP_ROLES } from '@shared/permissions';
import { cn } from '@/lib/utils';

interface UserRecord {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    profileImageUrl: string | null;
    updatedAt?: string;
}

export function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<number | null>(null);
    const [saved, setSaved] = useState<number | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await fetchUsers() as unknown as UserRecord[];
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: number, newRole: AppRole) => {
        setUpdating(userId);
        try {
            await updateUserRole(userId, newRole);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setSaved(userId);
            setTimeout(() => setSaved(null), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update role');
        } finally {
            setUpdating(null);
        }
    };

    const getInitials = (u: UserRecord) => {
        const first = u.firstName?.[0] || '';
        const last = u.lastName?.[0] || '';
        return (first + last).toUpperCase() || u.email[0].toUpperCase();
    };

    const canEditRole = currentUser?.role === 'ceo' || currentUser?.role === 'admin';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-s2p-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-s2p-secondary/50 border-b border-s2p-border">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-s2p-muted uppercase tracking-wider">
                                Team Member
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-s2p-muted uppercase tracking-wider">
                                Role
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-s2p-muted uppercase tracking-wider hidden sm:table-cell">
                                Last Active
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-s2p-border">
                        {users.map((u) => {
                            const isCurrentUser = String(u.id) === currentUser?.id;
                            return (
                                <tr key={u.id} className={cn(
                                    'hover:bg-s2p-secondary/30 transition-colors',
                                    isCurrentUser && 'bg-blue-50/30',
                                )}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {u.profileImageUrl ? (
                                                <img
                                                    src={u.profileImageUrl}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {getInitials(u)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate">
                                                    {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                                                    {isCurrentUser && (
                                                        <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                                            You
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {canEditRole && !isCurrentUser ? (
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                                                    disabled={updating === u.id}
                                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
                                                >
                                                    {APP_ROLES.map((role) => (
                                                        <option key={role} value={role}>
                                                            {ROLE_LABELS[role]}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={cn(
                                                    'text-xs font-semibold px-2 py-1 rounded-full',
                                                    u.role === 'ceo' ? 'bg-purple-100 text-purple-700'
                                                        : u.role === 'admin' ? 'bg-blue-100 text-blue-700'
                                                        : u.role === 'scantech' ? 'bg-amber-100 text-amber-700'
                                                        : u.role === 'viewer' ? 'bg-gray-100 text-gray-600'
                                                        : 'bg-green-100 text-green-700',
                                                )}>
                                                    {ROLE_LABELS[u.role as AppRole] || u.role}
                                                </span>
                                            )}
                                            {updating === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                                            {saved === u.id && <Check className="w-3.5 h-3.5 text-green-500" />}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <span className="text-xs text-gray-500">
                                            {u.updatedAt
                                                ? new Date(u.updatedAt).toLocaleDateString('en-US', {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                  })
                                                : '—'
                                            }
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-s2p-muted">
                {users.length} team member{users.length !== 1 ? 's' : ''}
                {' '}&middot; Roles control dashboard access and sidebar visibility.
            </p>
        </div>
    );
}
