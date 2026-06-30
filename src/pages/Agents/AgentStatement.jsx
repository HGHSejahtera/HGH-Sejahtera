import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAgentStatement } from '@/hooks/useAgentManagement';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AgentStatement() {
    const { id } = useParams();
    const navigate = useNavigate();
    const today = new Date();
    
    // Default to current month and year
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    const { data, isLoading } = useAgentStatement(id, selectedMonth, selectedYear);

    const handlePrint = () => {
        window.print();
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
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Control Panel - Hidden when printing */}
            <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/agents/${id}`)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center space-x-2">
                        <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => (
                                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
                    <Printer className="w-4 h-4 mr-2" />
                    Print Statement
                </Button>
            </div>

            {/* Document View - A4 Format */}
            <div className="bg-white rounded-xl shadow-lg print:shadow-none print:p-0 p-8 border border-gray-200 print:border-none min-h-[1056px]">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">HGH SEJAHTERA</h1>
                        <p className="text-gray-500 text-sm mt-1">No. 123, Jalan Niaga, Pusat Bandar</p>
                        <p className="text-gray-500 text-sm">50000 Kuala Lumpur, Malaysia</p>
                        <p className="text-gray-500 text-sm mt-1">Email: billing@hghsejahtera.com</p>
                        <p className="text-gray-500 text-sm">Tel: +603-1234 5678</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-black text-indigo-900 tracking-tighter uppercase">STATEMENT</h2>
                        <div className="mt-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100 inline-block text-left">
                            <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Statement Period</p>
                            <p className="text-lg font-bold text-gray-900">
                                {new Date(statement.year, statement.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bill To */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Account Summary For</p>
                        <h3 className="text-xl font-bold text-gray-900">{agent.DisplayName}</h3>
                        <p className="text-gray-600">ID: {agent.UserID.substring(0, 8).toUpperCase()}</p>
                        <p className="text-gray-600">{agent.Email}</p>
                        <p className="text-gray-600 mt-2">Status: <span className="font-medium text-gray-900">{agent.IsActive ? 'Active' : 'Suspended'}</span></p>
                    </div>
                    
                    {/* Summary Box */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Opening Balance:</span>
                                <span className="font-semibold">{formatMYR(statement.openingBalance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">New Charges (Orders):</span>
                                <span className="font-semibold text-red-600">+{formatMYR(statement.totalCharges)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Payments/Returns:</span>
                                <span className="font-semibold text-green-600">-{formatMYR(statement.totalPayments)}</span>
                            </div>
                            <div className="pt-3 border-t border-gray-200 mt-3 flex justify-between items-center">
                                <span className="font-bold text-gray-900">Closing Balance:</span>
                                <span className="text-xl font-black text-indigo-600">{formatMYR(statement.closingBalance)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                        Transaction Activity
                    </h3>
                    
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Date</th>
                                <th className="px-4 py-3">Description / Reference</th>
                                <th className="px-4 py-3 text-right">Charges</th>
                                <th className="px-4 py-3 text-right">Payments</th>
                                <th className="px-4 py-3 text-right rounded-tr-lg">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Opening Balance Row */}
                            <tr className="bg-gray-50">
                                <td className="px-4 py-3 text-gray-500 italic">
                                    {new Date(statement.year, statement.month - 1, 1).toLocaleDateString('en-MY')}
                                </td>
                                <td className="px-4 py-3 text-gray-900 font-medium italic">Opening Balance</td>
                                <td className="px-4 py-3 text-right"></td>
                                <td className="px-4 py-3 text-right"></td>
                                <td className="px-4 py-3 text-right font-bold">{formatMYR(statement.openingBalance)}</td>
                            </tr>
                            
                            {statement.transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                                        No transactions recorded during this period.
                                    </td>
                                </tr>
                            ) : (
                                statement.transactions.map((trx) => {
                                    const amt = parseFloat(trx.Amount);
                                    return (
                                        <tr key={trx.LedgerEntryID} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(trx.CreatedAt).toLocaleDateString('en-MY')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{trx.EntryType}</div>
                                                <div className="text-xs text-gray-500">{trx.Description || trx.ReferenceID || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-red-600 font-medium">
                                                {amt > 0 ? formatMYR(amt) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right text-green-600 font-medium">
                                                {amt < 0 ? formatMYR(Math.abs(amt)) : ''}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                {formatMYR(parseFloat(trx.RunningBalance))}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            
                            {/* Closing Balance Row */}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                <td className="px-4 py-4 text-gray-900" colSpan="4">Closing Balance</td>
                                <td className="px-4 py-4 text-right text-indigo-700 text-lg">{formatMYR(statement.closingBalance)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer Message */}
                <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-200 pt-6">
                    <p>Thank you for your business. Please ensure all outstanding balances are cleared promptly.</p>
                    <p className="mt-1 text-xs text-gray-400">Generated on {today.toLocaleString('en-MY')}</p>
                </div>
            </div>
        </div>
    );
}
