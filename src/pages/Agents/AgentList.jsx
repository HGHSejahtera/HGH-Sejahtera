import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Eye } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

const MOCK_AGENTS = [];

export function AgentList() {
    const navigate = useNavigate();

    const columns = [
        { header: 'Agent ID', accessorKey: 'AgentID', cell: ({ row }) => <span className="font-semibold text-indigo-600">{row.original.AgentID}</span> },
        { header: 'Name', accessorKey: 'Name', cell: ({ row }) => <span className="font-bold text-gray-900">{row.original.Name}</span> },
        { header: 'Email', accessorKey: 'Email' },
        { 
            header: 'Debt / Limit', 
            id: 'debt',
            cell: ({ row }) => {
                const ratio = row.original.TotalDebt / row.original.CreditLimit;
                const isOverLimit = ratio > 1;
                return (
                    <div>
                        <span className={`font-bold ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
                            RM {row.original.TotalDebt.toFixed(2)}
                        </span>
                        <span className="text-gray-500 text-sm"> / RM {row.original.CreditLimit.toFixed(2)}</span>
                        {isOverLimit && <ShieldAlert className="inline w-4 h-4 ml-2 text-red-500" />}
                    </div>
                );
            }
        },
        { 
            header: 'Status', 
            accessorKey: 'Status',
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
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/agents/${row.original.AgentID}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                </Button>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agents Management</h1>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        <DataTable columns={columns} data={MOCK_AGENTS} />
                    </div>
                </div>
            </div>
        </div>
    );
}
