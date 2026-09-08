// Polyfill browser globals required by pdfjs-dist v6 in Node.js (Vercel Serverless)
if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
        constructor(init) {
            const values = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
            if (Array.isArray(init)) {
                if (init.length === 6) {
                    values[0] = init[0]; values[1] = init[1];
                    values[4] = init[2]; values[5] = init[3];
                    values[12] = init[4]; values[13] = init[5];
                } else if (init.length === 16) {
                    for (let i = 0; i < 16; i++) values[i] = init[i];
                }
            }
            this.a = values[0]; this.b = values[1]; this.c = values[4]; this.d = values[5];
            this.e = values[12]; this.f = values[13];
            this.m11 = values[0]; this.m12 = values[1]; this.m13 = values[2]; this.m14 = values[3];
            this.m21 = values[4]; this.m22 = values[5]; this.m23 = values[6]; this.m24 = values[7];
            this.m31 = values[8]; this.m32 = values[9]; this.m33 = values[10]; this.m34 = values[11];
            this.m41 = values[12]; this.m42 = values[13]; this.m43 = values[14]; this.m44 = values[15];
            this.is2D = true; this.isIdentity = values[0] === 1 && values[5] === 1;
        }
        inverse() { return new DOMMatrix(); }
        multiply() { return new DOMMatrix(); }
        scale() { return new DOMMatrix(); }
        translate() { return new DOMMatrix(); }
        transformPoint(p) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
        static fromMatrix() { return new DOMMatrix(); }
        static fromFloat32Array(a) { return new DOMMatrix(Array.from(a)); }
        static fromFloat64Array(a) { return new DOMMatrix(Array.from(a)); }
    };
}
if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {
        constructor() { this._ops = []; }
        moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {}
        arc() {} arcTo() {} ellipse() {} rect() {} closePath() {} addPath() {}
    };
}

export const TikTokPDFParserNode = {
    /**
     * Parses a TikTok AWB PDF Buffer and extracts orders.
     * @param {Buffer} buffer The PDF file buffer
     * @returns {Promise<Array>} Array of parsed order objects
     */
    parse: async (buffer) => {
        try {
            // pdfjs-dist v6 legacy build + DOMMatrix/Path2D polyfills above
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const { PDFDocument } = await import('pdf-lib');

            const data = new Uint8Array(buffer);
            const loadingTask = pdfjsLib.getDocument({
                data,
                disableFontFace: true,
                useSystemFonts: true,
                isEvalSupported: false
            });
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
                const trackingMatch = allText.match(/\b(6\d{14})\b/) || allText.match(/\b(\d{15})\b/);
                const TrackingNumber = trackingMatch ? trackingMatch[1] : null;

                if (!OrderID) continue; // Skip pages that don't look like AWBs

                // 3. Extract Order Created Time
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

                // 4. Extract Products resiliently
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

                const footerCandidates = items.filter(i =>
                    i.text.includes('Qty Total') ||
                    i.text.includes('NickName') ||
                    (i.text.includes('TikTok Shop') && i.y < yTop) ||
                    (i.text.includes('Order ID') && i.y < yTop - 50)
                );
                if (footerCandidates.length > 0) {
                    yBottom = Math.max(...footerCandidates.map(f => f.y));
                }

                if (headerItem || orderMap.has(OrderID)) {
                    const tableItems = items.filter(i => i.y < yTop && i.y > yBottom);
                    const qtyItems = tableItems.filter(i => i.x > boundQty && /^\d+$/.test(i.text))
                        .sort((a, b) => b.y - a.y); // Sort top to bottom

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
                                .replace(/NickName:?\s*.*/gi, '')
                                .replace(/TikTok Shop/gi, '');
                            if (OrderID) sellerSKU = sellerSKU.replace(new RegExp(OrderID, 'g'), '');
                            if (TrackingNumber) sellerSKU = sellerSKU.replace(new RegExp(TrackingNumber, 'g'), '');
                            sellerSKU = sellerSKU.replace(/\s+/g, ' ').trim();
                            
                            const numericMatch = sellerSKU.match(/\d{8,15}/);
                            if (numericMatch) {
                                sellerSKU = numericMatch[0];
                            }
                        }
                        if (!sellerSKU) sellerSKU = '-';

                        const nameItems = rowItems.filter(item => item.x < boundSku)
                            .sort((a, b) => b.y - a.y);
                        let productName = nameItems.map(n => n.text).join(' ');
                        productName = productName
                            .replace(/Order ID:?\s*\d*/gi, '')
                            .replace(/Tracking No:?\s*\S*/gi, '')
                            .replace(/Page \d+(?: of \d+)?/gi, '')
                            .replace(/NickName:?\s*.*/gi, '')
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
                orderEntry.pageIndices.push(pageNum - 1);
                
                orderItems.forEach(item => {
                    const existingItem = orderEntry.Items.find(i => i.Barcode === item.Barcode);
                    if (existingItem) {
                        existingItem.Quantity += item.Quantity;
                    } else {
                        orderEntry.Items.push(item);
                    }
                });
            }

            // Step 4: Split PDF using pdf-lib
            const srcDoc = await PDFDocument.load(buffer);
            
            for (const orderData of orderMap.values()) {
                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(srcDoc, orderData.pageIndices);
                copiedPages.forEach(p => newPdf.addPage(p));
                
                const pdfBytes = await newPdf.save();
                // Return Buffer instead of Blob for Node.js compatibility
                orderData.PdfBuffer = Buffer.from(pdfBytes);
                
                delete orderData.pageIndices;
                orders.push(orderData);
            }

            return orders;

        } catch (error) {
            console.error("Error parse PDF Node:", error);
            const detailMsg = error?.message || error?.toString() || 'Unknown error';
            throw new Error(`Fail parse PDF file: ${detailMsg}. Please ensure it is a valid TikTok AWB.`, { cause: error });
        }
    }
};
