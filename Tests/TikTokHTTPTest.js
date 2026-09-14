import Test from 'node:test';
import Assert from 'node:assert/strict';
import { CreateTikTokHandler } from '../api/_utils/TikTokHTTP.js';
import { LoadTikTokConfig } from '../api/_utils/TikTokRuntime.js';

function Response() {
    return { Headers: {}, Status: 0, Body: undefined, setHeader(Name, Value) { this.Headers[Name] = Value; },
        status(Value) { this.Status = Value; return this; }, json(Value) { this.Body = Value; }, end() {} };
}
Test('connect sets a secure per-intent cookie but never returns the browser secret', async () => {
    const Res = Response();
    const Handler = CreateTikTokHandler('Connect', () => ({ Authenticate: async () => 'Actor',
        Service: { Start: async () => ({ State: 'a'.repeat(64), Browser: 'b'.repeat(64), URL: 'https://services.tiktokshop.com/open/authorize?state=PublicState' }) } }));
    await Handler({ method: 'POST', headers: { origin: 'https://www.hghsejahtera.my', 'content-type': 'application/json' }, body: {} }, Res);
    Assert.equal(Res.Status, 200); Assert.deepEqual(Object.keys(Res.Body), ['URL']);
    Assert.match(Res.Headers['Set-Cookie'], /Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
    Assert.equal(Res.Headers['Cache-Control'], 'no-store');
});
Test('callback allows cross-site navigation, clears cookie and redirects without credentials', async () => {
    const State = 'a'.repeat(64); const Browser = 'b'.repeat(64); let Received;
    const Handler = CreateTikTokHandler('Callback', () => ({ Service: { Callback: async Input => { Received = Input; } } }));
    const Res = Response();
    await Handler({ method: 'GET', query: { state: State, code: 'PrivateCode', redirect: 'https://evil.test' },
        headers: { cookie: `__Host-TikTok${State.slice(0, 16)}=${Browser}` } }, Res);
    Assert.equal(Received.Browser, Browser); Assert.equal(Res.Status, 303);
    Assert.equal(Res.Headers.Location, 'https://www.hghsejahtera.my/Settings/APIConnection?Result=Ready');
    Assert.match(Res.Headers['Set-Cookie'], /Max-Age=0/); Assert.ok(!JSON.stringify(Res).includes('PrivateCode'));
});
Test('bad origins, invalid actions and unsupported methods cannot reach service mutations', async () => {
    let Calls = 0; const Factory = () => { Calls++; throw new Error('PrivateSecret'); };
    const Handler = CreateTikTokHandler('Connect', Factory);
    for (const Req of [{ method: 'GET' }, { method: 'POST', headers: { origin: 'https://evil.test' } },
        { method: 'POST', headers: { origin: 'https://www.hghsejahtera.my', 'content-type': 'text/plain' } }]) {
        const Res = Response(); await Handler(Req, Res); Assert.ok(Res.Status >= 400);
    }
    Assert.equal(Calls, 0);
});
Test('callback failure and unexpected server errors are redacted', async () => {
    for (const Kind of ['Connection', 'Callback']) {
        const Res = Response(); const Handler = CreateTikTokHandler(Kind, () => { throw new Error('PrivateSecret'); });
        await Handler({ method: 'GET', query: { state: 'a'.repeat(64), code: 'PrivateCode' } }, Res);
        Assert.ok(!JSON.stringify(Res).includes('Private'));
        Assert.equal(Res.Status, Kind === 'Callback' ? 303 : 503);
    }
});
Test('disabled or incomplete server config fails closed', () => {
    Assert.throws(() => LoadTikTokConfig({}), /SetupRequired/);
    Assert.throws(() => LoadTikTokConfig({ TikTokConnectionEnabled: 'true', TikTokTokenKeys: '{}' }), /SetupRequired/);
});
