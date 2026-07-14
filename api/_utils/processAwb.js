import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb';

/**
 * Processes a TikTok AWB PDF sent by an agent.
 * Splits multi-page PDFs, uploads each to Cloudflare R2, and imports orders to Supabase.
 */
export async function processAwbPdf({ pdfBuffer, fileName, agentId, staffId, supabase }) {
    try {
        // 1. Parse and split PDF via dynamic import
        const { TikTokPdfParserNode } = await import('./pdfParserNode.js');
        const orders = await TikTokPdfParserNode.parse(pdfBuffer);
        
        if (!orders || orders.length === 0) {
            throw new Error('No valid TikTok AWB orders found in this PDF.');
        }

        // 2. Upload individual split PDFs to R2
        for (const order of orders) {
            if (order.PdfBuffer) {
                const r2Key = `${staffId}/${order.OrderID}-${Date.now()}.pdf`;
                await r2Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: r2Key,
                    Body: order.PdfBuffer,
                    ContentType: 'application/pdf'
                }));
                order.AwbUrl = `/api/proxy-pdf?key=${encodeURIComponent(r2Key)}`;
                delete order.PdfBuffer;
            }
        }

        // 3. Call Supabase RPC to insert into ImportedOrders and OrderImports
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('process_agent_order_upload', {
            payload: {
                Platform: 'TikTok',
                FileType: 'PDF',
                FileName: fileName || 'Telegram_AWB.pdf',
                AgentID: agentId,
                OrderList: orders
            }
        });

        if (rpcErr) {
            throw rpcErr;
        }

        // 4. Log to PendingAWBUploads history table
        await supabase.from('PendingAWBUploads').insert({
            StaffID: staffId,
            UserID: agentId,
            FileName: fileName || 'Telegram_AWB.pdf',
            FilePath: 'TelegramBot',
            Status: 'Processed'
        });

        return {
            success: true,
            totalOrders: orders.length,
            result: rpcRes
        };
    } catch (err) {
        // Log failed upload attempt if possible
        try {
            await supabase.from('PendingAWBUploads').insert({
                StaffID: staffId,
                UserID: agentId,
                FileName: fileName || 'Telegram_AWB.pdf',
                FilePath: 'TelegramBot',
                Status: 'Failed'
            });
        } catch (e) {
            console.error('Failed to log failed upload:', e);
        }
        throw err;
    }
}
