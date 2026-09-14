import { SignRequest, ValidateTokens } from './TikTokCredentials.js';

export class TikTokError extends Error {
    constructor(Kind, Status = 502, ProviderCode = null) {
        super(Kind); this.Kind = Kind; this.Status = Status; this.ProviderCode = ProviderCode;
    }
}

export function CreateTikTokClient(Config, Fetch = globalThis.fetch, Now = () => Math.floor(Date.now() / 1000)) {
    async function Send(URLValue, Options) {
        try {
            const Response = await Fetch(URLValue, { ...Options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (Response.status === 429) throw new TikTokError('RateLimited', 429);
            if (!Response.ok) throw new TikTokError('ProviderUnavailable');
            // Limit streamed responses, including when Content-Length is absent.
            const Reader = Response.body.getReader();
            const Decoder = new TextDecoder();
            let Text = ''; let Size = 0;
            try {
                for (;;) {
                    const Chunk = await Reader.read();
                    if (Chunk.done) break;
                    Size += Chunk.value.byteLength;
                    if (Size > 2 * 1024 * 1024) throw new TikTokError('ResponseTooLarge');
                    Text += Decoder.decode(Chunk.value, { stream: true });
                }
                Text += Decoder.decode();
            } finally { await Reader.cancel().catch(() => {}); }
            const Payload = JSON.parse(Text);
            if (Payload.code !== 0) {
                const Code = Number.isSafeInteger(Payload.code) ? Payload.code : null;
                throw new TikTokError(Code === 105005 ? 'ScopeRequired' : [105001, 105002].includes(Code) ? 'ReconnectRequired' : 'ProviderRejected', 502, Code);
            }
            if (!Payload.data || typeof Payload.data !== 'object') throw new TikTokError('InvalidResponse');
            return Payload.data;
        } catch (ErrorValue) {
            // Never propagate a fetch error containing the credential-bearing URL.
            if (ErrorValue instanceof TikTokError) throw ErrorValue;
            throw new TikTokError('ProviderUnavailable');
        }
    }
    async function Token(Kind, Value, SellerID) {
        const URLValue = new URL('https://auth.tiktok-shops.com/api/v2/token/' + (Kind === 'Exchange' ? 'get' : 'refresh'));
        URLValue.search = new URLSearchParams({ app_key: Config.AppKey, app_secret: Config.AppSecret,
            grant_type: Kind === 'Exchange' ? 'authorized_code' : 'refresh_token',
            [Kind === 'Exchange' ? 'auth_code' : 'refresh_token']: Value }).toString();
        return ValidateTokens(await Send(URLValue, { method: 'GET' }), Now(), SellerID);
    }
    async function Request(Path, AccessToken, Query = {}, Body) {
        // Paths are chosen by server-owned readers, never supplied by the browser.
        if (!/^\/(authorization|order|product|return_refund|finance)\/\d{6}\/[A-Za-z0-9_/-]+$/.test(Path)) throw new TikTokError('InvalidEndpoint', 400);
        const BodyText = Body === undefined ? '' : JSON.stringify(Body);
        const Parameters = { ...Query, app_key: Config.AppKey, timestamp: String(Now()) };
        const Signature = SignRequest(Path, Parameters, BodyText, Config.AppSecret);
        const URLValue = new URL('https://open-api.tiktokglobalshop.com' + Path);
        URLValue.search = new URLSearchParams({ ...Parameters, sign: Signature }).toString();
        return Send(URLValue, { method: Body === undefined ? 'GET' : 'POST', headers: {
            'Content-Type': 'application/json', 'x-tts-access-token': AccessToken,
        }, ...(Body === undefined ? {} : { body: BodyText }) });
    }
    return { Exchange: Code => Token('Exchange', Code), Refresh: (Value, SellerID) => Token('Refresh', Value, SellerID),
        Shops: AccessToken => Request('/authorization/202309/shops', AccessToken), Request };
}
