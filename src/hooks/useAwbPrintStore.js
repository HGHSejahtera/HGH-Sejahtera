import { create } from 'zustand';
import { MergeAwbsBatch } from '@/services/pdf/AwbMergeService';

export const useAwbPrintStore = create((set, get) => ({
    isOpen: false,
    isMinimized: false,
    status: 'idle', // 'idle' | 'processing' | 'completed' | 'error'
    progress: { current: 0, total: 0, statusText: '' },
    successfulIds: [],
    failedOrders: [],
    errors: [],
    mergedPdfBlobUrl: null,
    markAsPrintedCallback: null,

    setOpen: (isOpen) => set({ isOpen }),
    setMinimized: (isMinimized) => set({ isMinimized }),

    resetStore: () => set({
        isOpen: false,
        isMinimized: false,
        status: 'idle',
        progress: { current: 0, total: 0, statusText: '' },
        successfulIds: [],
        failedOrders: [],
        errors: [],
        mergedPdfBlobUrl: null,
        markAsPrintedCallback: null,
    }),

    startBatchPrint: async (orders, markAsPrintedFn = null) => {
        if (!orders || orders.length === 0) return;

        set({
            isOpen: true,
            isMinimized: false,
            status: 'processing',
            progress: { current: 0, total: orders.length, statusText: 'Initializing PDF merger...' },
            successfulIds: [],
            failedOrders: [],
            errors: [],
            mergedPdfBlobUrl: null,
            markAsPrintedCallback: markAsPrintedFn || get().markAsPrintedCallback
        });

        try {
            const result = await MergeAwbsBatch(orders, (prog) => {
                set({
                    progress: {
                        current: prog.current,
                        total: prog.total,
                        statusText: prog.status
                    },
                    errors: prog.errors || [],
                    status: prog.isDone ? (prog.successCount > 0 ? 'completed' : 'error') : 'processing'
                });
            });

            set({
                successfulIds: result.successfulIds || [],
                failedOrders: result.failedOrders || [],
                mergedPdfBlobUrl: result.blobUrl || null,
                status: (result.successfulIds && result.successfulIds.length > 0) ? 'completed' : 'error'
            });

            const currentMarkCallback = get().markAsPrintedCallback;
            if (result.successfulIds && result.successfulIds.length > 0 && currentMarkCallback) {
                try {
                    await currentMarkCallback({ orderIds: result.successfulIds, isPrinted: true });
                } catch (err) {
                    console.error('Error updating printed status in DB:', err);
                }
            }
        } catch (error) {
            console.error('Batch AWB Merge Exception:', error);
            set({
                status: 'error',
                progress: {
                    current: orders.length,
                    total: orders.length,
                    statusText: `Failed: ${error.message || 'Fatal error during PDF merge.'}`
                }
            });
        }
    },

    retryFailedOrders: async () => {
        const { failedOrders, markAsPrintedCallback } = get();
        if (!failedOrders || failedOrders.length === 0) return;

        const ordersToRetry = failedOrders.map(f => f.order).filter(Boolean);
        if (ordersToRetry.length === 0) return;

        await get().startBatchPrint(ordersToRetry, markAsPrintedCallback);
    },

    forceMarkPrinted: async (orderIdsToForce) => {
        const { markAsPrintedCallback, failedOrders } = get();
        if (!orderIdsToForce || orderIdsToForce.length === 0 || !markAsPrintedCallback) return;

        try {
            await markAsPrintedCallback({ orderIds: orderIdsToForce, isPrinted: true });
            const remainingFailed = failedOrders.filter(f => !orderIdsToForce.includes(f.importedOrderId));
            set({ failedOrders: remainingFailed });
        } catch (err) {
            console.error('Failed to force mark orders as printed:', err);
            throw err;
        }
    }
}));
