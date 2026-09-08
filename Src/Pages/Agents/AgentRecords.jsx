import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, Calendar, ExternalLink } from 'lucide-react';
import { DataTable } from '@/Components/Common/DataTable';
import { Button } from '@/Components/UI/Button';
import { Badge } from '@/Components/UI/Badge';
import { useAgentDetails } from '@/Hooks/UseAgentManagement';

export function AgentRecords() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: agent, isLoading } = useAgentDetails(id);

    // Filter ledger entries for Payouts / Statements that have been paid out
    const payoutRecords = (agent?.ledger || []).filter(entry => {
        const type = (entry.EntryType || '').toLowerCase();
        const amount = parseFloat(entry.Amount || 0);
        // Display Payouts, Commission Settlements, or negative ledger amounts representing payments
        return type === 'payout' || type === 'commission' || amount < 0;
    });

    const columns = [
        { 
            header: 'Date', 
            accessorKey: 'CreatedAt', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return (
                    <div className="font-semibold text-gray-900">
                        {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                );
            } 
        },
        { 
            header: 'Time', 
            id: 'time', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return <span className="text-gray-500 text-xs font-mono">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>;
            } 
        },
        { 
            header: () => <div className="text-center">Type</div>, 
            accessorKey: 'EntryType',
            cell: ({ row }) => {
                const type = row.original.EntryType || 'Payout';
                const isPayout = type.toLowerCase() === 'payout';
                return (
                    <div className="flex justify-center">
                        <Badge 
                            variant="outline" 
                            className={`rounded-md font-semibold text-xs px-2.5 py-0.5 shadow-xs ${
                                isPayout 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                        >
                            {type}
                        </Badge>
                    </div>
                );
            }
        },
        { 
            header: 'Reference', 
            accessorKey: 'Description',
            cell: ({ row }) => (
                <span className="font-medium text-gray-900">
                    {row.original.Description || 'Monthly Statement Payout'}
                </span>
            )
        },
        { 
            header: () => <div className="text-right">Amount Paid</div>, 
            accessorKey: 'Amount', 
            cell: ({ row }) => {
                const amount = Math.abs(parseFloat(row.original.Amount || 0));
                return (
                    <div className="text-right font-bold font-mono text-emerald-600">
                        RM {amount.toFixed(2)}
                    </div>
                );
            } 
        },
        {
            header: () => <div className="text-center">Statement</div>,
            id: 'actions',
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                const month = date.getMonth() + 1;
                const year = date.getFullYear();

                return (
                    <div className="flex justify-center">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/Agent-Management/${id}/Statement?month=${month}&year=${year}`)}
                            className="h-8 px-3 text-xs font-semibold text-gray-700 hover:text-indigo-600 border-gray-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/50"
                        >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            View Statement
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(`/Agent-Management/${id}`)}
                        className="-ml-2 mb-2 text-gray-600 hover:text-gray-900 font-medium"
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Back
                    </Button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                            {agent?.DisplayName || 'Loading...'}
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Viewing historical statement payouts and settlement records.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4">
                    <DataTable 
                        columns={columns} 
                        data={payoutRecords} 
                        searchPlaceholder="Search"
                        isLoading={isLoading}
                    />
                </div>
            </div>
        </div>
    );
}
