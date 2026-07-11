/* global process */
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TikTokPdfParserNode } from './utils/pdfParserNode.js';

export const config = {
    api: { bodyParser: false },
    maxDuration: 60
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let supabase = null;
    let agentData = null;
    let fileNameOriginal = 'AWB.pdf';

    try {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);

        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'Invalid Content-Type.' });
        }
        const boundary = boundaryMatch[1] || boundaryMatch[2];

        const parts = parseMultipart(body, boundary);
        const staffId = parts.find(p => p.name === 'staff_id' || p.name?.startsWith('staff_id'))?.value;
        const filePart = parts.find(p => p.name === 'awb_file' || p.name?.startsWith('awb_file'));

        if (!staffId) {
            return res.status(401).json({ error: 'Missing Staff ID.' });
        }

        if (filePart && !filePart.data && filePart.value) {
            filePart.data = Buffer.from(filePart.value, 'binary');
            filePart.filename = filePart.filename || 'AWB.pdf';
        }

        if (!filePart || !filePart.data) {
            return res.status(400).json({ error: 'Missing PDF file.' });
        }

        fileNameOriginal = filePart.filename || 'AWB.pdf';

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        supabase = createClient(supabaseUrl, supabaseKey);

        const { data: rpcData, error: rpcErr } = await supabase.rpc('validate_agent_for_upload', { p_staff_id: staffId.trim() });
        if (!rpcErr && rpcData && rpcData.length > 0) {
            agentData = { StaffID: rpcData[0].staff_id, UserID: rpcData[0].user_id, DisplayName: rpcData[0].display_name };
        } else {
            const { data: directData } = await supabase.from('Users').select('StaffID, UserID, DisplayName').eq('StaffID', staffId.trim().toUpperCase()).eq('Role', 'Agent').eq('IsActive', true).single();
            if (directData) agentData = directData;
        }

        if (!agentData) {
            return res.status(401).json({ error: 'Invalid Staff ID.' });
        }

        // 1. Parse the PDF
        const extractedOrders = await TikTokPdfParserNode.parse(filePart.data);
        if (!extractedOrders || extractedOrders.length === 0) {
            throw new Error('No orders found in the PDF or invalid format.');
        }

        // 2. Upload split PDFs to R2
        const S3 = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
        const targetBucket = process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb';
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        const timeStr = `${hours}${minutes}`;

        const uploadPromises = extractedOrders.map(async (order) => {
            if (!order.PdfBuffer) return order;

            const fileName = `TikTokSeller-${agentData.StaffID}-${order.OrderID}-${dateStr}-${timeStr}.pdf`;
            const folderPath = `Order Archive/TikTok/${agentData.StaffID}/${year}/${month}/${fileName}`;

            const command = new PutObjectCommand({
                Bucket: targetBucket,
                Key: folderPath,
                ContentType: 'application/pdf',
                Body: order.PdfBuffer
            });
            await S3.send(command);

            order.AwbUrl = folderPath;
            order.SubmittedBy = agentData.UserID; // Crucial for Agent ownership
            delete order.PdfBuffer; // Clean up before sending to DB

            return order;
        });

        const finalOrderList = await Promise.all(uploadPromises);

        // 3. Save to Database via RPC
        const dbPayload = {
            Platform: 'TikTok',
            FileType: 'PDF',
            FileName: fileNameOriginal,
            OrderList: finalOrderList,
            SkipPrintQueue: false
        };

        const { error: dbError } = await supabase.rpc('process_agent_order_upload', { payload: dbPayload });
        
        if (dbError) {
            throw new Error(`Failed to save orders: ${dbError.message}`);
        }

        // 4. Log success to PendingAWBUploads history
        await supabase.from('PendingAWBUploads').insert({
            StaffID: agentData.StaffID,
            UserID: agentData.UserID,
            FileName: fileNameOriginal,
            FilePath: 'Server-Processed',
            Status: 'Processed'
        });

        return res.status(200).json({
            success: true,
            message: 'AWB Upload Complete',
            agent: agentData.DisplayName,
            ordersProcessed: finalOrderList.length
        });

    } catch (err) {
        console.error('Share AWB error:', err);
        
        // Log failure if possible
        if (supabase && agentData) {
            await supabase.from('PendingAWBUploads').insert({
                StaffID: agentData.StaffID,
                UserID: agentData.UserID,
                FileName: fileNameOriginal,
                FilePath: err.message || 'Server Error',
                Status: 'Failed'
            }).catch(() => {});
        }

        return res.status(500).json({ error: 'Internal Server Error', details: err.message || String(err) });
    }
}

/**
 * Lightweight multipart/form-data parser (no external dependencies)
 */
function parseMultipart(body, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundary = Buffer.from(`--${boundary}--`);

    let start = indexOf(body, boundaryBuffer, 0);
    if (start === -1) return parts;

    while (true) {
        start += boundaryBuffer.length;
        if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

        const nextBoundary = indexOf(body, boundaryBuffer, start);
        if (nextBoundary === -1) break;

        const partData = body.slice(start, nextBoundary);
        const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
        if (headerEnd === -1) { start = nextBoundary; continue; }

        const headerStr = partData.slice(0, headerEnd).toString('utf-8');
        let content = partData.slice(headerEnd + 4);

        if (content.length >= 2 && content[content.length - 2] === 0x0d && content[content.length - 1] === 0x0a) {
            content = content.slice(0, -2);
        }

        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);

        if (nameMatch) {
            const part = { name: nameMatch[1] };
            if (filenameMatch) {
                part.filename = filenameMatch[1];
                part.data = content;
            } else {
                part.value = content.toString('utf-8');
            }
            parts.push(part);
        }

        if (indexOf(body, endBoundary, nextBoundary) === nextBoundary) break;
        start = nextBoundary;
    }

    return parts;
}

function indexOf(buf, search, fromIndex) {
    for (let i = fromIndex; i <= buf.length - search.length; i++) {
        let found = true;
        for (let j = 0; j < search.length; j++) {
            if (buf[i + j] !== search[j]) { found = false; break; }
        }
        if (found) return i;
    }
    return -1;
}
