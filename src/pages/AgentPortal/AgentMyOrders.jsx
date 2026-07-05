import { useState, useMemo } from 'react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentPortal } from '@/hooks/useAgentPortal';
import { AgentTabs } from './AgentTabs';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';

export function AgentMyOrders() {
    const { myOrders, isLoadingOrders } = useAgentPortal();
    const [timeFilter, setTimeFilter] = useState('all');
    const [viewAwbUrl, setViewAwbUrl] = useState(null);

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



    const columns = [
        { header: 'Order ID', accessorKey: 'OrderID' },
        { header: 'Date', accessorKey: 'Date' },
        { 
            header: 'Time', 
            id: 'Time',
            cell: ({ row }) => {
                const dateObj = new Date(row.original.RawDate);
                return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        },
        { header: 'Total Items', accessorKey: 'TotalItems' },
        { 
            header: 'AWB', 
            id: 'actions',
            cell: ({ row }) => {
                const url = row.original.AwbUrl;
                if (!url) return <span className="text-gray-400 text-sm">No AWB</span>;
                
                return (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => setViewAwbUrl(url)}
                    >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                    </Button>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
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

            <AwbPdfViewer 
                url={viewAwbUrl} 
                open={!!viewAwbUrl} 
                onOpenChange={(open) => {
                    if (!open) setViewAwbUrl(null);
                }} 
            />
        </div>
    );
}
