import { createClient as CreateClient } from '@supabase/supabase-js';
import { createHmac as CreateHMAC } from 'node:crypto';
import { isIP as IsIP } from 'node:net';

const Origins = new Set(['https://www.hghsejahtera.my', 'https://hghsejahtera.my', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const Actions = new Set(['Username', 'Email', 'Password', 'SetPIN', 'DisablePIN']);
export function CreateAccountChangeHandler({ Env, Client = CreateClient } = {}) {
    return async (Req, Res) => {
        Res.setHeader('Cache-Control', 'no-store');
        Res.setHeader('CDN-Cache-Control', 'no-store');
        const Reply = (Status, Error) => Res.status(Status).json({ Error });
        if (Req.method !== 'POST') { Res.setHeader('Allow', 'POST'); return Reply(405, 'Unavailable'); }
        if (!Origins.has(Req.headers?.origin)) return Reply(403, 'Unavailable');
        if (!/^application\/json(?:;|$)/i.test(Req.headers?.['content-type'] || '')) return Reply(415, 'Invalid');
        const Body = Req.body;
        const PINAction = ['SetPIN', 'DisablePIN'].includes(Body?.Action);
        if ((PINAction ? Env.PINChangesEnabled : Env.AccountChangesEnabled) !== 'true') return Reply(503, 'SetupRequired');
        if (!Body || !Actions.has(Body.Action) || typeof Body.CurrentPassword !== 'string' || !Body.CurrentPassword || Body.CurrentPassword.length > 1024) return Reply(400, 'Invalid');
        const Value = Body.Value;
        if (Body.Action === 'Username' && (typeof Value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(Value))) return Reply(400, 'UsernameInvalid');
        if (Body.Action === 'Email' && (typeof Value !== 'string' || Value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Value))) return Reply(400, 'EmailInvalid');
        if (Body.Action === 'Password' && (typeof Value !== 'string' || Array.from(Value).length < 15 || new TextEncoder().encode(Value).length > 72 || Value === Body.CurrentPassword)) return Reply(400, 'PasswordInvalid');
        if (Body.Action === 'SetPIN' && (typeof Value !== 'string' || !/^\d{4}$/.test(Value))) return Reply(400, 'PINInvalid');
        const Token = Req.headers?.authorization?.match(/^Bearer (\S+)$/)?.[1];
        if (!Token) return Reply(401, 'SignIn');
        const URL = Env.SUPABASE_URL || Env.VITE_SUPABASE_URL;
        const PublicKey = Env.SUPABASE_ANON_KEY || Env.VITE_SUPABASE_ANON_KEY;
        const ServiceKey = Env.SUPABASE_SERVICE_ROLE_KEY;
        const IP = Env.VERCEL === '1' ? Req.headers?.['x-vercel-forwarded-for'] : Req.socket?.remoteAddress;
        if (!URL || !PublicKey || !ServiceKey || PublicKey === ServiceKey || !IsIP(IP || '')) return Reply(503, 'Unavailable');
        const Options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (Resource, Options = {}) => {
            try { return await fetch(Resource, { ...Options, redirect: 'error', signal: AbortSignal.timeout(10000) }); }
            catch { throw new Error('Unavailable'); }
        } } };
        const Auth = Client(URL, PublicKey, Options);
        const Database = Client(URL, ServiceKey, Options);
        let Verified = false;
        try {
            const { data: Identity, error: IdentityError } = await Auth.auth.getUser(Token);
            if (IdentityError || !Identity?.user?.id || !Identity.user.email) return Reply(401, 'SignIn');
            const UserID = Identity.user.id;
            const Key = Value => CreateHMAC('sha256', ServiceKey).update('HGHAccountChange:' + Value).digest('hex');
            const { data: Limit, error: LimitError } = await Database.rpc('ConsumeLoginAttempt', { IPKey: Key(IP), IdentifierKey: Key(UserID) });
            if (LimitError || typeof Limit?.Allowed !== 'boolean') return Reply(503, 'Unavailable');
            if (!Limit.Allowed) return Reply(429, 'TooManyAttempts');
            const { data: Profile, error: ProfileError } = await Database.from('Users').select('UserID, IsActive, Role').eq('UserID', UserID).single();
            if (ProfileError || !Profile?.IsActive || Profile.Role === 'Pending') return Reply(403, 'SignIn');
            // A separate short-lived Auth client verifies the CURRENT account, never an identifier supplied by the caller.
            const { data: Proof, error: ProofError } = await Auth.auth.signInWithPassword({ email: Identity.user.email, password: Body.CurrentPassword });
            Verified = !!Proof?.session;
            if (ProofError || Proof?.user?.id !== UserID) return Reply(401, 'WrongPassword');
            let Result;
            if (Body.Action === 'Username') Result = await Database.rpc('ChangeOwnUsername', { TargetUserID: UserID, NewUsername: Value });
            else if (Body.Action === 'Email') Result = await Auth.auth.updateUser({ email: Value });
            else if (Body.Action === 'Password') Result = await Auth.auth.updateUser({ password: Value, current_password: Body.CurrentPassword });
            else Result = await Database.rpc('ChangeOwnPIN', { TargetUserID: UserID, NewPIN: Body.Action === 'DisablePIN' ? null : Value });
            if (Result?.error) return Reply(400, Result.error.code === '23505' ? 'UsernameTaken' : 'UpdateFailed');
            if (!Result || (['Username', 'SetPIN', 'DisablePIN'].includes(Body.Action) && Result.data !== true)) return Reply(503, 'Unavailable');
            if (Body.Action === 'Password') {
                const { error: SignOutError } = await Auth.auth.signOut({ scope: 'global' });
                Verified = !!SignOutError;
                return Res.status(200).json({ Status: 'PasswordChanged', SignOutComplete: !SignOutError });
            }
            return Res.status(200).json({ Status: Body.Action === 'Email' ? 'EmailPending' : 'Updated' });
        } catch { return Reply(503, 'Unavailable'); }
        finally { if (Verified) await Auth.auth.signOut({ scope: 'local' }).catch(() => {}); }
    };
}
export default function AccountChange(Req, Res) { return CreateAccountChangeHandler({ Env: process.env })(Req, Res); }
