import { useState, useCallback } from 'react';
import { CheckCircle, UploadCloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { useDropzone } from 'react-dropzone';
import { TikTokPdfParser } from '@/services/parsers/TikTokPdfParser';
import { useAuthStore } from '@/hooks/useAuth';
import { useAgentPortal } from '@/hooks/useAgentPortal';
import { useProducts } from '@/hooks/useProducts';
import { useTranslation } from '@/hooks/useTranslation';
import { AgentTabs } from './AgentTabs';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export function AgentOrderCreate() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { uploadOrders, hasSyncedTikTok, isLoadingSyncStatus } = useAgentPortal();
    const { data: products } = useProducts();
    const { t } = useTranslation();
    // Assuming this component is strictly used by agents
    const isAgent = true;

    const [FileStatus, setFileStatus] = useState('Idle');
    const [Summary, setSummary] = useState(null);
    const [OrderList, setOrderList] = useState([]);
    const [Payloads, setPayloads] = useState([]);
    const [ErrorMessage, setErrorMessage] = useState('');

    const productMap = useMemo(() => {
        const map = new Map();
        if (products) {
            products.forEach(p => {
                if (p.SellerSKU) map.set(p.SellerSKU, p);
            });
        }
        return map;
    }, [products]);

    const previewItems = useMemo(() => {
        const allItems = OrderList.flatMap(order => order.Items || []);
        const aggregated = {};

        for (const item of allItems) {
            // Group by Barcode if available, otherwise fallback to ProductName
            const key = item.Barcode && item.Barcode !== '-' ? item.Barcode : item.ProductName;
            
            if (!aggregated[key]) {
                aggregated[key] = { ...item };
            } else {
                // Parse integer just in case string '1' was passed
                aggregated[key].Quantity = parseInt(aggregated[key].Quantity, 10) + parseInt(item.Quantity, 10);
            }
        }

        return Object.values(aggregated);
    }, [OrderList]);

    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        
        setFileStatus('Process');
        setSummary(null);

        try {
            let totalMissingSKUs = 0;
            let totalOrders = 0;
            let generatedPayloads = [];
            let fileCount = 0;
            
            // Parse all PDFs
            for (const file of acceptedFiles) {
                // Gap masa logic: Add fileCount seconds to ensure unique timestamps
                const now = new Date();
                now.setSeconds(now.getSeconds() + fileCount);
                fileCount++;
                
                const options = { timeZone: 'Asia/Kuala_Lumpur', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
                const formatter = new Intl.DateTimeFormat('en-GB', options);
                const parts = formatter.formatToParts(now);
                const p = {};
                parts.forEach(({ type, value }) => { p[type] = value; });
                
                const dateStr = `${p.day}${p.month}${p.year}`;
                const timeStr = `${p.hour}${p.minute}${p.second}`;
                const newFileName = `TikTokSeller-${dateStr}-${timeStr}.pdf`;

                const ExtractedData = await TikTokPdfParser.parse(file);
                
                if (isAgent) {
                    ExtractedData.forEach(Order => {
                        Order.SubmittedBy = user?.id || null;
                        Order.Items.forEach(item => {
                            if (item.Barcode === '-' || !item.Barcode) {
                                totalMissingSKUs++;
                            }
                        });
                    });
                }

                totalOrders += ExtractedData.length;

                generatedPayloads.push({
                    Platform: 'TikTok',
                    FileType: 'PDF',
                    FileName: newFileName,
                    OrderList: ExtractedData,
                    _rawFile: file // Keep reference for R2 upload
                });
            }

            setSummary({
                FileName: generatedPayloads.map(p => p.FileName).join(', '),
                TotalOrders: totalOrders,
                MissingSKUs: totalMissingSKUs
            });
            
            setPayloads(generatedPayloads);
            setOrderList(generatedPayloads.flatMap(p => p.OrderList));
            setFileStatus('Success');

        } catch (ErrorObj) {
            console.error('Upload error:', ErrorObj);
            setErrorMessage(ErrorObj.message);
            setFileStatus('Error');
        }
    }, [isAgent, user?.id]);

    const handleConfirmSave = async () => {
        setFileStatus('Upload');
        setErrorMessage('');
        try {
            for (const payload of Payloads) {
                const fileToUpload = payload._rawFile;
                
                // 1. Generate Presigned URL for Private Bucket
                const resUrl = await fetch('/api/generate-r2-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        fileName: payload.FileName, 
                        fileType: 'application/pdf',
                        isPrivate: true 
                    })
                });

                if (!resUrl.ok) {
                    throw new Error(t('errors.uploadOrdersFailedR2'));
                }

                const { url } = await resUrl.json();

                // 2. Upload file securely to Cloudflare R2
                const uploadRes = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/pdf',
                    },
                    body: fileToUpload
                });

                if (!uploadRes.ok) {
                    throw new Error('Gagal muat naik fail ke Cloudflare R2.');
                }

                // 3. Remove _rawFile before sending to DB
                const dbPayload = { ...payload };
                delete dbPayload._rawFile;

                // 4. Save to Database
                await uploadOrders(dbPayload);
            }
            setFileStatus('Complete');
        } catch (ErrorObj) {
            console.error('Save error:', ErrorObj);
            setErrorMessage(`Failed to submit orders: ${ErrorObj.message}`);
            setFileStatus('Error');
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        }
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Upload AWB</h1>
                </div>
            </div>

            <AgentTabs />

            <div className="space-y-6">
                {/* Dropzone */}
                {isLoadingSyncStatus ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center bg-gray-50">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold text-gray-900">Checking requirements...</h3>
                    </div>
                ) : !hasSyncedTikTok ? (
                    <div className="border-2 border-dashed border-red-300 rounded-xl p-10 md:p-16 text-center bg-red-50">
                        <AlertTriangle className="mx-auto h-12 w-12 md:h-16 md:w-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-red-700 mb-2">Sync Required</h3>
                        <p className="text-gray-600 mb-6 max-w-lg mx-auto">You must upload your TikTok Catalog Excel file first to sync your selling prices before you can upload AWB files.</p>
                        <Button onClick={() => navigate('/Agent/TikTok-Shop/TikTok-Sync')}>Go to TikTok Sync</Button>
                    </div>
                ) : FileStatus === 'Idle' || FileStatus === 'Error' ? (
                    <div 
                        {...getRootProps()} 
                        className={`border-2 border-dashed rounded-xl p-8 md:p-16 text-center cursor-pointer transition-colors
                            ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 md:h-16 md:w-16 text-gray-400 mb-4" />
                        
                        {/* Mobile Guide */}
                        <div className="md:hidden block mb-6">
                            <h3 className="text-xl font-bold text-indigo-700 mb-2">Tap to Upload PDF</h3>
                            <div className="text-sm text-gray-600 text-left bg-white/50 p-4 rounded-lg inline-block">
                                <p className="font-semibold mb-1">How to upload from mobile:</p>
                                <ol className="list-decimal pl-5 space-y-1">
                                    <li>Generate AWB in TikTok Seller App</li>
                                    <li>Choose <span className="font-medium text-gray-900">Save to Files</span> (Must be PDF)</li>
                                    <li>Tap this box to select the PDF</li>
                                </ol>
                            </div>
                        </div>

                        {/* Desktop Guide */}
                        <div className="hidden md:block">
                            <h3 className="text-lg font-semibold text-gray-900">Upload AWB</h3>
                            <p className="text-gray-500 mt-2 mb-6">PDF Only</p>
                            <Button>Select PDF</Button>
                        </div>

                        {FileStatus === 'Error' && (
                            <div className="text-red-500 font-medium mt-6">
                                <div className="flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 mr-2" />
                                    Error process file.
                                </div>
                                {ErrorMessage && (
                                    <p className="text-xs text-red-400 mt-2 font-mono break-all max-w-lg mx-auto">{ErrorMessage}</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : FileStatus === 'Process' ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center bg-gray-50">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold text-gray-900">Process Order...</h3>
                        <p className="text-gray-500 mt-2">Extract SKU and group orders.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center space-x-4">
                                    <div className="bg-green-100 p-3 rounded-full shrink-0">
                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">AWB Scan Successfully</h3>
                                        <p className="text-gray-500">File: {Summary?.FileName}</p>
                                        <p className="text-indigo-600 font-medium mt-1">Found {Summary?.TotalOrders} orders in this document.</p>
                                        {Summary?.MissingSKUs > 0 && (
                                            <div className="mt-2 flex items-center text-amber-700 bg-amber-50 p-2 rounded-md text-sm border border-amber-200">
                                                <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                                                Warning: {Summary.MissingSKUs} products have missing Seller SKUs. Commission will not be calculated for them.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    <Button variant="outline" onClick={() => { setFileStatus('Idle'); setOrderList([]); setPayloads([]); }} className="w-full sm:w-auto">
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

                        {/* Preview Table */}
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50">
                                <h3 className="font-semibold text-gray-900">Orders Preview</h3>
                            </div>
                            <div className="p-4">
                                <DataTable 
                                    columns={[
                                        { accessorKey: 'Barcode', header: 'Seller SKU', cell: ({ row }) => (
                                            <span className="font-mono text-indigo-600">{row.original.Barcode || '-'}</span>
                                        )},
                                        { 
                                            id: 'Products', 
                                            header: 'Products', 
                                            cell: ({ row }) => {
                                                const item = row.original;
                                                const sysProduct = productMap.get(item.Barcode);
                                                const systemName = sysProduct ? [sysProduct.Brand, sysProduct.ProductName, sysProduct.Variation, sysProduct.Size].filter(Boolean).join(' ') : item.ProductName;
                                                
                                                return (
                                                    <div>
                                                        <div className={sysProduct ? "text-gray-900 font-medium" : "text-gray-500 italic"}>
                                                            {systemName || 'Unknown Product'}
                                                        </div>
                                                        {!sysProduct && <div className="text-xs text-red-500 mt-0.5">Not found in system</div>}
                                                    </div>
                                                );
                                            }
                                        },
                                        { accessorKey: 'Quantity', header: 'Quantity', cell: ({ row }) => (
                                            <span className="font-bold">{row.original.Quantity}</span>
                                        )}
                                    ]} 
                                    data={previewItems} 
                                    searchPlaceholder="Search"
                                />
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
                        <Button className="mt-6 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setFileStatus('Idle'); setOrderList([]); setPayloads([]); }}>
                            Upload More Order
                        </Button>
                    </div>
                )}

            </div>
        </div>
    );
}
