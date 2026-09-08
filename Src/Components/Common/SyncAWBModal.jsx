import { useAwbStampStore } from '@/Hooks/UseAWBStampStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/Components/UI/Dialog';
import { Button } from '@/Components/UI/Button';
import { CheckCircle2, AlertTriangle, RefreshCw, Minimize2, Maximize2, FileText, CheckCheck, XCircle } from 'lucide-react';

export function SyncAwbModal() {
    const {
        isOpen,
        isMinimized,
        status,
        progress,
        queue,
        setOpen,
        setMinimized,
        resetStore
    } = useAwbStampStore();

    if (status === 'idle') return null;

    const totalCount = progress.total || 1;
    const percentage = Math.round((progress.current / totalCount) * 100) || 0;

    // Render Floating Pill Widget when minimized or when closed during processing
    if (isMinimized || (!isOpen && status === 'processing')) {
        return (
            <div 
                onClick={() => {
                    setMinimized(false);
                    setOpen(true);
                }}
                className="fixed bottom-16 right-4 z-50 bg-gray-900 text-white rounded-none px-4 py-2.5 shadow-2xl flex items-center gap-3 border border-indigo-500/40 hover:scale-105 hover:bg-gray-800 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-3"
            >
                {status === 'processing' ? (
                    <span className="flex items-center justify-center w-5 h-5 bg-indigo-600/30 text-indigo-300">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    </span>
                ) : status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}

                <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight">
                        {status === 'processing' ? `Syncing Seller SKU (${percentage}%)` : 'AWB Sync Ready'}
                    </span>
                    <span className="text-[10px] text-gray-300 leading-tight">
                        {status === 'processing' 
                            ? `${progress.current} of ${totalCount} AWBs` 
                            : `${progress.stamped + progress.matched} done${progress.mismatched > 0 ? `, ${progress.mismatched} mismatch` : ''}`}
                    </span>
                </div>

                <Maximize2 className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </div>
        );
    }

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                if (status === 'processing') {
                    setMinimized(true);
                    setOpen(false);
                } else {
                    resetStore();
                }
            } else {
                setOpen(true);
            }
        }}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white rounded-none border border-gray-200 shadow-2xl [&>button]:hidden">
                {/* Header */}
                <div className="bg-gray-900 text-white px-6 py-5 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                            {status === 'processing' ? (
                                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                            ) : status === 'completed' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                            )}
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold tracking-tight text-white">
                                {totalCount <= 1 ? 'AWB SKU Sync' : 'Batch AWB SKU Sync'}
                            </DialogTitle>
                            {status === 'processing' && (
                                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                                    {progress.statusText}
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {status === 'processing' && (
                            <button 
                                onClick={() => {
                                    setMinimized(true);
                                    setOpen(false);
                                }}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors rounded-none"
                                title="Minimize to background"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar & Summary Stats */}
                <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>Progress ({progress.current} / {totalCount})</span>
                        <span className="font-mono text-indigo-600">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2.5 rounded-none overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                        <div className="bg-white p-2 border border-gray-200 text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-medium">Stamped</span>
                            <span className="text-sm font-bold text-emerald-600">{progress.stamped}</span>
                        </div>
                        <div className="bg-white p-2 border border-gray-200 text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-medium">Matched</span>
                            <span className="text-sm font-bold text-blue-600">{progress.matched}</span>
                        </div>
                        <div className="bg-white p-2 border border-gray-200 text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-medium">Mismatch</span>
                            <span className="text-sm font-bold text-amber-600">{progress.mismatched}</span>
                        </div>
                        <div className="bg-white p-2 border border-gray-200 text-center">
                            <span className="text-[10px] text-gray-500 uppercase block font-medium">Failed</span>
                            <span className="text-sm font-bold text-rose-600">{progress.failed}</span>
                        </div>
                    </div>
                </div>

                {/* Mismatch Alert Box (if any discrepancies detected) */}
                {progress.mismatched > 0 && (
                    <div className="mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-300 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 space-y-1">
                            <p className="font-bold">Discrepancy Detected ({progress.mismatched} {progress.mismatched === 1 ? 'AWB' : 'AWBs'})</p>
                            <p className="text-amber-800 leading-relaxed">
                                Some AWB documents already contain a Seller SKU from TikTok that does not match the product mapped in HGH. To prevent corrupting original data, these PDFs were not overwritten. Check details below.
                            </p>
                        </div>
                    </div>
                )}

                {/* Queue List */}
                <div className="p-6 max-h-[380px] overflow-y-auto space-y-3 divide-y divide-gray-100">
                    {queue.map((item, idx) => (
                        <div key={`${item.orderId}-${idx}`} className="pt-3 first:pt-0 flex items-start justify-between gap-6 text-xs">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="mt-0.5 shrink-0">
                                    {item.status === 'processing' ? (
                                        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                                    ) : item.status === 'stamped' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : item.status === 'match' ? (
                                        <CheckCheck className="w-4 h-4 text-blue-600" />
                                    ) : item.status === 'mismatch' ? (
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    ) : item.status === 'error' ? (
                                        <XCircle className="w-4 h-4 text-rose-600" />
                                    ) : (
                                        <FileText className="w-4 h-4 text-gray-400" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-gray-900 font-mono">
                                            #{item.platformOrderId}
                                        </span>
                                        <span className="text-gray-400">•</span>
                                        <span className="font-semibold text-gray-700 break-all">
                                            Target SKU: <span className="font-mono text-indigo-700">{item.targetSku}</span>
                                        </span>
                                    </div>
                                    {item.message && (
                                        <p className={`mt-1 text-[11px] leading-relaxed ${
                                            item.status === 'mismatch' ? 'text-amber-700 font-medium' :
                                            item.status === 'error' ? 'text-rose-600 font-medium' :
                                            item.status === 'stamped' ? 'text-emerald-700' : 'text-gray-500'
                                        }`}>
                                            {item.message}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase rounded-none border ${
                                    item.status === 'stamped' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    item.status === 'match' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    item.status === 'mismatch' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                    item.status === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                    item.status === 'processing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    'bg-gray-100 text-gray-600 border-gray-200'
                                }`}>
                                    {item.status === 'stamped' ? 'Synced' :
                                     item.status === 'match' ? 'Already Matched' :
                                     item.status === 'mismatch' ? 'Mismatch' :
                                     item.status === 'error' ? 'Failed' :
                                     item.status === 'processing' ? 'Syncing...' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        {status === 'processing' ? 'Processing sequentially to ensure reliable cloud delivery...' : 'All tasks processed.'}
                    </span>
                    <div className="flex items-center gap-2">
                        {status === 'processing' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setMinimized(true);
                                    setOpen(false);
                                }}
                                className="h-9 px-4 text-xs font-semibold rounded-none border-gray-300 hover:bg-gray-100"
                            >
                                Minimize
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={resetStore}
                                className="h-9 px-6 text-xs font-bold rounded-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                            >
                                Complete
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
