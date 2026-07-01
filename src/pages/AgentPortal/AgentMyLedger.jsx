import { DataTable } from '@/components/common/DataTable';

import { useAgentPortal } from '@/hooks/useAgentPortal';
import { AgentTabs } from './AgentTabs';

export function AgentMyLedger() {
    const { myLedger, isLoadingLedger } = useAgentPortal();

    const columns = [
        { header: 'Date', accessorKey: 'Date' },
        { header: 'Order ID', accessorKey: 'OrderID' },
        { 
            header: 'Commission', 
            accessorKey: 'Amount',
            cell: ({ row }) => row.original.Amount > 0 ? <span className="text-green-600 font-semibold">+ RM {row.original.Amount.toFixed(2)}</span> : '-'
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Commissions</h1>
                </div>
            </div>

            <AgentTabs />

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-8">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg">Transaction History</h3>
                </div>
                <div className="p-4">
                    <DataTable columns={columns} data={myLedger} isLoading={isLoadingLedger} />
                </div>
            </div>
        </div>
    );
}
