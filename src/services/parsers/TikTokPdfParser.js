import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';

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
            // Copy the buffer because pdfjs-dist might detach the original ArrayBuffer
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
            const pdfDocument = await loadingTask.promise;
            
            const numPages = pdfDocument.numPages;
            const orders = [];
            const orderMap = new Map();

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

                // 3. Extract Order Created Time (e.g., 2026-07-03 09:29 or 2026-07-03 09:29:00)
                let CreatedTime = null;
                const createdMatch = allText.match(/(?:Order\s*)?Created\s*(?:time|date|at)?\s*:?\s*(\d{4}[-/.]\d{2}[-/.]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/i) ||
                                     allText.match(/(\d{4}[-/.]\d{2}[-/.]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
                if (createdMatch) {
                    let rawTime = createdMatch[1].replace(/\//g, '-').replace(/\./g, '-');
                    if (!rawTime.includes('T') && rawTime.includes(' ')) {
                        rawTime = rawTime.replace(' ', 'T');
                    }
                    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawTime)) {
                        rawTime += ':00';
                    }
                    if (!/([+-]\d{2}:\d{2}|Z)$/i.test(rawTime)) {
                        rawTime += '+08:00';
                    }
                    CreatedTime = rawTime;
                }

                // 4. Extract Products resiliently across single or multi-page AWBs
                const orderItems = [];
                
                let boundSku = 220;
                let boundSellerSku = 350;
                let boundQty = 500;
                let yTop = 10000;
                let yBottom = 0;

                const headerItem = items.find(i => i.text === 'Product Name');
                if (headerItem) {
                    yTop = headerItem.y;
                    const headerSKU = items.find(i => i.y === yTop && i.text === 'SKU');
                    const headerSellerSKU = items.find(i => i.y === yTop && i.text === 'Seller SKU');
                    const headerQty = items.find(i => i.y === yTop && i.text.includes('Qty'));

                    if (headerSKU) boundSku = headerSKU.x - 20;
                    if (headerSellerSKU) boundSellerSku = headerSellerSKU.x - 20;
                    if (headerQty) boundQty = headerQty.x - 20;
                }

                const footerItem = items.find(i => i.text.includes('Qty Total'));
                if (footerItem) {
                    yBottom = footerItem.y;
                }

                // Extract if header found OR if order already started on previous page (multi-page AWB)
                if (headerItem || orderMap.has(OrderID)) {
                    const tableItems = items.filter(i => i.y < yTop && i.y > yBottom);
                    const qtyItems = tableItems.filter(i => i.x > boundQty && /^\d+$/.test(i.text))
                        .sort((a, b) => b.y - a.y); // Sort top to bottom (highest Y first)

                    for (let i = 0; i < qtyItems.length; i++) {
                        const currentQty = qtyItems[i];
                        const nextY = i < qtyItems.length - 1 ? qtyItems[i + 1].y : yBottom;

                        const rowItems = tableItems.filter(item => item.y <= currentQty.y && item.y > nextY);

                        const sellerSkuItems = rowItems.filter(item => item.x >= boundSellerSku && item.x < boundQty)
                            .sort((a, b) => b.y - a.y);
                        
                        let sellerSKU = '-';
                        if (sellerSkuItems.length > 0) {
                            sellerSKU = sellerSkuItems.map(s => s.text).join(' ');
                            sellerSKU = sellerSKU
                                .replace(/Order ID:?\s*\d*/gi, '')
                                .replace(/Tracking No:?\s*\S*/gi, '')
                                .replace(/Page \d+(?: of \d+)?/gi, '')
                                .replace(/TikTok Shop/gi, '');
                            if (OrderID) sellerSKU = sellerSKU.replace(new RegExp(OrderID, 'g'), '');
                            if (TrackingNumber) sellerSKU = sellerSKU.replace(new RegExp(TrackingNumber, 'g'), '');
                            sellerSKU = sellerSKU.replace(/\s+/g, ' ').trim();
                        }
                        if (!sellerSKU) sellerSKU = '-';

                        const nameItems = rowItems.filter(item => item.x < boundSku)
                            .sort((a, b) => b.y - a.y);
                        let productName = nameItems.map(n => n.text).join(' ');
                        productName = productName
                            .replace(/Order ID:?\s*\d*/gi, '')
                            .replace(/Tracking No:?\s*\S*/gi, '')
                            .replace(/Page \d+(?: of \d+)?/gi, '')
                            .replace(/TikTok Shop/gi, '');
                        if (OrderID) productName = productName.replace(new RegExp(OrderID, 'g'), '');
                        if (TrackingNumber) productName = productName.replace(new RegExp(TrackingNumber, 'g'), '');
                        productName = productName.replace(/\s+/g, ' ').trim();

                        orderItems.push({
                            ProductName: productName,
                            Barcode: sellerSKU,
                            Quantity: parseInt(currentQty.text, 10)
                        });
                    }
                }

                if (!orderMap.has(OrderID)) {
                    orderMap.set(OrderID, {
                        OrderID,
                        TrackingNumber,
                        CreatedTime: CreatedTime || new Date().toISOString(),
                        CreatedAt: CreatedTime || new Date().toISOString(),
                        Platform: 'TikTok',
                        Items: [],
                        pageIndices: []
                    });
                } else if (CreatedTime) {
                    const existing = orderMap.get(OrderID);
                    if (!existing.CreatedTime || existing.CreatedTime === existing.CreatedAt) {
                        existing.CreatedTime = CreatedTime;
                        existing.CreatedAt = CreatedTime;
                    }
                }
                
                const orderEntry = orderMap.get(OrderID);
                orderEntry.pageIndices.push(pageNum - 1); // pdf-lib uses 0-indexed pages
                
                // Add items if not already added (assuming they might span pages, but usually they are on the first page of the order)
                // We'll just push them all in
                orderItems.forEach(item => {
                    const existingItem = orderEntry.Items.find(i => i.Barcode === item.Barcode);
                    if (existingItem) {
                        existingItem.Quantity += item.Quantity;
                    } else {
                        orderEntry.Items.push(item);
                    }
                });
            }

            // Step 4: Split PDF using pdf-lib based on grouped pageIndices
            const srcDoc = await PDFDocument.load(arrayBuffer);
            
            for (const orderData of orderMap.values()) {
                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(srcDoc, orderData.pageIndices);
                copiedPages.forEach(p => newPdf.addPage(p));
                
                const pdfBytes = await newPdf.save();
                orderData.PdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                
                // Clean up pageIndices before returning
                delete orderData.pageIndices;
                orders.push(orderData);
            }

            return orders;

        } catch (error) {
            console.error("Error parse PDF:", error);
            throw new Error("Fail parse PDF file. Please ensure it is a valid TikTok AWB.", { cause: error });
        }
    }
};
