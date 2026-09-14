import { createClient as CreateClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { CreateTikTokClient, TikTokError } from './TikTokClient.js';
import { CreateTikTokConnection } from './TikTokConnectionService.js';

export const TikTokOrigin = 'https://www.hghsejahtera.my';
const Roles = new Set(['Founder', 'Manager', 'Developer']);
const Actions = new Set(['CreateIntent', 'ClaimIntent', 'StageGrant', 'List', 'Get', 'Confirm',
    'Disconnect', 'Reconnect', 'AcquireRefresh', 'FinishRefresh', 'BeginCheck', 'FinishCheck']);

export function LoadTikTokConfig(Env = process.env) {
    if (Env.TikTokConnectionEnabled !== 'true') throw new TikTokError('SetupRequired', 503);
    let Keys;
    try { Keys = JSON.parse(Env.TikTokTokenKeys); } catch { throw new TikTokError('SetupRequired', 503); }
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(Env.TikTokAppKey || '') || !Env.TikTokAppSecret ||
        !/^\d{1,30}$/.test(Env.TikTokServiceID || '') || !/^\d{1,30}$/.test(Env.TikTokTestShopID || '') ||
        typeof Keys?.Current !== 'string' || !Object.hasOwn(Keys?.Values || {}, Keys.Current) ||
        Object.values(Keys.Values).some(Value => typeof Value !== 'string' ||
            Buffer.from(Value, 'base64').length !== 32 || Buffer.from(Value, 'base64').toString('base64') !== Value)) {
        throw new TikTokError('SetupRequired', 503);
    }
    return { AppKey: Env.TikTokAppKey, AppSecret: Env.TikTokAppSecret, ServiceID: Env.TikTokServiceID,
        TestShopID: Env.TikTokTestShopID, Keys };
}

export function CreateTikTokRuntime(Env = process.env, Fetch = globalThis.fetch) {
    const Config = LoadTikTokConfig(Env);
    const DatabaseURL = Env.SUPABASE_URL || Env.VITE_SUPABASE_URL;
    const PublicKey = Env.SUPABASE_ANON_KEY || Env.VITE_SUPABASE_ANON_KEY;
    const ServiceKey = Env.SUPABASE_SERVICE_ROLE_KEY;
    if (!DatabaseURL || !PublicKey || !ServiceKey || ServiceKey === PublicKey) throw new TikTokError('SetupRequired', 503);
    const Options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (Resource, Settings = {}) => Fetch(Resource, { ...Settings, redirect: 'error',
            signal: Settings.signal ? AbortSignal.any([Settings.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }) } };
    const Database = CreateClient(DatabaseURL, ServiceKey, Options);
    const Auth = CreateClient(DatabaseURL, PublicKey, Options);
    async function CheckActor(ActorUserID) {
        const { data: Profile, error: Failure } = await Database.from('Users').select('UserID,Role,IsActive')
            .eq('UserID', ActorUserID).maybeSingle();
        if (Failure) throw new TikTokError('StorageUnavailable', 503);
        if (!Profile || Profile.IsActive !== true || !Roles.has(Profile.Role)) throw new TikTokError('AccessDenied', 403);
    }
    async function Authenticate(Req) {
        const Header = Req.headers?.authorization;
        if (typeof Header !== 'string' || Header.length > 8192 || !/^Bearer \S+$/.test(Header)) throw new TikTokError('SignInRequired', 401);
        const { data: Data, error: Failure } = await Auth.auth.getUser(Header.slice(7));
        if (Failure || !Data?.user?.id) throw new TikTokError('SignInRequired', 401);
        await CheckActor(Data.user.id);
        return Data.user.id;
    }
    async function Store(Action, Input) {
        if (!Actions.has(Action)) throw new TikTokError('StorageUnavailable', 503);
        // Deliberately fails closed until the reviewed service-only RPC is applied.
        // Never fall back to browser-readable tables or process-memory token storage.
        const { data: Data, error: Failure } = await Database.rpc('TikTokConnectionStore', { Action, Input });
        if (Failure) throw new TikTokError('StorageUnavailable', 503);
        return Data;
    }
    const Provider = CreateTikTokClient(Config, Fetch);
    return { Authenticate, Service: CreateTikTokConnection({ Config, Store, Provider, CheckActor }), Config, Store, Provider };
}
