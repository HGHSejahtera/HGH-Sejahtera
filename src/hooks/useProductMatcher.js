import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAwbStampStore } from '@/hooks/useAwbStampStore';

export function useProductMatcher() {
    const queryClient = useQueryClient();

    const unmatchedItemsQuery = useQuery({
        queryKey: ['unmatched_items'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ImportOrderItems')
                .select(`
                    *,
                    ImportOrders (
                        PlatformOrderID,
                        Platform,
                        AwbUrl,
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
                .or('MatchStatus.eq.Unmatched,ProductID.is.null')
                .order('ItemID', { ascending: true }); // Simple stable order

            if (error) throw error;

            return data.map(item => {
                const parent = item.ImportOrders?.OrderImports;
                let agentName = 'Direct Sale';
                if (parent?.Users) {
                    agentName = parent.Users.Nickname || parent.Users.DisplayName || parent.Users.StaffID;
                } else if (parent?.AccountName) {
                    agentName = parent.AccountName;
                }

                return {
                    ...item,
                    PlatformOrderID: item.ImportOrders?.PlatformOrderID,
                    Platform: item.ImportOrders?.Platform,
                    AwbUrl: item.ImportOrders?.AwbUrl,
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
                    Items: [],
                    Agents: new Set(),
                    FirstItemID: item.ItemID,
                    SampleItem: item
                });
            }

            const entry = map.get(key);
            entry.TotalQuantity += Number(item.Quantity || 1);
            if (item.ImportOrderID) entry.AffectedOrders.add(item.ImportOrderID);
            if (item.ItemID) {
                entry.ItemIDs.push(item.ItemID);
                entry.Items.push(item);
            }
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
            const itemObj = unmatchedItems.find(i => i.ItemID === itemId);
            const affectedOrderId = itemObj?.ImportOrderID;

            const { data, error } = await supabase.rpc('resolve_unmatched_items_batch', {
                p_item_ids: [itemId],
                p_product_id: productId
            });

            if (error) throw error;

            let syncQueueItems = [];
            if (affectedOrderId && productId) {
                const { data: prod } = await supabase.from('Products').select('SellerSKU, Barcode').eq('ProductID', productId).single();
                const targetSku = prod ? (prod.SellerSKU || prod.Barcode || '-') : '-';

                if (targetSku && targetSku !== '-') {
                    const { data: affectedOrders } = await supabase
                        .from('ImportOrders')
                        .select('ImportOrderID, PlatformOrderID, AwbUrl')
                        .eq('ImportOrderID', affectedOrderId)
                        .not('AwbUrl', 'is', null);

                    if (affectedOrders && affectedOrders.length > 0) {
                        syncQueueItems = affectedOrders.map(o => ({
                            orderId: o.ImportOrderID,
                            platformOrderId: o.PlatformOrderID,
                            awbUrl: o.AwbUrl,
                            targetSku: targetSku
                        }));
                    }
                }
            }

            return { rpcResult: data, syncQueueItems };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['unmatched_items'] });
            queryClient.invalidateQueries({ queryKey: ['active_orders'] });
            queryClient.invalidateQueries({ queryKey: ['order_history'] });
            queryClient.invalidateQueries({ queryKey: ['all_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_ledger'] });
            queryClient.invalidateQueries({ queryKey: ['agent_summaries'] });

            if (result?.syncQueueItems?.length > 0) {
                useAwbStampStore.getState().startSyncQueue(result.syncQueueItems);
            }
        }
    });

    const resolveBatchMutation = useMutation({
        mutationFn: async ({ itemIds, productId }) => {
            const affectedOrderIds = Array.from(new Set(
                unmatchedItems
                    .filter(i => itemIds.includes(i.ItemID) && i.ImportOrderID)
                    .map(i => i.ImportOrderID)
            ));

            const { data, error } = await supabase.rpc('resolve_unmatched_items_batch', {
                p_item_ids: itemIds,
                p_product_id: productId
            });

            if (error) throw error;

            let syncQueueItems = [];
            if (affectedOrderIds.length > 0 && productId) {
                const { data: prod } = await supabase.from('Products').select('SellerSKU, Barcode').eq('ProductID', productId).single();
                const targetSku = prod ? (prod.SellerSKU || prod.Barcode || '-') : '-';

                if (targetSku && targetSku !== '-') {
                    const { data: affectedOrders } = await supabase
                        .from('ImportOrders')
                        .select('ImportOrderID, PlatformOrderID, AwbUrl')
                        .in('ImportOrderID', affectedOrderIds)
                        .not('AwbUrl', 'is', null);

                    if (affectedOrders && affectedOrders.length > 0) {
                        syncQueueItems = affectedOrders.map(o => ({
                            orderId: o.ImportOrderID,
                            platformOrderId: o.PlatformOrderID,
                            awbUrl: o.AwbUrl,
                            targetSku: targetSku
                        }));
                    }
                }
            }

            return { rpcResult: data, syncQueueItems };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['unmatched_items'] });
            queryClient.invalidateQueries({ queryKey: ['active_orders'] });
            queryClient.invalidateQueries({ queryKey: ['order_history'] });
            queryClient.invalidateQueries({ queryKey: ['all_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_orders'] });
            queryClient.invalidateQueries({ queryKey: ['agent_ledger'] });
            queryClient.invalidateQueries({ queryKey: ['agent_summaries'] });

            if (result?.syncQueueItems?.length > 0) {
                useAwbStampStore.getState().startSyncQueue(result.syncQueueItems);
            }
        }
    });

    const unresolveItemMutation = useMutation({
        mutationFn: async ({ itemId }) => {
            const { data, error } = await supabase.rpc('unresolve_order_item', {
                p_item_id: itemId
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unmatched_items'] });
            queryClient.invalidateQueries({ queryKey: ['active_orders'] });
            queryClient.invalidateQueries({ queryKey: ['order_history'] });
            queryClient.invalidateQueries({ queryKey: ['all_orders'] });
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
        isResolvingBatch: resolveBatchMutation.isPending,
        unresolveItem: unresolveItemMutation.mutateAsync,
        isUnresolving: unresolveItemMutation.isPending
    };
}
