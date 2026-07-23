import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useInventoryProducts() {
    return useQuery({
        queryKey: ['inventory', 'products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('Products')
                .select('*')
                .eq('IsActive', true)
                .order('CreatedAt', { ascending: false });

            if (error) throw error;
            return data;
        },
    });
}

export function useInventoryLogs(ProductID = null) {
    return useQuery({
        queryKey: ['inventory', 'logs', ProductID],
        queryFn: async () => {
            let query = supabase
                .from('InventoryLogs')
                .select(`
                    *,
                    Products (
                        ProductName,
                        MasterSKU,
                        Variation,
                        Barcode,
                        SellerSKU
                    )
                `)
                .order('Timestamp', { ascending: false })
                .limit(100);

            if (ProductID) {
                query = query.eq('ProductID', ProductID);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data;
        },
        enabled: ProductID !== undefined,
    });
}

export function useStockInMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ProductID, Quantity, Reference }) => {
            const { data, error } = await supabase.rpc('stock_in_product', {
                product_id_input: ProductID,
                quantity_input: Quantity,
                reference_input: Reference || null,
            });

            if (error) throw error;
            return data;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'logs'] });

            if (variables?.ProductID) {
                queryClient.invalidateQueries({ queryKey: ['inventory', 'logs', variables.ProductID] });
            }
        },
    });
}
