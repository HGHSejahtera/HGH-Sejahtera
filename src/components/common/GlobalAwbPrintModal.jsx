import { useAwbPrintStore } from '@/hooks/useAwbPrintStore';
import { getBatchAwbFilename } from '@/services/pdf/AwbMergeService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Download, RefreshCw, CheckCheck, Minimize2, Maximize2, Printer } from 'lucide-react';

export function GlobalAwbPrintModal() {
    const {
        isOpen,
        isMinimized,
        status,
        progress,
        successfulIds,
        failedOrders,
        errors,
        mergedPdfBlobUrl,
        setOpen,
        setMinimized,
        resetStore,
        retryFailedOrders,
        forceMarkPrinted
    } = useAwbPrintStore();

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
                className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white rounded-none px-4 py-2.5 shadow-2xl flex items-center gap-3 border border-purple-500/40 hover:scale-105 hover:bg-gray-800 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-3"
            >
                {status === 'processing' ? (
                    <span className="flex items-center justify-center w-5 h-5 bg-purple-600/30 text-purple-300">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    </span>
                ) : status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}

                <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight">
                        {status === 'processing' ? `Merging AWBs (${percentage}%)` : status === 'completed' ? 'AWB Batch Ready' : 'AWB Batch Issues'}
                    </span>
                    <span className="text-[10px] text-gray-300 leading-tight">
                        {status === 'processing' 
                            ? `${progress.current} of ${totalCount} orders` 
                            : `${successfulIds.length} done${failedOrders.length > 0 ? `, ${failedOrders.length} failed` : ''}`}
                    </span>
                </div>

                <Maximize2 className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </div>
        );
    }

    if (!isOpen) return null;

    const handleDownload = () => {
        if (!mergedPdfBlobUrl) return;
        const link = document.createElement('a');
        link.href = mergedPdfBlobUrl;
        link.download = getBatchAwbFilename();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenPrint = () => {
        if (!mergedPdfBlobUrl) return;
        const win = window.open(mergedPdfBlobUrl, '_blank');
        if (win) {
            win.onload = () => {
                win.focus();
                win.print();
            };
        } else {
            handleDownload();
        }
    };

    return (
        <Dialog 
            open={isOpen} 
            onOpenChange={(open) => {
                if (!open) {
                    if (status === 'processing') {
                        setMinimized(true);
                    } else {
                        setOpen(false);
                    }
                }
            }}
        >
            <DialogContent className="max-w-xl bg-white rounded-none p-6 shadow-xl border-gray-200">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                    <DialogTitle className="text-base font-bold text-gray-900">
                        Batch AWB Print & Download Center
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-400 hover:text-gray-600 rounded-none" 
                            onClick={() => {
                                setMinimized(true);
                                setOpen(false);
                            }}
                            title="Minimize to floating widget"
                        >
                            <Minimize2 className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <DialogDescription className="sr-only">
                    Batch AWB Print & Download Center
                </DialogDescription>

                <div className="space-y-4 py-2">
                    {/* Progress bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                            <span>Progress</span>
                            <span>{progress.current} / {totalCount} orders ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-none h-2.5 overflow-hidden border border-gray-200">
                            <div 
                                className={`h-2.5 rounded-none transition-all duration-300 ${status === 'error' ? 'bg-rose-600' : status === 'completed' ? 'bg-emerald-600' : 'bg-purple-600'}`} 
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Status text */}
                    <div className="p-3 rounded-none bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 break-words flex items-center gap-2">
                        {status === 'processing' ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-600 animate-ping shrink-0" />
                        ) : status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="flex-1">{status === 'completed' ? 'Ready' : progress.statusText || 'Processing completed with issues.'}</span>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-none bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex flex-col items-center">
                            <span className="text-[10px] font-semibold uppercase text-emerald-600">Successful</span>
                            <span className="text-lg font-bold">{successfulIds.length}</span>
                        </div>
                        <div className="p-2.5 rounded-none bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col items-center">
                            <span className="text-[10px] font-semibold uppercase text-rose-600">Failed / Stuck</span>
                            <span className="text-lg font-bold">{failedOrders.length}</span>
                        </div>
                    </div>

                    {/* Safety Net Download Center */}
                    {mergedPdfBlobUrl && (
                        <div className="p-3.5 bg-purple-50/80 rounded-none border border-purple-200 space-y-3">
                            <div className="text-xs font-bold text-purple-900">
                                Batch AWB Download
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    size="sm" 
                                    onClick={handleDownload} 
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs flex-1 h-8 rounded-none shadow-sm cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    Download PDF
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={handleOpenPrint} 
                                    className="border-purple-300 bg-white hover:bg-purple-100 text-purple-900 text-xs flex-1 h-8 rounded-none shadow-xs cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                                    Open & Print
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Stuck / Failed Orders Handling */}
                    {failedOrders && failedOrders.length > 0 && (
                        <div className="p-3.5 bg-rose-50 rounded-none border border-rose-200 space-y-2">
                            <div className="text-xs font-bold text-rose-900 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    Stuck / Failed Orders ({failedOrders.length})
                                </span>
                            </div>
                            <div className="text-[11px] text-rose-700 leading-tight">
                                Failed due to HTTP 502 server timeout or missing PDFs in R2 storage.
                            </div>
                            <div className="max-h-24 overflow-y-auto space-y-1 my-1 text-[11px]">
                                {failedOrders.slice(0, 5).map((f, i) => (
                                    <div key={i} className="font-mono text-rose-800 bg-white/70 px-2 py-1 rounded-none border border-rose-100 flex justify-between items-center">
                                        <span className="font-semibold">{f.orderId}</span>
                                        <span className="text-rose-600 text-[10px] truncate max-w-[150px]">{f.error}</span>
                                    </div>
                                ))}
                                {failedOrders.length > 5 && (
                                    <div className="text-[10px] text-rose-600 italic">+{failedOrders.length - 5} more orders</div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <Button 
                                    size="sm" 
                                    onClick={retryFailedOrders} 
                                    disabled={status === 'processing'} 
                                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs flex-1 h-8 rounded-none shadow-sm cursor-pointer"
                                    title="Retry downloading AWB PDFs for these failed orders"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                    Retry Failed ({failedOrders.length})
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={async () => {
                                        const ids = failedOrders.map(f => f.importedOrderId).filter(Boolean);
                                        await forceMarkPrinted(ids);
                                    }} 
                                    disabled={status === 'processing'} 
                                    className="border-rose-300 bg-white hover:bg-rose-100 text-rose-900 text-xs flex-1 h-8 rounded-none shadow-xs cursor-pointer"
                                    title="Force mark these orders as Printed so they exit Order Queue and move to Order History"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                                    Force Mark Printed
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-3">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                            setMinimized(true);
                            setOpen(false);
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 h-8 px-3 rounded-none font-medium"
                    >
                        Minimize
                    </Button>
                    <Button 
                        variant="default" 
                        size="sm" 
                        disabled={status === 'processing'}
                        onClick={() => resetStore()}
                        className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-5 h-8 rounded-none shadow-sm"
                    >
                        {status === 'processing' ? 'Processing...' : 'Complete'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
