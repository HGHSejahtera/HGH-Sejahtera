import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentStatement, useAgentMutations } from '@/hooks/useAgentManagement';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';

export function AgentStatement() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const today = new Date();
    
    const qMonth = parseInt(searchParams.get('month'), 10);
    const qYear = parseInt(searchParams.get('year'), 10);

    // Initialize from query param or default to current month and year
    const [selectedMonth, setSelectedMonth] = useState((!isNaN(qMonth) && qMonth >= 1 && qMonth <= 12) ? qMonth : (today.getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState((!isNaN(qYear) && qYear >= 2020) ? qYear : today.getFullYear());

    const { data, isLoading } = useAgentStatement(id, selectedMonth, selectedYear);
    const { data: settings = {} } = useSettings();
    const { closeMonthlyStatement, recordPayout } = useAgentMutations();
    const [isPayoutLoading, setIsPayoutLoading] = useState(false);
    const [totalPayoutInput, setTotalPayoutInput] = useState('');
    const [totalCOGSInput, setTotalCOGSInput] = useState('');

    const [payoutAmountInput, setPayoutAmountInput] = useState('');
    const [payoutRefInput, setPayoutRefInput] = useState('');
    const [isRecordingPayout, setIsRecordingPayout] = useState(false);
    const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(null);

    useEffect(() => {
        if (data?.statement?.totalCOGS !== undefined && data?.statement?.totalCOGS !== null) {
            const formatted = Number(data.statement.totalCOGS).toFixed(2);
            queueMicrotask(() => {
                setTotalCOGSInput(formatted);
            });
        }
    }, [data?.statement?.totalCOGS, selectedMonth, selectedYear]);

    const handlePrint = () => {
        window.print();
    };

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [settlementSuccess, setSettlementSuccess] = useState(false);
    const [settleError, setSettleError] = useState(null);

    const handleOpenSettleConfirm = () => {
        const hasSettlement = totalPayoutInput !== '' && totalCOGSInput !== '';
        const hasPayout = payoutAmountInput !== '' && parseFloat(payoutAmountInput) > 0;
        if (!hasSettlement && !hasPayout) return;
        setSettlementSuccess(false);
        setSettleError(null);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmSettle = async () => {
        const salesVal = parseFloat(totalPayoutInput || 0);
        const billVal = parseFloat(totalCOGSInput || 0);
        const payoutVal = parseFloat(payoutAmountInput || 0);
        const hasSettlement = totalPayoutInput !== '' && totalCOGSInput !== '';
        const hasPayout = payoutAmountInput !== '' && !isNaN(payoutVal) && payoutVal > 0;

        if (!hasSettlement && !hasPayout) return;

        setIsPayoutLoading(true);
        setSettleError(null);
        try {
            if (hasSettlement) {
                await closeMonthlyStatement.mutateAsync({
                    agentId: id,
                    month: selectedMonth,
                    year: selectedYear,
                    totalPayout: salesVal,
                    totalCOGS: billVal
                });
            }
            if (hasPayout) {
                await recordPayout.mutateAsync({
                    agentId: id,
                    amount: payoutVal,
                    reference: payoutRefInput || `Payout on ${new Date().toLocaleDateString('en-MY')}`
                });
            }
            setSettlementSuccess(true);
            setTotalPayoutInput('');
            setTotalCOGSInput('');
            setPayoutAmountInput('');
            setPayoutRefInput('');
        } catch (error) {
            console.error(error);
            setSettleError(error.message || 'Failed to record settlement.');
        } finally {
            setIsPayoutLoading(false);
        }
    };

    const handleRecordPayout = async () => {
        const amount = parseFloat(payoutAmountInput);
        if (!amount || amount <= 0) return;
        setIsRecordingPayout(true);
        setPayoutSuccessMsg(null);
        try {
            await recordPayout.mutateAsync({
                agentId: id,
                amount: amount,
                reference: payoutRefInput || `Payout on ${new Date().toLocaleDateString('en-MY')}`
            });
            setPayoutAmountInput('');
            setPayoutRefInput('');
            setPayoutSuccessMsg('Payout recorded successfully!');
            setTimeout(() => setPayoutSuccessMsg(null), 4000);
        } catch (error) {
            console.error(error);
            setPayoutSuccessMsg('Failed: ' + error.message);
        } finally {
            setIsRecordingPayout(false);
        }
    };

    const formatMYR = (amount) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR'
        }).format(amount);
    };

    // Generate month options (e.g., 1 = January)
    const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(i);
        return { value: i + 1, label: d.toLocaleString('en-US', { month: 'long' }) };
    });

    // Generate year options (current year down to 2024)
    const years = Array.from({ length: today.getFullYear() - 2023 }, (_, i) => today.getFullYear() - i);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64 text-gray-500">Generating statement...</div>;
    }

    if (!data?.agent) {
        return <div className="text-center py-12 text-gray-500">Agent not found or you do not have permission.</div>;
    }

    const { agent, statement } = data;

    // Calculate live preview responsive values when typing in Profit Settlement or Record Payout box
    const typedSales = parseFloat(totalPayoutInput || 0);
    const typedCOGS = parseFloat(totalCOGSInput !== '' ? totalCOGSInput : (statement.totalCOGS || 0));
    const isPreviewActive = totalPayoutInput !== '' && !isNaN(typedSales);

    const typedPayout = parseFloat(payoutAmountInput || 0);
    const isPayoutPreviewActive = payoutAmountInput !== '' && !isNaN(typedPayout) && typedPayout > 0;

    const displayCommission = isPreviewActive 
        ? Number((typedSales - typedCOGS).toFixed(2))
        : statement.totalCharges;

    const displayPayouts = isPayoutPreviewActive
        ? Number((statement.totalPayments + typedPayout).toFixed(2))
        : statement.totalPayments;

    const displayClosingBalance = Number((statement.openingBalance + displayCommission - displayPayouts).toFixed(2));

    // Responsive live transactions list for Transaction Activity
    const responsiveTransactions = [...(statement.transactions || [])];

    if (isPreviewActive || (totalCOGSInput !== '' && !isNaN(typedCOGS))) {
        const liveNetProfit = Number((typedSales - typedCOGS).toFixed(2));
        if (liveNetProfit !== 0 || isPreviewActive) {
            responsiveTransactions.push({
                LedgerEntryID: 'preview-settlement',
                CreatedAt: new Date().toISOString(),
                EntryType: 'Profit Settlement',
                Description: `${months[selectedMonth - 1].label} ${selectedYear}`,
                Amount: liveNetProfit,
                isLivePreview: true
            });
        }
    }

    if (isPayoutPreviewActive) {
        responsiveTransactions.push({
            LedgerEntryID: 'preview-payout',
            CreatedAt: new Date().toISOString(),
            EntryType: 'Payout',
            Description: payoutRefInput || 'Cash Payout',
            Amount: -typedPayout,
            isLivePreview: true
        });
    }

    // Dynamic running balance calculation
    let runningBal = parseFloat(statement.openingBalance || 0);
    const computedTransactions = responsiveTransactions.map((trx) => {
        const amt = parseFloat(trx.Amount || 0);
        runningBal += amt;
        return {
            ...trx,
            RunningBalance: runningBal
        };
    });

    return (
        <div className="max-w-[1400px] mx-auto pb-12 px-4 md:px-8 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
            <div className="max-w-[1340px] mx-auto flex flex-col lg:flex-row gap-6 items-start justify-center print:block print:w-full print:max-w-none print:m-0 print:p-0">
                {/* Column 1: Horizontal Aligned Back Button */}
                <div className="print:hidden pt-0 shrink-0">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(`/Agent-Management/${id}`)} 
                        className="text-gray-600 hover:text-gray-900 h-9 px-3 font-semibold text-xs uppercase tracking-wider"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                    </Button>
                </div>
                
                {/* Column 2: Main Document Area (800px) */}
                <div id="printable-statement" className="w-full max-w-[800px] flex-1 bg-white shadow-md print:shadow-none print:p-0 p-8 md:p-10 border border-gray-200 print:border-none min-h-[1056px] print:min-h-0 rounded-none print:w-full print:max-w-none print:m-0 print:block">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-8">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                                {settings.CompanyName || 'HGH SEJAHTERA'}
                            </h1>
                            {settings.CompanySSM && (
                                <p className="text-gray-500 text-xs mt-0.5 font-medium">({settings.CompanySSM})</p>
                            )}
                            <p className="text-gray-600 text-xs mt-2 whitespace-pre-line leading-relaxed max-w-xs">
                                {settings.CompanyAddress || 'No. 123, Jalan Niaga, Pusat Bandar\n50000 Kuala Lumpur, Malaysia'}
                            </p>
                            {settings.SupportEmail && (
                                <p className="text-gray-600 text-xs mt-1">Email: {settings.SupportEmail}</p>
                            )}
                        </div>
                        <div className="flex flex-col items-end text-right">
                            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none">STATEMENT</h2>
                            <div className="mt-2 text-right">
                                <span className="text-base font-bold text-gray-900">
                                    {new Date(statement.year, statement.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bill To & Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-start">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Prepared For</p>
                            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{agent.DisplayName}</h3>
                            {agent.StaffID && (
                                <p className="text-xs text-gray-600 font-mono mt-1 font-medium">{agent.StaffID}</p>
                            )}
                        </div>
                        
                        {/* Summary Card */}
                        <div className="border border-gray-200 bg-white rounded-none p-6 shadow-xs">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Statement Summary</span>
                                <span className="text-xs font-semibold text-gray-900">
                                    {months[selectedMonth - 1].label} {selectedYear}
                                </span>
                            </div>

                            <div className="py-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
                                    <div>
                                        <p className="text-[11px] text-gray-500 font-medium">Orders</p>
                                        <p className="text-lg font-bold text-gray-900 font-mono mt-0.5">{statement.totalOrders || 0}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-gray-500 font-medium">COGS (-)</p>
                                        <p className="text-lg font-bold text-gray-700 font-mono mt-0.5">{formatMYR(statement.totalCOGS || 0)}</p>
                                    </div>
                                </div>

                                <div className="space-y-2.5 text-xs pt-1">
                                    {statement.openingBalance > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Opening Balance</span>
                                            <span className="font-mono font-medium text-gray-900">{formatMYR(statement.openingBalance)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Commission</span>
                                        <span className="font-mono font-bold text-emerald-600">
                                            +{formatMYR(displayCommission)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Payouts</span>
                                        <span className="font-mono font-bold text-red-600">
                                            -{formatMYR(displayPayouts)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">PAID</span>
                                <span className="text-xl font-bold text-gray-900 font-mono">{formatMYR(displayPayouts)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Transactions */}
                    <div className="mt-8 border border-gray-200 rounded-none overflow-hidden bg-white shadow-xs">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-900">
                                Transaction Activity
                            </h3>
                        </div>
                        
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="px-6 py-3.5">Date</th>
                                    <th className="px-6 py-3.5">Reference</th>
                                    <th className="px-6 py-3.5 text-right">Commission</th>
                                    <th className="px-6 py-3.5 text-right">Payouts</th>
                                    <th className="px-6 py-3.5 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {computedTransactions.map((trx) => {
                                    const amt = parseFloat(trx.Amount);
                                    return (
                                        <tr key={trx.LedgerEntryID} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-3.5 text-gray-600 font-mono whitespace-nowrap">
                                                {new Date(trx.CreatedAt).toLocaleDateString('en-MY')}
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <div className="font-semibold text-gray-900">
                                                    {trx.EntryType}
                                                </div>
                                                <div className="text-gray-500 mt-0.5">{trx.Description || trx.ReferenceID || '-'}</div>
                                            </td>
                                            <td className="px-6 py-3.5 text-right text-emerald-600 font-semibold font-mono whitespace-nowrap">
                                                {amt > 0 ? `+${formatMYR(amt)}` : ''}
                                            </td>
                                            <td className="px-6 py-3.5 text-right text-red-600 font-semibold font-mono whitespace-nowrap">
                                                {amt < 0 ? `-${formatMYR(Math.abs(amt))}` : ''}
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                                                {formatMYR(parseFloat(trx.RunningBalance))}
                                            </td>
                                        </tr>
                                    );
                                })}
                                
                                {/* Paid Row */}
                                <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900">
                                    <td className="px-6 py-4" colSpan="4">PAID</td>
                                    <td className="px-6 py-4 text-right font-mono text-sm whitespace-nowrap text-emerald-600">{formatMYR(displayPayouts)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-right text-[10px] text-gray-400 font-mono border-t border-gray-200 pt-4">
                        Generated on {today.toLocaleString('en-MY')}
                    </div>
                </div>

                {/* Right Sidebar Control Panels (Hidden on Print) */}
                <div className="w-full lg:w-[420px] shrink-0 space-y-6 print:hidden lg:sticky lg:top-0 order-first lg:order-last">
                    {/* Box 1: Statement Controls */}
                    <div className="bg-white p-6 rounded-none shadow-sm border border-gray-200 space-y-5">
                        <div>
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2.5">Statement Month</label>
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                    <SelectTrigger className="w-full rounded-none h-10 text-xs font-medium">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m.value} value={m.value.toString()} className="text-xs">{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                    <SelectTrigger className="w-full rounded-none h-10 text-xs font-medium">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => (
                                            <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button onClick={handlePrint} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none shadow-xs font-bold h-10 text-xs uppercase tracking-wider">
                            Print Statement
                        </Button>
                    </div>

                    {/* Box 2: Profit Settlement & Payout */}
                    <div className="bg-white border border-gray-200 rounded-none p-6 shadow-xs space-y-5">
                        <div className="border-b border-gray-100 pb-3">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                Profit Settlement
                            </h3>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Row 1: COGS */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5">COGS (-)</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="" 
                                    value={totalCOGSInput || ''}
                                    onChange={(e) => setTotalCOGSInput(e.target.value)}
                                    className="w-full h-10 font-mono font-medium text-gray-900 rounded-none text-sm border-gray-300 focus:border-gray-900"
                                />
                            </div>

                            {/* Row 2: Sales */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Sales (+)</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="" 
                                    value={totalPayoutInput || ''}
                                    onChange={(e) => setTotalPayoutInput(e.target.value)}
                                    className="w-full h-10 font-mono font-medium text-gray-900 rounded-none text-sm border-gray-300 focus:border-gray-900"
                                />
                            </div>

                            {/* Row 3: Net Profit */}
                            <div className="bg-gray-50 border border-gray-200 p-3.5 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Net Profit</span>
                                <span className={`text-base font-bold font-mono ${(parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatMYR((parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0)))}
                                </span>
                            </div>

                            {/* Row 4: Payout */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Payout</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="" 
                                    value={payoutAmountInput}
                                    onChange={(e) => setPayoutAmountInput(e.target.value)}
                                    className="w-full h-10 font-mono font-medium text-gray-900 rounded-none text-sm border-gray-300 focus:border-gray-900"
                                />
                            </div>

                            {/* Row 5: Reference */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5">Reference</label>
                                <Input 
                                    type="text" 
                                    placeholder="" 
                                    value={payoutRefInput}
                                    onChange={(e) => setPayoutRefInput(e.target.value)}
                                    className="w-full h-10 text-gray-900 rounded-none text-xs border-gray-300 focus:border-gray-900"
                                />
                            </div>

                            {/* Single Submit Button */}
                            <Button 
                                variant="default" 
                                onClick={handleOpenSettleConfirm} 
                                disabled={isPayoutLoading || isRecordingPayout || ((!totalPayoutInput || !totalCOGSInput) && !payoutAmountInput)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none shadow-xs font-bold h-10 text-xs uppercase tracking-wider mt-1"
                            >
                                {isPayoutLoading || isRecordingPayout ? 'Recording...' : 'Settle & Record'}
                            </Button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Custom Premium Settlement Confirmation Modal (Spacious max-w-2xl) */}
            <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
                <DialogContent className="max-w-2xl rounded-none border border-gray-200 p-8 shadow-2xl bg-white">
                    {settlementSuccess ? (
                        <div className="py-8 text-center space-y-5">
                            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                    Settlement Recorded
                                </DialogTitle>
                                <DialogDescription className="text-sm text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                                    Commission for <span className="font-bold text-gray-900">{months[selectedMonth - 1].label} {selectedYear}</span> has been successfully credited to <span className="font-bold text-gray-900">{agent.DisplayName}&apos;s</span> ledger.
                                </DialogDescription>
                            </div>
                            <div className="pt-2">
                                <Button 
                                    onClick={() => setIsConfirmModalOpen(false)}
                                    className="w-48 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md h-10 text-xs uppercase tracking-wider font-semibold"
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                    Confirm Monthly Settlement
                                </DialogTitle>
                                <DialogDescription className="text-sm text-gray-500 mt-1.5">
                                    Review the settlement breakdown for <span className="font-bold text-gray-900">{months[selectedMonth - 1].label} {selectedYear}</span>.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="my-6 bg-gray-50 border border-gray-200 p-6 space-y-4">
                                <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-3">
                                    <span className="text-gray-600 font-medium uppercase tracking-wider text-xs">Prepared For</span>
                                    <span className="font-bold text-gray-900 text-base">{agent.DisplayName}</span>
                                </div>
                                <div className="space-y-3 pt-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Sales (+)</span>
                                        <span className="font-mono font-bold text-gray-900 text-base">
                                            {formatMYR(parseFloat(totalPayoutInput || 0))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">COGS (-)</span>
                                        <span className="font-mono font-bold text-gray-600 text-base">
                                            -{formatMYR(parseFloat(totalCOGSInput || 0))}
                                        </span>
                                    </div>
                                    <div className="border-t-2 border-gray-900 pt-3 flex justify-between items-center">
                                        <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Net Profit (Commission)</span>
                                        <span className="text-lg font-black font-mono text-emerald-600">
                                            +{formatMYR(parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0))}
                                        </span>
                                    </div>
                                    {parseFloat(payoutAmountInput || 0) > 0 && (
                                        <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-3">
                                            <span className="text-gray-600 font-medium">Payout (-)</span>
                                            <span className="font-mono font-bold text-red-600 text-base">
                                                -{formatMYR(parseFloat(payoutAmountInput || 0))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 leading-relaxed">
                                This action records <span className="font-bold text-emerald-600 font-mono">+{formatMYR(parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0))}</span> as Commission in the agent&apos;s ledger. If a settlement already exists for this month, it will be updated automatically.
                            </p>

                            {settleError && (
                                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{settleError}</span>
                                </div>
                            )}

                            <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsConfirmModalOpen(false)}
                                    disabled={isPayoutLoading}
                                    className="w-full sm:w-32 rounded-none h-11 text-xs font-semibold uppercase tracking-wider"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleConfirmSettle}
                                    disabled={isPayoutLoading}
                                    className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-11 text-xs font-bold uppercase tracking-widest"
                                >
                                    {isPayoutLoading ? 'Recording...' : 'Confirm & Record'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
