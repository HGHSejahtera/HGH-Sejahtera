import { useState } from 'react';
import { useProducts } from '@/Hooks/UseProducts';
import { useProductMatcher } from '@/Hooks/UseProductMatcher';
import { Button } from '@/Components/UI/Button';
import { AlertTriangle, CheckCircle, Search, PackagePlus, X } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/Components/UI/Command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/UI/Popover";

export function OrderMatchModal({ isOpen, onClose, order, onOpenCreate }) {
    const { data: products = [] } = useProducts();
    const { resolveBatch, isResolvingBatch } = useProductMatcher();
    const [selectedIds, setSelectedIds] = useState({});

    if (!isOpen || !order) return null;

    const items = order.Items || order.ImportOrderItems || [];
    const unmatchedItems = items.filter(i => !i.ProductID || i.PlatformSKU === '-' || i.MatchStatus === 'Unmatched');

    const handleMatchProduct = async (item, product) => {
        try {
            await resolveBatch({
                itemIds: [item.ItemID].filter(Boolean),
                productId: product.ProductID
            });
            if (order?.ImportOrderID) {
                const resolvedSessionIds = new Set(JSON.parse(localStorage.getItem('HGH_ResolvedStatusOrders') || '[]'));
                resolvedSessionIds.add(order.ImportOrderID);
                localStorage.setItem('HGH_ResolvedStatusOrders', JSON.stringify(Array.from(resolvedSessionIds)));
            }
            setSelectedIds(prev => ({ ...prev, [item.ItemID]: product.ProductID }));
        } catch (error) {
            console.error("Failed to match product:", error);
            alert(error.message || "Failed to match product");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white rounded-none shadow-2xl relative flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-gray-200">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-amber-50/60">
                    <div className="flex items-center space-x-3">
                        <div className="bg-amber-100 p-2 rounded-none border border-amber-300">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-gray-900">
                                SKU Review: Order #{order.OrderID || order.AWBNumber || order.PlatformOrderID || order.ImportOrderID || '-'}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {unmatchedItems.length === 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 p-8 text-center">
                            <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-gray-900">All Items Matched!</h3>
                            <p className="text-xs text-gray-500 mt-1">There are no unmatched items requiring review in this order.</p>
                        </div>
                    ) : (
                        unmatchedItems.map((item, idx) => {
                            const selectedId = selectedIds[item.ItemID] || item.ProductID;
                            const selectedProduct = products.find(p => p.ProductID === selectedId);
                            const displayName = item.Brand ? `${item.Brand} ${item.ProductName} ${item.Variation || ''} ${item.Size || ''}`.trim() : item.ProductName || 'Unnamed Item';

                            return (
                                <div key={item.ItemID || idx} className="border border-gray-200 p-4 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-semibold text-sm text-gray-900 line-clamp-2">{displayName}</p>
                                        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                                            <span>SKU: <strong className="font-mono text-gray-700">{item.PlatformSKU || '-'}</strong></span>
                                            <span>Qty: <strong className="text-gray-900 font-semibold">x{item.Quantity || 1}</strong></span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="w-64">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        disabled={isResolvingBatch}
                                                        className="w-full justify-between font-normal text-xs h-9 bg-white border-gray-300 hover:bg-gray-50 rounded-none cursor-pointer"
                                                    >
                                                        <span className="truncate">
                                                            {selectedProduct
                                                                ? `${selectedProduct.Brand || ''} ${selectedProduct.ProductName} ${selectedProduct.Variation || ''} ${selectedProduct.Size || ''}`.trim()
                                                                : "Match Product"}
                                                        </span>
                                                        <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[320px] p-0 rounded-none shadow-xl border-gray-200" align="end">
                                                    <Command>
                                                        <CommandInput placeholder="Search" className="text-xs" />
                                                        <CommandList>
                                                            <CommandEmpty className="py-6 px-4 text-center text-xs text-gray-500">
                                                                No product found.
                                                            </CommandEmpty>
                                                            <CommandGroup>
                                                                {products.map((product) => (
                                                                    <CommandItem
                                                                        key={product.ProductID}
                                                                        value={`${product.Brand || ''} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''} ${product.Barcode}`.trim()}
                                                                        onSelect={() => handleMatchProduct(item, product)}
                                                                        className="text-xs py-2 cursor-pointer"
                                                                    >
                                                                        <div className="flex flex-col flex-1 truncate pr-2">
                                                                            <span className="font-semibold text-gray-900 truncate">
                                                                                {`${product.Brand || ''} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''}`.trim()}
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                                                Barcode: {product.Barcode || product.SellerSKU || '-'}
                                                                            </span>
                                                                        </div>
                                                                        {selectedId === product.ProductID && (
                                                                            <CheckCircle className="ml-auto h-4 w-4 text-emerald-500 shrink-0" />
                                                                        )}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                onClose();
                                                if (onOpenCreate) onOpenCreate(item);
                                            }}
                                            disabled={isResolvingBatch}
                                            className="h-9 px-3 text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-none shrink-0 cursor-pointer"
                                            title="Create a new inventory product and automatically match this item"
                                        >
                                            <PackagePlus className="w-3.5 h-3.5 mr-1 text-amber-600" />
                                            + Create & Map
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <Button onClick={onClose} variant="outline" className="h-9 px-6 text-xs font-semibold rounded-none cursor-pointer">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
