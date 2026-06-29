import { useState } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Wallet, CheckCircle, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useProducts } from '@/hooks/useProducts';
import { usePOS } from '@/hooks/usePOS';
import { Receipt } from './Receipt';

export function POS() {
    const { data: products = [], isLoading } = useProducts();
    const { completeSale, isProcessing } = usePOS();
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pricingTier, setPricingTier] = useState('retail');
    const [isTestMode, setIsTestMode] = useState(false); // retail, wholesale
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(''); // '', 'cash', 'duitnow'
    const [amountReceived, setAmountReceived] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [saleData, setSaleData] = useState(null);
    const [editingPriceItemId, setEditingPriceItemId] = useState(null);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.ProductID === product.ProductID);
            if (existing) {
                return prev.map(item => 
                    item.ProductID === product.ProductID 
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setSearchQuery('');
        setSearchResults([]);
    };

    useHardwareScanner((barcode) => {
        const product = products.find(p => p.Barcode === barcode);
        if (product) {
            addToCart(product);
        } else {
            alert(`Product with barcode ${barcode} not found!`);
        }
    });

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 2) {
            const results = products.filter(p => 
                p.ProductName.toLowerCase().includes(query.toLowerCase()) || 
                (p.Brand && p.Brand.toLowerCase().includes(query.toLowerCase())) ||
                (p.Barcode && p.Barcode.includes(query)) ||
                (p.MasterSKU && p.MasterSKU.includes(query))
            );
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchQuery) {
            const exactMatch = products.find(p => 
                p.Barcode === searchQuery || 
                p.MasterSKU === searchQuery
            );
            
            if (exactMatch) {
                addToCart(exactMatch);
            } else if (searchResults.length === 1) {
                addToCart(searchResults[0]);
            } else if (searchResults.length === 0) {
                alert(`Product not found!`);
            }
        }
    };

    const getPrice = (item) => {
        if (item.customPrice !== undefined) return parseFloat(item.customPrice);
        return pricingTier === 'wholesale' ? (item.WholesalePrice || 0) : (item.RetailPrice || 0);
    };

    const saveCustomPrice = (productId, newPrice) => {
        if (newPrice === '' || isNaN(newPrice)) {
            setCart(prev => prev.map(item => item.ProductID === productId ? { ...item, customPrice: undefined } : item));
        } else {
            setCart(prev => prev.map(item => item.ProductID === productId ? { ...item, customPrice: parseFloat(newPrice) } : item));
        }
        setEditingPriceItemId(null);
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.ProductID === productId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.ProductID !== productId));
    };

    const handleCompleteSale = async () => {
        if (!paymentMethod) return;

        const subtotalCalc = cart.reduce((sum, item) => sum + (getPrice(item) * item.quantity), 0);
        const changeCalc = paymentMethod === 'cash' ? parseFloat(amountReceived || 0) - subtotalCalc : 0;

        try {
            const result = await completeSale.mutateAsync({
                isTestMode,
                CustomerTier: pricingTier === 'wholesale' ? 'Wholesale' : 'Retail',
                PaymentMethod: paymentMethod === 'cash' ? 'Cash' : 'DuitNowQR',
                PaymentReference: referenceNumber || null,
                AmountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived || 0) : subtotalCalc,
                ChangeGiven: changeCalc > 0 ? changeCalc : 0,
                TotalAmount: subtotalCalc,
                CustomerName: null,
                CustomerCompany: null,
                CustomerPhone: null,
                Items: cart.map(item => ({
                    ProductID: item.ProductID,
                    Quantity: item.quantity,
                    UnitPrice: getPrice(item),
                    Subtotal: getPrice(item) * item.quantity,
                    IsPriceOverride: item.customPrice !== undefined
                }))
            });

            const finalSaleId = result?.SaleID || result?.sale_id;

            setSaleData({
                items: cart.map(item => ({
                    ...item,
                    UnitPrice: getPrice(item)
                })),
                subtotal: subtotalCalc,
                total: subtotalCalc,
                paymentMethod: paymentMethod === 'cash' ? 'cash' : 'duitnow',
                change: changeCalc > 0 ? changeCalc : 0,
                amountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived || 0) : subtotalCalc,
                isTestMode,
                saleId: finalSaleId,
                date: new Date()
            });
            setPaymentSuccess(true);
            setShowReceipt(true);
        } catch (error) {
            alert('Failed to complete sale: ' + error.message);
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (getPrice(item) * item.quantity), 0);
    const total = subtotal; // No tax logic for now
    const change = parseFloat(amountReceived || 0) - total;

    const handleNewSale = () => {
        setCart([]);
        setPaymentSuccess(false);
        setPaymentModalOpen(false);
        setPaymentMethod('');
        setAmountReceived('');
        setReferenceNumber('');
        setShowReceipt(false);
        setSaleData(null);
        setEditingPriceItemId(null);
    };

    if (isLoading) return <div className="p-6">Loading...</div>;

    return (
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* Left: Product Search & Scanning */}
            <div className="w-full lg:w-2/3 p-4 md:p-6 flex flex-col border-r h-full overflow-hidden bg-gray-50">
                <div className="mb-6 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input 
                            type="text" 
                            placeholder="Search" 
                            className="pl-10 h-12 text-lg shadow-sm"
                            value={searchQuery}
                            onChange={handleSearch}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Search Results */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-2">
                    {searchQuery.length > 2 && searchResults.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                            {searchResults.map(product => (
                                <div 
                                    key={product.ProductID}
                                    onClick={() => addToCart(product)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all active:scale-95 flex justify-between items-start gap-4"
                                >
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">{product.Brand || 'No Brand'}</p>
                                        <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight">{product.ProductName}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{product.Variation}</p>
                                        <p className="text-lg font-bold text-indigo-600 mt-2">RM {getPrice(product).toFixed(2)}</p>
                                    </div>
                                    {product.ImageURL && (
                                        <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden border flex-shrink-0">
                                            <img src={product.ImageURL} alt={product.ProductName} className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : searchQuery.length > 2 ? (
                        <div className="text-center text-gray-500 mt-10">No products found.</div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p>Loading products...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                            <p>Ready to scan items</p>
                        </div>
                    )}
                </div>

                {/* Left Panel Footer / Mode Toggle */}
                <div className="shrink-0 p-3 flex justify-end items-center border-t bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium uppercase tracking-wider ${!isTestMode ? 'text-green-600' : 'text-orange-500'}`}>
                            {!isTestMode ? 'Live Mode' : 'Test Mode'}
                        </span>
                        <Switch 
                            checked={!isTestMode} 
                            onCheckedChange={(c) => setIsTestMode(!c)} 
                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-orange-500"
                        />
                    </div>
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-full lg:w-1/3 flex flex-col h-full bg-white">
                <div className="p-4 border-b flex justify-between items-center bg-white z-10 shadow-sm shrink-0">
                    <h3 className="font-bold text-lg">Order</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pricingTier === 'retail' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`} 
                            onClick={() => setPricingTier('retail')}
                        >
                            Retail
                        </button>
                        <button 
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pricingTier === 'wholesale' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`} 
                            onClick={() => setPricingTier('wholesale')}
                        >
                            Wholesale
                        </button>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-auto p-4">
                    {cart.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            Cart is empty
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {cart.map(item => (
                                <li key={item.ProductID} className="flex justify-between items-start pb-4 border-b border-gray-100 last:border-0">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">{item.Brand || 'No Brand'}</p>
                                        <h4 className="font-medium text-sm line-clamp-2 leading-tight">{item.ProductName}</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">{item.Variation}</p>
                                        <div className="flex items-center mt-1 h-6">
                                            {editingPriceItemId === item.ProductID ? (
                                                <div className="flex items-center">
                                                    <span className="text-sm font-semibold text-gray-900 mr-1">RM</span>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01"
                                                        defaultValue={getPrice(item)} 
                                                        className="w-20 h-6 text-sm px-1 py-0 shadow-none border-gray-300"
                                                        onBlur={(e) => saveCustomPrice(item.ProductID, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={`text-sm font-semibold ${item.customPrice !== undefined ? 'text-orange-600' : 'text-gray-900'}`}>
                                                        RM {getPrice(item).toFixed(2)}
                                                    </p>
                                                    <button 
                                                        onClick={() => setEditingPriceItemId(item.ProductID)} 
                                                        className="ml-2 text-gray-400 hover:text-indigo-600 focus:outline-none transition-colors"
                                                    >
                                                        <Tag className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <div className="flex items-center border border-gray-200 rounded-md h-8 bg-white">
                                            <button onClick={() => updateQuantity(item.ProductID, -1)} className="w-8 h-full flex items-center justify-center hover:bg-gray-50 text-gray-600 border-r border-gray-100 transition-colors">
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="w-10 text-center text-sm font-medium text-gray-900">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.ProductID, 1)} className="w-8 h-full flex items-center justify-center hover:bg-gray-50 text-gray-600 border-l border-gray-100 transition-colors">
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.ProductID)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Checkout Section */}
                <div className="p-6 border-t bg-gray-50">
                    <div className="flex justify-between items-center mb-2 text-gray-600">
                        <span>Subtotal</span>
                        <span>RM {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6 text-xl font-bold text-gray-900">
                        <span>Total</span>
                        <span>RM {total.toFixed(2)}</span>
                    </div>

                    <Button 
                        className={`w-full h-14 text-lg font-bold shadow-lg ${isTestMode ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                        disabled={cart.length === 0}
                        onClick={() => setPaymentModalOpen(true)}
                    >
                        Charge RM {total.toFixed(2)}
                    </Button>
                </div>
            </div>

            {/* Payment Modal */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-none shadow-xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold">Payment</h2>
                            <span className="text-xl font-bold text-indigo-600">RM {total.toFixed(2)}</span>
                        </div>
                        
                        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
                            {showReceipt ? (
                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="flex items-center justify-center mb-4 shrink-0">
                                        <CheckCircle className="h-6 w-6 text-green-600 mr-2 print:hidden" />
                                        <span className="text-lg font-bold text-gray-900 print:hidden">Payment Successful</span>
                                    </div>
                                    <div className="w-full border rounded-lg p-2 bg-gray-50 overflow-y-auto flex-1 print:overflow-visible print:border-none print:p-0 print:bg-white custom-scrollbar">
                                        <Receipt saleData={saleData} />
                                    </div>
                                    <div className="flex gap-4 w-full mt-4 shrink-0 print:hidden">
                                        <Button variant="outline" className="flex-1 h-12" onClick={() => window.print()}>
                                            Print Receipt
                                        </Button>
                                        <Button className="flex-1 h-12" onClick={handleNewSale}>
                                            Complete
                                        </Button>
                                    </div>
                                </div>
                            ) : paymentMethod === '' ? (
                                <>
                                    <Button variant="outline" className="w-full h-16 justify-start text-lg" onClick={() => setPaymentMethod('cash')}>
                                        <div className="w-12 flex justify-center mr-4">
                                            <Wallet className="h-6 w-6 text-green-600" />
                                        </div>
                                        Cash
                                    </Button>
                                    <Button variant="outline" className="w-full h-16 justify-start text-lg" onClick={() => setPaymentMethod('duitnow')}>
                                        <div className="w-12 flex justify-center mr-4">
                                            <img src="/Logo/DuitNow%20QR.svg" alt="DuitNow QR" className="h-6 w-auto object-contain" />
                                        </div>
                                        DuitNow QR
                                    </Button>
                                </>
                            ) : paymentMethod === 'cash' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                                        <Input 
                                            type="number" 
                                            className="h-14 text-2xl" 
                                            autoFocus
                                            value={amountReceived}
                                            onChange={(e) => setAmountReceived(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center py-4 border-t border-b">
                                        <span className="text-gray-600">Change Due</span>
                                        <span className={`text-2xl font-bold ${change < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            RM {change >= 0 ? change.toFixed(2) : '0.00'}
                                        </span>
                                    </div>
                                    <Button 
                                        className="w-full h-14 text-lg font-bold" 
                                        disabled={change < 0 || !amountReceived || isProcessing}
                                        onClick={handleCompleteSale}
                                    >
                                        {isProcessing ? 'Processing...' : 'Complete'}
                                    </Button>
                                </div>
                            ) : paymentMethod === 'duitnow' ? (
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                                        <span className="text-gray-500 text-center text-sm">QR Code<br/>Placeholder</span>
                                    </div>
                                    <p className="text-sm text-center text-gray-500">Customer scans the QR code to pay <strong>RM {total.toFixed(2)}</strong></p>
                                    
                                    <div className="w-full mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                                        <Input 
                                            type="text" 
                                            value={referenceNumber}
                                            onChange={(e) => setReferenceNumber(e.target.value)}
                                        />
                                    </div>
                                    <Button 
                                        className="w-full h-14 text-lg font-bold mt-4" 
                                        onClick={handleCompleteSale}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Processing...' : 'Confirm Payment'}
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        {!paymentSuccess && (
                            <div className="p-4 border-t bg-gray-50 flex justify-between">
                                {paymentMethod !== '' ? (
                                    <Button variant="ghost" onClick={() => setPaymentMethod('')}>Back</Button>
                                ) : (
                                    <div />
                                )}
                                <Button variant="ghost" onClick={() => { setPaymentModalOpen(false); setPaymentMethod(''); }}>Cancel</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
