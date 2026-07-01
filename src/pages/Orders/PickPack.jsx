import { Package, Play, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';


export function PickPack() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const isAgent = role === 'Agent';



    // Queue State
    const queueColumns = [
        { header: 'Order ID', accessorKey: 'PlatformOrderID' },
        { header: 'Platform', accessorKey: 'Platform' },
        { header: 'Agent', accessorKey: 'AccountName' },
        { 
            header: 'Items', 
            id: 'itemCount',
            cell: ({ row }) => row.original.ImportedOrderItems?.length || 0
        },
        { 
            header: 'Status', 
            accessorKey: 'OrderStatus',
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${row.original.OrderStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                      row.original.OrderStatus === 'Picking' ? 'bg-blue-100 text-blue-800' : 
                      'bg-green-100 text-green-800'}`}
                >
                    {row.original.OrderStatus}
                </span>
            )
        },
        { 
            header: 'Action', 
            id: 'actions',
            cell: ({ row }) => (
                <Button 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => navigate(`/Pack-Order/${row.original.PlatformOrderID}`)}
                >
                    {row.original.OrderStatus === 'Pending' ? null : <Package className="w-4 h-4 mr-1" />}
                    {row.original.OrderStatus === 'Pending' ? 'Start Packing' : 'Continue'}
                </Button>
            )
        }
    ];

    const { activeOrders, isLoadingActive } = useOrders();

    const pendingCount = activeOrders.filter(o => o.OrderStatus === 'Pending').length;

    const pickingCount = activeOrders.filter(o => o.OrderStatus === 'Picking').length;
    const packedCount = activeOrders.filter(o => o.OrderStatus === 'Packed').length;

    if (isAgent) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
                    <p className="text-gray-500 mt-2">Only HQ staff can access the Pick & Pack Queue.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pick & Pack</h1>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-5 transition-all hover:shadow-md hover:border-yellow-200">
                        <div className="bg-yellow-50 p-4 rounded-xl text-yellow-600 border border-yellow-100">
                            <Package className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Pending</p>
                            <p className="text-3xl font-black text-gray-900">{pendingCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-5 transition-all hover:shadow-md hover:border-blue-200">
                        <div className="bg-blue-50 p-4 rounded-xl text-blue-600 border border-blue-100">
                            <Package className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Picking</p>
                            <p className="text-3xl font-black text-gray-900">{pickingCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-5 transition-all hover:shadow-md hover:border-emerald-200">
                        <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 border border-emerald-100">
                            <CheckCircle className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Packed Today</p>
                            <p className="text-3xl font-black text-gray-900">{packedCount}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col min-h-0 h-full">
                    <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">
                        <DataTable 
                            columns={queueColumns} 
                            data={activeOrders} 
                            searchPlaceholder="Search"
                            isLoading={isLoadingActive}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
