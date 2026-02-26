import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    BarChart3,
    BookOpen,
    Settings,
    LogOut,
    Sparkles,
    ScanLine,
    HardDrive,
    Factory,
    Activity,
    Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ChatWidget } from './ChatWidget';
import { TourOverlay } from './TourOverlay';
import { TourTrigger } from './TourTrigger';
import { useAuth } from '@/hooks/useAuth';
import { useTour } from '@/hooks/useTour';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { CommandPalette } from './CommandPalette';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Pipeline', path: '/dashboard/pipeline' },
    { icon: Factory, label: 'Production', path: '/dashboard/production' },
    { icon: FolderKanban, label: 'Archive', path: '/dashboard/projects' },
    { icon: BarChart3, label: 'Revenue', path: '/dashboard/revenue' },
    { icon: Activity, label: 'Scorecard', path: '/dashboard/scorecard' },
    { icon: BookOpen, label: 'Knowledge Base', path: '/dashboard/knowledge' },
    { icon: HardDrive, label: 'Cloud Storage', path: '/dashboard/storage' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
] as const;

const tourIdMap: Record<string, string> = {
    '/dashboard': 'nav-dashboard',
    '/dashboard/pipeline': 'nav-pipeline',
    '/dashboard/production': 'nav-production',
    '/dashboard/projects': 'nav-archive',
    '/dashboard/revenue': 'nav-revenue',
    '/dashboard/scorecard': 'nav-scorecard',
    '/dashboard/knowledge': 'nav-knowledge',
    '/dashboard/storage': 'nav-storage',
    '/dashboard/settings': 'nav-settings',
};

export function DashboardLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { hasCompleted: tourCompleted, start: startTour } = useTour();
    const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useCommandPalette();

    // Auto-start tour on first visit
    useEffect(() => {
        if (!tourCompleted) {
            const t = setTimeout(startTour, 800);
            return () => clearTimeout(t);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const displayName = user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email ?? 'User';
    const initials = user?.firstName && user?.lastName
        ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
        : displayName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-s2p-bg text-s2p-fg flex">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-20 lg:w-64 bg-s2p-sidebar-bg text-s2p-sidebar-fg border-r border-slate-700/50 flex flex-col fixed h-full z-50"
            >
                {/* Logo */}
                <div data-tour="sidebar-logo" className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-700/50">
                    <div className="w-10 h-10 bg-s2p-primary rounded-xl flex items-center justify-center text-white">
                        <ScanLine size={22} />
                    </div>
                    <div className="hidden lg:block ml-3">
                        <span className="font-bold text-lg text-white tracking-tight">S2P<span className="text-blue-400">X</span></span>
                        <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-mono">Scan2Plan OS</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-6 space-y-1 px-2 lg:px-3">
                    {navItems.map((item) => {
                        const isExternal = 'external' in item && item.external;
                        const isActive = !isExternal && (
                            location.pathname === item.path ||
                            (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
                        );
                        const Icon = item.icon;
                        const classes = cn(
                            "flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                            isActive
                                ? "bg-s2p-primary text-white shadow-lg shadow-blue-500/20"
                                : "text-slate-400 hover:bg-s2p-sidebar-hover hover:text-white"
                        );

                        if (isExternal) {
                            return (
                                <a
                                    key={item.path}
                                    href={item.path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes}
                                >
                                    <Icon size={20} className="min-w-[20px]" />
                                    <span className="hidden lg:block ml-3 text-sm font-medium">{item.label}</span>
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={classes}
                                data-tour={tourIdMap[item.path]}
                            >
                                <Icon size={20} className="min-w-[20px]" />
                                <span className="hidden lg:block ml-3 text-sm font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-3 border-t border-slate-700/50 space-y-1">
                    <TourTrigger />
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center lg:justify-start w-full px-3 py-2.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800/50"
                    >
                        <LogOut size={18} />
                        <span className="hidden lg:block ml-3 text-xs font-mono uppercase tracking-wider">Logout</span>
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 ml-20 lg:ml-64 min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-s2p-border px-8 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xs font-mono text-s2p-muted uppercase tracking-widest">Scan2Plan OS X</h2>
                        <h1 className="text-xl font-semibold text-s2p-fg">Operations Center</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-mono text-s2p-muted bg-s2p-secondary px-3 py-1.5 rounded-lg">
                            <Sparkles size={12} className="text-s2p-primary" />
                            <span>Gemini 2.5</span>
                        </div>
                        <button
                            onClick={openSearch}
                            data-tour="search-button"
                            className="flex items-center gap-1.5 text-xs text-s2p-muted hover:text-s2p-fg bg-s2p-secondary hover:bg-s2p-secondary/80 px-2.5 py-1.5 rounded-lg border border-s2p-border transition-colors"
                            title="Search Knowledge Base (⌘K)"
                        >
                            <Search size={12} />
                            <span className="hidden md:inline">Search</span>
                            <kbd className="hidden md:inline text-[10px] bg-white/80 px-1 py-0.5 rounded border border-s2p-border font-mono">⌘K</kbd>
                        </button>
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-semibold">{displayName}</div>
                            <div className="text-xs text-s2p-muted capitalize">{user?.role ?? 'User'}</div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-s2p-primary/10 border border-s2p-border flex items-center justify-center text-s2p-primary font-bold text-sm">
                            {initials}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8">
                    <Outlet />
                </div>
            </main>

            <ChatWidget />
            <CommandPalette isOpen={searchOpen} onClose={closeSearch} />
            <TourOverlay />
        </div>
    );
}
