import { useState } from 'react';
import { useProductMatcher } from '@/hooks/useProductMatcher';
import { useProducts } from '@/hooks/useProducts';
import { AlertTriangle, CheckCircle, Search, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductModal } from '../Inventory/ProductModal';
import { DataTable } from '@/components/common/DataTable';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export function ProductMatcher() {
    const { unmatchedItems, isLoading, resolveItem, isResolving } = useProductMatcher();
    const { products } = useProducts();
    
    // Track selected products per item: { [itemId]: productId }
    const [selectedProducts, setSelectedProducts] = useState({});
    
    // Modal states for creating a new product from unmatched item
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUnmatched, setSelectedUnmatched] = useState(null);

    // Filter out items that are not Unmatched anymore (just in case they stay in cache temporarily)
    const activeUnmatched = unmatchedItems.filter(item => item.MatchStatus === 'Unmatched');

    const handleResolve = async (itemId) => {
        const productId = selectedProducts[itemId];
        if (!productId) {
            alert('Please select a product first.');
            return;
        }

        try {
            const res = await resolveItem({ itemId, productId });
            if (res?.profit_added > 0) {
                alert(`Successfully matched! Commission calculated: RM ${res.profit_added}`);
            } else {
                alert('Successfully matched!');
            }
            // Clear selection
            setSelectedProducts(prev => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
        } catch (error) {
            alert(error.message || 'Failed to resolve item');
        }
    };

    const columns = [
        { header: 'Order ID', accessorKey: 'PlatformOrderID' },
        { header: 'Agent', accessorKey: 'AgentName' },
        { 
            header: 'Unmatched Item (From AWB)', 
            accessorKey: 'ProductName',
            cell: ({ row }) => (
                <div>
                    <p className="font-semibold text-gray-900">{row.original.ProductName}</p>
                    <p className="text-xs text-gray-500">SKU/Barcode: {row.original.PlatformSKU || 'N/A'} • Qty: {row.original.Quantity}</p>
                </div>
            )
        },
        { 
            header: 'Map To Internal Product', 
            id: 'map_to',
            cell: ({ row }) => {
                const itemId = row.original.ItemID;
                const selectedId = selectedProducts[itemId];
                const selectedProduct = products?.find(p => p.ProductID === selectedId);

                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                className={`w-full justify-between font-normal ${!selectedId ? 'text-gray-400' : 'text-gray-900 border-indigo-200 bg-indigo-50'}`}
                            >
                                {selectedProduct 
                                    ? `${selectedProduct.Brand} ${selectedProduct.ProductName} ${selectedProduct.Variation || ''} ${selectedProduct.Size || ''}`.trim()
                                    : "Select matching product..."}
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search product name or barcode..." />
                                <CommandList>
                                    <CommandEmpty className="py-6 text-center">
                                        <p className="text-sm text-gray-500 mb-4">No product found.</p>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                            onClick={() => {
                                                setSelectedUnmatched({
                                                    ProductName: row.original.ProductName,
                                                    SellerSKU: row.original.PlatformSKU && row.original.PlatformSKU !== '-' ? row.original.PlatformSKU : '',
                                                    Barcode: row.original.PlatformSKU && row.original.PlatformSKU !== '-' ? row.original.PlatformSKU : '',
                                                });
                                                setIsModalOpen(true);
                                                // Close popover hack
                                                document.dispatchEvent(new MouseEvent('mousedown'));
                                            }}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create New Product
                                        </Button>
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {products?.map((product) => (
                                            <CommandItem
                                                key={product.ProductID}
                                                value={`${product.Brand} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''} ${product.Barcode}`}
                                                onSelect={() => {
                                                    setSelectedProducts(prev => ({ ...prev, [itemId]: product.ProductID }));
                                                }}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{`${product.Brand} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''}`.trim()}</span>
                                                    <span className="text-xs text-gray-500">{product.Barcode}</span>
                                                </div>
                                                {selectedId === product.ProductID && (
                                                    <CheckCircle className="ml-auto h-4 w-4 text-emerald-500" />
                                                )}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                );
            }
        },
        { 
            header: 'Action', 
            id: 'action',
            cell: ({ row }) => {
                const itemId = row.original.ItemID;
                const hasSelected = !!selectedProducts[itemId];
                return (
                    <Button 
                        size="sm" 
                        onClick={() => handleResolve(itemId)}
                        disabled={!hasSelected || isResolving}
                        className={hasSelected ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                    >
                        <Save className="w-4 h-4 mr-1.5" />
                        Resolve
                    </Button>
                );
            }
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Product Matcher</h1>
                    <p className="text-gray-500 mt-1">Manually match products that failed auto-detection during AWB upload.</p>
                </div>
            </div>

            {activeUnmatched.length === 0 && !isLoading ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="bg-emerald-100 p-4 rounded-full mb-4">
                        <CheckCircle className="h-12 w-12 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">All Clear!</h2>
                    <p className="text-gray-500">There are no unmatched items waiting for review.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
                        <div className="bg-amber-100/80 p-2 rounded-lg mr-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <p className="font-medium text-sm">
                            Orders containing these items cannot be packed until they are manually matched. 
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="p-4">
                            <DataTable 
                                columns={columns} 
                                data={activeUnmatched} 
                                searchPlaceholder="Search by Agent or Order ID"
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <ProductModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedUnmatched(null);
                    }}
                    product={selectedUnmatched}
                />
            )}
        </div>
    );
}
