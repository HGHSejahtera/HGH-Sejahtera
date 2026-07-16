import { useState, useMemo, useEffect } from 'react';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';
import { SortOrders, MergeAndPrintAwbs } from '@/services/pdf/AwbMergeService';

import { Clock, ChevronRight, Package, X, Printer, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';

const formatCurrency = (value) => new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
}).format(Number(value || 0));

export function AllOrders() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const isAgent = role === 'Agent';
    const isStaff = role === 'Staff';

    const { orders, isLoading, MarkAsPrinted, IsMarkingPrinted } = useOrderHistory();
    
    // UI state - PascalCase for all variables per MemoryCore
    const [ActiveTab, SetActiveTab] = useState('Queue');
    const [SortBy, SetSortBy] = useState('Product');
    const [IsPrinting, SetIsPrinting] = useState(false);
    const [FilterAgent, SetFilterAgent] = useState('All');
    const [FilterPlatform, SetFilterPlatform] = useState('All');
    const [FilterAccount, SetFilterAccount] = useState('All');
    const [RowSelection, SetRowSelection] = useState({});

    // Reset selection when changing tabs or filters
    useEffect(() => {
        SetRowSelection({});
    }, [ActiveTab, FilterAgent, FilterPlatform, FilterAccount, SortBy]);

    // Unique options for filters
    const UniqueAgents = useMemo(() => {
        const agents = new Set(orders.filter(o => o.AgentName).map(o => o.AgentName));
        return ['All', ...Array.from(agents).sort()];
    }, [orders]);

    const UniquePlatforms = useMemo(() => {
        const platforms = new Set(orders.filter(o => o.Platform).map(o => o.Platform));
        return ['All', ...Array.from(platforms).sort()];
    }, [orders]);

    const UniqueAccounts = useMemo(() => {
        const accounts = new Set(orders.filter(o => o.AccountName).map(o => o.AccountName));
        return ['All', ...Array.from(accounts).sort()];
    }, [orders]);

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
        let Unprinted = orders.filter(Order => !Order.IsPrinted);
        if (FilterAgent !== 'All') Unprinted = Unprinted.filter(o => o.AgentName === FilterAgent);
        if (FilterPlatform !== 'All') Unprinted = Unprinted.filter(o => o.Platform === FilterPlatform);
        if (FilterAccount !== 'All') Unprinted = Unprinted.filter(o => o.AccountName === FilterAccount);
        return SortOrders(Unprinted, SortBy);
    }, [orders, SortBy, FilterAgent, FilterPlatform, FilterAccount]);

    const CompleteOrders = useMemo(() => {
        let Printed = orders.filter(Order => Order.IsPrinted);
        if (FilterAgent !== 'All') Printed = Printed.filter(o => o.AgentName === FilterAgent);
        if (FilterPlatform !== 'All') Printed = Printed.filter(o => o.Platform === FilterPlatform);
        if (FilterAccount !== 'All') Printed = Printed.filter(o => o.AccountName === FilterAccount);
        return SortOrders(Printed, SortBy);
    }, [orders, SortBy, FilterAgent, FilterPlatform, FilterAccount]);

    const DisplayOrders = ActiveTab === 'Queue' ? QueueOrders : CompleteOrders;

    const HandlePrintAll = async () => {
        const selectedIndices = Object.keys(RowSelection).filter(k => RowSelection[k]);
        let ordersToPrint = QueueOrders;
        
        if (selectedIndices.length > 0) {
            ordersToPrint = selectedIndices.map(index => QueueOrders[index]);
        }
        
        if (ordersToPrint.length === 0) return;
        
        SetIsPrinting(true);
        try {
            const PrintedIds = await MergeAndPrintAwbs(ordersToPrint);
            if (PrintedIds && PrintedIds.length > 0) {
                await MarkAsPrinted({ orderIds: PrintedIds, isPrinted: true });
                SetRowSelection({});
            }
        } catch (error) {
            console.error('Failed to print batch AWBs:', error);
            alert(error.message || 'Failed to merge or print AWB files.');
        } finally {
            SetIsPrinting(false);
        }
    };

    // RLS Protection in UI
    if (isAgent || isStaff) {
        return <Navigate to="/Dashboard" replace />;
    }

    const columns = [
        {
            id: 'select',
            header: ({ table }) => (
                <div className="flex justify-center items-center px-2">
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected()}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                        className="border-gray-300"
                    />
                </div>
            ),
            cell: ({ row }) => {
                const isMissingAwb = !row.original.AwbUrl || row.original.AwbUrl.trim() === '';
                return (
                <div className="flex justify-center items-center px-2">
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="border-gray-300"
                        disabled={isMissingAwb}
                    />
                </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
        },
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
            cell: ({ row }) => {
                const isMissingAwb = !row.original.AwbUrl || row.original.AwbUrl.trim() === '';
                const hasUnmatched = (row.original.Items || row.original.ImportedOrderItems)?.some(
                    i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
                ) || (Number(row.original.DisplayAmount || 0) === 0 && (row.original.Items?.length > 0 || row.original.ImportedOrderItems?.length > 0));

                return (
                    <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                            {row.original.IsPrinted && (
                                <span 
                                    className={`inline-block h-2 w-2 rounded-full shadow-sm shrink-0 ${isMissingAwb ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                    title={isMissingAwb ? "Missing AWB" : "Print Done"}
                                ></span>
                            )}
                            <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span>
                        </div>
                        {(isMissingAwb || hasUnmatched) && (
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {isMissingAwb && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Missing AWB
                                    </span>
                                )}
                                {hasUnmatched && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" /> SKU Review
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
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

    const selectedCount = Object.keys(RowSelection).filter(k => RowSelection[k]).length;
    const QueueActionElement = ActiveTab === 'Queue' ? (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Platform:</span>
                <Select value={FilterPlatform} onValueChange={SetFilterPlatform}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniquePlatforms.map(platform => (
                            <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-2">
                <span className="text-gray-500 font-medium mr-1">Account:</span>
                <Select value={FilterAccount} onValueChange={SetFilterAccount}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniqueAccounts.map(account => (
                            <SelectItem key={account} value={account}>{account}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-2">
                <span className="text-gray-500 font-medium mr-1">Agent:</span>
                <Select value={FilterAgent} onValueChange={SetFilterAgent}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniqueAgents.map(agent => (
                            <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-2">
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
                className="border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-gray-700 font-medium text-xs rounded-md h-8 px-3 shadow-xs transition-all cursor-pointer ml-2"
            >
                <Printer className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                {selectedCount > 0 ? `Print Selected (${selectedCount})` : `Print All (${QueueOrders.length})`}
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
                        rowSelection={RowSelection}
                        onRowSelectionChange={SetRowSelection}
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
                            {(() => {
                                const orderItems = selectedOrder.Items || selectedOrder.ImportedOrderItems || [];
                                const hasUnmatchedItems = orderItems.some(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched') || Number(selectedOrder.DisplayAmount || 0) === 0;
                                const isMissingAwb = !selectedOrder.AwbUrl || selectedOrder.AwbUrl.trim() === '';

                                return (
                                    <>
                                        {isMissingAwb && (
                                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start space-x-3 text-rose-900 shadow-xs">
                                                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                                <div className="flex-1 text-xs">
                                                    <p className="font-bold text-sm">Action Required: Missing AWB PDF</p>
                                                    <p className="mt-1 text-rose-800 leading-relaxed">
                                                        This order was recorded but the AWB PDF failed to upload. 
                                                        You cannot print this order. Please upload the PDF via <b>Upload AWB (PC)</b> to attach it to this order.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {hasUnmatchedItems && (
                                            <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-xl flex items-start space-x-3 text-amber-900 shadow-xs">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div className="flex-1 text-xs">
                                                    <p className="font-bold text-sm">Action Required: SKU Review (RM 0.00)</p>
                                                    <p className="mt-1 text-amber-800 leading-relaxed">
                                                        One or more items in this order have no Seller SKU (<code>SKU: -</code>). Commission and Total Amount will remain RM 0.00 until matched.
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            handleCloseDrawer();
                                                            navigate('/Orders/Product-Matcher');
                                                        }}
                                                        className="mt-2.5 h-7 text-xs font-semibold border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900"
                                                    >
                                                        Open Product Matcher <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

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
                                                Order Items ({orderItems.length})
                                            </h3>
                                            <div className="space-y-3">
                                                {orderItems.map((item) => {
                                                    const brand = item.Brand || item.Products?.Brand || '';
                                                    const productName = item.ProductName || item.Products?.ProductName || '';
                                                    const variation = item.Variation || item.Products?.Variation || '';
                                                    const size = item.Size || item.Products?.Size || '';
                                                    const displayName = [brand, productName, variation, size].filter(Boolean).join(' ') || item.PlatformProductName || item.ProductName || 'Unknown Item';
                                                    const isUnmatched = !item.ProductID || item.PlatformSKU === '-' || item.MatchStatus === 'Unmatched';

                                                    return (
                                                        <div key={item.ItemID} className="p-3 bg-white border rounded-none shadow-sm flex justify-between items-center">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm text-gray-900 line-clamp-2">{displayName}</p>
                                                                <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                                                                    <span>SKU: {item.PlatformSKU || '-'}</span>
                                                                    {isUnmatched && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                            SKU Review
                                                                        </span>
                                                                    )}
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
                                    </>
                                );
                            })()}
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
