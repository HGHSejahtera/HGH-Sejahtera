import { useState, useMemo, useEffect } from 'react';
import { useOrderHistory } from '@/hooks/useOrderHistory';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';
import { SortOrders } from '@/services/pdf/AwbMergeService';
import { useAwbPrintStore } from '@/hooks/useAwbPrintStore';
import { ProductModal } from '@/pages/Inventory/ProductModal';
import { OrderMatchModal } from '@/pages/Orders/OrderMatchModal';
import { useProductMatcher } from '@/hooks/useProductMatcher';

import { Clock, ChevronRight, Package, X, Printer, AlertTriangle, Calendar, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, ShieldAlert, RotateCcw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
    const [FilterAccount, SetFilterAccount] = useState('All');
    const [FilterMonth, SetFilterMonth] = useState(String(new Date().getMonth()));
    const [DateRange, SetDateRange] = useState({ from: '', to: '' });
    const [RowSelection, SetRowSelection] = useState({});

    const handleTabChange = (tab) => {
        SetActiveTab(tab);
        localStorage.setItem('HGH_Orders_ActiveTab', tab);
        SetRowSelection({});
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

    const handleHistorySortChange = (value) => {
        SetHistorySortBy(value);
        SetHeaderSort({ column: null, direction: 'asc' });
    };

    // Reset selection when changing tabs or filters
    useEffect(() => {
        queueMicrotask(() => {
            SetRowSelection({});
        });
    }, [ActiveTab, FilterAgent, FilterPlatform, FilterAccount, QueueSortBy, HistorySortBy, HeaderSort.column, HeaderSort.direction, StatusFilterPill, FilterMonth, DateRange.from, DateRange.to]);

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
        if (FilterAgent !== 'All') Unprinted = Unprinted.filter(o => o.AgentName === FilterAgent);
        if (FilterPlatform !== 'All') Unprinted = Unprinted.filter(o => o.Platform === FilterPlatform);
        if (FilterAccount !== 'All') Unprinted = Unprinted.filter(o => o.AccountName === FilterAccount);
        return SortOrders(Unprinted, QueueSortBy);
    }, [orders, QueueSortBy, FilterAgent, FilterPlatform, FilterAccount]);

    const CompleteOrders = useMemo(() => {
        let Printed = orders.filter(Order => Order.IsPrinted);
        if (FilterAgent !== 'All') Printed = Printed.filter(o => o.AgentName === FilterAgent);
        if (FilterPlatform !== 'All') Printed = Printed.filter(o => o.Platform === FilterPlatform);
        if (FilterAccount !== 'All') Printed = Printed.filter(o => o.AccountName === FilterAccount);
        const hasDateRange = Boolean(DateRange.from || DateRange.to);
        if (!hasDateRange && FilterMonth !== 'All') {
            Printed = Printed.filter(o => new Date(o.CreatedAt || 0).getMonth() === Number(FilterMonth));
        }
        if (DateRange.from) {
            const FromTime = new Date(`${DateRange.from}T00:00:00`).getTime();
            Printed = Printed.filter(o => new Date(o.CreatedAt || 0).getTime() >= FromTime);
        }
        if (DateRange.to) {
            const ToTime = new Date(`${DateRange.to}T23:59:59`).getTime();
            Printed = Printed.filter(o => new Date(o.CreatedAt || 0).getTime() <= ToTime);
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
    }, [orders, HistorySortBy, HeaderSort.column, HeaderSort.direction, FilterAgent, FilterPlatform, FilterAccount, FilterMonth, DateRange.from, DateRange.to]);

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

        if (FilterAgent !== 'All') filtered = filtered.filter(o => o.AgentName === FilterAgent);
        if (FilterPlatform !== 'All') filtered = filtered.filter(o => o.Platform === FilterPlatform);
        if (FilterAccount !== 'All') filtered = filtered.filter(o => o.AccountName === FilterAccount);

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
    }, [orders, HeaderSort.column, HeaderSort.direction, StatusFilterPill, FilterAgent, FilterPlatform, FilterAccount]);

    const DisplayOrders = ActiveTab === 'Queue' ? QueueOrders : ActiveTab === 'Complete' ? CompleteOrders : StatusOrders;

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
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    {formatCurrency(row.original.DisplayProfit)}
                </div>
            )
        },
        {
            header: () => <div className="text-center">Review</div>,
            id: 'review',
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
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
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
            cell: ({ row }) => (
                <div className="flex justify-center items-center px-2">
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="border-gray-300"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
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
            header: () => <div className="text-right">Profit</div>,
            accessorKey: 'DisplayProfit',
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
                <Select value={QueueSortBy} onValueChange={SetQueueSortBy}>
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
                variant="default"
                size="sm"
                onClick={HandlePrintAll}
                disabled={IsPrinting || QueueOrders.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-md h-8 px-3.5 shadow-sm transition-all cursor-pointer ml-2 border border-purple-600 hover:border-purple-700"
            >
                <Printer className="w-3.5 h-3.5 mr-1.5 text-white" />
                {selectedCount > 0 ? `Print Selected (${selectedCount})` : `Print All (${QueueOrders.length})`}
            </Button>
        </div>
    ) : null;

    const CompleteActionElement = ActiveTab === 'Complete' ? (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Platform:</span>
                <Select value={FilterPlatform} onValueChange={SetFilterPlatform}>
                    <SelectTrigger className="h-8 w-[100px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniquePlatforms.map(platform => (
                            <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Account:</span>
                <Select value={FilterAccount} onValueChange={SetFilterAccount}>
                    <SelectTrigger className="h-8 w-[100px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniqueAccounts.map(account => (
                            <SelectItem key={account} value={account}>{account}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Agent:</span>
                <Select value={FilterAgent} onValueChange={SetFilterAgent}>
                    <SelectTrigger className="h-8 w-[100px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {UniqueAgents.map(agent => (
                            <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Month:</span>
                <Select value={FilterMonth} onValueChange={SetFilterMonth}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 max-h-[260px]">
                        {MonthOptions.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Airbnb-Style Date Range Picker */}
            <div className="flex items-center ml-1">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "h-8 px-2.5 rounded-md border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium shadow-xs transition-colors flex items-center gap-2 cursor-pointer",
                                (DateRange.from || DateRange.to) ? "border-indigo-600 text-indigo-600 bg-indigo-50/60 font-semibold" : "text-gray-700"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {DateRange.from && DateRange.to
                                ? `${new Date(DateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(DateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : DateRange.from
                                    ? `${new Date(DateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — Select To Date`
                                    : "Select Dates"}
                            {(DateRange.from || DateRange.to) && (
                                <span
                                    className="p-0.5 rounded-md hover:bg-indigo-200/60 text-indigo-500 transition-colors ml-0.5 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); SetDateRange({ from: '', to: '' }); }}
                                    title="Clear dates"
                                >
                                    <X className="w-3 h-3" />
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-[360px] p-4 rounded-md shadow-lg border border-gray-200 bg-white">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Select Date Range</h4>
                                <p className="text-xs text-gray-500">Filter completed order history by exact dates.</p>
                            </div>

                            {/* Dual From / To Inputs */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 border border-gray-200 rounded-md">
                                <div className="p-2 border-r border-gray-200">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">FROM</label>
                                    <input
                                        type="date"
                                        value={DateRange.from}
                                        onChange={(e) => SetDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                                <div className="p-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TO</label>
                                    <input
                                        type="date"
                                        value={DateRange.to}
                                        onChange={(e) => SetDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Preset Shortcuts */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quick shortcuts</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            SetDateRange({ from: today, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Today
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const today = new Date();
                                            const last7 = new Date();
                                            last7.setDate(today.getDate() - 6);
                                            SetDateRange({
                                                from: last7.toISOString().split('T')[0],
                                                to: today.toISOString().split('T')[0]
                                            });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Last 7 Days
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                                            const today = now.toISOString().split('T')[0];
                                            SetDateRange({ from: firstDay, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        This Month
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => SetDateRange({ from: '', to: '' })}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer ml-auto"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Sort By:</span>
                <Select value={HistorySortBy} onValueChange={SetHistorySortBy}>
                    <SelectTrigger className="h-8 w-[140px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Brand">Brand</SelectItem>
                        <SelectItem value="DateOldest">Date (Oldest)</SelectItem>
                        <SelectItem value="DateNewest">Date (Newest)</SelectItem>
                        <SelectItem value="MonthJanDec">Month (Jan - Dec)</SelectItem>
                        <SelectItem value="MonthDecJan">Month (Dec - Jan)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    ) : null;

    const StatusActionElement = null;

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200">
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

            {ActiveTab === 'Status' && (
                <div className="bg-white border rounded-none p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-4 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => SetStatusFilterPill('All')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5 select-none",
                                    StatusFilterPill === 'All'
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                )}
                            >
                                All Problem
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    StatusFilterPill === 'All' ? "bg-indigo-700 text-white" : "bg-gray-100 text-gray-700"
                                )}>
                                    {statusCounts.total}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => SetStatusFilterPill('SKUReview')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5 select-none",
                                    StatusFilterPill === 'SKUReview'
                                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : "bg-white text-amber-800 border-amber-300 hover:bg-amber-50"
                                )}
                            >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                SKU Review
                                {statusCounts.skuReview > 0 && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                        StatusFilterPill === 'SKUReview' ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
                                    )}>
                                        {statusCounts.skuReview}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => SetStatusFilterPill('MissingAWB')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5 select-none",
                                    StatusFilterPill === 'MissingAWB'
                                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                        : "bg-white text-rose-800 border-rose-300 hover:bg-rose-50"
                                )}
                            >
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                AWB Action
                                {statusCounts.missingAwb > 0 && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                        StatusFilterPill === 'MissingAWB' ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-800"
                                    )}>
                                        {statusCounts.missingAwb}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => SetStatusFilterPill('Ready')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border shadow-2xs flex items-center gap-1.5 select-none",
                                    StatusFilterPill === 'Ready'
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                        : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                                )}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Resolve
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap ml-auto">
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
                            <div className="flex items-center gap-1 text-xs ml-1">
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
                            <div className="flex items-center gap-1 text-xs ml-1">
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
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-none shadow-xs border overflow-hidden">
                <div className="p-4">
                    <DataTable
                        key={ActiveTab}
                        columns={ActiveTab === 'Queue' ? queueColumns : ActiveTab === 'Complete' ? completeColumns : statusColumns}
                        data={DisplayOrders}
                        isLoading={isLoading}
                        searchPlaceholder="Search"
                        actionElement={ActiveTab === 'Queue' ? QueueActionElement : ActiveTab === 'Complete' ? CompleteActionElement : StatusActionElement}
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
                                                                                    if (window.confirm('Are you sure you want to un-match this item?')) {
                                                                                        try {
                                                                                            await unresolveItem({ itemId: item.ItemID });
                                                                                            // Query invalidation handles the refresh
                                                                                        } catch (error) {
                                                                                            alert(error.message || 'Failed to un-match item');
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                disabled={isUnresolving}
                                                                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 cursor-pointer transition-colors disabled:opacity-50"
                                                                            >
                                                                                Un-match
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



            <AwbPdfViewer
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
