import { useMemo } from 'react';
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
                `)
                .or('MatchStatus.eq.Unmatched,ProductID.is.null')
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

    const unmatchedItems = useMemo(() => unmatchedItemsQuery.data || [], [unmatchedItemsQuery.data]);

    // Group unmatched items by PlatformSKU + ProductName for deduplication
    const uniqueUnmatched = useMemo(() => {
        const map = new Map();
        unmatchedItems.forEach(item => {
            const sku = item.PlatformSKU && item.PlatformSKU !== '-' ? item.PlatformSKU : '';
            const name = item.ProductName || 'Unknown Item';
            const key = `${sku}_${name.trim()}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    PlatformSKU: sku || '-',
                    ProductName: name.trim(),
                    TotalQuantity: 0,
                    AffectedOrders: new Set(),
                    ItemIDs: [],
                    Agents: new Set(),
                    FirstItemID: item.ItemID,
                    SampleItem: item
                });
            }

            const entry = map.get(key);
            entry.TotalQuantity += Number(item.Quantity || 1);
            if (item.ImportedOrderID) entry.AffectedOrders.add(item.ImportedOrderID);
            if (item.ItemID) entry.ItemIDs.push(item.ItemID);
            if (item.AgentName) entry.Agents.add(item.AgentName);
        });

        return Array.from(map.values()).map(entry => ({
            ...entry,
            AffectedOrdersCount: entry.AffectedOrders.size,
            AgentNames: Array.from(entry.Agents).join(', ')
        }));
    }, [unmatchedItems]);

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

    const resolveBatchMutation = useMutation({
        mutationFn: async ({ itemIds, productId }) => {
            const { data, error } = await supabase.rpc('resolve_unmatched_items_batch', {
                p_item_ids: itemIds,
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
        unmatchedItems,
        uniqueUnmatched,
        isLoading: unmatchedItemsQuery.isLoading,
        error: unmatchedItemsQuery.error,
        resolveItem: resolveItemMutation.mutateAsync,
        isResolving: resolveItemMutation.isPending,
        resolveBatch: resolveBatchMutation.mutateAsync,
        isResolvingBatch: resolveBatchMutation.isPending
    };
}
