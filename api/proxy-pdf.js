/* global process, Buffer */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        let targetUrl = url;
        if (typeof targetUrl === 'string' && (targetUrl.startsWith('rder Archive/') || targetUrl.indexOf('/rder Archive/') !== -1 || targetUrl.indexOf('?url=rder Archive/') !== -1)) {
            targetUrl = targetUrl.replace('rder Archive/', 'Order Archive/');
        }

        let buffer = null;

        // 1. Try standard fetch first (for external or public URLs)
        try {
            const response = await fetch(targetUrl);
            if (response.ok) {
                buffer = await response.arrayBuffer();
            }
        } catch {
            // Ignore fetch error and fallback to S3/R2 direct fetch
        }

        // 2. If standard fetch failed (e.g. 404 or 403 on private R2 bucket or mismatched domain), fetch from R2 using S3 credentials!
        if (!buffer) {
            let key = targetUrl;
            const archiveIdx = targetUrl.indexOf('Order Archive/');
            if (archiveIdx !== -1) {
                key = decodeURIComponent(targetUrl.substring(archiveIdx).split('?')[0]);
            } else {
                // Also handle cases where targetUrl is just the key without domain
                key = decodeURIComponent(targetUrl.split('?')[0]);
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
                        if (typeof s3Res.Body.transformToByteArray === 'function') {
                            const byteArray = await s3Res.Body.transformToByteArray();
                            buffer = byteArray.buffer || byteArray;
                        } else if (typeof s3Res.Body.arrayBuffer === 'function') {
                            buffer = await s3Res.Body.arrayBuffer();
                        } else if (s3Res.Body[Symbol.asyncIterator]) {
                            const chunks = [];
                            for await (const chunk of s3Res.Body) {
                                chunks.push(chunk);
                            }
                            buffer = Buffer.concat(chunks);
                        } else {
                            buffer = s3Res.Body;
                        }
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
