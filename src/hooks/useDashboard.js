import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useDashboardMetrics(timeframe = 'this_month') {
    return useQuery({
        queryKey: ['dashboard', timeframe],
        queryFn: async () => {
            const now = new Date();
            let startDate = null;

            if (timeframe === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (timeframe === 'this_week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                startDate = new Date(now.getFullYear(), now.getMonth(), diff);
                startDate.setHours(0, 0, 0, 0);
            } else if (timeframe === 'this_month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }

            const dateFilter = startDate ? startDate.toISOString() : null;

            // 1. Total Sales (POSSales)
            let salesQuery = supabase.from('POSSales').select('TotalAmount');
            if (dateFilter) salesQuery = salesQuery.gte('CreatedAt', dateFilter);
            const { data: salesData, error: salesError } = await salesQuery;
            if (salesError) throw salesError;
            const totalSales = salesData?.reduce((sum, sale) => sum + Number(sale.TotalAmount || 0), 0) || 0;

            // 2. Total Orders (ImportedOrders)
            let ordersQuery = supabase.from('ImportedOrders').select('ImportedOrderID', { count: 'exact', head: true });
            if (dateFilter) ordersQuery = ordersQuery.gte('CreatedAt', dateFilter);
            const { count: totalOrders, error: ordersError } = await ordersQuery;
            if (ordersError) throw ordersError;

            // 3. Low Stock Items
            const { count: lowStockItems, error: stockError } = await supabase
                .from('Products')
                .select('ProductID', { count: 'exact', head: true })
                .eq('IsActive', true)
                .lte('Stock', 10);
            if (stockError) throw stockError;

            // 4. Active Agents
            const { count: activeAgents, error: agentsError } = await supabase
                .from('Users')
                .select('UserID', { count: 'exact', head: true })
                .eq('Role', 'Agent')
                .eq('IsActive', true);
            if (agentsError) throw agentsError;

            // 5. Recent Orders
            const { data: recentOrdersData, error: recentOrdersError } = await supabase
                .from('ImportedOrders')
                .select(`
                    ImportedOrderID,
                    PlatformOrderID,
                    OrderAmount,
                    OrderImports ( AgentID, Users!OrderImports_AgentID_fkey ( DisplayName ) ),
                    ImportedOrderItems ( Quantity )
                `)
                .order('CreatedAt', { ascending: false })
                .limit(5);
            if (recentOrdersError) throw recentOrdersError;

            const recentOrders = recentOrdersData?.map(order => {
                const totalItems = order.ImportedOrderItems?.reduce((sum, item) => sum + (item.Quantity || 0), 0) || 0;
                
                // For Agent Orders, the name is in OrderImports.Users.DisplayName
                const agentName = order.OrderImports?.Users?.DisplayName;
                
                return {
                    id: order.PlatformOrderID,
                    customer: agentName || 'Unknown Agent',
                    items: totalItems,
                    total: `RM ${Number(order.OrderAmount || 0).toFixed(2)}`
                };
            }) || [];

            // 6. Inventory Health & Low Stock Alerts
            const { data: productsData, error: productsError } = await supabase
                .from('Products')
                .select('ProductID, Brand, ProductName, Variation, Size, Stock, SellerSKU, Barcode')
                .eq('IsActive', true)
                .order('Stock', { ascending: true })
                .limit(7);
            if (productsError) throw productsError;

            const inventoryAlerts = productsData?.map(p => {
                const fullName = [p.Brand, p.ProductName, p.Variation, p.Size].filter(Boolean).join(' ');
                const stockVal = Number(p.Stock || 0);
                return {
                    id: p.ProductID,
                    sku: p.SellerSKU || p.Barcode || '—',
                    name: fullName || p.ProductName || 'Unnamed Product',
                    stock: stockVal,
                    status: stockVal <= 0 ? 'Out of Stock' : stockVal <= 10 ? 'Critical Low' : 'Adequate'
                };
            }) || [];

            const { count: outOfStockItems } = await supabase
                .from('Products')
                .select('ProductID', { count: 'exact', head: true })
                .eq('IsActive', true)
                .lte('Stock', 0);

            return {
                totalSales,
                totalOrders,
                lowStockItems,
                outOfStockItems: outOfStockItems || 0,
                activeAgents,
                recentOrders,
                inventoryAlerts
            };
        },
        staleTime: 60 * 1000 // 1 min
    });
}
