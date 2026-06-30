import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { useAgentDetails, useAgentMutations } from '@/hooks/useAgentManagement';

export function AgentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ledger');
    const { updateCreditLimit, addManualPayment, suspendAgent } = useAgentMutations();
    
    const { data: agent, isLoading } = useAgentDetails(id);
    
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [newLimit, setNewLimit] = useState('');
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentRef, setPaymentRef] = useState('');

    const ledgerColumns = [
        { header: 'Date', accessorKey: 'CreatedAt', cell: ({ row }) => new Date(row.original.CreatedAt).toLocaleString() },
        { header: 'Type', accessorKey: 'EntryType' },
        { header: 'Reference', accessorKey: 'Description' },
        { header: 'Amount (RM)', accessorKey: 'Amount', cell: ({ row }) => {
            const amount = parseFloat(row.original.Amount);
            return <span className={amount > 0 ? "text-red-600" : "text-green-600"}>{amount > 0 ? '+' : ''}{amount.toFixed(2)}</span>;
        } },
        { header: 'Running Balance', accessorKey: 'RunningBalance', cell: ({ row }) => <span className="font-bold">{parseFloat(row.original.RunningBalance).toFixed(2)}</span> },
    ];

    return (
        <div className="space-y-6">
            <Button variant="ghost" className="mb-2 -ml-4" onClick={() => navigate('/agents')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Agents
            </Button>

            <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold">{agent?.DisplayName || 'Loading...'}</h1>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${agent?.IsActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {agent?.IsActive ? 'Active' : 'Suspended'}
                        </span>
                    </div>
                    <p className="text-gray-500 mt-1">ID: {id} • {agent?.Email}</p>
                    
                    <div className="mt-6 flex space-x-8">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Debt</p>
                            <p className="text-2xl font-bold text-red-600">RM {agent?.ledger?.[0] ? parseFloat(agent.ledger[0].RunningBalance).toFixed(2) : '0.00'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Credit Limit</p>
                            <div className="flex items-center space-x-2">
                                <p className="text-2xl font-bold text-gray-900">RM {agent?.CreditLimit ? parseFloat(agent.CreditLimit).toFixed(2) : '0.00'}</p>
                                <button 
                                    className="text-indigo-600 hover:text-indigo-800"
                                    onClick={() => { setNewLimit(agent?.CreditLimit || 0); setIsLimitModalOpen(true); }}
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex space-x-2 flex-col items-end gap-2">
                    <div className="flex space-x-2">
                        <Button 
                            variant="outline" 
                            className={agent?.IsActive ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-600 border-green-200 hover:bg-green-50"}
                            onClick={() => suspendAgent.mutate({ agentId: id, isActive: !agent?.IsActive })}
                        >
                            <AlertCircle className="w-4 h-4 mr-2" /> {agent?.IsActive ? 'Suspend' : 'Activate'}
                        </Button>
                        <Button onClick={() => setIsPaymentModalOpen(true)}>Add Manual Payment</Button>
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => navigate(`/agents/${id}/statement`)}>View Statement</Button>
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
                        <DataTable columns={ledgerColumns} data={agent?.ledger || []} isLoading={isLoading} />
                    </div>
                )}
                {activeTab === 'orders' && (
                    <div className="p-12 text-center text-gray-500">
                        Order history will be displayed here.
                    </div>
                )}
            </div>

            {/* Credit Limit Modal */}
            {isLimitModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b">
                            <h2 className="text-lg font-bold">Edit Credit Limit</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Limit (RM)</label>
                                <Input 
                                    type="number" 
                                    value={newLimit} 
                                    onChange={(e) => setNewLimit(e.target.value)} 
                                    autoFocus 
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsLimitModalOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    updateCreditLimit.mutate({ agentId: id, newLimit: parseFloat(newLimit) });
                                    setIsLimitModalOpen(false);
                                }}
                                disabled={updateCreditLimit.isPending}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Manual Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b">
                            <h2 className="text-lg font-bold">Add Manual Payment</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (RM)</label>
                                <Input 
                                    type="number" 
                                    value={paymentAmount} 
                                    onChange={(e) => setPaymentAmount(e.target.value)} 
                                    autoFocus 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Note</label>
                                <Input 
                                    type="text" 
                                    placeholder="e.g. DuitNow Transfer 12/6"
                                    value={paymentRef} 
                                    onChange={(e) => setPaymentRef(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    addManualPayment.mutate({ agentId: id, amount: parseFloat(paymentAmount), reference: paymentRef });
                                    setIsPaymentModalOpen(false);
                                }}
                                disabled={!paymentAmount || addManualPayment.isPending}
                            >
                                Submit Payment
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
