import { supabase as Supabase } from './Supabase.js';
import { useAuthStore } from '../Hooks/UseAuth.js';

// Enable only after the endpoint, database restrictions and provider settings pass rollout verification.
export const AccountChangesReady = false;
export const PINChangesReady = true;
export function IsAccountChangeReady(Action) {
    return ['SetPIN', 'DisablePIN'].includes(Action) ? PINChangesReady : AccountChangesReady;
}

export async function ChangeAccount(Action, Value, CurrentPassword, Signal) {
    if (!IsAccountChangeReady(Action)) throw new Error('SetupRequired');
    const Initial = useAuthStore.getState();
    const Valid = () => {
        const Current = useAuthStore.getState();
        return !Signal.aborted && Current.isAuthenticated && !Current.isLocked && !Current.LogoutPending && Current.user?.id === Initial.user?.id;
    };
    if (!Valid()) throw new Error('SignIn');
    const { data: Data, error: Failure } = await Supabase.auth.getSession();
    if (Failure || Data?.session?.user?.id !== Initial.user?.id || !Valid()) throw new Error('SignIn');
    let Response;
    try {
        Response = await fetch('/api/AccountChange', { method: 'POST', signal: Signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Data.session.access_token}` },
            body: JSON.stringify({ Action, Value, CurrentPassword }) });
    } catch { throw new Error('Unavailable'); }
    const Result = await Response.json().catch(() => null);
    if (!Valid()) throw new Error('SignIn');
    if (!Response.ok || !Result?.Status) throw new Error(Result?.Error || 'Unavailable');
    return Result;
}
