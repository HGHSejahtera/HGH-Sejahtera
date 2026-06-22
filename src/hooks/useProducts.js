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
                .select('*')
                .order('ProductName');
            
            if (error) throw error;
            return data;
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

    return {
        ...query,
        addProduct,
        updateProduct,
        deleteProduct
    };
}
