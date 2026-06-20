import { useState } from 'react';
import { Package, Search, Play, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/common/DataTable';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuth';

const MOCK_ORDERS = [];

export function PickPack() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const role = user?.role || 'Staff';
    const isAgent = role === 'Agent';

    const [searchQuery, setSearchQuery] = useState('');

    // Queue State
    const queueColumns = [
        { header: 'Order ID', accessorKey: 'OrderID' },
        { header: 'Platform', accessorKey: 'Platform' },
        { header: 'Customer', accessorKey: 'Customer' },
        { header: 'Items', accessorKey: 'ItemsCount' },
        { 
            header: 'Status', 
            accessorKey: 'Status',
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${row.original.Status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                      row.original.Status === 'Packing' ? 'bg-blue-100 text-blue-800' : 
                      'bg-green-100 text-green-800'}`}
                >
                    {row.original.Status}
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
                    onClick={() => navigate(`/pack-order/${row.original.OrderID}`)}
                >
                    {row.original.Status === 'Pending' ? <Play className="w-4 h-4 mr-1" /> : <Package className="w-4 h-4 mr-1" />}
                    {row.original.Status === 'Pending' ? 'Start Packing' : 'Continue'}
                </Button>
            )
        }
    ];

    const filteredOrders = MOCK_ORDERS.filter(order => 
        order.OrderID.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.Customer.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pick & Pack</h1>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex flex-wrap gap-4 w-full">
                    <div className="bg-white p-3 rounded-xl shadow-sm border flex items-center space-x-3 w-48">
                        <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Pending</p>
                            <p className="text-xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border flex items-center space-x-3 w-48">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Packing</p>
                            <p className="text-xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border flex items-center space-x-3 w-48">
                        <div className="bg-green-100 p-2 rounded-full text-green-600">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase">Ready</p>
                            <p className="text-xl font-bold text-gray-900">0</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <Input 
                                type="text" 
                                placeholder="Search Order ID or Customer..." 
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="p-4">
                        <DataTable columns={queueColumns} data={filteredOrders} />
                    </div>
                </div>
            </div>
        </div>
    );
}
