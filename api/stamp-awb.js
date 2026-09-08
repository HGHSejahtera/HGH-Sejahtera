import { PutObjectCommand } from '@aws-sdk/client-s3';
import { RequireFileAccess, ResolveAWBAccess, SendFileError } from './_utils/FileAccess.js';
import { GetFileStorage, ReadPrivatePDF } from './_utils/FileStorage.js';

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

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const Access = await RequireFileAccess(req);
        const { awbUrl, targetSku, orderItems = [], orderId, platformOrderId } = req.body || {};

        if (!awbUrl || !Array.isArray(orderItems) || orderItems.length > 200 || (orderItems.length === 0 && !targetSku)) {
            return res.status(400).json({ error: 'awbUrl and orderItems parameters are required' });
        }

        const File = await ResolveAWBAccess(Access, awbUrl, orderId);
        const cleanedTargetSku = targetSku ? String(targetSku).trim() : '-';
        if (orderItems.length === 0 && (!cleanedTargetSku || cleanedTargetSku === '-')) {
            return res.status(200).json({
                success: true,
                status: 'match',
                targetSku: cleanedTargetSku,
                message: 'No valid SKU to stamp.'
            });
        }

        const S3 = GetFileStorage();
        const buffer = await ReadPrivatePDF(S3, File);

        // 2. Perform Smart Analysis with pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

        const pdfData = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({
            data: pdfData,
            disableFontFace: true,
            useSystemFonts: true,
            isEvalSupported: false
        });
        const pdfDocument = await loadingTask.promise;

        const numPages = pdfDocument.numPages;
        const pagesToStamp = [];
        let detectedMismatch = null;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            const items = textContent.items
                .filter(item => item.str && item.str.trim().length > 0)
                .map(item => ({
                    text: item.str.trim(),
                    x: Math.round(item.transform[4]),
                    y: Math.round(item.transform[5])
                }))
                .sort((a, b) => b.y - a.y || a.x - b.x);

            const headerItem = items.find(i => i.text === 'Product Name');
            const headerSellerSKU = items.find(i => i.text === 'Seller SKU');
            const headerSKU = items.find(i => i.text === 'SKU');
            const headerQty = items.find(i => i.text.includes('Qty') && !i.text.includes('Total'));
            const footerItem = items.find(i => i.text.includes('Qty Total'));

            const yTop = headerItem ? headerItem.y : 221;
            const yBottom = footerItem ? footerItem.y : 100;
            const boundSellerSku = headerSellerSKU ? headerSellerSKU.x - 20 : 330;
            const boundQty = headerQty ? headerQty.x - 20 : 500;
            const boundSku = headerSKU ? headerSKU.x - 20 : 240;

            const tableItems = items.filter(i => i.y < yTop && i.y > yBottom);
            
            const qtyItems = tableItems.filter(i => i.x > boundQty && /^\d+$/.test(i.text)).sort((a, b) => b.y - a.y);
            let yList = [];
            if (qtyItems.length > 0) {
                yList = qtyItems.map(i => i.y);
            } else {
                const skuItems = tableItems.filter(i => i.x >= boundSku && i.x < boundSellerSku).sort((a, b) => b.y - a.y);
                if (skuItems.length > 0) yList = skuItems.map(i => i.y);
                else yList = [yTop - 26]; // Default to standard first row Y
            }
            
            yList = Array.from(new Set(yList)); // Deduplicate
            
            const pageStamps = [];
            
            for (let rowIdx = 0; rowIdx < yList.length; rowIdx++) {
                const rowY = yList[rowIdx];
                const nextY = rowIdx < yList.length - 1 ? yList[rowIdx + 1] : yBottom;
                // Add a small tolerance (+5) for items slightly out of strict Y bounds
                const rowItems = tableItems.filter(item => item.y <= rowY + 5 && item.y > nextY + 5);

                const sellerSkuItems = rowItems.filter(i => i.x >= boundSellerSku && i.x < boundQty);
                const existingSku = sellerSkuItems.length > 0 ? sellerSkuItems.map(i => i.text).join(' ').trim() : null;

                const nameItems = rowItems.filter(i => i.x < boundSku).sort((a, b) => b.y - a.y);
                const pdfProductName = nameItems.map(n => n.text).join(' ').toLowerCase();
                
                const qtyItemMatch = qtyItems.find(q => Math.abs(q.y - rowY) < 5);
                const pdfQty = qtyItemMatch ? parseInt(qtyItemMatch.text, 10) : 1;

                let bestMatch = null;
                let bestScore = -1;

                // Fuzzy Match with DB items
                if (orderItems && orderItems.length > 0) {
                    for (let i = 0; i < orderItems.length; i++) {
                        const dbItem = orderItems[i];
                        let score = 0;
                        const dbName = (dbItem.name || '').toLowerCase();
                        
                        if (dbItem.qty === pdfQty) score += 50;
                        if (pdfProductName.includes(dbName) && dbName.length > 0) score += 100;
                        
                        const dbTokens = dbName.split(/\s+/).filter(Boolean);
                        if (dbTokens.length > 0) {
                            let tokenMatches = 0;
                            for (const token of dbTokens) {
                                if (pdfProductName.includes(token)) tokenMatches++;
                            }
                            score += (tokenMatches / dbTokens.length) * 40;
                        }
                        
                        if (i === rowIdx) score += 10; // Positional tie-breaker
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = dbItem;
                        }
                    }
                }

                const skuToStamp = (bestMatch && bestScore > 0 && bestMatch.sku !== '-') ? bestMatch.sku : cleanedTargetSku;
                
                if (!skuToStamp || skuToStamp === '-') continue;

                if (existingSku) {
                    const normalizedExisting = existingSku.replace(/\s+/g, '').toLowerCase();
                    const normalizedTarget = skuToStamp.replace(/\s+/g, '').toLowerCase();
                    
                    if (normalizedExisting && normalizedExisting !== '-' && normalizedExisting !== 'null') {
                        if (normalizedExisting !== normalizedTarget) {
                            detectedMismatch = { existingSku, targetSku: skuToStamp };
                            break; // Stop parsing pages, mismatch detected
                        } else {
                            continue; // Already matched correctly
                        }
                    }
                }
                
                pageStamps.push({ y: rowY, skuToStamp });
            }
            
            if (detectedMismatch) break;
            if (pageStamps.length > 0) pagesToStamp.push({ pageNum, stamps: pageStamps });
        }

        // If mismatch detected across any page, return warning without saving/overwriting
        if (detectedMismatch) {
            return res.status(200).json({
                success: false,
                status: 'mismatch',
                existingSku: detectedMismatch.existingSku,
                targetSku: detectedMismatch.targetSku,
                orderId: orderId,
                platformOrderId: platformOrderId,
                message: `PDF already contains Seller SKU "${detectedMismatch.existingSku}", which differs from target "${detectedMismatch.targetSku}".`
            });
        }

        // If no pages need stamping (all already matched)
        if (pagesToStamp.length === 0) {
            return res.status(200).json({
                success: true,
                status: 'match',
                targetSku: orderItems.length > 0 ? 'Batch SKUs' : cleanedTargetSku,
                orderId: orderId,
                platformOrderId: platformOrderId,
                message: 'AWB already contains the correct Seller SKU.'
            });
        }

        // 3. Stamp using pdf-lib
        const pdfDoc = await PDFDocument.load(buffer);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const pageInfo of pagesToStamp) {
            const page = pdfDoc.getPage(pageInfo.pageNum - 1);
            for (const stamp of pageInfo.stamps) {
                page.drawText(stamp.skuToStamp, {
                    x: 344, // Exactly aligned with TikTok Seller SKU header
                    y: stamp.y,   // Aligned with the product row
                    size: 14.5, // Exactly 14.5pt as per TikTok table standard
                    font: helveticaFont,
                    color: rgb(0, 0, 0),
                });
            }
        }

        const stampedBytes = await pdfDoc.save();
        const stampedBuffer = Buffer.from(stampedBytes);

        // Write only the private object resolved from the authorized order.
        await S3.send(new PutObjectCommand({
            Bucket: File.Bucket, Key: File.Key,
            ContentType: 'application/pdf', Body: stampedBuffer
        }));

        return res.status(200).json({
            success: true,
            status: 'stamped',
            targetSku: orderItems.length > 0 ? 'Batch SKUs' : cleanedTargetSku,
            orderId: orderId,
            platformOrderId: platformOrderId,
            message: 'Successfully stamped Seller SKU and updated AWB in R2.'
        });

    } catch (err) {
        return SendFileError(res, err);
    }
}
