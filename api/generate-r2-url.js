/* global process */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';



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

        const { fileName, fileType } = req.body;

        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'fileName and fileType are required' });
        }

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            ContentType: fileType,
        });

        // URL valid for 1 hour (3600 seconds)
        const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });

        // Also return the final public URL. 
        // We use VITE_R2_PUBLIC_URL from env if available, otherwise it relies on frontend to construct it.
        const publicUrlBase = process.env.VITE_R2_PUBLIC_URL || '';
        const publicUrl = publicUrlBase ? `${publicUrlBase}/${fileName}` : '';

        res.status(200).json({ url: signedUrl, key: fileName, publicUrl });
    } catch (err) {
        console.error('Error generating pre-signed URL:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
