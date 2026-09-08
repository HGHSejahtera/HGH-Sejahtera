import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RequireFileAccess, ResolveUploadAccess, SendFileError } from './_utils/FileAccess.js';
import { GetFileStorage } from './_utils/FileStorage.js';

export default async function HandleUploadURL(Req, Res) {
    Res.setHeader('Cache-Control', 'private, no-store');
    if (Req.method !== 'POST') return Res.status(405).json({ error: 'Method Not Allowed' });
    try {
        const Access = await RequireFileAccess(Req);
        const File = ResolveUploadAccess(Access, Req.body);
        const Command = new PutObjectCommand({
            Bucket: File.Bucket, Key: File.Key, ContentType: File.FileType, ContentLength: File.FileSize,
        });
        const SignedURL = await getSignedUrl(GetFileStorage(), Command, {
            expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']),
        });
        const PublicBase = process.env.VITE_R2_PUBLIC_URL || '';
        return Res.status(200).json({
            url: SignedURL, key: File.Key,
            publicUrl: !File.IsPrivate && PublicBase ? PublicBase.replace(/\/$/, '') + '/' + File.Key : '',
        });
    } catch (ErrorValue) {
        return SendFileError(Res, ErrorValue);
    }
}
