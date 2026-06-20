import { useState, useCallback } from 'react';
import { CheckCircle, UploadCloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { TikTokPdfParser } from '@/services/parsers/TikTokPdfParser';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';

export function AgentOrderCreate() {
    const { user } = useAuthStore();
    // Assuming this component is strictly used by agents
    const isAgent = true;

    const [FileStatus, setFileStatus] = useState('Idle');
    const [Summary, setSummary] = useState(null);
    const [OrderList, setOrderList] = useState([]);
    const [ErrorMessage, setErrorMessage] = useState('');

    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        
        const TargetFile = acceptedFiles[0];
        setFileStatus('Process');
        setSummary(null);

        try {
            // Parse the PDF
            const ExtractedData = await TikTokPdfParser.parse(TargetFile);
            
            // Auto tag with agent info
            if (isAgent) {
                ExtractedData.forEach(Order => {
                    Order.SubmittedBy = user?.id || null;
                });
            }

            setSummary({
                FileName: TargetFile.name,
                TotalOrders: ExtractedData.length,
            });
            
            setOrderList(ExtractedData);
            setFileStatus('Success');

        } catch (ErrorObj) {
            console.error('Upload error:', ErrorObj);
            setFileStatus('Error');
        }
    }, [isAgent, user?.id]);

    const handleConfirmSave = async () => {
        setFileStatus('Upload');
        setErrorMessage('');
        try {
            // 1. Create parent OrderImports record
            const { data: ImportRecord, error: ImportError } = await supabase
                .from('OrderImports')
                .insert([{
                    Platform: 'TikTok',
                    Source: 'AgentOrder',
                    FileType: 'PDF',
                    FileName: Summary?.FileName || 'unknown.pdf',
                    AgentID: user?.id || null,
                    TotalOrders: OrderList.length,
                    TotalItems: OrderList.reduce((Sum, Order) => Sum + Order.Items.length, 0),
                    ImportStatus: 'Completed',
                    ImportedBy: user?.id || null
                }])
                .select()
                .single();

            if (ImportError) {
                console.error('OrderImports Insert Error:', ImportError);
                setErrorMessage(`[OrderImports] ${ImportError.message} (code: ${ImportError.code})`);
                setFileStatus('Error');
                return;
            }

            const ImportID = ImportRecord.ImportID;
            let FailCount = 0;

            // 2. Insert each order into ImportedOrders
            for (const Order of OrderList) {
                const { data: OrderRecord, error: OrderError } = await supabase
                    .from('ImportedOrders')
                    .insert([{
                        ImportID: ImportID,
                        PlatformOrderID: Order.OrderID,
                        Platform: Order.Platform,
                        OrderStatus: 'Pending',
                        TrackingID: Order.TrackingNumber,
                    }])
                    .select()
                    .single();

                if (OrderError) {
                    console.error('ImportedOrders Insert Error:', OrderError);
                    setErrorMessage(`[ImportedOrders] ${OrderError.message} (code: ${OrderError.code})`);
                    FailCount++;
                    continue;
                }

                // 3. Insert items into ImportedOrderItems
                if (Order.Items.length > 0) {
                    const ItemsToInsert = Order.Items.map(Item => ({
                        ImportedOrderID: OrderRecord.ImportedOrderID,
                        PlatformSKU: Item.Barcode,
                        ProductName: Item.ProductName,
                        Quantity: Item.Quantity,
                        MatchStatus: 'Pending'
                    }));

                    const { error: ItemsError } = await supabase
                        .from('ImportedOrderItems')
                        .insert(ItemsToInsert);

                    if (ItemsError) {
                        console.error('ImportedOrderItems Insert Error:', ItemsError);
                        setErrorMessage(`[ImportedOrderItems] ${ItemsError.message} (code: ${ItemsError.code})`);
                    }
                }
            }

            if (FailCount === OrderList.length) {
                setErrorMessage(`Semua ${FailCount} orders gagal disimpan. Sila semak console untuk details.`);
                setFileStatus('Error');
            } else {
                setFileStatus('Complete');
            }
        } catch (ErrorObj) {
            console.error('Save error:', ErrorObj);
            setErrorMessage(`Unexpected: ${ErrorObj.message}`);
            setFileStatus('Error');
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        maxFiles: 1
    });

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Submit Order (AWB)</h1>
                    <p className="text-gray-500 mt-1">Upload your TikTok Air Waybill to automatically submit your orders.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Dropzone */}
                {FileStatus === 'Idle' || FileStatus === 'Error' ? (
                    <div 
                        {...getRootProps()} 
                        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors
                            ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                        {FileStatus === 'Error' && (
                            <div className="text-red-500 font-medium mb-2">
                                <div className="flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 mr-2" />
                                    Error process file.
                                </div>
                                {ErrorMessage && (
                                    <p className="text-xs text-red-400 mt-2 font-mono break-all max-w-lg mx-auto">{ErrorMessage}</p>
                                )}
                            </div>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900">Drag and drop your Air Waybill (AWB) here</h3>
                        <p className="text-gray-500 mt-2 mb-6">Supports .PDF</p>
                        <Button>Select PDF</Button>
                    </div>
                ) : FileStatus === 'Process' ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center bg-gray-50">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold text-gray-900">Process Order...</h3>
                        <p className="text-gray-500 mt-2">Extract SKU and group orders.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center space-x-4">
                                <div className="bg-green-100 p-3 rounded-full shrink-0">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">AWB Scanned Successfully</h3>
                                    <p className="text-gray-500">File: {Summary?.FileName}</p>
                                    <p className="text-indigo-600 font-medium mt-1">Found {Summary?.TotalOrders} orders in this document.</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <Button variant="outline" onClick={() => { setFileStatus('Idle'); setOrderList([]); }} className="w-full sm:w-auto">
                                    Upload Another
                                </Button>
                                {FileStatus === 'Success' && (
                                    <Button onClick={handleConfirmSave} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                                        Submit AWB
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {FileStatus === 'Upload' && (
                    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-900">Upload to Database...</h3>
                    </div>
                )}

                {FileStatus === 'Complete' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-900">Upload Success!</h3>
                        <p className="text-gray-600 mt-2">The extract order success upload to database.</p>
                        <Button className="mt-6 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setFileStatus('Idle'); setOrderList([]); }}>
                            Upload More Order
                        </Button>
                    </div>
                )}

            </div>
        </div>
    );
}
