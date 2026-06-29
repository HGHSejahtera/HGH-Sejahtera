export function Receipt({ saleData }) {
    if (!saleData) return null;

    const { items, subtotal, total, paymentMethod, change, amountReceived, isTestMode, saleId, date } = saleData;
    const dateObj = new Date(date || Date.now());
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    return (
        <div className="receipt-container bg-white p-4 text-black text-sm w-full max-w-[300px] mx-auto font-mono print:max-w-none print:w-full print:p-0">
            {/* Header */}
            <div className="text-center mb-4">
                <h2 className="font-bold text-lg mb-1">HGH SEJAHTERA</h2>
                <p className="text-xs text-gray-600 print:text-black">No. 123, Jalan Niaga,</p>
                <p className="text-xs text-gray-600 print:text-black">Pusat Bandar, 50000 KL</p>
                <p className="text-xs text-gray-600 print:text-black">Tel: 03-1234567</p>
            </div>

            {isTestMode && (
                <div className="text-center border-y-2 border-dashed border-gray-400 py-1 mb-4 print:border-black">
                    <span className="font-bold text-lg tracking-widest uppercase">TEST RECEIPT</span>
                </div>
            )}

            {/* Meta */}
            <div className="text-xs mb-4">
                <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                    <span>Receipt #:</span>
                    <span>{saleId || 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>Staff</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-400 mb-2 print:border-black"></div>

            {/* Items */}
            <div className="mb-2">
                <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="w-2/3">Item</span>
                    <span className="w-1/3 text-right">Amount (RM)</span>
                </div>
                {items.map((item, index) => (
                    <div key={index} className="text-xs mb-3 break-inside-avoid">
                        {item.Brand && <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5">{item.Brand}</div>}
                        <div className="font-semibold line-clamp-2 leading-tight">{item.ProductName}</div>
                        {(item.Variation || item.Size) && (
                            <div className="text-gray-600 text-[10px] mt-0.5 print:text-black">
                                {[item.Variation, item.Size].filter(Boolean).join(' - ')}
                            </div>
                        )}
                        <div className="flex justify-between text-gray-600 mt-1 print:text-black">
                            <span>{item.quantity} x {item.UnitPrice.toFixed(2)}</span>
                            <span>{(item.quantity * item.UnitPrice).toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-b border-dashed border-gray-400 mb-2 print:border-black"></div>

            {/* Totals */}
            <div className="text-xs space-y-1 mb-4">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                    <span>Total:</span>
                    <span>{total.toFixed(2)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-gray-400 mb-2 print:border-black"></div>

            {/* Payment Details */}
            <div className="text-xs space-y-1 mb-6">
                <div className="flex justify-between">
                    <span>Payment ({paymentMethod === 'cash' ? 'Cash' : 'DuitNow'}):</span>
                    <span>{amountReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Change:</span>
                    <span>{change.toFixed(2)}</span>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600 print:text-black">
                <p>Terima Kasih!</p>
                <p>Sila Datang Lagi</p>
                {isTestMode && <p className="mt-2 font-bold uppercase text-black">*** TEST MODE ***</p>}
            </div>
        </div>
    );
}
