import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
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
        const prefix = 'Order Archive/TikTok/AGT001/2026/07/TikTokSeller-AGT001-585293998948058661-20260731-0948.pdf';

        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 10
        });

        const s3Res = await S3.send(command);
        console.log("Found objects:", s3Res.Contents ? s3Res.Contents.map(c => c.Key) : 'None');
    } catch (error) {
        console.error('S3 List Error:', error);
    }
}
run();
