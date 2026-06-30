import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Helper function to calculate final prices based on the model
export const calculateFinalPrices = (pricing) => {
    const { RetailRule, WholesaleRule, AgentMarkup } = pricing;
    
    // The system now uses absolute prices instead of dynamic formula rules.
    // The DB columns (RetailRule, WholesaleRule, AgentMarkup) now store the absolute prices directly.
    return {
        RetailPrice: Math.max(0, Number(RetailRule) || 0),
        WholesalePrice: Math.max(0, Number(WholesaleRule) || 0),
        AgentPrice: Math.max(0, Number(AgentMarkup) || 0)
    };
};

export function usePricingMatrix() {
    return useQuery({
        queryKey: ['pricing_matrix'],
        queryFn: async () => {
            // Fetch products and their pricing rules via left join
            const { data, error } = await supabase
                .from('Products')
                .select(`
                    ProductID,
                    ProductName,
                    MasterSKU,
                    Brand,
                    Variation,
                    Size,
                    Price,
                    CostPrice,
                    FakeCostPrice,
                    StockistPrice,
                    ProductPricing (
                        PricingModel,
                        BasePrice,
                        RetailRule,
                        WholesaleRule,
                        AgentMarkup
                    )
                `)
                .eq('IsActive', true)
                .order('ProductName');

            if (error) throw error;

            // Map the data to a flat structure for the UI
            return data.map(product => {
                const pricing = product.ProductPricing || {
                    PricingModel: 'HQ_DISCOUNT',
                    BasePrice: product.Price || 0,
                    RetailRule: 0,
                    WholesaleRule: 0,
                    AgentMarkup: 0
                };
                
                const finalPrices = calculateFinalPrices(pricing);

                return {
                    ProductID: product.ProductID,
                    ProductName: product.ProductName,
                    MasterSKU: product.MasterSKU,
                    Brand: product.Brand,
                    Variation: product.Variation,
                    Size: product.Size,
                    CostPrice: product.CostPrice || 0,
                    FakeCostPrice: product.FakeCostPrice || 0,
                    StockistPrice: product.StockistPrice || 0,
                    CurrentRSP: product.Price, // Current RSP in Products table
                    ...pricing,
                    ...finalPrices
                };
            });
        },
    });
}

export function useBulkUpdatePricing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (updates) => {
            // Updates is an array of pricing objects
            // We need to upsert into ProductPricing table
            
            const recordsToUpsert = updates.map(update => ({
                ProductID: update.ProductID,
                PricingModel: update.PricingModel,
                BasePrice: update.BasePrice,
                RetailRule: update.RetailRule,
                WholesaleRule: update.WholesaleRule,
                AgentMarkup: update.AgentMarkup
            }));

            const { data, error } = await supabase
                .from('ProductPricing')
                .upsert(recordsToUpsert, { onConflict: 'ProductID' });

            if (error) throw error;

            // Update Products table for Price (Retail Price), CostPrice, FakeCostPrice, and StockistPrice
            const productUpdates = updates.map(update => 
                supabase.from('Products').update({
                    Price: update.BasePrice,
                    CostPrice: update.CostPrice,
                    FakeCostPrice: update.FakeCostPrice,
                    StockistPrice: update.StockistPrice
                }).eq('ProductID', update.ProductID)
            );

            await Promise.all(productUpdates);

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing_matrix'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
        },
    });
}
