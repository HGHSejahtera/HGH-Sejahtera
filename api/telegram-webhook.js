import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function for Telegram Bot Webhook
// NOTE: No `export const config = { ... }` as per AGENTS.md rule to prevent Hobby tier errors.
// NOTE: Dynamic await import() is used for PDF utilities to prevent top-level cold boot crashes (`FUNCTION_INVOCATION_FAILED`).

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendTelegramMessage(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('Error: TELEGRAM_BOT_TOKEN is missing');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: text })
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error(`Telegram API error status ${res.status}: ${errBody}`);
        }
    } catch (e) {
        console.error('Error sending Telegram message:', e);
    }
}

async function getTelegramFileUrl(fileId) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (!data.ok || !data.result.file_path) {
        throw new Error('Could not retrieve file path from Telegram.');
    }
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'Telegram Webhook is Active and Healthy', endpoint: '/api/telegram-webhook' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Optional security check for secret header if configured
    if (TELEGRAM_WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== TELEGRAM_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized webhook request' });
    }

    try {
        const update = req.body;
        if (!update || !update.message) {
            return res.status(200).json({ status: 'ignored' });
        }

        const msg = update.message;
        const chatId = msg.chat?.id;
        const text = (msg.text || '').trim();

        if (!chatId) {
            return res.status(200).json({ status: 'no_chat_id' });
        }

        // Check if chatId is already linked to an active agent (positive ID)
        const { data: linkedAgent } = await supabase
            .from('Users')
            .select('UserID, StaffID, DisplayName, TelegramChatID, Role')
            .eq('TelegramChatID', chatId)
            .eq('IsActive', true)
            .single();

        // Check if chatId is currently pending double confirmation (negative ID = -chatId)
        const pendingChatId = -Math.abs(chatId);
        const { data: pendingAgent } = await supabase
            .from('Users')
            .select('UserID, StaffID, DisplayName, TelegramChatID')
            .eq('TelegramChatID', pendingChatId)
            .eq('IsActive', true)
            .single();

        // --- COMMANDS: /relink or /logout ---
        if (text === '/relink' || text === '/logout') {
            if (linkedAgent) {
                await supabase.from('Users').update({ TelegramChatID: null }).eq('UserID', linkedAgent.UserID);
            }
            if (pendingAgent) {
                await supabase.from('Users').update({ TelegramChatID: null }).eq('UserID', pendingAgent.UserID);
            }
            await sendTelegramMessage(chatId, 'Welcome to HGH Sejahtera. Please enter your Identifier');
            return res.status(200).json({ status: 'unlinked' });
        }

        // --- STEP 2: DOUBLE CONFIRMATION REPLY ---
        if (pendingAgent) {
            if (text.toUpperCase() === 'YES') {
                // Confirm setup and set TelegramChatID to positive chatId
                const { error: updErr } = await supabase
                    .from('Users')
                    .update({ TelegramChatID: chatId })
                    .eq('UserID', pendingAgent.UserID);

                if (updErr) {
                    await sendTelegramMessage(chatId, 'Error completing setup. Please try again or enter your Identifier.');
                } else {
                    await sendTelegramMessage(chatId, `Setup Complete.\n\nStaff ID: ${pendingAgent.StaffID}`);
                }
                return res.status(200).json({ status: 'setup_complete' });
            } else {
                // If they type anything else, unbind pending and treat as new Identifier attempt or prompt
                await supabase.from('Users').update({ TelegramChatID: null }).eq('UserID', pendingAgent.UserID);
                // Proceed downward to treat text as potential new Identifier
            }
        }

        // --- STEP 1: ONE-TIME SETUP (IF NOT LINKED) ---
        if (!linkedAgent) {
            if (!text || text === '/start') {
                await sendTelegramMessage(chatId, 'Welcome to HGH Sejahtera. Please enter your Identifier');
                return res.status(200).json({ status: 'prompt_identifier' });
            }

            // Match text against Username, Email, or StaffID
            const { data: matchedUsers, error: matchErr } = await supabase
                .from('Users')
                .select('UserID, StaffID, DisplayName, Username, Email, Role')
                .eq('Role', 'Agent')
                .eq('IsActive', true)
                .or(`Username.ilike.${text},Email.ilike.${text},StaffID.ilike.${text}`);

            if (matchErr || !matchedUsers || matchedUsers.length === 0) {
                await sendTelegramMessage(chatId, 'Welcome to HGH Sejahtera. Please enter your Identifier');
                return res.status(200).json({ status: 'invalid_identifier' });
            }

            const matchedAgent = matchedUsers[0];

            // Set temporary pending ID (-chatId) on this user
            await supabase
                .from('Users')
                .update({ TelegramChatID: pendingChatId })
                .eq('UserID', matchedAgent.UserID);

            await sendTelegramMessage(chatId, `User: ${matchedAgent.DisplayName || matchedAgent.StaffID}.\n\nReply YES to confirm.`);
            return res.status(200).json({ status: 'awaiting_confirmation' });
        }

        // --- STEP 3: LINKED AGENT UPLOADS AWB PDF ---
        if (msg.document) {
            const doc = msg.document;
            const fileName = doc.file_name || 'TikTok_AWB.pdf';

            if (!fileName.toLowerCase().endsWith('.pdf') && doc.mime_type !== 'application/pdf') {
                await sendTelegramMessage(chatId, 'Please upload a valid TikTok AWB PDF document.');
                return res.status(200).json({ status: 'invalid_file_type' });
            }

            try {
                // Download file from Telegram
                const fileUrl = await getTelegramFileUrl(doc.file_id);
                const fileRes = await fetch(fileUrl);
                const arrayBuffer = await fileRes.arrayBuffer();
                const pdfBuffer = Buffer.from(arrayBuffer);

                // Process PDF through central utility via dynamic import
                const { processAwbPdf } = await import('./_utils/processAwb.js');
                const resOutput = await processAwbPdf({
                    pdfBuffer,
                    fileName,
                    agentId: linkedAgent.UserID,
                    staffId: linkedAgent.StaffID,
                    supabase
                });

                await sendTelegramMessage(chatId, `${resOutput.totalOrders} orders imported.`);
                return res.status(200).json({ status: 'awb_processed', orders: resOutput.totalOrders });
            } catch (err) {
                console.error('Error processing PDF upload from Telegram:', err);
                await sendTelegramMessage(chatId, `Failed to process AWB PDF: ${err.message || 'Unknown error'}`);
                return res.status(200).json({ status: 'awb_error', error: err.message });
            }
        }

        // If linked but sent random text instead of PDF
        await sendTelegramMessage(chatId, 'Please upload your TikTok AWB PDF document.');
        return res.status(200).json({ status: 'awaiting_pdf' });

    } catch (error) {
        console.error('Webhook Top Level Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
