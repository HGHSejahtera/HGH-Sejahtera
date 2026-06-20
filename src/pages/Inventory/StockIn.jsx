import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Barcode, CheckCircle, Package, PackagePlus, ScanLine, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useInventoryLogs, useInventoryProducts, useStockInMutation } from '@/hooks/useInventory';

const normalizeValue = (Value) => String(Value || '').trim().toLowerCase();

const productMatchesSearch = (Product, SearchTerm) => {
    const Term = normalizeValue(SearchTerm);

    if (!Term) return true;

    return [
        Product.ProductName,
        Product.Variation,
        Product.MasterSKU,
        Product.Barcode,
        Product.SellerSKU,
    ].some(Value => normalizeValue(Value).includes(Term));
};

const findScannedProduct = (Products, ScannedValue) => {
    const NormalizedScan = normalizeValue(ScannedValue);

    return Products.find(Product => [
        Product.Barcode,
        Product.MasterSKU,
        Product.SellerSKU,
    ].some(Value => normalizeValue(Value) === NormalizedScan));
};

export function StockIn() {
    const [SearchParams] = useSearchParams();
    const PreselectedProductID = SearchParams.get('productId') || '';
    const { data: Products, isLoading, error } = useInventoryProducts();
    const StockInMutation = useStockInMutation();

    const [SearchTerm, setSearchTerm] = useState('');
    const [SelectedProductID, setSelectedProductID] = useState(PreselectedProductID);
    const [Quantity, setQuantity] = useState('1');
    const [Reference, setReference] = useState('');
    const [StatusMessage, setStatusMessage] = useState('');
    const [ErrorMessage, setErrorMessage] = useState('');

    const InventoryProducts = useMemo(() => Products || [], [Products]);
    const ActiveProductID = SelectedProductID || PreselectedProductID;

    const SelectedProduct = useMemo(() => (
        InventoryProducts.find(Product => Product.ProductID === ActiveProductID) || null
    ), [InventoryProducts, ActiveProductID]);

    const FilteredProducts = useMemo(() => (
        InventoryProducts
            .filter(Product => productMatchesSearch(Product, SearchTerm))
            .slice(0, 8)
    ), [InventoryProducts, SearchTerm]);

    const ProductLogs = useInventoryLogs(ActiveProductID || null);

    const handleSelectProduct = (Product) => {
        setSelectedProductID(Product.ProductID);
        setSearchTerm(Product.MasterSKU || Product.Barcode || Product.ProductName);
        setStatusMessage('');
        setErrorMessage('');
    };

    const handleScannerScan = useCallback((ScannedValue) => {
        const MatchedProduct = findScannedProduct(InventoryProducts, ScannedValue);

        if (!MatchedProduct) {
            setStatusMessage('');
            setErrorMessage(`Barcode/SKU "${ScannedValue}" tak jumpa dalam Products.`);
            return;
        }

        setSelectedProductID(MatchedProduct.ProductID);
        setSearchTerm(MatchedProduct.MasterSKU || MatchedProduct.Barcode || MatchedProduct.ProductName);
        setErrorMessage('');
        setStatusMessage(`Scanned: ${MatchedProduct.ProductName}`);
    }, [InventoryProducts]);

    useHardwareScanner(handleScannerScan);

    const handleSubmit = async (Event) => {
        Event.preventDefault();
        setStatusMessage('');
        setErrorMessage('');

        if (!SelectedProduct) {
            setErrorMessage('Pilih product dulu sebelum submit stock-in.');
            return;
        }

        const ParsedQuantity = Number.parseInt(Quantity, 10);

        if (!Number.isFinite(ParsedQuantity) || ParsedQuantity <= 0) {
            setErrorMessage('Quantity mesti lebih daripada 0.');
            return;
        }

        try {
            const CreatedLog = await StockInMutation.mutateAsync({
                ProductID: SelectedProduct.ProductID,
                Quantity: ParsedQuantity,
                Reference: Reference.trim(),
            });

            setQuantity('1');
            setReference('');
            setStatusMessage(`Stock-in berjaya. Stock baru: ${CreatedLog.StockAfter}.`);
        } catch (MutationError) {
            setErrorMessage(MutationError.message || 'Stock-in gagal. Cuba lagi.');
        }
    };

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">
                Inventory products gagal load: {error.message}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                        <Link to="/inventory">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Inventory
                        </Link>
                    </Button>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Stock-In</h2>
                </div>
                <div className="rounded-xl border bg-indigo-50 px-4 py-3 text-sm text-indigo-700 flex items-center gap-2">
                    <ScanLine className="h-4 w-4" />
                    Hardware scanner ready
                </div>
            </div>

            {(StatusMessage || ErrorMessage) && (
                <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                    ErrorMessage ? 'border-red-100 bg-red-50 text-red-700' : 'border-green-100 bg-green-50 text-green-700'
                }`}>
                    {ErrorMessage ? <XCircle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
                    <p className="text-sm font-medium">{ErrorMessage || StatusMessage}</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-6">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="mb-4">
                            <h3 className="font-semibold text-gray-900">Find Product</h3>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                value={SearchTerm}
                                onChange={(Event) => setSearchTerm(Event.target.value)}
                                placeholder="Scan or search product..."
                                className="pl-9"
                            />
                        </div>

                        <div className="mt-4 divide-y rounded-lg border">
                            {isLoading ? (
                                <div className="p-4 text-sm text-gray-500">Loading products...</div>
                            ) : FilteredProducts.length > 0 ? (
                                FilteredProducts.map(Product => (
                                    <button
                                        key={Product.ProductID}
                                        type="button"
                                        onClick={() => handleSelectProduct(Product)}
                                        className={`flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-gray-50 ${
                                            ActiveProductID === Product.ProductID ? 'bg-indigo-50' : 'bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-gray-50">
                                                <Package className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{Product.ProductName}</p>
                                                <p className="text-xs text-gray-500">
                                                    {Product.MasterSKU || '-'} · {Product.Variation || 'No variation'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">{Number(Product.Stock || 0).toLocaleString('ms-MY')}</p>
                                            <p className="text-xs text-gray-500">units</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-sm text-gray-500">
                                    No product found.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="mb-4">
                            <h3 className="font-semibold text-gray-900">Selected Product</h3>
                        </div>

                        {SelectedProduct ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-gray-500">Product</p>
                                    <p className="mt-2 font-semibold text-gray-900">{SelectedProduct.ProductName}</p>
                                    <p className="text-sm text-gray-500">{SelectedProduct.Variation || 'No variation'}</p>
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-gray-500">Current Stock</p>
                                    <p className="mt-2 text-2xl font-bold text-gray-900">
                                        {Number(SelectedProduct.Stock || 0).toLocaleString('ms-MY')}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-gray-500">Master SKU</p>
                                    <p className="mt-2 font-mono text-sm font-semibold text-gray-900">{SelectedProduct.MasterSKU || '-'}</p>
                                </div>
                                <div className="rounded-lg border bg-gray-50 p-4">
                                    <p className="text-xs font-semibold uppercase text-gray-500">Barcode</p>
                                    <p className="mt-2 flex items-center gap-2 font-mono text-sm text-gray-900">
                                        <Barcode className="h-4 w-4 text-gray-400" />
                                        {SelectedProduct.Barcode || '-'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                                Scan atau pilih product dulu.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-900">Receive Stock</h3>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="Quantity">Quantity Received</Label>
                            <Input
                                id="Quantity"
                                type="number"
                                min="1"
                                value={Quantity}
                                onChange={(Event) => setQuantity(Event.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="Reference">Supplier Reference</Label>
                            <Input
                                id="Reference"
                                value={Reference}
                                onChange={(Event) => setReference(Event.target.value)}
                                placeholder="e.g. Supplier Restock PO-102"
                            />
                        </div>

                        {SelectedProduct && (
                            <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
                                After submit: <span className="font-semibold">
                                    {(Number(SelectedProduct.Stock || 0) + (Number.parseInt(Quantity, 10) || 0)).toLocaleString('ms-MY')}
                                </span> units
                            </div>
                        )}

                        <Button type="submit" disabled={!SelectedProduct || StockInMutation.isPending} className="w-full">
                            <PackagePlus className="mr-2 h-4 w-4" />
                            {StockInMutation.isPending ? 'Processing...' : 'Confirm Stock-In'}
                        </Button>
                    </form>

                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="mb-4">
                            <h3 className="font-semibold text-gray-900">Audit History</h3>
                        </div>
                        <div className="space-y-3">
                            {(ProductLogs.data || []).slice(0, 8).map(Log => (
                                <div key={Log.LogID} className="rounded-lg border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">{Log.Type}</Badge>
                                        <span className="text-xs text-gray-500">{new Date(Log.Timestamp).toLocaleString('en-GB', { hour12: true }).toUpperCase()}</span>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-gray-900">
                                        {Log.Products?.ProductName || SelectedProduct?.ProductName || '-'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Quantity {Log.Quantity}: {Log.StockBefore} → {Log.StockAfter}
                                    </p>
                                    <p className="text-xs text-gray-500">{Log.Reference || 'No reference'}</p>
                                </div>
                            ))}
                            {(ProductLogs.data || []).length === 0 && (
                                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
                                    No logs yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
