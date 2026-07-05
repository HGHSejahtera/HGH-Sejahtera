import { useState, useMemo } from 'react';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';
import { SortOrders, MergeAndPrintAwbs } from '@/services/pdf/AwbMergeService';

import { Clock, ChevronRight, Package, X, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const formatCurrency = (value) => new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
}).format(Number(value || 0));

export function AllOrders() {
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const isAgent = role === 'Agent';
    const isStaff = role === 'Staff';

    const { orders, isLoading, MarkAsPrinted, IsMarkingPrinted } = useOrderHistory();
    
    // UI state - PascalCase for all variables per MemoryCore
    const [ActiveTab, SetActiveTab] = useState('Queue');
    const [SortBy, SetSortBy] = useState('Product');
    const [IsPrinting, SetIsPrinting] = useState(false);

    // Drawer state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [viewAwbUrl, setViewAwbUrl] = useState(null);

    const handleOpenDrawer = (order) => {
        setIsClosing(false);
        setSelectedOrder(order);
    };

    const handleCloseDrawer = () => {
        if (isClosing) return;
        setIsClosing(true);
        setTimeout(() => {
            setSelectedOrder(null);
            setIsClosing(false);
        }, 240);
    };

    const QueueOrders = useMemo(() => {
        const Unprinted = orders.filter(Order => !Order.IsPrinted);
        return SortOrders(Unprinted, SortBy);
    }, [orders, SortBy]);

    const CompleteOrders = useMemo(() => {
        const Printed = orders.filter(Order => Order.IsPrinted);
        return SortOrders(Printed, SortBy);
    }, [orders, SortBy]);

    const DisplayOrders = ActiveTab === 'Queue' ? QueueOrders : CompleteOrders;

    const HandlePrintAll = async () => {
        if (QueueOrders.length === 0) return;
        SetIsPrinting(true);
        try {
            const PrintedIds = await MergeAndPrintAwbs(QueueOrders);
            if (PrintedIds && PrintedIds.length > 0) {
                await MarkAsPrinted({ orderIds: PrintedIds, isPrinted: true });
            }
        } catch (Error) {
            console.error('Failed to print batch AWBs:', Error);
            alert(Error.message || 'Failed to merge or print AWB files.');
        } finally {
            SetIsPrinting(false);
        }
    };

    const HandleMarkBatchDone = async () => {
        if (QueueOrders.length === 0) return;
        const OrderIds = QueueOrders.map(Order => Order.ImportedOrderID);
        try {
            await MarkAsPrinted({ orderIds: OrderIds, isPrinted: true });
        } catch (Error) {
            console.error('Failed to mark batch as done:', Error);
        }
    };

    // RLS Protection in UI
    if (isAgent || isStaff) {
        return <Navigate to="/Dashboard" replace />;
    }

    const columns = [
        { 
            header: 'Date', 
            accessorKey: 'CreatedAt',
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        { 
            header: 'Time', 
            id: 'time',
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
        },
        { 
            header: 'Order ID', 
            accessorKey: 'PlatformOrderID',
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    {row.original.IsPrinted && (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm shrink-0" title="Print Done"></span>
                    )}
                    <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span>
                </div>
            )
        },
        { 
            header: () => <div className="text-center">Platform</div>, 
            accessorKey: 'Platform',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Badge variant="outline" className="bg-white rounded-md font-medium text-xs border-gray-200 px-2.5 py-0.5 shadow-xs">
                        {row.original.Platform}
                    </Badge>
                </div>
            )
        },
        { 
            header: 'Agent', 
            accessorKey: 'AgentName',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{row.original.AgentName}</span>
                </div>
            )
        },
        { 
            header: () => <div className="text-right">Amount</div>, 
            accessorKey: 'DisplayAmount',
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    {formatCurrency(row.original.DisplayAmount)}
                </div>
            )
        },
        {
            header: () => <div className="text-center">Status</div>,
            id: 'status_action',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    {!row.original.IsPrinted ? (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                MarkAsPrinted({ orderIds: [row.original.ImportedOrderID], isPrinted: true });
                            }}
                            disabled={IsMarkingPrinted}
                            title="Mark Order as Complete"
                            className="border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 hover:border-emerald-300 font-medium text-xs rounded-md h-7 px-3 shadow-xs transition-all cursor-pointer"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Complete
                        </Button>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                        </span>
                    )}
                </div>
            )
        },
        {
            header: () => <div className="text-center">Action</div>,
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpenDrawer(row.original)} 
                        className="h-7 px-3 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-300 font-medium text-xs rounded-md shadow-xs transition-all cursor-pointer"
                    >
                        View <ChevronRight className="w-3.5 h-3.5 ml-1 text-gray-400" />
                    </Button>
                </div>
            )
        }
    ];

    const QueueActionElement = ActiveTab === 'Queue' ? (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Sort By:</span>
                <Select value={SortBy} onValueChange={SetSortBy}>
                    <SelectTrigger className="h-8 w-[130px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Brand">Brand</SelectItem>
                        <SelectItem value="DateOldest">Date (Oldest)</SelectItem>
                        <SelectItem value="DateNewest">Date (Newest)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={HandlePrintAll}
                disabled={IsPrinting || QueueOrders.length === 0}
                className="border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-gray-700 font-medium text-xs rounded-md h-8 px-3 shadow-xs transition-all cursor-pointer"
            >
                <Printer className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Print All ({QueueOrders.length})
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={HandleMarkBatchDone}
                disabled={IsMarkingPrinted || QueueOrders.length === 0}
                className="border-gray-200 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-gray-700 font-medium text-xs rounded-md h-8 px-3 shadow-xs transition-all cursor-pointer"
            >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Complete Order
            </Button>
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => SetActiveTab('Queue')}
                    className={cn(
                        "py-3 px-6 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer",
                        ActiveTab === 'Queue'
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                >
                    Order Queue
                    {QueueOrders.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                            {QueueOrders.length}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => SetActiveTab('Complete')}
                    className={cn(
                        "py-3 px-6 text-sm font-bold border-b-2 transition-colors cursor-pointer",
                        ActiveTab === 'Complete'
                            ? "border-indigo-600 text-indigo-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                >
                    Order Complete
                </button>
            </div>

            <div className="bg-white rounded-none shadow-xs border overflow-hidden">
                <div className="p-4">
                    <DataTable 
                        columns={columns} 
                        data={DisplayOrders} 
                        isLoading={isLoading} 
                        searchPlaceholder="Search" 
                        actionElement={QueueActionElement}
                    />
                </div>
            </div>

            {/* Order Detail Drawer */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className={`absolute inset-0 bg-black/20 backdrop-blur-xs ${isClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade'}`} onClick={handleCloseDrawer} />
                    <div className={`absolute inset-y-0 right-0 max-w-xl w-full bg-white shadow-xl flex flex-col z-10 ${isClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide'}`}>
                        
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h2 className="text-lg font-bold text-gray-900">{selectedOrder.PlatformOrderID}</h2>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{selectedOrder.Platform || 'TikTok'}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleCloseDrawer} className="rounded-none">
                                <X className="w-5 h-5 text-gray-400" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-none border">
                                <div>
                                    <p className="text-gray-500 mb-1">Total Amount</p>
                                    <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedOrder.TotalAmount || selectedOrder.DisplayAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">Items Count</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedOrder.TotalItems || selectedOrder.ItemCount || 0} items</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">Agent</p>
                                    <p className="font-medium text-gray-900">{selectedOrder.AgentName}</p>
                                </div>
                                {selectedOrder.AwbUrl && (
                                    <div>
                                        <p className="text-gray-500 mb-1">AWB Document</p>
                                        <button 
                                            type="button"
                                            onClick={() => setViewAwbUrl(selectedOrder.AwbUrl)}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-xs tracking-wide rounded-none shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer"
                                        >
                                            View
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                    Timeline
                                </h3>
                                <div className="space-y-3 text-sm border-l-2 border-indigo-100 pl-4 ml-2">
                                    <div>
                                        <p className="font-medium text-gray-900">Order Created</p>
                                        <p className="text-xs text-gray-500">
                                            {selectedOrder.CreatedAt ? new Date(selectedOrder.CreatedAt).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'numeric',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: 'numeric',
                                                hour12: true
                                            }) : 'N/A'}
                                        </p>
                                    </div>
                                    {selectedOrder.IsPrinted && (
                                        <div>
                                            <p className="font-medium text-emerald-600">Print Done</p>
                                            <p className="text-xs text-gray-500">
                                                {selectedOrder.PrintedAt ? new Date(selectedOrder.PrintedAt).toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: 'numeric',
                                                    hour12: true
                                                }) : 'Manually Marked'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                    <Package className="w-4 h-4 mr-2 text-gray-400" />
                                    Order Items ({selectedOrder.Items?.length || selectedOrder.ImportedOrderItems?.length || 0})
                                </h3>
                                <div className="space-y-3">
                                    {(selectedOrder.Items || selectedOrder.ImportedOrderItems)?.map((item) => {
                                        const brand = item.Brand || item.Products?.Brand || '';
                                        const productName = item.ProductName || item.Products?.ProductName || '';
                                        const variation = item.Variation || item.Products?.Variation || '';
                                        const size = item.Size || item.Products?.Size || '';
                                        const displayName = [brand, productName, variation, size].filter(Boolean).join(' ') || item.PlatformProductName || 'Unknown Item';

                                        return (
                                            <div key={item.ItemID} className="p-3 bg-white border rounded-none shadow-sm flex justify-between items-center">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm text-gray-900 line-clamp-2">{displayName}</p>
                                                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                                                        <span>SKU: {item.PlatformSKU || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div className="ml-4 text-right">
                                                    <div className="text-sm font-bold text-gray-900">x{item.Quantity}</div>
                                                    <div className="text-xs font-medium text-emerald-600 mt-0.5">{formatCurrency(item.Subtotal)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AwbPdfViewer 
                url={viewAwbUrl} 
                open={!!viewAwbUrl} 
                onOpenChange={(open) => {
                    if (!open) setViewAwbUrl(null);
                }} 
            />
        </div>
    );
}
