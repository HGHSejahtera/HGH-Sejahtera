import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useBrands } from '@/hooks/useBrands';
import { useCategories } from '@/hooks/useCategories';
import { useBulkUpdatePricing } from '@/hooks/usePricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { ImageDropzone } from '@/components/ui/image-dropzone';
import { X, AlertTriangle, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ProductModal({ isOpen, onClose, product = null }) {
    const { addProduct, updateProduct } = useProducts();
    const { data: brands = [] } = useBrands();
    const { data: categories = [] } = useCategories();
    const updatePricing = useBulkUpdatePricing();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const pricingObj = product?.ProductPricing;
    const pricing = Array.isArray(pricingObj) ? (pricingObj[0] || {}) : (pricingObj || {});
    
    const [hasRRP, setHasRRP] = useState(
        product ? (pricing.BasePrice !== null && pricing.BasePrice !== undefined) : false
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

    const handleGenerateBarcodeClick = () => {
        const code = generateInternalBarcode();
        setFormData(prev => ({
            ...prev,
            Barcode: code,
            SellerSKU: code,
            GTIN: code
        }));
        setFieldErrors({});
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
            <div className="w-full max-w-[1400px] bg-white rounded-xl shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            
                            {/* Column 1: Product Profile */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Product Profile</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2 z-50">
                                            <Label htmlFor="Brand" className="text-gray-700 font-medium flex items-center">Brand</Label>
                                            <CreatableCombobox 
                                                id="Brand" 
                                                options={brands} 
                                                value={formData.Brand} 
                                                onChange={(val) => setFormData(prev => ({ ...prev, Brand: val }))} 
                                                emptyMessage="Tiada brand ditemui."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ProductName" className="text-gray-700 font-medium flex items-center">
                                                Product Name <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5 mb-0.5 shadow-sm shadow-blue-500/50"></span>
                                            </Label>
                                            <Input id="ProductName" name="ProductName" required value={formData.ProductName} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2 z-40">
                                            <Label htmlFor="Category" className="text-gray-700 font-medium flex items-center">Category</Label>
                                            <CreatableCombobox 
                                                id="Category" 
                                                options={categories} 
                                                value={formData.Category} 
                                                onChange={(val) => setFormData(prev => ({ ...prev, Category: val }))} 
                                                emptyMessage="Tiada kategori ditemui."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Variation" className="text-gray-700 font-medium flex items-center">Variation</Label>
                                            <Input id="Variation" name="Variation" value={formData.Variation} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="Size" className="text-gray-700 font-medium flex items-center">Size</Label>
                                            <Input id="Size" name="Size" value={formData.Size} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center">Product Image</Label>
                                            <ImageDropzone 
                                                value={formData.ImageURL} 
                                                onChange={(url) => setFormData(prev => ({ ...prev, ImageURL: url }))} 
                                                className="h-28 aspect-video w-full"
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Column 2: Inventory Tracking */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Inventory Tracking</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="MasterSKU" className="text-gray-700 font-medium flex items-center">Master SKU</Label>
                                            <Input id="MasterSKU" name="MasterSKU" value={formData.MasterSKU} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label htmlFor="Barcode" className={`font-medium flex items-center ${fieldErrors.Barcode ? 'text-red-600' : 'text-gray-700'}`}>
                                                Barcode <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5 mb-0.5 shadow-sm shadow-blue-500/50"></span>
                                            </Label>
                                            <div className="relative">
                                                <Input 
                                                    id="Barcode" 
                                                    name="Barcode" 
                                                    value={formData.Barcode} 
                                                    onChange={(e) => {
                                                        setFieldErrors({});
                                                        handleChange({target: {name: 'Barcode', value: e.target.value.replace(/\D/g, '')}});
                                                    }} 
                                                    maxLength="13" 
                                                    className={`pr-12 ${fieldErrors.Barcode ? 'border-red-500 focus-visible:ring-red-500 bg-red-50' : 'bg-gray-50/50 focus:bg-white'}`} 
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handleGenerateBarcodeClick}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Auto-generate Barcode"
                                                >
                                                    <Wand2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {fieldErrors.Barcode && (
                                                <p className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1.5">
                                                    <AlertTriangle className="h-3 w-3" /> {fieldErrors.Barcode}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center">Seller SKU</Label>
                                            <Input readOnly disabled value={formData.SellerSKU} placeholder="Auto-Generate" className="bg-gray-100 text-gray-500 cursor-not-allowed font-mono" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center">GTIN</Label>
                                            <Input readOnly disabled value={formData.GTIN} placeholder="Auto-Generate" className="bg-gray-100 text-gray-500 cursor-not-allowed font-mono" />
                                        </div>

                                        <div className="space-y-2 pt-2">
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
                                    </div>
                                </section>
                            </div>

                            {/* Column 3: Price */}
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Price</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="CostPrice" className="text-gray-700 font-medium flex items-center">
                                                Cost Price <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5 mb-0.5 shadow-sm shadow-blue-500/50"></span>
                                            </Label>
                                            <Input id="CostPrice" name="CostPrice" type="number" step="0.01" required value={formData.CostPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-gray-700 font-medium">Recommended Retail Price</Label>
                                                <Switch checked={hasRRP} onCheckedChange={(checked) => setHasRRP(checked)} />
                                            </div>
                                            {hasRRP && (
                                                <div className="animate-in slide-in-from-top-2 duration-200">
                                                    <Input id="BasePrice" name="BasePrice" type="number" step="0.01" required={hasRRP} value={formData.BasePrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="RetailRule" className="text-gray-700 font-medium flex items-center">Retail Price</Label>
                                            <Input id="RetailRule" name="RetailRule" type="number" step="0.01" value={formData.RetailRule} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="WholesaleRule" className="text-gray-700 font-medium flex items-center">Wholesale Price</Label>
                                            <Input id="WholesaleRule" name="WholesaleRule" type="number" step="0.01" value={formData.WholesaleRule} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="AgentMarkup" className="text-gray-700 font-medium flex items-center">Agent Price</Label>
                                            <Input id="AgentMarkup" name="AgentMarkup" type="number" step="0.01" value={formData.AgentMarkup} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
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
