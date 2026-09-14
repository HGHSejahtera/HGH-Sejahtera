import Test from 'node:test';
import Assert from 'node:assert/strict';
import { CreateTikTokWorker } from '../Workers/TikTokWorker.js';

const Origin = 'https://www.hghsejahtera.my';
const Connect = '/api/TikTokConnect';
const Callback = '/api/TikTokAuthorization';
function RequestFor(Path, Body = '{}', Extra = {}) {
    return new Request(Origin + Path, { method: 'POST', headers: { Origin, 'Content-Type': 'application/json', ...Extra }, body: Body });
}
function Factory(Calls) {
    return Env => ({ Authenticate: async () => Env.Actor,
        Service: { Start: async Actor => { Calls.push(Actor); await Promise.resolve();
            return { State: 'a'.repeat(64), Browser: 'b'.repeat(64), URL: 'https://services.tiktokshop.com/open/authorize' }; },
        Callback: async Input => { Calls.push(Input); }, List: async Actor => [{ Actor }] } });
}
Test('Worker preserves secure connection cookies and keeps concurrent environment bindings separate', async () => {
    const Calls = []; const Worker = CreateTikTokWorker(Factory(Calls));
    const Responses = await Promise.all(['First', 'Second'].map(Actor => Worker.fetch(RequestFor(Connect), { Actor })));
    Assert.deepEqual(Calls.sort(), ['First', 'Second']);
    for (const Response of Responses) {
        Assert.equal(Response.status, 200);
        Assert.match(Response.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
        Assert.equal(Response.headers.get('Cache-Control'), 'no-store');
        Assert.deepEqual(Object.keys(await Response.json()), ['URL']);
    }
});
Test('Worker callback preserves browser binding and rejects duplicate state or code', async () => {
    const Calls = []; const Worker = CreateTikTokWorker(Factory(Calls)); const State = 'a'.repeat(64);
    const Response = await Worker.fetch(new Request(Origin + Callback + '?state=' + State + '&code=PrivateCode', {
        headers: { Cookie: '__Host-TikTok' + State.slice(0, 16) + '=' + 'b'.repeat(64) } }), {});
    Assert.equal(Response.status, 303); Assert.equal(Calls[0].Browser, 'b'.repeat(64));
    Assert.equal(Response.headers.get('Location'), Origin + '/Settings/APIConnection?Result=Ready');
    for (const Query of ['state=' + State + '&state=' + State + '&code=PrivateCode',
        'state=' + State + '&code=PrivateCode&code=AnotherCode']) {
        const Invalid = await Worker.fetch(new Request(Origin + Callback + '?' + Query), {});
        Assert.equal(Invalid.status, 303);
        Assert.equal(Invalid.headers.get('Location'), Origin + '/Settings/APIConnection?Result=Error');
    }
    Assert.equal(Calls.length, 1);
});
Test('Worker rejects unrelated routes, noncanonical hosts and invalid bodies before creating runtime', async () => {
    let Calls = 0; const Worker = CreateTikTokWorker(() => { Calls++; throw Error('PrivateSecret'); });
    const Cases = [
        [new Request('https://other.example/api/TikTokConnect', { method: 'POST' }), 403],
        [new Request(Origin + '/api/telegram-webhook', { method: 'POST' }), 404],
        [RequestFor(Connect, '{}', { Origin: 'https://other.example' }), 403],
        [RequestFor(Connect, '{}', { 'Content-Type': 'text/plain' }), 415],
        [RequestFor(Connect, '{invalid'), 400],
        [RequestFor(Connect, '[]'), 400],
        [RequestFor(Connect, JSON.stringify({ Text: 'x'.repeat(4096) })), 413],
        [RequestFor(Connect, '{}', { 'Content-Length': '5000' }), 413],
        [RequestFor(Connect, '{}', { 'Content-Encoding': 'gzip' }), 415],
        [new Request(Origin + Connect, { method: 'DELETE' }), 405],
    ];
    for (const [Request, Status] of Cases) {
        const Response = await Worker.fetch(Request, {}); Assert.equal(Response.status, Status);
        Assert.equal(Response.headers.get('Cache-Control'), 'no-store');
        Assert.ok(!(await Response.text()).includes('PrivateSecret'));
    }
    Assert.equal(Calls, 0);
});
Test('Worker counts streamed bytes even without Content-Length', async () => {
    let Cancelled = false; let Calls = 0;
    const Body = new ReadableStream({ pull(Controller) { Controller.enqueue(new Uint8Array(2048)); }, cancel() { Cancelled = true; } });
    const Worker = CreateTikTokWorker(() => { Calls++; throw Error('Unexpected'); });
    const Request = new globalThis.Request(Origin + Connect, { method: 'POST', headers: { Origin, 'Content-Type': 'application/json' }, body: Body, duplex: 'half' });
    const Response = await Worker.fetch(Request, {});
    Assert.equal(Response.status, 413); Assert.equal(Calls, 0); Assert.equal(Cancelled, true);
});
Test('Worker blocks upstream redirects and removes URLs from fetch errors', async Context => {
    let Calls = 0; let Cancelled = false;
    Context.mock.method(globalThis, 'fetch', async (Resource, Options) => {
        Calls++; Assert.equal(Options.redirect, 'manual');
        if (Calls === 2) throw new Error('https://provider.invalid/?secret=PrivateSecret');
        return new Response(new ReadableStream({ cancel() { Cancelled = true; } }),
            { status: 302, headers: { Location: 'https://other.example/' } });
    });
    const Worker = CreateTikTokWorker((Env, Fetch) => ({ Authenticate: async () => 'Actor',
        Service: { List: async () => {
            await Assert.rejects(Fetch('https://provider.invalid/?secret=PrivateSecret', { redirect: 'error' }),
                { message: 'TikTok backend request unavailable.' });
            return [];
        } } }));
    for (let Index = 0; Index < 2; Index++) {
        const Response = await Worker.fetch(new Request(Origin + '/api/TikTokConnection'), {});
        Assert.equal(Response.status, 200);
    }
    Assert.equal(Calls, 2); Assert.equal(Cancelled, true);
});
