import { Receipt, CreditCard, Upload } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

import { useAgentPortal } from '@/hooks/useAgentPortal';

export function AgentMyLedger() {
    const { myLedger, currentBalance, isLoadingLedger } = useAgentPortal();
    const creditLimit = 0.00;

    const columns = [
        { header: 'Date', accessorKey: 'Date' },
        { 
            header: 'Description', 
            id: 'desc',
            cell: ({ row }) => (
                <div>
                    <p className="font-semibold">{row.original.Type}</p>
                    <p className="text-xs text-gray-500">{row.original.Reference}</p>
                </div>
            )
        },
        { 
            header: 'Charge (RM)', 
            accessorKey: 'Debit',
            cell: ({ row }) => row.original.Debit > 0 ? <span className="text-red-600 font-semibold">{row.original.Debit.toFixed(2)}</span> : '-'
        },
        { 
            header: 'Payment (RM)', 
            accessorKey: 'Credit',
            cell: ({ row }) => row.original.Credit > 0 ? <span className="text-green-600 font-semibold">{row.original.Credit.toFixed(2)}</span> : '-'
        },
        { 
            header: 'Balance', 
            accessorKey: 'Balance',
            cell: ({ row }) => <span className="font-bold">RM {row.original.Balance.toFixed(2)}</span>
        },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Ledger</h1>
                    <p className="text-gray-500 mt-2">View your outstanding balance and payment history.</p>
                </div>
                <div>
                    <Button className="h-12 px-6 flex items-center shadow-md">
                        <Upload className="w-5 h-5 mr-2" />
                        Submit Proof of Payment
                    </Button>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center space-x-4">
                    <div className="p-4 bg-red-50 rounded-full text-red-600">
                        <Receipt className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium uppercase">Outstanding Balance</p>
                        <p className="text-3xl font-bold text-gray-900">RM {currentBalance.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center space-x-4">
                    <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                        <CreditCard className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium uppercase">Credit Limit</p>
                        <p className="text-3xl font-bold text-gray-900">RM {creditLimit.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center space-x-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-gray-900">{creditLimit > 0 ? ((currentBalance/creditLimit)*100).toFixed(0) : 0}%</span>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${creditLimit > 0 ? (currentBalance/creditLimit)*100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Available Credit: RM {(creditLimit > 0 ? creditLimit - currentBalance : 0).toFixed(2)}</p>
                    </div>
                </div>
            </div>

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
