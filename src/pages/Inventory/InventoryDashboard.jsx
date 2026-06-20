import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Package, PackagePlus, AlertTriangle, XCircle, Barcode, Plus, Edit, ChevronDown, ChevronUp, MoreHorizontal, Trash2, Archive, RefreshCw, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { useInventoryLogs, useInventoryProducts } from '@/hooks/useInventory';
import { calculateFinalPrices } from '@/hooks/usePricing';
import { useProducts } from '@/hooks/useProducts';
import { ProductModal } from './ProductModal';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const formatCurrency = (Value) => new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
}).format(Number(Value || 0));

const getStockStatus = (Stock) => {
    if (Stock <= 0) {
        return {
            Label: 'Out of Stock',
            ClassName: 'bg-red-50 text-red-700 border-red-100',
        };
    }

    if (Stock <= 10) {
        return {
            Label: 'Low Stock',
            ClassName: 'bg-yellow-50 text-yellow-700 border-yellow-100',
        };
    }

    return {
        Label: 'In Stock',
        ClassName: 'bg-green-50 text-green-700 border-green-100',
    };
};

export function InventoryDashboard() {
    const { deleteProduct, updateProduct } = useProducts();

    const [ViewMode, setViewMode] = useState('Main');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [showStats, setShowStats] = useState(false);
    const [activeTab, setActiveTab] = useState('Inventory');
    
    const { data: Products, isLoading, error, refetch, isRefetching } = useInventoryProducts();
    const { data: RecentLogs } = useInventoryLogs(null);

    const InventoryProducts = useMemo(() => Products || [], [Products]);
    const IsAllView = ViewMode === 'All';

    const Summary = useMemo(() => {
        const TotalUnits = InventoryProducts.reduce((Total, Product) => Total + Number(Product.Stock || 0), 0);
        const LowStockItems = InventoryProducts.filter(Product => Number(Product.Stock || 0) > 0 && Number(Product.Stock || 0) <= 10).length;
        const OutOfStockItems = InventoryProducts.filter(Product => Number(Product.Stock || 0) <= 0).length;

        return {
            TotalSKUs: InventoryProducts.length,
            TotalUnits,
            LowStockItems,
            OutOfStockItems,
        };
    }, [InventoryProducts]);

    const Columns = useMemo(() => {
        const MainColumns = [
            {
                id: 'Image',
                header: 'Image',
                meta: { className: 'w-[80px]' },
                cell: ({ row }) => {
                    const ImageURL = row.original.ImageURL;

                    return (
                        <div className="h-12 w-12 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                            {ImageURL ? (
                                <img src={ImageURL} alt={row.original.ProductName} className="h-full w-full object-cover" />
                            ) : (
                                <Package className="h-5 w-5 text-gray-400" />
                            )}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'MasterSKU',
                meta: { className: 'w-[200px]' },
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4 h-8 data-[state=open]:bg-accent hover:bg-gray-100 text-gray-700"
                    >
                        Master SKU
                        {column.getIsSorted() === "desc" ? (
                            <ChevronDown className="ml-2 h-3.5 w-3.5 text-blue-600" />
                        ) : column.getIsSorted() === "asc" ? (
                            <ChevronUp className="ml-2 h-3.5 w-3.5 text-blue-600" />
                        ) : (
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 text-gray-400 opacity-50" />
                        )}
                    </Button>
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-sm font-semibold text-gray-900 pl-2">
                        {row.original.MasterSKU || '-'}
                    </span>
                ),
            },
            {
                accessorKey: 'Brand',
                meta: { className: 'w-[140px]' },
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="-ml-4 h-8 data-[state=open]:bg-accent hover:bg-gray-100 text-gray-700"
                    >
                        Brand
                        {column.getIsSorted() === "desc" ? (
                            <ChevronDown className="ml-2 h-3.5 w-3.5 text-blue-600" />
                        ) : column.getIsSorted() === "asc" ? (
                            <ChevronUp className="ml-2 h-3.5 w-3.5 text-blue-600" />
                        ) : (
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 text-gray-400 opacity-50" />
                        )}
                    </Button>
                ),
                cell: ({ row }) => (
                    <span className="text-sm text-gray-500 font-medium">
                        {row.original.Brand || '-'}
                    </span>
                ),
            },
            {
                accessorKey: 'ProductName',
                header: 'Product',
                meta: { className: 'min-w-[200px]' },
                cell: ({ row }) => (
                    <span className="font-medium text-gray-900">{row.original.ProductName || '-'}</span>
                ),
            },
            {
                accessorKey: 'Variation',
                header: 'Variation',
                meta: { className: 'w-[100px]' },
                cell: ({ row }) => (
                    <span className="text-gray-500">{row.original.Variation || ''}</span>
                ),
            },
            {
                accessorKey: 'Size',
                header: 'Size',
                meta: { className: 'w-[80px]' },
                cell: ({ row }) => (
                    <span className="text-gray-500">{row.original.Size || ''}</span>
                ),
            },
            {
                accessorKey: 'Barcode',
                meta: { className: 'w-[140px]' },
                header: () => (
                    <div className="group relative inline-block cursor-help">
                        Barcode
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden w-max bg-gray-900 text-white text-xs px-2 py-1 rounded group-hover:block z-50">
                            Seller SKU · GTIN
                        </div>
                    </div>
                ),
                cell: ({ row }) => row.original.Barcode || '-',
            },
            {
                accessorKey: 'Stock',
                id: 'Quantity',
                header: 'Quantity',
                meta: { className: 'w-[90px] text-right' },
                cell: ({ row }) => {
                    const Stock = Number(row.original.Stock || 0);
                    return (
                        <div className="font-semibold text-gray-900 pr-4">
                            {Stock.toLocaleString('ms-MY')}
                        </div>
                    );
                },
            },
            {
                id: 'Availability',
                header: 'Availability',
                meta: { className: 'w-[110px]' },
                cell: ({ row }) => {
                    const Stock = Number(row.original.Stock || 0);
                    const Status = getStockStatus(Stock);
                    return (
                        <Badge variant="outline" className={Status.ClassName}>
                            {Status.Label}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: 'CostPrice',
                header: 'Cost Price',
                meta: { className: 'w-[100px] text-right' },
                cell: ({ row }) => formatCurrency(row.original.CostPrice),
            },
            {
                id: 'Retail',
                header: 'Retail Price',
                meta: { className: 'w-[100px] text-right' },
                cell: ({ row }) => {
                    const pricingObj = row.original.ProductPricing;
                    const pricing = Array.isArray(pricingObj) ? (pricingObj[0] || {}) : (pricingObj || {});
                    const { RetailPrice } = calculateFinalPrices(pricing);
                    return formatCurrency(RetailPrice || row.original.Price);
                },
            },
            {
                id: 'Agent',
                header: 'Agent Price',
                meta: { className: 'w-[100px] text-right' },
                cell: ({ row }) => {
                    const pricingObj = row.original.ProductPricing;
                    const pricing = Array.isArray(pricingObj) ? (pricingObj[0] || {}) : (pricingObj || {});
                    const { AgentPrice } = calculateFinalPrices(pricing);
                    return formatCurrency(AgentPrice);
                },
            },
        ];

        const AllColumns = [
            {
                accessorKey: 'SellerSKU',
                header: 'Seller SKU',
                cell: ({ row }) => row.original.SellerSKU || '-',
            },
            {
                accessorKey: 'GTIN',
                header: 'GTIN',
                cell: ({ row }) => row.original.GTIN || '-',
            },
            {
                id: 'Wholesale',
                header: 'Wholesale Price',
                cell: ({ row }) => {
                    const pricingObj = row.original.ProductPricing;
                    const pricing = Array.isArray(pricingObj) ? (pricingObj[0] || {}) : (pricingObj || {});
                    const { WholesalePrice } = calculateFinalPrices(pricing);
                    return formatCurrency(WholesalePrice);
                },
            },
            {
                accessorKey: 'WeightG',
                header: 'Weight',
                cell: ({ row }) => row.original.WeightG ? `${row.original.WeightG}g` : '-',
            },
            {
                accessorKey: 'Dimensions',
                header: 'Dimensions',
                cell: ({ row }) => row.original.Dimensions || '-',
            },
            {
                accessorKey: 'PlatformData',
                header: 'Platform Data',
                cell: ({ row }) => {
                    const PlatformData = row.original.PlatformData || {};
                    const Keys = Object.keys(PlatformData);

                    if (Keys.length === 0) return '-';
                    return (
                        <span className="text-xs text-gray-500">
                            {Keys.slice(0, 4).join(', ')}{Keys.length > 4 ? '…' : ''}
                        </span>
                    );
                },
            },
        ];

        return [
            ...MainColumns,
            ...(IsAllView ? AllColumns : []),
            {
                id: 'Actions',
                header: () => <div className="w-[50px]">Action</div>,
                cell: ({ row }) => (
                    <div className="flex items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 data-[state=open]:bg-gray-100"
                                >
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => {
                                        setSelectedProduct(row.original);
                                        setModalOpen(true);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Edit className="mr-2 h-4 w-4 text-gray-500" />
                                    <span>Edit Details</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={`/inventory/stock-in?productId=${row.original.ProductID}`} className="cursor-pointer">
                                        <PackagePlus className="mr-2 h-4 w-4 text-indigo-500" />
                                        <span>Stock-In</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    onClick={() => {
                                        setConfirmAction({ type: 'archive', product: row.original });
                                    }}
                                    className="cursor-pointer text-amber-600 focus:text-amber-700"
                                >
                                    <Archive className="mr-2 h-4 w-4" />
                                    <span>Archive Product</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    onClick={() => {
                                        setConfirmAction({ type: 'delete', product: row.original });
                                    }}
                                    className="cursor-pointer text-red-600 focus:text-red-700"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete Product</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
            },
        ];
    }, [IsAllView]);

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">
                Failed to load inventory data: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Inventory Dashboard</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" asChild className="h-10 w-36">
                        <Link to="/barcode">
                            <Barcode className="mr-2 h-4 w-4" />
                            Barcodes
                        </Link>
                    </Button>
                    <Button className="h-10 w-36" asChild>
                        <Link to="/inventory/stock-in">
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Stock-In
                        </Link>
                    </Button>
                    <Button className="h-10 w-36" onClick={() => { setSelectedProduct(null); setModalOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Inventory Overview</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowStats(!showStats)} className="text-gray-500 hover:text-gray-900">
                    {showStats ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {showStats ? 'Hide Stats' : 'Show Stats'}
                </Button>
            </div>

            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                showStats ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="grid gap-4 md:grid-cols-4 pb-4">
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-500">Total SKUs</p>
                                <Boxes className="h-5 w-5 text-indigo-500" />
                            </div>
                            <p className="mt-3 text-2xl font-bold">{Summary.TotalSKUs.toLocaleString('ms-MY')}</p>
                        </div>
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-500">Total Units</p>
                                <Package className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="mt-3 text-2xl font-bold">{Summary.TotalUnits.toLocaleString('ms-MY')}</p>
                        </div>
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-500">Low Stock</p>
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            </div>
                            <p className="mt-3 text-2xl font-bold">{Summary.LowStockItems.toLocaleString('ms-MY')}</p>
                        </div>
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-500">Out of Stock</p>
                                <XCircle className="h-5 w-5 text-red-500" />
                            </div>
                            <p className="mt-3 text-2xl font-bold">{Summary.OutOfStockItems.toLocaleString('ms-MY')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {['Inventory', 'Stock Logs'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                            `}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'Inventory' && (
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                    {isLoading ? (
                        <div className="py-12 text-center text-gray-500">Loading inventory...</div>
                    ) : (
                        <DataTable
                            columns={Columns}
                            data={InventoryProducts}
                            searchPlaceholder="Search"
                            actionElement={
                                <div className="flex items-center gap-2">
                                    <div className="flex rounded-lg border bg-gray-100 p-1 w-[140px]">
                                        <Button
                                            variant={ViewMode === 'Main' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('Main')}
                                            className="flex-1"
                                        >
                                            Main
                                        </Button>
                                        <Button
                                            variant={ViewMode === 'All' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('All')}
                                            className="flex-1"
                                        >
                                            All
                                        </Button>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => refetch()}
                                        disabled={isRefetching || isLoading}
                                        className="h-9 w-9 px-0 bg-white"
                                        title="Refresh Inventory"
                                    >
                                        <RefreshCw className={cn("h-4 w-4 text-gray-500", isRefetching && "animate-spin text-indigo-500")} />
                                    </Button>
                                </div>
                            }
                        />
                    )}
                </div>
            )}

            {activeTab === 'Stock Logs' && (
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="mb-4">
                        <h3 className="font-semibold text-gray-900">Recent Stock Movements</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Time</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Quantity</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Stock</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Reference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {(RecentLogs || []).slice(0, 10).map((Log) => (
                                    <tr key={Log.LogID}>
                                        <td className="px-4 py-3 text-gray-500">{new Date(Log.Timestamp).toLocaleString('en-GB', { hour12: true }).toUpperCase()}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">{Log.Products?.ProductName || '-'}</p>
                                            <p className="text-xs text-gray-500">{Log.Products?.MasterSKU || '-'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">{Log.Type}</Badge>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">{Log.Quantity}</td>
                                        <td className="px-4 py-3 text-gray-600">{Log.StockBefore} → {Log.StockAfter}</td>
                                        <td className="px-4 py-3 text-gray-500">{Log.Reference || '-'}</td>
                                    </tr>
                                ))}
                                {(RecentLogs || []).length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                            No stock movement yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* Product Modal for Add/Edit */}
            {modalOpen && (
                <ProductModal 
                    isOpen={modalOpen} 
                    onClose={() => setModalOpen(false)} 
                    product={selectedProduct} 
                />
            )}

            {/* Confirmation Dialog for Delete/Archive */}
            <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {confirmAction?.type === 'delete' ? 'Delete Product' : 'Archive Product'}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmAction?.type === 'delete' 
                                ? `Are you sure you want to permanently delete "${confirmAction?.product?.ProductName}"? This action cannot be undone.` 
                                : `Are you sure you want to archive "${confirmAction?.product?.ProductName}"? It will be hidden from the active inventory list.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                        <Button 
                            variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
                            className={confirmAction?.type === 'archive' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                            onClick={async () => {
                                try {
                                    if (confirmAction?.type === 'delete') {
                                        await deleteProduct.mutateAsync(confirmAction.product.ProductID);
                                    } else {
                                        await updateProduct.mutateAsync({ id: confirmAction.product.ProductID, updates: { IsActive: false } });
                                    }
                                    setConfirmAction(null);
                                } catch {
                                    alert(`Failed to ${confirmAction?.type} product. It might be tied to existing stock logs.`);
                                }
                            }}
                        >
                            {confirmAction?.type === 'delete' ? 'Delete' : 'Archive'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
