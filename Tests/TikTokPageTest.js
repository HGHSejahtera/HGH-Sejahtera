import Test from 'node:test';
import Assert from 'node:assert/strict';
import { readFile as ReadFile } from 'node:fs/promises';
import { runInNewContext as Run } from 'node:vm';
import { create as Create } from 'zustand';
import { CreateTikTokPageWorker } from '../Workers/TikTokPageWorker.js';

const Origin = 'https://www.hghsejahtera.my';
Test('isolated page routes preserve API and exclude website, AWB and private assets', async () => {
    const Calls = [];
    const Worker = CreateTikTokPageWorker({ fetch: async RequestValue => { Calls.push(RequestValue.url); return new Response('API'); } });
    const Env = { Assets: { fetch: async RequestValue => { Calls.push(RequestValue.url); return new Response('Asset'); } } };
    const Page = await Worker.fetch(new Request(Origin + '/Settings/APIConnection?Result=Ready'), Env);
    Assert.equal(await Page.text(), 'Asset'); Assert.equal(Calls.pop(), Origin + '/index.html');
    Assert.equal(Page.headers.get('Cache-Control'), 'no-store');
    Assert.match(Page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    Assert.equal(await (await Worker.fetch(new Request(Origin + '/api/TikTokConnection'), Env)).text(), 'API'); Calls.pop();
    for (const Path of ['/Inventory', '/Settings/APIConnectionWrong', '/SSM/Private.pdf', '/TikTokAssets/Secret.pdf', '/TikTokAssets/index.html']) {
        Assert.equal((await Worker.fetch(new Request(Origin + Path), Env)).status, 404);
    }
    Assert.equal(Calls.length, 0);
    Assert.equal((await Worker.fetch(new Request(Origin + '/Settings/APIConnection', { method: 'POST' }), Env)).status, 405);
    Assert.equal((await Worker.fetch(new Request('https://wrong.test/Settings/APIConnection'), Env)).status, 403);
    const Asset = await Worker.fetch(new Request(Origin + '/TikTokAssets/Page-123.js'), Env);
    Assert.match(Asset.headers.get('Cache-Control'), /immutable/);
});
Test('missing assets fail closed without falling back to another origin', async () => {
    const Worker = CreateTikTokPageWorker();
    Assert.equal((await Worker.fetch(new Request(Origin + '/Settings/APIConnection'), {})).status, 503);
});
const AuthSource = (await ReadFile(new URL('../Src/TikTokPage/TikTokPageAuth.js', import.meta.url), 'utf8'))
    .replace(/^import .*;$/gm, '').replace('export function', 'function').replace(/^export const useAuthStore.*$/m, '');
function Fixture() {
    const Profile = { Role: 'Manager', IsActive: true, PINHash: 'Present', DisplayName: 'Fixture' };
    let ResolveProfile; let ResolvePIN;
    const Client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(Resolve => { ResolveProfile = Resolve; }) }) }) }),
        rpc: () => new Promise(Resolve => { ResolvePIN = Resolve; }) };
    const Context = { create: Create };
    Run(AuthSource, Context);
    const Store = Context.CreateTikTokPageAuth(Client, {});
    return { Store, Profile, ProfileResult: () => ResolveProfile({ data: Profile }), PINResult: () => ResolvePIN({ data: true }) };
}
Test('page restores account with PIN lock and rejects late profile after logout', async () => {
    const F = Fixture(); const Pending = F.Store.getState().HandleSession({ user: { id: 'A' } });
    F.ProfileResult(); await Pending;
    Assert.equal(F.Store.getState().isLocked, true);
    const Unlock = F.Store.getState().unlockApp('1234'); F.PINResult(); Assert.equal(await Unlock, true);
    Assert.equal(F.Store.getState().isLocked, false);
    const Late = F.Store.getState().HandleSession({ user: { id: 'A' } });
    await F.Store.getState().HandleSession(null); F.ProfileResult(); await Late;
    Assert.equal(F.Store.getState().isAuthenticated, false); Assert.equal(F.Store.getState().user, null);
});
Test('page denies inactive or Agent accounts and ignores PIN result after session changes', async () => {
    for (const Change of [{ Role: 'Agent' }, { IsActive: false }]) {
        const F = Fixture(); Object.assign(F.Profile, Change);
        const Pending = F.Store.getState().HandleSession({ user: { id: 'A' } }); F.ProfileResult(); await Pending;
        Assert.equal(F.Store.getState().isAuthenticated, false);
    }
    const F = Fixture(); const Pending = F.Store.getState().HandleSession({ user: { id: 'A' } }); F.ProfileResult(); await Pending;
    const Unlock = F.Store.getState().unlockApp('1234'); await F.Store.getState().HandleSession(null); F.PINResult();
    Assert.equal(await Unlock, false);
});
