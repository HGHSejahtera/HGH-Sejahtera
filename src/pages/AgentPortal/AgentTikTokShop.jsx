import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Trash2, Edit2, Check, X } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAgentPortal } from '@/hooks/useAgentPortal';
import { useProducts } from '@/hooks/useProducts';
import { AgentTabs } from './AgentTabs';

const EditablePriceCell = ({ initialValue, onSave, isUpdating }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(initialValue);

    const handleSave = async () => {
        const numVal = parseFloat(val);
        if (!isNaN(numVal) && numVal !== initialValue) {
            await onSave(numVal);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input 
                    type="number" 
                    value={val} 
                    onChange={e => setVal(e.target.value)} 
                    className="w-20 h-7 text-xs px-2"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') { setVal(initialValue); setIsEditing(false); }
                    }}
                    disabled={isUpdating}
                />
                <button onClick={handleSave} disabled={isUpdating} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setVal(initialValue); setIsEditing(false); }} disabled={isUpdating} className="text-red-600 hover:text-red-800"><X className="w-4 h-4" /></button>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <span>RM {Number(initialValue).toFixed(2)}</span>
            <button className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="w-3 h-3" />
            </button>
        </div>
    );
};

export function AgentTikTokShop() {
    const navigate = useNavigate();
    const { tiktokProducts, isLoadingTikTokProducts, updateTikTokPrice, deleteTikTokProduct } = useAgentPortal();
    const { data: allProducts, isLoading: isLoadingProducts } = useProducts();

    const mergedData = useMemo(() => {
        if (!tiktokProducts || !allProducts) return [];

        return tiktokProducts.map(tp => {
            const matchedProduct = allProducts.find(p => p.Barcode === tp.SellerSKU || p.SellerSKU === tp.SellerSKU);
            
            let brand = '', productName = 'Unknown Product (Unmatched)', variation = '', size = '';
            let agentCostPrice = 0;
            let stockQuantity = 0;
            let isMatched = false;

            if (matchedProduct) {
                isMatched = true;
                brand = matchedProduct.Brand || '';
                productName = matchedProduct.ProductName || '';
                variation = matchedProduct.Variation || '';
                size = matchedProduct.Size || '';
                agentCostPrice = matchedProduct.AgentPrice || 0;
                stockQuantity = matchedProduct.StockQuantity || 0;
            }

            const profitMarginRM = tp.SellingPrice - agentCostPrice;
            const profitMarginPct = agentCostPrice > 0 ? (profitMarginRM / agentCostPrice) * 100 : 0;

            // Format "Products" column
            const productDetailsString = isMatched 
                ? [brand, productName, variation, size].filter(Boolean).join(' ') 
                : '⚠️ Product Not Found in HGH System';

            return {
                ...tp,
                ProductDetails: productDetailsString,
                AgentCostPrice: agentCostPrice,
                ProfitMarginRM: profitMarginRM,
                ProfitMarginPct: profitMarginPct,
                StockQuantity: stockQuantity,
                IsMatched: isMatched
            };
        });
    }, [tiktokProducts, allProducts]);

    const handleUpdatePrice = useCallback(async (sellerSKU, newPrice) => {
        try {
            await updateTikTokPrice({ sellerSKU, sellingPrice: newPrice });
        } catch (error) {
            console.error("Failed to update price", error);
        }
    }, [updateTikTokPrice]);

    const columns = useMemo(() => [
        {
            id: 'Products',
            header: 'Products',
            accessorFn: row => row.ProductDetails,
            cell: info => {
                const isMatched = info.row.original.IsMatched;
                return (
                    <span className={`font-medium ${!isMatched ? 'text-orange-600' : 'text-gray-900'}`}>
                        {info.getValue()}
                    </span>
                );
            }
        },
        {
            id: 'SellerSKU',
            header: 'Seller SKU',
            accessorKey: 'SellerSKU',
            cell: info => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{info.getValue()}</span>
        },
        {
            id: 'AgentCostPrice',
            header: 'Cost Price',
            accessorKey: 'AgentCostPrice',
            cell: info => <span className="text-gray-600">RM {Number(info.getValue()).toFixed(2)}</span>
        },
        {
            id: 'SellingPrice',
            header: 'Sell Price',
            accessorKey: 'SellingPrice',
            cell: info => (
                <EditablePriceCell 
                    initialValue={info.getValue()} 
                    onSave={(newPrice) => handleUpdatePrice(info.row.original.SellerSKU, newPrice)}
                />
            )
        },
        {
            id: 'ProfitMargin',
            header: 'Profit Margin',
            accessorFn: row => row.ProfitMarginRM,
            cell: info => {
                const rm = info.row.original.ProfitMarginRM;
                const pct = info.row.original.ProfitMarginPct;
                const isProfit = rm >= 0;
                return (
                    <div className="flex flex-col">
                        <span className={`font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                            {rm > 0 ? '+' : ''}RM {rm.toFixed(2)}
                        </span>
                        {info.row.original.AgentCostPrice > 0 && (
                            <span className="text-xs text-gray-500">{pct.toFixed(1)}% margin</span>
                        )}
                    </div>
                );
            }
        },


    ], [deleteTikTokProduct, handleUpdatePrice]);

    const isLoading = isLoadingTikTokProducts || isLoadingProducts;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">TikTok Shop</h1>
                </div>
            </div>

            <AgentTabs />

            {!isLoading && mergedData.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                        <img src="/Logo/TikTok-Mono.svg" alt="TikTok" className="w-8 h-8 opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No products synced yet</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                        Upload your TikTok Seller Center Excel file to track your products, prices, and profit margins automatically.
                    </p>
                    <Button 
                        onClick={() => navigate('/Agent/TikTok-Shop/TikTok-Sync')}
                        className="bg-[#00897b] hover:bg-teal-700"
                    >
                        Sync Now
                    </Button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden">
                    <DataTable 
                        columns={columns} 
                        data={mergedData}
                        isLoading={isLoading}
                        searchable={true}
                        searchField="Products"
                        actionElement={
                            <Button 
                                onClick={() => navigate('/Agent/TikTok-Shop/TikTok-Sync')}
                                className="bg-[#00897b] hover:bg-teal-700 text-white flex items-center gap-2 h-9"
                                size="sm"
                            >
                                <UploadCloud className="w-4 h-4" />
                                Sync Excel
                            </Button>
                        }
                    />
                </div>
            )}
        </div>
    );
}
