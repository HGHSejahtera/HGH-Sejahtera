import { test as Test, mock as Mock, beforeEach as BeforeEach } from 'node:test';
import Assert from 'node:assert/strict';
import Process from 'node:process';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

// All values are synthetic. These tests must never contact production.
Process.env.SUPABASE_URL = 'https://database.invalid';
Process.env.SUPABASE_ANON_KEY = 'SyntheticPublicKey';
Process.env.R2_ACCOUNT_ID = 'SyntheticAccount';
Process.env.R2_ACCESS_KEY_ID = 'SyntheticAccessKey';
Process.env.R2_SECRET_ACCESS_KEY = 'SyntheticSecret';
Process.env.R2_PRIVATE_BUCKET_NAME = 'test-private';
Process.env.R2_BUCKET_NAME = 'test-images';
Process.env.VITE_R2_PUBLIC_URL = 'https://images.invalid';
globalThis.fetch = () => { throw new Error('Network forbidden in isolated tests'); };

const UserID = '00000000-0000-4000-8000-000000000001';
const OrderID = '00000000-0000-4000-8000-000000000002';
const Key = 'Order Archive/TikTok/AGT001/2026/09/TikTokSeller-AGT001-Test-20260908-1200.pdf';
let Profile;
let Order;
let AuthFails;
let DatabaseFails;
let StorageFails;
let Payload;
let Calls;
let AuthCalls;
let ProfileQueries;

Mock.module('@supabase/supabase-js', { namedExports: {
    createClient: (URLValue, PublicKey, Options) => {
        Assert.equal(URLValue, 'https://database.invalid');
        Assert.equal(PublicKey, 'SyntheticPublicKey');
        Assert.equal(Options.auth.persistSession, false);
        Assert.equal(Options.global.headers.Authorization, 'Bearer SyntheticToken');
        return {
            auth: { getUser: async Token => {
                AuthCalls++;
                Assert.equal(Token, 'SyntheticToken');
                return AuthFails ? { error: new Error('Invalid/expired token') } : { data: { user: { id: UserID } } };
            } },
            from: Table => {
                const Filters = [];
                const Query = {
                    select: Columns => { if (Table === 'Users') ProfileQueries.push(Columns); return Query; },
                    eq: (Name, Value) => { Filters.push([Name, Value]); return Query; },
                    maybeSingle: async () => {
                        const Row = Table === 'Users' ? Profile : Order;
                        return { data: Row && Filters.every(([Name, Value]) => Row[Name] === Value) ? Row : null,
                            error: DatabaseFails ? new Error('Database unavailable') : null };
                    },
                };
                return Query;
            },
        };
    },
} });

class GetObjectCommand { constructor(Input) { this.input = Input; this.Type = 'Get'; } }
class PutObjectCommand { constructor(Input) { this.input = Input; this.Type = 'Put'; } }
class S3Client {
    async send(Command) {
        Calls.push(Command);
        if (StorageFails) throw Object.assign(new Error('Private SDK information'), { name: 'NoSuchKey' });
        return { Body: Readable.from([Payload]), ContentLength: Payload.length };
    }
}
Mock.module('@aws-sdk/client-s3', { namedExports: { S3Client, GetObjectCommand, PutObjectCommand } });
Mock.module('@aws-sdk/s3-request-presigner', { namedExports: {
    getSignedUrl: async (Storage, Command, Options) => {
        Assert.ok(Storage instanceof S3Client);
        Calls.push({ Type: 'Sign', Command, Options });
        return 'https://storage.invalid/SyntheticSignedURL';
    },
} });
Mock.module('pdfjs-dist/legacy/build/pdf.mjs', { namedExports: {
    getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [] }) }) }) }),
} });
Mock.module('pdf-lib', { namedExports: {
    PDFDocument: { load: async () => ({ embedFont: async () => ({}), getPage: () => ({ drawText: () => {} }), save: async () => Buffer.from('%PDF-1.7\nSyntheticStamp') }) },
    StandardFonts: { Helvetica: 'Helvetica' }, rgb: () => ({}),
} });

const { default: HandlePDF } = await import('../api/proxy-pdf.js');
const { default: HandleDownload } = await import('../api/get-r2-download-url.js');
const { default: HandleUpload } = await import('../api/generate-r2-url.js');
const { default: HandleStamp } = await import('../api/stamp-awb.js');
const { default: HandleDelete } = await import('../api/delete-r2-file.js');
const { default: HandleListing } = await import('../api/test-r2.js');
const { ParseAWBKey } = await import('../api/_utils/FileAccess.js');
const { ReadPrivatePDF, MaxPDFBytes } = await import('../api/_utils/FileStorage.js');

BeforeEach(() => {
    Profile = { UserID, Role: 'Agent', IsActive: true, StaffID: 'AGT001' };
    Order = { ImportOrderID: OrderID, AwbUrl: Key, OrderImports: { AgentID: UserID } };
    AuthFails = false; DatabaseFails = false; StorageFails = false;
    Payload = Buffer.from('%PDF-1.7\nSyntheticPDF'); Calls = []; AuthCalls = 0; ProfileQueries = [];
});

function Response() {
    return { Status: 0, Headers: {}, Body: null,
        setHeader(Name, Value) { this.Headers[Name] = Value; },
        status(Value) { this.Status = Value; return this; },
        json(Value) { this.Body = Value; return this; },
        send(Value) { this.Body = Value; return this; },
    };
}
function Request(Method = 'GET') {
    return { method: Method, headers: { authorization: 'Bearer SyntheticToken' },
        query: { url: Key, fileName: Key },
        body: { fileName: Key, fileType: 'application/pdf', isPrivate: true, FileSize: 100,
            awbUrl: Key, orderId: OrderID, targetSku: 'SKU1', orderItems: [] },
    };
}
const ProtectedRoutes = [[HandlePDF, 'GET'], [HandleDownload, 'GET'], [HandleUpload, 'POST'], [HandleStamp, 'POST']];

Test('All file routes reject missing/malformed tokens before database or storage access', async () => {
    for (const [Handler, Method] of ProtectedRoutes) {
        for (const Authorization of [undefined, '', 'Basic Synthetic', ['Bearer SyntheticToken']]) {
            const Req = Request(Method); Req.headers.authorization = Authorization;
            const Res = Response(); await Handler(Req, Res);
            Assert.equal(Res.Status, 401); Assert.equal(Calls.length, 0); Assert.equal(AuthCalls, 0);
            Assert.match(Res.Headers['Cache-Control'], /no-store/);
        }
    }
});
Test('Expired/invalid tokens never reach profile queries or storage', async () => {
    AuthFails = true;
    for (const [Handler, Method] of ProtectedRoutes) {
        const Res = Response(); await Handler(Request(Method), Res);
        Assert.equal(Res.Status, 401);
    }
    Assert.equal(ProfileQueries.length, 0); Assert.equal(Calls.length, 0);
});
Test('Pending, Rejected, unknown, missing and inactive profiles cannot access files', async () => {
    for (const Changed of [{ Role: 'Pending' }, { Role: 'Rejected' }, { Role: 'Owner' }, { IsActive: false }, { IsActive: null }]) {
        Profile = { UserID, Role: 'Agent', IsActive: true, StaffID: 'AGT001', ...Changed };
        for (const [Handler, Method] of ProtectedRoutes) {
            const Res = Response(); await Handler(Request(Method), Res); Assert.equal(Res.Status, 403);
        }
    }
    Profile = null;
    const Res = Response(); await HandlePDF(Request(), Res); Assert.equal(Res.Status, 403);
    Assert.equal(Calls.length, 0);
});
Test('Database failures fail closed without leaking SDK messages', async () => {
    DatabaseFails = true;
    const Res = Response(); await HandlePDF(Request(), Res);
    Assert.equal(Res.Status, 503); Assert.equal(Calls.length, 0); Assert.doesNotMatch(JSON.stringify(Res.Body), /Database unavailable/);
});
Test('Agent may view and download an owned private AWB', async () => {
    const Res = Response(); await HandlePDF(Request(), Res);
    Assert.equal(Res.Status, 200); Assert.deepEqual(Res.Body, Payload);
    Assert.equal(Calls[0].input.Bucket, 'test-private'); Assert.equal(Calls[0].input.Key, Key);
    Assert.match(Res.Headers['Content-Disposition'], /^inline/);
    Assert.equal(Res.Headers['Access-Control-Allow-Origin'], undefined);
    Assert.ok(ProfileQueries.every(Value => !/PIN|Email|Token/.test(Value)));
    const Req = Request(); Req.query.download = 'true';
    const Download = Response(); await HandlePDF(Req, Download);
    Assert.match(Download.Headers['Content-Disposition'], /^attachment/);
});
Test('Cross-agent order access is denied even when a query returns another owner', async () => {
    Order.OrderImports.AgentID = 'AnotherUser';
    for (const Handler of [HandlePDF, HandleDownload]) {
        const Res = Response(); await Handler(Request(), Res); Assert.equal(Res.Status, 404);
    }
    const Res = Response(); await HandleStamp(Request('POST'), Res); Assert.equal(Res.Status, 404);
    Assert.equal(Calls.length, 0);
});
Test('An own order forged to point at another agent folder is denied', async () => {
    const OtherKey = Key.replaceAll('AGT001', 'AGT002');
    Order.AwbUrl = OtherKey;
    const Req = Request(); Req.query.url = OtherKey;
    const Res = Response(); await HandlePDF(Req, Res);
    Assert.equal(Res.Status, 404); Assert.equal(Calls.length, 0);
});
Test('Stamp order ID and AWB key must resolve to the same permitted object', async () => {
    const Req = Request('POST'); Req.body.awbUrl = Key.replace('Test-', 'Different-');
    const Res = Response(); await HandleStamp(Req, Res);
    Assert.equal(Res.Status, 404); Assert.equal(Calls.length, 0);
});
Test('Founder/Manager/Developer/Staff retain access to visible order AWBs', async () => {
    Order.OrderImports.AgentID = 'AnotherUser';
    for (const Role of ['Founder', 'Manager', 'Developer', 'Staff']) {
        Profile.Role = Role;
        const Res = Response(); await HandlePDF(Request(), Res); Assert.equal(Res.Status, 200);
    }
});
Test('Malformed keys, traversal, arbitrary/internal URLs and arrays are rejected', async () => {
    for (const Reference of [null, ['bad'], 'http://127.0.0.1/private', 'https://example.com/' + Key,
        'https://169.254.169.254/', '../' + Key, Key.replace('/09/', '/../'), Key + '\r\nInjected',
        Key.replace('Test-', '%2e%2e%2f'), Key.replace('Test-', '%252e%252e'), Key.replace('Order Archive', 'rder Archive'),
        Key.replace('/09/', '//'), Key.replaceAll('/', '\\'), Key + '?url=other']) {
        const Req = Request(); Req.query.url = Reference;
        const Res = Response(); await HandlePDF(Req, Res); Assert.equal(Res.Status, 400);
    }
    Assert.equal(Calls.length, 0);
});
Test('Only a configured legacy image origin can map a stored URL to a private key', async () => {
    const Reference = 'https://images.invalid/' + Key.split('/').map(encodeURIComponent).join('/');
    Assert.equal(ParseAWBKey(Reference), Key);
    Order.AwbUrl = Reference;
    const Req = Request(); Req.query.url = Reference;
    const Res = Response(); await HandlePDF(Req, Res); Assert.equal(Res.Status, 200);
    Assert.equal(Calls[0].input.Bucket, 'test-private');
    Assert.throws(() => ParseAWBKey('https://images.invalid.attacker.invalid/' + Key));
    Assert.throws(() => ParseAWBKey('https://user:pass@images.invalid/' + Key));
    Assert.throws(() => ParseAWBKey('https://images.invalid/' + Key.replace('/09/', '/08/../09/')));
    Assert.throws(() => ParseAWBKey('https://images.invalid/' + Key.replace('/09/', '/08/%2e%2e/09/')));
});
Test('PDF reads do not fallback to public buckets and validate returned bytes', async () => {
    StorageFails = true;
    const Missing = Response(); await HandlePDF(Request(), Missing);
    Assert.equal(Missing.Status, 404); Assert.equal(Calls.length, 1);
    StorageFails = false; Payload = Buffer.from('<html>Not PDF</html>');
    const WrongType = Response(); await HandlePDF(Request(), WrongType); Assert.equal(WrongType.Status, 415);
});
Test('Oversized PDF streams are bounded even without ContentLength', async () => {
    const Storage = { send: async () => ({ Body: Readable.from([Buffer.alloc(MaxPDFBytes), Buffer.alloc(1)]) }) };
    await Assert.rejects(ReadPrivatePDF(Storage, { Bucket: 'test-private', Key }), ErrorValue => ErrorValue.Status === 413);
});
Test('Owned upload signs only the permitted bucket/key, declared length and type', async () => {
    const Res = Response(); await HandleUpload(Request('POST'), Res); Assert.equal(Res.Status, 200);
    Assert.equal(Calls.length, 1); Assert.equal(Calls[0].Type, 'Sign');
    Assert.equal(Calls[0].Command.input.ContentLength, 100);
    Assert.equal(Calls[0].Command.input.ContentType, 'application/pdf');
    Assert.equal(Calls[0].Options.expiresIn, 300);
    Assert.ok(Calls[0].Options.signableHeaders.has('content-length'));
});
Test('Forged upload owner, destination, MIME, image access and oversized requests are denied', async () => {
    for (const Body of [
        { fileName: Key.replaceAll('AGT001', 'AGT002') }, { fileType: 'text/html' }, { FileSize: 0 },
        { FileSize: 21 * 1024 * 1024 }, { FileSize: '100' }, { isPrivate: 'true' },
        { isPrivate: false, fileType: 'image/webp', fileName: 'Image.webp' },
    ]) {
        const Req = Request('POST'); Object.assign(Req.body, Body);
        const Res = Response(); await HandleUpload(Req, Res); Assert.ok([400, 403].includes(Res.Status));
    }
    Assert.equal(Calls.length, 0);
});
Test('Staff image uploads use only the public image bucket', async () => {
    Profile.Role = 'Staff';
    const Req = Request('POST'); Object.assign(Req.body, { isPrivate: false, fileName: 'Image.webp', fileType: 'image/webp' });
    const Res = Response(); await HandleUpload(Req, Res);
    Assert.equal(Res.Status, 200); Assert.equal(Calls[0].Command.input.Bucket, 'test-images');
});
Test('Authorized stamping writes exactly the private object resolved from the order', async () => {
    const Res = Response(); await HandleStamp(Request('POST'), Res);
    Assert.equal(Res.Status, 200); Assert.equal(Res.Body.status, 'stamped');
    Assert.deepEqual(Calls.map(Value => Value.Type), ['Get', 'Put']);
    Assert.ok(Calls.every(Value => Value.input.Bucket === 'test-private' && Value.input.Key === Key));
});
Test('Disabled listing/deletion always make zero authentication or storage calls', async () => {
    for (const Handler of [HandleDelete, HandleListing]) for (const Method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
        const Res = Response(); await Handler(Request(Method), Res); Assert.equal(Res.Status, 410);
    }
    Assert.equal(AuthCalls, 0); Assert.equal(Calls.length, 0);
});
