import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/Lib/Supabase';
import { TIKTOK_CATEGORIES } from '@/Constants/TikTokCategories';

export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('DistinctCategories')
                .select('CategoryName')
                .order('CategoryName');

            if (error) throw error;
            const dbCategories = data.map(d => d.CategoryName).filter(Boolean);
            const combinedCategories = [...new Set([...dbCategories, ...TIKTOK_CATEGORIES])];
            return combinedCategories.sort((a, b) => a.localeCompare(b));
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
