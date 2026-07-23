import { useState, useEffect, useMemo } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { GenerateMasterSKU } from '@/utils/MasterSKUGenerator';
import { useBrands } from '@/hooks/useBrands';
import { useCategories } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { ImageDropzone } from '@/components/ui/image-dropzone';
import { X, AlertTriangle, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { useBulkUpdatePricing } from '@/hooks/usePricing';

const formatPlatformData = (PlatformData) => {
    if (!PlatformData || Object.keys(PlatformData).length === 0) return '';

    try {
        return JSON.stringify(PlatformData, null, 2);
    } catch {
        return '';
    }
};

const KNOWN_ACRONYMS = new Set(['UV', 'SPF', 'PA', 'BB', 'CC', 'AHA', 'BHA', 'PHA', 'PH']);

const formatTitleCase = (str) => {
    if (!str) return '';
    return str.split(/\s+/).map(word => {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '').toUpperCase();
        if (KNOWN_ACRONYMS.has(cleanWord)) {
            return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
};

const formatSizeStr = (str) => {
    if (!str) return '';
    return str.toUpperCase().replace(/(\d+)\s*([A-Z]+)/g, '$1 $2').trim();
};

export function ProductModal({ isOpen, onClose, product = null, prefilledName = '', onSuccess = null }) {
    const { t } = useTranslation();
    const { data: allProducts = [], addProduct, updateProduct } = useProducts();
    const { data: brands = [] } = useBrands();
    const { data: categories = [] } = useCategories();
    const updatePricing = useBulkUpdatePricing();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    const [formData, setFormData] = useState({
        ImageURL: product?.ImageURL || '',
        MasterSKU: product?.MasterSKU || '',
        ProductName: product?.ProductName || prefilledName || '',
        Brand: product?.Brand || '',
        Category: product?.Category || '',
        Variation: product?.Variation || '',
        Size: product?.Size || '',
        Barcode: product?.Barcode || '',
        SellerSKU: product?.SellerSKU || '',
        GTIN: product?.GTIN || '',
        CostPrice: product?.CostPrice || '',
        FakeCostPrice: product?.FakeCostPrice || '',
        StockistPrice: product?.StockistPrice || '',
        Stock: product?.Stock || 0,
        WeightG: product?.WeightG || '',
        LengthCM: product?.LengthCM || '',
        WidthCM: product?.WidthCM || '',
        HeightCM: product?.HeightCM || '',
        PlatformData: formatPlatformData(product?.PlatformData),
        RetailPrice: product?.RetailPrice ?? '',
        WholesalePrice: product?.WholesalePrice ?? '',
        AgentPrice: product?.AgentPrice ?? '',
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                ImageURL: product?.ImageURL || '',
                MasterSKU: product?.MasterSKU || '',
                ProductName: product?.ProductName || prefilledName || '',
                Brand: product?.Brand || '',
                Category: product?.Category || '',
                Variation: product?.Variation || '',
                Size: product?.Size || '',
                Barcode: product?.Barcode || '',
                SellerSKU: product?.SellerSKU || '',
                GTIN: product?.GTIN || '',
                CostPrice: product?.CostPrice || '',
                FakeCostPrice: product?.FakeCostPrice || '',
                StockistPrice: product?.StockistPrice || '',
                Stock: product?.Stock || 0,
                WeightG: product?.WeightG || '',
                LengthCM: product?.LengthCM || '',
                WidthCM: product?.WidthCM || '',
                HeightCM: product?.HeightCM || '',
                PlatformData: formatPlatformData(product?.PlatformData),
                RetailPrice: product?.RetailPrice ?? '',
                WholesalePrice: product?.WholesalePrice ?? '',
                AgentPrice: product?.AgentPrice ?? '',
            });
            setErrorMsg('');
            setFieldErrors({});
        }
    }, [isOpen, product, prefilledName]);

    const potentialDuplicate = useMemo(() => {
        if (product || !formData.ProductName) return null;
        const cleanTarget = `${formData.Brand || ''} ${formData.ProductName || ''} ${formData.Variation || ''} ${formData.Size || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanTarget.length < 4) return null;

        return allProducts.find(p => {
            const cleanExisting = `${p.Brand || ''} ${p.ProductName || ''} ${p.Variation || ''} ${p.Size || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanExisting === cleanTarget || (cleanTarget.length > 10 && cleanExisting.includes(cleanTarget));
        });
    }, [product, formData.Brand, formData.ProductName, formData.Variation, formData.Size, allProducts]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'Barcode') {
            setFormData(prev => ({
                ...prev,
                Barcode: value,
                SellerSKU: value,
                GTIN: value
            }));
        } else if (name === 'ProductName' || name === 'Variation') {
            setFormData(prev => ({ ...prev, [name]: formatTitleCase(value) }));
        } else if (name === 'Size') {
            setFormData(prev => ({ ...prev, Size: formatSizeStr(value) }));
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

    const handleGenerateMasterSKU = () => {
        const existingSkus = allProducts.map(p => p.MasterSKU).filter(Boolean);
        const result = GenerateMasterSKU(formData, existingSkus);
        
        if (result.status === 'error') {
            setErrorMsg(result.message);
            return;
        }

        setFormData(prev => ({
            ...prev,
            MasterSKU: result.master_sku
        }));
        setErrorMsg('');
        
        if (result.conflict_detected) {
            setErrorMsg(`Master SKU generated with numeric suffix (${result.master_sku}) due to a clash with an existing SKU.`);
        }
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
                if (!/^\d{8,50}$/.test(finalBarcode)) {
                    setFieldErrors({ Barcode: 'Barcode must be between 8 to 50 digits (e.g. UPC, EAN, or GTIN).' });
                    setIsLoading(false);
                    return;
                }
            }

            const WeightG = formData.WeightG === '' ? null : parseInt(formData.WeightG, 10);
            const LengthCM = formData.LengthCM === '' ? null : parseFloat(formData.LengthCM);
            const WidthCM = formData.WidthCM === '' ? null : parseFloat(formData.WidthCM);
            const HeightCM = formData.HeightCM === '' ? null : parseFloat(formData.HeightCM);

            let finalCategory = formData.Category || null;
            let finalCategoryName = null;
            let finalCategoryID = null;
            
            if (finalCategory) {
                const match = finalCategory.match(/^(.*)\s\((\d{6,})\)$/);
                if (match) {
                    finalCategoryName = match[1].trim();
                    finalCategoryID = match[2];
                } else {
                    finalCategoryName = finalCategory;
                }
            }

            const productData = {
                ImageURL: formData.ImageURL || null,
                MasterSKU: formData.MasterSKU || null,
                ProductName: formData.ProductName,
                Brand: formData.Brand || null,
                Category: finalCategory,
                CategoryName: finalCategoryName,
                CategoryID: finalCategoryID,
                Variation: formData.Variation || null,
                Size: formData.Size || null,
                Barcode: finalBarcode,
                SellerSKU: finalBarcode || null,
                GTIN: finalBarcode || null,
                CostPrice: parseFloat(formData.CostPrice) || 0,
                FakeCostPrice: parseFloat(formData.FakeCostPrice) || 0,
                StockistPrice: parseFloat(formData.StockistPrice) || 0,
                RetailPrice: parseFloat(formData.RetailPrice) || 0,
                WholesalePrice: parseFloat(formData.WholesalePrice) || 0,
                AgentPrice: parseFloat(formData.AgentPrice) || 0,
                WeightG: Number.isFinite(WeightG) ? WeightG : null,
                LengthCM: Number.isFinite(LengthCM) ? LengthCM : null,
                WidthCM: Number.isFinite(WidthCM) ? WidthCM : null,
                HeightCM: Number.isFinite(HeightCM) ? HeightCM : null,
                IsActive: true
            };

            let savedProductId = null;

            if (product) {
                await updateProduct.mutateAsync({ id: product.ProductID, updates: productData });
                savedProductId = product.ProductID;
            } else {
                const newProd = await addProduct.mutateAsync(productData);
                savedProductId = newProd.ProductID;

                const initialStock = parseInt(formData.Stock, 10) || 0;
                if (initialStock > 0) {
                    await supabase.rpc('stock_in_product', {
                        product_id_input: savedProductId,
                        quantity_input: initialStock,
                        reference_input: 'Initial Stock (System)'
                    });
                }
            }

            if (onSuccess && typeof onSuccess === 'function') {
                await onSuccess(savedProductId, productData);
            }

            onClose();
        } catch (error) {
            console.error('Failed to save product:', error);
            if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
                setFieldErrors({ Barcode: 'This barcode is already registered to another product.' });
            } else if (error.code === '22001' || error.message?.includes('too long for type')) {
                setErrorMsg('One of the fields is too long. Please shorten and try again.');
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
            <div className="w-full max-w-[1400px] bg-white rounded-none shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-10 py-6 border-b border-gray-100 shrink-0">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {product ? 'Edit Product Profile' : 'Add New Product'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-10">
                    {prefilledName && !product && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 flex items-start gap-3">
                            <div className="text-sm text-indigo-900 flex-1">
                                <span className="font-bold">Creating Product for Unmatched Item:</span><br />
                                E-commerce Platform Item: <span className="font-semibold italic">"{prefilledName}"</span><br />
                                <span className="text-xs text-indigo-700 mt-1 block">Please enter the Brand, Product Name, Variation, Size, and Barcode (Seller SKU). Once saved, all orders with this unmatched item will be automatically mapped and resolved!</span>
                            </div>
                        </div>
                    )}
                    {potentialDuplicate && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-900 flex-1">
                                <span className="font-bold">Potential Duplicate Detected:</span> A similar product already exists in inventory — <span className="font-semibold">"{`${potentialDuplicate.Brand || ''} ${potentialDuplicate.ProductName} ${potentialDuplicate.Variation || ''} ${potentialDuplicate.Size || ''}`.trim()}"</span> (Barcode: <span className="font-mono font-semibold">{potentialDuplicate.Barcode || potentialDuplicate.SellerSKU || '-'}</span>). Ensure you aren't creating a duplicate product.
                            </div>
                        </div>
                    )}
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
                                                onChange={(val) => setFormData(prev => ({ ...prev, Brand: val ? val.toUpperCase() : val }))}
                                                placeholder={t('productModal.selectBrand')}
                                                emptyMessage={t('productModal.noBrandFound')}
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
                                                placeholder={t('productModal.category')}
                                                emptyMessage={t('productModal.noCategoryFound')}
                                                formatDisplay={(val) => val ? val.replace(/\s\(\d+\)$/, '') : val}
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
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Inventory Tracking</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="MasterSKU" className="text-gray-700 font-medium flex items-center">Master SKU</Label>
                                            <div className="relative">
                                                <Input 
                                                    id="MasterSKU" 
                                                    name="MasterSKU" 
                                                    value={formData.MasterSKU} 
                                                    onChange={handleChange} 
                                                    className="bg-gray-50/50 focus:bg-white pr-10" 
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateMasterSKU}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                    title="Auto-generate Master SKU"
                                                >
                                                    <Wand2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
                                                        handleChange({ target: { name: 'Barcode', value: e.target.value.replace(/\D/g, '') } });
                                                    }}
                                                    maxLength="50"
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
                                                className={product ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50/50 focus:bg-white'}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Logistics & Platform</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="WeightG" className="text-gray-700 font-medium flex items-center">Weight</Label>
                                            <Input id="WeightG" name="WeightG" type="number" min="0" value={formData.WeightG} onChange={handleChange} className="bg-gray-50/50 focus:bg-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center">Dimensions</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Input id="LengthCM" name="LengthCM" type="number" min="0" step="0.01" value={formData.LengthCM} onChange={handleChange} placeholder="Length" className="bg-gray-50/50 focus:bg-white" />
                                                <Input id="WidthCM" name="WidthCM" type="number" min="0" step="0.01" value={formData.WidthCM} onChange={handleChange} placeholder="Width" className="bg-gray-50/50 focus:bg-white" />
                                                <Input id="HeightCM" name="HeightCM" type="number" min="0" step="0.01" value={formData.HeightCM} onChange={handleChange} placeholder="Height" className="bg-gray-50/50 focus:bg-white" />
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5 border-b border-gray-100 pb-2">Price</h3>
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="CostPrice" className="text-gray-700 font-medium flex items-center">
                                                Cost Price <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5 mb-0.5 shadow-sm shadow-blue-500/50" title="Actual Cost"></span>
                                            </Label>
                                            <Input id="CostPrice" name="CostPrice" type="number" step="0.01" required value={formData.CostPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="FakeCostPrice" className="text-gray-700 font-medium flex items-center">
                                                Cost Price <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300 ml-1.5 mb-0.5 shadow-sm" title="Display Cost"></span>
                                            </Label>
                                            <Input id="FakeCostPrice" name="FakeCostPrice" type="number" step="0.01" value={formData.FakeCostPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="StockistPrice" className="text-gray-700 font-medium flex items-center">
                                                Stockist Price
                                            </Label>
                                            <Input id="StockistPrice" name="StockistPrice" type="number" step="0.01" value={formData.StockistPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>



                                        <div className="space-y-2">
                                            <Label htmlFor="RetailPrice" className="text-gray-700 font-medium flex items-center">Retail Price</Label>
                                            <Input id="RetailPrice" name="RetailPrice" type="number" step="0.01" value={formData.RetailPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="WholesalePrice" className="text-gray-700 font-medium flex items-center">Wholesale Price</Label>
                                            <Input id="WholesalePrice" name="WholesalePrice" type="number" step="0.01" value={formData.WholesalePrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="AgentPrice" className="text-gray-700 font-medium flex items-center">Agent Price</Label>
                                            <Input id="AgentPrice" name="AgentPrice" type="number" step="0.01" value={formData.AgentPrice} onChange={handleChange} onBlur={handlePriceBlur} className="bg-gray-50/50 focus:bg-white" />
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

