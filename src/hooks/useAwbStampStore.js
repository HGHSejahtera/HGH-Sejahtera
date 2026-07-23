import { create } from 'zustand';

export const useAwbStampStore = create((set) => ({
    isOpen: false,
    isMinimized: false,
    status: 'idle', // 'idle' | 'processing' | 'completed' | 'error'
    syncTimestamp: null,
    progress: { current: 0, total: 0, stamped: 0, matched: 0, mismatched: 0, failed: 0, statusText: '' },
    queue: [], // Array of { orderId, awbUrl, platformOrderId, targetSku, status: 'pending'|'processing'|'stamped'|'match'|'mismatch'|'error', existingSku?: string, message?: string }
    
    setOpen: (isOpen) => set({ isOpen }),
    setMinimized: (isMinimized) => set({ isMinimized }),

    resetStore: () => set({
        isOpen: false,
        isMinimized: false,
        status: 'idle',
        progress: { current: 0, total: 0, stamped: 0, matched: 0, mismatched: 0, failed: 0, statusText: '' },
        queue: [],
    }),

    startSyncQueue: async (items) => {
        if (!items || items.length === 0) return;

        // Deduplicate and format items for queue
        const formattedQueue = items.map(item => ({
            orderId: item.orderId || item.ImportOrderID || item.OrderID || '',
            platformOrderId: item.platformOrderId || item.PlatformOrderID || item.AWBNumber || '-',
            awbUrl: item.awbUrl || item.AwbUrl || '',
            targetSku: item.targetSku || item.PlatformSKU || item.SellerSKU || item.Barcode || '-',
            status: 'pending',
            existingSku: '',
            message: ''
        })).filter(item => item.awbUrl && item.targetSku && item.targetSku !== '-');

        if (formattedQueue.length === 0) return;

        set({
            isOpen: true,
            isMinimized: false,
            status: 'processing',
            queue: formattedQueue,
            progress: {
                current: 0,
                total: formattedQueue.length,
                stamped: 0,
                matched: 0,
                mismatched: 0,
                failed: 0,
                statusText: `Ready to sync ${formattedQueue.length} ${formattedQueue.length === 1 ? 'AWB' : 'AWBs'} to R2...`
            }
        });

        const queueState = [...formattedQueue];
        let stampedCount = 0;
        let matchedCount = 0;
        let mismatchedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < queueState.length; i++) {
            const currentItem = queueState[i];
            queueState[i].status = 'processing';
            
            set({
                queue: [...queueState],
                progress: {
                    current: i,
                    total: queueState.length,
                    stamped: stampedCount,
                    matched: matchedCount,
                    mismatched: mismatchedCount,
                    failed: failedCount,
                    statusText: `Syncing order ${currentItem.platformOrderId}... (${i + 1}/${queueState.length})`
                }
            });

            try {
                const response = await fetch('/api/stamp-awb', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        awbUrl: currentItem.awbUrl,
                        targetSku: currentItem.targetSku,
                        orderId: currentItem.orderId,
                        platformOrderId: currentItem.platformOrderId
                    })
                });

                let data = {};
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    if (response.status === 404) {
                        throw new Error('API /api/stamp-awb returned 404 Not Found. Please deploy to Vercel first.');
                    }
                    throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
                }

                if (!response.ok || !data.success) {
                    if (data.status === 'mismatch') {
                        mismatchedCount++;
                        queueState[i].status = 'mismatch';
                        queueState[i].existingSku = data.existingSku || 'Unknown';
                        queueState[i].message = data.message || `Existing SKU "${data.existingSku}" differs from target "${currentItem.targetSku}".`;
                    } else {
                        failedCount++;
                        queueState[i].status = 'error';
                        queueState[i].message = data.error || data.message || 'Failed to sync AWB';
                    }
                } else if (data.status === 'stamped') {
                    stampedCount++;
                    queueState[i].status = 'stamped';
                    queueState[i].message = 'Successfully stamped Seller SKU onto AWB in R2.';
                } else if (data.status === 'match') {
                    matchedCount++;
                    queueState[i].status = 'match';
                    queueState[i].message = 'AWB already contains the correct Seller SKU.';
                } else {
                    stampedCount++;
                    queueState[i].status = 'stamped';
                    queueState[i].message = 'Done';
                }
            } catch (err) {
                failedCount++;
                queueState[i].status = 'error';
                queueState[i].message = err.message || 'Network error while syncing AWB';
            }

            set({
                queue: [...queueState],
                progress: {
                    current: i + 1,
                    total: queueState.length,
                    stamped: stampedCount,
                    matched: matchedCount,
                    mismatched: mismatchedCount,
                    failed: failedCount,
                    statusText: `Completed ${i + 1} of ${queueState.length} orders.`
                }
            });
        }

        set({
            status: 'completed',
            syncTimestamp: Date.now(),
            progress: {
                current: queueState.length,
                total: queueState.length,
                stamped: stampedCount,
                matched: matchedCount,
                mismatched: mismatchedCount,
                failed: failedCount,
                statusText: queueState.length <= 1 ? 'Sync complete.' : 'Batch sync complete.'
            }
        });
    }
}));
