import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Cloud, Key, CheckCircle, XCircle, RefreshCw, HardDrive, Flame } from 'lucide-react';
import { checkHealth } from '@/services/api';
import { checkFirestoreConnection } from '@/services/firestore';
import { checkStorageConnection, BUCKETS } from '@/services/storage';
import { cn } from '@/lib/utils';

interface StatusItem {
    label: string;
    detail: string;
    icon: typeof Database;
    color: string;
    ok: boolean;
    loading?: boolean;
}

export function Settings() {
    const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [firestoreStatus, setFirestoreStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [storageStatus, setStorageStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
    const [storageBuckets, setStorageBuckets] = useState<string[]>([]);
    const geminiConfigured = !!process.env.GEMINI_API_KEY;
    const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

    const checkAll = () => {
        // Backend
        setBackendStatus('checking');
        checkHealth()
            .then(() => setBackendStatus('connected'))
            .catch(() => setBackendStatus('disconnected'));

        // Firestore
        setFirestoreStatus('checking');
        checkFirestoreConnection()
            .then((ok) => setFirestoreStatus(ok ? 'connected' : 'disconnected'))
            .catch(() => setFirestoreStatus('disconnected'));

        // Cloud Storage — check each bucket
        setStorageStatus('checking');
        const bucketNames = Object.values(BUCKETS);
        Promise.all(bucketNames.map((b) => checkStorageConnection(b).then((ok) => ok ? b : null)))
            .then((results) => {
                const connected = results.filter(Boolean) as string[];
                setStorageBuckets(connected);
                setStorageStatus(connected.length > 0 ? 'connected' : 'disconnected');
            })
            .catch(() => setStorageStatus('disconnected'));
    };

    useEffect(() => {
        checkAll();
    }, []);

    const statusItems: StatusItem[] = [
        {
            label: 'S2PX Backend',
            detail: backendStatus === 'connected' ? 'Connected' : backendStatus === 'checking' ? 'Checking...' : 'Disconnected',
            icon: Database,
            color: 'blue',
            ok: backendStatus === 'connected',
            loading: backendStatus === 'checking',
        },
        {
            label: 'Gemini API',
            detail: geminiConfigured ? 'Active' : 'Not Configured',
            icon: Key,
            color: 'purple',
            ok: geminiConfigured,
        },
        {
            label: 'Firebase Hosting',
            detail: 'dt27-studio.web.app',
            icon: Cloud,
            color: 'green',
            ok: true,
        },
        {
            label: 'Firestore',
            detail: firestoreStatus === 'connected'
                ? `Connected (${firebaseProjectId})`
                : firestoreStatus === 'checking' ? 'Checking...' : 'Disconnected',
            icon: Flame,
            color: 'orange',
            ok: firestoreStatus === 'connected',
            loading: firestoreStatus === 'checking',
        },
        {
            label: 'Cloud Storage',
            detail: storageStatus === 'connected'
                ? `${storageBuckets.length} bucket${storageBuckets.length !== 1 ? 's' : ''}`
                : storageStatus === 'checking' ? 'Checking...' : 'Disconnected',
            icon: HardDrive,
            color: 'cyan',
            ok: storageStatus === 'connected',
            loading: storageStatus === 'checking',
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-s2p-fg">Settings</h2>
                    <p className="text-s2p-muted text-sm mt-1">System configuration and connection status.</p>
                </div>
                <button
                    onClick={checkAll}
                    className="flex items-center gap-2 px-4 py-2.5 bg-s2p-secondary text-s2p-fg rounded-xl font-medium text-sm hover:bg-s2p-border transition-colors"
                >
                    <RefreshCw size={16} />
                    Refresh Status
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* System Status */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8"
                >
                    <h3 className="text-lg font-semibold mb-6">System Status</h3>
                    <div className="space-y-4">
                        {statusItems.map(item => (
                            <div
                                key={item.label}
                                className="flex items-center justify-between p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(`p-2 rounded-lg bg-${item.color}-50 text-${item.color}-500`)}>
                                        <item.icon size={18} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{item.label}</div>
                                        <div className="text-xs text-s2p-muted font-mono">{item.detail}</div>
                                    </div>
                                </div>
                                {item.loading ? (
                                    <RefreshCw size={14} className="animate-spin text-s2p-muted" />
                                ) : item.ok ? (
                                    <CheckCircle size={16} className="text-green-500" />
                                ) : (
                                    <XCircle size={16} className="text-red-500" />
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* About */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-s2p-border rounded-2xl p-8"
                >
                    <h3 className="text-lg font-semibold mb-6">About</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl">
                            <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">Platform</div>
                            <div className="font-medium">Scan2Plan OS X</div>
                        </div>
                        <div className="p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl">
                            <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">Version</div>
                            <div className="font-medium font-mono">vX.1</div>
                        </div>
                        <div className="p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl">
                            <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">Architecture</div>
                            <div className="font-medium">S2PX Engine + PostgreSQL + Firebase</div>
                        </div>
                        <div className="p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl">
                            <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">AI Engine</div>
                            <div className="font-medium">Gemini 2.5 Flash / Pro</div>
                        </div>
                        {firebaseProjectId && (
                            <div className="p-4 bg-s2p-secondary/50 border border-s2p-border rounded-xl">
                                <div className="text-xs text-s2p-muted font-mono uppercase tracking-wider mb-1">Firebase Project</div>
                                <div className="font-medium font-mono">{firebaseProjectId}</div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
