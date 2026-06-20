import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useBulkUpdatePricing } from '@/hooks/usePricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ProductModal({ isOpen, onClose, product = null }) {
    const { addProduct, updateProduct } = useProducts();
    const updatePricing = useBulkUpdatePricing();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const pricingObj = product?.ProductPricing;
    const pricing = Array.isArray(pricingObj) ? (pricingObj[0] || {}) : (pricingObj || {});
    
    const [hasRRP, setHasRRP] = useState(
        product ? (pricing.BasePrice !== null && pricing.BasePrice !== undefined) : true
    );
    
    const [formData, setFormData] = useState({
        ImageURL: product?.ImageURL || '',
        MasterSKU: product?.MasterSKU || '',
        ProductName: product?.ProductName || '',
        Brand: product?.Brand || '',
        Category: product?.Category || '',
        Variation: product?.Variation || '',
        Size: product?.Size || '',
        Barcode: product?.Barcode || '',
        SellerSKU: product?.SellerSKU || '',
        GTIN: product?.GTIN || '',
        CostPrice: product?.CostPrice || '',
        Stock: product?.Stock || 0,
        PricingModel: pricing.PricingModel || 'HQ_DISCOUNT',
        BasePrice: pricing.BasePrice ?? product?.Price ?? '',
        RetailRule: pricing.RetailRule ?? '',
        WholesaleRule: pricing.WholesaleRule ?? '',
        AgentMarkup: pricing.AgentMarkup ?? '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'Barcode') {
            setFormData(prev => ({ 
                ...prev, 
                Barcode: value,
                SellerSKU: value,
                GTIN: value
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handlePriceBlur = (e) => {
        const { name, value } = e.target;
        if (value !== '' && !isNaN(parseFloat(value))) {
            setFormData(prev => ({ ...prev, [name]: parseFloat(value).toFixed(2) }));
        }
    };

    const calculateCheckDigit = (barcodeWithoutCheckDigit) => {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(barcodeWithoutCheckDigit[i], 10);
            sum += i % 2 === 0 ? digit : digit * 3;
        }
        const nearestMultipleOf10 = Math.ceil(sum / 10) * 10;
        return (nearestMultipleOf10 - sum).toString();
    };

    const generateInternalBarcode = () => {
        const prefix = '200';
        const randomDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
        const barcodeBase = prefix + randomDigits;
        const checkDigit = calculateCheckDigit(barcodeBase);
        return barcodeBase + checkDigit;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        setFieldErrors({});

        try {
            let finalBarcode = formData.Barcode;
            if (!finalBarcode || finalBarcode.trim() === '') {
                finalBarcode = generateInternalBarcode();
            } else {
                // Strict validation for EAN-13
                if (!/^\d{13}$/.test(finalBarcode)) {
                    setFieldErrors({ Barcode: 'Barcode (EAN-13) must be exactly 13 digits.' });
                    setIsLoading(false);
                    return;
                }
            }

            const productData = {
                ImageURL: formData.ImageURL || null,
                MasterSKU: formData.MasterSKU || null,
                ProductName: formData.ProductName,
                Brand: formData.Brand || null,
                Category: formData.Category || null,
                Variation: formData.Variation || null,
                Size: formData.Size || null,
                Barcode: finalBarcode,
                SellerSKU: finalBarcode || null,
                GTIN: finalBarcode || null,
                CostPrice: parseFloat(formData.CostPrice) || 0,
                IsActive: true
            };

            let savedProductId = null;

            if (product) {
                await updateProduct.mutateAsync({ id: product.ProductID, updates: productData });
                savedProductId = product.ProductID;
            } else {
                const newProd = await addProduct.mutateAsync(productData);
                savedProductId = newProd.ProductID;
                
                // If there's initial stock, log it properly using the RPC
                const initialStock = parseInt(formData.Stock) || 0;
                if (initialStock > 0) {
                    await supabase.rpc('stock_in_product', {
                        product_id_input: savedProductId,
                        quantity_input: initialStock,
                        reference_input: 'Initial Stock (System)'
                    });
                }
            }

            // Save Pricing
            if (savedProductId) {
                const pricingData = {
                    ProductID: savedProductId,
                    PricingModel: formData.PricingModel,
                    BasePrice: hasRRP ? (parseFloat(formData.BasePrice) || 0) : null,
                    RetailRule: parseFloat(formData.RetailRule) || 0,
                    WholesaleRule: parseFloat(formData.WholesaleRule) || 0,
                    AgentMarkup: parseFloat(formData.AgentMarkup) || 0,
                };
                await updatePricing.mutateAsync([pricingData]);
            }

            onClose();
        } catch (error) {
            console.error('Failed to save product:', error);
            // Catch PostgreSQL unique constraint violation (code 23505) or error string
            if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
                setFieldErrors({ Barcode: 'This barcode is already registered to another product.' });
            } else {
                setErrorMsg(error.message || 'Failed to save product.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 lg:p-10 animate-in fade-in duration-200">
            <div className="w-full max-w-7xl bg-white rounded-xl shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-10 py-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {product ? 'Edit Product Profile' : 'Add New Product'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-10">
                    <form id="product-form" onSubmit={handleSubmit} className="space-y-10">
                        {errorMsg && (
                            <div className="bg-amber-50 text-amber-800 p-4 rounded-lg text-sm border border-amber-200 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-amber-900">Oops, action needed</h4>
                                    <p className="mt-1 text-amber-700 leading-relaxed">{errorMsg}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            
                            {/* Left Column: Profile & Identifiers */}
                            <div className="space-y-10">
                                
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Product Profile</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="ProductName" className="text-gray-700 font-medium">Product Name <span className="text-red-500">*</span></Label>
                                            <Input id="ProductName" name="ProductName" required value={formData.ProductName} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Brand" className="text-gray-700 font-medium">Brand</Label>
                                            <Input id="Brand" name="Brand" value={formData.Brand} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Category" className="text-gray-700 font-medium">Category</Label>
                                            <Input id="Category" name="Category" value={formData.Category} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Variation" className="text-gray-700 font-medium">Variation</Label>
                                            <Input id="Variation" name="Variation" value={formData.Variation} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" placeholder="e.g. Lavender" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Size" className="text-gray-700 font-medium">Size</Label>
                                            <Input id="Size" name="Size" value={formData.Size} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" placeholder="e.g. 100 ml" />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="ImageURL" className="text-gray-700 font-medium">Image URL</Label>
                                            <Input id="ImageURL" name="ImageURL" value={formData.ImageURL} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Identifiers</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="MasterSKU" className="text-gray-700 font-medium">Master SKU</Label>
                                            <Input id="MasterSKU" name="MasterSKU" value={formData.MasterSKU} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Barcode" className={`font-medium ${fieldErrors.Barcode ? 'text-red-600' : 'text-gray-700'}`}>Barcode</Label>
                                            <Input 
                                                id="Barcode" 
                                                name="Barcode" 
                                                value={formData.Barcode} 
                                                onChange={(e) => {
                                                    setFieldErrors({}); // Clear error when typing
                                                    handleChange({target: {name: 'Barcode', value: e.target.value.replace(/\D/g, '')}});
                                                }} 
                                                maxLength="13" 
                                                className={fieldErrors.Barcode ? 'border-red-500 focus-visible:ring-red-500 bg-red-50' : 'bg-gray-50/50 focus:bg-white'} 
                                            />
                                            {fieldErrors.Barcode && (
                                                <p className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1">
                                                    <AlertTriangle className="h-3 w-3" /> {fieldErrors.Barcode}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Seller SKU</Label>
                                            <div className="text-sm font-mono text-gray-600 bg-gray-50 px-3 py-2.5 rounded-lg border border-dashed border-gray-200 truncate">{formData.SellerSKU || '-'}</div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-gray-400 font-bold uppercase tracking-wide">GTIN</Label>
                                            <div className="text-sm font-mono text-gray-600 bg-gray-50 px-3 py-2.5 rounded-lg border border-dashed border-gray-200 truncate">{formData.GTIN || '-'}</div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Inventory & Pricing */}
                            <div className="space-y-10">
                                
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Initial Setup</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="Stock" className="text-gray-700 font-medium">
                                                {product ? 'Current Stock' : 'Initial Stock'}
                                            </Label>
                                            <Input 
                                                id="Stock" 
                                                name="Stock" 
                                                type="number" 
                                                min="0" 
                                                value={formData.Stock} 
                                                onChange={handleChange} 
                                                disabled={!!product}
                                                className={product ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-gray-50/50 focus:bg-white"} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="CostPrice" className="text-gray-700 font-medium">Cost Price (RM) <span className="text-red-500">*</span></Label>
                                            <Input id="CostPrice" name="CostPrice" type="number" step="0.01" required value={formData.CostPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-3 col-span-2">
                                            <div className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-lg">
                                                <div className="flex items-center group relative">
                                                    <Label className="text-gray-700 font-medium cursor-help flex items-center mb-0">
                                                        Set Recommended Retail Price (RRP)
                                                    </Label>
                                                    <div className="absolute left-0 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                                                        Toggle to enable HQ recommended price
                                                    </div>
                                                </div>
                                                <Switch checked={hasRRP} onCheckedChange={(checked) => setHasRRP(checked)} />
                                            </div>
                                            
                                            {hasRRP && (
                                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                    <Label htmlFor="BasePrice" className="text-gray-700 font-medium">RRP (RM) <span className="text-red-500">*</span></Label>
                                                    <Input id="BasePrice" name="BasePrice" type="number" step="0.01" required={hasRRP} value={formData.BasePrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Pricing Configuration</h3>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-gray-700 font-medium">Retail Price</Label>
                                                <Input name="RetailRule" type="number" step="0.01" value={formData.RetailRule} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-gray-700 font-medium">Wholesale Price</Label>
                                                <Input name="WholesaleRule" type="number" step="0.01" value={formData.WholesaleRule} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium">Agent Price</Label>
                                            <Input name="AgentMarkup" type="number" step="0.01" value={formData.AgentMarkup} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                    </div>
                                </section>

                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 px-10 py-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading} className="text-gray-600 hover:bg-gray-200 hover:text-gray-900 font-medium rounded-lg px-6">
                        Cancel
                    </Button>
                    <Button form="product-form" type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[150px] transition-colors rounded-lg font-semibold border-0 shadow-sm">
                        {isLoading ? 'Saving...' : 'Save Product'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
