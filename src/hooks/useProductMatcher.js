import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useProductMatcher() {
    const queryClient = useQueryClient();

    const unmatchedItemsQuery = useQuery({
        queryKey: ['unmatched_items'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ImportedOrderItems')
                .select(`
                    *,
                    ImportedOrders (
                        PlatformOrderID,
                        Platform,
                        OrderImports (
                            AccountName,
                            Users!OrderImports_AgentID_fkey (
                                Nickname,
                                DisplayName,
                                StaffID
                            )
                        )
                    )
                `)
                .eq('MatchStatus', 'Unmatched')
                .order('ItemID', { ascending: true }); // Simple stable order

            if (error) throw error;

            return data.map(item => {
                const parent = item.ImportedOrders?.OrderImports;
                let agentName = 'Direct Sale';
                if (parent?.Users) {
                    agentName = parent.Users.Nickname || parent.Users.DisplayName || parent.Users.StaffID;
                } else if (parent?.AccountName) {
                    agentName = parent.AccountName;
                }

                return {
                    ...item,
                    PlatformOrderID: item.ImportedOrders?.PlatformOrderID,
                    Platform: item.ImportedOrders?.Platform,
                    AgentName: agentName
                };
            });
        }
    });

    const resolveItemMutation = useMutation({
        mutationFn: async ({ itemId, productId }) => {
            const { data, error } = await supabase.rpc('resolve_unmatched_item', {
                p_item_id: itemId,
                p_product_id: productId
            });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unmatched_items'] });
            queryClient.invalidateQueries({ queryKey: ['active_orders'] });
            queryClient.invalidateQueries({ queryKey: ['order_history'] });
            queryClient.invalidateQueries({ queryKey: ['all_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_ledger'] });
            queryClient.invalidateQueries({ queryKey: ['agent_summaries'] });
        }
    });

    return {
        unmatchedItems: unmatchedItemsQuery.data || [],
        isLoading: unmatchedItemsQuery.isLoading,
        error: unmatchedItemsQuery.error,
        resolveItem: resolveItemMutation.mutateAsync,
        isResolving: resolveItemMutation.isPending
    };
}
