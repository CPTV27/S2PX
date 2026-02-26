import { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getGoogleLoginUrl } from '@/services/api';
import { ScanLine, Loader2 } from 'lucide-react';

export function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { isAuthenticated, isLoading } = useAuth();

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
    const authError = searchParams.get('error');

    // If already authenticated, redirect to dashboard
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate, from]);

    const handleGoogleLogin = () => {
        window.location.href = getGoogleLoginUrl();
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

                {/* Login card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="space-y-5">
                        {authError && (
                            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                                Authentication failed. Please try again.
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 size={24} className="animate-spin text-blue-400" />
                                <span className="ml-3 text-slate-400 text-sm">Checking session...</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleGoogleLogin}
                                className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Sign in with Google
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-center text-slate-500 text-xs mt-6 font-mono">
                    Scan2Plan OS • v3.0
                </p>
            </div>
        </div>
    );
}
