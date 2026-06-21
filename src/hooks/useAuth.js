import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export const useAuthStore = create((set, get) => ({
    user: null, 
    isAuthenticated: false,
    initialize: () => {
        if (get().isInitialized) return;

        // Read from the sessionStorage variables populated by index.html
        const savedSearch = sessionStorage.getItem('hgh_auth_search') || '';
        const savedHash = sessionStorage.getItem('hgh_auth_hash') || '';
        
        // Check if there are valid auth tokens (PKCE or Implicit). We don't include errors here
        // because if it's an error, Supabase won't establish a session and we shouldn't wait infinitely.
        const hasAuthTokens = savedHash.includes('access_token=') || savedSearch.includes('code=');
        const hasError = savedSearch.includes('error=') || savedHash.includes('error=');

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session && hasAuthTokens && !hasError) {
                // Tokens exist and no error. Supabase is exchanging PKCE in the background.
                // Keep isLoading: true, let onAuthStateChange handle it when it finishes.
                return;
            }
            get().handleSession(session);
        });

        // Listen for auth changes (login, logout, token refresh, etc)
        supabase.auth.onAuthStateChange((_event, session) => {
            get().handleSession(session);
        });

        set({ isInitialized: true });
    },

    handleSession: async (session) => {
        if (!session?.user) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        // Fetch custom role and display name from public.Users
        const { data: profile } = await supabase
            .from('Users')
            .select('Role, DisplayName, IsActive')
            .eq('UserID', session.user.id)
            .maybeSingle();

        // Block Rejected or Inactive users
        if (!profile || profile.Role === 'Rejected' || profile.IsActive === false) {
            await supabase.auth.signOut();
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        // Handle Pending users (keep profile info for UI, but stay unauthenticated)
        if (profile.Role === 'Pending') {
            // We intentionally DO NOT call supabase.auth.signOut() here.
            // Keeping the Supabase session active allows them to refresh their status 
            // without logging in again, while isAuthenticated: false keeps them out of the app.
            set({ 
                user: { 
                    id: session.user.id, 
                    name: profile.DisplayName || session.user.email, 
                    role: 'Pending',
                    email: session.user.email
                }, 
                isAuthenticated: false, 
                isLoading: false 
            });
            return;
        }

        set({ 
            user: { 
                id: session.user.id, 
                name: profile.DisplayName || session.user.email, 
                role: profile.Role,
                email: session.user.email
            }, 
            isAuthenticated: true,
            isLoading: false
        });
    },

    login: async (identifier, password) => {
        let loginEmail = identifier;
        
        // If not an email, assume it's Username or StaffID and lookup the email in public.Users
        if (!identifier.includes('@')) {
            const { data, error } = await supabase
                .from('Users')
                .select('Email')
                .or(`Username.ilike.${identifier},StaffID.ilike.${identifier}`)
                .maybeSingle();
                
            if (error || !data) {
                throw new Error('User not found. Check your Username or StaffID.');
            }
            loginEmail = data.Email;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: loginEmail, 
            password 
        });
        
        if (error) throw error;
        return data;
    },

    logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
    },
}));
