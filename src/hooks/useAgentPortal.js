import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';

export function useAgentPortal() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const agentId = user?.id;

    // Fetch orders submitted by this specific agent
    const agentOrdersQuery = useQuery({
        queryKey: ['agent_orders', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ImportedOrders')
                .select(`
                    ImportedOrderID,
                    PlatformOrderID,
                    Platform,
                    OrderStatus,
                    TrackingID,
                    OrderAmount,
                    CreatedAt,
                    OrderImports!inner(AgentID),
                    ImportedOrderItems(Quantity)
                `)
                .eq('OrderImports.AgentID', agentId)
                .order('CreatedAt', { ascending: false });

            if (error) throw error;

            // Map the data for easier consumption in the data table
            return data.map(order => {
                const totalItems = order.ImportedOrderItems?.reduce((sum, item) => sum + item.Quantity, 0) || 0;
                return {
                    OrderID: order.PlatformOrderID,
                    Date: new Date(order.CreatedAt).toLocaleDateString(),
                    TotalItems: totalItems,
                    TotalAmount: order.OrderAmount || 0,
                    Status: order.OrderStatus
                };
            });
        },
        enabled: !!agentId
    });

    // Fetch the agent's ledger (financial history)
    const agentLedgerQuery = useQuery({
        queryKey: ['agent_ledger', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('AgentLedger')
                .select('*')
                .eq('AgentID', agentId)
                .order('CreatedAt', { ascending: false });

            if (error) throw error;

            return data.map(entry => ({
                Date: new Date(entry.CreatedAt).toLocaleDateString(),
                Type: entry.EntryType,
                Reference: entry.Description || entry.ReferenceID || 'N/A',
                Debit: entry.Amount > 0 ? entry.Amount : 0,
                Credit: entry.Amount < 0 ? Math.abs(entry.Amount) : 0,
                Balance: entry.RunningBalance
            }));
        },
        enabled: !!agentId
    });

    // Extract the latest running balance directly
    const currentBalance = agentLedgerQuery.data && agentLedgerQuery.data.length > 0
        ? agentLedgerQuery.data[0].Balance
        : 0.00;

    // Mutation to process AWB bulk uploads via RPC
    const uploadAgentOrdersMutation = useMutation({
        mutationFn: async (payload) => {
            const { data, error } = await supabase.rpc('process_agent_order_upload', {
                payload: payload
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent_orders', agentId] });
        }
    });

    return {
        myOrders: agentOrdersQuery.data || [],
        isLoadingOrders: agentOrdersQuery.isLoading,
        myLedger: agentLedgerQuery.data || [],
        isLoadingLedger: agentLedgerQuery.isLoading,
        currentBalance: currentBalance,
        uploadOrders: uploadAgentOrdersMutation.mutateAsync,
        isUploading: uploadAgentOrdersMutation.isPending
    };
}
