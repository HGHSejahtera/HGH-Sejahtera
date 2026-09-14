import Test from 'node:test';
import Assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { CreateTikTokConnection } from '../api/_utils/TikTokConnectionService.js';
import { DecryptTokens } from '../api/_utils/TikTokCredentials.js';

function Fixture() {
    let Time = 1800000000;
    const Intents = new Map(); const Grants = new Map();
    const Actor = 'ActorA'; let Active = true; let Exchanges = 0; let Refreshes = 0;
    const Config = { AppKey: 'App', ServiceID: '123', TestShopID: '7494899191146513559',
        Keys: { Current: '1', Values: { '1': Buffer.alloc(32, 7).toString('base64') } } };
    const Tokens = () => ({ access_token: 'PrivateAccess', refresh_token: 'PrivateRefresh', open_id: 'SellerA',
        user_type: 0, access_token_expire_in: Time + 200, refresh_token_expire_in: Time + 5000 });
    const Provider = { Exchange: async () => { Exchanges++; return Tokens(); },
        Refresh: async () => { Refreshes++; return Tokens(); },
        Shops: async () => ({ shops: [{ id: Config.TestShopID, cipher: 'PrivateCipher', name: 'Test Centre', region: 'MY' }] }) };
    // Atomic in-memory substitute for the documented private database contract.
    // No network, fake production accounts or database installation.
    const Store = async (Action, Input) => {
        if (Action === 'CreateIntent') { Intents.set(Input.StateHash, structuredClone(Input)); return true; }
        if (Action === 'ClaimIntent') {
            const Row = Intents.get(Input.StateHash);
            if (!Row || Row.Claimed || Row.ExpiresAt <= Time || Row.BrowserHash !== Input.BrowserHash) return null;
            Row.Claimed = true; return structuredClone(Row);
        }
        if (Action === 'StageGrant') {
            const Existing = Grants.get(Input.GrantID);
            if (Existing && Existing.ActorUserID !== Input.ActorUserID) return false;
            Grants.set(Input.GrantID, { ...structuredClone(Input), Version: (Existing?.Version || 0) + 1 }); return true;
        }
        if (Action === 'List') return [...Grants.values()].filter(Row => Row.ActorUserID === Input.ActorUserID).map(Row => structuredClone(Row));
        const Row = Grants.get(Input.GrantID);
        if (!Row || Row.ActorUserID !== Input.ActorUserID) return null;
        if (Action === 'Get') return structuredClone(Row);
        if (Row.Version !== Input.Version) return false;
        if (Action === 'BeginCheck') { Row.CheckID = Input.CheckID; return Row.Status === 'Connected'; }
        if (Action === 'FinishCheck') {
            if (Row.Status !== 'Connected' || Row.CheckID !== Input.CheckID) return false;
            Row.LastCheckedAt = Input.CheckedAt; return true;
        }
        if (Action === 'Confirm') {
            if (Row.Status !== 'PendingConfirmation' || Row.ConfirmBy <= Time) return false;
            Row.Status = 'Connected'; Row.Version++; return true;
        }
        if (Action === 'Disconnect' || Action === 'Reconnect') {
            Row.Status = Action === 'Disconnect' ? 'Disconnected' : 'ReconnectRequired';
            Row.Envelope = null; Row.LeaseID = null; Row.Version++; return true;
        }
        if (Action === 'AcquireRefresh') {
            if (Row.Status !== 'Connected' || Row.LeaseID) return null;
            Row.LeaseID = Input.LeaseID; Row.LeaseUntil = Time + 60; Row.Version++; return structuredClone(Row);
        }
        if (Action === 'FinishRefresh') {
            if (Row.Status !== 'Connected' || Row.LeaseID !== Input.LeaseID || Row.LeaseUntil <= Time) return false;
            Object.assign(Row, structuredClone(Input.Update), { LeaseID: null, LeaseUntil: null, Version: Row.Version + 1 }); return true;
        }
        throw new Error('Unexpected store action');
    };
    const CheckActor = async () => { if (!Active) throw new Error('Inactive'); };
    const Service = CreateTikTokConnection({ Config, Store, Provider, CheckActor, Now: () => Time });
    async function Connect() {
        const Start = await Service.Start(Actor);
        const State = new URL(Start.URL).searchParams.get('state');
        await Service.Callback({ State, Browser: Start.Browser, Code: 'FreshCode' });
        const Grant = [...Grants.values()][0];
        await Service.Confirm(Actor, Grant.GrantID);
        return Grant.GrantID;
    }
    return { Service, Store, Provider, Config, Intents, Grants, Connect, Actor,
        Advance: Seconds => { Time += Seconds; }, Disable: () => { Active = false; },
        Exchanges: () => Exchanges, Refreshes: () => Refreshes };
}

Test('authorization binds browser, consumes state once and needs same-user confirmation', async () => {
    const F = Fixture(); const Start = await F.Service.Start(F.Actor);
    const State = new URL(Start.URL).searchParams.get('state');
    Assert.equal(State.length, 64); Assert.ok(!JSON.stringify([...F.Intents.values()]).includes(State));
    await Assert.rejects(F.Service.Callback({ State, Browser: 'a'.repeat(64), Code: 'Code' }));
    await F.Service.Callback({ State, Browser: Start.Browser, Code: 'Code' });
    await Assert.rejects(F.Service.Callback({ State, Browser: Start.Browser, Code: 'Code' }));
    Assert.equal(F.Exchanges(), 1);
    const Row = [...F.Grants.values()][0];
    Assert.equal(Row.Status, 'PendingConfirmation');
    Assert.ok(!JSON.stringify(Row).includes('PrivateAccess'));
    Assert.ok(!JSON.stringify(await F.Service.List(F.Actor)).includes('Private'));
    await Assert.rejects(F.Service.Access(F.Actor, Row.GrantID));
    await Assert.rejects(F.Service.Confirm('ActorB', Row.GrantID));
    await F.Service.Confirm(F.Actor, Row.GrantID);
    Assert.equal((await F.Service.Access(F.Actor, Row.GrantID)).Tokens.access_token, 'PrivateAccess');
});

Test('expired, denied, missing and wrong-shop callbacks do not connect', async () => {
    for (const Mode of ['Expired', 'Denied', 'Missing', 'Shop', 'Inactive']) {
        const F = Fixture(); const Start = await F.Service.Start(F.Actor);
        const State = new URL(Start.URL).searchParams.get('state');
        if (Mode === 'Expired') F.Advance(601);
        if (Mode === 'Inactive') F.Disable();
        if (Mode === 'Shop') F.Provider.Shops = async () => ({ shops: [{ id: 'Wrong', region: 'MY', cipher: 'Cipher' }] });
        await Assert.rejects(F.Service.Callback({ State: Mode === 'Missing' ? '' : State,
            Browser: Start.Browser, Code: 'Code', Denied: Mode === 'Denied' }));
        Assert.equal(F.Grants.size, 0);
    }
});

Test('simultaneous callbacks exchange once', async () => {
    const F = Fixture(); const Start = await F.Service.Start(F.Actor);
    const Input = { State: new URL(Start.URL).searchParams.get('state'), Browser: Start.Browser, Code: 'Code' };
    const Results = await Promise.allSettled([F.Service.Callback(Input), F.Service.Callback(Input)]);
    Assert.equal(Results.filter(Result => Result.status === 'fulfilled').length, 1);
    Assert.equal(F.Exchanges(), 1);
});

Test('refresh is single-flight and disconnect prevents an in-flight refresh restoring credentials', async () => {
    const F = Fixture(); const ID = await F.Connect(); F.Advance(100);
    let Release; let Enter;
    const Entered = new Promise(Resolve => { Enter = Resolve; });
    const Original = F.Provider.Refresh;
    F.Provider.Refresh = async (...Args) => { Enter(); await new Promise(Resolve => { Release = Resolve; }); return Original(...Args); };
    const First = F.Service.Access(F.Actor, ID); await Entered;
    await Assert.rejects(F.Service.Access(F.Actor, ID));
    await F.Service.Disconnect(F.Actor, ID); Release();
    await Assert.rejects(First);
    Assert.equal(F.Refreshes(), 1); Assert.equal(F.Grants.get(ID).Envelope, null);
    Assert.equal(F.Grants.get(ID).Status, 'Disconnected');
});

Test('ambiguous refresh failure requires reconnect and is never blindly retried', async () => {
    const F = Fixture(); const ID = await F.Connect(); F.Advance(100); let Count = 0;
    F.Provider.Refresh = async () => { Count++; throw new Error('PrivateRefresh URL'); };
    await Assert.rejects(F.Service.Access(F.Actor, ID), ErrorValue => !ErrorValue.message.includes('Private'));
    await Assert.rejects(F.Service.Access(F.Actor, ID));
    Assert.equal(Count, 1); Assert.equal(F.Grants.get(ID).Status, 'ReconnectRequired');
});

Test('successful refresh writes a new encrypted token version', async () => {
    const F = Fixture(); const ID = await F.Connect(); F.Advance(100);
    await F.Service.Access(F.Actor, ID);
    Assert.equal(F.Refreshes(), 1);
    const Row = F.Grants.get(ID);
    Assert.equal(Row.LeaseID, null);
    Assert.equal(DecryptTokens(Row.Envelope, `${ID}:Test`, F.Config.Keys).open_id, 'SellerA');
});

Test('data results arriving after disconnect cannot be returned as a successful check', async () => {
    const F = Fixture(); const ID = await F.Connect();
    F.Provider.Request = async () => { await F.Service.Disconnect(F.Actor, ID); return { orders: [] }; };
    await Assert.rejects(F.Service.CheckData(F.Actor, ID, 'Orders'), /ConnectionChanged/);
    Assert.equal(F.Grants.get(ID).Status, 'Disconnected');
});

Test('a completed read check updates only its checked timestamp', async () => {
    const F = Fixture(); const ID = await F.Connect(); const Version = F.Grants.get(ID).Version;
    F.Provider.Request = async () => ({ orders: [] });
    const Result = await F.Service.CheckData(F.Actor, ID, 'Orders');
    Assert.equal(Result.Status, 'NoData'); Assert.equal(F.Grants.get(ID).Version, Version);
    Assert.equal(F.Grants.get(ID).LastCheckedAt, Result.CheckedAt);
});
