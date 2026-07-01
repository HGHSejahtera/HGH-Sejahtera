import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';

import { useOrders, useOrderDetails } from '@/hooks/useOrders';

export function PackOrder() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [isComplete, setIsComplete] = useState(false);

    const { packOrder, isPacking } = useOrders();
    const { data: rawOrder, isLoading } = useOrderDetails(orderId);

    useEffect(() => {
        if (rawOrder && !order) {
            const formattedItems = rawOrder.ImportedOrderItems.map(item => {
                let internalName = item.ProductName; // fallback to TikTok name
                if (item.Products) {
                    const parts = [];
                    if (item.Products.Brand) parts.push(item.Products.Brand);
                    if (item.Products.ProductName) parts.push(item.Products.ProductName);
                    if (item.Products.Variation) parts.push(item.Products.Variation);
                    if (item.Products.Size) parts.push(item.Products.Size);
                    
                    if (parts.length > 0) internalName = parts.join(' ');
                }

                return {
                    ItemID: item.ItemID,
                    ProductName: internalName,
                    Barcode: item.Products?.Barcode || 'NO-BARCODE',
                    RequiredQty: item.Quantity,
                    PackedQty: 0
                };
            });

            // eslint-disable-next-line
            setOrder({
                ...rawOrder,
                AccountName: rawOrder.AccountName || 'Unknown',
                Items: formattedItems
            });
        }
    }, [rawOrder, order]);

    useHardwareScanner((barcode) => {
        if (!order || isComplete) return;

        setOrder(prev => {
            const itemIndex = prev.Items.findIndex(i => i.Barcode === barcode && i.PackedQty < i.RequiredQty);
            
            if (itemIndex >= 0) {
                const newItems = [...prev.Items];
                newItems[itemIndex] = {
                    ...newItems[itemIndex],
                    PackedQty: newItems[itemIndex].PackedQty + 1
                };
                return { ...prev, Items: newItems };
            } else {
                // Determine why it failed for better UX
                const isOverpacked = prev.Items.some(i => i.Barcode === barcode && i.PackedQty >= i.RequiredQty);
                if (isOverpacked) {
                    alert(`Item already fully packed! (${barcode})`);
                } else {
                    alert(`Item not in order or wrong barcode! (${barcode})`);
                }
                return prev;
            }
        });
    });

    useEffect(() => {
        if (order) {
            const totalRequired = order.Items.reduce((sum, item) => sum + item.RequiredQty, 0);
            const totalPacked = order.Items.reduce((sum, item) => sum + item.PackedQty, 0);
            if (totalRequired > 0 && totalRequired === totalPacked) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsComplete(true);
            }
        }
    }, [order]);

    const handleCompleteOrder = async () => {
        try {
            await packOrder(order.ImportedOrderID);
            alert(`Order ${order.PlatformOrderID} marked as packed! Inventory deducted.`);
            navigate('/Pick-Pack');
        } catch (error) {
            alert(error.message || 'Failed to complete order');
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading order details...</div>;
    if (!order) return <div className="p-8 text-center text-gray-500">Order not found or still loading...</div>;

    const totalRequired = order.Items.reduce((sum, item) => sum + item.RequiredQty, 0);
    const totalPacked = order.Items.reduce((sum, item) => sum + item.PackedQty, 0);
    const progress = Math.round((totalPacked / totalRequired) * 100);

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={() => navigate('/Pick-Pack')} className="p-3 h-12 w-12 rounded-full hover:bg-gray-200 transition-colors">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pack Order: {order.PlatformOrderID}</h1>
                    <p className="text-gray-500 mt-1">{order.Platform} • {order.AccountName}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-8 bg-gray-50/80 border-b flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Packing Progress</p>
                        <div className="flex items-end space-x-2 mt-1">
                            <span className="text-4xl font-black text-indigo-600">{totalPacked}</span>
                            <span className="text-xl text-gray-400 mb-1 font-medium">/ {totalRequired} items</span>
                        </div>
                    </div>
                    <div className="w-1/2">
                        <div className="h-4 bg-gray-200/80 rounded-full overflow-hidden shadow-inner">
                            <div 
                                className={`h-full transition-all duration-700 ease-out ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} 
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {isComplete ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="bg-green-100 p-4 rounded-full mb-4">
                                <CheckCircle className="h-16 w-16 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Fully Packed!</h2>
                            <p className="text-gray-500 mb-8">All items have been verified via barcode scanner.</p>
                            <Button 
                                size="lg" 
                                className="h-14 px-8 text-lg font-bold" 
                                onClick={handleCompleteOrder}
                                disabled={isPacking}
                            >
                                {isPacking ? 'Processing...' : 'Confirm & Update Inventory'}
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center mb-6 text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200/60 shadow-sm">
                                <div className="bg-amber-100/80 p-2 rounded-lg mr-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <p className="font-medium text-sm">Scan item barcodes using the hardware scanner to verify packing.</p>
                            </div>
                            
                            <ul className="space-y-4">
                                {order.Items.map((item, idx) => {
                                    const isItemComplete = item.PackedQty === item.RequiredQty;
                                    return (
                                        <li 
                                            key={idx} 
                                            className={`p-5 border-2 rounded-2xl flex items-center justify-between transition-all duration-300
                                                ${isItemComplete ? 'bg-emerald-50/40 border-emerald-200 shadow-sm' : 'bg-white border-gray-100 hover:border-indigo-100 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center space-x-5">
                                                {isItemComplete ? (
                                                    <div className="bg-emerald-100 p-3 rounded-full">
                                                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 p-3 rounded-full border border-gray-100">
                                                        <Package className="h-6 w-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <h3 className={`font-bold text-lg leading-snug max-w-2xl ${isItemComplete ? 'text-emerald-900' : 'text-gray-900'}`}>
                                                        {item.ProductName}
                                                    </h3>
                                                    <div className="flex items-center mt-2">
                                                        <span className="text-sm font-mono font-medium text-gray-700 bg-gray-100/80 px-2 py-0.5 rounded border border-gray-200">{item.Barcode}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center space-x-6">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-gray-400 tracking-widest uppercase font-bold mb-1">Packed</span>
                                                    <span className={`text-3xl font-black tracking-tight ${isItemComplete ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                        {item.PackedQty} <span className="text-gray-300 text-xl font-semibold">/ {item.RequiredQty}</span>
                                                    </span>
                                                </div>
                                                
                                                {/* Manual override buttons for fallback if scanner breaks */}
                                                {!isItemComplete && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="px-4 py-2 h-auto font-semibold bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors shadow-sm"
                                                        onClick={() => {
                                                            setOrder(prev => {
                                                                const newItems = [...prev.Items];
                                                                newItems[idx] = {
                                                                    ...newItems[idx],
                                                                    PackedQty: newItems[idx].PackedQty + 1
                                                                };
                                                                return { ...prev, Items: newItems };
                                                            });
                                                        }}
                                                    >
                                                        Manual
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
