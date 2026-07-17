import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from './useAuth';

export const usePOS = () => {
    const user = useAuthStore(state => state.user);

    const completeSale = useMutation({
        mutationFn: async (saleData) => {
            const { isTestMode, ...actualSaleData } = saleData;

            if (isTestMode) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const mockReceiptNo = `HGH-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 900000))}`;
                return {
                    success: true,
                    sale_id: `TEST-${Date.now()}`,
                    ReceiptNumber: mockReceiptNo,
                    message: "Test sale completed successfully"
                };
            }

            if (!user) throw new Error('Not authenticated');

            const payload = {
                user_id: user.id,
                ...actualSaleData
            };

            // Call the RPC function
            const { data, error } = await supabase.rpc('process_pos_sale', {
                sale_data: payload
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            return data;
        },
    });

    return {
        completeSale,
        isProcessing: completeSale.isPending,
        processError: completeSale.error
    };
};
