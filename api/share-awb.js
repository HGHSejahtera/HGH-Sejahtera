/* global process */
import { createClient } from '@supabase/supabase-js';

export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Read raw body as buffer
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);

        // Extract boundary from Content-Type header
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'Invalid Content-Type. Expected multipart/form-data.' });
        }
        const boundary = boundaryMatch[1] || boundaryMatch[2];

        // Parse multipart form data manually
        const parts = parseMultipart(body, boundary);
        const staffId = parts.find(p => p.name === 'staff_id')?.value;
        const filePart = parts.find(p => p.name === 'awb_file');

        if (!staffId) {
            return res.status(401).json({ error: 'Missing Staff ID.' });
        }
        if (!filePart || !filePart.data) {
            return res.status(400).json({ error: 'Missing PDF file.' });
        }

        // Initialize Supabase with service role key
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Validate Staff ID — look up active agent by StaffID
        const { data: agentData, error: lookupError } = await supabase
            .from('Users')
            .select('StaffID, UserID, DisplayName')
            .eq('StaffID', staffId.trim().toUpperCase())
            .eq('Role', 'Agent')
            .eq('IsActive', true)
            .single();

        if (lookupError || !agentData) {
            return res.status(401).json({ error: 'Invalid Staff ID.' });
        }

        // Generate unique filename
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const fileName = `${agentData.StaffID}/TikTokSeller-${dateStr}.pdf`;

        // Upload PDF to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('pending-awb')
            .upload(fileName, filePart.data, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to store file.' });
        }

        // Create pending upload record
        const { error: insertError } = await supabase
            .from('PendingAWBUploads')
            .insert({
                StaffID: agentData.StaffID,
                UserID: agentData.UserID,
                FileName: filePart.filename || 'AWB.pdf',
                FilePath: fileName,
                Status: 'Pending'
            });

        if (insertError) {
            console.error('Insert error:', insertError);
            return res.status(500).json({ error: 'Failed to create upload record.' });
        }

        return res.status(200).json({
            success: true,
            message: 'AWB Upload Complete',
            agent: agentData.DisplayName
        });

    } catch (err) {
        console.error('Share AWB error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
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
        // Skip \r\n after boundary
        if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

        const nextBoundary = indexOf(body, boundaryBuffer, start);
        if (nextBoundary === -1) break;

        const partData = body.slice(start, nextBoundary);

        // Find header/body separator (\r\n\r\n)
        const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
        if (headerEnd === -1) { start = nextBoundary; continue; }

        const headerStr = partData.slice(0, headerEnd).toString('utf-8');
        let content = partData.slice(headerEnd + 4);

        // Remove trailing \r\n
        if (content.length >= 2 && content[content.length - 2] === 0x0d && content[content.length - 1] === 0x0a) {
            content = content.slice(0, -2);
        }

        // Parse headers
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

        // Check if this was the end boundary
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
