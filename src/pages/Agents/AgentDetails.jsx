import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAgentDetails, useAgentMutations, useAgentRecentOrders } from '@/hooks/useAgentManagement';
import { MoreHorizontal, Download as DownloadIcon, ChevronRight } from 'lucide-react';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AgentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ledger');
    const { recordPayout } = useAgentMutations();
    
    const { data: agent, isLoading } = useAgentDetails(id);
    const { data: recentOrders, isLoading: isOrdersLoading } = useAgentRecentOrders(id);
    
    
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutRef, setPayoutRef] = useState('');
    const [viewAwbUrl, setViewAwbUrl] = useState(null);

    const ledgerColumns = [
        { 
            header: 'Date', 
            accessorKey: 'CreatedAt', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            } 
        },
        { 
            header: 'Time', 
            id: 'time', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            } 
        },
        { 
            header: () => <div className="text-center">Type</div>, 
            accessorKey: 'EntryType',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Badge variant="outline" className="bg-white rounded-md font-medium text-xs border-gray-200 px-2.5 py-0.5 shadow-xs">
                        {row.original.EntryType || 'Payout'}
                    </Badge>
                </div>
            )
        },
        { 
            header: 'Reference', 
            accessorKey: 'Description',
            cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.Description || '—'}</span>
        },
        { 
            header: () => <div className="text-right">Amount Paid</div>, 
            accessorKey: 'Amount', 
            cell: ({ row }) => {
                const amount = Math.abs(parseFloat(row.original.Amount || 0));
                return <div className="text-right font-medium text-emerald-600">RM {amount.toFixed(2)}</div>;
            } 
        },
    ];

    const handleDirectDownload = async (url, orderId, createdAt, platform) => {
        try {
            const res = await fetch(`/api/proxy-pdf?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error('Failed to fetch file for download');
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            let fileName = '';
            const dateObj = createdAt ? new Date(createdAt) : null;
            if (dateObj && !isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                const dateStr = `${year}${month}${day}`;
                const timeStr = `${hours}${minutes}`;
                const staffId = agent?.StaffID || agent?.staffId || id || 'Agent';
                const prefix = (platform && platform !== 'TikTok' && platform !== 'TikTokShop') ? platform : 'TikTokSeller';
                fileName = `${prefix}-${staffId}-${orderId || 'Order'}-${dateStr}-${timeStr}.pdf`;
            } else if (url) {
                const urlName = decodeURIComponent(url.split('/').pop().split('?')[0]);
                if (urlName.endsWith('.pdf')) {
                    fileName = urlName;
                }
            }
            if (!fileName) {
                fileName = `Order-${orderId || 'AWB'}.pdf`;
            }

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            setViewAwbUrl(url);
        }
    };

    const orderColumns = [
        { 
            header: 'Date', 
            accessorKey: 'CreatedAt', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            } 
        },
        { 
            header: 'Time', 
            id: 'time', 
            cell: ({ row }) => {
                const date = new Date(row.original.CreatedAt);
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            } 
        },
        { 
            header: 'Order ID', 
            accessorKey: 'PlatformOrderID', 
            cell: ({ row }) => <span className="font-semibold text-gray-900">{row.original.PlatformOrderID}</span> 
        },
        { 
            header: () => <div className="text-center">Platform</div>, 
            accessorKey: 'Platform',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Badge variant="outline" className="bg-white rounded-md font-medium text-xs border-gray-200 px-2.5 py-0.5 shadow-xs">
                        {row.original.Platform || 'TikTok'}
                    </Badge>
                </div>
            )
        },
        { 
            header: () => <div className="text-right">Amount</div>, 
            accessorKey: 'OrderAmount', 
            cell: ({ row }) => (
                <div className="text-right font-medium text-emerald-600">
                    RM {parseFloat(row.original.OrderAmount || 0).toFixed(2)}
                </div>
            )
        },
        {
            header: () => <div className="text-center">Download</div>,
            id: 'download',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDirectDownload(row.original.AwbUrl, row.original.PlatformOrderID, row.original.CreatedAt, row.original.Platform)}
                        disabled={!row.original.AwbUrl}
                        className="h-7 px-3 border-gray-200 bg-white hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 font-medium text-xs rounded-md shadow-xs transition-all cursor-pointer"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Download
                    </Button>
                </div>
            )
        },
        {
            header: () => <div className="text-center">Action</div>,
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setViewAwbUrl(row.original.AwbUrl)}
                        disabled={!row.original.AwbUrl}
                        className="h-7 px-3 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-300 font-medium text-xs rounded-md shadow-xs transition-all cursor-pointer"
                    >
                        View <ChevronRight className="w-3.5 h-3.5 ml-1 text-gray-400" />
                    </Button>
                </div>
            )
        }
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
                    </div>
                    
                    <div className="mt-6 flex space-x-8">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Sales</p>
                            <p className="text-2xl font-bold text-green-600">RM {agent?.totalSales !== undefined ? agent.totalSales.toFixed(2) : '0.00'}</p>
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
                        Payout
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'orders' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Orders
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
                    <div className="p-4">
                        {isOrdersLoading ? (
                            <div className="p-8 text-center text-gray-500">Loading recent orders...</div>
                        ) : (
                            <DataTable 
                                columns={orderColumns} 
                                data={recentOrders || []} 
                                searchPlaceholder="Search" 
                            />
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
