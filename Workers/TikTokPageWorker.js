import TikTokWorker from './TikTokWorker.js';

const Origin = 'https://www.hghsejahtera.my';
export function CreateTikTokPageWorker(APIWorker = TikTokWorker) {
    return { async fetch(RequestValue, Env, Context) {
        const URLValue = new URL(RequestValue.url);
        if (URLValue.origin !== Origin) return new Response(null, { status: 403 });
        if (URLValue.pathname.startsWith('/api/')) return APIWorker.fetch(RequestValue, Env, Context);
        const Page = URLValue.pathname === '/Settings/APIConnection';
        const Asset = /^\/TikTokAssets\/[A-Za-z0-9_-]+\.(?:js|css|woff2?)$/.test(URLValue.pathname);
        if (!Page && !Asset) return new Response(null, { status: 404 });
        if (!['GET', 'HEAD'].includes(RequestValue.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
        try {
            const Target = new URL(Page ? '/index.html' : URLValue.pathname, Origin);
            const Result = await Env.Assets.fetch(new Request(Target, { method: RequestValue.method }));
            const HeadersValue = new Headers(Result.headers);
            HeadersValue.set('Cache-Control', Page || Result.status !== 200 ? 'no-store' : 'public, max-age=31536000, immutable');
            HeadersValue.set('X-Content-Type-Options', 'nosniff');
            HeadersValue.set('Referrer-Policy', 'no-referrer');
            HeadersValue.set('X-Frame-Options', 'DENY');
            if (Page) {
                HeadersValue.set('CDN-Cache-Control', 'no-store');
                HeadersValue.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://sfsukzdxtykevgzbpxna.supabase.co; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
            }
            return new Response(Result.body, { status: Result.status, headers: HeadersValue });
        } catch {
            return new Response('API Connection page unavailable. Please try again.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
    } };
}
export default CreateTikTokPageWorker();
