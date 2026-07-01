import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function cleanupR2() {
    const S3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
    });

    // MASUKKAN NAMA FAIL TEST KAT SINI SEBELUM RUN
    const fileName = 'NAMA_FAIL_PDF_AWB_YANG_KAU_UPLOAD_TADI.pdf'; 

    console.log(`Deleting ${fileName} from ${process.env.R2_PRIVATE_BUCKET_NAME}...`);
    try {
        await S3.send(new DeleteObjectCommand({
            Bucket: process.env.R2_PRIVATE_BUCKET_NAME,
            Key: fileName,
        }));
        console.log('Successfully deleted from R2!');
    } catch (e) {
        console.error('Error deleting from R2:', e.message);
    }
}
cleanupR2();
