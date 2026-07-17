import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProductMatcher } from '@/hooks/useProductMatcher';
import { useProducts } from '@/hooks/useProducts';
import { AlertTriangle, CheckCircle, Search, Plus, ArrowLeft, PackagePlus } from 'lucide-react';
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
    const navigate = useNavigate();
    const location = useLocation();
    const { uniqueUnmatched, isLoading, resolveBatch, isResolvingBatch } = useProductMatcher();
    const { data: products = [] } = useProducts();
    
    // Track selected products per unique group key: { [groupKey]: productId }
    const [SelectedProducts, SetSelectedProducts] = useState({});
    
    // Modal states for creating a new product from an unmatched group
    const [IsModalOpen, SetIsModalOpen] = useState(false);
    const [TargetGroup, SetTargetGroup] = useState(null);

    const handleOpenCreateModal = (group) => {
        SetTargetGroup(group);
        SetIsModalOpen(true);
    };

    const handleProductModalSuccess = async (newProductId) => {
        if (!TargetGroup || !newProductId) return;

        try {
            await resolveBatch({
                itemIds: TargetGroup.ItemIDs,
                productId: newProductId
            });
        } catch (error) {
            console.error("Failed to batch resolve items after product creation:", error);
        } finally {
            SetTargetGroup(null);
            SetIsModalOpen(false);
        }
    };

    const columns = [
        { 
            header: 'Unmatched Product', 
            accessorKey: 'ProductName',
            cell: ({ row }) => (
                <div className="py-1">
                    <p className="font-bold text-gray-900 text-sm">{row.original.ProductName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border">
                            SKU/Barcode: {row.original.PlatformSKU || '-'}
                        </span>
                    </div>
                </div>
            )
        },
        { 
            header: 'Affected Orders', 
            id: 'impact',
            cell: ({ row }) => (
                <div className="text-xs space-y-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            {row.original.AffectedOrdersCount} {row.original.AffectedOrdersCount === 1 ? 'Order' : 'Orders'}
                        </span>
                        <span>({row.original.TotalQuantity} units total)</span>
                    </div>
                    <p className="text-gray-500 truncate max-w-[220px]" title={row.original.AgentNames}>
                        Agents: <span className="font-medium text-gray-700">{row.original.AgentNames || 'Direct Sale'}</span>
                    </p>
                </div>
            )
        },
        { 
            header: 'Match Product', 
            id: 'map_to',
            cell: ({ row }) => {
                const groupKey = row.original.key;
                const selectedId = SelectedProducts[groupKey];
                const selectedProduct = products?.find(p => p.ProductID === selectedId);

                return (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="outline" 
                                role="combobox" 
                                disabled={isResolvingBatch}
                                className={`w-full justify-between font-normal text-xs h-9 rounded-none ${!selectedId ? 'text-gray-400' : 'text-gray-900 border-indigo-200 bg-indigo-50 font-semibold'}`}
                            >
                                <span className="truncate">
                                    {selectedProduct 
                                        ? `${selectedProduct.Brand || ''} ${selectedProduct.ProductName} ${selectedProduct.Variation || ''} ${selectedProduct.Size || ''}`.trim()
                                        : "Select Product"}
                                </span>
                                <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0 rounded-none shadow-xl border-gray-200" align="start">
                            <Command>
                                <CommandInput placeholder="Search" className="text-xs" />
                                <CommandList>
                                    <CommandEmpty className="py-6 px-4 text-center">
                                        <p className="text-xs text-gray-500 mb-3">No product found.</p>
                                        <Button 
                                            size="sm" 
                                            variant="outline"
                                            className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs h-8 font-semibold rounded-none"
                                            onClick={() => {
                                                handleOpenCreateModal(row.original);
                                                document.dispatchEvent(new MouseEvent('mousedown'));
                                            }}
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                                            Create Product
                                        </Button>
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {products?.map((product) => (
                                            <CommandItem
                                                key={product.ProductID}
                                                value={`${product.Brand || ''} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''} ${product.Barcode}`.trim()}
                                                onSelect={async () => {
                                                    SetSelectedProducts(prev => ({ ...prev, [groupKey]: product.ProductID }));
                                                    document.dispatchEvent(new MouseEvent('mousedown'));
                                                    try {
                                                        await resolveBatch({ 
                                                            itemIds: row.original.ItemIDs, 
                                                            productId: product.ProductID 
                                                        });
                                                    } catch (error) {
                                                        alert(error.message || 'Failed to match items in batch');
                                                    }
                                                }}
                                                className="text-xs py-2 cursor-pointer"
                                            >
                                                <div className="flex flex-col flex-1 truncate pr-2">
                                                    <span className="font-semibold text-gray-900 truncate">{`${product.Brand || ''} ${product.ProductName} ${product.Variation || ''} ${product.Size || ''}`.trim()}</span>
                                                    <span className="text-[10px] text-gray-500 font-mono mt-0.5">Barcode: {product.Barcode || product.SellerSKU || '-'}</span>
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
                );
            }
        },
        { 
            header: () => <div className="text-center">Create Product</div>, 
            id: 'create_product',
            cell: ({ row }) => (
                <div className="flex items-center justify-center">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCreateModal(row.original)}
                        disabled={isResolvingBatch}
                        className="h-8 px-3 text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-none shadow-sm"
                        title="Create a new inventory product pre-filled with this item name and automatically match all affected orders"
                    >
                        <PackagePlus className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Create & Map
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                        const origin = location.state?.from;
                        if (origin) {
                            navigate(origin);
                        } else if (window.history.state && window.history.state.idx > 0) {
                            navigate(-1);
                        } else {
                            navigate('/orders');
                        }
                    }}
                    className="-ml-2 text-gray-600 hover:text-gray-900 font-medium h-8"
                >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back
                </Button>
            </div>

            {(uniqueUnmatched || []).length === 0 && !isLoading ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-none p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="bg-emerald-100 p-4 rounded-full mb-4">
                        <CheckCircle className="h-12 w-12 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">All Clear!</h2>
                    <p className="text-gray-500 text-sm">There are no unmatched items waiting for review across your orders.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center text-amber-900 bg-amber-50/80 p-4 rounded-none border border-amber-300 shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-none mr-3 shrink-0 border border-amber-200">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <h3 className="font-bold text-base text-amber-950">Product Matcher Queue</h3>
                    </div>

                    <div className="bg-white rounded-none shadow-sm border overflow-hidden">
                        <div className="p-6">
                            <DataTable 
                                columns={columns} 
                                data={uniqueUnmatched || []} 
                                searchPlaceholder="Search"
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                </div>
            )}

            {IsModalOpen && (
                <ProductModal
                    isOpen={IsModalOpen}
                    onClose={() => {
                        SetIsModalOpen(false);
                        SetTargetGroup(null);
                    }}
                    product={null}
                    prefilledName={TargetGroup?.ProductName || ''}
                    onSuccess={handleProductModalSuccess}
                />
            )}
        </div>
    );
}
