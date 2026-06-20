import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

const MOCK_LEDGER = [];

export function AgentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ledger');

    const ledgerColumns = [
        { header: 'Date', accessorKey: 'Date' },
        { header: 'Type', accessorKey: 'Type' },
        { header: 'Reference', accessorKey: 'Reference' },
        { header: 'Debit (RM)', accessorKey: 'Debit', cell: ({ row }) => row.original.Debit > 0 ? <span className="text-red-600">{row.original.Debit.toFixed(2)}</span> : '-' },
        { header: 'Credit (RM)', accessorKey: 'Credit', cell: ({ row }) => row.original.Credit > 0 ? <span className="text-green-600">{row.original.Credit.toFixed(2)}</span> : '-' },
        { header: 'Balance', accessorKey: 'Balance', cell: ({ row }) => <span className="font-bold">{row.original.Balance.toFixed(2)}</span> },
    ];

    return (
        <div className="space-y-6">
            <Button variant="ghost" className="mb-2 -ml-4" onClick={() => navigate('/agents')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Agents
            </Button>

            <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold">Agent Name</h1>
                        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">Unknown</span>
                    </div>
                    <p className="text-gray-500 mt-1">ID: {id} • agent@email.com</p>
                    
                    <div className="mt-6 flex space-x-8">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Debt</p>
                            <p className="text-2xl font-bold text-red-600">RM 0.00</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Credit Limit</p>
                            <div className="flex items-center space-x-2">
                                <p className="text-2xl font-bold text-gray-900">RM 0.00</p>
                                <button className="text-indigo-600 hover:text-indigo-800"><Edit3 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex space-x-2 flex-col items-end gap-2">
                    <div className="flex space-x-2">
                        <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                            <AlertCircle className="w-4 h-4 mr-2" /> Suspend
                        </Button>
                        <Button>Add Manual Payment</Button>
                    </div>
                    <Button variant="secondary" className="w-full">Generate Statement</Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'ledger' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Ledger History
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'orders' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Recent Orders
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {activeTab === 'ledger' && (
                    <div className="p-4">
                        <DataTable columns={ledgerColumns} data={MOCK_LEDGER} />
                    </div>
                )}
                {activeTab === 'orders' && (
                    <div className="p-12 text-center text-gray-500">
                        Order history will be displayed here.
                    </div>
                )}
            </div>
        </div>
    );
}
