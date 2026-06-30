import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useAuditLogs() {
    return useQuery({
        queryKey: ['audit_logs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('AuditLogs')
                .select('*')
                .order('Timestamp', { ascending: false });
            
            if (error) throw error;
            return data;
        }
    });
}

export function useArchivedProducts() {
    return useQuery({
        queryKey: ['products', 'archived'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('Products')
                .select('*, ProductPricing(*)')
                .eq('IsActive', false)
                .order('UpdatedAt', { ascending: false });
            
            if (error) throw error;
            return data;
        }
    });
}

export function useSalesReports() {
    return useQuery({
        queryKey: ['pos_sales'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('POSSales')
                .select('*')
                .order('CreatedAt', { ascending: false });
            
            if (error) throw error;
            return data;
        }
    });
}
