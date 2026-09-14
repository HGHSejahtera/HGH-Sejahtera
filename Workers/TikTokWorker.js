import { CreateTikTokHandler } from '../api/_utils/TikTokHTTP.js';
import { CreateTikTokRuntime, TikTokOrigin } from '../api/_utils/TikTokRuntime.js';

const Routes = new Map([
    ['/api/TikTokConnect', 'Connect'],
    ['/api/TikTokAuthorization', 'Callback'],
    ['/api/TikTokConnection', 'Connection'],
]);
async function FetchTikTok(Resource, Settings = {}) {
    try {
        // workerd does not support redirect: 'error'. Never follow redirects,
        // including those from authentication, token exchange or the database.
        const Result = await fetch(Resource, { ...Settings, redirect: 'manual' });
        if (Result.status >= 300 && Result.status < 400) {
            await Result.body?.cancel().catch(() => {});
            throw new Error('Redirect blocked.');
        }
        return Result;
    } catch {
        // Supabase may log fetch failures. Do not preserve credential-bearing URLs.
        throw new Error('TikTok backend request unavailable.');
    }
}
function Failure(Status) {
    return new Response(JSON.stringify({ Error: 'TikTok request could not be processed.', Code: 'RequestFailed' }), {
        status: Status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
            'CDN-Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" },
    });
}
async function ReadBody(Request) {
    if (!Request.body) throw 400;
    const Length = Request.headers.get('Content-Length');
    if (Length !== null && (!/^\d+$/.test(Length) || Number(Length) > 4096)) throw 413;
    const Reader = Request.body.getReader(); const Decoder = new TextDecoder('utf-8', { fatal: true });
    let Size = 0; let Text = '';
    try {
        for (;;) {
            const Chunk = await Reader.read();
            if (Chunk.done) break;
            Size += Chunk.value.byteLength;
            if (Size > 4096) throw 413;
            Text += Decoder.decode(Chunk.value, { stream: true });
        }
        Text += Decoder.decode();
        const Body = JSON.parse(Text);
        if (!Body || typeof Body !== 'object' || Array.isArray(Body)) throw 400;
        return Body;
    } catch (ErrorValue) {
        throw ErrorValue === 413 ? 413 : 400;
    } finally { await Reader.cancel().catch(() => {}); }
}

// This adapter serves only the three existing TikTok endpoints. It does not
// proxy unmatched requests or mount the application's public directory.
export function CreateTikTokWorker(RuntimeFactory = CreateTikTokRuntime) {
    return {
        async fetch(Request, Env) {
            try {
                const URLValue = new URL(Request.url);
                if (URLValue.origin !== TikTokOrigin) return Failure(403);
                const Kind = Routes.get(URLValue.pathname);
                if (!Kind) return Failure(404);
                if (Request.url.length > 8192) return Failure(414);
                const RequestHeaders = Object.fromEntries(Request.headers);
                let Body;
                if (Request.method === 'POST' && Kind !== 'Callback') {
                    if (RequestHeaders.origin !== TikTokOrigin) return Failure(403);
                    if (!/^application\/json(?:\s*;|$)/i.test(RequestHeaders['content-type'] || '') ||
                        !['identity', undefined].includes(RequestHeaders['content-encoding'])) return Failure(415);
                    try { Body = await ReadBody(Request); } catch (Status) { return Failure(Status); }
                }
                const Query = Object.create(null);
                for (const Name of ['state', 'code', 'error']) {
                    const Values = URLValue.searchParams.getAll(Name);
                    if (Values.length) Query[Name] = Values.length === 1 ? Values[0] : Values;
                }
                // Reject ambiguous callback parameters before the service can claim an intent.
                if (Kind === 'Callback' && ['state', 'code'].some(Name => Array.isArray(Query[Name]))) Query.state = '';
                const ResponseHeaders = new Headers(); let Status = 200; let Result = null;
                const Res = {
                    setHeader(Name, Value) { ResponseHeaders.set(Name, Value); },
                    status(Value) { Status = Value; return this; },
                    json(Value) { ResponseHeaders.set('Content-Type', 'application/json'); Result = JSON.stringify(Value); },
                    end() {},
                };
                // Bind the environment to this request. Never copy secrets into global process.env.
                const Handler = CreateTikTokHandler(Kind, () => RuntimeFactory(Env, FetchTikTok));
                await Handler({ method: Request.method, headers: RequestHeaders, query: Query, body: Body }, Res);
                return new Response(Result, { status: Status, headers: ResponseHeaders });
            } catch {
                // Do not log request URLs: callback codes and provider URLs contain credentials.
                return Failure(503);
            }
        },
    };
}

export default CreateTikTokWorker();
