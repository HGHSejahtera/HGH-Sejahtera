import { useSettings } from '@/Hooks/UseSettings';

export function Receipt({ saleData }) {
    const { data: settingsData } = useSettings();

    if (!saleData) return null;

    const { items, subtotal, total, paymentMethod, change, amountReceived, isTestMode, saleId, receiptNumber, date, customerTier } = saleData;
    const companyName = settingsData?.CompanyName || 'HGH SEJAHTERA';
    const companyAddressStr = settingsData?.CompanyAddress || 'No. 123, Jalan Niaga, Pusat Bandar\n50000 KUALA LUMPUR\nWILAYAH PERSEKUTUAN\nMALAYSIA';
    const companyAddressLines = companyAddressStr.includes('\n')
        ? companyAddressStr.split('\n').map(l => l.trim()).filter(Boolean)
        : companyAddressStr.split(',').map(l => l.trim()).filter(Boolean);

    // eslint-disable-next-line
    const dateObj = new Date(date || Date.now());
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    const displayReceiptNo = receiptNumber || (saleId && (saleId.startsWith('HGH-') || saleId.startsWith('REC-')) ? saleId : (saleId ? `HGH-${dateObj.getFullYear()}-${saleId.slice(-6).toUpperCase()}` : 'TBD'));

    return (
        <div id="printable-receipt" className="receipt-container bg-white p-8 text-gray-900 text-sm w-full max-w-[750px] mx-auto font-sans print:max-w-none print:w-full print:p-[15mm]">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    html, body, #root {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                    }
                    #printable-receipt,
                    #printable-receipt *,
                    .receipt-container,
                    .receipt-container * {
                        visibility: visible !important;
                    }
                    #printable-receipt,
                    .receipt-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 15mm !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        z-index: 999999 !important;
                    }
                }
            `}</style>

            {/* Header / Company Info */}
            <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4 gap-4">
                <div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-gray-900">{companyName}</h1>
                    <div className="text-xs text-gray-600 mt-1.5 space-y-0.5 leading-snug">
                        {companyAddressLines.map((line, idx) => (
                            <p key={idx}>{line}{idx < companyAddressLines.length - 1 && !line.endsWith(',') && !companyAddressStr.includes('\n') ? ',' : ''}</p>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0 text-right">
                    <div className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-wider mb-2.5 print:bg-gray-900 print:text-white">
                        {isTestMode ? 'TEST RECEIPT' : 'OFFICIAL RECEIPT'}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs items-center">
                        <span className="text-gray-500 font-medium text-left">Date:</span>
                        <span className="font-semibold text-gray-900 text-right">{formattedDate}</span>
                        <span className="text-gray-500 font-medium text-left">Receipt:</span>
                        <span className="font-mono font-bold text-gray-900 text-right">{displayReceiptNo}</span>
                    </div>
                </div>
            </div>

            {/* Customer & Transaction Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 border border-gray-200 mb-4 text-xs break-inside-avoid page-break-inside-avoid">
                <div>
                    <span className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Customer Tier</span>
                    <span className="font-bold text-gray-900 text-sm">{customerTier || 'Retail'}</span>
                </div>
                <div>
                    <span className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Cashier</span>
                    <span className="font-medium text-gray-900">Staff</span>
                </div>
                <div>
                    <span className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Payment Method</span>
                    <span className="font-medium text-gray-900 capitalize">{paymentMethod === 'cash' ? 'Cash' : 'DuitNow QR'}</span>
                </div>
                <div>
                    <span className="block font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Status</span>
                    <span className="font-bold text-green-600">PAID</span>
                </div>
            </div>

            {/* Structured Table for A4 */}
            <div className="mb-4 overflow-hidden border border-gray-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-700 text-[11px] uppercase tracking-wider font-bold border-b border-gray-200 break-inside-avoid page-break-inside-avoid">
                            <th className="py-2 px-3 w-12 text-center">No.</th>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3 w-16 text-center">Qty</th>
                            <th className="py-2 px-3 w-24 text-right">Unit Price</th>
                            <th className="py-2 px-3 w-24 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-[11px]">
                        {items.map((item, index) => {
                            const fullDescription = [
                                item.Brand,
                                item.ProductName,
                                item.Variation,
                                item.Size
                            ].filter(Boolean).join(' ');

                            return (
                                <tr key={index} className="hover:bg-gray-50/50 break-inside-avoid page-break-inside-avoid">
                                    <td className="py-1.5 px-3 text-center font-medium text-gray-500">{index + 1}</td>
                                    <td className="py-1.5 px-3">
                                        <div className="font-semibold text-gray-900 text-[11px] leading-tight">{fullDescription}</div>
                                    </td>
                                    <td className="py-1.5 px-3 text-center font-semibold text-gray-900">{item.quantity}</td>
                                    <td className="py-1.5 px-3 text-right text-gray-600 font-mono">RM {item.UnitPrice.toFixed(2)}</td>
                                    <td className="py-1.5 px-3 text-right font-bold text-gray-900 font-mono">RM {(item.quantity * item.UnitPrice).toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary & Totals */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-t border-gray-200 pt-4 mb-6 break-inside-avoid page-break-inside-avoid">
                <div className="w-full md:w-1/2 space-y-2 text-xs bg-gray-50 p-3 border border-gray-200">
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] border-b border-gray-200 pb-1.5 mb-2">Payment Breakdown</h3>
                    <div className="flex justify-between text-gray-600">
                        <span>Amount Received:</span>
                        <span className="font-semibold text-gray-900">RM {amountReceived?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>Change Returned:</span>
                        <span className="font-semibold text-gray-900">RM {change?.toFixed(2)}</span>
                    </div>
                </div>

                <div className="w-full md:w-80 space-y-2 text-sm ml-auto">
                    <div className="flex justify-between text-gray-600 px-2 py-1">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-gray-900">RM {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-gray-900 bg-gray-100 px-3 py-2 border border-gray-300">
                        <span>Total:</span>
                        <span>RM {total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500 space-y-1 break-inside-avoid page-break-inside-avoid">
                <p className="font-semibold text-gray-800">Thank You For Your Business!</p>
                <p>Please retain this official receipt for your records and warranty claims.</p>
                <p className="text-[10px] text-gray-400 mt-1">This is a computer-generated document and does not require a signature.</p>
                {isTestMode && <p className="mt-2 font-bold uppercase text-orange-600 tracking-wider">*** TEST MODE TRANSACTION ***</p>}
            </div>
        </div>
    );
}
