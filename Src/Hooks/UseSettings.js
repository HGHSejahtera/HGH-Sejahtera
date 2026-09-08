import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/Lib/Supabase';

export function useSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('Settings')
                .select('Key, Value');

            if (error) throw error;

            // Convert array of {Key, Value} to a single object { [Key]: Value }
            const settingsObj = {};
            data.forEach(item => {
                settingsObj[item.Key] = item.Value;
            });
            
            return settingsObj;
        },
    });
}

export function useUpdateSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newSettings) => {
            // newSettings is an object { [Key]: Value }
            // Convert to array of {Key, Value} for bulk upsert
            const recordsToUpsert = Object.entries(newSettings).map(([key, value]) => ({
                Key: key,
                Value: String(value) // ensure it's a string as DB column is TEXT
            }));

            const { data, error } = await supabase
                .from('Settings')
                .upsert(recordsToUpsert, { onConflict: 'Key' });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
}
