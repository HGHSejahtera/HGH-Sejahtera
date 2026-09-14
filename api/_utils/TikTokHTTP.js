import { Buffer } from 'node:buffer';
import { TikTokError } from './TikTokClient.js';
import { CreateTikTokRuntime, TikTokOrigin } from './TikTokRuntime.js';

const Messages = {
    SetupRequired: 'TikTok connection setup is not complete.', StorageUnavailable: 'TikTok storage is unavailable. Contact the developer.',
    SignInRequired: 'Please sign in again.', AccessDenied: 'This account cannot manage TikTok connections.',
    RateLimited: 'Too many attempts. Try again later.', ReconnectRequired: 'Connect the shop again.',
    ConnectionBusy: 'Another connection request is running. Try again shortly.',
    ConnectionChanged: 'The connection changed. Refresh this page.', CredentialUnavailable: 'The credential key is unavailable. Contact the developer.',
    ConnectionNotFound: 'Connection not found.', AuthorizationExpired: 'Authorization expired. Connect again.',
    ScopeRequired: 'TikTok has not granted the required API permission.',
    InvalidResponse: 'TikTok returned an unexpected response. The data check did not pass.',
    ProviderUnavailable: 'TikTok is unavailable. Try again later.',
};
const CookieName = State => '__Host-TikTok' + State.slice(0, 16);
function Headers(Res) {
    for (const Name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) Res.setHeader(Name, 'no-store');
    Res.setHeader('Referrer-Policy', 'no-referrer'); Res.setHeader('X-Content-Type-Options', 'nosniff');
    Res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
}
function Cookie(State, Value, Age) {
    return `${CookieName(State)}=${Value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Age}`;
}
function ReadCookie(Header, State) {
    if (typeof Header !== 'string' || Header.length > 16384) return '';
    const Values = Header.split(';').map(Value => Value.trim()).filter(Value => Value.startsWith(CookieName(State) + '='));
    return Values.length === 1 ? Values[0].slice(CookieName(State).length + 1) : '';
}
export function CreateTikTokHandler(Kind, RuntimeFactory = CreateTikTokRuntime) {
    return async function Handler(Req, Res) {
        Headers(Res);
        const Callback = Kind === 'Callback';
        const Allowed = Callback ? ['GET'] : Kind === 'Connect' ? ['POST'] : ['GET', 'POST'];
        if (!Allowed.includes(Req.method)) {
            Res.setHeader('Allow', Allowed.join(', ')); return Res.status(405).json({ Error: 'Method not allowed.' });
        }
        try {
            if (Callback) {
                const Query = Req.query || {};
                const State = typeof Query.state === 'string' && /^[a-f0-9]{64}$/.test(Query.state) ? Query.state : '';
                if (!State) throw new TikTokError('InvalidAuthorization', 400);
                const Runtime = RuntimeFactory();
                const Browser = ReadCookie(Req.headers?.cookie, State);
                Res.setHeader('Set-Cookie', Cookie(State, '', 0));
                await Runtime.Service.Callback({ State, Browser, Code: Query.code, Denied: Query.error !== undefined });
                Res.setHeader('Location', TikTokOrigin + '/Settings/APIConnection?Result=Ready');
                return Res.status(303).end();
            }
            if (Req.method === 'POST') {
                if (Req.headers?.origin !== TikTokOrigin) throw new TikTokError('AccessDenied', 403);
                if (!/^application\/json(?:\s*;|$)/i.test(Req.headers?.['content-type'] || '')) throw new TikTokError('InvalidRequest', 415);
                if (!Req.body || typeof Req.body !== 'object' || Array.isArray(Req.body) ||
                    Buffer.byteLength(JSON.stringify(Req.body)) > 4096) throw new TikTokError('InvalidRequest', 400);
            }
            const Runtime = RuntimeFactory(); const Actor = await Runtime.Authenticate(Req);
            if (Kind === 'Connect') {
                const Result = await Runtime.Service.Start(Actor);
                Res.setHeader('Set-Cookie', Cookie(Result.State, Result.Browser, 600));
                return Res.status(200).json({ URL: Result.URL });
            }
            if (Req.method === 'GET') return Res.status(200).json({ Connections: await Runtime.Service.List(Actor) });
            const { Action, GrantID, Dataset } = Req.body;
            if (Action === 'CheckData') return Res.status(200).json({ Result: await Runtime.Service.CheckData(Actor, GrantID, Dataset) });
            if (!['Confirm', 'Disconnect'].includes(Action)) throw new TikTokError('InvalidRequest', 400);
            await Runtime.Service[Action](Actor, GrantID);
            return Res.status(200).json({ Success: true });
        } catch (Failure) {
            // No raw query, provider payload, cookie, token or stack is logged/returned.
            if (Callback) {
                Res.setHeader('Location', TikTokOrigin + '/Settings/APIConnection?Result=Error');
                return Res.status(303).end();
            }
            const Known = Failure instanceof TikTokError;
            const Status = Known ? Failure.Status : 503;
            if (Status === 429) Res.setHeader('Retry-After', '60');
            return Res.status(Status).json({ Error: Known && Messages[Failure.Kind] || 'TikTok request failed. Refresh and try again.',
                Code: Known && Object.hasOwn(Messages, Failure.Kind) ? Failure.Kind : 'RequestFailed' });
        }
    };
}
