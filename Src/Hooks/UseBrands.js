import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/Lib/Supabase';

export function useBrands() {
    return useQuery({
        queryKey: ['brands'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('DistinctBrands')
                .select('BrandName')
                .order('BrandName');

            if (error) throw error;
            return data.map(d => d.BrandName);
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes to avoid redundant lookups
    });
}
