import { useState, useMemo, useEffect } from 'react';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { AWBPDFViewer } from '@/components/common/AWB-PDF-Viewer';
import { SortOrders } from '@/services/pdf/AwbMergeService';
import { useAwbPrintStore } from '@/hooks/useAwbPrintStore';
import { ProductModal } from '@/pages/Inventory/ProductModal';
import { OrderMatchModal } from '@/pages/Orders/OrderMatchModal';
import { useProductMatcher } from '@/hooks/useProductMatcher';

import { Clock, ChevronRight, Package, X, Printer, AlertTriangle, CheckCircle2, ShieldAlert, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const formatCurrency = (value) => new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
}).format(Number(value || 0));

const MonthOptions = [
    { label: 'All Months', value: 'All' },
    { label: 'January', value: '0' },
    { label: 'February', value: '1' },
    { label: 'March', value: '2' },
    { label: 'April', value: '3' },
    { label: 'May', value: '4' },
    { label: 'June', value: '5' },
    { label: 'July', value: '6' },
    { label: 'August', value: '7' },
    { label: 'September', value: '8' },
    { label: 'October', value: '9' },
    { label: 'November', value: '10' },
    { label: 'December', value: '11' },
];

const FilterControls = ({
    isMobile,
    tab, // 'Queue', 'Complete', 'Status'
    FilterPlatform, SetFilterPlatform, UniquePlatforms,
    FilterAccountType, SetFilterAccountType,
    FilterAgent, SetFilterAgent, UniqueAgents,
    FilterMonth, SetFilterMonth,
    QueueSortBy, SetQueueSortBy,
    HistorySortBy, SetHistorySortBy,
    StatusFilterPill, SetStatusFilterPill, statusCounts,
    table
}) => {
    const isHistory = tab === 'Complete';
    const isStatus = tab === 'Status';
    
    const wrapperClass = isMobile ? "flex flex-col gap-4 w-full" : "hidden md:flex flex-wrap items-center gap-3";
    const itemClass = isMobile ? "flex flex-col gap-1.5" : "flex items-center gap-1.5 text-xs";
    const labelClass = "text-gray-500 font-medium";
    const selectTriggerClass = cn(
        "bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors",
        isMobile ? "w-full h-10" : "h-8 w-[110px]"
    );
    
    return (
        <div className={wrapperClass}>
            {isStatus && statusCounts && (
                <div className={itemClass}>
                    <span className={labelClass}>Problem Type:</span>
                    <Select value={StatusFilterPill} onValueChange={SetStatusFilterPill}>
                        <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                            <SelectItem value="All">All Problem ({statusCounts.total})</SelectItem>
                            <SelectItem value="SKUReview">SKU Review ({statusCounts.skuReview})</SelectItem>
                            <SelectItem value="MissingAWB">AWB Action ({statusCounts.missingAwb})</SelectItem>
                            <SelectItem value="Ready">Ready ({statusCounts.ready})</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            
            <div className={itemClass}>
                <span className={labelClass}>Platform:</span>
                <Select value={FilterPlatform} onValueChange={SetFilterPlatform}>
                    <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniquePlatforms.map(platform => (
                            <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className={itemClass}>
                <span className={labelClass}>Account:</span>
                <Select value={FilterAccountType} onValueChange={(val) => { SetFilterAccountType(val); SetFilterAgent('All'); }}>
                    <SelectTrigger className={selectTriggerClass}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Stores">Stores</SelectItem>
                        <SelectItem value="Agent">Agent</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {FilterAccountType === 'Agent' && (
                <div className={itemClass}>
                    <span className={labelClass}>Agent:</span>
                    <Select value={FilterAgent} onValueChange={SetFilterAgent}>
                        <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                            {UniqueAgents.map(agent => (
                                <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            
            {isHistory && (
                <div className={itemClass}>
                    <span className={labelClass}>Month:</span>
                    <Select value={FilterMonth} onValueChange={SetFilterMonth}>
                        <SelectTrigger className={selectTriggerClass}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 max-h-[260px]">
                            {MonthOptions.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            
            {!isStatus && (
                <div className={itemClass}>
                    <span className={labelClass}>Sort By:</span>
                    <Select value={isHistory ? HistorySortBy : QueueSortBy} onValueChange={isHistory ? SetHistorySortBy : SetQueueSortBy}>
                        <SelectTrigger className={cn(selectTriggerClass, isMobile ? "" : "w-[130px]")}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                            <SelectItem value="Product">Product</SelectItem>
                            <SelectItem value="Brand">Brand</SelectItem>
                            <SelectItem value="DateOldest">Oldest</SelectItem>
                            <SelectItem value="DateNewest">Newest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {isMobile && table && (
                <div className={itemClass}>
                    <span className={labelClass}>Show Rows:</span>
                    <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                    >
                        <SelectTrigger className={selectTriggerClass}>
                            <SelectValue placeholder={table.getState().pagination.pageSize === 999999 ? 'All' : table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 text-xs">
                            {[10, 30, 50, 100].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                            <SelectItem value="999999">All</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
};

export function AllOrders() {
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const isAgent = role === 'Agent';
    const isStaff = role === 'Staff';

    const { orders, isLoading, MarkAsPrinted } = useOrderHistory();

    // UI state - PascalCase for all variables per MemoryCore
    const [ActiveTab, SetActiveTab] = useState(() => {
        return localStorage.getItem('HGH_Orders_ActiveTab') || 'Queue';
    });
    const [QueueSortBy, SetQueueSortBy] = useState('DateNewest');
    const [HistorySortBy, SetHistorySortBy] = useState('DateNewest');
    const [HeaderSort, SetHeaderSort] = useState({ column: null, direction: 'asc' });
    const [StatusFilterPill, SetStatusFilterPill] = useState('All');
    const [IsPrinting, SetIsPrinting] = useState(false);
    const [FilterAgent, SetFilterAgent] = useState('All');
    const [FilterPlatform, SetFilterPlatform] = useState('All');
    const [FilterAccountType, SetFilterAccountType] = useState('All');
    const [FilterMonth, SetFilterMonth] = useState(String(new Date().getMonth()));
    const [RowSelection, SetRowSelection] = useState({});

    const handleTabChange = (tab) => {
        SetActiveTab(tab);
        localStorage.setItem('HGH_Orders_ActiveTab', tab);
        SetRowSelection({});
        SetFilterAgent('All');
        SetFilterPlatform('All');
        SetFilterAccountType('All');
        SetFilterMonth(String(new Date().getMonth()));
    };

    const handleHeaderClick = (columnName) => {
        SetHeaderSort(prev => {
            if (prev.column === columnName) {
                if (prev.direction === 'asc') return { column: columnName, direction: 'desc' };
                return { column: null, direction: 'asc' };
            }
            return { column: columnName, direction: 'asc' };
        });
    };

    // Reset selection when changing tabs or filters
    useEffect(() => {
        queueMicrotask(() => {
            SetRowSelection({});
        });
    }, [ActiveTab, FilterAgent, FilterPlatform, FilterAccountType, QueueSortBy, HistorySortBy, HeaderSort.column, HeaderSort.direction, StatusFilterPill, FilterMonth]);

    // Unique options for filters
    const UniqueAgents = useMemo(() => {
        const agents = new Set(orders.filter(o => o.AccountType === 'Agent' && o.AgentName).map(o => o.AgentName));
        return ['All', ...Array.from(agents).sort()];
    }, [orders]);

    const UniquePlatforms = useMemo(() => {
        const platforms = new Set(orders.filter(o => o.Platform).map(o => o.Platform));
        return ['All', ...Array.from(platforms).sort()];
    }, [orders]);

    // Drawer state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [viewAwbUrl, setViewAwbUrl] = useState(null);

    const { resolveBatch, uniqueUnmatched, unresolveItem, isUnresolving } = useProductMatcher();
    const [IsProductModalOpen, SetIsProductModalOpen] = useState(false);
    const [SkuReviewItem, SetSkuReviewItem] = useState(null);
    const [MatchOrderModalData, SetMatchOrderModalData] = useState(null);

    const handleOpenSkuReviewModal = (order) => {
        SetMatchOrderModalData(order);
    };

    const handleOpenProductCreateModal = (order, targetItem = null) => {
        const items = order.Items || order.ImportOrderItems || [];
        const unmatchedItem = targetItem || items.find(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched');

        if (!unmatchedItem) {
            return;
        }

        SetSkuReviewItem(unmatchedItem);
        SetIsProductModalOpen(true);
    };

    const handleProductModalSuccess = async (newProductId) => {
        if (!SkuReviewItem || !newProductId) return;

        try {
            if (SkuReviewItem.ImportOrderID) {
                const resolvedSessionIds = new Set(JSON.parse(localStorage.getItem('HGH_ResolvedStatusOrders') || '[]'));
                resolvedSessionIds.add(SkuReviewItem.ImportOrderID);
                localStorage.setItem('HGH_ResolvedStatusOrders', JSON.stringify(Array.from(resolvedSessionIds)));
            }

            const targetSku = SkuReviewItem.PlatformSKU && SkuReviewItem.PlatformSKU !== '-' ? SkuReviewItem.PlatformSKU : '';
            const targetName = SkuReviewItem.ProductName || '';
            const targetKey = `${targetSku}_${targetName.trim()}`;

            const group = (uniqueUnmatched || []).find(g => g.key === targetKey);
            const itemIdsToResolve = group?.ItemIDs?.length > 0 ? group.ItemIDs : [SkuReviewItem.ItemID].filter(Boolean);

            if (itemIdsToResolve.length > 0) {
                await resolveBatch({ itemIds: itemIdsToResolve, productId: newProductId });
            }
        } catch (error) {
            console.error("Failed to auto-resolve items after product creation:", error);
        } finally {
            SetSkuReviewItem(null);
            SetIsProductModalOpen(false);
        }
    };

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

    const statusCounts = useMemo(() => {
        const resolvedSessionIds = new Set(JSON.parse(localStorage.getItem('HGH_ResolvedStatusOrders') || '[]'));
        let skuReview = 0;
        let missingAwb = 0;
        let ready = 0;

        orders.forEach(o => {
            const isMissingAwb = !o.AwbUrl || o.AwbUrl.trim() === '';
            const hasUnmatched = (o.Items || o.ImportOrderItems)?.some(
                i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
            ) ;
            const isResolvedProblem = (o.Items || o.ImportOrderItems)?.some(i => i.MatchStatus === 'ManualMatch') || resolvedSessionIds.has(o.ImportOrderID);

            const isProblemOrResolved = isMissingAwb || hasUnmatched || isResolvedProblem;
            if (!isProblemOrResolved) return;

            if (isMissingAwb) missingAwb++;
            else if (hasUnmatched) skuReview++;
            else if (isResolvedProblem) ready++;
        });

        return {
            total: skuReview + missingAwb + ready,
            skuReview,
            missingAwb,
            ready
        };
    }, [orders]);

    const QueueOrders = useMemo(() => {
        let Unprinted = orders.filter(Order => !Order.IsPrinted);
        if (FilterAccountType === 'Stores') Unprinted = Unprinted.filter(o => o.AccountType === 'Stores');
        if (FilterAccountType === 'Agent') {
            Unprinted = Unprinted.filter(o => o.AccountType === 'Agent');
            if (FilterAgent !== 'All') Unprinted = Unprinted.filter(o => o.AgentName === FilterAgent);
        }
        return SortOrders(Unprinted, QueueSortBy);
    }, [orders, QueueSortBy, FilterAgent, FilterPlatform, FilterAccountType]);

    const CompleteOrders = useMemo(() => {
        let Printed = orders.filter(Order => Order.IsPrinted);
        if (FilterPlatform !== 'All') Printed = Printed.filter(o => o.Platform === FilterPlatform);
        if (FilterAccountType === 'Stores') Printed = Printed.filter(o => o.AccountType === 'Stores');
        if (FilterAccountType === 'Agent') {
            Printed = Printed.filter(o => o.AccountType === 'Agent');
            if (FilterAgent !== 'All') Printed = Printed.filter(o => o.AgentName === FilterAgent);
        }
        if (FilterMonth !== 'All') {
            Printed = Printed.filter(o => new Date(o.CreatedAt || 0).getMonth() === Number(FilterMonth));
        }

        if (HeaderSort.column === 'Date') {
            Printed.sort((a, b) => {
                const timeA = new Date(a.CreatedAt || 0).getTime();
                const timeB = new Date(b.CreatedAt || 0).getTime();
                return HeaderSort.direction === 'asc' ? timeA - timeB : timeB - timeA;
            });
        } else if (HeaderSort.column === 'Status') {
            Printed.sort((a, b) => {
                const getWeight = (o) => {
                    if (!o.AwbUrl || o.AwbUrl.trim() === '') return 1;
                    const hasUnmatched = (o.Items || o.ImportOrderItems)?.some(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched') ;
                    if (hasUnmatched) return 2;
                    return 3;
                };
                const wA = getWeight(a), wB = getWeight(b);
                return HeaderSort.direction === 'asc' ? wA - wB : wB - wA;
            });
        } else {
            Printed = SortOrders(Printed, HistorySortBy);
        }

        return Printed;
    }, [orders, HistorySortBy, HeaderSort.column, HeaderSort.direction, FilterAgent, FilterPlatform, FilterAccountType, FilterMonth]);

    const StatusOrders = useMemo(() => {
        const resolvedSessionIds = new Set(JSON.parse(localStorage.getItem('HGH_ResolvedStatusOrders') || '[]'));
        let filtered = orders.filter(o => {
            const isMissingAwb = !o.AwbUrl || o.AwbUrl.trim() === '';
            const hasUnmatched = (o.Items || o.ImportOrderItems)?.some(
                i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
            ) ;
            const isResolvedProblem = (o.Items || o.ImportOrderItems)?.some(i => i.MatchStatus === 'ManualMatch') || resolvedSessionIds.has(o.ImportOrderID);

            const isProblemOrResolved = isMissingAwb || hasUnmatched || isResolvedProblem;
            if (!isProblemOrResolved) return false;

            if (StatusFilterPill === 'MissingAWB') return isMissingAwb;
            if (StatusFilterPill === 'SKUReview') return !isMissingAwb && hasUnmatched;
            if (StatusFilterPill === 'Ready') return !isMissingAwb && !hasUnmatched && isResolvedProblem;
            return true;
        });

        if (FilterPlatform !== 'All') filtered = filtered.filter(o => o.Platform === FilterPlatform);
        if (FilterAccountType === 'Stores') filtered = filtered.filter(o => o.AccountType === 'Stores');
        if (FilterAccountType === 'Agent') {
            filtered = filtered.filter(o => o.AccountType === 'Agent');
            if (FilterAgent !== 'All') filtered = filtered.filter(o => o.AgentName === FilterAgent);
        }

        if (HeaderSort.column === 'Date') {
            filtered.sort((a, b) => {
                const timeA = new Date(a.CreatedAt || 0).getTime();
                const timeB = new Date(b.CreatedAt || 0).getTime();
                return HeaderSort.direction === 'asc' ? timeA - timeB : timeB - timeA;
            });
        } else if (HeaderSort.column === 'Status') {
            filtered.sort((a, b) => {
                const getWeight = (o) => {
                    if (!o.AwbUrl || o.AwbUrl.trim() === '') return 1;
                    const hasUnmatched = (o.Items || o.ImportOrderItems)?.some(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched') ;
                    if (hasUnmatched) return 2;
                    return 3;
                };
                const wA = getWeight(a), wB = getWeight(b);
                return HeaderSort.direction === 'asc' ? wA - wB : wB - wA;
            });
        } else {
            filtered = SortOrders(filtered, 'DateNewest');
        }

        return filtered;
    }, [orders, HeaderSort.column, HeaderSort.direction, StatusFilterPill, FilterAgent, FilterPlatform, FilterAccountType]);

    const DisplayOrders = ActiveTab === 'Queue' ? QueueOrders : ActiveTab === 'Complete' ? CompleteOrders : StatusOrders;

    const TotalProfit = useMemo(() => {
        return DisplayOrders.reduce((sum, o) => sum + (parseFloat(o.DisplayProfit || 0)), 0);
    }, [DisplayOrders]);

    const HandlePrintAll = async () => {
        const selectedIndices = Object.keys(RowSelection).filter(k => RowSelection[k]);
        let ordersToPrint = QueueOrders;

        if (selectedIndices.length > 0) {
            ordersToPrint = selectedIndices.map(index => QueueOrders[index]);
        }

        if (ordersToPrint.length === 0) return;

        SetIsPrinting(true);
        try {
            await useAwbPrintStore.getState().startBatchPrint(ordersToPrint, MarkAsPrinted);
            SetRowSelection({});
        } finally {
            SetIsPrinting(false);
        }
    };

    // RLS Protection in UI
    if (isAgent || isStaff) {
        return <Navigate to="/Dashboard" replace />;
    }

    const queueColumns = [
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
            id: 'Date',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        {
            header: 'Time',
            id: 'time',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
        },
        {
            header: 'Order ID',
            accessorKey: 'PlatformOrderID',
            id: 'OrderID',
            cell: ({ row }) => {
                const isMissingAwb = !row.original.AwbUrl || row.original.AwbUrl.trim() === '';
                return (
                    <div className="flex items-center space-x-2">
                        {row.original.IsPrinted && (
                            <span
                                className={`inline-block h-2 w-2 rounded-full shadow-sm shrink-0 ${isMissingAwb ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                title={isMissingAwb ? "AWB Action" : "Print Done"}
                            ></span>
                        )}
                        <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span>
                    </div>
                );
            }
        },
        {
            header: () => <div className="text-center">Platform</div>,
            accessorKey: 'Platform',
            meta: { className: 'hidden md:table-cell' },
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
            id: 'Agent',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{row.original.AgentName}</span>
                </div>
            )
        },
        {
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
            id: 'Profit',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    {formatCurrency(row.original.DisplayProfit)}
                </div>
            )
        },
        {
            header: () => <div className="text-center">Review</div>,
            id: 'review',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const isMissingAwb = !row.original.AwbUrl || row.original.AwbUrl.trim() === '';
                const hasUnmatched = (row.original.Items || row.original.ImportOrderItems)?.some(
                    i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
                ) ;

                return (
                    <div className="flex justify-center items-center gap-1.5 flex-wrap">
                        {isMissingAwb && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300 shadow-2xs select-none">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> AWB Action
                            </span>
                        )}
                        {hasUnmatched && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSkuReviewModal(row.original);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 shadow-2xs cursor-pointer transition-colors select-none"
                                title="Click to open SKU Review modal & link product"
                            >
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> SKU Review
                            </button>
                        )}
                        {!isMissingAwb && !hasUnmatched && (
                            <span className="text-gray-400 text-xs font-medium">-</span>
                        )}
                    </div>
                );
            }
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

    const completeColumns = [
        {
            header: () => (
                <button
                    type="button"
                    onClick={() => handleHeaderClick('Date')}
                    className="font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
                >
                    Date
                </button>
            ),
            accessorKey: 'CreatedAt',
            id: 'Date',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        {
            header: 'Time',
            id: 'time',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
        },
        {
            header: 'Order ID',
            accessorKey: 'PlatformOrderID',
            id: 'OrderID',
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span>
                </div>
            )
        },
        {
            header: () => <div className="text-center">Platform</div>,
            accessorKey: 'Platform',
            meta: { className: 'hidden md:table-cell' },
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
            id: 'Agent',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{row.original.AgentName}</span>
                </div>
            )
        },
        {
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
            id: 'Profit',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    {formatCurrency(row.original.DisplayProfit)}
                </div>
            )
        },
        {
            header: () => (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => handleHeaderClick('Status')}
                        className="font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                        Status
                    </button>
                </div>
            ),
            id: 'status',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const hasUnmatched = (row.original.Items || row.original.ImportOrderItems)?.some(
                    i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
                ) ;

                return (
                    <div className="flex justify-center items-center">
                        {hasUnmatched ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSkuReviewModal(row.original);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs cursor-pointer transition-colors"
                                title="Order contains unmatched items without Seller SKU. Click to create product & resolve."
                            >
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> SKU Review
                            </button>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                {(row.original.OrderStatus || 'Complete').replace('Completed', 'Complete')}
                            </span>
                        )}
                    </div>
                );
            }
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

    const statusColumns = [
        {
            header: () => (
                <button
                    type="button"
                    onClick={() => handleHeaderClick('Date')}
                    className="font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
                >
                    Date
                </button>
            ),
            accessorKey: 'CreatedAt',
            id: 'Date',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
        },
        {
            header: 'Time',
            id: 'time',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            }
        },
        {
            header: 'Order ID',
            accessorKey: 'PlatformOrderID',
            id: 'OrderID',
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span>
                </div>
            )
        },
        {
            header: () => <div className="text-center">Platform</div>,
            accessorKey: 'Platform',
            meta: { className: 'hidden md:table-cell' },
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
            id: 'Agent',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{row.original.AgentName}</span>
                </div>
            )
        },
        {
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
            id: 'Profit',
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    {formatCurrency(row.original.DisplayProfit)}
                </div>
            )
        },
        {
            header: () => (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => handleHeaderClick('Status')}
                        className="font-semibold hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                        Status
                    </button>
                </div>
            ),
            id: 'status',
            cell: ({ row }) => {
                const isMissingAwb = !row.original.AwbUrl || row.original.AwbUrl.trim() === '';
                const hasUnmatched = (row.original.Items || row.original.ImportOrderItems)?.some(
                    i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched'
                ) ;

                return (
                    <div className="flex justify-center items-center gap-1.5 flex-wrap py-0.5">
                        {isMissingAwb && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-300 shadow-2xs select-none">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" /> AWB Action
                            </span>
                        )}
                        {hasUnmatched && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSkuReviewModal(row.original);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300 hover:border-amber-400 shadow-2xs cursor-pointer transition-all select-none"
                                title="Click to open SKU Review modal & link product"
                            >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> SKU Review
                            </button>
                        )}
                        {!isMissingAwb && !hasUnmatched && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs select-none">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Resolve
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: () => <div className="text-center">Action</div>,
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-center items-center gap-1.5">
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
    const QueueActionElement = ActiveTab === 'Queue' ? ({ table }) => (
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            {/* Desktop Filters */}
            <FilterControls 
                table={table}
                isMobile={false} tab="Queue"
                FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                QueueSortBy={QueueSortBy} SetQueueSortBy={SetQueueSortBy}
            />
            
            {/* Mobile Filters Popup */}
            <div className="md:hidden flex items-center gap-2 w-full">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="flex-1 h-9 bg-white text-gray-700 border-gray-200 shadow-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                            <Filter className="w-4 h-4" /> Filters
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-8 h-[80vh] overflow-y-auto">
                        <SheetHeader className="px-0 pt-0 pb-4 text-left">
                            <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
                        </SheetHeader>
                        <FilterControls 
                            table={table}
                            isMobile={true} tab="Queue"
                            FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                            FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                            FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                            QueueSortBy={QueueSortBy} SetQueueSortBy={SetQueueSortBy}
                        />
                    </SheetContent>
                </Sheet>
            </div>
            
            {/* Desktop Print Button */}
            <div className="hidden md:flex">
                <Button
                    variant="default"
                    size="sm"
                    onClick={HandlePrintAll}
                    disabled={IsPrinting || QueueOrders.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-md h-8 px-3.5 shadow-sm transition-all cursor-pointer border border-purple-600 hover:border-purple-700"
                >
                    <Printer className="w-3.5 h-3.5 mr-1.5 text-white" />
                    {selectedCount > 0 ? `Print Selected (${selectedCount})` : `Print All (${QueueOrders.length})`}
                </Button>
            </div>
        </div>
    ) : null;

    const CompleteActionElement = ActiveTab === 'Complete' ? ({ table }) => (
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            {/* Desktop Filters */}
            <FilterControls 
                table={table}
                isMobile={false} tab="Complete"
                FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                FilterMonth={FilterMonth} SetFilterMonth={SetFilterMonth}
                HistorySortBy={HistorySortBy} SetHistorySortBy={SetHistorySortBy}
            />
            
            {/* Mobile Filters Popup */}
            <div className="md:hidden flex items-center gap-2 w-full">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="w-full h-9 bg-white text-gray-700 border-gray-200 shadow-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                            <Filter className="w-4 h-4" /> Filters
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-8 h-[80vh] overflow-y-auto">
                        <SheetHeader className="px-0 pt-0 pb-4 text-left">
                            <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
                        </SheetHeader>
                        <FilterControls 
                            table={table}
                            isMobile={true} tab="Complete"
                            FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                            FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                            FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                            FilterMonth={FilterMonth} SetFilterMonth={SetFilterMonth}
                            HistorySortBy={HistorySortBy} SetHistorySortBy={SetHistorySortBy}
                        />
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    ) : null;

    const StatusActionElement = ActiveTab === 'Status' ? ({ table }) => (
        <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            {/* Desktop Filters */}
            <FilterControls 
                table={table}
                isMobile={false} tab="Status"
                FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                StatusFilterPill={StatusFilterPill} SetStatusFilterPill={SetStatusFilterPill} statusCounts={statusCounts}
            />
            
            {/* Mobile Filters Popup */}
            <div className="md:hidden flex items-center gap-2 w-full">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="w-full h-9 bg-white text-gray-700 border-gray-200 shadow-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                            <Filter className="w-4 h-4" /> Filters
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl p-6 pb-8 h-[80vh] overflow-y-auto">
                        <SheetHeader className="px-0 pt-0 pb-4 text-left">
                            <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
                        </SheetHeader>
                        <FilterControls 
                            table={table}
                            isMobile={true} tab="Status"
                            FilterPlatform={FilterPlatform} SetFilterPlatform={SetFilterPlatform} UniquePlatforms={UniquePlatforms}
                            FilterAccountType={FilterAccountType} SetFilterAccountType={SetFilterAccountType}
                            FilterAgent={FilterAgent} SetFilterAgent={SetFilterAgent} UniqueAgents={UniqueAgents}
                            StatusFilterPill={StatusFilterPill} SetStatusFilterPill={SetStatusFilterPill} statusCounts={statusCounts}
                        />
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200">
                {/* Mobile Tabs Dropdown */}
                <div className="md:hidden p-4 w-full bg-gray-50 border-b border-gray-100">
                    <Select value={ActiveTab} onValueChange={handleTabChange}>
                        <SelectTrigger className="w-full h-11 bg-white font-bold text-indigo-600 border-indigo-200 shadow-sm focus:ring-indigo-500 rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" className="rounded-lg shadow-lg border-gray-200">
                            <SelectItem value="Queue" className="font-semibold py-3">
                                Order Queue {QueueOrders.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-xs">{QueueOrders.length}</span>}
                            </SelectItem>
                            <SelectItem value="Complete" className="font-semibold py-3">
                                Order History
                            </SelectItem>
                            <SelectItem value="Status" className="font-semibold py-3">
                                Order Status {(statusCounts.skuReview + statusCounts.missingAwb) > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-xs">{statusCounts.skuReview + statusCounts.missingAwb}</span>}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Desktop Tabs */}
                <div className="hidden md:flex overflow-x-auto hide-scrollbar whitespace-nowrap w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => handleTabChange('Queue')}
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
                        onClick={() => handleTabChange('Complete')}
                        className={cn(
                            "py-3 px-6 text-sm font-bold border-b-2 transition-colors cursor-pointer",
                            ActiveTab === 'Complete'
                                ? "border-indigo-600 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        Order History
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('Status')}
                        className={cn(
                            "py-3 px-6 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer",
                            ActiveTab === 'Status'
                                ? "border-indigo-600 text-indigo-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        )}
                    >
                        Order Status
                        {(statusCounts.skuReview + statusCounts.missingAwb) > 0 && (
                            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                                {statusCounts.skuReview + statusCounts.missingAwb}
                            </span>
                        )}
                    </button>
                </div>
                {ActiveTab !== 'Status' && (
                    <div className="flex items-center justify-between md:justify-end px-4 py-3 md:py-2 bg-gray-50 md:bg-transparent border-t border-gray-100 md:border-0 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">Estimated Profit</span>
                            <span className="text-base font-bold text-emerald-600">{formatCurrency(TotalProfit)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-none shadow-xs border overflow-hidden">
                <div className="p-4">
                    <DataTable
                        key={ActiveTab}
                        columns={ActiveTab === 'Queue' ? queueColumns : ActiveTab === 'Complete' ? completeColumns : statusColumns}
                        data={DisplayOrders}
                        isLoading={isLoading}
                        searchPlaceholder="Search"
                        actionElement={ActiveTab === 'Queue' ? QueueActionElement : ActiveTab === 'Complete' ? CompleteActionElement : StatusActionElement}
                        bottomActionElement={ActiveTab === 'Queue' ? (
                            <div className="md:hidden flex w-full">
                                <Button
                                    variant="default"
                                    onClick={HandlePrintAll}
                                    disabled={IsPrinting || QueueOrders.length === 0}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-md h-9 shadow-sm transition-all cursor-pointer border border-purple-600 hover:border-purple-700"
                                >
                                    <Printer className="w-4 h-4 mr-1.5 text-white" />
                                    {selectedCount > 0 ? `Print Selected (${selectedCount})` : `Print All (${QueueOrders.length})`}
                                </Button>
                            </div>
                        ) : null}
                        rowSelection={RowSelection}
                        onRowSelectionChange={SetRowSelection}
                        defaultPageSize={999999}
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
                                const orderItems = selectedOrder.Items || selectedOrder.ImportOrderItems || [];
                                const hasUnmatchedItems = orderItems.some(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched') ;
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
                                                    <p className="font-bold text-sm">Action Required</p>
                                                    <p className="mt-1 text-amber-800 leading-relaxed">
                                                        One or more items in this order have no Seller SKU. Commission and Total Profit will remain RM 0.00 until matched.
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenSkuReviewModal(selectedOrder)}
                                                        className="mt-2.5 h-7 text-xs font-semibold border-amber-300 bg-white hover:bg-amber-100/50 text-amber-900 cursor-pointer"
                                                    >
                                                        SKU Review
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Key Metrics */}
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-none border">
                                            <div>
                                                <p className="text-gray-500 mb-1">Total Profit</p>
                                                <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedOrder.OrderProfit || selectedOrder.DisplayProfit)}</p>
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
                                                                        <div className="flex items-center space-x-1.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenSkuReviewModal(selectedOrder)}
                                                                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 cursor-pointer transition-colors"
                                                                            >
                                                                                Match Product
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenProductCreateModal(selectedOrder, item)}
                                                                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 cursor-pointer transition-colors"
                                                                            >
                                                                                + Create & Map
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {!isUnmatched && item.MatchStatus === 'ManualMatch' && (
                                                                        <div className="flex items-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={async () => {
                                                                                    if (window.confirm('Are you sure you want to reset this match?')) {
                                                                                        try {
                                                                                            await unresolveItem({ itemId: item.ItemID });
                                                                                            // Query invalidation handles the refresh
                                                                                        } catch (error) {
                                                                                            alert(error.message || 'Failed to reset match');
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                disabled={isUnresolving}
                                                                                className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-800 transition-colors shadow-sm disabled:opacity-50"
                                                                            >
                                                                                Reset Match
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="ml-4 text-right">
                                                                <div className="text-sm font-bold text-gray-900">x{item.Quantity}</div>
                                                                <div className="text-xs font-medium text-emerald-600 mt-0.5">{formatCurrency(item.Profit)}</div>
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



            <AWBPDFViewer
                url={viewAwbUrl}
                open={!!viewAwbUrl}
                onOpenChange={(open) => {
                    if (!open) setViewAwbUrl(null);
                }}
            />

            <ProductModal
                isOpen={IsProductModalOpen}
                onClose={() => {
                    SetIsProductModalOpen(false);
                    SetSkuReviewItem(null);
                }}
                product={null}
                prefilledName={SkuReviewItem?.ProductName || ''}
                onSuccess={handleProductModalSuccess}
            />

            <OrderMatchModal
                isOpen={!!MatchOrderModalData}
                onClose={() => SetMatchOrderModalData(null)}
                order={MatchOrderModalData}
                onOpenCreate={(item) => {
                    SetMatchOrderModalData(null);
                    SetSkuReviewItem(item);
                    SetIsProductModalOpen(true);
                }}
            />
        </div>
    );
}
