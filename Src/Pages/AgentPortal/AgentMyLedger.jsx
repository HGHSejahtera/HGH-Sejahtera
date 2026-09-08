import { DataTable } from '@/Components/Common/DataTable';

import { useAgentPortal } from '@/Hooks/UseAgentPortal';
import { AgentTabs } from './AgentTabs';

export function AgentMyLedger() {
    const { myLedger, isLoadingLedger } = useAgentPortal();

    const columns = [
        { header: 'Date', accessorKey: 'Date' },
        { header: 'Type', accessorKey: 'Type' },
        { header: 'Reference', accessorKey: 'Reference' },
        { 
            header: 'Amount', 
            accessorKey: 'Amount',
            cell: ({ row }) => {
                const amt = parseFloat(row.original.Amount);
                if (amt > 0) return <span className="text-green-600 font-semibold">+ RM {amt.toFixed(2)}</span>;
                if (amt < 0) return <span className="text-red-600 font-semibold">- RM {Math.abs(amt).toFixed(2)}</span>;
                return '-';
            }
        },
        { 
            header: 'Balance', 
            accessorKey: 'Balance',
            cell: ({ row }) => <span className="font-mono text-gray-900 font-medium">RM {parseFloat(row.original.Balance).toFixed(2)}</span>
        }
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Total Sales</h1>
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
