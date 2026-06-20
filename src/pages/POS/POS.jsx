import { useState } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';

// Mock Data
const MOCK_PRODUCTS = [];

export function POS() {
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pricingTier, setPricingTier] = useState('retail'); // retail, wholesale
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(''); // '', 'cash', 'duitnow'
    const [amountReceived, setAmountReceived] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);

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

    // Hardware Scanner Hook
    useHardwareScanner((barcode) => {
        const product = MOCK_PRODUCTS.find(p => p.Barcode === barcode);
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
            const results = MOCK_PRODUCTS.filter(p => 
                p.ProductName.toLowerCase().includes(query.toLowerCase()) || 
                p.Barcode.includes(query)
            );
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
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

    const handleCompleteSale = () => {
        // Mock save sale logic
        setPaymentSuccess(true);
        setTimeout(() => {
            setCart([]);
            setPaymentSuccess(false);
            setPaymentModalOpen(false);
            setPaymentMethod('');
            setAmountReceived('');
            setReferenceNumber('');
        }, 2000);
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.Price * item.quantity), 0);
    const total = subtotal; // No tax logic for now
    const change = parseFloat(amountReceived || 0) - total;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] -mt-4 md:-mt-6 -mx-4 md:-mx-6">
            {/* Left: Product Search & Scanning */}
            <div className="w-full lg:w-2/3 p-4 md:p-6 flex flex-col bg-gray-50 border-b lg:border-b-0 lg:border-r h-1/2 lg:h-full">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold tracking-tight mb-4">Point of Sale</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input 
                            type="text" 
                            placeholder="Scan barcode or search product..." 
                            className="pl-10 h-12 text-lg shadow-sm"
                            value={searchQuery}
                            onChange={handleSearch}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Search Results */}
                <div className="flex-1 overflow-auto">
                    {searchResults.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                            {searchResults.map(product => (
                                <div 
                                    key={product.ProductID}
                                    onClick={() => addToCart(product)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all active:scale-95"
                                >
                                    <h3 className="font-semibold text-gray-900 line-clamp-2 h-10">{product.ProductName}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{product.Variation}</p>
                                    <p className="text-lg font-bold text-indigo-600 mt-2">RM {product.Price.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    ) : searchQuery.length > 2 ? (
                        <div className="text-center text-gray-500 mt-10">No products found.</div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                            <p>Ready to scan items</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-full lg:w-1/3 bg-white flex flex-col h-1/2 lg:h-full">
                <div className="p-4 border-b flex justify-between items-center bg-white z-10 shadow-sm">
                    <h3 className="font-bold text-lg">Current Order</h3>
                    <select 
                        className="text-sm border rounded p-1 outline-none"
                        value={pricingTier}
                        onChange={(e) => setPricingTier(e.target.value)}
                    >
                        <option value="retail">Retail Price</option>
                        <option value="wholesale">Wholesale Price</option>
                    </select>
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
                                        <h4 className="font-medium text-sm line-clamp-2">{item.ProductName}</h4>
                                        <p className="text-xs text-gray-500">{item.Variation}</p>
                                        <p className="text-sm font-semibold text-gray-900 mt-1">RM {item.Price.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center space-x-3 ml-4">
                                        <div className="flex items-center border rounded-md">
                                            <button onClick={() => updateQuantity(item.ProductID, -1)} className="p-1 hover:bg-gray-100 text-gray-600">
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.ProductID, 1)} className="p-1 hover:bg-gray-100 text-gray-600">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.ProductID)} className="text-red-500 hover:bg-red-50 p-1 rounded">
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
                        className="w-full h-14 text-lg font-bold shadow-lg"
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
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold">Payment</h2>
                            <span className="text-xl font-bold text-indigo-600">RM {total.toFixed(2)}</span>
                        </div>
                        
                        <div className="p-6 space-y-4 flex-1">
                            {paymentSuccess ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful</h3>
                                    <p className="text-gray-500">Receipt generated and inventory updated.</p>
                                </div>
                            ) : paymentMethod === '' ? (
                                <>
                                    <Button variant="outline" className="w-full h-16 justify-start text-lg" onClick={() => setPaymentMethod('cash')}>
                                        <Banknote className="mr-4 h-6 w-6 text-green-600" />
                                        Cash
                                    </Button>
                                    <Button variant="outline" className="w-full h-16 justify-start text-lg" onClick={() => setPaymentMethod('duitnow')}>
                                        <CreditCard className="mr-4 h-6 w-6 text-indigo-600" />
                                        DuitNow QR
                                    </Button>
                                </>
                            ) : paymentMethod === 'cash' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (RM)</label>
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
                                        disabled={change < 0 || !amountReceived}
                                        onClick={handleCompleteSale}
                                    >
                                        Complete Sale
                                    </Button>
                                </div>
                            ) : paymentMethod === 'duitnow' ? (
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                                        <span className="text-gray-500 text-center text-sm">QR Code<br/>Placeholder</span>
                                    </div>
                                    <p className="text-sm text-center text-gray-500">Customer scans the QR code to pay <strong>RM {total.toFixed(2)}</strong></p>
                                    
                                    <div className="w-full mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (Optional)</label>
                                        <Input 
                                            type="text" 
                                            placeholder="e.g. DuitNow Ref"
                                            value={referenceNumber}
                                            onChange={(e) => setReferenceNumber(e.target.value)}
                                        />
                                    </div>
                                    <Button 
                                        className="w-full h-14 text-lg font-bold mt-4" 
                                        onClick={handleCompleteSale}
                                    >
                                        Confirm Payment Received
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
