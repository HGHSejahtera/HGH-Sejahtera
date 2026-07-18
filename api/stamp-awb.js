import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

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

let s3ClientInstance = null;
function getS3Client() {
    if (!s3ClientInstance) {
        s3ClientInstance = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
    }
    return s3ClientInstance;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { awbUrl, targetSku, orderId, platformOrderId } = req.body || {};

        if (!awbUrl || !targetSku) {
            return res.status(400).json({ error: 'awbUrl and targetSku parameters are required' });
        }

        const cleanedTargetSku = String(targetSku).trim();
        if (!cleanedTargetSku || cleanedTargetSku === '-') {
            return res.status(200).json({
                success: true,
                status: 'match',
                targetSku: cleanedTargetSku,
                message: 'No valid SKU to stamp.'
            });
        }

        // 1. Clean and determine R2 key
        let targetUrl = String(awbUrl);
        if (targetUrl.startsWith('rder Archive/') || targetUrl.indexOf('/rder Archive/') !== -1 || targetUrl.indexOf('?url=rder Archive/') !== -1) {
            targetUrl = targetUrl.replace('rder Archive/', 'Order Archive/');
        }

        function extractR2Key(urlStr) {
            let s = decodeURIComponent(String(urlStr).split('?')[0]);
            if (s.startsWith('rder Archive/') || s.indexOf('/rder Archive/') !== -1) {
                s = s.replace('rder Archive/', 'Order Archive/');
            }
            const archiveIdx = s.indexOf('Order Archive/');
            if (archiveIdx !== -1) {
                return s.substring(archiveIdx);
            }
            if (s.startsWith('http://') || s.startsWith('https://')) {
                try {
                    const parsed = new URL(s);
                    let pathname = parsed.pathname;
                    if (pathname.startsWith('/')) pathname = pathname.substring(1);
                    return pathname;
                } catch {
                    // fallback
                }
            }
            if (s.startsWith('/')) s = s.substring(1);
            return s;
        }

        const key = extractR2Key(targetUrl);
        const S3 = getS3Client();
        const bucketsToTry = [
            process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb',
            process.env.R2_BUCKET_NAME || 'hgh-sejahtera'
        ];

        let buffer = null;
        let matchedBucket = null;
        let fetchedViaHttp = false;

        // Try downloading directly from R2 via S3Client using the clean key
        for (const bucket of bucketsToTry) {
            if (!bucket) continue;
            try {
                const command = new GetObjectCommand({ Bucket: bucket, Key: key });
                const response = await S3.send(command);
                if (response.Body) {
                    if (typeof response.Body.transformToByteArray === 'function') {
                        const byteArray = await response.Body.transformToByteArray();
                        buffer = Buffer.from(byteArray);
                    } else if (typeof response.Body.arrayBuffer === 'function') {
                        const arrayBuf = await response.Body.arrayBuffer();
                        buffer = Buffer.from(arrayBuf);
                    }
                    matchedBucket = bucket;
                    break;
                }
            } catch {
                // Try next bucket
            }
        }

        // Fallback: If S3 direct fetch didn't find it, try standard HTTP fetch (e.g. public URL)
        if (!buffer) {
            try {
                const fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                const response = await fetch(fetchUrl);
                if (response.ok) {
                    const arrayBuf = await response.arrayBuffer();
                    buffer = Buffer.from(arrayBuf);
                    matchedBucket = bucketsToTry[0];
                    fetchedViaHttp = true;
                }
            } catch {
                // Ignore
            }
        }

        if (!buffer) {
            return res.status(404).json({ error: `Failed to download AWB PDF from R2 for key: ${key}` });
        }

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
            
            // Check existing items in the Seller SKU column
            const sellerSkuItems = tableItems.filter(i => i.x >= boundSellerSku && i.x < boundQty);
            if (sellerSkuItems.length > 0) {
                const existingSku = sellerSkuItems.map(i => i.text).join(' ').trim();
                const normalizedExisting = existingSku.replace(/\s+/g, '').toLowerCase();
                const normalizedTarget = cleanedTargetSku.replace(/\s+/g, '').toLowerCase();

                if (normalizedExisting && normalizedExisting !== '-' && normalizedExisting !== 'null') {
                    if (normalizedExisting === normalizedTarget) {
                        // Already matched correctly on this page
                        continue;
                    } else {
                        // Discrepancy detected! Do not overwrite
                        detectedMismatch = {
                            existingSku: existingSku,
                            targetSku: cleanedTargetSku
                        };
                        break;
                    }
                }
            }

            // If we reached here, Seller SKU column is empty/blank on this page. Find row Y coordinates to stamp.
            const qtyItems = tableItems.filter(i => i.x > boundQty && /^\d+$/.test(i.text)).sort((a, b) => b.y - a.y);
            let yList = [];

            if (qtyItems.length > 0) {
                yList = qtyItems.map(i => i.y);
            } else {
                // Fallback: Check SKU items or Product Name items
                const skuItems = tableItems.filter(i => i.x >= boundSku && i.x < boundSellerSku).sort((a, b) => b.y - a.y);
                if (skuItems.length > 0) {
                    yList = skuItems.map(i => i.y);
                } else {
                    yList = [yTop - 26]; // Default to standard first row Y (approx 195)
                }
            }

            pagesToStamp.push({
                pageNum: pageNum,
                yList: Array.from(new Set(yList)) // Deduplicate Y coordinates
            });
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
                targetSku: cleanedTargetSku,
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
            for (const y of pageInfo.yList) {
                page.drawText(cleanedTargetSku, {
                    x: 344, // Exactly aligned with TikTok Seller SKU header
                    y: y,   // Aligned with the product row
                    size: 14.5, // Exactly 14.5pt as per TikTok table standard
                    font: helveticaFont,
                    color: rgb(0, 0, 0),
                });
            }
        }

        const stampedBytes = await pdfDoc.save();
        const stampedBuffer = Buffer.from(stampedBytes);

        // 4. Overwrite original in R2
        if (fetchedViaHttp) {
            for (const bucket of bucketsToTry) {
                if (!bucket) continue;
                try {
                    await S3.send(new PutObjectCommand({
                        Bucket: bucket,
                        Key: key,
                        ContentType: 'application/pdf',
                        Body: stampedBuffer
                    }));
                } catch (e) {
                    console.error(`PutObjectCommand failed for fallback bucket ${bucket}:`, e.message);
                }
            }
        } else {
            await S3.send(new PutObjectCommand({
                Bucket: matchedBucket,
                Key: key,
                ContentType: 'application/pdf',
                Body: stampedBuffer
            }));
        }

        return res.status(200).json({
            success: true,
            status: 'stamped',
            targetSku: cleanedTargetSku,
            orderId: orderId,
            platformOrderId: platformOrderId,
            message: 'Successfully stamped Seller SKU and updated AWB in R2.'
        });

    } catch (err) {
        console.error('Error stamping AWB PDF:', err);
        return res.status(500).json({
            error: 'Internal Server Error stamping AWB',
            details: err.message || err.toString()
        });
    }
}
