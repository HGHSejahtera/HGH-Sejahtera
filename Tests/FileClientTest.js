import { test as Test, mock as Mock, beforeEach as BeforeEach } from 'node:test';
import Assert from 'node:assert/strict';

let Session;
let Calls;
let ResponseValue;
let Created;
let Revoked;
let Timers;
let Clicks;
let PDFWindow;
Mock.module('../Src/Lib/Supabase.js', { namedExports: {
    supabase: { auth: { getSession: async () => ({ data: { session: Session } }) } },
} });
const { FetchFileAPI, FetchAuthorizedPDF, GetPDFFileName, DownloadPDFBlob, OpenPDFBlob } = await import('../Src/Lib/FileAccess.js');

BeforeEach(() => {
    Session = { access_token: 'SyntheticSessionToken' };
    Calls = []; Created = []; Revoked = []; Timers = []; Clicks = [];
    ResponseValue = new Response('%PDF-1.7\nSynthetic', { headers: { 'Content-Type': 'application/pdf' } });
    globalThis.fetch = async (...Args) => { Calls.push(Args); return ResponseValue; };
    PDFWindow = { closed: false, opener: {}, location: { replace: Target => { PDFWindow.Target = Target; } } };
    globalThis.window = { location: { origin: 'https://app.invalid' }, open: () => PDFWindow };
    Mock.method(URL, 'createObjectURL', BlobValue => { Created.push(BlobValue); return 'blob:Synthetic/' + Created.length; });
    Mock.method(URL, 'revokeObjectURL', Value => Revoked.push(Value));
    Mock.method(globalThis, 'setTimeout', (Callback, Delay) => { Timers.push({ Callback, Delay }); return Timers.length; });
    Mock.method(globalThis, 'setInterval', (Callback, Delay) => { Timers.push({ Callback, Delay }); return Timers.length; });
    Mock.method(globalThis, 'clearInterval', Timer => { Timers[Timer - 1].Cleared = true; });
    globalThis.document = {
        createElement: () => ({ click() { Clicks.push({ URL: this.href, Name: this.download }); }, remove() {} }),
        body: { appendChild() {} },
    };
});

Test('API calls attach the current session in a header, never a query parameter', async () => {
    await FetchFileAPI('/api/generate-r2-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const [Target, Options] = Calls[0];
    Assert.equal(Target, 'https://app.invalid/api/generate-r2-url');
    Assert.equal(Options.headers.get('Authorization'), 'Bearer SyntheticSessionToken');
    Assert.equal(Options.headers.get('Content-Type'), 'application/json');
    Assert.equal(Options.redirect, 'error'); Assert.equal(Options.cache, 'no-store');
});
Test('Tokens cannot be attached to external signed URLs or unrelated routes', async () => {
    for (const Target of ['https://storage.invalid/File', '//attacker.invalid/api/proxy-pdf', '/api/telegram-webhook', '/login']) {
        await Assert.rejects(FetchFileAPI(Target), /Invalid file API/);
    }
    Assert.equal(Calls.length, 0);
});
Test('No session stops before any request', async () => {
    Session = null;
    await Assert.rejects(FetchFileAPI('/api/proxy-pdf'), /sign in/);
    Assert.equal(Calls.length, 0);
});
Test('PDF requests preserve the reference and cancellation signal', async () => {
    const Reference = 'Order Archive/TikTok/AGT001/2026/09/AWB.pdf';
    const Controller = new AbortController();
    const BlobValue = await FetchAuthorizedPDF(Reference, Controller.signal);
    Assert.equal(BlobValue.type, 'application/pdf');
    Assert.equal(new URL(Calls[0][0]).searchParams.get('url'), Reference);
    Assert.equal(Calls[0][1].signal, Controller.signal);
});
Test('Error responses and non-PDF content never become downloadable blobs', async () => {
    ResponseValue = new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    await Assert.rejects(FetchAuthorizedPDF('AWB.pdf'), /Access denied/);
    ResponseValue = new Response('<html/>', { headers: { 'Content-Type': 'text/html' } });
    await Assert.rejects(FetchAuthorizedPDF('AWB.pdf'), /Invalid PDF response/);
});
Test('Download retains the filename and releases its own object URL after handoff', () => {
    DownloadPDFBlob(new Blob(['Synthetic']), 'Order.pdf');
    Assert.deepEqual(Clicks, [{ URL: 'blob:Synthetic/1', Name: 'Order.pdf' }]);
    Assert.equal(Revoked.length, 0); Timers[0].Callback();
    Assert.deepEqual(Revoked, ['blob:Synthetic/1']);
    Assert.equal(GetPDFFileName('Order Archive/AWB%20One.pdf'), 'AWB One.pdf');
});
Test('Open tab owns a separate URL until it closes', () => {
    OpenPDFBlob(new Blob(['Synthetic']));
    Assert.equal(PDFWindow.opener, null); Assert.equal(PDFWindow.Target, 'blob:Synthetic/1');
    Timers[0].Callback(); Assert.equal(Revoked.length, 0);
    PDFWindow.closed = true; Timers[0].Callback();
    Assert.deepEqual(Revoked, ['blob:Synthetic/1']); Assert.equal(Timers[0].Cleared, true);
});
Test('Blocked popups do not allocate a leaking object URL', () => {
    window.open = () => null;
    Assert.throws(() => OpenPDFBlob(new Blob(['Synthetic'])), /Allow popups/);
    Assert.equal(Created.length, 0);
});
