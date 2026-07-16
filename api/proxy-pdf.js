/* global process, Buffer */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        let buffer = null;

        // 1. Try standard fetch first (for external or public URLs)
        try {
            const response = await fetch(url);
            if (response.ok) {
                buffer = await response.arrayBuffer();
            }
        } catch {
            // Ignore fetch error and fallback to S3/R2 direct fetch
        }

        // 2. If standard fetch failed (e.g. 404 or 403 on private R2 bucket or mismatched domain), fetch from R2 using S3 credentials!
        if (!buffer) {
            let key = url;
            const archiveIdx = url.indexOf('Order Archive/');
            if (archiveIdx !== -1) {
                key = decodeURIComponent(url.substring(archiveIdx).split('?')[0]);
            } else {
                // Also handle cases where url is just the key without domain
                key = decodeURIComponent(url.split('?')[0]);
                // Remove leading slash if any
                if (key.startsWith('/')) key = key.substring(1);
            }

            const S3 = new S3Client({
                region: 'auto',
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: process.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
                },
                forcePathStyle: true,
            });

            // Try private bucket (hgh-awb) first, then public bucket (hgh-sejahtera)
            const bucketsToTry = [
                process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb',
                process.env.R2_BUCKET_NAME || 'hgh-sejahtera'
            ];

            for (const bucket of bucketsToTry) {
                if (!bucket) continue;
                try {
                    const command = new GetObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    });
                    const s3Res = await S3.send(command);
                    if (s3Res && s3Res.Body) {
                        const byteArray = await s3Res.Body.transformToByteArray();
                        buffer = byteArray.buffer;
                        break;
                    }
                } catch (err) {
                    console.warn(`R2 lookup failed for bucket [${bucket}] and key [${key}]:`, err.message || err);
                }
            }
        }

        if (!buffer) {
            return res.status(404).json({ error: 'Failed to load PDF from R2 storage or URL' });
        }

        // Set CORS headers so the frontend can read it cleanly
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        
        res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        console.error('PDF Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
