import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

Test('Installed AWS signer binds Content-Type and Content-Length without network', async () => {
    const Storage = new S3Client({
        region: 'auto', endpoint: 'https://storage.invalid', forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        credentials: { accessKeyId: 'SyntheticAccessKey', secretAccessKey: 'SyntheticSecret' },
        requestHandler: { handle: () => { throw new Error('Network forbidden'); } },
    });
    try {
        const SignedURL = await getSignedUrl(Storage, new PutObjectCommand({
            Bucket: 'test-private', Key: 'Synthetic.pdf', ContentLength: 100, ContentType: 'application/pdf',
        }), { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) });
        const Query = new URL(SignedURL).searchParams;
        Assert.equal(Query.get('X-Amz-Expires'), '300');
        Assert.ok(Query.get('X-Amz-SignedHeaders').split(';').includes('content-type'));
        Assert.ok(Query.get('X-Amz-SignedHeaders').split(';').includes('content-length'));
        Assert.equal(Query.has('x-amz-checksum-crc32'), false);
        // Signature generation is local. This does not prove browser/R2 acceptance.
    } finally { Storage.destroy(); }
});
