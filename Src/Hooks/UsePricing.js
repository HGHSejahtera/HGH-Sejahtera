import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/Lib/Supabase';

export function usePricingMatrix() {
    return useQuery({
        queryKey: ['pricing_matrix'],
        queryFn: async () => {
            // Fetch products and their pricing directly from Products table
            const { data, error } = await supabase
                .from('Products')
                .select(`
                    ProductID,
                    ProductName,
                    MasterSKU,
                    Brand,
                    Variation,
                    Size,
                    SellerSKU,
                    Barcode,
                    GTIN,
                    RetailPrice,
                    WholesalePrice,
                    AgentPrice,
                    CostPrice,
                    FakeCostPrice,
                    StockistPrice
                `)
                .eq('IsActive', true)
                .order('ProductName');

            if (error) throw error;

            return data.map(product => ({
                ProductID: product.ProductID,
                ProductName: product.ProductName,
                MasterSKU: product.MasterSKU,
                SellerSKU: product.SellerSKU,
                Barcode: product.Barcode,
                GTIN: product.GTIN,
                Brand: product.Brand,
                Variation: product.Variation,
                Size: product.Size,
                CostPrice: product.CostPrice || 0,
                FakeCostPrice: product.FakeCostPrice || 0,
                StockistPrice: product.StockistPrice || 0,
                RetailPrice: product.RetailPrice || 0,
                WholesalePrice: product.WholesalePrice || 0,
                AgentPrice: product.AgentPrice || 0
            }));
        },
    });
}

export function useBulkUpdatePricing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (updates) => {
            // Updates is an array of pricing objects
            // Update Products table directly for all pricing fields
            const productUpdates = updates.map(update => 
                supabase.from('Products').update({
                    RetailPrice: update.RetailPrice,
                    WholesalePrice: update.WholesalePrice,
                    AgentPrice: update.AgentPrice,
                    CostPrice: update.CostPrice,
                    FakeCostPrice: update.FakeCostPrice,
                    StockistPrice: update.StockistPrice
                }).eq('ProductID', update.ProductID)
            );

            await Promise.all(productUpdates);
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing_matrix'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
        },
    });
}
