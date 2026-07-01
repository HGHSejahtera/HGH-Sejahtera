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
                    ImportedOrderItems(Quantity, PlatformSKU)
                `)
                .eq('OrderImports.AgentID', agentId)
                .order('CreatedAt', { ascending: false });

            if (error) throw error;

            // Fetch the agent's catalog to determine the Selling Price dynamically
            const { data: catalogData } = await supabase
                .from('AgentTikTokProducts')
                .select('SellerSKU, SellingPrice')
                .eq('AgentID', agentId);
                
            const catalogMap = {};
            if (catalogData) {
                catalogData.forEach(c => {
                    catalogMap[c.SellerSKU] = c.SellingPrice;
                });
            }

            // Map the data for easier consumption in the data table
            return data.map(order => {
                const totalItems = order.ImportedOrderItems?.reduce((sum, item) => sum + item.Quantity, 0) || 0;
                
                let calculatedTotalAmount = 0;
                let hasUnmatchedItems = false;
                
                order.ImportedOrderItems?.forEach(item => {
                    const price = catalogMap[item.PlatformSKU];
                    if (price !== undefined && price !== null) {
                        calculatedTotalAmount += (price * item.Quantity);
                    } else {
                        hasUnmatchedItems = true;
                    }
                });

                return {
                    ID: order.ImportedOrderID,
                    OrderID: order.PlatformOrderID,
                    Date: new Date(order.CreatedAt).toLocaleDateString(),
                    RawDate: order.CreatedAt,
                    TotalItems: totalItems,
                    TotalAmount: hasUnmatchedItems ? 0 : calculatedTotalAmount,
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

            return data.map(entry => {
                let orderId = '-';
                if (entry.Description) {
                    const match = entry.Description.match(/\d{10,}/);
                    if (match) orderId = match[0];
                }
                if (orderId === '-' && entry.ReferenceID && !entry.ReferenceID.includes('-')) {
                    orderId = entry.ReferenceID;
                }
                return {
                    Date: new Date(entry.CreatedAt).toLocaleDateString(),
                    Type: entry.EntryType,
                    OrderID: orderId,
                    Reference: entry.Description || entry.ReferenceID || 'N/A',
                    Amount: entry.Amount,
                    Balance: entry.RunningBalance
                };
            });
        },
        enabled: !!agentId
    });

    // Extract the latest running balance directly
    const currentBalance = agentLedgerQuery.data && agentLedgerQuery.data.length > 0
        ? agentLedgerQuery.data[0].Balance
        : 0.00;

    // Check if agent has synced TikTok products
    const hasSyncedTikTokQuery = useQuery({
        queryKey: ['agent_tiktok_sync_status', agentId],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('AgentTikTokProducts')
                .select('*', { count: 'exact', head: true })
                .eq('AgentID', agentId);
            
            if (error) throw error;
            return count > 0;
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

    const cancelAgentOrderMutation = useMutation({
        mutationFn: async (orderId) => {
            const { data, error } = await supabase.rpc('cancel_agent_order', {
                p_order_id: orderId
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent_orders', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agent_ledger', agentId] });
        }
    });

    const tiktokProductsQuery = useQuery({
        queryKey: ['agent_tiktok_products', agentId],
        queryFn: async () => {
            if (!agentId) return [];
            const { data, error } = await supabase
                .from('AgentTikTokProducts')
                .select('*')
                .eq('AgentID', agentId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!agentId
    });

    const updateTikTokPriceMutation = useMutation({
        mutationFn: async ({ sellerSKU, sellingPrice }) => {
            const { data, error } = await supabase
                .from('AgentTikTokProducts')
                .update({ SellingPrice: sellingPrice })
                .eq('AgentID', agentId)
                .eq('SellerSKU', sellerSKU)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent_tiktok_products', agentId] });
        }
    });

    const deleteTikTokProductMutation = useMutation({
        mutationFn: async (sellerSKU) => {
            const { error } = await supabase
                .from('AgentTikTokProducts')
                .delete()
                .eq('AgentID', agentId)
                .eq('SellerSKU', sellerSKU);
            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agent_tiktok_products', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agent_has_synced_tiktok', agentId] });
        }
    });

    return {
        myOrders: agentOrdersQuery.data || [],
        isLoadingOrders: agentOrdersQuery.isLoading,
        myLedger: agentLedgerQuery.data || [],
        isLoadingLedger: agentLedgerQuery.isLoading,
        currentBalance: currentBalance,
        uploadOrders: uploadAgentOrdersMutation.mutateAsync,
        cancelOrder: cancelAgentOrderMutation.mutateAsync,
        hasSyncedTikTok: hasSyncedTikTokQuery.data ?? false,
        isLoadingSyncStatus: hasSyncedTikTokQuery.isLoading,
        isUploading: uploadAgentOrdersMutation.isPending,
        tiktokProducts: tiktokProductsQuery.data || [],
        isLoadingTikTokProducts: tiktokProductsQuery.isLoading,
        updateTikTokPrice: updateTikTokPriceMutation.mutateAsync,
        isUpdatingPrice: updateTikTokPriceMutation.isPending,
        deleteTikTokProduct: deleteTikTokProductMutation.mutateAsync,
        isDeletingProduct: deleteTikTokProductMutation.isPending
    };
}
