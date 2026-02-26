import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { users } from '../../shared/schema/db.js';
import { eq } from 'drizzle-orm';

// Initialize Firebase Admin (uses ADC on GCP, explicit projectId everywhere)
if (getApps().length === 0) {
    initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 's2px-production',
    });
}

const adminAuth = getAuth();

export interface AuthenticatedRequest extends Request {
    user: {
        id: number;
        firebaseUid: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
        role: string;
    };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Skip auth for health check (req.path is relative to mount point)
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or invalid authorization header' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = await adminAuth.verifyIdToken(token);

        // Upsert user
        const existing = await db.select().from(users).where(eq(users.firebaseUid, decoded.uid)).limit(1);

        let user;
        if (existing.length > 0) {
            user = existing[0];
            // Update profile if changed
            const updates: Record<string, string | null> = {};
            if (decoded.email && decoded.email !== user.email) updates.email = decoded.email;
            if (decoded.name) {
                const parts = decoded.name.split(' ');
                const first = parts[0] || null;
                const last = parts.slice(1).join(' ') || null;
                if (first !== user.firstName) updates.firstName = first;
                if (last !== user.lastName) updates.lastName = last;
            }
            if (decoded.picture && decoded.picture !== user.profileImageUrl) {
                updates.profileImageUrl = decoded.picture;
            }
            if (Object.keys(updates).length > 0) {
                const [updated] = await db.update(users)
                    .set({ ...updates, updatedAt: new Date() })
                    .where(eq(users.id, user.id))
                    .returning();
                user = updated;
            }
        } else {
            // Create new user
            const nameParts = (decoded.name || '').split(' ');
            const [created] = await db.insert(users).values({
                firebaseUid: decoded.uid,
                email: decoded.email || 'unknown',
                firstName: nameParts[0] || null,
                lastName: nameParts.slice(1).join(' ') || null,
                profileImageUrl: decoded.picture || null,
                role: 'user',
            }).returning();
            user = created;
        }

        (req as AuthenticatedRequest).user = {
            id: user.id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
        };

        next();
    } catch (err: any) {
        console.error('Auth verification failed:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}
