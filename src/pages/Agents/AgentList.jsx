import { useNavigate } from 'react-router-dom';

import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

import { useAgentSummaries } from '@/hooks/useAgentManagement';

export function AgentList() {
    const navigate = useNavigate();
    const { data: agents = [], isLoading } = useAgentSummaries();

    const columns = [
        { header: 'Agent ID', accessorKey: 'AgentID', cell: ({ row }) => <span className="font-semibold text-indigo-600">{row.original.StaffID || row.original.AgentID}</span> },
        { header: 'Name', accessorKey: 'Name', cell: ({ row }) => <span className="font-bold text-gray-900">{row.original.Name}</span> },
        { header: 'Email', accessorKey: 'Email' },
        { 
            header: 'Commission', 
            id: 'commission',
            meta: { className: 'text-center' },
            cell: ({ row }) => {
                const commission = row.original.TotalDebt || 0;
                return (
                    <div>
                        <span className="font-bold text-gray-900">
                            RM {commission.toFixed(2)}
                        </span>
                    </div>
                );
            }
        },
        { 
            header: 'Status', 
            accessorKey: 'Status',
            meta: { className: 'text-center' },
            cell: ({ row }) => {
                const statusColors = {
                    'Active': 'bg-green-100 text-green-800',
                    'Suspended': 'bg-red-100 text-red-800',
                };
                const color = statusColors[row.original.Status] || 'bg-gray-100 text-gray-800';
                return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{row.original.Status}</span>;
            }
        },
        { 
            header: 'Action', 
            id: 'actions',
            meta: { className: 'text-center' },
            cell: ({ row }) => (
                <Button variant="secondary" size="sm" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={() => navigate(`/Agent-Management/${row.original.StaffID || row.original.AgentID}`)}>
                    Manage
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-6">


            <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        <DataTable columns={columns} data={agents} isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
