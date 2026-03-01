import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { canAccessRoute, ROLE_DEFAULT_ROUTE, type AppRole } from '@shared/permissions';

interface RequireAuthProps {
    children: React.ReactNode;
    /** If provided, only these roles can access the wrapped content */
    allowedRoles?: AppRole[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-s2p-bg flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-s2p-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const role = (user?.role || 'user') as AppRole;

    // Check explicit allowedRoles prop
    if (allowedRoles && !allowedRoles.includes(role)) {
        const defaultRoute = ROLE_DEFAULT_ROUTE[role] || '/dashboard';
        return <Navigate to={defaultRoute} replace />;
    }

    // Check route access from permissions map
    if (!canAccessRoute(role, location.pathname)) {
        const defaultRoute = ROLE_DEFAULT_ROUTE[role] || '/dashboard';
        return <Navigate to={defaultRoute} replace />;
    }

    return <>{children}</>;
}
