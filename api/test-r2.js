import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
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

        const bucket = process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb';
        const prefix = req.query.prefix || 'Order Archive/TikTok/AGT001/';

        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 10
        });

        const s3Res = await S3.send(command);
        
        res.status(200).json({
            bucket,
            prefix,
            contents: s3Res.Contents ? s3Res.Contents.map(c => ({ key: c.Key, size: c.Size })) : []
        });
    } catch (error) {
        console.error('S3 List Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
