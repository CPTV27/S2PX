import { Router } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';

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

export default router;
