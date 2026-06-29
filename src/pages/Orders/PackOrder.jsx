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
            // Map the raw order items into the expected format for the UI
            const formattedItems = rawOrder.ImportedOrderItems.map(item => ({
                ItemID: item.ItemID,
                ProductName: item.ProductName,
                Variation: item.Variation,
                Barcode: item.Products?.Barcode || 'NO-BARCODE',
                RequiredQty: item.Quantity,
                PackedQty: 0
            }));

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
            const newOrder = { ...prev };
            // Find item by barcode that still needs packing
            const itemIndex = newOrder.Items.findIndex(i => i.Barcode === barcode && i.PackedQty < i.RequiredQty);
            
            if (itemIndex >= 0) {
                newOrder.Items[itemIndex].PackedQty += 1;
            } else {
                // Determine why it failed for better UX
                const isOverpacked = newOrder.Items.some(i => i.Barcode === barcode && i.PackedQty >= i.RequiredQty);
                if (isOverpacked) {
                    alert(`Item already fully packed! (${barcode})`);
                } else {
                    alert(`Item not in order or wrong barcode! (${barcode})`);
                }
            }
            return newOrder;
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
            await packOrder(orderId);
            alert(`Order ${orderId} marked as packed! Inventory deducted.`);
            navigate('/pick-queue');
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
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={() => navigate('/pick-queue')} className="p-2">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pack Order: {order.PlatformOrderID}</h1>
                    <p className="text-gray-500 mt-1">{order.Platform} • {order.AccountName}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-6 bg-gray-50 border-b flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-500 uppercase">Packing Progress</p>
                        <div className="flex items-end space-x-2 mt-1">
                            <span className="text-3xl font-bold text-indigo-600">{totalPacked}</span>
                            <span className="text-xl text-gray-400 mb-1">/ {totalRequired} items</span>
                        </div>
                    </div>
                    <div className="w-1/2">
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-indigo-600'}`} 
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
                            <div className="flex items-center mb-6 text-yellow-700 bg-yellow-50 p-4 rounded-lg">
                                <AlertTriangle className="h-5 w-5 mr-2" />
                                <p className="font-medium">Scan item barcodes using the hardware scanner to verify packing.</p>
                            </div>
                            
                            <ul className="space-y-4">
                                {order.Items.map((item, idx) => {
                                    const isItemComplete = item.PackedQty === item.RequiredQty;
                                    return (
                                        <li 
                                            key={idx} 
                                            className={`p-4 border rounded-xl flex items-center justify-between transition-colors
                                                ${isItemComplete ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                                        >
                                            <div className="flex items-center space-x-4">
                                                {isItemComplete ? (
                                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                                ) : (
                                                    <Package className="h-6 w-6 text-gray-300" />
                                                )}
                                                <div>
                                                    <h3 className={`font-bold ${isItemComplete ? 'text-green-800' : 'text-gray-900'}`}>
                                                        {item.ProductName}
                                                    </h3>
                                                    <p className="text-sm text-gray-500">{item.Variation} • Barcode: {item.Barcode}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center space-x-3">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">Packed</span>
                                                    <span className={`text-2xl font-bold ${isItemComplete ? 'text-green-600' : 'text-indigo-600'}`}>
                                                        {item.PackedQty} <span className="text-gray-400 text-lg">/ {item.RequiredQty}</span>
                                                    </span>
                                                </div>
                                                
                                                {/* Manual override buttons for fallback if scanner breaks */}
                                                {!isItemComplete && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="ml-4"
                                                        onClick={() => {
                                                            setOrder(prev => {
                                                                const newOrder = {...prev};
                                                                newOrder.Items[idx].PackedQty += 1;
                                                                return newOrder;
                                                            });
                                                        }}
                                                    >
                                                        Manual +1
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
