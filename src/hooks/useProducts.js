import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const syncDistinctOptionCache = (queryClient, queryKey, value) => {
    const normalizedValue = String(value || '').trim();

    if (!normalizedValue) return;

    queryClient.setQueryData(queryKey, (existingOptions) => {
        const options = Array.isArray(existingOptions) ? existingOptions : [];
        const alreadyExists = options.some(option => option.toLowerCase() === normalizedValue.toLowerCase());

        if (alreadyExists) return options;

        return [...options, normalizedValue].sort((firstValue, secondValue) => firstValue.localeCompare(secondValue));
    });
};

const refreshProductRelatedQueries = (queryClient, product) => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'logs'] });
    queryClient.invalidateQueries({ queryKey: ['brands'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });

    if (product) {
        syncDistinctOptionCache(queryClient, ['brands'], product.Brand);
        syncDistinctOptionCache(queryClient, ['categories'], product.Category);
    }
};

export function useProducts() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('Products')
                .select(`
                    *,
                    ProductPricing (
                        RetailRule,
                        WholesaleRule
                    )
                `)
                .order('ProductName');
            
            if (error) throw error;
            return data.map(p => ({
                ...p,
                RetailPrice: p.ProductPricing?.RetailRule || p.Price || 0,
                WholesalePrice: p.ProductPricing?.WholesaleRule || p.Price || 0,
            }));
        }
    });

    const addProduct = useMutation({
        mutationFn: async (newProduct) => {
            const { data, error } = await supabase
                .from('Products')
                .insert([newProduct])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (savedProduct) => {
            refreshProductRelatedQueries(queryClient, savedProduct);
        }
    });

    const updateProduct = useMutation({
        mutationFn: async ({ id, updates }) => {
            const { data, error } = await supabase
                .from('Products')
                .update(updates)
                .eq('ProductID', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (savedProduct) => {
            refreshProductRelatedQueries(queryClient, savedProduct);
        }
    });

    const deleteProduct = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('Products')
                .delete()
                .eq('ProductID', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            refreshProductRelatedQueries(queryClient);
        }
    });

    const bulkArchiveProducts = useMutation({
        mutationFn: async (productIds) => {
            const { error } = await supabase
                .from('Products')
                .update({ IsActive: false })
                .in('ProductID', productIds);
            if (error) throw error;
            return productIds;
        },
        onSuccess: () => {
            refreshProductRelatedQueries(queryClient);
        }
    });

    const bulkDeleteProducts = useMutation({
        mutationFn: async (productIds) => {
            const { error } = await supabase
                .from('Products')
                .delete()
                .in('ProductID', productIds);
            if (error) throw error;
            return productIds;
        },
        onSuccess: () => {
            refreshProductRelatedQueries(queryClient);
        }
    });

    const forcePurgeProducts = useMutation({
        mutationFn: async (products) => {
            const productIds = products.map(p => p.ProductID);

            // 1. Snapshot into AuditLogs
            const auditLogs = products.map(p => ({
                ActionType: 'PRODUCT_DELETED',
                Details: {
                    ProductID: p.ProductID,
                    ProductName: p.ProductName,
                    MasterSKU: p.MasterSKU,
                    Stock: p.Stock,
                    Brand: p.Brand,
                    Category: p.Category,
                    Price: p.Price
                },
                PerformedBy: 'System Admin'
            }));

            const { error: auditError } = await supabase
                .from('AuditLogs')
                .insert(auditLogs);
            if (auditError) console.error('AuditLog Error:', auditError); // Don't throw if audit log fails just in case table isn't ready

            // 2. Cascade Delete: InventoryLogs
            const { error: logsError } = await supabase
                .from('InventoryLogs')
                .delete()
                .in('ProductID', productIds);
            if (logsError) throw logsError;

            // 3. Cascade Delete: ProductPricing
            const { error: pricingError } = await supabase
                .from('ProductPricing')
                .delete()
                .in('ProductID', productIds);
            if (pricingError) throw pricingError;

            // 4. Delete Products
            const { error: productError } = await supabase
                .from('Products')
                .delete()
                .in('ProductID', productIds);
            if (productError) throw productError;

            return productIds;
        },
        onSuccess: () => {
            refreshProductRelatedQueries(queryClient);
        }
    });

    return {
        ...query,
        addProduct,
        updateProduct,
        deleteProduct,
        bulkArchiveProducts,
        bulkDeleteProducts,
        forcePurgeProducts
    };
}
