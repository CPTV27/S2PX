// ── Role-Based Access Middleware ──
// Usage: router.get('/endpoint', requireRole('ceo', 'admin'), handler)

import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import type { AppRole } from '../../shared/permissions.js';

/**
 * Express middleware factory that restricts access to specific roles.
 * Must be used AFTER requireAuth middleware.
 */
export function requireRole(...roles: AppRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthenticatedRequest).user;

        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (!roles.includes(user.role as AppRole)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        next();
    };
}
