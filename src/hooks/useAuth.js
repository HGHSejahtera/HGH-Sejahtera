import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export const useAuthStore = create((set, get) => ({
    user: null, 
    isAuthenticated: false,
    isLoading: true,

    initialize: () => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            get().handleSession(session);
        });

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
            get().handleSession(session);
        });
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

        // Block Pending, Rejected, or Inactive users
        if (!profile || profile.Role === 'Pending' || profile.Role === 'Rejected' || profile.IsActive === false) {
            await supabase.auth.signOut();
            set({ user: null, isAuthenticated: false, isLoading: false });
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
