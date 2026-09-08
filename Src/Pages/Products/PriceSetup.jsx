import { useState, useMemo } from 'react';
import { useTranslation } from '@/Hooks/UseTranslation';
import { usePricingMatrix, useBulkUpdatePricing } from '@/Hooks/UsePricing';
import { useSecretMode } from '@/Hooks/UseSecretMode';
import { Search, Save, AlertCircle, RefreshCw, X, Undo2, CheckCircle2, HelpCircle } from 'lucide-react';
import { Input } from '@/Components/UI/Input';
import { Button } from '@/Components/UI/Button';


const PriceInput = ({ value, onChange, disabled, type = 'selling', costPrice = 0, sellingPrices = [] }) => {
    const [localValue, setLocalValue] = useState(value ?? '');
    const [prevValue, setPrevValue] = useState(value);

    if (value !== prevValue) {
        setLocalValue(value ?? '');
        setPrevValue(value);
    }

    const numVal = parseFloat(localValue);
    const numCost = parseFloat(costPrice) || 0;

    const isUnfilled = isNaN(numVal) || numVal <= 0;
    const isBelowCost = type === 'selling' && !isUnfilled && numCost > 0 && numVal < numCost;
    const isCost = type === 'cost';
    const isFakeCost = type === 'fake-cost';
    const validSellingPrices = sellingPrices.map(p => parseFloat(p) || 0).filter(p => p > 0);
    const isLowestCost = isCost && !isUnfilled && validSellingPrices.length > 0 && validSellingPrices.every(p => numVal < p);

    let colorClasses = 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 focus:border-indigo-500 font-medium';
    let tooltipTitle = '';

    if (isUnfilled) {
        colorClasses = 'bg-amber-50 border-amber-300 text-amber-900 placeholder:text-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 font-medium';
        tooltipTitle = 'Unfilled';
    } else if (isBelowCost) {
        colorClasses = 'bg-rose-50 border-rose-400 text-rose-700 font-bold focus:border-rose-500 focus:ring-1 focus:ring-rose-200';
        tooltipTitle = 'Loss Alert';
    } else if (isLowestCost) {
        colorClasses = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium hover:border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200';
        tooltipTitle = 'Lowest Cost';
    } else if (isCost) {
        colorClasses = 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 focus:border-indigo-500 font-medium';
        tooltipTitle = 'Cost';
    } else if (isFakeCost) {
        colorClasses = 'bg-orange-100 border-orange-400 text-orange-950 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-200';
        tooltipTitle = 'Fake Cost';
    } else if (type === 'selling') {
        colorClasses = 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 focus:border-indigo-500 font-medium';
        tooltipTitle = 'Selling Price';
    }

    return (
        <Input
            type="number"
            min="0"
            step="0.01"
            title={tooltipTitle}
            className={`w-24 h-8 text-right tabular-nums transition-colors ${colorClasses}`}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
                const num = parseFloat(localValue);
                if (!isNaN(num)) {
                    if (num !== parseFloat(prevValue)) {
                        onChange(num);
                    }
                    setLocalValue(num);
                } else if (localValue === '') {
                    if (prevValue !== 0 && prevValue !== '0' && prevValue !== '' && prevValue !== null && prevValue !== undefined) {
                        onChange(0);
                    }
                    setLocalValue(0);
                }
            }}
            disabled={disabled}
        />
    );
};

const ColorGuideModal = ({ isOpen, onClose, isHGHMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-none shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-indigo-600" />
                        Color Guide
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-3.5 text-sm">
                    <div className="flex items-start gap-3 p-2.5 rounded-none border border-amber-200 bg-amber-50/60">
                        <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <div className="font-semibold text-amber-950">Unfilled</div>
                            <div className="text-xs text-amber-800">Highlighted in amber when no price has been set yet.</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-none border border-rose-200 bg-rose-50/60">
                        <div className="w-4 h-4 rounded-full bg-rose-100 border border-rose-500 mt-0.5 shrink-0" />
                        <div>
                            <div className="font-semibold text-rose-950">Loss Alert</div>
                            <div className="text-xs text-rose-800">Highlighted in bold red when selling price is lower than cost.</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-none border border-emerald-200 bg-emerald-50/60">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-500 mt-0.5 shrink-0" />
                        <div>
                            <div className="font-semibold text-emerald-950">Lowest Cost</div>
                            <div className="text-xs text-emerald-800">Highlighted in soft green when cost is lower than all selling prices.</div>
                        </div>
                    </div>

                    {isHGHMode && (
                        <div className="flex items-start gap-3 p-2.5 rounded-none border border-orange-300 bg-orange-50/80">
                            <div className="w-4 h-4 rounded-full bg-orange-100 border border-orange-500 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-orange-950">Fake Cost</div>
                                <div className="text-xs text-orange-800">Decoy cost price shown to protect actual business margins.</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-none px-6">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export function PriceSetup() {
    const { t } = useTranslation();
    const { data: pricingData, isLoading, isError } = usePricingMatrix();
    const updatePricing = useBulkUpdatePricing();
    const { isHGHMode } = useSecretMode();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name-asc');
    const [edits, setEdits] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isColorGuideOpen, setIsColorGuideOpen] = useState(false);
    const [statusMsg, setStatusMsg] = useState(null);

    const handleSortCycle = () => {
        if (sortBy === 'name-asc') {
            setSortBy('name-desc');
        } else if (sortBy === 'name-desc') {
            setSortBy('brand');
        } else {
            setSortBy('name-asc');
        }
    };

    const handlePriceChange = (productId, field, value) => {
        setEdits(prev => {
            const product = pricingData?.find(p => p.ProductID === productId);
            const origVal = product ? (product[field] ?? 0) : 0;
            const numVal = parseFloat(value) || 0;
            const numOrig = parseFloat(origVal) || 0;

            const isSame = (numVal === numOrig);
            const currentProductEdits = { ...(prev[productId] || {}) };

            if (isSame) {
                delete currentProductEdits[field];
            } else {
                currentProductEdits[field] = numVal;
            }

            if (Object.keys(currentProductEdits).length === 0) {
                const next = { ...prev };
                delete next[productId];
                return next;
            }

            return {
                ...prev,
                [productId]: currentProductEdits
            };
        });
    };

    const handleUndoRow = (productId) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    };

    const handleSave = async () => {
        if (Object.keys(edits).length === 0) return;

        const updates = Object.keys(edits).map(productId => {
            const original = pricingData.find(p => p.ProductID === productId);
            const changes = edits[productId];

            return {
                ProductID: productId,
                RetailPrice: changes.RetailPrice ?? original.RetailPrice,
                WholesalePrice: changes.WholesalePrice ?? original.WholesalePrice,
                AgentPrice: changes.AgentPrice ?? original.AgentPrice,
                CostPrice: changes.CostPrice ?? original.CostPrice,
                FakeCostPrice: changes.FakeCostPrice ?? original.FakeCostPrice,
                StockistPrice: changes.StockistPrice ?? original.StockistPrice,
            };
        });

        try {
            await updatePricing.mutateAsync(updates);
            setEdits({});
            setStatusMsg({ type: 'success', text: t('pricingSetup.success') });
            setTimeout(() => setStatusMsg(null), 3000);
        } catch (error) {
            console.error(error);
            setStatusMsg({ type: 'error', text: t('pricingSetup.errorSave') });
            setTimeout(() => setStatusMsg(null), 3000);
        }
    };

    const filteredData = useMemo(() => {
        if (!pricingData) return [];
        const query = searchQuery.toLowerCase();

        const prepared = pricingData.map(item => ({
            ...item,
            _name: [item.Brand, item.ProductName, item.Variation, item.Size].filter(Boolean).join(' '),
            _lowerName: [item.Brand, item.ProductName, item.Variation, item.Size].filter(Boolean).join(' ').toLowerCase()
        }));

        const filtered = prepared.filter(item => {
            return (
                item._lowerName.includes(query) ||
                (item.SellerSKU && item.SellerSKU.toLowerCase().includes(query)) ||
                (item.Barcode && item.Barcode.toLowerCase().includes(query)) ||
                (item.GTIN && item.GTIN.toLowerCase().includes(query))
            );
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'name-asc') {
                return a._name.localeCompare(b._name);
            } else if (sortBy === 'name-desc') {
                return b._name.localeCompare(a._name);
            } else if (sortBy === 'brand') {
                const brandCompare = (a.Brand || '').localeCompare(b.Brand || '');
                if (brandCompare !== 0) return brandCompare;
                return a._name.localeCompare(b._name);
            }
            return 0;
        });
    }, [pricingData, searchQuery, sortBy]);

    const hasChanges = Object.keys(edits).length > 0;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-9 w-72 bg-gray-100 rounded-md animate-pulse" />
                    <div className="h-9 w-28 bg-gray-100 rounded-md animate-pulse" />
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3 animate-pulse">
                    <div className="h-8 bg-gray-100 rounded w-full" />
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 bg-gray-50 rounded w-full flex items-center justify-between px-4">
                            <div className="h-4 bg-gray-200 rounded w-48" />
                            <div className="flex gap-4">
                                <div className="h-8 bg-gray-200 rounded w-24" />
                                <div className="h-8 bg-gray-200 rounded w-24" />
                                <div className="h-8 bg-gray-200 rounded w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return <div className="text-red-500 p-4 bg-red-50 rounded-lg flex items-center gap-2"><AlertCircle /> {t('pricingSetup.errorLoad')}</div>;
    }

    return (
        <div className="space-y-6">
            {statusMsg && (
                <div className={`p-3 rounded-lg flex items-center justify-between text-sm transition-all animate-in fade-in duration-200 ${
                    statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    <div className="flex items-center gap-2 font-medium">
                        {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                        {statusMsg.text}
                    </div>
                    <button onClick={() => setStatusMsg(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search"
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-md">
                        {filteredData.length} products
                    </span>
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
                    <Button
                        variant="outline"
                        onClick={() => setIsColorGuideOpen(true)}
                        className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                        <HelpCircle className="h-4 w-4 text-indigo-600" />
                        Color Guide
                    </Button>
                </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-white shadow-xs overflow-auto max-h-[calc(100vh-250px)]">
                <table className="w-full text-sm text-left relative">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 z-10">
                        <tr>
                            <th 
                                className="px-4 py-3 font-medium whitespace-nowrap min-w-[200px] cursor-pointer select-none hover:bg-gray-100 transition-colors"
                                onClick={handleSortCycle}
                                title="Click to sort"
                            >
                                {t('pricingSetup.productName')}
                            </th>
                            {isHGHMode && <th className="px-4 py-3 font-medium text-right text-red-600">{t('pricingSetup.fakeCost')}</th>}
                            {isHGHMode && <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.realCost')}</th>}
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.stockist')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.wholesale')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.agent')}</th>
                            <th className="px-4 py-3 font-medium text-right">{t('pricingSetup.retail')}</th>
                            <th className="w-10 px-2 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.map((product) => {
                            const currentEdits = edits[product.ProductID] || {};
                            const isEdited = Object.keys(currentEdits).some(key => {
                                const origVal = parseFloat(product[key] ?? 0) || 0;
                                const editVal = parseFloat(currentEdits[key] ?? 0) || 0;
                                return origVal !== editVal;
                            });

                            const dCostPrice = currentEdits.CostPrice ?? product.CostPrice;
                            const dFakeCostPrice = currentEdits.FakeCostPrice ?? product.FakeCostPrice;
                            const dStockistPrice = currentEdits.StockistPrice ?? product.StockistPrice;
                            const dWholesale = currentEdits.WholesalePrice ?? product.WholesalePrice;
                            const dAgent = currentEdits.AgentPrice ?? product.AgentPrice;
                            const dRetail = currentEdits.RetailPrice ?? product.RetailPrice;
                            const formattedName = product._name || [product.Brand, product.ProductName, product.Variation, product.Size].filter(Boolean).join(' ');
                            return (
                                <tr key={product.ProductID} className={isEdited ? 'bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm font-semibold text-white' : 'hover:bg-gray-50 transition-colors'}>
                                    <td className="px-4 py-3">
                                        <div className={`font-semibold ${isEdited ? 'text-white' : 'text-gray-900'}`}>{formattedName}</div>
                                        <div className={`text-xs ${isEdited ? 'text-indigo-100 font-medium' : 'text-gray-500'}`}>{product.Barcode}</div>
                                    </td>

                                    {isHGHMode && (
                                        <td className="px-4 py-3 text-right">
                                            <PriceInput
                                                type="fake-cost"
                                                value={dFakeCostPrice}
                                                onChange={(val) => handlePriceChange(product.ProductID, 'FakeCostPrice', val)}
                                            />
                                        </td>
                                    )}
                                    {isHGHMode && (
                                        <td className="px-4 py-3 text-right">
                                            <PriceInput
                                                type="cost"
                                                value={dCostPrice}
                                                sellingPrices={[dStockistPrice, dWholesale, dAgent, dRetail]}
                                                onChange={(val) => handlePriceChange(product.ProductID, 'CostPrice', val)}
                                            />
                                        </td>
                                    )}

                                    <td className="px-4 py-3 text-right">
                                        <PriceInput
                                            type="selling"
                                            costPrice={dCostPrice}
                                            value={dStockistPrice}
                                            onChange={(val) => handlePriceChange(product.ProductID, 'StockistPrice', val)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput
                                            type="selling"
                                            costPrice={dCostPrice}
                                            value={dWholesale}
                                            onChange={(val) => handlePriceChange(product.ProductID, 'WholesalePrice', val)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput
                                            type="selling"
                                            costPrice={dCostPrice}
                                            value={dAgent}
                                            onChange={(val) => handlePriceChange(product.ProductID, 'AgentPrice', val)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <PriceInput
                                            type="selling"
                                            costPrice={dCostPrice}
                                            value={dRetail}
                                            onChange={(val) => handlePriceChange(product.ProductID, 'RetailPrice', val)}
                                        />
                                    </td>
                                    <td className="px-2 py-3 text-center">
                                        {isEdited && (
                                            <button
                                                onClick={() => handleUndoRow(product.ProductID)}
                                                title="Revert"
                                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <Undo2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={isHGHMode ? 8 : 6} className="px-4 py-8 text-center text-gray-500">
                                    {t('pricingSetup.noProducts')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-none shadow-2xl w-[95vw] max-w-7xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Review Price Changes</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Please review all pending modifications below before saving to the database.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5"><X className="h-6 w-6" /></button>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-base text-left">
                                <thead className="bg-gray-100/80 text-gray-700 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="px-6 py-3.5 font-semibold">Product</th>
                                        <th className="px-6 py-3.5 font-semibold w-48">Field</th>
                                        <th className="px-6 py-3.5 font-semibold text-right w-44">Old Price</th>
                                        <th className="px-6 py-3.5 font-semibold text-right w-44">New Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(edits).map(([productId, changes]) => {
                                        const product = pricingData?.find(p => p.ProductID === productId);
                                        if (!product) return null;
                                        const formattedName = [product.Brand, product.ProductName, product.Variation, product.Size].filter(Boolean).join(' ');

                                        return Object.entries(changes).map(([field, newValue]) => {
                                            const oldValue = product[field] || 0;
                                            let displayField = field;
                                            if (field === 'RetailPrice') displayField = 'Retail Price';
                                            else if (field === 'WholesalePrice') displayField = 'Wholesale';
                                            else if (field === 'AgentPrice') displayField = 'Agent';
                                            else if (field === 'CostPrice') displayField = 'Real Cost';
                                            else if (field === 'FakeCostPrice') displayField = 'Fake Cost';
                                            else if (field === 'StockistPrice') displayField = 'Stockist';

                                            return (
                                                <tr key={`${productId}-${field}`} className="hover:bg-indigo-50/40 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-gray-900 text-base">{formattedName}</div>
                                                        <div className="text-sm text-gray-500 mt-0.5">{product.Barcode}</div>
                                                    </td>
                                    <td className="px-6 py-4 text-gray-700 font-medium text-base">{displayField}</td>
                                                    <td className="px-6 py-4 text-right text-gray-400 font-medium text-base line-through">RM {Number(oldValue).toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600 text-base bg-indigo-50/20">RM {Number(newValue).toFixed(2)}</td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-none font-medium">Cancel</Button>
                            <Button
                                onClick={() => {
                                    handleSave();
                                    setIsModalOpen(false);
                                }}
                                disabled={updatePricing.isPending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded-none font-semibold shadow-sm"
                            >
                                {updatePricing.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ColorGuideModal
                isOpen={isColorGuideOpen}
                onClose={() => setIsColorGuideOpen(false)}
                isHGHMode={isHGHMode}
            />
        </div>
    );
}
