import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'logs'] });
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'logs'] });
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
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory', 'logs'] });
        }
    });

    return {
        ...query,
        addProduct,
        updateProduct,
        deleteProduct
    };
}
