import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileType, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

const EXPECTED_HEADERS = ['ProductName', 'Brand', 'Category', 'Variation', 'Barcode', 'SellerSKU', 'GTIN', 'CostPrice'];

export function ProductBulkImport() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, processing, success, error, importing, done
    const [errorMsg, setErrorMsg] = useState('');
    const [validData, setValidData] = useState([]);

    const promptText = `Saya ada satu fail CSV/Excel yang mengandungi senarai produk.
Tolong reformat kan data ini ke dalam format CSV dengan header yang tepat berikut:
ProductName, Brand, Category, Variation, Barcode, SellerSKU, GTIN, CostPrice

Rules:
- ProductName dan CostPrice wajib ada.
- Kalau tak jumpa data untuk sesuatu column, biarkan kosong.
- SellerSKU dan GTIN boleh dikosongkan (sistem akan auto-isi dari Barcode).
- CostPrice mesti nombor (tanpa simbol RM).
- Output sebagai .csv file.`;

    const copyPrompt = () => {
        navigator.clipboard.writeText(promptText);
        alert('Prompt copied to clipboard!');
    };

    const validateData = (data) => {
        if (!data || data.length === 0) {
            setErrorMsg('File is empty.');
            setStatus('error');
            return;
        }

        const headers = Object.keys(data[0]);
        const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
            setErrorMsg(`Invalid format. Missing headers: ${missingHeaders.join(', ')}. Please use the AI prompt below to reformat your data.`);
            setStatus('error');
            return;
        }

        const validRows = [];
        const errors = [];

        data.forEach((row, index) => {
            if (!row.ProductName) {
                errors.push(`Row ${index + 1}: Missing ProductName`);
                return;
            }
            if (row.CostPrice === undefined || row.CostPrice === null || row.CostPrice === '') {
                errors.push(`Row ${index + 1}: Missing CostPrice`);
                return;
            }

            const barcodeStr = row.Barcode ? String(row.Barcode) : null;
            validRows.push({
                ProductName: String(row.ProductName),
                Brand: row.Brand ? String(row.Brand) : null,
                Category: row.Category ? String(row.Category) : null,
                Variation: row.Variation ? String(row.Variation) : null,
                Barcode: barcodeStr,
                SellerSKU: row.SellerSKU ? String(row.SellerSKU) : barcodeStr,
                GTIN: row.GTIN ? String(row.GTIN) : barcodeStr,
                CostPrice: parseFloat(row.CostPrice) || 0,
            });
        });

        if (validRows.length === 0) {
            setErrorMsg('No valid rows found to import.');
            setStatus('error');
            return;
        }

        setValidData(validRows);
        setPreviewData(validRows.slice(0, 5));
        setStatus('success');
        if (errors.length > 0) {
            setErrorMsg(`Found ${errors.length} invalid rows that will be skipped. Ensure ProductName and CostPrice exist.`);
        } else {
            setErrorMsg('');
        }
    };

    const processFile = useCallback((selectedFile) => {
        setFile(selectedFile);
        setStatus('processing');
        setErrorMsg('');
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();

        if (fileExt === 'csv') {
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    validateData(results.data);
                },
                error: (err) => {
                    setErrorMsg('Error parsing CSV: ' + err.message);
                    setStatus('error');
                }
            });
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const XLSX = await import('xlsx');
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    validateData(json);
                } catch {
                    setErrorMsg('Error parsing Excel file.');
                    setStatus('error');
                }
            };
            reader.readAsBinaryString(selectedFile);
        } else {
            setErrorMsg('Unsupported file format. Use CSV or XLSX.');
            setStatus('error');
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [processFile]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        setStatus('importing');
        try {
            // Note: We don't auto-generate barcodes in bulk import if missing. 
            // The barcode generator page will handle products without barcodes.
            const { error } = await supabase.from('Products').insert(validData);
            if (error) throw error;
            
            setStatus('done');
            setTimeout(() => {
                navigate('/products');
            }, 2000);
        } catch (error) {
            console.error('Import error', error);
            setErrorMsg('Import failed: ' + error.message);
            setStatus('error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Bulk Import Products</h2>
                <p className="text-muted-foreground">Upload CSV or XLSX files to add multiple products at once.</p>
            </div>

            {/* AI Prompt Box */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-indigo-900">AI Reformat Prompt</h3>
                    <Button variant="outline" size="sm" onClick={copyPrompt} className="bg-white text-indigo-700 hover:text-indigo-800">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Prompt
                    </Button>
                </div>
                <p className="text-sm text-indigo-800 mb-3">
                    If your file doesn't match our Strict Mapping format, copy this prompt and paste it into ChatGPT, Gemini, or Claude along with your file.
                </p>
                <pre className="bg-white p-3 rounded text-xs text-gray-700 whitespace-pre-wrap border border-indigo-100 font-mono">
                    {promptText}
                </pre>
            </div>

            <div 
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Drag and drop your file here</h3>
                <p className="mt-2 text-sm text-gray-500">Supports .CSV, .XLS, .XLSX up to 10MB</p>
                
                <div className="mt-6">
                    <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        onChange={handleFileChange}
                    />
                    <Button asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">
                            Browse Files
                        </label>
                    </Button>
                </div>
            </div>

            {status === 'done' && (
                 <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center shadow-sm">
                 <CheckCircle className="h-5 w-5 mr-3" />
                 Successfully imported {validData.length} products! Redirecting...
             </div>
            )}

            {status === 'error' && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start shadow-sm">
                    <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Import Error</p>
                        <p className="text-sm mt-1">{errorMsg}</p>
                    </div>
                </div>
            )}

            {status === 'success' && file && (
                <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
                    <div className="flex items-center space-x-3">
                        <FileType className="h-8 w-8 text-indigo-600" />
                        <div>
                            <p className="font-medium">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                        <div className="ml-auto flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span className="font-medium text-sm">{validData.length} Valid Rows</span>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md text-sm border border-yellow-200">
                            {errorMsg}
                        </div>
                    )}

                    <div className="border rounded-md overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium text-gray-700">
                            Data Preview (First 5 rows)
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {EXPECTED_HEADERS.map(key => (
                                            <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {previewData.map((row, i) => (
                                        <tr key={i}>
                                            {EXPECTED_HEADERS.map((key, j) => (
                                                <td key={j} className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                                    {row[key] || '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button variant="outline" onClick={() => { setFile(null); setStatus('idle'); setPreviewData([]); setValidData([]); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleImport} disabled={status === 'importing'}>
                            {status === 'importing' ? 'Importing...' : 'Import Data'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
