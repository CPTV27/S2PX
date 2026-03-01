import { Router } from 'express';
import { db } from '../db.js';
import { users } from '../../shared/schema/db.js';
import { eq, desc } from 'drizzle-orm';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { APP_ROLES, type AppRole } from '../../shared/permissions.js';

const router = Router();

// GET /api/auth/user — returns current authenticated user profile
router.get('/user', (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    res.json({
        id: String(user.id),
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profileImageUrl: user.profileImageUrl || '',
        role: user.role,
    });
});

// GET /api/auth/users — list all users (CEO/admin only)
router.get('/users', requireRole('ceo', 'admin'), async (_req, res) => {
    try {
        const allUsers = await db
            .select({
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                lastName: users.lastName,
                profileImageUrl: users.profileImageUrl,
                role: users.role,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .orderBy(desc(users.updatedAt));

        res.json(allUsers.map(u => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            updatedAt: u.updatedAt.toISOString(),
        })));
    } catch (error: any) {
        console.error('List users error:', error);
        res.status(500).json({ message: error.message || 'Failed to list users' });
    }
});

// PATCH /api/auth/users/:id/role — update user role (CEO/admin only)
router.patch('/users/:id/role', requireRole('ceo', 'admin'), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

        const { role } = req.body;
        if (!role || !APP_ROLES.includes(role as AppRole)) {
            return res.status(400).json({ message: `Invalid role. Must be one of: ${APP_ROLES.join(', ')}` });
        }

        const authUser = (req as AuthenticatedRequest).user;

        // Only CEO can assign CEO role
        if (role === 'ceo' && authUser.role !== 'ceo') {
            return res.status(403).json({ message: 'Only the CEO can assign the CEO role' });
        }

        // Prevent removing the last CEO
        if (authUser.id === id && authUser.role === 'ceo' && role !== 'ceo') {
            const ceoCount = await db.select({ id: users.id }).from(users).where(eq(users.role, 'ceo'));
            if (ceoCount.length <= 1) {
                return res.status(400).json({ message: 'Cannot remove the last CEO. Assign another CEO first.' });
            }
        }

        const [updated] = await db
            .update(users)
            .set({ role, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();

        if (!updated) return res.status(404).json({ message: 'User not found' });

        res.json({
            id: updated.id,
            email: updated.email,
            firstName: updated.firstName,
            lastName: updated.lastName,
            profileImageUrl: updated.profileImageUrl,
            role: updated.role,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error: any) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: error.message || 'Failed to update user role' });
    }
});

export default router;
