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

            // Fetch total sales from summaries for consistency
            const { data: summariesData } = await supabase.rpc('get_agent_summaries');
            const agentSummary = (summariesData || []).find(a => a.AgentID === actualAgentId || a.StaffID === agentId);
            const totalSales = agentSummary ? parseFloat(agentSummary.TotalSales || 0) : 0;

            return {
                ...userData,
                ledger: ledgerData,
                totalSales: totalSales
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
                const { data: user, error: userError } = await supabase.from('Users').select('UserID').eq('StaffID', agentId).single();
                if (userError) throw userError;
                if (user) resolvedId = user.UserID;
            }

            const { data, error } = await supabase
                .from('OrderImports')
                .select('*')
                .eq('AgentID', resolvedId)
                .order('ImportedAt', { ascending: false });
                
            console.log("useAgentOrderImports query for", resolvedId, data, error);
            if (error) throw error;
            return data;
        },
        enabled: !!agentId && isAuthorized,
    });
};

export const useAgentRecentOrders = (agentId) => {
    const user = useAuthStore(state => state.user);
    const isAuthorized = user && ['Founder', 'Manager', 'Staff', 'Developer'].includes(user.role);

    return useQuery({
        queryKey: ['admin', 'agents', 'orders', agentId],
        queryFn: async () => {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
            let resolvedId = agentId;
            if (!isUUID) {
                const { data: user, error: userError } = await supabase.from('Users').select('UserID').eq('StaffID', agentId).single();
                if (userError) throw userError;
                if (user) resolvedId = user.UserID;
            }

            const { data, error } = await supabase
                .from('ImportOrders')
                .select(`
                    *,
                    OrderImports!inner (
                        AgentID,
                        Source,
                        Platform,
                        AccountName
                    ),
                    ImportOrderItems (
                        *,
                        Products (
                            CostPrice, Brand, ProductName, Variation, Size, Barcode, AgentPrice
                        )
                    )
                `)
                .eq('OrderImports.AgentID', resolvedId)
                .order('CreatedAt', { ascending: false })
                .limit(5000);
                
            if (error) throw error;
            
            return (data || []).map(order => {
                const parent = order.OrderImports;
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
                    Platform: order.Platform || parent?.Platform || 'TikTok',
                    Source: parent?.Source,
                    AccountName: parent?.AccountName || 'Main Account',
                    DisplayAmount: displayAmount,
                    DisplayProfit: displayProfit,
                    TotalAmount: displayAmount,
                    OrderAmount: displayAmount,
                    OrderProfit: displayProfit,
                    TotalItems: totalItems,
                    ItemCount: totalItems
                };
            });
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
            
            const openingBalance = Number(previousEntries.reduce((sum, entry) => sum + parseFloat(entry.Amount), 0).toFixed(2));

            // 3. Fetch current month's ledger entries
            const { data: currentEntries, error: currentError } = await supabase
                .from('AgentLedger')
                .select('*')
                .eq('AgentID', actualAgentId)
                .gte('CreatedAt', startDate)
                .lte('CreatedAt', endDate)
                .order('CreatedAt', { ascending: true });
            if (currentError) throw currentError;

            // 4. Fetch Total COGS from ImportOrders for the month
            const { data: cogsData, error: cogsError } = await supabase
                .from('ImportOrders')
                .select('OrderAmount, OrderImports!inner(AgentID)')
                .eq('OrderImports.AgentID', actualAgentId)
                .gte('CreatedAt', startDate)
                .lte('CreatedAt', endDate);
            
            if (cogsError) throw cogsError;
            
            const totalCOGS = Number(cogsData.reduce((sum, order) => sum + parseFloat(order.OrderAmount || 0), 0).toFixed(2));
            const totalOrders = cogsData.length;

            // Calculate totals
            const totalCharges = Number(currentEntries.filter(e => parseFloat(e.Amount) > 0).reduce((sum, e) => sum + parseFloat(e.Amount), 0).toFixed(2));
            const totalPayments = Number(currentEntries.filter(e => parseFloat(e.Amount) < 0).reduce((sum, e) => sum + Math.abs(parseFloat(e.Amount)), 0).toFixed(2));
            
            const closingBalance = Number((openingBalance + totalCharges - totalPayments).toFixed(2));

            return {
                agent: userData,
                statement: {
                    month,
                    year,
                    openingBalance,
                    totalCharges,
                    totalPayments,
                    closingBalance,
                    totalCOGS,
                    totalOrders,
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

    const closeMonthlyStatement = useMutation({
        mutationFn: async ({ agentId, month, year, totalPayout, totalCOGS }) => {
            const { data, error } = await supabase.rpc('close_agent_monthly_statement', {
                p_agent_id: agentId,
                p_month: month,
                p_year: year,
                p_total_payout: totalPayout,
                p_total_cogs: totalCOGS !== undefined && totalCOGS !== null && totalCOGS !== '' ? parseFloat(totalCOGS) : null
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'summaries'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'details', variables.agentId] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'agents', 'statement', variables.agentId, variables.month, variables.year] });
        }
    });

    return {
        recordPayout,
        suspendAgent,
        closeMonthlyStatement
    };
};
