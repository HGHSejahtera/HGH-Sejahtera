import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import Barcode from 'react-barcode';

export function BarcodeGenerator() {
    const { data: internalProducts, isLoading } = useQuery({
        queryKey: ['internalBarcodes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('Products')
                .select('*')
                .ilike('Barcode', '200%')
                .order('ProductName');
            
            if (error) throw error;
            return data;
        }
    });

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) return <div className="p-8 text-center">Loading barcodes...</div>;

    return (
        <div className="space-y-6">
            {/* Header - Hidden during printing */}
            <div className="print:hidden flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
                        <Link to="/inventory">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to Inventory
                        </Link>
                    </Button>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Barcode Generator</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Print Grid */}
            <div id="printable-barcodes" className="bg-white print:p-0 p-6 rounded-xl border shadow-sm">
                {!internalProducts || internalProducts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 print:hidden">
                        No products with internal barcodes currently available.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-6 print:gap-4 print:m-0">
                        {internalProducts.map(product => (
                            <div 
                                key={product.ProductID} 
                                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg break-inside-avoid print:border-gray-300"
                            >
                                <div className="text-xs font-semibold text-center mb-2 line-clamp-2 h-8 flex items-center justify-center print:text-black">
                                    {product.ProductName} {product.Variation ? `(${product.Variation})` : ''}
                                </div>
                                <div className="bg-white px-2">
                                    <Barcode 
                                        value={product.Barcode} 
                                        format="EAN13" 
                                        width={1.5} 
                                        height={50} 
                                        fontSize={12} 
                                        margin={0} 
                                    />
                                </div>
                                <div className="text-xs text-gray-500 mt-2 print:text-gray-700">
                                    RM {product.CostPrice?.toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Print styles */}
            <style>
                {`
                @media print {
                    @page { margin: 10mm; }
                    body { background: white; }
                    main { padding: 0 !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:border-none { border: none !important; }
                    .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                }
                `}
            </style>
        </div>
    );
}
