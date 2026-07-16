/**
 * Service to sort and merge AWB PDF documents using client-side pdf-lib.
 * Follows HGH physical operation rules (Longgokan 1, 2, and 3).
 * ALL variable and function names MUST use PascalCase as per MemoryCore.
 */

export function SortOrders(OrdersList, SortBy = 'Product') {
    if (!OrdersList || !Array.isArray(OrdersList)) return [];

    // Helper to generate SKU combo summary and Longgokan group for an order
    const EnrichedOrders = OrdersList.map(Order => {
        const Items = Order.Items || Order.ImportedOrderItems || [];
        
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

        return {
            ...Order,
            LonggokanGroup,
            ComboKey,
            PrimaryBrand,
            IsSingleBrand,
            CreatedTimestamp
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

        return 0;
    });
}

export async function MergeAndPrintAwbs(OrdersList) {
    const ValidOrders = OrdersList.filter(Order => Order.AwbUrl && Order.AwbUrl.trim() !== '');
    if (ValidOrders.length === 0) {
        throw new Error('No valid AWB PDF files found in selected orders.');
    }

    const { PDFDocument } = await import('pdf-lib');
    const MergedPdf = await PDFDocument.create();
    const SuccessfulOrderIds = [];

    for (const Order of ValidOrders) {
        try {
            const pdfUrl = `/api/proxy-pdf?url=${encodeURIComponent(Order.AwbUrl)}`;
            const Response = await fetch(pdfUrl);
            if (!Response.ok) throw new Error(`Failed to fetch AWB (HTTP ${Response.status})`);
            const ArrayBuffer = await Response.arrayBuffer();
            const SourcePdf = await PDFDocument.load(ArrayBuffer);
            const CopiedPages = await MergedPdf.copyPages(SourcePdf, SourcePdf.getPageIndices());
            CopiedPages.forEach(Page => MergedPdf.addPage(Page));
            SuccessfulOrderIds.push(Order.ImportedOrderID);
        } catch (error) {
            console.error(`Failed to merge AWB for Order ${Order.PlatformOrderID || Order.ImportedOrderID}:`, error);
        }
    }

    if (SuccessfulOrderIds.length === 0 || MergedPdf.getPageCount() === 0) {
        throw new Error('All selected orders failed to load their AWB PDFs. The files may be corrupted or missing from the server.');
    }

    const MergedPdfBytes = await MergedPdf.save();
    const Blob = new Blob([MergedPdfBytes], { type: 'application/pdf' });
    const BlobUrl = URL.createObjectURL(Blob);

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
        Link.download = `Batch_AWBs_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(Link);
        Link.click();
        document.body.removeChild(Link);
    }

    return SuccessfulOrderIds;
}
