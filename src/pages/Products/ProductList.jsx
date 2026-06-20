import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { useProducts } from '@/hooks/useProducts';
import { Link } from 'react-router-dom';

export function ProductList() {
    const { data: products, isLoading } = useProducts();

    const columns = [
        {
            accessorKey: 'ProductName',
            header: 'Product Name',
        },
        {
            accessorKey: 'Category',
            header: 'Category',
        },
        {
            accessorKey: 'Variation',
            header: 'Variation',
        },
        {
            accessorKey: 'Barcode',
            header: 'Barcode',
            cell: ({ row }) => row.original.Barcode || '-',
        },
        {
            accessorKey: 'CostPrice',
            header: 'Cost Price',
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue('CostPrice'));
                return new Intl.NumberFormat('ms-MY', {
                    style: 'currency',
                    currency: 'MYR',
                }).format(amount);
            },
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                return (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`/products/${row.original.ProductID}`}>Edit</Link>
                    </Button>
                );
            },
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Products</h2>
                    <p className="text-gray-500 mt-2">Manage your product catalog and SKUs.</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button variant="outline" asChild className="flex-1 md:flex-none">
                        <Link to="/products/import">
                            <Upload className="mr-2 h-4 w-4" />
                            Bulk Import
                        </Link>
                    </Button>
                    <Button asChild className="flex-1 md:flex-none">
                        <Link to="/products/create">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Link>
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div>Loading products...</div>
            ) : (
                <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <DataTable 
                        columns={columns} 
                        data={products || []} 
                        searchKey="ProductName"
                        searchPlaceholder="Search products by name..."
                    />
                </div>
            )}
        </div>
    );
}
