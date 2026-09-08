import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { FileAccessError } from './FileAccess.js';

export const MaxPDFBytes = 20 * 1024 * 1024;

export function GetFileStorage() {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
        throw new FileAccessError(503, 'File storage is unavailable.');
    }
    return new S3Client({
        region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
    });
}

export async function ReadPrivatePDF(Storage, File) {
    const Response = await Storage.send(new GetObjectCommand({ Bucket: File.Bucket, Key: File.Key }));
    const Body = Response.Body;
    if (!Body) throw new FileAccessError(404, 'AWB not found.');
    if (Response.ContentLength > MaxPDFBytes) {
        Body.destroy?.();
        throw new FileAccessError(413, 'PDF exceeds the supported size.');
    }
    const Chunks = [];
    let Size = 0;
    for await (const Chunk of Body) {
        Size += Chunk.length;
        if (Size > MaxPDFBytes) {
            Body.destroy?.();
            throw new FileAccessError(413, 'PDF exceeds the supported size.');
        }
        Chunks.push(Buffer.from(Chunk));
    }
    const Bytes = Buffer.concat(Chunks);
    if (!Bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new FileAccessError(415, 'This file is not a PDF.');
    return Bytes;
}
