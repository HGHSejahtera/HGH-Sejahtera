import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentStatement, useAgentMutations } from '@/hooks/useAgentManagement';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileText, CheckCircle2, Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export function AgentStatement() {
    const { id } = useParams();
    const navigate = useNavigate();
    const today = new Date();
    
    // Default to current month and year
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    const { data, isLoading } = useAgentStatement(id, selectedMonth, selectedYear);
    const { data: settings = {} } = useSettings();
    const { closeMonthlyStatement } = useAgentMutations();
    const [isPayoutLoading, setIsPayoutLoading] = useState(false);
    const [totalPayoutInput, setTotalPayoutInput] = useState('');
    const [totalCOGSInput, setTotalCOGSInput] = useState('');

    const handlePrint = () => {
        window.print();
    };

    const handleSettleMonth = async () => {
        if (!totalPayoutInput || !totalCOGSInput) return;
        
        const salesVal = parseFloat(totalPayoutInput);
        const billVal = parseFloat(totalCOGSInput);
        const netProfit = salesVal - billVal;
        
        if (confirm(`Confirm settlement for ${months[selectedMonth - 1].label} ${selectedYear}?\n\nPlatform Sales: ${formatMYR(salesVal)}\nHQ Bill: ${formatMYR(billVal)}\nNet Profit: ${formatMYR(netProfit)}\n\nThis will record the Net Profit to ${data.agent.DisplayName}'s ledger.`)) {
            setIsPayoutLoading(true);
            try {
                await closeMonthlyStatement.mutateAsync({
                    agentId: id,
                    month: selectedMonth,
                    year: selectedYear,
                    totalPayout: salesVal,
                    totalCOGS: billVal
                });
                alert('Monthly settlement recorded successfully!');
                setTotalPayoutInput('');
                setTotalCOGSInput('');
            } catch (error) {
                console.error(error);
                alert('Failed to settle month: ' + error.message);
            } finally {
                setIsPayoutLoading(false);
            }
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

    return (
        <div className="max-w-7xl mx-auto pb-12 px-4">
            <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
                
                {/* Main Document Area (Centered, visible without scroll) */}
                <div className="w-full max-w-[800px] flex-1 bg-white shadow-md print:shadow-none print:p-0 p-8 md:p-10 border border-gray-200 print:border-none min-h-[1056px] rounded-none">
                    
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
                        <div className="text-right">
                            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">STATEMENT</h2>
                            <div className="mt-4 border border-gray-300 p-3 px-4 rounded-none inline-block text-left bg-gray-50/50">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Statement Period</p>
                                <p className="text-base font-bold text-gray-900 mt-0.5">
                                    {new Date(statement.year, statement.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                </p>
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
                        
                        {/* Summary Box */}
                        <div className="border border-gray-200 p-5 rounded-none bg-gray-50/40">
                            <div className="space-y-2.5">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Total Orders (Month):</span>
                                    <span className="font-semibold text-gray-900">{statement.totalOrders || 0}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Total COGS (Month):</span>
                                    <span className="font-semibold text-gray-900">{formatMYR(statement.totalCOGS || 0)}</span>
                                </div>
                                <div className="border-t border-gray-200 my-2 pt-2"></div>
                                {statement.openingBalance > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-600">Previous Unpaid Balance:</span>
                                        <span className="font-semibold text-gray-900">{formatMYR(statement.openingBalance)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Total Sales (+):</span>
                                    <span className="font-semibold text-emerald-600 font-mono">+{formatMYR(statement.totalCharges)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600">Payouts / Voids (-):</span>
                                    <span className="font-semibold text-red-600 font-mono">-{formatMYR(statement.totalPayments)}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-300 mt-3 flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Current Balance:</span>
                                    <span className="text-lg font-black text-gray-900 font-mono">{formatMYR(statement.closingBalance)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transactions */}
                    <div className="mt-10">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center border-b pb-2 border-gray-900">
                            <FileText className="w-4 h-4 mr-2 text-gray-700" />
                            Transaction Activity
                        </h3>
                        
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-800 font-bold border-y border-gray-300">
                                <tr>
                                    <th className="px-3 py-2.5 rounded-none">Date</th>
                                    <th className="px-3 py-2.5 rounded-none">Description / Reference</th>
                                    <th className="px-3 py-2.5 text-right rounded-none">Total Sales (+)</th>
                                    <th className="px-3 py-2.5 text-right rounded-none">Payouts / Voids (-)</th>
                                    <th className="px-3 py-2.5 text-right rounded-none">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {/* Opening Balance Row */}
                                <tr className="bg-gray-50/60">
                                    <td className="px-3 py-2.5 text-gray-500 italic whitespace-nowrap">
                                        {new Date(statement.year, statement.month - 1, 1).toLocaleDateString('en-MY')}
                                    </td>
                                    <td className="px-3 py-2.5 text-gray-900 font-medium italic">Opening Balance</td>
                                    <td className="px-3 py-2.5 text-right font-mono"></td>
                                    <td className="px-3 py-2.5 text-right font-mono"></td>
                                    <td className="px-3 py-2.5 text-right font-bold font-mono text-gray-900 whitespace-nowrap">{formatMYR(statement.openingBalance)}</td>
                                </tr>
                                
                                {statement.transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-3 py-8 text-center text-gray-500 italic">
                                            No transactions recorded during this period.
                                        </td>
                                    </tr>
                                ) : (
                                    statement.transactions.map((trx) => {
                                        const amt = parseFloat(trx.Amount);
                                        return (
                                            <tr key={trx.LedgerEntryID} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                                                    {new Date(trx.CreatedAt).toLocaleDateString('en-MY')}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-semibold text-gray-900">{trx.EntryType}</div>
                                                    <div className="text-[11px] text-gray-500 mt-0.5">{trx.Description || trx.ReferenceID || '-'}</div>
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-emerald-600 font-medium font-mono whitespace-nowrap">
                                                    {amt > 0 ? formatMYR(amt) : ''}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-red-600 font-medium font-mono whitespace-nowrap">
                                                    {amt < 0 ? formatMYR(Math.abs(amt)) : ''}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono font-medium text-gray-900 whitespace-nowrap">
                                                    {formatMYR(parseFloat(trx.RunningBalance))}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                
                                {/* Closing Balance Row */}
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-900">
                                    <td className="px-3 py-3 text-gray-900" colSpan="4">Closing Balance</td>
                                    <td className="px-3 py-3 text-right text-gray-900 font-mono text-sm whitespace-nowrap">{formatMYR(statement.closingBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Message */}
                    <div className="mt-12 text-center text-xs text-gray-500 border-t border-gray-200 pt-6">
                        <p>Thank you for your business. Please ensure all outstanding balances are cleared promptly.</p>
                        <p className="mt-1 text-[10px] text-gray-400 font-mono">Generated on {today.toLocaleString('en-MY')}</p>
                    </div>
                </div>

                {/* Right Sidebar Control Panels (Hidden on Print) */}
                <div className="w-full lg:w-80 shrink-0 space-y-6 print:hidden lg:sticky lg:top-6 order-first lg:order-last">
                    {/* Box 1: Statement Controls */}
                    <div className="bg-white p-5 rounded-none shadow-sm border border-gray-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/Agent-Management/${id}`)} className="text-gray-600 hover:text-gray-900 -ml-2 h-8 px-2">
                                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Agent
                            </Button>
                        </div>
                        
                        <div>
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Statement Period</label>
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                    <SelectTrigger className="w-full rounded-none h-9 text-xs">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => (
                                            <SelectItem key={m.value} value={m.value.toString()} className="text-xs">{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                    <SelectTrigger className="w-full rounded-none h-9 text-xs">
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

                        <Button onClick={handlePrint} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-none shadow-xs font-medium h-9 text-xs">
                            <Printer className="w-3.5 h-3.5 mr-2" />
                            Print Statement
                        </Button>
                    </div>

                    {/* Box 2: Profit Settlement */}
                    <div className="bg-white p-5 rounded-none shadow-sm border border-gray-200 space-y-4">
                        <div className="border-b border-gray-100 pb-3">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center">
                                <Calculator className="w-4 h-4 mr-2 text-indigo-600" />
                                Profit Settlement
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                Calculate net profit based on manual bill and sales for this month.
                            </p>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">HQ Bill (-)</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    value={totalCOGSInput || ''}
                                    onChange={(e) => setTotalCOGSInput(e.target.value)}
                                    className="h-8 font-mono font-medium text-gray-900 rounded-none text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider block mb-1">Platform Sales (+)</label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    value={totalPayoutInput || ''}
                                    onChange={(e) => setTotalPayoutInput(e.target.value)}
                                    className="h-8 font-mono font-medium text-gray-900 rounded-none text-xs"
                                />
                            </div>

                            <div className="bg-gray-50 p-3 border border-gray-200 flex justify-between items-center mt-2">
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Net Profit</span>
                                <span className={`text-sm font-bold font-mono ${(parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatMYR((parseFloat(totalPayoutInput || 0) - parseFloat(totalCOGSInput || 0)))}
                                </span>
                            </div>
                        </div>

                        <Button 
                            variant="default" 
                            onClick={handleSettleMonth} 
                            disabled={isPayoutLoading || !totalPayoutInput || !totalCOGSInput}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none shadow-xs font-medium h-9 text-xs"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                            {isPayoutLoading ? 'Recording...' : 'Settle & Record'}
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
}
