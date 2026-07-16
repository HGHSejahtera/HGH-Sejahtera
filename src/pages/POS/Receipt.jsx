export function Receipt({ saleData }) {
    if (!saleData) return null;

    const { items, subtotal, total, paymentMethod, change, amountReceived, isTestMode, saleId, date, customerTier } = saleData;
    // eslint-disable-next-line
    const dateObj = new Date(date || Date.now());
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    return (
        <div className="receipt-container bg-white p-8 text-gray-900 text-sm w-full max-w-[750px] mx-auto font-sans print:max-w-none print:w-full print:p-0">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .receipt-container, .receipt-container * {
                        visibility: visible !important;
                    }
                    .receipt-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                    }
                }
            `}</style>

            {/* Header / Company Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-gray-900 pb-6 mb-6 gap-4">
                <div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-gray-900">HGH SEJAHTERA</h1>
                    <p className="text-xs text-gray-600 mt-1">No. 123, Jalan Niaga, Pusat Bandar, 50000 KL</p>
                    <p className="text-xs text-gray-600">Tel: 03-1234567 | Email: support@hghsejahtera.com</p>
                </div>
                <div className="text-left md:text-right">
                    <div className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-wider mb-2">
                        {isTestMode ? 'TEST RECEIPT' : 'OFFICIAL RECEIPT'}
                    </div>
                    <p className="text-xs text-gray-600">Date: <span className="font-semibold text-gray-900">{formattedDate}</span></p>
                    <p className="text-xs text-gray-600">Receipt #: <span className="font-mono font-bold text-gray-900">{saleId || 'TBD'}</span></p>
                </div>
            </div>

            {/* Customer & Transaction Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border border-gray-200 mb-6 text-xs">
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
            <div className="mb-6 overflow-hidden border border-gray-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-gray-700 text-xs uppercase font-bold border-b border-gray-200">
                            <th className="py-3 px-4 w-12 text-center">No.</th>
                            <th className="py-3 px-4">Item Description</th>
                            <th className="py-3 px-4 w-20 text-center">Qty</th>
                            <th className="py-3 px-4 w-28 text-right">Unit Price</th>
                            <th className="py-3 px-4 w-28 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs">
                        {items.map((item, index) => {
                            const fullDescription = [
                                item.Brand,
                                item.ProductName,
                                item.Variation,
                                item.Size
                            ].filter(Boolean).join(' ');

                            return (
                                <tr key={index} className="hover:bg-gray-50/50">
                                    <td className="py-3 px-4 text-center font-medium text-gray-500">{index + 1}</td>
                                    <td className="py-3 px-4">
                                        <div className="font-semibold text-gray-900 text-sm">{fullDescription}</div>
                                        {item.Barcode && (
                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">SKU/Barcode: {item.Barcode}</div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-center font-semibold text-gray-900">{item.quantity}</td>
                                    <td className="py-3 px-4 text-right text-gray-600">RM {item.UnitPrice.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right font-bold text-gray-900">RM {(item.quantity * item.UnitPrice).toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary & Totals */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-t border-gray-200 pt-6 mb-8">
                <div className="w-full md:w-1/2 space-y-2 text-xs bg-gray-50 p-4 border border-gray-200">
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] border-b border-gray-200 pb-2 mb-2">Payment Breakdown</h3>
                    <div className="flex justify-between text-gray-600">
                        <span>Amount Received ({paymentMethod === 'cash' ? 'Cash' : 'DuitNow QR'}):</span>
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
            <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-800">Terima Kasih Atas Sokongan Anda!</p>
                <p>Sila simpan resit ini sebagai rujukan pembelian dan tuntutan jaminan.</p>
                <p className="text-[10px] text-gray-400 mt-2">Ini adalah cetakan berkomputer dan tidak memerlukan tandatangan.</p>
                {isTestMode && <p className="mt-3 font-bold uppercase text-orange-600 tracking-wider">*** TEST MODE TRANSACTION ***</p>}
            </div>
        </div>
    );
}
