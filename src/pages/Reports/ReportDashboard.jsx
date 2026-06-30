import { useState, useMemo } from 'react';
import { Archive, Activity, Trash2, DollarSign, PackageX, History, FileText, Loader2 } from 'lucide-react';
import { useAuditLogs, useArchivedProducts, useSalesReports } from '@/hooks/useReports';
import { useInventoryProducts } from '@/hooks/useInventory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';

const formatCurrency = (value) => new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
}).format(Number(value || 0));

export function ReportDashboard() {
    const [activeTab, setActiveTab] = useState('Audit');
    const { data: auditLogs, isLoading: loadingAudit } = useAuditLogs();
    const { data: archivedProducts, isLoading: loadingArchived } = useArchivedProducts();
    const { data: activeProducts, isLoading: loadingActive } = useInventoryProducts();
    const { data: posSales, isLoading: loadingSales } = useSalesReports();
    const { updateProduct } = useProducts();

    const auditColumns = useMemo(() => [
        {
            accessorKey: 'Timestamp',
            header: 'Date & Time',
            cell: ({ row }) => new Date(row.original.Timestamp).toLocaleString('en-MY', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            }),
            meta: { className: 'w-[180px]' }
        },
        {
            accessorKey: 'ActionType',
            header: 'Action',
            cell: ({ row }) => (
                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                    <Trash2 className="w-3 h-3 mr-1" />
                    {row.original.ActionType}
                </Badge>
            )
        },
        {
            id: 'ProductInfo',
            header: 'Deleted Item Details',
            cell: ({ row }) => {
                const details = row.original.Details;
                return (
                    <div>
                        <div className="font-medium text-gray-900">{details.ProductName || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">
                            SKU: <span className="font-mono">{details.MasterSKU || '-'}</span> | 
                            Brand: {details.Brand || '-'}
                        </div>
                    </div>
                );
            }
        },
        {
            id: 'StockLoss',
            header: 'Stock Wiped',
            cell: ({ row }) => {
                const stock = Number(row.original.Details.Stock || 0);
                return (
                    <span className={cn("font-semibold", stock > 0 ? "text-red-600" : "text-gray-500")}>
                        {stock} units
                    </span>
                );
            }
        },
        {
            accessorKey: 'PerformedBy',
            header: 'User',
            cell: ({ row }) => row.original.PerformedBy || 'System'
        }
    ], []);

    const archivedColumns = useMemo(() => [
        {
            id: 'ProductInfo',
            header: 'Product',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900">{row.original.ProductName}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.original.MasterSKU || 'No SKU'}</div>
                </div>
            )
        },
        {
            accessorKey: 'Stock',
            header: 'Remaining Stock',
            cell: ({ row }) => (
                <Badge variant="outline" className={Number(row.original.Stock || 0) > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : ""}>
                    {row.original.Stock || 0}
                </Badge>
            )
        },
        {
            id: 'Actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                    onClick={() => updateProduct.mutate({ id: row.original.ProductID, updates: { IsActive: true }})}
                >
                    <Activity className="w-4 h-4 mr-1.5" />
                    Restore
                </Button>
            )
        }
    ], [updateProduct]);

    const slowMovingData = useMemo(() => {
        if (!activeProducts) return [];
        // Temporary logic: Flag items with High Stock (> 50) as potential slow moving
        return activeProducts.filter(p => Number(p.Stock || 0) > 50).map(p => {
            const pricing = Array.isArray(p.ProductPricing) ? p.ProductPricing[0] : p.ProductPricing;
            const cost = pricing?.CostPrice || 0;
            const tiedCapital = cost * Number(p.Stock || 0);
            return { ...p, tiedCapital };
        }).sort((a, b) => b.tiedCapital - a.tiedCapital);
    }, [activeProducts]);

    const healthColumns = useMemo(() => [
        {
            id: 'ProductInfo',
            header: 'Product',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900">{row.original.ProductName}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.original.MasterSKU || 'No SKU'}</div>
                </div>
            )
        },
        {
            accessorKey: 'Stock',
            header: 'Current Stock',
            cell: ({ row }) => (
                <span className="font-semibold text-amber-600">{row.original.Stock} units</span>
            )
        },
        {
            id: 'TiedCapital',
            header: 'Capital Tied Up',
            cell: ({ row }) => (
                <span className="font-medium text-red-600">{formatCurrency(row.original.tiedCapital)}</span>
            )
        }
    ], []);

    const renderContent = () => {
        if (activeTab === 'Audit') {
            return (
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border shadow-sm p-4">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold flex items-center text-gray-900">
                            <History className="w-5 h-5 mr-2 text-gray-500" />
                            Deletion Audit Trail
                        </h3>
                        <p className="text-sm text-gray-500">Immutable record of all products removed via Force Purge.</p>
                    </div>
                    {loadingAudit ? (
                        <div className="py-12 text-center text-gray-500">Loading audit logs...</div>
                    ) : (
                        <DataTable columns={auditColumns} data={auditLogs || []} searchPlaceholder="Search logs..." />
                    )}
                </div>
            );
        }

        if (activeTab === 'Archived') {
            return (
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border shadow-sm p-4">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold flex items-center text-gray-900">
                            <Archive className="w-5 h-5 mr-2 text-amber-500" />
                            Archived Products
                        </h3>
                        <p className="text-sm text-gray-500">Products that are hidden from active inventory but retain historical ledgers.</p>
                    </div>
                    {loadingArchived ? (
                        <div className="py-12 text-center text-gray-500">Loading archived products...</div>
                    ) : (
                        <DataTable columns={archivedColumns} data={archivedProducts || []} searchPlaceholder="Search archived..." />
                    )}
                </div>
            );
        }

        if (activeTab === 'Health') {
            return (
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border shadow-sm p-4">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold flex items-center text-gray-900">
                            <PackageX className="w-5 h-5 mr-2 text-red-500" />
                            Slow Moving Inventory (SMI)
                        </h3>
                        <p className="text-sm text-gray-500">Products with unusually high stock levels tying up business capital.</p>
                    </div>
                    {loadingActive ? (
                        <div className="py-12 text-center text-gray-500">Analyzing inventory health...</div>
                    ) : (
                        <DataTable columns={healthColumns} data={slowMovingData} searchPlaceholder="Search products..." />
                    )}
                </div>
            );
        }

        if (activeTab === 'Sales') {
            const totalSalesValue = (posSales || []).reduce((sum, s) => sum + Number(s.TotalAmount || 0), 0);
            
            return (
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center text-gray-900">
                                <DollarSign className="w-5 h-5 mr-2 text-green-500" />
                                Sales Monitor (POS Records)
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Review test sales records before flushing the database.</p>
                        </div>
                        <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold shadow-sm">
                            Total: RM {totalSalesValue.toFixed(2)}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4">Receipt ID</th>
                                    <th className="px-6 py-4">Tarikh & Masa</th>
                                    <th className="px-6 py-4 text-center">Kaedah Bayaran</th>
                                    <th className="px-6 py-4 text-right">Jumlah (RM)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingSales ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Sedang memuatkan data...
                                        </td>
                                    </tr>
                                ) : (!posSales || posSales.length === 0) ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                                <FileText className="w-6 h-6 text-gray-400" />
                                            </div>
                                            <p className="font-medium text-gray-900">Tiada rekod jualan ditemui.</p>
                                            <p className="text-sm mt-1">Jadual POSSales bersih dari sebarang data.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    posSales.map((sale) => (
                                        <tr key={sale.POSSaleID} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-gray-900">{sale.ReceiptNumber || sale.POSSaleID}</td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(sale.CreatedAt).toLocaleString('ms-MY', { 
                                                    dateStyle: 'medium', 
                                                    timeStyle: 'short' 
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                                                    ${sale.PaymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 
                                                    sale.PaymentMethod === 'Online' ? 'bg-blue-100 text-blue-700' : 
                                                    'bg-purple-100 text-purple-700'}`}>
                                                    {sale.PaymentMethod || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                {Number(sale.TotalAmount || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">System Reports</h2>
                    <p className="text-gray-500">Analyze inventory health, sales, and audit trails.</p>
                </div>
                <div className="flex rounded-lg border bg-gray-100 p-1 w-full md:w-auto h-10 items-center">
                    {[
                        { id: 'Audit', label: 'Audit Trail', icon: <History className="w-4 h-4 mr-2" /> },
                        { id: 'Archived', label: 'Archived', icon: <Archive className="w-4 h-4 mr-2" /> },
                        { id: 'Health', label: 'Inventory Health', icon: <Activity className="w-4 h-4 mr-2" /> },
                        { id: 'Sales', label: 'Sales & Profit', icon: <DollarSign className="w-4 h-4 mr-2" /> },
                    ].map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? 'default' : 'ghost'}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex-1 h-full shadow-none"
                        >
                            {tab.icon}
                            {tab.label}
                        </Button>
                    ))}
                </div>
            </div>

            {renderContent()}
        </div>
    );
}
