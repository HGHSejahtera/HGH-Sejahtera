import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download as DownloadIcon, ChevronRight, Calendar, X } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAgentDetails, useAgentMutations, useAgentRecentOrders } from '@/hooks/useAgentManagement';
import { AwbPdfViewer } from '@/components/common/AwbPdfViewer';
import { cn } from '@/lib/utils';

const MonthOptions = [
    { label: 'All Months', value: 'All' },
    { label: 'January', value: '0' },
    { label: 'February', value: '1' },
    { label: 'March', value: '2' },
    { label: 'April', value: '3' },
    { label: 'May', value: '4' },
    { label: 'June', value: '5' },
    { label: 'July', value: '6' },
    { label: 'August', value: '7' },
    { label: 'September', value: '8' },
    { label: 'October', value: '9' },
    { label: 'November', value: '10' },
    { label: 'December', value: '11' },
];

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

    // Filter states for Orders Tab - Default to current active month
    const [filterPlatform, setFilterPlatform] = useState('All');
    const [filterAccount, setFilterAccount] = useState('All');
    const [filterMonth, setFilterMonth] = useState(() => String(new Date().getMonth()));
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [ordersSortBy, setOrdersSortBy] = useState('newest');

    // Filter states for Payout/Ledger Tab - Default to current active month
    const [filterEntryType, setFilterEntryType] = useState('All');
    const [ledgerMonth, setLedgerMonth] = useState(() => String(new Date().getMonth()));
    const [ledgerDateRange, setLedgerDateRange] = useState({ from: '', to: '' });
    const [ledgerSortBy, setLedgerSortBy] = useState('newest');

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

    const uniquePlatforms = useMemo(() => {
        const platforms = new Set((recentOrders || []).filter(o => o.Platform).map(o => o.Platform));
        return ['All', ...Array.from(platforms).sort()];
    }, [recentOrders]);

    const uniqueAccounts = useMemo(() => {
        const accounts = new Set((recentOrders || []).filter(o => o.AccountName).map(o => o.AccountName));
        return ['All', ...Array.from(accounts).sort()];
    }, [recentOrders]);

    const uniqueEntryTypes = useMemo(() => {
        const types = new Set((agent?.ledger || []).filter(l => l.EntryType).map(l => l.EntryType));
        return ['All', ...Array.from(types).sort()];
    }, [agent?.ledger]);

    const filteredOrders = useMemo(() => {
        let list = recentOrders || [];
        if (filterPlatform !== 'All') list = list.filter(o => o.Platform === filterPlatform);
        if (filterAccount !== 'All') list = list.filter(o => o.AccountName === filterAccount);

        const hasDateRange = Boolean(dateRange.from || dateRange.to);
        if (!hasDateRange && filterMonth !== 'All') {
            list = list.filter(o => new Date(o.CreatedAt || 0).getMonth() === Number(filterMonth));
        }
        if (dateRange.from) {
            const fromTime = new Date(`${dateRange.from}T00:00:00`).getTime();
            list = list.filter(o => new Date(o.CreatedAt || 0).getTime() >= fromTime);
        }
        if (dateRange.to) {
            const toTime = new Date(`${dateRange.to}T23:59:59`).getTime();
            list = list.filter(o => new Date(o.CreatedAt || 0).getTime() <= toTime);
        }

        return [...list].sort((a, b) => {
            if (ordersSortBy === 'oldest') return new Date(a.CreatedAt || 0) - new Date(b.CreatedAt || 0);
            if (ordersSortBy === 'amount_desc') return (parseFloat(b.OrderAmount || b.DisplayAmount || 0)) - (parseFloat(a.OrderAmount || a.DisplayAmount || 0));
            if (ordersSortBy === 'amount_asc') return (parseFloat(a.OrderAmount || a.DisplayAmount || 0)) - (parseFloat(b.OrderAmount || b.DisplayAmount || 0));
            return new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0);
        });
    }, [recentOrders, filterPlatform, filterAccount, filterMonth, dateRange.from, dateRange.to, ordersSortBy]);

    const filteredLedger = useMemo(() => {
        let list = agent?.ledger || [];
        if (filterEntryType !== 'All') list = list.filter(l => (l.EntryType || 'Payout') === filterEntryType);

        const hasDateRange = Boolean(ledgerDateRange.from || ledgerDateRange.to);
        if (!hasDateRange && ledgerMonth !== 'All') {
            list = list.filter(l => new Date(l.CreatedAt || 0).getMonth() === Number(ledgerMonth));
        }
        if (ledgerDateRange.from) {
            const fromTime = new Date(`${ledgerDateRange.from}T00:00:00`).getTime();
            list = list.filter(l => new Date(l.CreatedAt || 0).getTime() >= fromTime);
        }
        if (ledgerDateRange.to) {
            const toTime = new Date(`${ledgerDateRange.to}T23:59:59`).getTime();
            list = list.filter(l => new Date(l.CreatedAt || 0).getTime() <= toTime);
        }

        return [...list].sort((a, b) => {
            if (ledgerSortBy === 'oldest') return new Date(a.CreatedAt || 0) - new Date(b.CreatedAt || 0);
            if (ledgerSortBy === 'amount_desc') return Math.abs(parseFloat(b.Amount || 0)) - Math.abs(parseFloat(a.Amount || 0));
            if (ledgerSortBy === 'amount_asc') return Math.abs(parseFloat(a.Amount || 0)) - Math.abs(parseFloat(b.Amount || 0));
            return new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0);
        });
    }, [agent?.ledger, filterEntryType, ledgerMonth, ledgerDateRange.from, ledgerDateRange.to, ledgerSortBy]);

    const displayTotalSales = useMemo(() => {
        let list = recentOrders || [];
        if (activeTab === 'orders') {
            return filteredOrders.reduce((sum, o) => sum + (parseFloat(o.OrderAmount || o.DisplayAmount || 0)), 0);
        } else {
            const hasDateRange = Boolean(ledgerDateRange.from || ledgerDateRange.to);
            if (!hasDateRange && ledgerMonth !== 'All') {
                list = list.filter(o => new Date(o.CreatedAt || 0).getMonth() === Number(ledgerMonth));
            }
            if (ledgerDateRange.from) {
                const fromTime = new Date(`${ledgerDateRange.from}T00:00:00`).getTime();
                list = list.filter(o => new Date(o.CreatedAt || 0).getTime() >= fromTime);
            }
            if (ledgerDateRange.to) {
                const toTime = new Date(`${ledgerDateRange.to}T23:59:59`).getTime();
                list = list.filter(o => new Date(o.CreatedAt || 0).getTime() <= toTime);
            }
            return list.reduce((sum, o) => sum + (parseFloat(o.OrderAmount || o.DisplayAmount || 0)), 0);
        }
    }, [recentOrders, filteredOrders, activeTab, ledgerMonth, ledgerDateRange.from, ledgerDateRange.to]);

    const selectedPeriodLabel = useMemo(() => {
        if (activeTab === 'orders') {
            if (dateRange.from && dateRange.to) {
                return `${new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            }
            if (dateRange.from) return `From ${new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            if (dateRange.to) return `Until ${new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            if (filterMonth !== 'All') {
                const found = MonthOptions.find(m => m.value === filterMonth);
                return found ? found.label : 'Current Month';
            }
            return 'All Months';
        } else {
            if (ledgerDateRange.from && ledgerDateRange.to) {
                return `${new Date(ledgerDateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(ledgerDateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            }
            if (ledgerDateRange.from) return `From ${new Date(ledgerDateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            if (ledgerDateRange.to) return `Until ${new Date(ledgerDateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
            if (ledgerMonth !== 'All') {
                const found = MonthOptions.find(m => m.value === ledgerMonth);
                return found ? found.label : 'Current Month';
            }
            return 'All Months';
        }
    }, [activeTab, filterMonth, dateRange.from, dateRange.to, ledgerMonth, ledgerDateRange.from, ledgerDateRange.to]);

    const ordersActionElement = (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Platform:</span>
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                    <SelectTrigger className="h-8 w-[100px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {uniquePlatforms.map(platform => (
                            <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Account:</span>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                    <SelectTrigger className="h-8 w-[100px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {uniqueAccounts.map(account => (
                            <SelectItem key={account} value={account}>{account}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Month:</span>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 max-h-[260px]">
                        {MonthOptions.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Airbnb-Style Date Range Picker */}
            <div className="flex items-center ml-1">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className={cn(
                                "h-8 px-2.5 rounded-md border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium shadow-xs transition-colors flex items-center gap-2 cursor-pointer",
                                (dateRange.from || dateRange.to) ? "border-indigo-600 text-indigo-600 bg-indigo-50/60 font-semibold" : "text-gray-700"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {dateRange.from && dateRange.to 
                                ? `${new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : dateRange.from 
                                ? `${new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — Select To Date`
                                : "Select Dates"}
                            {(dateRange.from || dateRange.to) && (
                                <span 
                                    className="p-0.5 rounded-md hover:bg-indigo-200/60 text-indigo-500 transition-colors ml-0.5 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setDateRange({ from: '', to: '' }); }}
                                    title="Clear dates"
                                >
                                    <X className="w-3 h-3" />
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-[360px] p-4 rounded-md shadow-lg border border-gray-200 bg-white">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Select Date Range</h4>
                                <p className="text-xs text-gray-500">Filter agent orders by exact dates.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 border border-gray-200 rounded-md">
                                <div className="p-2 border-r border-gray-200">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">FROM</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.from} 
                                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                                <div className="p-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TO</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.to} 
                                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quick shortcuts</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            setDateRange({ from: today, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Today
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const today = new Date();
                                            const last7 = new Date();
                                            last7.setDate(today.getDate() - 6);
                                            setDateRange({ 
                                                from: last7.toISOString().split('T')[0], 
                                                to: today.toISOString().split('T')[0] 
                                            });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Last 7 Days
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                                            const today = now.toISOString().split('T')[0];
                                            setDateRange({ from: firstDay, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        This Month
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setDateRange({ from: '', to: '' })}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer ml-auto"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Sort By:</span>
                <Select value={ordersSortBy} onValueChange={setOrdersSortBy}>
                    <SelectTrigger className="h-8 w-[140px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="amount_desc">Amount High to Low</SelectItem>
                        <SelectItem value="amount_asc">Amount Low to High</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const ledgerActionElement = (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Type:</span>
                <Select value={filterEntryType} onValueChange={setFilterEntryType}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        {uniqueEntryTypes.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Month:</span>
                <Select value={ledgerMonth} onValueChange={setLedgerMonth}>
                    <SelectTrigger className="h-8 w-[110px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 max-h-[260px]">
                        {MonthOptions.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Airbnb-Style Date Range Picker for Ledger */}
            <div className="flex items-center ml-1">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className={cn(
                                "h-8 px-2.5 rounded-md border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium shadow-xs transition-colors flex items-center gap-2 cursor-pointer",
                                (ledgerDateRange.from || ledgerDateRange.to) ? "border-indigo-600 text-indigo-600 bg-indigo-50/60 font-semibold" : "text-gray-700"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            {ledgerDateRange.from && ledgerDateRange.to 
                                ? `${new Date(ledgerDateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(ledgerDateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                : ledgerDateRange.from 
                                ? `${new Date(ledgerDateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — Select To Date`
                                : "Select Dates"}
                            {(ledgerDateRange.from || ledgerDateRange.to) && (
                                <span 
                                    className="p-0.5 rounded-md hover:bg-indigo-200/60 text-indigo-500 transition-colors ml-0.5 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setLedgerDateRange({ from: '', to: '' }); }}
                                    title="Clear dates"
                                >
                                    <X className="w-3 h-3" />
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-[360px] p-4 rounded-md shadow-lg border border-gray-200 bg-white">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Select Date Range</h4>
                                <p className="text-xs text-gray-500">Filter agent payouts and ledger by exact dates.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 border border-gray-200 rounded-md">
                                <div className="p-2 border-r border-gray-200">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">FROM</label>
                                    <input 
                                        type="date" 
                                        value={ledgerDateRange.from} 
                                        onChange={(e) => setLedgerDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                                <div className="p-2">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">TO</label>
                                    <input 
                                        type="date" 
                                        value={ledgerDateRange.to} 
                                        onChange={(e) => setLedgerDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-hidden cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quick shortcuts</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            setLedgerDateRange({ from: today, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Today
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const today = new Date();
                                            const last7 = new Date();
                                            last7.setDate(today.getDate() - 6);
                                            setLedgerDateRange({ 
                                                from: last7.toISOString().split('T')[0], 
                                                to: today.toISOString().split('T')[0] 
                                            });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        Last 7 Days
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                                            const today = now.toISOString().split('T')[0];
                                            setLedgerDateRange({ from: firstDay, to: today });
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                                    >
                                        This Month
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setLedgerDateRange({ from: '', to: '' })}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer ml-auto"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-1 text-xs ml-1">
                <span className="text-gray-500 font-medium mr-1">Sort By:</span>
                <Select value={ledgerSortBy} onValueChange={setLedgerSortBy}>
                    <SelectTrigger className="h-8 w-[140px] bg-white text-xs font-medium rounded-md border-gray-200 hover:border-gray-300 shadow-xs transition-colors cursor-pointer">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200">
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="amount_desc">Amount High to Low</SelectItem>
                        <SelectItem value="amount_asc">Amount Low to High</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

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
                            <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                                Total Sales
                                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {selectedPeriodLabel}
                                </span>
                            </p>
                            <p className="text-2xl font-bold text-green-600">RM {displayTotalSales.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3 items-center">
                    <Button variant="secondary" onClick={() => navigate(`/Agent-Management/${id}/Statement`)}>
                        View Statement
                    </Button>
                    <Button onClick={() => navigate(`/Agent-Management/${id}/Records`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                        Records
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
                        <DataTable 
                            columns={ledgerColumns} 
                            data={filteredLedger} 
                            isLoading={isLoading} 
                            searchPlaceholder="Search"
                            actionElement={ledgerActionElement}
                        />
                    </div>
                )}
                {activeTab === 'orders' && (
                    <div className="p-4">
                        {isOrdersLoading ? (
                            <div className="p-8 text-center text-gray-500">Loading recent orders...</div>
                        ) : (
                            <DataTable 
                                columns={orderColumns} 
                                data={filteredOrders} 
                                searchPlaceholder="Search" 
                                actionElement={ordersActionElement}
                                defaultPageSize={999999}
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
