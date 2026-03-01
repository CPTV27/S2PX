import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { chatChannels, teamMessages, users } from '../../shared/schema/db.js';
import { eq, desc, sql, and, isNull, gt } from 'drizzle-orm';

const router = Router();

// ══════════════════════════════════════════════════════════════
// ── Channels ──
// ══════════════════════════════════════════════════════════════

// GET /api/chat/channels — list all channels
router.get('/channels', async (_req: Request, res: Response) => {
    try {
        const channels = await db
            .select()
            .from(chatChannels)
            .orderBy(chatChannels.createdAt);

        // Get unread counts (messages in last 24h) per channel
        const enriched = await Promise.all(
            channels.map(async (ch) => {
                const countResult = await db.execute(sql`
                    SELECT COUNT(*)::int as recent_count
                    FROM team_messages
                    WHERE channel_id = ${ch.id}
                      AND deleted_at IS NULL
                      AND created_at > NOW() - INTERVAL '24 hours'
                `);
                return {
                    ...ch,
                    recentCount: (countResult.rows[0] as any)?.recent_count ?? 0,
                };
            })
        );

        res.json(enriched);
    } catch (error: any) {
        console.error('List channels error:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// POST /api/chat/channels — create a channel
router.post('/channels', async (req: Request, res: Response) => {
    try {
        const { name, displayName, description, emoji } = req.body;
        if (!name || !displayName) {
            res.status(400).json({ error: 'name and displayName are required' });
            return;
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const [channel] = await db.insert(chatChannels).values({
            name: slug,
            displayName,
            description: description || null,
            emoji: emoji || '💬',
        }).returning();

        res.status(201).json(channel);
    } catch (error: any) {
        console.error('Create channel error:', error);
        if (error.code === '23505') {
            res.status(409).json({ error: 'Channel name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create channel' });
        }
    }
});

// PATCH /api/chat/channels/:id — update channel (webhook URL, etc.)
router.patch('/channels/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const updates: Record<string, any> = { updatedAt: new Date() };
        const { displayName, description, emoji, googleChatWebhookUrl } = req.body;

        if (displayName !== undefined) updates.displayName = displayName;
        if (description !== undefined) updates.description = description;
        if (emoji !== undefined) updates.emoji = emoji;
        if (googleChatWebhookUrl !== undefined) updates.googleChatWebhookUrl = googleChatWebhookUrl;

        const [updated] = await db.update(chatChannels)
            .set(updates)
            .where(eq(chatChannels.id, id))
            .returning();

        if (!updated) { res.status(404).json({ error: 'Channel not found' }); return; }
        res.json(updated);
    } catch (error: any) {
        console.error('Update channel error:', error);
        res.status(500).json({ error: 'Failed to update channel' });
    }
});

// POST /api/chat/channels/:id/test-webhook — send a test message to verify Google Chat webhook
router.post('/channels/:id/test-webhook', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const [channel] = await db.select().from(chatChannels).where(eq(chatChannels.id, id));
        if (!channel) { res.status(404).json({ error: 'Channel not found' }); return; }
        if (!channel.googleChatWebhookUrl) {
            res.status(400).json({ error: 'No webhook URL configured for this channel' });
            return;
        }

        await forwardToGoogleChat(
            channel.googleChatWebhookUrl,
            '✅ Test from S2PX — Google Chat webhook is working!',
            { firstName: 'S2PX', lastName: 'Bot', email: 'system@s2px.app' }
        );
        res.json({ success: true });
    } catch (error: any) {
        console.error('Webhook test error:', error);
        res.status(502).json({ error: 'Webhook test failed', detail: error.message });
    }
});

// ══════════════════════════════════════════════════════════════
// ── Messages ──
// ══════════════════════════════════════════════════════════════

// GET /api/chat/channels/:channelId/messages — list messages (newest-first, paginated)
router.get('/channels/:channelId/messages', async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.channelId, 10);
        if (isNaN(channelId)) { res.status(400).json({ error: 'Invalid channel ID' }); return; }

        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const before = req.query.before ? parseInt(req.query.before as string) : undefined;

        const conditions = [
            eq(teamMessages.channelId, channelId),
            isNull(teamMessages.deletedAt),
        ];
        if (before) {
            conditions.push(sql`${teamMessages.id} < ${before}` as any);
        }

        const messages = await db
            .select({
                id: teamMessages.id,
                channelId: teamMessages.channelId,
                userId: teamMessages.userId,
                content: teamMessages.content,
                messageType: teamMessages.messageType,
                parentId: teamMessages.parentId,
                editedAt: teamMessages.editedAt,
                createdAt: teamMessages.createdAt,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
                profileImageUrl: users.profileImageUrl,
            })
            .from(teamMessages)
            .innerJoin(users, eq(teamMessages.userId, users.id))
            .where(and(...conditions))
            .orderBy(desc(teamMessages.id))
            .limit(limit);

        // Return in chronological order (oldest first for display)
        res.json(messages.reverse());
    } catch (error: any) {
        console.error('List messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// GET /api/chat/channels/:channelId/messages/poll — long-poll for new messages after a given ID
router.get('/channels/:channelId/messages/poll', async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.channelId, 10);
        if (isNaN(channelId)) { res.status(400).json({ error: 'Invalid channel ID' }); return; }

        const afterId = parseInt(req.query.after as string) || 0;

        const messages = await db
            .select({
                id: teamMessages.id,
                channelId: teamMessages.channelId,
                userId: teamMessages.userId,
                content: teamMessages.content,
                messageType: teamMessages.messageType,
                parentId: teamMessages.parentId,
                editedAt: teamMessages.editedAt,
                createdAt: teamMessages.createdAt,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email,
                profileImageUrl: users.profileImageUrl,
            })
            .from(teamMessages)
            .innerJoin(users, eq(teamMessages.userId, users.id))
            .where(and(
                eq(teamMessages.channelId, channelId),
                isNull(teamMessages.deletedAt),
                gt(teamMessages.id, afterId),
            ))
            .orderBy(teamMessages.id)
            .limit(50);

        res.json(messages);
    } catch (error: any) {
        console.error('Poll messages error:', error);
        res.status(500).json({ error: 'Failed to poll messages' });
    }
});

// POST /api/chat/channels/:channelId/messages — send a message
router.post('/channels/:channelId/messages', async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.channelId, 10);
        if (isNaN(channelId)) { res.status(400).json({ error: 'Invalid channel ID' }); return; }

        const { content, userId, parentId } = req.body;
        if (!content?.trim() || !userId) {
            res.status(400).json({ error: 'content and userId are required' });
            return;
        }

        const [msg] = await db.insert(teamMessages).values({
            channelId,
            userId,
            content: content.trim(),
            parentId: parentId || null,
        }).returning();

        // Fetch user info for the response
        const [user] = await db.select().from(users).where(eq(users.id, userId));

        const enriched = {
            ...msg,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
            profileImageUrl: user?.profileImageUrl,
        };

        // Forward to Google Chat webhook if configured
        const [channel] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId));
        if (channel?.googleChatWebhookUrl) {
            forwardToGoogleChat(channel.googleChatWebhookUrl, content.trim(), user).catch((err) =>
                console.error('Google Chat webhook failed:', err)
            );
        }

        res.status(201).json(enriched);
    } catch (error: any) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// PATCH /api/chat/messages/:id — edit a message
router.patch('/messages/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const { content } = req.body;
        if (!content?.trim()) { res.status(400).json({ error: 'content is required' }); return; }

        const [updated] = await db.update(teamMessages)
            .set({ content: content.trim(), editedAt: new Date() })
            .where(eq(teamMessages.id, id))
            .returning();

        if (!updated) { res.status(404).json({ error: 'Message not found' }); return; }
        res.json(updated);
    } catch (error: any) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});

// DELETE /api/chat/messages/:id — soft-delete a message
router.delete('/messages/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const [deleted] = await db.update(teamMessages)
            .set({ deletedAt: new Date() })
            .where(eq(teamMessages.id, id))
            .returning();

        if (!deleted) { res.status(404).json({ error: 'Message not found' }); return; }
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// ══════════════════════════════════════════════════════════════
// ── Seed default channels ──
// ══════════════════════════════════════════════════════════════

// POST /api/chat/seed — create default channels if none exist
router.post('/seed', async (_req: Request, res: Response) => {
    try {
        const existing = await db.select().from(chatChannels).limit(1);
        if (existing.length > 0) {
            res.json({ message: 'Channels already exist', count: existing.length });
            return;
        }

        const defaults = [
            { name: 'general', displayName: 'General', emoji: '💬', description: 'Team-wide announcements and general discussion', isDefault: true },
            { name: 'field-ops', displayName: 'Field Ops', emoji: '📡', description: 'Scanner assignments, field schedules, and site coordination' },
            { name: 'bim-production', displayName: 'BIM Production', emoji: '🏗️', description: 'Modeling progress, QC handoffs, and BIM questions' },
            { name: 'sales', displayName: 'Sales', emoji: '💰', description: 'Pipeline updates, proposals, and client communications' },
        ];

        const created = await db.insert(chatChannels).values(defaults).returning();
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Seed channels error:', error);
        res.status(500).json({ error: 'Failed to seed channels' });
    }
});

// ══════════════════════════════════════════════════════════════
// ── Google Chat Webhook Forwarder ──
// ══════════════════════════════════════════════════════════════

async function forwardToGoogleChat(webhookUrl: string, message: string, user: any) {
    const displayName = user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email ?? 'S2PX User';

    const payload = {
        text: `*${displayName}:* ${message}`,
    };

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Google Chat webhook responded ${response.status}`);
    }
}

export default router;
