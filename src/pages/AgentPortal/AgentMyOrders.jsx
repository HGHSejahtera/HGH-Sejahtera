import { useState, useMemo } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAgentPortal } from '@/hooks/useAgentPortal';
import { AgentTabs } from './AgentTabs';

export function AgentMyOrders() {
    const { myOrders, isLoadingOrders, cancelOrder } = useAgentPortal();
    const [isCancelling, setIsCancelling] = useState(false);
    const [timeFilter, setTimeFilter] = useState('day');

    const currentYear = new Date().getFullYear();

    const activeMonths = useMemo(() => {
        if (!myOrders) return new Set();
        const active = new Set();
        myOrders.forEach(order => {
            const d = new Date(order.RawDate);
            if (d.getFullYear() === currentYear) {
                active.add(d.getMonth());
            }
        });
        return active;
    }, [myOrders, currentYear]);

    const filteredOrders = useMemo(() => {
        if (!myOrders) return [];
        if (timeFilter === 'all') return myOrders;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return myOrders.filter(order => {
            const orderDate = new Date(order.RawDate);
            if (timeFilter === 'day') {
                return orderDate >= startOfDay;
            }
            if (timeFilter === 'week') {
                const startOfWeek = new Date(startOfDay);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                return orderDate >= startOfWeek;
            }
            if (typeof timeFilter === 'number') {
                return orderDate.getFullYear() === currentYear && orderDate.getMonth() === timeFilter;
            }
            return true;
        });
    }, [myOrders, timeFilter, currentYear]);

    const handleCancel = async (dbId, platformId) => {
        if (confirm(`Are you sure you want to cancel order ${platformId}? This will void the commission and return stock if shipped.`)) {
            setIsCancelling(true);
            try {
                await cancelOrder(dbId);
                alert('Order cancelled successfully.');
            } catch (err) {
                alert('Failed to cancel order: ' + err.message);
            } finally {
                setIsCancelling(false);
            }
        }
    };

    const columns = [
        { header: 'Order ID', accessorKey: 'OrderID' },
        { header: 'Date', accessorKey: 'Date' },
        { header: 'Total Items', accessorKey: 'TotalItems' },
        { 
            header: 'Total Amount', 
            accessorKey: 'TotalAmount',
            cell: ({ row }) => {
                const amount = row.original.TotalAmount;
                const status = row.original.Status;
                if (amount === 0 && status === 'Pending') {
                    return <span className="font-semibold text-yellow-600">TBC (Unmatched)</span>;
                }
                return <span className="font-semibold">RM {amount.toFixed(2)}</span>;
            }
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
            cell: ({ row }) => {
                const isCancellable = row.original.Status === 'Pending' || row.original.Status === 'Shipped';
                return (
                    <div className="flex space-x-2">

                        {isCancellable && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={isCancelling}
                                className="flex items-center text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleCancel(row.original.ID, row.original.OrderID)}
                            >
                                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orders</h1>
                </div>
            </div>

            <AgentTabs />

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-4 items-center">
                    <div className="flex gap-2 pr-4 border-r border-gray-200">
                        <Button variant={timeFilter === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter('day')}>Today</Button>
                        <Button variant={timeFilter === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter('week')}>This Week</Button>
                        <Button variant={timeFilter === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter('month')}>This Month</Button>
                        <Button variant={timeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTimeFilter('all')}>All Time</Button>
                    </div>
                    
                    <div className="flex items-center">
                        <Select
                            value={typeof timeFilter === 'number' ? timeFilter.toString() : undefined}
                            onValueChange={(val) => setTimeFilter(parseInt(val))}
                        >
                            <SelectTrigger className="w-[110px]" size="sm">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => {
                                    const hasOrders = activeMonths.has(idx);
                                    return (
                                        <SelectItem key={m} value={idx.toString()} disabled={!hasOrders}>
                                            {m} {currentYear}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="p-4">
                    <DataTable columns={columns} data={filteredOrders} isLoading={isLoadingOrders} />
                </div>
            </div>
        </div>
    );
}
