/* global process */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const S3 = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });

        // Accept fileName from query params (GET) or body (POST)
        const fileName = req.query.fileName || req.body?.fileName;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const targetBucket = process.env.R2_PRIVATE_BUCKET_NAME;

        if (!targetBucket) {
            return res.status(500).json({ error: 'Private Bucket configuration is missing' });
        }

        const command = new GetObjectCommand({
            Bucket: targetBucket,
            Key: fileName,
        });

        // URL valid for 15 minutes (900 seconds) for security
        const signedUrl = await getSignedUrl(S3, command, { expiresIn: 900 });

        res.status(200).json({ url: signedUrl });
    } catch (err) {
        console.error('Error generating pre-signed GET URL:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
