import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePricingMatrix, useBulkUpdatePricing } from '@/hooks/usePricing';
import { useSecretMode } from '@/hooks/useSecretMode';
import { Search, Save, AlertCircle, RefreshCw, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';


const PriceInput = ({ value, onChange, disabled }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const [prevValue, setPrevValue] = useState(value);

    if (value !== prevValue) {
        setPrevValue(value);
        setLocalValue(value || '');
    }

    return (
        <Input
            type="number"
            min="0"
            step="0.01"
            className="w-24 h-8 text-right font-medium tabular-nums"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
                const num = parseFloat(localValue);
                if (!isNaN(num)) {
                    onChange(num);
                    setLocalValue(num);
                } else if (localValue === '') {
                    onChange(0);
                    setLocalValue(0);
                }
            }}
            disabled={disabled}
        />
    );
};

export function PriceSetup() {
    const { t } = useTranslation();
    const { data: pricingData, isLoading, isError } = usePricingMatrix();
    const updatePricing = useBulkUpdatePricing();
    const { isHGHMode } = useSecretMode();

    const [searchQuery, setSearchQuery] = useState('');
    const [edits, setEdits] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handlePriceChange = (productId, field, value) => {
        setEdits(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || {}),
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (Object.keys(edits).length === 0) return;

        const updates = Object.keys(edits).map(productId => {
            const original = pricingData.find(p => p.ProductID === productId);
            const changes = edits[productId];
            
            return {
                ProductID: productId,
                PricingModel: original.PricingModel || 'HQ_DISCOUNT',
                BasePrice: changes.BasePrice ?? original.BasePrice,
                RetailRule: changes.RetailRule ?? original.RetailRule,
                WholesaleRule: changes.WholesaleRule ?? original.WholesaleRule,
                AgentMarkup: changes.AgentMarkup ?? original.AgentMarkup, // AgentMarkup acts as Agent Price in Absolute mode
                CostPrice: changes.CostPrice ?? original.CostPrice,
                FakeCostPrice: changes.FakeCostPrice ?? original.FakeCostPrice,
                StockistPrice: changes.StockistPrice ?? original.StockistPrice,
            };
        });

        try {
            await updatePricing.mutateAsync(updates);
            setEdits({});
            alert(t('pricingSetup.success'));
        } catch (error) {
            console.error(error);
            alert(t('pricingSetup.errorSave'));
        }
    };

    const filteredData = useMemo(() => {
        if (!pricingData) return [];
        return pricingData.filter(item => 
            item.ProductName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.MasterSKU && item.MasterSKU.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [pricingData, searchQuery]);

    const hasChanges = Object.keys(edits).length > 0;

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="h-6 w-6 animate-spin text-zinc-400" /></div>;
    }

    if (isError) {
        return <div className="text-red-500 p-4 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle /> {t('pricingSetup.errorLoad')}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder={t('pricingSetup.searchPlaceholder')}
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <Button 
                            variant="outline"
                            onClick={() => setIsModalOpen(true)}
                            className="relative border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            View Update
                            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                {Object.keys(edits).length}
                            </span>
                        </Button>
                    )}
                    <Button 
                        onClick={handleSave} 
                        disabled={!hasChanges || updatePricing.isPending}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {updatePricing.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {t('pricingSetup.saveChanges')}
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto max-h-[calc(100vh-250px)]">
                <table className="w-full text-sm text-left relative">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[200px]">{t('pricingSetup.productName')}</th>
                            {isHGHMode && <th className="px-4 py-3 font-medium text-right text-red-600">{t('pricingSetup.fakeCost')}</th>}
                            {isHGHMode && <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.realCost')}</th>}
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.stockist')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.wholesale')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.agent')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.retail')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map((product) => {
                            const isEdited = !!edits[product.ProductID];
                            const currentEdits = edits[product.ProductID] || {};
                            
                            const dCostPrice = currentEdits.CostPrice ?? product.CostPrice;
                            const dFakeCostPrice = currentEdits.FakeCostPrice ?? product.FakeCostPrice;
                            const dStockistPrice = currentEdits.StockistPrice ?? product.StockistPrice;
                            const dWholesale = currentEdits.WholesaleRule ?? product.WholesaleRule;
                            const dAgent = currentEdits.AgentMarkup ?? product.AgentMarkup; // Acts as Agent Price
                            const dRetail = currentEdits.RetailRule ?? product.RetailRule;
                            const formattedName = [product.Brand, product.ProductName, product.Variation, product.Size].filter(Boolean).join(' ');
                            
                            return (
                                <tr key={product.ProductID} className={isEdited ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{formattedName}</div>
                                        <div className="text-xs text-gray-500">{product.MasterSKU}</div>
                                    </td>
                                    
                                    {isHGHMode && (
                                        <td className="px-4 py-3 text-right">
                                            <PriceInput 
                                                value={dFakeCostPrice} 
                                                onChange={(val) => handlePriceChange(product.ProductID, 'FakeCostPrice', val)} 
                                            />
                                        </td>
                                    )}
                                    {isHGHMode && (
                                        <td className="px-4 py-3 text-right">
                                            <PriceInput 
                                                value={dCostPrice} 
                                                onChange={(val) => handlePriceChange(product.ProductID, 'CostPrice', val)} 
                                            />
                                        </td>
                                    )}
                                    
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput 
                                            value={dStockistPrice} 
                                            onChange={(val) => handlePriceChange(product.ProductID, 'StockistPrice', val)} 
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput 
                                            value={dWholesale} 
                                            onChange={(val) => handlePriceChange(product.ProductID, 'WholesaleRule', val)} 
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput 
                                            value={dAgent} 
                                            onChange={(val) => handlePriceChange(product.ProductID, 'AgentMarkup', val)} 
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput 
                                            value={dRetail} 
                                            onChange={(val) => {
                                                handlePriceChange(product.ProductID, 'RetailRule', val);
                                                handlePriceChange(product.ProductID, 'BasePrice', val); 
                                            }} 
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={isHGHMode ? 7 : 5} className="px-4 py-8 text-center text-gray-500">
                                    {t('pricingSetup.noProducts')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-none shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Review Price Changes</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 sticky top-0 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Product</th>
                                        <th className="px-4 py-3 font-medium">Field</th>
                                        <th className="px-4 py-3 font-medium text-right">Old Price</th>
                                        <th className="px-4 py-3 font-medium text-right">New Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(edits).map(([productId, changes]) => {
                                        const product = pricingData?.find(p => p.ProductID === productId);
                                        if (!product) return null;
                                        const formattedName = [product.Brand, product.ProductName, product.Variation, product.Size].filter(Boolean).join(' ');
                                        
                                        return Object.entries(changes).map(([field, newValue]) => {
                                            const oldValue = product[field] || 0;
                                            // Format field name for better readability
                                            let displayField = field;
                                            if (field === 'RetailRule') displayField = 'Retail Price';
                                            else if (field === 'WholesaleRule') displayField = 'Wholesale';
                                            else if (field === 'AgentMarkup') displayField = 'Agent';
                                            else if (field === 'CostPrice') displayField = 'Real Cost';
                                            else if (field === 'FakeCostPrice') displayField = 'Fake Cost';
                                            else if (field === 'StockistPrice') displayField = 'Stockist';

                                            return (
                                                <tr key={`${productId}-${field}`} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{formattedName}</div>
                                                        <div className="text-xs text-gray-500">{product.MasterSKU}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">{displayField}</td>
                                                    <td className="px-4 py-3 text-right text-gray-500 line-through">RM {Number(oldValue).toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-indigo-600">RM {Number(newValue).toFixed(2)}</td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    handleSave();
                                    setIsModalOpen(false);
                                }} 
                                disabled={updatePricing.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {updatePricing.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
