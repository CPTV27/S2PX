import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { fetchCurrentUser } from '@/services/api';
import type { User } from '@/types';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: true,
        isAuthenticated: false,
    });

    const refreshUser = useCallback(async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            setState({ user: null, isLoading: false, isAuthenticated: false });
            return;
        }

        try {
            const user = await fetchCurrentUser();
            if (user) {
                setState({ user, isLoading: false, isAuthenticated: true });
                return;
            }
        } catch {
            // Backend unreachable — fall through to DEV bypass or unauthenticated
        }

        // DEV bypass: when backend is unreachable locally, use Firebase user info
        if (import.meta.env.DEV) {
            const nameParts = (firebaseUser.displayName || '').split(' ');
            setState({
                user: {
                    id: firebaseUser.uid,
                    email: firebaseUser.email || 'unknown',
                    firstName: nameParts[0] || 'Dev',
                    lastName: nameParts.slice(1).join(' ') || 'User',
                    role: 'ceo',
                    profileImageUrl: firebaseUser.photoURL || '',
                } as User,
                isLoading: false,
                isAuthenticated: true,
            });
            return;
        }

        setState({ user: null, isLoading: false, isAuthenticated: false });
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                await refreshUser();
            } else {
                setState({ user: null, isLoading: false, isAuthenticated: false });
            }
        });
        return unsubscribe;
    }, [refreshUser]);

    const logout = useCallback(async () => {
        await signOut(auth);
        setState({ user: null, isLoading: false, isAuthenticated: false });
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
