import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import { registerRoutes } from './routes.js';
import { uploadSharePublicRouter } from './routes/upload-shares.js';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '5001', 10);

// CORS — allow Firebase Hosting + local dev
app.use(cors({
    origin: [
        'https://s2px.web.app',
        'https://s2px-production.web.app',
        'https://scan2plan.io',
        'http://localhost:5173',
    ],
    credentials: false, // stateless Bearer auth, no cookies needed
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Public routes — mounted BEFORE requireAuth so they bypass Firebase auth.
// Token-validated internally (upload share token, not Firebase token).
app.use('/api/public/upload', uploadSharePublicRouter);

// Auth middleware on all /api routes (health check skipped inside middleware)
app.use('/api', requireAuth);

// Register routes
await registerRoutes(app);

// Start server — 0.0.0.0 for Cloud Run compatibility
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[s2px] Scan2Plan OS X API running on http://0.0.0.0:${PORT}`);
});
