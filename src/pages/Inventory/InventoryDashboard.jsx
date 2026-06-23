import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Barcode, Boxes, ChevronDown, ChevronUp, ChevronsUpDown, Edit, MoreHorizontal, Package, PackagePlus, Plus, RefreshCw, Trash2, AlertTriangle, XCircle, Square, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { Input } from '@/components/ui/input';
import { useInventoryLogs, useInventoryProducts } from '@/hooks/useInventory';
import { calculateFinalPrices } from '@/hooks/usePricing';
import { useProducts } from '@/hooks/useProducts';
import { useSecretMode } from '@/hooks/useSecretMode';
import { ProductModal } from './ProductModal';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

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

const getProductPricing = (Product) => {
    const PricingObject = Product.ProductPricing;
    return Array.isArray(PricingObject) ? (PricingObject[0] || {}) : (PricingObject || {});
};

const getRRP = (Product) => {
    const Pricing = getProductPricing(Product);
    return Pricing.BasePrice ?? Product.Price ?? 0;
};

const SortableHeader = ({ column, children }) => (
    <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="-ml-4 h-8 data-[state=open]:bg-accent hover:bg-gray-100 text-gray-700"
    >
        {children}
        {column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-2 h-3.5 w-3.5 text-blue-600" />
        ) : column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-2 h-3.5 w-3.5 text-blue-600" />
        ) : (
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 text-gray-400 opacity-50" />
        )}
    </Button>
);

export function InventoryDashboard() {
    const { deleteProduct, updateProduct, bulkArchiveProducts, bulkDeleteProducts, forcePurgeProducts } = useProducts();

    const [ViewMode, setViewMode] = useState('Basic');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [bulkActionConfirm, setBulkActionConfirm] = useState(null);
    const [deleteVerification, setDeleteVerification] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const { isHGHMode } = useSecretMode();
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [showStats, setShowStats] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('Inventory');

    const { data: Products, isLoading, error, refetch, isRefetching } = useInventoryProducts();
    const { data: RecentLogs } = useInventoryLogs(null);

    const InventoryProducts = useMemo(() => Products || [], [Products]);

    const selectedProductIds = useMemo(() => {
        return Object.keys(rowSelection)
            .map(index => InventoryProducts[parseInt(index)]?.ProductID)
            .filter(Boolean);
    }, [rowSelection, InventoryProducts]);

    const executeBulkAction = async () => {
        if (!bulkActionConfirm || selectedProductIds.length === 0) return;
        
        try {
            if (bulkActionConfirm === 'archive') {
                await bulkArchiveProducts.mutateAsync(selectedProductIds);
            } else if (bulkActionConfirm === 'delete') {
                const productsToDelete = selectedProductIds.map(id => InventoryProducts.find(p => p.ProductID === id));
                const unsafeToHardDelete = productsToDelete.filter(p => Number(p.Stock || 0) > 0).map(p => p.ProductID);
                const safeToHardDelete = productsToDelete.filter(p => Number(p.Stock || 0) === 0).map(p => p.ProductID);

                if (safeToHardDelete.length > 0) {
                    await bulkDeleteProducts.mutateAsync(safeToHardDelete);
                }
                if (unsafeToHardDelete.length > 0) {
                    await bulkArchiveProducts.mutateAsync(unsafeToHardDelete);
                }
            } else if (bulkActionConfirm === 'force_delete') {
                if (deleteVerification !== 'DELETE') return;
                const productsToDelete = selectedProductIds.map(id => InventoryProducts.find(p => p.ProductID === id));
                await forcePurgeProducts.mutateAsync(productsToDelete);
            }
            setRowSelection({});
            setBulkActionConfirm(null);
            setDeleteVerification('');
        } catch (err) {
            console.error('Bulk action failed', err);
        }
    };

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
        const SelectColumn = {
            id: 'select',
            header: ({ table }) => (
                <div className="pl-4 pr-2">
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Select all"
                        className="translate-y-[2px]"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="pl-4 pr-2">
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                        className="translate-y-[2px]"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        };

        const NumberColumn = {
            id: 'RowNumber',
            header: '#',
            enableHiding: false,
            enableSorting: false,
            meta: { className: 'w-[56px] text-center text-gray-500' },
            cell: ({ row, table }) => {
                const { pageIndex, pageSize } = table.getState().pagination;
                const VisibleIndex = table.getRowModel().rows.findIndex(VisibleRow => VisibleRow.id === row.id);
                return pageIndex * pageSize + VisibleIndex + 1;
            },
        };

        const ImageColumn = {
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
        };

        const MasterSKUColumn = {
            accessorKey: 'MasterSKU',
            meta: { className: 'w-[180px]' },
            header: ({ column }) => <SortableHeader column={column}>Master SKU</SortableHeader>,
            cell: ({ row }) => (
                <span className="font-mono text-sm font-semibold text-gray-900 pl-2">
                    {row.original.MasterSKU || '-'}
                </span>
            ),
        };

        const BrandColumn = {
            accessorKey: 'Brand',
            meta: { className: 'w-[140px]' },
            header: ({ column }) => <SortableHeader column={column}>Brand</SortableHeader>,
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 font-medium">
                    {row.original.Brand || '-'}
                </span>
            ),
        };

        const CategoryColumn = {
            accessorKey: 'Category',
            meta: { className: 'w-[150px]' },
            header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 font-medium">
                    {row.original.Category || '-'}
                </span>
            ),
        };

        const ProductNameColumn = {
            accessorKey: 'ProductName',
            header: 'Product Name',
            meta: { className: 'min-w-[220px]' },
            cell: ({ row }) => (
                <span className="font-medium text-gray-900">{row.original.ProductName || '-'}</span>
            ),
        };

        const VariationColumn = {
            accessorKey: 'Variation',
            header: 'Variation',
            meta: { className: 'w-[110px]' },
            cell: ({ row }) => <span className="text-gray-500">{row.original.Variation || ''}</span>,
        };

        const SizeColumn = {
            accessorKey: 'Size',
            header: 'Size',
            meta: { className: 'w-[90px]' },
            cell: ({ row }) => <span className="text-gray-500">{row.original.Size || ''}</span>,
        };

        const BarcodeColumn = {
            accessorKey: 'Barcode',
            header: 'Barcode',
            meta: { className: 'w-[140px]' },
            cell: ({ row }) => row.original.Barcode || '-',
        };

        const QuantityColumn = {
            accessorKey: 'Stock',
            id: 'Quantity',
            header: 'Quantity',
            meta: { className: 'w-[100px] text-right' },
            cell: ({ row }) => {
                const Stock = Number(row.original.Stock || 0);
                return (
                    <div className="font-semibold text-gray-900 pr-4">
                        {Stock.toLocaleString('ms-MY')}
                    </div>
                );
            },
        };

        const AvailabilityColumn = {
            id: 'Availability',
            header: 'Availability',
            meta: { className: 'w-[120px]' },
            cell: ({ row }) => {
                const Stock = Number(row.original.Stock || 0);
                const Status = getStockStatus(Stock);
                return <Badge variant="outline" className={Status.ClassName}>{Status.Label}</Badge>;
            },
        };

        const MainCostPriceColumn = {
            id: 'MainCostPrice',
            header: 'Cost Price',
            meta: { className: 'w-[110px] text-right' },
            cell: ({ row }) => formatCurrency(isHGHMode ? row.original.CostPrice : row.original.FakeCostPrice),
        };

        const CostPriceColumn = {
            accessorKey: 'CostPrice',
            header: 'Cost Price',
            meta: { className: 'w-[110px] text-right' },
            cell: ({ row }) => formatCurrency(isHGHMode ? row.original.CostPrice : row.original.FakeCostPrice),
        };

        const StockistPriceColumn = {
            accessorKey: 'StockistPrice',
            header: 'Stockist Price',
            meta: { className: 'w-[130px] text-right' },
            cell: ({ row }) => formatCurrency(row.original.StockistPrice),
        };

        const RRPColumn = {
            id: 'RRP',
            header: 'RRP',
            meta: { className: 'w-[100px] text-right' },
            cell: ({ row }) => formatCurrency(getRRP(row.original)),
        };

        const RetailPriceColumn = {
            id: 'RetailPrice',
            header: 'Retail Price',
            meta: { className: 'w-[120px] text-right' },
            cell: ({ row }) => {
                const Pricing = getProductPricing(row.original);
                const { RetailPrice } = calculateFinalPrices(Pricing);
                return formatCurrency(RetailPrice);
            },
        };

        const WholesalePriceColumn = {
            id: 'WholesalePrice',
            header: 'Wholesale Price',
            meta: { className: 'w-[140px] text-right' },
            cell: ({ row }) => {
                const Pricing = getProductPricing(row.original);
                const { WholesalePrice } = calculateFinalPrices(Pricing);
                return formatCurrency(WholesalePrice);
            },
        };

        const AgentPriceColumn = {
            id: 'AgentPrice',
            header: 'Agent Price',
            meta: { className: 'w-[120px] text-right' },
            cell: ({ row }) => {
                const Pricing = getProductPricing(row.original);
                const { AgentPrice } = calculateFinalPrices(Pricing);
                return formatCurrency(AgentPrice);
            },
        };

        const SellerSKUColumn = {
            accessorKey: 'SellerSKU',
            header: 'Seller SKU',
            cell: ({ row }) => row.original.SellerSKU || '-',
        };

        const GTINColumn = {
            accessorKey: 'GTIN',
            header: 'GTIN',
            cell: ({ row }) => row.original.GTIN || '-',
        };

        const WeightColumn = {
            accessorKey: 'WeightG',
            header: 'Weight',
            cell: ({ row }) => row.original.WeightG ? `${row.original.WeightG}g` : '-',
        };

        const DimensionsColumn = {
            accessorKey: 'Dimensions',
            header: 'Dimensions',
            cell: ({ row }) => row.original.Dimensions || '-',
        };

        const PlatformDataColumn = {
            accessorKey: 'PlatformData',
            header: 'Platform Data',
            cell: ({ row }) => {
                const PlatformData = row.original.PlatformData || {};
                const Keys = Object.keys(PlatformData);

                if (Keys.length === 0) return '-';
                return (
                    <span className="text-xs text-gray-500">
                        {Keys.slice(0, 4).join(', ')}{Keys.length > 4 ? '...' : ''}
                    </span>
                );
            },
        };

        const ActionColumn = {
            id: 'Actions',
            header: () => <div className="w-[50px]">Action</div>,
            enableHiding: false,
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
                                onClick={() => setConfirmAction({ type: 'archive', product: row.original })}
                                className="cursor-pointer text-amber-600 focus:text-amber-700"
                            >
                                <Archive className="mr-2 h-4 w-4" />
                                <span>Archive Product</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setConfirmAction({ type: 'delete', product: row.original })}
                                className="cursor-pointer text-red-600 focus:text-red-700"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Product</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        };

        const BaseColumns = [
            NumberColumn,
            ImageColumn,
            MasterSKUColumn,
            BrandColumn,
            ProductNameColumn,
            VariationColumn,
            SizeColumn,
            BarcodeColumn,
            QuantityColumn,
            MainCostPriceColumn,
        ];

        const PricingColumns = [
            NumberColumn,
            ImageColumn,
            MasterSKUColumn,
            BrandColumn,
            ProductNameColumn,
            VariationColumn,
            SizeColumn,
            BarcodeColumn,
            QuantityColumn,
            CostPriceColumn,
            StockistPriceColumn,
            RRPColumn,
            RetailPriceColumn,
            WholesalePriceColumn,
            AgentPriceColumn,
        ];

        const ShowAllColumns = [
            NumberColumn,
            ImageColumn,
            MasterSKUColumn,
            BrandColumn,
            CategoryColumn,
            ProductNameColumn,
            VariationColumn,
            SizeColumn,
            BarcodeColumn,
            SellerSKUColumn,
            GTINColumn,
            QuantityColumn,
            AvailabilityColumn,
            CostPriceColumn,
            StockistPriceColumn,
            RRPColumn,
            RetailPriceColumn,
            WholesalePriceColumn,
            AgentPriceColumn,
            WeightColumn,
            DimensionsColumn,
            PlatformDataColumn,
        ];

        const VisibleColumns = ViewMode === 'All'
            ? ShowAllColumns
            : ViewMode === 'Detail'
                ? PricingColumns
                : BaseColumns;

        return [...(isSelectionMode ? [SelectColumn] : []), ...VisibleColumns, ActionColumn];
    }, [ViewMode, isSelectionMode, isHGHMode]);

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">
                Failed to load inventory data: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
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
            {!isExpanded && (
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Inventory Overview</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowStats(!showStats)} className="text-gray-500 hover:text-gray-900">
                        {showStats ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        {showStats ? 'Hide Stats' : 'Show Stats'}
                    </Button>
                </div>
            )}

            <div className={cn(
                'grid transition-all duration-300 ease-in-out',
                (showStats && !isExpanded) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
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

            {!isExpanded && (
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
            )}

            {activeTab === 'Inventory' && (
                <div className="rounded-xl border bg-white p-4 shadow-sm flex-1 flex flex-col min-h-0">
                    {isLoading ? (
                        <div className="py-12 text-center text-gray-500">Loading inventory...</div>
                    ) : (
                        <DataTable
                            columns={Columns}
                            data={InventoryProducts}
                            searchPlaceholder="Search"
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            actionElement={
                                <div className="flex items-center gap-2">
                                    {isSelectionMode ? (
                                        <>
                                            {Object.keys(rowSelection).length > 0 ? (
                                                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1 mr-4 animate-in fade-in zoom-in duration-200">
                                                    <span className="text-sm font-medium text-indigo-700 mr-2">
                                                        {Object.keys(rowSelection).length} selected
                                                    </span>
                                                    <Button size="sm" variant="outline" className="bg-white hover:bg-amber-50 hover:text-amber-700 border-amber-200 text-amber-600 h-7 text-xs" onClick={() => { setBulkActionConfirm('archive'); setDeleteVerification(''); }}>
                                                        Archive
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="bg-white hover:bg-red-50 hover:text-red-700 border-red-200 text-red-600 h-7 text-xs" onClick={() => { setBulkActionConfirm('delete'); setDeleteVerification(''); }}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500 mr-4 animate-in fade-in duration-200">
                                                    Select items...
                                                </span>
                                            )}
                                            <Button size="sm" variant="outline" className="text-gray-500" onClick={() => { setIsSelectionMode(false); setRowSelection({}); }}>
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <Button size="sm" variant="outline" className="h-9" onClick={() => setIsSelectionMode(true)}>
                                            <Square className="mr-2 h-4 w-4" />
                                            Select
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className={cn("h-9 px-3 bg-white ml-auto", isExpanded && "bg-indigo-50 border-indigo-200 text-indigo-700")}
                                        title={isExpanded ? "Collapse View" : "Expand View"}
                                    >
                                        {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                        <span className="ml-2 hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
                                    </Button>
                                    <div className="flex rounded-lg border bg-gray-100 p-1 w-[260px] h-9 items-center">
                                        {[
                                            { Label: 'Basic', Value: 'Basic' },
                                            { Label: 'Detail', Value: 'Detail' },
                                            { Label: 'All', Value: 'All' },
                                        ].map((Option) => (
                                            <Button
                                                key={Option.Value}
                                                variant={ViewMode === Option.Value ? 'default' : 'ghost'}
                                                className="flex-1 h-full text-xs shadow-none"
                                                onClick={() => setViewMode(Option.Value)}
                                            >
                                                {Option.Label}
                                            </Button>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => refetch()}
                                        disabled={isRefetching || isLoading}
                                        className="h-9 w-9 px-0 bg-white"
                                        title="Refresh Inventory"
                                    >
                                        <RefreshCw className={cn('h-4 w-4 text-gray-500', isRefetching && 'animate-spin text-indigo-500')} />
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
                                        <td className="px-4 py-3 text-gray-600">{Log.StockBefore} - {Log.StockAfter}</td>
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

            {modalOpen && (
                <ProductModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    product={selectedProduct}
                />
            )}

            <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) { setConfirmAction(null); setDeleteVerification(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className={confirmAction?.type === 'delete' || confirmAction?.type === 'force_delete' ? 'text-red-600' : 'text-amber-600'}>
                            {confirmAction?.type === 'archive' ? 'Archive Product' : 'Delete Product'}
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            {confirmAction?.type === 'archive' && (
                                <>Are you sure you want to archive "{confirmAction?.product?.ProductName}"? It will be hidden from the active inventory list.</>
                            )}
                            {confirmAction?.type === 'delete' && (
                                <div className="space-y-4">
                                    <p>Are you sure you want to delete "{confirmAction?.product?.ProductName}"?</p>
                                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
                                        <strong className="block mb-1 font-semibold flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-1.5" /> Referential Integrity:
                                        </strong>
                                        If this product has stock history, standard deletion will be blocked to protect the accounting ledger. You can choose to <strong>Archive</strong> it safely.
                                    </div>
                                </div>
                            )}
                            {confirmAction?.type === 'force_delete' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
                                        <strong className="block mb-1 font-semibold flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-1.5" /> Force Purge Warning:
                                        </strong>
                                        This will permanently destroy the product and cascade delete all its related pricing and stock logs. This action will be audited.
                                    </div>
                                    <div className="space-y-2 mt-4 text-gray-900">
                                        <label className="text-sm font-medium">Type <span className="font-bold text-red-600">DELETE</span> to confirm:</label>
                                        <Input 
                                            value={deleteVerification} 
                                            onChange={(e) => setDeleteVerification(e.target.value)} 
                                            className="border-red-300 focus-visible:ring-red-500"
                                            placeholder="DELETE"
                                        />
                                    </div>
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setConfirmAction(null); setDeleteVerification(''); }}>Cancel</Button>
                        
                        {confirmAction?.type === 'archive' && (
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={async () => {
                                await updateProduct.mutateAsync({ id: confirmAction.product.ProductID, updates: { IsActive: false } });
                                setConfirmAction(null);
                            }}>
                                Archive
                            </Button>
                        )}

                        {confirmAction?.type === 'delete' && (
                            <>
                                <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={async () => {
                                    await updateProduct.mutateAsync({ id: confirmAction.product.ProductID, updates: { IsActive: false } });
                                    setConfirmAction(null);
                                }}>
                                    Archive (Safe)
                                </Button>
                                <Button variant="destructive" onClick={async () => {
                                    try {
                                        await deleteProduct.mutateAsync(confirmAction.product.ProductID);
                                        setConfirmAction(null);
                                    } catch {
                                        // If standard delete fails due to constraint, suggest force delete
                                        setConfirmAction({ type: 'force_delete', product: confirmAction.product });
                                    }
                                }}>
                                    Delete
                                </Button>
                            </>
                        )}

                        {confirmAction?.type === 'force_delete' && (
                            <Button 
                                variant="destructive" 
                                disabled={deleteVerification !== 'DELETE'}
                                onClick={async () => {
                                    await forcePurgeProducts.mutateAsync([confirmAction.product]);
                                    setConfirmAction(null);
                                    setDeleteVerification('');
                                }}
                            >
                                Force Purge
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Bulk Action Dialog */}
            <Dialog open={!!bulkActionConfirm} onOpenChange={(open) => { if (!open) { setBulkActionConfirm(null); setDeleteVerification(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className={bulkActionConfirm === 'delete' || bulkActionConfirm === 'force_delete' ? 'text-red-600' : 'text-amber-600'}>
                            Confirm Bulk {bulkActionConfirm === 'archive' ? 'Archive' : 'Delete'}
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            You have selected {selectedProductIds.length} product(s).
                            {bulkActionConfirm === 'delete' && (
                                <div className="space-y-4 mt-4">
                                    <div className="p-3 bg-amber-50 text-amber-700 rounded-md text-sm border border-amber-100">
                                        <strong className="block mb-1 font-semibold flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-1.5" /> Referential Integrity (Safe Mode):
                                        </strong>
                                        Products with stock movement cannot be hard-deleted automatically. The system will <strong>Archive</strong> products with history, and <strong>Delete</strong> empty/test products.
                                    </div>
                                </div>
                            )}
                            {bulkActionConfirm === 'force_delete' && (
                                <div className="space-y-4 mt-4">
                                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
                                        <strong className="block mb-1 font-semibold flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-1.5" /> Force Purge Warning:
                                        </strong>
                                        This will permanently destroy ALL selected products and cascade delete all their related pricing and stock logs. This action will be audited.
                                    </div>
                                    <div className="space-y-2 text-gray-900">
                                        <label className="text-sm font-medium">Type <span className="font-bold text-red-600">DELETE</span> to confirm:</label>
                                        <Input 
                                            value={deleteVerification} 
                                            onChange={(e) => setDeleteVerification(e.target.value)} 
                                            className="border-red-300 focus-visible:ring-red-500"
                                            placeholder="DELETE"
                                        />
                                    </div>
                                </div>
                            )}
                            {bulkActionConfirm === 'archive' && (
                                <div className="mt-2 text-gray-600">
                                    Archived products will be hidden from the active inventory list but their ledger history remains intact.
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setBulkActionConfirm(null); setDeleteVerification(''); }}>Cancel</Button>
                        
                        {bulkActionConfirm === 'archive' && (
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={executeBulkAction}>
                                Confirm Archive
                            </Button>
                        )}

                        {bulkActionConfirm === 'delete' && (
                            <>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setBulkActionConfirm('force_delete')}>
                                    Force Purge
                                </Button>
                                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={executeBulkAction}>
                                    Safe Delete
                                </Button>
                            </>
                        )}

                        {bulkActionConfirm === 'force_delete' && (
                            <Button 
                                variant="destructive" 
                                disabled={deleteVerification !== 'DELETE'}
                                onClick={executeBulkAction}
                            >
                                Confirm Force Purge
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


