import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { useAgentDetails, useAgentMutations, useAgentOrderImports } from '@/hooks/useAgentManagement';
import { Download, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function AgentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ledger');
    const { recordPayout } = useAgentMutations();
    
    const { data: agent, isLoading } = useAgentDetails(id);
    const { data: imports, isLoading: isImportsLoading } = useAgentOrderImports(id);
    const queryClient = useQueryClient();
    
    
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutRef, setPayoutRef] = useState('');

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

    const handleDownloadAwb = async (fileName) => {
        try {
            const res = await fetch('/api/get-r2-download-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName })
            });
            if (!res.ok) throw new Error('Gagal dapatkan link muat turun');
            const { url } = await res.json();
            window.open(url, '_blank');
        } catch (error) {
            console.error(error);
            alert('Gagal muat turun AWB.');
        }
    };

    const handleClearCloud = async (fileName, importId) => {
        if (!confirm('Anda pasti fail ni dah selamat di-download? Ia akan dipadam dari Cloudflare R2 secara kekal.')) return;
        try {
            // Delete from Cloudflare R2
            const res = await fetch('/api/delete-r2-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName })
            });
            if (!res.ok) throw new Error('Gagal padam dari R2');

            // Update database status
            const { error } = await supabase
                .from('OrderImports')
                .update({ IsAwbDeleted: true })
                .eq('ImportID', importId);
            
            if (error) throw error;
            
            queryClient.invalidateQueries(['admin', 'agents', 'imports', id]);
        } catch (error) {
            console.error(error);
            alert('Gagal padam AWB dari Cloud.');
        }
    };

    const importColumns = [
        { header: 'Date Scan', accessorKey: 'CreatedAt', cell: ({ row }) => new Date(row.original.CreatedAt).toLocaleString() },
        { header: 'Platform', accessorKey: 'Platform' },
        { header: 'Fail AWB', accessorKey: 'FileName', cell: ({ row }) => (
            <span className="text-gray-600 text-sm font-mono">{row.original.FileName}</span>
        )},
        { header: 'Tindakan Storage', id: 'actions', cell: ({ row }) => {
            const isDeleted = row.original.IsAwbDeleted;
            if (isDeleted) {
                return <span className="inline-flex items-center text-green-600 text-sm font-medium"><CheckCircle2 className="w-4 h-4 mr-1" /> Cloud Cleared</span>;
            }
            return (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownloadAwb(row.original.FileName)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleClearCloud(row.original.FileName, row.original.ImportID)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Clear Storage
                    </Button>
                </div>
            );
        }}
    ];

    return (
        <div className="space-y-6">
            <Button variant="ghost" className="mb-2 -ml-4" onClick={() => navigate('/Agent-Management')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-start">
                <div>
                    <div className="flex flex-col mb-4">
                        <div className="flex items-center space-x-3 mb-1">
                            <h1 className="text-2xl font-bold">{agent?.DisplayName || 'Loading...'}</h1>
                            <span className="relative flex h-3 w-3" title={agent?.IsActive ? 'Active' : 'Suspended'}>
                                {agent?.IsActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${agent?.IsActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                        </div>
                        <p className="text-gray-600 font-medium">{agent?.StaffID || id}</p>
                        <p className="text-gray-500">{agent?.Email}</p>
                    </div>
                    
                    <div className="mt-6 flex space-x-8">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Commission</p>
                            <p className="text-2xl font-bold text-green-600">RM {agent?.ledger?.[0] ? parseFloat(agent.ledger[0].RunningBalance).toFixed(2) : '0.00'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3 items-center">
                    <Button variant="secondary" onClick={() => navigate(`/Agent-Management/${id}/Statement`)}>
                        View Statement
                    </Button>
                    <Button onClick={() => setIsPayoutModalOpen(true)}>
                        Record Payout
                    </Button>
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
                    <button
                        onClick={() => setActiveTab('imports')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'imports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        AWB Imports
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
                <div className="bg-white rounded-xl shadow-sm border p-6 text-center text-gray-500">
                    Order history will be integrated here
                </div>
            )}

            {activeTab === 'imports' && (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {isImportsLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading AWB imports...</div>
                    ) : (
                        <DataTable columns={importColumns} data={imports || []} searchPlaceholder="Cari Nama Fail AWB..." />
                    )}
                </div>
            )}
            </div>

            {/* Record Payout Modal */}
            {isPayoutModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b">
                            <h2 className="text-lg font-bold">Record Payout</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (RM)</label>
                                <Input 
                                    type="number" 
                                    value={payoutAmount} 
                                    onChange={(e) => setPayoutAmount(e.target.value)} 
                                    autoFocus 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Note</label>
                                <Input 
                                    type="text" 
                                    placeholder="e.g. DuitNow Transfer 12/6"
                                    value={payoutRef} 
                                    onChange={(e) => setPayoutRef(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setIsPayoutModalOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    recordPayout.mutate({ agentId: id, amount: parseFloat(payoutAmount), reference: payoutRef });
                                    setIsPayoutModalOpen(false);
                                }}
                                disabled={!payoutAmount || recordPayout.isPending}
                            >
                                Submit Payout
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
