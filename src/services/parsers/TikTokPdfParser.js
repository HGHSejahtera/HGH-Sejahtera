import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set the worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const TikTokPdfParser = {
    /**
     * Parses a TikTok AWB PDF File and extracts orders.
     * @param {File} file The PDF file object
     * @returns {Promise<Array>} Array of parsed order objects
     */
    parse: async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            const pdfDocument = await loadingTask.promise;
            
            const numPages = pdfDocument.numPages;
            const orders = [];

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Extract items with coordinates
                const items = textContent.items
                    .filter(item => item.str.trim().length > 0)
                    .map(item => ({
                        text: item.str.trim(),
                        x: Math.round(item.transform[4]),
                        y: Math.round(item.transform[5])
                    }));

                // 1. Extract Order ID
                const allText = items.map(i => i.text).join(' ');
                const orderIdMatch = allText.match(/Order ID:\s*(\d+)/);
                const OrderID = orderIdMatch ? orderIdMatch[1] : null;

                // 2. Extract Tracking Number (TikTok J&T usually 15 digits starting with 6)
                // We find the first 15-digit number
                const trackingMatch = allText.match(/\b(6\d{14})\b/) || allText.match(/\b(\d{15})\b/);
                const TrackingNumber = trackingMatch ? trackingMatch[1] : null;

                if (!OrderID) continue; // Skip pages that don't look like AWBs

                // 3. Extract Products
                const orderItems = [];
                
                // Find boundaries
                const headerItem = items.find(i => i.text === 'Product Name');
                const footerItem = items.find(i => i.text.includes('Qty Total'));

                if (headerItem && footerItem) {
                    const yTop = headerItem.y;
                    const yBottom = footerItem.y;

                    // Dynamic column boundaries based on headers
                    const headerSKU = items.find(i => i.y === yTop && i.text === 'SKU');
                    const headerSellerSKU = items.find(i => i.y === yTop && i.text === 'Seller SKU');
                    const headerQty = items.find(i => i.y === yTop && i.text.includes('Qty'));

                    const boundSku = headerSKU ? headerSKU.x - 20 : 220;
                    const boundSellerSku = headerSellerSKU ? headerSellerSKU.x - 20 : 350;
                    const boundQty = headerQty ? headerQty.x - 20 : 500;

                    // Filter items in the table body
                    const tableItems = items.filter(i => i.y < yTop && i.y > yBottom);

                    // Find all Qty items (X > boundQty)
                    const qtyItems = tableItems.filter(i => i.x > boundQty && /^\d+$/.test(i.text))
                        .sort((a, b) => b.y - a.y); // Sort top to bottom (highest Y first)

                    for (let i = 0; i < qtyItems.length; i++) {
                        const currentQty = qtyItems[i];
                        const nextY = i < qtyItems.length - 1 ? qtyItems[i + 1].y : yBottom;

                        // Get all items belonging to this product row
                        const rowItems = tableItems.filter(item => item.y <= currentQty.y && item.y > nextY);

                        // Seller SKU is between boundSellerSku and boundQty
                        const sellerSkuItems = rowItems.filter(item => item.x >= boundSellerSku && item.x < boundQty)
                            .sort((a, b) => b.y - a.y);
                        
                        let sellerSKU = '-';
                        if (sellerSkuItems.length > 0) {
                            sellerSKU = sellerSkuItems.map(s => s.text).join(' ');
                        }

                        // Product Name is items on the left (X < boundSku), sorted top to bottom
                        const nameItems = rowItems.filter(item => item.x < boundSku)
                            .sort((a, b) => b.y - a.y);
                        const productName = nameItems.map(n => n.text).join(' ');

                        orderItems.push({
                            ProductName: productName,
                            Barcode: sellerSKU, // Seller SKU acts as Barcode
                            Quantity: parseInt(currentQty.text, 10)
                        });
                    }
                }

                orders.push({
                    OrderID,
                    TrackingNumber,
                    Platform: 'TikTok',
                    Status: 'PENDING',
                    Items: orderItems
                });
            }

            return orders;

        } catch (error) {
            console.error("Error parse PDF:", error);
            throw new Error("Fail parse PDF file. Please ensure it is a valid TikTok AWB.", { cause: error });
        }
    }
};
