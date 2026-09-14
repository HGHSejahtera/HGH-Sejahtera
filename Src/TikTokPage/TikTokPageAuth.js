import { create } from 'zustand';
import { supabase } from '../Lib/Supabase.js';

// The isolated page restores the existing same-origin session; login stays on HGH.
export function CreateTikTokPageAuth(Client, Browser) {
    return create((Set, Get) => ({
        user: null, isAuthenticated: false, isLoading: true, isLocked: false,
        ProfileRevision: 0, AuthError: '',
        lockApp: () => { if (Get().user?.hasPin) Set({ isLocked: true }); },
        HandleSession: async Session => {
            const Revision = Get().ProfileRevision + 1;
            const Previous = Get();
            Set({ ProfileRevision: Revision, isAuthenticated: false, isLoading: true, AuthError: '' });
            if (!Session?.user?.id) {
                Set({ user: null, isLoading: false, isLocked: false });
                return;
            }
            try {
                const { data: Profile, error: Failure } = await Client.from('Users')
                    .select('Role, DisplayName, Nickname, IsActive, PINHash').eq('UserID', Session.user.id).maybeSingle();
                if (Revision !== Get().ProfileRevision) return;
                if (Failure || !Profile || Profile.IsActive !== true || !['Founder', 'Manager', 'Developer'].includes(Profile.Role)) throw new Error();
                const HasPIN = typeof Profile.PINHash === 'string' ? !!Profile.PINHash.trim() && !['null', 'false'].includes(Profile.PINHash) : !!Profile.PINHash;
                Set({ user: { id: Session.user.id, role: Profile.Role, name: Profile.Nickname || Profile.DisplayName, hasPin: HasPIN },
                    isAuthenticated: true, isLoading: false,
                    isLocked: HasPIN && (Previous.user?.id !== Session.user.id || Previous.isLocked) });
            } catch {
                if (Revision === Get().ProfileRevision) Set({ user: null, isLoading: false, isLocked: false,
                    AuthError: 'API Connection requires an active Founder, Manager or Developer account. If your account has access, try refreshing.' });
            }
        },
        unlockApp: async PIN => {
            const Initial = Get();
            if (!Initial.isAuthenticated || !Initial.isLocked || !/^\d{4}$/.test(PIN)) return false;
            try {
                const { data: Valid, error: Failure } = await Client.rpc('verify_my_pin', { entered_pin: PIN });
                if (Failure || Valid !== true || Get().ProfileRevision !== Initial.ProfileRevision) return false;
                Set({ isLocked: false });
                return true;
            } catch { return false; }
        },
        initialize: () => {
            if (Get().Initialized) return;
            Set({ Initialized: true });
            const Revision = Get().ProfileRevision;
            Client.auth.onAuthStateChange((_Event, Session) => {
                // Leave Supabase's auth lock before fetching profile data.
                void Promise.resolve().then(() => Get().HandleSession(Session));
            });
            void Client.auth.getSession().then(({ data: Data, error: Failure }) => {
                if (Get().ProfileRevision === Revision) return Get().HandleSession(Failure ? null : Data?.session);
            }).catch(() => { if (Get().ProfileRevision === Revision) void Get().HandleSession(null); });
            Browser.addEventListener('storage', Event => {
                if (Event.key === `HGHPINLock:${Get().user?.id}` && Event.newValue === '1') Get().lockApp();
                if (Event.key === `HGHSignedOut:${Get().user?.id}` && Event.newValue === '1') void Get().HandleSession(null);
            });
        },
    }));
}
export const useAuthStore = CreateTikTokPageAuth(supabase, globalThis);
