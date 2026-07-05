import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useOrderHistory(filters = {}) {
    const queryClient = useQueryClient();

    const orderHistoryQuery = useQuery({
        queryKey: ['order_history', filters],
        queryFn: async () => {
            let query = supabase
                .from('ImportedOrders')
                .select(`
                    *,
                    OrderImports (
                        Source,
                        Platform,
                        AccountName,
                        Users!OrderImports_AgentID_fkey (
                            DisplayName,
                            Nickname,
                            StaffID
                        )
                    ),
                    ImportedOrderItems (
                        *,
                        Products (
                            CostPrice, Brand, ProductName, Variation, Size, Barcode,
                            ProductPricing (AgentMarkup)
                        )
                    )
                `)
                .order('CreatedAt', { ascending: false });

            // Apply Filters
            if (filters.startDate && filters.endDate) {
                query = query.gte('CreatedAt', filters.startDate)
                             .lte('CreatedAt', filters.endDate);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map data for easier UI consumption
            return data.map(order => {
                const parent = order.OrderImports;
                let agentName = 'Direct Sale';
                if (parent?.Users) {
                    agentName = parent.Users.Nickname || parent.Users.DisplayName;
                } else if (parent?.AccountName) {
                    agentName = parent.AccountName;
                }

                // Calculate Order Total using AgentMarkup / Selling Price (NOT profit)
                const isAgentOrder = parent?.Source === 'AgentOrder';
                const mappedItems = order.ImportedOrderItems?.map(item => {
                    let unitPrice = Number(item.UnitPrice || 0);
                    if (unitPrice === 0 || isAgentOrder) {
                        if (item.Products?.ProductPricing?.AgentMarkup !== undefined && item.Products?.ProductPricing?.AgentMarkup !== null) {
                            unitPrice = Number(item.Products.ProductPricing.AgentMarkup);
                        }
                    }
                    const subtotal = unitPrice * Number(item.Quantity || 1);
                    return {
                        ...item,
                        UnitPrice: unitPrice,
                        Subtotal: subtotal
                    };
                }) || [];

                const displayAmount = mappedItems.reduce((sum, item) => sum + item.Subtotal, 0);
                const totalItems = mappedItems.reduce((sum, item) => sum + Number(item.Quantity || 1), 0);

                return {
                    ...order,
                    ImportedOrderItems: mappedItems,
                    Items: mappedItems,
                    Platform: order.Platform,
                    Source: parent?.Source,
                    AgentName: agentName,
                    DisplayAmount: displayAmount,
                    TotalAmount: displayAmount,
                    OrderAmount: displayAmount,
                    TotalItems: totalItems,
                    ItemCount: totalItems
                };
            });
        }
    });

    const markAsPrintedMutation = useMutation({
        mutationFn: async ({ orderIds, isPrinted }) => {
            const { data, error } = await supabase.rpc('mark_orders_as_printed', {
                p_order_ids: orderIds,
                p_is_printed: isPrinted
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['order_history'] });
        }
    });

    return {
        orders: orderHistoryQuery.data || [],
        isLoading: orderHistoryQuery.isLoading,
        error: orderHistoryQuery.error,
        MarkAsPrinted: markAsPrintedMutation.mutateAsync,
        IsMarkingPrinted: markAsPrintedMutation.isPending
    };
}

