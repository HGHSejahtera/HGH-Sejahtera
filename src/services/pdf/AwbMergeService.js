import { LoadPdfLib } from '@/lib/pdfLib';

/**
 * Service to sort and merge AWB PDF documents using client-side pdf-lib.
 * Follows HGH physical operation rules (Longgokan 1, 2, and 3).
 * ALL variable and function names MUST use PascalCase as per MemoryCore.
 */

export function SortOrders(OrdersList, SortBy = 'Product') {
    if (!OrdersList || !Array.isArray(OrdersList)) return [];

    // Helper to generate SKU combo summary and Longgokan group for an order
    const EnrichedOrders = OrdersList.map(Order => {
        const Items = Order.Items || Order.ImportOrderItems || [];
        
        const DistinctSkuNames = [];
        const DistinctBrands = [];

        Items.forEach(Item => {
            let CleanName = Item.ProductName || Item.PlatformSKU || 'Unknown SKU';
            if (Item.Products) {
                const Brand = Item.Products.Brand || '';
                const Name = Item.Products.ProductName || '';
                const Var = Item.Products.Variation || '';
                const ConstructedName = `${Brand} ${Name} ${Var}`.replace(/\s+/g, ' ').trim();
                if (ConstructedName) {
                    CleanName = ConstructedName;
                }
                if (Brand && !DistinctBrands.includes(Brand.trim())) {
                    DistinctBrands.push(Brand.trim());
                }
            } else if (!DistinctBrands.includes('Other')) {
                DistinctBrands.push('Other');
            }

            if (!DistinctSkuNames.includes(CleanName)) {
                DistinctSkuNames.push(CleanName);
            }
        });

        DistinctSkuNames.sort();
        DistinctBrands.sort();

        const SkuCount = DistinctSkuNames.length;
        let LonggokanGroup = 1; // Single Item
        if (SkuCount === 2) {
            LonggokanGroup = 2; // 2-Item Combo
        } else if (SkuCount >= 3 || SkuCount === 0) {
            LonggokanGroup = 3; // 3+ Item Combo / Mixed
        }

        const ComboKey = DistinctSkuNames.join(' + ') || 'No Items';
        const PrimaryBrand = DistinctBrands.length === 1 ? DistinctBrands[0] : 'Mixed Brands';
        const IsSingleBrand = DistinctBrands.length === 1;
        const CreatedTimestamp = new Date(Order.CreatedAt || 0).getTime();
        const CreatedMonth = new Date(Order.CreatedAt || 0).getMonth();

        return {
            ...Order,
            LonggokanGroup,
            ComboKey,
            PrimaryBrand,
            IsSingleBrand,
            CreatedTimestamp,
            CreatedMonth
        };
    });

    return EnrichedOrders.sort((OrderA, OrderB) => {
        if (SortBy === 'Product') {
            // Group 1 (Single) -> Group 2 (Combo 2) -> Group 3 (Combo 3+)
            if (OrderA.LonggokanGroup !== OrderB.LonggokanGroup) {
                return OrderA.LonggokanGroup - OrderB.LonggokanGroup;
            }
            // Alphabetical tie-breaker within same group
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        if (SortBy === 'Brand') {
            // Single Brand orders first, Mixed Brands at back
            if (OrderA.IsSingleBrand !== OrderB.IsSingleBrand) {
                return OrderA.IsSingleBrand ? -1 : 1;
            }
            // Sort by Brand Name
            const BrandCompare = OrderA.PrimaryBrand.localeCompare(OrderB.PrimaryBrand);
            if (BrandCompare !== 0) return BrandCompare;

            // Tie-breaker: Longgokan Group and SKU Combo inside the same Brand
            if (OrderA.LonggokanGroup !== OrderB.LonggokanGroup) {
                return OrderA.LonggokanGroup - OrderB.LonggokanGroup;
            }
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        if (SortBy === 'DateOldest') {
            if (OrderA.CreatedTimestamp !== OrderB.CreatedTimestamp) {
                return OrderA.CreatedTimestamp - OrderB.CreatedTimestamp;
            }
            // Tie-breaker for exact same timestamp: Longgokan SKU hierarchy
            if (OrderA.LonggokanGroup !== OrderB.LonggokanGroup) {
                return OrderA.LonggokanGroup - OrderB.LonggokanGroup;
            }
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        if (SortBy === 'DateNewest') {
            if (OrderA.CreatedTimestamp !== OrderB.CreatedTimestamp) {
                return OrderB.CreatedTimestamp - OrderA.CreatedTimestamp;
            }
            // Tie-breaker: Longgokan SKU hierarchy
            if (OrderA.LonggokanGroup !== OrderB.LonggokanGroup) {
                return OrderA.LonggokanGroup - OrderB.LonggokanGroup;
            }
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        if (SortBy === 'MonthJanDec') {
            if (OrderA.CreatedMonth !== OrderB.CreatedMonth) {
                return OrderA.CreatedMonth - OrderB.CreatedMonth;
            }
            if (OrderA.CreatedTimestamp !== OrderB.CreatedTimestamp) {
                return OrderA.CreatedTimestamp - OrderB.CreatedTimestamp;
            }
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        if (SortBy === 'MonthDecJan') {
            if (OrderA.CreatedMonth !== OrderB.CreatedMonth) {
                return OrderB.CreatedMonth - OrderA.CreatedMonth;
            }
            if (OrderA.CreatedTimestamp !== OrderB.CreatedTimestamp) {
                return OrderB.CreatedTimestamp - OrderA.CreatedTimestamp;
            }
            return OrderA.ComboKey.localeCompare(OrderB.ComboKey);
        }

        return 0;
    });
}

export async function MergeAndPrintAwbs(OrdersList, onProgress = null) {
    const ValidOrders = OrdersList.filter(Order => Order.AwbUrl && Order.AwbUrl.trim() !== '');
    if (ValidOrders.length === 0) {
        throw new Error('No valid AWB PDF files found in selected orders.');
    }

    if (onProgress) {
        onProgress({ current: 0, total: ValidOrders.length, status: 'Initializing PDF merger...', successCount: 0, failCount: 0, errors: [] });
    }

    const { PDFDocument } = await LoadPdfLib();
    const MergedPdf = await PDFDocument.create();
    const SuccessfulOrderIds = [];
    const ErrorsList = [];
    let failCount = 0;

    for (let i = 0; i < ValidOrders.length; i++) {
        const Order = ValidOrders[i];
        const orderIdDisplay = Order.PlatformOrderID || Order.ImportOrderID || `Order #${i + 1}`;
        
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: ValidOrders.length,
                status: `Fetching AWB (${i + 1}/${ValidOrders.length}): ${orderIdDisplay}...`,
                successCount: SuccessfulOrderIds.length,
                failCount,
                errors: ErrorsList
            });
        }

        let fetchSuccess = false;
        const pdfUrl = `/api/proxy-pdf?url=${encodeURIComponent(Order.AwbUrl)}`;

        // Retry mechanism (up to 3 attempts total) for network/proxy glitches like 502 Bad Gateway
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const fetchRes = await fetch(pdfUrl);
                if (!fetchRes.ok) {
                    throw new Error(`HTTP ${fetchRes.status}`);
                }
                const pdfArrayBuffer = await fetchRes.arrayBuffer();
                const SourcePdf = await PDFDocument.load(pdfArrayBuffer);
                const CopiedPages = await MergedPdf.copyPages(SourcePdf, SourcePdf.getPageIndices());
                CopiedPages.forEach(Page => MergedPdf.addPage(Page));
                SuccessfulOrderIds.push(Order.ImportOrderID);
                fetchSuccess = true;
                break;
            } catch (error) {
                if (attempt < 3) {
                    // Wait 600ms before retrying
                    await new Promise(resolve => setTimeout(resolve, 600));
                } else {
                    console.error(`Failed to merge AWB for Order ${orderIdDisplay} after 3 attempts:`, error);
                    failCount++;
                    ErrorsList.push({ orderId: orderIdDisplay, error: error.message || 'Download error' });
                }
            }
        }

        if (onProgress) {
            onProgress({
                current: i + 1,
                total: ValidOrders.length,
                status: `Processed (${i + 1}/${ValidOrders.length}): ${orderIdDisplay}`,
                successCount: SuccessfulOrderIds.length,
                failCount,
                errors: ErrorsList
            });
        }
    }

    if (SuccessfulOrderIds.length === 0 || MergedPdf.getPageCount() === 0) {
        if (onProgress) {
            onProgress({
                current: ValidOrders.length,
                total: ValidOrders.length,
                status: 'Failed to download any AWB PDFs (HTTP 502 / Proxy Error).',
                successCount: 0,
                failCount,
                errors: ErrorsList,
                isDone: true
            });
        }
        throw new Error('All selected orders failed to load their AWB PDFs. The server proxy may be unreachable (HTTP 502).');
    }

    if (onProgress) {
        onProgress({
            current: ValidOrders.length,
            total: ValidOrders.length,
            status: `Preparing document for printing (${SuccessfulOrderIds.length} pages ready)...`,
            successCount: SuccessfulOrderIds.length,
            failCount,
            errors: ErrorsList
        });
    }

    const MergedPdfBytes = await MergedPdf.save();
    const PdfBlob = new Blob([MergedPdfBytes], { type: 'application/pdf' });
    const BlobUrl = URL.createObjectURL(PdfBlob);

    // Open print window / dialog
    const PrintWindow = window.open(BlobUrl, '_blank');
    if (PrintWindow) {
        PrintWindow.onload = () => {
            PrintWindow.focus();
            PrintWindow.print();
        };
    } else {
        // Fallback if popup blocked: create download link
        const Link = document.createElement('a');
        Link.href = BlobUrl;
        Link.download = getBatchAwbFilename();
        document.body.appendChild(Link);
        Link.click();
        document.body.removeChild(Link);
    }

    if (onProgress) {
        onProgress({
            current: ValidOrders.length,
            total: ValidOrders.length,
            status: `Done! Merged and opened ${SuccessfulOrderIds.length} AWBs.`,
            successCount: SuccessfulOrderIds.length,
            failCount,
            errors: ErrorsList,
            isDone: true
        });
    }

    return SuccessfulOrderIds;
}

export function getBatchAwbFilename() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `Batch-AWB-${date}-${time}.pdf`;
}

export async function MergeAwbsBatch(OrdersList, onProgress = null) {
    const ValidOrders = OrdersList.filter(Order => Order.AwbUrl && Order.AwbUrl.trim() !== '');
    if (ValidOrders.length === 0) {
        throw new Error('No valid AWB PDF files found in selected orders.');
    }

    if (onProgress) {
        onProgress({ current: 0, total: ValidOrders.length, status: 'Initializing batch PDF merger...', successCount: 0, failCount: 0, errors: [] });
    }

    const { PDFDocument } = await LoadPdfLib();
    const MergedPdf = await PDFDocument.create();
    const SuccessfulOrderIds = [];
    const FailedOrdersList = [];
    const ErrorsList = [];

    for (let i = 0; i < ValidOrders.length; i++) {
        const Order = ValidOrders[i];
        const orderIdDisplay = Order.PlatformOrderID || Order.ImportOrderID || `Order #${i + 1}`;
        
        if (onProgress) {
            onProgress({
                current: i + 1,
                total: ValidOrders.length,
                status: `Fetching AWB (${i + 1}/${ValidOrders.length}): ${orderIdDisplay}...`,
                successCount: SuccessfulOrderIds.length,
                failCount: FailedOrdersList.length,
                errors: ErrorsList
            });
        }

        let fetchSuccess = false;
        const pdfUrl = `/api/proxy-pdf?url=${encodeURIComponent(Order.AwbUrl)}`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const fetchRes = await fetch(pdfUrl);
                if (!fetchRes.ok) {
                    throw new Error(`HTTP ${fetchRes.status}`);
                }
                const pdfArrayBuffer = await fetchRes.arrayBuffer();
                const SourcePdf = await PDFDocument.load(pdfArrayBuffer);
                const CopiedPages = await MergedPdf.copyPages(SourcePdf, SourcePdf.getPageIndices());
                CopiedPages.forEach(Page => MergedPdf.addPage(Page));
                SuccessfulOrderIds.push(Order.ImportOrderID);
                fetchSuccess = true;
                break;
            } catch (error) {
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 600));
                } else {
                    console.error(`Failed to merge AWB for Order ${orderIdDisplay} after 3 attempts:`, error);
                    const errorMsg = error.message || 'Download error';
                    ErrorsList.push({ orderId: orderIdDisplay, error: errorMsg });
                    FailedOrdersList.push({
                        orderId: orderIdDisplay,
                        importedOrderId: Order.ImportOrderID,
                        error: errorMsg,
                        order: Order
                    });
                }
            }
        }

        if (onProgress) {
            onProgress({
                current: i + 1,
                total: ValidOrders.length,
                status: `Processed (${i + 1}/${ValidOrders.length}): ${orderIdDisplay}`,
                successCount: SuccessfulOrderIds.length,
                failCount: FailedOrdersList.length,
                errors: ErrorsList
            });
        }
    }

    let BlobUrl = null;
    if (MergedPdf.getPageCount() > 0) {
        const MergedPdfBytes = await MergedPdf.save();
        const PdfBlob = new Blob([MergedPdfBytes], { type: 'application/pdf' });
        BlobUrl = URL.createObjectURL(PdfBlob);
    }

    if (onProgress) {
        onProgress({
            current: ValidOrders.length,
            total: ValidOrders.length,
            status: SuccessfulOrderIds.length > 0 ? 'Ready' : 'Failed to download any AWBs (HTTP 502 / Proxy Error).',
            successCount: SuccessfulOrderIds.length,
            failCount: FailedOrdersList.length,
            errors: ErrorsList,
            isDone: true
        });
    }

    return {
        successfulIds: SuccessfulOrderIds,
        failedOrders: FailedOrdersList,
        blobUrl: BlobUrl,
        totalProcessed: ValidOrders.length
    };
}
