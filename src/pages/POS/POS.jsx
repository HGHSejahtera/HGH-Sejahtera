import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, Wallet, CheckCircle, Tag, Crown, Building2, Briefcase, ChevronDown, Check, LayoutGrid, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useProducts } from '@/hooks/useProducts';
import { usePOS } from '@/hooks/usePOS';
import { Receipt } from './Receipt';

const TIER_OPTIONS = [
    { id: 'stockist', label: 'Stockist', icon: Crown, badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200', iconClass: 'text-emerald-600' },
    { id: 'wholesale', label: 'Wholesale', icon: Building2, badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', iconClass: 'text-amber-600' },
    { id: 'agent', label: 'Agent', icon: Briefcase, badgeClass: 'bg-purple-50 text-purple-800 border-purple-200', iconClass: 'text-purple-600' },
    { id: 'retail', label: 'Retail', icon: Tag, badgeClass: 'bg-blue-50 text-blue-800 border-blue-200', iconClass: 'text-blue-600' }
];

export function POS() {
    const { data: products = [], isLoading } = useProducts();
    const { completeSale, isProcessing } = usePOS();
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pricingTier, setPricingTier] = useState('retail');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('pos_product_view_mode') || 'grid');
    const searchInputRef = useRef(null);
    const itemRefs = useRef([]);

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem('pos_product_view_mode', mode);
    };
    const [isTestMode, setIsTestMode] = useState(false); // retail, wholesale
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(''); // '', 'cash', 'duitnow'
    const [amountReceived, setAmountReceived] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [saleData, setSaleData] = useState(null);
    const [editingPriceItemId, setEditingPriceItemId] = useState(null);

    const addToCart = (product, { clearSearch = false } = {}) => {
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
        if (clearSearch) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedIndex(0);
        }
    };

    useHardwareScanner((barcode) => {
        const product = products.find(p => p.Barcode === barcode);
        if (product) {
            addToCart(product, { clearSearch: true });
        } else {
            alert(`Product with barcode ${barcode} not found!`);
        }
    });

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        setSelectedIndex(0);
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
        if (e.key === 'ArrowDown') {
            if (searchResults.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            if (searchResults.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
        } else if (e.key === 'Enter' && searchQuery) {
            e.preventDefault();
            const exactMatch = products.find(p => 
                p.Barcode === searchQuery || 
                p.MasterSKU === searchQuery
            );
            
            if (exactMatch) {
                addToCart(exactMatch, { clearSearch: true });
            } else if (searchResults.length > 0 && selectedIndex >= 0 && selectedIndex < searchResults.length) {
                addToCart(searchResults[selectedIndex], { clearSearch: false });
            } else if (searchResults.length === 0) {
                alert(`Product not found!`);
            }
        }
    };

    const handleGlobalKeyDown = useCallback((e) => {
        if (paymentModalOpen || editingPriceItemId !== null) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowDown') {
            if (searchResults.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            if (searchResults.length > 0) {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
        } else if (e.key === 'Enter') {
            if (searchResults.length > 0 && selectedIndex >= 0 && selectedIndex < searchResults.length) {
                e.preventDefault();
                addToCart(searchResults[selectedIndex], { clearSearch: false });
                searchInputRef.current?.focus();
            }
        }
    }, [searchResults, selectedIndex, paymentModalOpen, editingPriceItemId]);

    useEffect(() => {
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [handleGlobalKeyDown]);

    useEffect(() => {
        const activeEl = itemRefs.current[selectedIndex];
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const getPrice = (item) => {
        if (item.customPrice !== undefined) return parseFloat(item.customPrice);
        if (pricingTier === 'stockist') return item.StockistPrice || 0;
        if (pricingTier === 'agent') return item.AgentPrice || 0;
        if (pricingTier === 'wholesale') return item.WholesalePrice || 0;
        return item.RetailPrice || 0;
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
                const currentQty = typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : (parseInt(item.quantity, 10) || 1);
                const newQty = currentQty + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }));
    };

    const setQuantityManual = (productId, val) => {
        setCart(prev => prev.map(item => {
            if (item.ProductID === productId) {
                return { ...item, quantity: val };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.ProductID !== productId));
    };

    const handleCompleteSale = async () => {
        if (!paymentMethod) return;

        const getSafeQty = (q) => typeof q === 'number' && !isNaN(q) && q > 0 ? q : (parseInt(q, 10) || 1);
        const subtotalCalc = cart.reduce((sum, item) => sum + (getPrice(item) * getSafeQty(item.quantity)), 0);
        const changeCalc = paymentMethod === 'cash' ? parseFloat(amountReceived || 0) - subtotalCalc : 0;

        try {
            const result = await completeSale.mutateAsync({
                isTestMode,
                CustomerTier: TIER_OPTIONS.find(t => t.id === pricingTier)?.label || 'Retail',
                PaymentMethod: paymentMethod === 'cash' ? 'Cash' : 'DuitNowQR',
                PaymentReference: referenceNumber || null,
                AmountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived || 0) : subtotalCalc,
                ChangeGiven: changeCalc > 0 ? changeCalc : 0,
                TotalAmount: subtotalCalc,
                CustomerName: null,
                CustomerCompany: null,
                CustomerPhone: null,
                Items: cart.map(item => {
                    const safeQty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : (parseInt(item.quantity, 10) || 1);
                    return {
                        ProductID: item.ProductID,
                        Quantity: safeQty,
                        UnitPrice: getPrice(item),
                        Subtotal: getPrice(item) * safeQty,
                        IsPriceOverride: item.customPrice !== undefined
                    };
                })
            });

            const finalSaleId = result?.SaleID || result?.sale_id;

            setSaleData({
                customerTier: TIER_OPTIONS.find(t => t.id === pricingTier)?.label || 'Retail',
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

    const getSafeQty = (q) => typeof q === 'number' && !isNaN(q) && q > 0 ? q : (parseInt(q, 10) || 1);
    const subtotal = cart.reduce((sum, item) => sum + (getPrice(item) * getSafeQty(item.quantity)), 0);
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
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden print:block print:overflow-visible print:h-auto">
            {/* Left: Product Search & Scanning */}
            <div className="w-full lg:w-2/3 p-4 md:p-6 flex flex-col border-r h-full overflow-hidden bg-gray-50 print:hidden">
                <div className="mb-6 shrink-0 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search" 
                            className={`pl-10 h-12 text-base shadow-sm bg-white ${searchQuery ? 'pr-10' : ''}`}
                            value={searchQuery}
                            onChange={handleSearch}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                    setSelectedIndex(0);
                                    searchInputRef.current?.focus();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                                title="Clear Search"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center bg-gray-200/80 p-1 rounded-lg border border-gray-300/60 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleViewModeChange('grid')}
                            title="Grid View"
                            className={`p-2 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleViewModeChange('list')}
                            title="List View"
                            className={`p-2 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search Results */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-2">
                    {searchQuery.length > 2 && searchResults.length > 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {searchResults.map(product => (
                                    <div 
                                        key={product.ProductID}
                                        onClick={() => {
                                            addToCart(product, { clearSearch: false });
                                            searchInputRef.current?.focus();
                                        }}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all active:scale-95 flex justify-between items-start gap-4"
                                    >
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">{product.Brand || 'No Brand'}</p>
                                            <h3 className="font-semibold text-gray-900 line-clamp-2 leading-tight">{product.ProductName}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{`${product.Variation || ''} ${product.Size || ''}`.trim()}</p>
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
                        ) : (
                            <div className="divide-y divide-gray-200 border border-gray-200 bg-white overflow-hidden shadow-xs">
                                {searchResults.map((product, index) => {
                                    const isSelected = index === selectedIndex;
                                    const fullName = [product.Brand, product.ProductName, product.Variation, product.Size]
                                        .filter(Boolean)
                                        .join(' ');
                                    const barcodeOnly = product.Barcode || '-';

                                    return (
                                        <div 
                                            key={product.ProductID}
                                            ref={(el) => (itemRefs.current[index] = el)}
                                            onClick={() => {
                                                addToCart(product, { clearSearch: false });
                                                searchInputRef.current?.focus();
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={`p-3.5 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-indigo-50 border-l-4 border-l-indigo-600 pl-2.5 font-medium' 
                                                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-sm truncate leading-snug ${isSelected ? 'font-bold text-indigo-950' : 'font-semibold text-gray-900'}`}>
                                                    {fullName}
                                                </h4>
                                                <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">
                                                    {barcodeOnly}
                                                </p>
                                            </div>
                                            <div className="flex items-center shrink-0 text-right">
                                                <div className="text-base font-bold text-indigo-600">
                                                    RM {getPrice(product).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
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
            <div className="w-full lg:w-1/3 flex flex-col h-full bg-white print:hidden">
                <div className="p-4 border-b flex justify-between items-center bg-white z-10 shadow-sm shrink-0">
                    <h3 className="font-bold text-lg">Order</h3>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border shadow-2xs transition-all cursor-pointer ${TIER_OPTIONS.find(t => t.id === pricingTier)?.badgeClass || TIER_OPTIONS[3].badgeClass}`}>
                                {(() => {
                                    const currentConfig = TIER_OPTIONS.find(t => t.id === pricingTier) || TIER_OPTIONS[3];
                                    const IconComp = currentConfig.icon;
                                    return <IconComp className={`w-3.5 h-3.5 ${currentConfig.iconClass}`} />;
                                })()}
                                <span>{TIER_OPTIONS.find(t => t.id === pricingTier)?.label || 'Retail'}</span>
                                <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-60" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 bg-white rounded-md shadow-lg border-gray-200 p-1 space-y-0.5 z-50">
                            {TIER_OPTIONS.map(option => {
                                const IconComponent = option.icon;
                                const isSelected = pricingTier === option.id;
                                return (
                                    <DropdownMenuItem
                                        key={option.id}
                                        onClick={() => setPricingTier(option.id)}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium cursor-pointer transition-colors ${isSelected ? 'bg-gray-100 font-bold text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <IconComponent className={`w-3.5 h-3.5 shrink-0 ${option.iconClass}`} />
                                        <span className="flex-1">{option.label}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-gray-900 shrink-0" />}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                                        <p className="text-xs text-gray-500 mt-0.5">{`${item.Variation || ''} ${item.Size || ''}`.trim()}</p>
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
                                            <input 
                                                type="number" 
                                                min="1" 
                                                value={item.quantity} 
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                                    if (val === '' || (!isNaN(val) && val >= 1)) {
                                                        setQuantityManual(item.ProductID, val);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value, 10);
                                                    if (isNaN(val) || val < 1) {
                                                        setQuantityManual(item.ProductID, 1);
                                                    }
                                                }}
                                                className="w-12 text-center text-sm font-medium text-gray-900 border-none focus:outline-none bg-transparent py-1 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:static print:inset-auto print:bg-transparent print:p-0 print:block print:overflow-visible print:z-auto">
                    <div className={`bg-white rounded-none shadow-xl w-full ${showReceipt ? 'max-w-3xl' : 'max-w-md'} max-h-[95vh] overflow-hidden flex flex-col print:max-w-none print:max-h-none print:shadow-none print:border-none print:w-full print:overflow-visible print:block print:m-0 print:p-0`}>
                        <div className="p-6 border-b flex justify-between items-center print:hidden">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold">Payment</h2>
                            </div>
                            <span className="text-xl font-bold text-indigo-600">RM {total.toFixed(2)}</span>
                        </div>
                        
                        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col print:p-0 print:overflow-visible print:block print:space-y-0">
                            {showReceipt ? (
                                <div className="flex flex-col h-full overflow-hidden print:overflow-visible print:block print:h-auto">
                                    <div className="flex items-center justify-center mb-4 shrink-0 print:hidden">
                                        <CheckCircle className="h-6 w-6 text-green-600 mr-2 print:hidden" />
                                        <span className="text-lg font-bold text-gray-900 print:hidden">Payment Successful</span>
                                    </div>
                                    <div className="w-full border rounded-lg p-2 bg-gray-50 overflow-y-auto flex-1 print:overflow-visible print:border-none print:p-0 print:bg-white custom-scrollbar print:block print:flex-none">
                                        <Receipt saleData={saleData} />
                                    </div>
                                    <div className="flex flex-wrap gap-3 w-full mt-4 shrink-0 print:hidden">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 h-12 border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold" 
                                            onClick={() => {
                                                setShowReceipt(false);
                                                setPaymentSuccess(false);
                                                setPaymentModalOpen(false);
                                            }}
                                        >
                                            Back
                                        </Button>
                                        <Button variant="outline" className="flex-1 h-12 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold" onClick={() => window.print()}>
                                            Print Receipt
                                        </Button>
                                        <Button className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={handleNewSale}>
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

                        {!showReceipt && (
                            <div className="p-4 border-t bg-gray-50 flex justify-between items-center print:hidden">
                                <Button 
                                    variant="outline" 
                                    className="border-gray-300 text-gray-700 font-medium"
                                    onClick={() => {
                                        if (paymentMethod !== '') {
                                            setPaymentMethod('');
                                        } else {
                                            setPaymentModalOpen(false);
                                        }
                                    }}
                                >
                                    Back
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
                                    onClick={() => { 
                                        setPaymentModalOpen(false); 
                                        setPaymentMethod(''); 
                                    }}
                                >
                                    Cancel Order
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
