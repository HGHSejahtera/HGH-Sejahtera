import { supabase } from './Supabase.js';
import { useAuthStore } from '../Hooks/UseAuth.js';

const Paths = new Set(['/api/TikTokConnect', '/api/TikTokConnection']);
export async function FetchTikTokConnection(Path, Body, Signal) {
    if (!Paths.has(Path)) throw new Error('Invalid connection request.');
    const Initial = useAuthStore.getState();
    const Valid = () => {
        const Current = useAuthStore.getState();
        return !Signal?.aborted && Current.isAuthenticated && !Current.isLocked && !Current.LogoutPending &&
            Current.user?.id === Initial.user?.id && Current.ProfileRevision === Initial.ProfileRevision;
    };
    if (!Valid()) throw new Error('Please unlock or sign in again.');
    const { data: Data, error: Failure } = await supabase.auth.getSession();
    if (Failure || !Data?.session?.access_token || Data.session.user?.id !== Initial.user?.id || !Valid()) throw new Error('Please sign in again.');
    const Response = await fetch(Path, { method: Body === undefined ? 'GET' : 'POST', signal: Signal,
        redirect: 'error', cache: 'no-store', credentials: 'same-origin', headers: {
            Authorization: `Bearer ${Data.session.access_token}`, 'Content-Type': 'application/json',
        }, ...(Body === undefined ? {} : { body: JSON.stringify(Body) }) });
    const Result = await Response.json().catch(() => null);
    if (!Valid()) throw new Error('The session changed.');
    if (!Response.ok || !Result) throw new Error(Result?.Error || 'TikTok connection is not available yet.');
    return Result;
}

export function ValidateTikTokDestination(Value) {
    const Target = new URL(Value);
    if (Target.origin !== 'https://services.tiktokshop.com' || Target.pathname !== '/open/authorize' ||
        Target.username || Target.password || Target.hash || !/^\d{1,30}$/.test(Target.searchParams.get('service_id') || '') ||
        !/^[a-f0-9]{64}$/.test(Target.searchParams.get('state') || '') ||
        [...Target.searchParams.keys()].some(Key => !['service_id', 'state'].includes(Key))) throw new Error('Invalid TikTok destination.');
    return Target.href;
}
