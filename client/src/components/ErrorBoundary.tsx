import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/** Detect stale chunk errors caused by a new deploy while the browser has cached HTML */
function isChunkLoadError(error: Error): boolean {
    const msg = error.message || '';
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('error loading dynamically imported module')
    );
}

const RELOAD_KEY = 's2px-chunk-reload';

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);

        // Auto-reload once for stale chunk errors (new deploy with new hashes)
        if (isChunkLoadError(error)) {
            const lastReload = sessionStorage.getItem(RELOAD_KEY);
            const now = Date.now();
            // Only auto-reload if we haven't reloaded in the last 30 seconds
            if (!lastReload || now - parseInt(lastReload, 10) > 30_000) {
                sessionStorage.setItem(RELOAD_KEY, String(now));
                window.location.reload();
                return;
            }
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    handleHardReload = () => {
        sessionStorage.removeItem(RELOAD_KEY);
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            const isStaleChunk = this.state.error && isChunkLoadError(this.state.error);

            return (
                <div className="min-h-screen bg-s2p-bg flex items-center justify-center p-8">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl">
                            <AlertTriangle size={32} className="text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-s2p-fg mb-2">
                                {isStaleChunk ? 'New version available' : 'Something went wrong'}
                            </h1>
                            <p className="text-sm text-s2p-muted">
                                {isStaleChunk
                                    ? 'S2PX has been updated. Click below to load the latest version.'
                                    : 'An unexpected error occurred. Try refreshing the page or navigating back.'}
                            </p>
                        </div>
                        {!isStaleChunk && this.state.error && (
                            <pre className="text-xs text-left bg-slate-800 text-red-300 rounded-xl p-4 overflow-auto max-h-40 border border-slate-700">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={isStaleChunk ? this.handleHardReload : this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-s2p-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                            >
                                <RefreshCw size={14} />
                                {isStaleChunk ? 'Reload S2PX' : 'Try Again'}
                            </button>
                            <a
                                href="/dashboard"
                                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                            >
                                Go to Dashboard
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
