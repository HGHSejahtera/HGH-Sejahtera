import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './useAuth';

export const useAgentSummaries = () => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff'].includes(user.Role);

    return useQuery({
        queryKey: ['admin', 'agents', 'summaries'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_agent_summaries');
            if (error) throw error;
            return data;
        },
        enabled: isAuthorized,
    });
};

export const useAgentDetails = (agentId) => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff'].includes(user.Role);

    return useQuery({
        queryKey: ['admin', 'agents', 'details', agentId],
        queryFn: async () => {
            // Fetch user info
            const { data: userData, error: userError } = await supabase
                .from('Users')
                .select('*')
                .eq('UserID', agentId)
                .single();
            if (userError) throw userError;

            // Fetch ledger history
            const { data: ledgerData, error: ledgerError } = await supabase
                .from('AgentLedger')
                .select('*')
                .eq('AgentID', agentId)
                .order('CreatedAt', { ascending: false });
            if (ledgerError) throw ledgerError;

            return {
                ...userData,
                ledger: ledgerData
            };
        },
        enabled: !!agentId && isAuthorized,
    });
};

export const useAgentMutations = () => {
    const queryClient = useQueryClient();

    const updateCreditLimit = useMutation({
        mutationFn: async ({ agentId, newLimit }) => {
            const { data, error } = await supabase.rpc('update_agent_credit_limit', {
                p_agent_id: agentId,
                p_new_limit: newLimit
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'summaries'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'details', variables.agentId] });
        }
    });

    const addManualPayment = useMutation({
        mutationFn: async ({ agentId, amount, reference }) => {
            const { data, error } = await supabase.rpc('add_agent_manual_payment', {
                p_agent_id: agentId,
                p_amount: amount,
                p_reference: reference || `Manual payment on ${new Date().toISOString().split('T')[0]}`
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'summaries'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'details', variables.agentId] });
        }
    });

    const suspendAgent = useMutation({
        mutationFn: async ({ agentId, isActive }) => {
            const { data, error } = await supabase
                .from('Users')
                .update({ IsActive: isActive })
                .eq('UserID', agentId)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'summaries'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'details', variables.agentId] });
        }
    });

    return {
        updateCreditLimit,
        addManualPayment,
        suspendAgent
    };
};
