import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProductMatcher } from '@/hooks/useProductMatcher';
import { useProducts } from '@/hooks/useProducts';
import { AlertTriangle, CheckCircle, Search, Plus, ArrowLeft, PackagePlus, ChevronDown, ChevronRight, Copy } from 'lucide-react';
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
    const { uniqueUnmatched, isLoading, resolveItem, isResolving } = useProductMatcher();
    const { data: products = [] } = useProducts();
    
    // Track selected products per individual item ID
    const [SelectedProducts, SetSelectedProducts] = useState({});
    
    // Modal states for creating a new product from an unmatched item
    const [IsModalOpen, SetIsModalOpen] = useState(false);
    const [TargetItem, SetTargetItem] = useState(null);

    const handleOpenCreateModal = (itemObj) => {
        SetTargetItem(itemObj);
        SetIsModalOpen(true);
    };

    const handleProductModalSuccess = async (newProductId) => {
        if (!TargetItem || !newProductId) return;

        try {
            await resolveItem({
                itemId: TargetItem.ItemID,
                productId: newProductId
            });
        } catch (error) {
            console.error("Failed to resolve item after product creation:", error);
        } finally {
            SetTargetItem(null);
            SetIsModalOpen(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    // Columns for the MAIN group row
    const columns = [
        {
            id: 'expander',
            header: () => null,
            cell: ({ row }) => {
                return (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-8 w-8 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                        onClick={row.getToggleExpandedHandler()}
                    >
                        {row.getIsExpanded() ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </Button>
                )
            },
        },
        { 
            header: 'Unmatched Product', 
            accessorKey: 'ProductName',
            cell: ({ row }) => (
                <div className="py-1">
                    <p className="font-bold text-gray-900 text-sm">{row.original.ProductName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
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
            header: () => <div className="text-right pr-4">Action</div>,
            id: 'action',
            cell: ({ row }) => (
                <div className="flex justify-end pr-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={row.getToggleExpandedHandler()}
                        className={`text-xs font-bold h-8 px-4 rounded-full transition-all duration-200 cursor-pointer ${
                            row.getIsExpanded() 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                                : 'bg-white border-indigo-600 text-indigo-700 hover:bg-indigo-600 hover:text-white shadow-sm'
                        }`}
                    >
                        {row.getIsExpanded() ? 'Hide Orders' : 'Match Orders'}
                    </Button>
                </div>
            )
        }
    ];

    // Sub component rendering the individual items
    const renderSubComponent = ({ row }) => {
        const items = row.original.Items || [];
        
        return (
            <div className="p-4 bg-indigo-50/30">
                <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-3 w-1/4">Order ID</th>
                                <th className="px-4 py-3 w-1/6">Agent</th>
                                <th className="px-4 py-3 w-[10%] text-center">Qty</th>
                                <th className="px-4 py-3 w-1/3">Match Target Product</th>
                                <th className="px-4 py-3 w-auto text-center">New</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item) => {
                                const selectedId = SelectedProducts[item.ItemID];
                                const selectedProduct = products?.find(p => p.ProductID === selectedId);

                                return (
                                    <tr key={item.ItemID} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-medium text-gray-900 text-xs">
                                                    {item.PlatformOrderID || item.ImportOrderID || '-'}
                                                </span>
                                                {item.PlatformOrderID && (
                                                    <button 
                                                        onClick={() => copyToClipboard(item.PlatformOrderID)}
                                                        className="text-gray-400 hover:text-indigo-600 focus:outline-none transition-colors cursor-pointer"
                                                        title="Copy Order ID"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-700 text-xs font-medium">
                                                {item.AgentName || 'Direct Sale'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center bg-gray-100 text-gray-800 text-xs font-bold px-2 py-0.5 rounded border border-gray-200">
                                                {item.Quantity}x
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        role="combobox" 
                                                        disabled={isResolving}
                                                        className={`w-full justify-between font-normal text-xs h-8 rounded shadow-sm cursor-pointer ${!selectedId ? 'text-gray-500 bg-white' : 'text-indigo-700 border-indigo-200 bg-indigo-50 font-semibold'}`}
                                                    >
                                                        <span className="truncate">
                                                            {selectedProduct 
                                                                ? `${selectedProduct.Brand || ''} ${selectedProduct.ProductName} ${selectedProduct.Variation || ''} ${selectedProduct.Size || ''}`.trim()
                                                                : "Select Product"}
                                                        </span>
                                                        <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[340px] p-0 rounded-md shadow-xl border-gray-200" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search" className="text-xs h-9" />
                                                        <CommandList>
                                                            <CommandEmpty className="py-6 px-4 text-center">
                                                                <p className="text-xs text-gray-500 mb-3">No product found.</p>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline"
                                                                    className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs h-8 font-semibold rounded-md shadow-sm cursor-pointer"
                                                                    onClick={() => {
                                                                        handleOpenCreateModal(item);
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
                                                                            SetSelectedProducts(prev => ({ ...prev, [item.ItemID]: product.ProductID }));
                                                                            document.dispatchEvent(new MouseEvent('mousedown'));
                                                                            try {
                                                                                await resolveItem({ 
                                                                                    itemId: item.ItemID, 
                                                                                    productId: product.ProductID 
                                                                                });
                                                                            } catch (error) {
                                                                                alert(error.message || 'Failed to match item');
                                                                            }
                                                                        }}
                                                                        className="text-xs py-2 cursor-pointer rounded-sm"
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
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleOpenCreateModal(item)}
                                                disabled={isResolving}
                                                className="h-8 px-3 text-[11px] font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded shadow-sm cursor-pointer"
                                                title="Create a new inventory product and match this order to it"
                                            >
                                                <PackagePlus className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                                                Create Product
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

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
                    className="-ml-2 text-gray-600 hover:text-gray-900 font-medium h-8 cursor-pointer"
                >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back
                </Button>
            </div>

            {(uniqueUnmatched || []).length === 0 && !isLoading ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-none p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="bg-emerald-100 p-4 rounded-full mb-4 border border-emerald-200">
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
                        <div>
                            <h3 className="font-bold text-base text-amber-950">Product Matcher Queue</h3>
                        </div>
                    </div>

                    <div className="bg-white rounded-none shadow-sm border overflow-hidden">
                        <div className="p-6">
                            <DataTable 
                                columns={columns} 
                                data={uniqueUnmatched || []} 
                                searchPlaceholder="Search"
                                renderSubComponent={renderSubComponent}
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
                        SetTargetItem(null);
                    }}
                    product={null}
                    prefilledName={TargetItem?.ProductName || ''}
                    onSuccess={handleProductModalSuccess}
                />
            )}
        </div>
    );
}
