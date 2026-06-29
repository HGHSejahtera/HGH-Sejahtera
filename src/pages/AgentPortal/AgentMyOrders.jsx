import { Download } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

import { useAgentPortal } from '@/hooks/useAgentPortal';

export function AgentMyOrders() {
    const columns = [
        { header: 'Order ID', accessorKey: 'OrderID' },
        { header: 'Date', accessorKey: 'Date' },
        { header: 'Total Items', accessorKey: 'TotalItems' },
        { 
            header: 'Total Amount', 
            accessorKey: 'TotalAmount',
            cell: ({ row }) => <span className="font-semibold">RM {row.original.TotalAmount.toFixed(2)}</span>
        },
        { 
            header: 'Status', 
            accessorKey: 'Status',
            cell: ({ row }) => {
                const statusColors = {
                    'Pending': 'bg-yellow-100 text-yellow-800',
                    'Packing': 'bg-blue-100 text-blue-800',
                    'Ready': 'bg-green-100 text-green-800',
                    'Shipped': 'bg-indigo-100 text-indigo-800',
                    'Delivered': 'bg-gray-100 text-gray-800',
                };
                const color = statusColors[row.original.Status] || 'bg-gray-100 text-gray-800';
                return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{row.original.Status}</span>;
            }
        },
        { 
            header: 'Action', 
            id: 'actions',
            cell: () => (
                <Button variant="outline" size="sm" className="flex items-center">
                    <Download className="w-4 h-4 mr-1" />
                    Invoice
                </Button>
            )
        }
    ];

    const { myOrders, isLoadingOrders } = useAgentPortal();

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
                    <p className="text-gray-500 mt-2">Track the status of your restock orders.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4">
                    <DataTable columns={columns} data={myOrders} isLoading={isLoadingOrders} />
                </div>
            </div>
        </div>
    );
}
