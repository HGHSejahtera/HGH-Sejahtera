import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useOrderHistory(filters = {}) {
    const queryClient = useQueryClient();

    const orderHistoryQuery = useQuery({
        queryKey: ['order_history', filters],
        queryFn: async () => {
            let query = supabase
                .from('ImportOrders')
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
                    ImportOrderItems (
                        *,
                        Products (
                            CostPrice, Brand, ProductName, Variation, Size, Barcode, AgentPrice
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
                const isAgentOrder = parent?.Source === 'AgentOrder' || !!parent?.Users;
                const accountType = isAgentOrder ? 'Agent' : 'Stores';
                
                let agentName = 'Direct Sale';
                if (isAgentOrder && parent?.Users) {
                    agentName = parent.Users.Nickname || parent.Users.DisplayName;
                } else if (!isAgentOrder && parent?.AccountName) {
                    agentName = parent.AccountName;
                }

                // Calculate Order Total using snapshot
                const mappedItems = order.ImportOrderItems?.map(item => {
                    const unitPrice = Number(item.UnitPrice || 0);
                    const subtotal = Number(item.Subtotal || 0);
                    const profit = Number(item.Profit || 0);
                    
                    return {
                        ...item,
                        UnitPrice: unitPrice,
                        Subtotal: subtotal,
                        Profit: profit
                    };
                }) || [];

                const displayAmount = Number(order.OrderAmount) || mappedItems.reduce((sum, item) => sum + item.Subtotal, 0);
                const displayProfit = Number(order.OrderProfit) || mappedItems.reduce((sum, item) => sum + item.Profit, 0);
                const totalItems = mappedItems.reduce((sum, item) => sum + Number(item.Quantity || 1), 0);

                return {
                    ...order,
                    ImportOrderItems: mappedItems,
                    Items: mappedItems,
                    Platform: order.Platform,
                    Source: parent?.Source,
                    AccountType: accountType,
                    AccountName: isAgentOrder ? null : (parent?.AccountName || 'Stores'),
                    AgentName: agentName,
                    DisplayAmount: displayAmount,
                    DisplayProfit: displayProfit,
                    TotalAmount: displayAmount,
                    OrderAmount: displayAmount,
                    OrderProfit: displayProfit,
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

