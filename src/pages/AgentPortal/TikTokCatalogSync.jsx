import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Table as TableIcon, ChevronDown, ExternalLink, Info, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { AgentTabs } from './AgentTabs';

export function TikTokCatalogSync() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    
    const [status, setStatus] = useState('Idle'); // Idle, Process, Success, Error
    const [summary, setSummary] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        
        setStatus('Process');
        setErrorMsg('');
        
        let allValidProducts = [];
        let totalFilesProcessed = 0;

        try {
            for (const file of acceptedFiles) {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(new Uint8Array(e.target.result));
                    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
                    reader.readAsArrayBuffer(file);
                });

                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // TikTok Batch Edit Excel files declare !ref as only 5 rows,
                // but actual product data exists beyond that range.
                // Recalculate the true range from actual cell keys.
                const cellKeys = Object.keys(worksheet).filter(k => !k.startsWith('!'));
                if (cellKeys.length > 0) {
                    const decoded = cellKeys.map(k => XLSX.utils.decode_cell(k));
                    const maxRow = Math.max(...decoded.map(d => d.r));
                    const maxCol = Math.max(...decoded.map(d => d.c));
                    worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
                }
                
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json.length < 2) continue;

                // Scan up to 10 rows to find the header row
                let headerRowIndex = -1;
                let skuIndex = -1;
                let priceIndex = -1;

                for (let i = 0; i < Math.min(json.length, 10); i++) {
                    const row = json[i];
                    if (!Array.isArray(row)) continue;
                    
                    const sIndex = row.findIndex(h => {
                        if (typeof h !== 'string') return false;
                        const normalized = h.trim().toLowerCase();
                        return normalized === 'seller sku' || normalized === 'seller_sku';
                    });
                    
                    const pIndex = row.findIndex(h => {
                        if (typeof h !== 'string') return false;
                        const normalized = h.trim().toLowerCase();
                        return normalized.includes('price');
                    });

                    if (sIndex !== -1 && pIndex !== -1) {
                        headerRowIndex = i;
                        skuIndex = sIndex;
                        priceIndex = pIndex;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    throw new Error(`Could not find 'Seller SKU' and 'Price' columns in ${file.name}. Ensure you export a template that contains prices.`);
                }

                const rows = json.slice(headerRowIndex + 1);

                rows.forEach(row => {
                    const sku = row[skuIndex]?.toString().trim();
                    let priceRaw = row[priceIndex];
                    
                    if (sku && sku !== '') {
                        if (typeof priceRaw === 'string') priceRaw = priceRaw.replace(/[^0-9.]/g, '');
                        const price = parseFloat(priceRaw);
                        
                        if (!isNaN(price)) {
                            allValidProducts.push({
                                AgentID: user.id,
                                SellerSKU: sku,
                                SellingPrice: price
                            });
                        }
                    }
                });
                totalFilesProcessed++;
            }

            if (allValidProducts.length === 0) {
                throw new Error("Found the 'Seller SKU' and 'Price' columns, but all rows were either empty or had invalid prices.");
            }

            // Upsert to database
            const { error } = await supabase
                .from('AgentTikTokProducts')
                .upsert(allValidProducts, { onConflict: 'AgentID,SellerSKU' });

            if (error) throw error;

            setSummary({
                fileName: `${totalFilesProcessed} file(s) processed`,
                totalProducts: allValidProducts.length,
                products: allValidProducts
            });
            setStatus('Success');
            
            // Invalidate the sync status cache so Upload AWB page knows we've synced
            queryClient.invalidateQueries({ queryKey: ['agent_tiktok_sync_status'] });

        } catch (err) {
            console.error("Excel parse error:", err);
            setErrorMsg(err.message || "Failed to process Excel files.");
            setStatus('Error');
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        }
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <button 
                        onClick={() => navigate('/Agent/TikTok-Shop')}
                        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">TikTok Sync</h1>
                </div>
            </div>

            <AgentTabs />

            <details className="group border border-blue-200 rounded-lg bg-blue-50 mb-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer text-blue-800 font-semibold select-none">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        <span>How to get your TikTok Seller Excel File</span>
                    </div>
                    <ChevronDown className="w-5 h-5 transition-transform duration-300 group-open:-rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-blue-200 mt-2">
                    <ol className="list-decimal pl-5 space-y-3 text-sm text-blue-900">
                        <li>
                            Go to <strong>TikTok Seller Center</strong> &gt; <strong>Products</strong> &gt; <strong>Manage Products</strong> &gt; <strong>Bulk Actions</strong> &gt; <strong>Edit Products</strong>.<br/>
                            <a href="https://seller-my.tiktok.com/product/batch/edit-prods" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-medium">
                                <ExternalLink className="w-3 h-3"/> seller-my.tiktok.com/product/batch/edit-prods
                            </a>
                        </li>
                        <li>In <strong>Step 1 : Select Products</strong>, click the <span className="px-2 py-1 bg-[#00897b] text-white rounded font-medium text-xs shadow-sm">Select products</span> button.</li>
                        <li>In the popup window, <strong>Tick All</strong> products and click <span className="px-2 py-1 bg-[#00897b] text-white rounded font-medium text-xs shadow-sm">Select checked</span>.</li>
                        <li>In <strong>Step 2 : Customize the template</strong>, choose the <strong><span className="text-[#00897b]">◉</span> All information</strong> option.</li>
                        <li>Click the <span className="px-2 py-1 bg-[#00897b] text-white rounded font-medium text-xs shadow-sm">Generate template</span> button.</li>
                        <li>Wait for it to generate under <strong>Download history</strong>, then click <span className="px-2 py-1 bg-white border border-gray-200 rounded text-[#00897b] font-medium text-xs shadow-sm">Download</span> in the Actions column.</li>
                        <li><strong>Extract</strong> the downloaded <code>.zip</code> file, then drag and drop the Excel file here.</li>
                    </ol>
                </div>
            </details>

            {status === 'Idle' || status === 'Error' ? (
                <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                        ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                >
                    <input {...getInputProps()} />
                    <TableIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Upload Excel</h3>
                    <Button>Select File</Button>

                    {status === 'Error' && (
                        <div className="text-red-500 font-medium mt-6">
                            <div className="flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 mr-2" />
                                {errorMsg}
                            </div>
                        </div>
                    )}
                </div>
            ) : status === 'Process' ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900">Syncing Catalog...</h3>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="bg-green-100 p-3 rounded-full shrink-0">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Sync Successful</h3>
                            <p className="text-gray-500">File: {summary?.fileName}</p>
                            <p className="text-indigo-600 font-medium mt-1">Successfully synced {summary?.totalProducts} products with Seller SKUs.</p>
                        </div>
                    </div>

                    {summary?.products && summary.products.length > 0 && (
                        <div className="mb-6 border rounded-lg overflow-hidden">
                            <div className="max-h-[400px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller SKU</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {summary.products.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.SellerSKU}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-emerald-600 text-right">
                                                    RM {Number(p.SellingPrice).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setStatus('Idle')}>
                            Upload Another
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
