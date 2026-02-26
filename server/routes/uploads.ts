import type { Express } from 'express';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const GCS_BUCKET = process.env.GCS_BUCKET || 's2p-core-vault';

export function registerUploadRoutes(app: Express) {
    app.post('/api/uploads', upload.single('file'), async (req, res) => {
        try {
            const file = req.file;
            const upid = req.body.upid as string;
            const fieldName = req.body.fieldName as string;

            if (!file) {
                res.status(400).json({ error: 'No file provided' });
                return;
            }
            if (!upid || !fieldName) {
                res.status(400).json({ error: 'upid and fieldName are required' });
                return;
            }

            const storage = new Storage();
            const bucket = storage.bucket(GCS_BUCKET);
            const gcsPath = `scoping/${upid}/${fieldName}/${file.originalname}`;
            const blob = bucket.file(gcsPath);

            await blob.save(file.buffer, {
                contentType: file.mimetype,
                metadata: { upid, fieldName },
            });

            const url = `gs://${GCS_BUCKET}/${gcsPath}`;
            res.json({ url, path: gcsPath, filename: file.originalname, size: file.size });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    });
}
