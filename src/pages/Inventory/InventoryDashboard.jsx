import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Barcode, Boxes, ChevronDown, ChevronUp, ChevronsUpDown, Edit, MoreHorizontal, Package, PackagePlus, Plus, RefreshCw, Trash2, AlertTriangle, XCircle, Square, Maximize, Minimize, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
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
    DropdownMenuCheckboxItem,
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

    const [exportColumns, setExportColumns] = useState({
        masterSKU: true,
        barcode: true,
        productName: true,
        category: true,
        categoryID: false,
        stock: true,
        costPrice: true,
        stockistPrice: false,
        retailPrice: true,
        wholesalePrice: false,
        agentPrice: false,
        weight: false,
        dimensions: false,
    });

    const [ExpandedImage, SetExpandedImage] = useState(null);

    const [tableColumnVisibility, setTableColumnVisibility] = useState(() => {
        const base = ['RowNumber', 'Image', 'MasterSKU', 'Brand', 'CategoryName', 'ProductName', 'Variation', 'Size', 'Barcode', 'Quantity', 'MainCostPrice'];
        const all = ['RowNumber', 'Image', 'MasterSKU', 'Brand', 'CategoryName', 'CategoryID', 'ProductName', 'Variation', 'Size', 'Barcode', 'SellerSKU', 'GTIN', 'Quantity', 'Availability', 'CostPrice', 'StockistPrice', 'RRP', 'RetailPrice', 'WholesalePrice', 'AgentPrice', 'WeightG', 'Dimensions', 'PlatformData'];
        const visibility = {};
        all.forEach(id => {
            visibility[id] = base.includes(id);
        });
        visibility['Actions'] = true;
        visibility['select'] = true;
        return visibility;
    });

    const modeColumns = useMemo(() => {
        const base = ['RowNumber', 'Image', 'MasterSKU', 'Brand', 'CategoryName', 'ProductName', 'Variation', 'Size', 'Barcode', 'Quantity', 'MainCostPrice'];
        const pricing = ['RowNumber', 'Image', 'MasterSKU', 'Brand', 'CategoryName', 'ProductName', 'Variation', 'Size', 'Barcode', 'Quantity', 'CostPrice', 'StockistPrice', 'RRP', 'RetailPrice', 'WholesalePrice', 'AgentPrice'];
        const all = ['RowNumber', 'Image', 'MasterSKU', 'Brand', 'CategoryName', 'CategoryID', 'ProductName', 'Variation', 'Size', 'Barcode', 'SellerSKU', 'GTIN', 'Quantity', 'Availability', 'CostPrice', 'StockistPrice', 'RRP', 'RetailPrice', 'WholesalePrice', 'AgentPrice', 'WeightG', 'Dimensions', 'PlatformData'];
        
        return { Basic: base, Detail: pricing, All: all };
    }, []);

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        const targetCols = modeColumns[mode];
        const visibility = {};
        modeColumns.All.forEach(id => {
            visibility[id] = targetCols.includes(id);
        });
        visibility['Actions'] = true;
        visibility['select'] = true;
        setTableColumnVisibility(visibility);
    };

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

    const handleExportExcel = () => {
        const Headers = [];
        if (exportColumns.masterSKU) Headers.push('Master SKU');
        if (exportColumns.barcode) Headers.push('Barcode');
        if (exportColumns.productName) Headers.push('Product Name');
        if (exportColumns.category) Headers.push('Category Name');
        if (exportColumns.categoryID) Headers.push('Category ID');
        if (exportColumns.stock) Headers.push('Current Stock');
        if (exportColumns.costPrice) Headers.push('Cost Price');
        if (exportColumns.stockistPrice) Headers.push('Stockist Price');
        if (exportColumns.retailPrice) Headers.push('Retail Price');
        if (exportColumns.wholesalePrice) Headers.push('Wholesale Price');
        if (exportColumns.agentPrice) Headers.push('Agent Price');
        if (exportColumns.weight) Headers.push('Weight (g)');
        if (exportColumns.dimensions) Headers.push('Dimensions');
        if (exportColumns.platformData) Headers.push('Platform Data');

        const aoaData = [];
        
        // Row 0: Title
        const titleRow = Array(Headers.length).fill('');
        titleRow[0] = 'HGH Sejahtera Inventory';
        aoaData.push(titleRow);

        // Row 1: Headers
        aoaData.push(Headers);

        // Row 2+: Data
        InventoryProducts.forEach((Product) => {
            const Pricing = getProductPricing(Product);
            const formattedName = [Product.Brand, Product.ProductName, Product.Variation, Product.Size]
                .filter(Boolean)
                .join(' ')
                .trim();
            
            const row = [];
            Headers.forEach(header => {
                if (header === 'Master SKU') row.push(Product.MasterSKU || '');
                else if (header === 'Barcode') row.push(Product.Barcode || '');
                else if (header === 'Product Name') row.push(formattedName);
                else if (header === 'Category Name') row.push(Product.CategoryName || '');
                else if (header === 'Category ID') row.push(Product.CategoryID || '');
                else if (header === 'Current Stock') row.push(Product.Stock || 0);
                else if (header === 'Cost Price') row.push(Product.CostPrice || 0);
                else if (header === 'Stockist Price') row.push(Product.StockistPrice || 0);
                else if (header === 'Retail Price') row.push(Pricing.RetailRule || 0);
                else if (header === 'Wholesale Price') row.push(Pricing.WholesaleRule || 0);
                else if (header === 'Agent Price') row.push(Pricing.AgentMarkup || 0);
                else if (header === 'Weight (g)') row.push(Product.WeightG || '');
                else if (header === 'Dimensions') row.push(Product.Dimensions || '');
                else if (header === 'Platform Data') row.push(Product.PlatformData ? JSON.stringify(Product.PlatformData) : '');
            });
            aoaData.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
        
        // Merges for Title
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: Headers.length > 0 ? Headers.length - 1 : 0 } }
        ];

        // Row heights
        worksheet['!rows'] = [
            { hpt: 31.5 }, // Title row
            { hpt: 25 }    // Header row
        ];

        // Styles
        const titleStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, name: 'Arial', sz: 14 },
            fill: { fgColor: { rgb: "1F3864" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, name: 'Arial', sz: 11 },
            fill: { fgColor: { rgb: "2F5496" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "1F3864" } },
                bottom: { style: "thin", color: { rgb: "1F3864" } },
                left: { style: "thin", color: { rgb: "1F3864" } },
                right: { style: "thin", color: { rgb: "1F3864" } }
            }
        };

        const cellStyle = {
            font: { name: 'Arial', sz: 10, color: { rgb: "000000" } },
            alignment: { vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "E5E7EB" } },
                bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                left: { style: "thin", color: { rgb: "E5E7EB" } },
                right: { style: "thin", color: { rgb: "E5E7EB" } }
            }
        };

        const numberStyle = {
            ...cellStyle,
            alignment: { horizontal: "right", vertical: "center" },
            numFmt: "#,##0.00"
        };

        const stockStyle = {
            ...cellStyle,
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true, name: 'Arial', sz: 10, color: { rgb: "000000" } }
        };

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const colWidths = [];

        let barcodeColIndex = -1;
        let skuColIndex = -1;

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ c: C, r: R });
                const cell = worksheet[address];
                
                if (!cell) continue;

                if (R === 0) {
                    if (C === 0) cell.s = titleStyle;
                } else if (R === 1) {
                    if (cell.v === 'Barcode') barcodeColIndex = C;
                    if (cell.v === 'Master SKU') skuColIndex = C;
                    
                    cell.s = headerStyle;
                    
                    if (cell.v === 'Product Name') {
                        colWidths[C] = { wpx: 600 };
                    } else {
                        const len = cell.v ? cell.v.toString().length : 0;
                        colWidths[C] = { wch: Math.max(15, len + 5) };
                    }
                } else {
                    if (!colWidths[C]) colWidths[C] = { wch: 10 };
                    if (!colWidths[C].wpx) {
                        const cellContentLength = cell.v ? cell.v.toString().length : 0;
                        colWidths[C].wch = Math.max(colWidths[C].wch || 10, cellContentLength + 3);
                    }

                    if (C === barcodeColIndex || C === skuColIndex) {
                        cell.t = 's';
                        cell.s = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" }, font: { name: 'Consolas', sz: 10, color: { rgb: "000000" } } };
                    } 
                    else if (typeof cell.v === 'number') {
                        const headerAddress = XLSX.utils.encode_cell({ c: C, r: 1 });
                        const headerCell = worksheet[headerAddress];
                        if (headerCell && (headerCell.v === 'Current Stock' || headerCell.v === 'Weight (g)')) {
                            cell.s = stockStyle;
                        } else {
                            cell.s = numberStyle;
                        }
                    } 
                    else {
                        cell.s = cellStyle;
                    }
                }
            }
        }

        worksheet['!cols'] = colWidths.map(col => {
            if (col.wpx) return col;
            return { wch: Math.min(col.wch, 100) };
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
        
        const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
        XLSX.writeFile(workbook, `Inventory_Export_${timestamp}.xlsx`);
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
                    <div 
                        className={cn("h-12 w-12 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden", ImageURL ? "group relative cursor-pointer" : "")}
                        onClick={() => ImageURL && SetExpandedImage(row.original)}
                    >
                        {ImageURL ? (
                            <>
                                <img src={ImageURL} alt={row.original.ProductName} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize className="h-5 w-5 text-white" />
                                </div>
                            </>
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
            accessorKey: 'CategoryName',
            meta: { className: 'w-[150px]' },
            header: ({ column }) => <SortableHeader column={column}>Category Name</SortableHeader>,
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 font-medium">
                    {row.original.CategoryName || '-'}
                </span>
            ),
        };

        const CategoryIDColumn = {
            accessorKey: 'CategoryID',
            meta: { className: 'w-[120px]' },
            header: ({ column }) => <SortableHeader column={column}>Category ID</SortableHeader>,
            cell: ({ row }) => (
                <span className="text-sm text-gray-500 font-mono">
                    {row.original.CategoryID || '-'}
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



        const ShowAllColumns = [
            NumberColumn,
            ImageColumn,
            MasterSKUColumn,
            BrandColumn,
            CategoryColumn,
            CategoryIDColumn,
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

        return [...(isSelectionMode ? [SelectColumn] : []), ...ShowAllColumns, ActionColumn];
    }, [isSelectionMode, isHGHMode]);

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
                            columnVisibility={tableColumnVisibility}
                            onColumnVisibilityChange={setTableColumnVisibility}
                            searchPlaceholder="Search"
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            actionElement={
                                <div className="flex items-center gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className={cn("h-9 px-3 bg-white", isExpanded && "bg-indigo-50 border-indigo-200 text-indigo-700")}
                                        title={isExpanded ? "Collapse View" : "Expand View"}
                                    >
                                        {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                        <span className="ml-2 hidden sm:inline">{isExpanded ? 'Collapse' : 'Expand'}</span>
                                    </Button>

                                    {isSelectionMode ? (
                                        <>
                                            {Object.keys(rowSelection).length > 0 ? (
                                                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1 animate-in fade-in zoom-in duration-200">
                                                    <span className="text-sm font-medium text-indigo-700">
                                                        {Object.keys(rowSelection).length} selected
                                                    </span>
                                                    <Button size="sm" variant="outline" className="bg-white hover:bg-amber-50 hover:text-amber-700 border-amber-200 text-amber-600 h-7 text-xs ml-2" onClick={() => { setBulkActionConfirm('archive'); setDeleteVerification(''); }}>
                                                        Archive
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="bg-white hover:bg-red-50 hover:text-red-700 border-red-200 text-red-600 h-7 text-xs" onClick={() => { setBulkActionConfirm('delete'); setDeleteVerification(''); }}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500 animate-in fade-in duration-200 mr-2">
                                                    Select items...
                                                </span>
                                            )}
                                            <Button size="sm" variant="outline" className="text-gray-500 h-9" onClick={() => { setIsSelectionMode(false); setRowSelection({}); }}>
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                         <Button size="sm" variant="outline" className="h-9" onClick={() => setIsSelectionMode(true)}>
                                            <Square className="mr-2 h-4 w-4" />
                                            Select
                                        </Button>
                                    )}

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-3 bg-white"
                                                title="Smart Export to Excel"
                                            >
                                                <Download className="h-4 w-4" />
                                                <span className="ml-2 hidden sm:inline">Export</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            <DropdownMenuLabel>Columns to Export</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <div className="max-h-[300px] overflow-y-auto">
                                                {Object.entries({
                                                    masterSKU: 'Master SKU',
                                                    barcode: 'Barcode',
                                                    productName: 'Product Name',
                                                    category: 'Category Name',
                                                    categoryID: 'Category ID',
                                                    stock: 'Current Stock',
                                                    costPrice: 'Cost Price',
                                                    stockistPrice: 'Stockist Price',
                                                    retailPrice: 'Retail Price',
                                                    wholesalePrice: 'Wholesale Price',
                                                    agentPrice: 'Agent Price',
                                                    weight: 'Weight (g)',
                                                    dimensions: 'Dimensions',
                                                }).map(([key, label]) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={key}
                                                        checked={exportColumns[key]}
                                                        onCheckedChange={(checked) => setExportColumns(prev => ({ ...prev, [key]: checked }))}
                                                        onSelect={(e) => e.preventDefault()}
                                                    >
                                                        {label}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </div>
                                            <DropdownMenuSeparator />
                                            <div className="p-2 flex gap-2">
                                                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={(e) => { e.preventDefault(); setExportColumns(Object.keys(exportColumns).reduce((acc, k) => ({...acc, [k]: true}), {})); }}>
                                                    All
                                                </Button>
                                                <Button size="sm" className="flex-1 text-xs" onClick={handleExportExcel}>
                                                    Download
                                                </Button>
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

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
                                                onClick={() => handleViewModeChange(Option.Value)}
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
            
            {/* Expanded Image Dialog */}
            <Dialog open={!!ExpandedImage} onOpenChange={(open) => { if (!open) SetExpandedImage(null); }}>
                <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-0 overflow-hidden bg-transparent border-0 shadow-none rounded-none">
                    {ExpandedImage && (
                        <div className="relative w-full h-[400px] flex items-center justify-center">
                            <img 
                                src={ExpandedImage.ImageURL} 
                                alt={ExpandedImage.ProductName} 
                                className="max-w-full max-h-full object-contain shadow-2xl"
                            />
                            <button
                                onClick={() => SetExpandedImage(null)}
                                className="absolute top-2 right-2 bg-black/30 rounded-full p-2 text-white hover:bg-black/50 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}


