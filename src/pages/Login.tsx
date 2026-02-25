import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ScanLine, Loader2 } from 'lucide-react';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Invalid credentials';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
                        <ScanLine size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Scan2Plan</h1>
                    <p className="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest">Studio</p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleLogin}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
                >
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                                placeholder="Enter username"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                                placeholder="Enter password"
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>
                </form>

                <p className="text-center text-slate-500 text-xs mt-6 font-mono">
                    Scan2Plan OS • v3.0
                </p>
            </div>
        </div>
    );
}
