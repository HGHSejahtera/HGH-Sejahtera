import { useState, useCallback, useEffect, useMemo } from 'react';
import { CheckCircle, UploadCloud, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from '@/components/common/DataTable';
import { useDropzone } from 'react-dropzone';
import { TikTokPdfParser } from '@/services/parsers/TikTokPdfParser';
import { useAuthStore } from '@/hooks/useAuth';
import { useAgentPortal } from '@/hooks/useAgentPortal';
import { useProducts } from '@/hooks/useProducts';
import { useTranslation } from '@/hooks/useTranslation';
import { AgentTabs } from './AgentTabs';
import { TelegramConnectBanner } from '@/components/AgentPortal/TelegramConnectBanner';

export function AgentOrderCreate() {
    const { user } = useAuthStore();
    const { uploadOrders } = useAgentPortal();
    const { data: products } = useProducts();
    const { t } = useTranslation();
    // Assuming this component is strictly used by agents
    const isAgent = true;

    const [FileStatus, setFileStatus] = useState('Idle');
    const [Summary, setSummary] = useState(null);
    const [OrderList, setOrderList] = useState([]);
    const [Payloads, setPayloads] = useState([]);
    const [ErrorMessage, setErrorMessage] = useState('');
    const [UploadResult, setUploadResult] = useState(null);
    const [SkipPrintQueue, SetSkipPrintQueue] = useState(false);

    const cleanSku = (str) => {
        if (!str || str === '-') return '-';
        return String(str)
            .replace(/Order ID:?\s*\d*/gi, '')
            .replace(/Tracking No:?\s*\S*/gi, '')
            .replace(/Page \d+(?: of \d+)?/gi, '')
            .replace(/TikTok Shop/gi, '')
            .replace(/\s+/g, ' ')
            .trim() || '-';
    };

    const productMap = useMemo(() => {
        const map = new Map();
        if (products) {
            products.forEach(p => {
                if (p.SellerSKU) map.set(p.SellerSKU.trim(), p);
                if (p.Barcode && p.Barcode !== p.SellerSKU) map.set(p.Barcode.trim(), p);
            });
        }
        return map;
    }, [products]);

    const previewItems = useMemo(() => {
        const allItems = OrderList.flatMap(order => order.Items || []);
        const aggregated = {};

        for (const item of allItems) {
            const cleanedBarcode = cleanSku(item.Barcode);
            const key = cleanedBarcode && cleanedBarcode !== '-' ? cleanedBarcode : item.ProductName;

            if (!aggregated[key]) {
                aggregated[key] = { ...item, Barcode: cleanedBarcode };
            } else {
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

                const options = { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
                const formatter = new Intl.DateTimeFormat('en-GB', options);
                const parts = formatter.formatToParts(now);
                const p = {};
                parts.forEach(({ type, value }) => { p[type] = value; });

                const dateStr = `${p.year}${p.month}${p.day}`;
                const timeStr = `${p.hour}${p.minute}${p.second}`;
                const newFileName = `TikTokSeller-${dateStr}-${timeStr}.pdf`;

                const ExtractedData = await TikTokPdfParser.parse(file);

                if (isAgent) {
                    ExtractedData.forEach(Order => {
                        Order.SubmittedBy = user?.id || null;
                        Order.Items.forEach(item => {
                            if (item.Barcode) {
                                item.Barcode = cleanSku(item.Barcode);
                            }
                            if (!item.Barcode || item.Barcode === '') item.Barcode = '-';

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
                FileName: acceptedFiles.length > 2 ? `${acceptedFiles.length} PDF files` : acceptedFiles.map(f => f.name).join(', '),
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
        setUploadResult(null);
        try {
            let totalSkipped = 0;
            let totalUpdated = 0;

            for (const payload of Payloads) {
                const newOrderList = [];

                for (const order of payload.OrderList) {
                    if (!order.PdfBlob) {
                        newOrderList.push({ ...order });
                        continue;
                    }

                    const orderDateStr = order.CreatedTime || order.CreatedAt || order.OrderCreatedTime || order.Date;
                    let orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
                    if (isNaN(orderDate.getTime())) {
                        orderDate = new Date();
                    }

                    const year = orderDate.getFullYear();
                    const month = String(orderDate.getMonth() + 1).padStart(2, '0');
                    const day = String(orderDate.getDate()).padStart(2, '0');
                    const staffId = user?.staffId || user?.StaffID || user?.id || 'Unknown';
                    const hours = String(orderDate.getHours()).padStart(2, '0');
                    const minutes = String(orderDate.getMinutes()).padStart(2, '0');

                    const dateStr = `${year}${month}${day}`;
                    const timeStr = `${hours}${minutes}`;
                    const fileName = `TikTokSeller-${staffId}-${order.OrderID}-${dateStr}-${timeStr}.pdf`;

                    // Folder structure: Order Archive/[Platform]/[STAFFID]/[YEAR]/[MONTH]/
                    const folderPath = `Order Archive/TikTok/${staffId}/${year}/${month}/${fileName}`;

                    // 1. Generate Presigned URL
                    const resUrl = await fetch('/api/generate-r2-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName: folderPath,
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
                        body: order.PdfBlob
                    });

                    if (!uploadRes.ok) {
                        throw new Error('Failed to upload file to Cloudflare R2.');
                    }

                    // 3. Construct new order object without mutating state
                    const orderWithoutBlob = { ...order };
                    delete orderWithoutBlob.PdfBlob;

                    newOrderList.push({
                        ...orderWithoutBlob,
                        AwbUrl: folderPath
                    });
                }

                // 4. Save to Database
                const dbPayload = {
                    Platform: payload.Platform,
                    FileType: payload.FileType,
                    FileName: payload.FileName,
                    OrderList: newOrderList,
                    SkipPrintQueue: SkipPrintQueue
                };

                const response = await uploadOrders(dbPayload);
                if (response) {
                    totalSkipped += (response.skipped_orders || 0);
                    totalUpdated += (response.awb_updated || 0);
                }
            }

            setUploadResult({
                skipped: totalSkipped,
                updated: totalUpdated
            });

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
            <AgentTabs />

            <TelegramConnectBanner />

            <div className="space-y-6">
                {/* Dropzone */}
                {FileStatus === 'Idle' || FileStatus === 'Error' ? (
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-8 md:p-16 text-center cursor-pointer transition-colors
                            ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto h-12 w-12 md:h-16 md:w-16 text-gray-400 mb-4" />

                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">Upload AWB</h3>
                            <p className="text-gray-500 mt-2 mb-6 text-sm">PDF Only</p>
                            <Button type="button">Select PDF</Button>
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
                                                Warning: {Summary.MissingSKUs} products have missing Seller SKUs (Unmatched). Please ensure you manually register these products in the Inventory.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 cursor-pointer bg-gray-50 px-3 py-2 rounded-none border border-gray-300 hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={SkipPrintQueue}
                                            onChange={(e) => SetSkipPrintQueue(e.target.checked)}
                                            className="rounded-none border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                        />
                                        <span>Skip Queue (Already Printed Direct)</span>
                                    </label>
                                    <Button variant="outline" onClick={() => { setFileStatus('Idle'); setOrderList([]); setPayloads([]); SetSkipPrintQueue(false); }} className="w-full sm:w-auto rounded-none">
                                        Upload Another
                                    </Button>
                                    {FileStatus === 'Success' && (
                                        <Button onClick={handleConfirmSave} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto rounded-none shadow-xs">
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
                                        {
                                            accessorKey: 'Barcode', header: 'Seller SKU', cell: ({ row }) => (
                                                <span className="font-mono text-indigo-600">{cleanSku(row.original.Barcode) || '-'}</span>
                                            )
                                        },
                                        {
                                            id: 'Products',
                                            header: 'Products',
                                            cell: ({ row }) => {
                                                const item = row.original;
                                                const sysProduct = productMap.get(cleanSku(item.Barcode));
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
                                        {
                                            accessorKey: 'Quantity', header: 'Quantity', cell: ({ row }) => (
                                                <span className="font-bold">{row.original.Quantity}</span>
                                            )
                                        }
                                    ]}
                                    data={previewItems}
                                    searchPlaceholder="Search"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <Dialog open={FileStatus === 'Upload'} onOpenChange={() => { }}>
                    <DialogContent className="sm:max-w-md [&>button]:hidden">
                        <div className="flex flex-col items-center justify-center p-8 space-y-4">
                            <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
                            <h3 className="text-xl font-bold text-gray-900">Processing Upload...</h3>
                            <p className="text-gray-500 text-center text-sm">Please do not close this window or navigate away.</p>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={FileStatus === 'Complete'} onOpenChange={(open) => { if (!open) { setFileStatus('Idle'); setOrderList([]); setPayloads([]); setUploadResult(null); } }}>
                    <DialogContent className="sm:max-w-md [&>button]:hidden rounded-none p-0 overflow-hidden border-0 shadow-xl">
                        <div className="p-8 pb-4 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none bg-emerald-100 mb-4">
                                <CheckCircle className="h-6 w-6 text-emerald-600" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-gray-900">
                                Upload Complete
                            </DialogTitle>
                            <p className="text-gray-500 mt-2 text-sm">Your AWB has been successfully processed.</p>
                        </div>

                        <div className="px-8 pb-8">
                            {UploadResult?.skipped > 0 && (
                                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-sm text-amber-900 space-y-2 mt-2 mb-6 rounded-none">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                                        <p><strong>Duplicates Detected:</strong> {UploadResult.skipped} orders were skipped because they already exist.</p>
                                    </div>
                                    {UploadResult.updated > 0 && (
                                        <p className="ml-7 text-amber-700">AWB links for {UploadResult.updated} of these orders have been attached.</p>
                                    )}
                                </div>
                            )}

                            <DialogFooter className="sm:justify-center">
                                <Button
                                    onClick={() => { setFileStatus('Idle'); setOrderList([]); setPayloads([]); setUploadResult(null); }}
                                    className="w-full rounded-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-none font-medium h-11"
                                >
                                    Done
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
