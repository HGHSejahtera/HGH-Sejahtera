import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useOrders() {
    const queryClient = useQueryClient();

    // Fetch all active orders (Pending, Picking, Packed) for the Pick & Pack Queue
    const activeOrdersQuery = useQuery({
        queryKey: ['active_orders'],
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
                    ImportedOrderItems (
                        ItemID,
                        ProductName,
                        Quantity,
                        MatchStatus
                    )
                `)
                .in('OrderStatus', ['Pending', 'Picking', 'Packed'])
                .order('CreatedAt', { ascending: true });

            if (error) throw error;
            return data;
        },
        refetchInterval: 30000 // auto-refresh every 30s for warehouse monitors
    });

    // Fetch a single order with full item details (used in PackOrder.jsx)
    // Removed from here to be its own hook.

    // Pack Order RPC Mutation
    const packOrderMutation = useMutation({
        mutationFn: async (orderId) => {
            const { data, error } = await supabase.rpc('process_pack_order', {
                p_order_id: orderId
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active_orders'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] }); // refresh stock
        }
    });

    return {
        activeOrders: activeOrdersQuery.data || [],
        isLoadingActive: activeOrdersQuery.isLoading,
        errorActive: activeOrdersQuery.error,
        packOrder: packOrderMutation.mutateAsync,
        isPacking: packOrderMutation.isPending
    };
}

// Fetch a single order with full item details (used in PackOrder.jsx)
export function useOrderDetails(orderId) {
    return useQuery({
        queryKey: ['order', orderId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ImportedOrders')
                .select(`
                    *,
                    ImportedOrderItems (
                        *,
                        Products (
                            Barcode,
                            MasterSKU,
                            Brand
                        )
                    )
                `)
                .eq('ImportedOrderID', orderId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!orderId
    });
}
