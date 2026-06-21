import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('DistinctCategories')
                .select('CategoryName')
                .order('CategoryName');

            if (error) throw error;
            return data.map(d => d.CategoryName);
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
