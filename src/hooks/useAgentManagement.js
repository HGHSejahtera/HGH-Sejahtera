import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './useAuth';

export const useAgentSummaries = () => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff', 'Developer'].includes(user.role);

    return useQuery({
        queryKey: ['admin', 'agents', 'summaries'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_agent_summaries');
            if (error) throw error;
            
            return data.sort((a, b) => {
                const idA = a.StaffID || a.AgentID || '';
                const idB = b.StaffID || b.AgentID || '';
                return idA.localeCompare(idB);
            });
        },
        enabled: isAuthorized,
    });
};

export const useAgentDetails = (agentId) => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff', 'Developer'].includes(user.role);

    return useQuery({
        queryKey: ['admin', 'agents', 'details', agentId],
        queryFn: async () => {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
            let query = supabase.from('Users').select('*');
            if (isUUID) {
                query = query.eq('UserID', agentId);
            } else {
                query = query.eq('StaffID', agentId);
            }

            // Fetch user info
            const { data: userData, error: userError } = await query.single();
            if (userError) throw userError;

            const actualAgentId = userData.UserID;

            // Fetch ledger history
            const { data: ledgerData, error: ledgerError } = await supabase
                .from('AgentLedger')
                .select('*')
                .eq('AgentID', actualAgentId)
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

export const useAgentOrderImports = (agentId) => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff', 'Developer'].includes(user.role);

    return useQuery({
        queryKey: ['admin', 'agents', 'imports', agentId],
        queryFn: async () => {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
            let resolvedId = agentId;
            if (!isUUID) {
                const { data: user } = await supabase.from('Users').select('UserID').eq('StaffID', agentId).single();
                if (user) resolvedId = user.UserID;
            }

            const { data, error } = await supabase
                .from('OrderImports')
                .select('*')
                .eq('AgentID', resolvedId)
                .order('CreatedAt', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!agentId && isAuthorized,
    });
};

export const useAgentStatement = (agentId, month, year) => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff', 'Developer'].includes(user.role);

    return useQuery({
        queryKey: ['admin', 'agents', 'statement', agentId, month, year],
        queryFn: async () => {
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

            // 1. Fetch user info
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
            let query = supabase.from('Users').select('*');
            if (isUUID) {
                query = query.eq('UserID', agentId);
            } else {
                query = query.eq('StaffID', agentId);
            }

            const { data: userData, error: userError } = await query.single();
            if (userError) throw userError;

            const actualAgentId = userData.UserID;
            if (userError) throw userError;

            // 2. Fetch all previous ledger entries to calculate Opening Balance
            const { data: previousEntries, error: prevError } = await supabase
                .from('AgentLedger')
                .select('Amount')
                .eq('AgentID', actualAgentId)
                .lt('CreatedAt', startDate);
            if (prevError) throw prevError;
            
            const openingBalance = previousEntries.reduce((sum, entry) => sum + parseFloat(entry.Amount), 0);

            // 3. Fetch current month's ledger entries
            const { data: currentEntries, error: currentError } = await supabase
                .from('AgentLedger')
                .select('*')
                .eq('AgentID', actualAgentId)
                .gte('CreatedAt', startDate)
                .lte('CreatedAt', endDate)
                .order('CreatedAt', { ascending: true });
            if (currentError) throw currentError;

            // Calculate totals
            const totalCharges = currentEntries.filter(e => parseFloat(e.Amount) > 0).reduce((sum, e) => sum + parseFloat(e.Amount), 0);
            const totalPayments = currentEntries.filter(e => parseFloat(e.Amount) < 0).reduce((sum, e) => sum + Math.abs(parseFloat(e.Amount)), 0);
            
            const closingBalance = openingBalance + totalCharges - totalPayments;

            return {
                agent: userData,
                statement: {
                    month,
                    year,
                    openingBalance,
                    totalCharges,
                    totalPayments,
                    closingBalance,
                    transactions: currentEntries
                }
            };
        },
        enabled: !!agentId && isAuthorized && !!month && !!year,
    });
};

export const useAgentMutations = () => {
    const queryClient = useQueryClient();

    const recordPayout = useMutation({
        mutationFn: async ({ agentId, amount, reference }) => {
            const { data, error } = await supabase.rpc('record_agent_payout', {
                p_agent_id: agentId,
                p_amount: amount,
                p_reference: reference || `Payout on ${new Date().toISOString().split('T')[0]}`
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
        recordPayout,
        suspendAgent
    };
};
