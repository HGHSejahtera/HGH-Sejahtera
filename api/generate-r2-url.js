/* global process */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';



let s3ClientInstance = null;

function getS3Client() {
    if (!s3ClientInstance) {
        s3ClientInstance = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
    }
    return s3ClientInstance;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const S3 = getS3Client();

        const { fileName, fileType, isPrivate } = req.body;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        // Clean double slashes and leading slashes from key path
        const cleanKey = String(fileName).replace(/\/+/g, '/').replace(/^\/+/, '');

        const targetBucket = isPrivate ? (process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb') : process.env.R2_BUCKET_NAME;

        if (!targetBucket) {
            return res.status(500).json({ error: 'Bucket configuration is missing' });
        }

        const command = new PutObjectCommand({
            Bucket: targetBucket,
            Key: cleanKey,
            ContentType: fileType,
        });

        // URL valid for 1 hour (3600 seconds)
        const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });

        // Also return the final public URL. 
        // We use VITE_R2_PUBLIC_URL from env if available, otherwise it relies on frontend to construct it.
        const publicUrlBase = process.env.VITE_R2_PUBLIC_URL || '';
        const publicUrl = (!isPrivate && publicUrlBase) ? `${publicUrlBase}/${cleanKey}` : '';

        res.status(200).json({ url: signedUrl, key: cleanKey, publicUrl });
    } catch (err) {
        console.error('Error generating pre-signed URL:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message || err });
    }
}
