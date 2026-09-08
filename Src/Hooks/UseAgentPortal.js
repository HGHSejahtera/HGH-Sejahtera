import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/Lib/Supabase';
import { useAuthStore } from '@/Hooks/UseAuth';

export function useAgentPortal() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const agentId = user?.id;

    // Fetch orders submitted by this specific agent
    const agentOrdersQuery = useQuery({
        queryKey: ['agent_orders', agentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ImportOrders')
                .select(`
                    ImportOrderID,
                    PlatformOrderID,
                    Platform,
                    TrackingID,
                    AwbUrl,
                    CreatedAt,
                    OrderImports!inner(AgentID),
                    ImportOrderItems(Quantity, PlatformSKU)
                `)
                .eq('OrderImports.AgentID', agentId)
                .order('CreatedAt', { ascending: false });

            if (error) throw error;

            // Map the data for easier consumption in the data table
            return data.map(order => {
                const totalItems = order.ImportOrderItems?.reduce((sum, item) => sum + item.Quantity, 0) || 0;
                
                return {
                    ID: order.ImportOrderID,
                    OrderID: order.PlatformOrderID,
                    Date: new Date(order.CreatedAt).toLocaleDateString(),
                    RawDate: order.CreatedAt,
                    TotalItems: totalItems,
                    AwbUrl: order.AwbUrl
                };
            });
        },
        enabled: !!agentId
    });


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
        refetch: agentOrdersQuery.refetch,
        uploadOrders: uploadAgentOrdersMutation.mutateAsync,
        isUploading: uploadAgentOrdersMutation.isPending
    };
}
