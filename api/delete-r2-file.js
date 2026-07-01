/* global process */
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
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

        const { fileName } = req.body;

        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const targetBucket = process.env.R2_PRIVATE_BUCKET_NAME;

        if (!targetBucket) {
            return res.status(500).json({ error: 'Private Bucket configuration is missing' });
        }

        const command = new DeleteObjectCommand({
            Bucket: targetBucket,
            Key: fileName,
        });

        await S3.send(command);

        res.status(200).json({ success: true, message: 'File deleted successfully' });
    } catch (err) {
        console.error('Error deleting file from R2:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
