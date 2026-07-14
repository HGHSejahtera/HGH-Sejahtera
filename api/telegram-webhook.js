import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function for Telegram Bot Webhook
// NOTE: No `export const config = { ... }` as per AGENTS.md rule to prevent Hobby tier errors.
// NOTE: Dynamic await import() is used for PDF utilities to prevent top-level cold boot crashes (`FUNCTION_INVOCATION_FAILED`).

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendTelegramMessage(chatId, text, inlineKeyboard = null) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('Error: TELEGRAM_BOT_TOKEN is missing');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: text
    };
    if (inlineKeyboard) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
    }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error(`Telegram API error status ${res.status}: ${errBody}`);
        }
    } catch (e) {
        console.error('Error sending Telegram message:', e);
    }
}

async function editTelegramMessageText(chatId, messageId, text, inlineKeyboard = null) {
    if (!TELEGRAM_BOT_TOKEN || !chatId || !messageId) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
    const body = {
        chat_id: chatId,
        message_id: messageId,
        text: text
    };
    if (inlineKeyboard) {
        body.reply_markup = { inline_keyboard: inlineKeyboard };
    }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error(`Telegram editMessageText error status ${res.status}: ${errBody}`);
        }
    } catch (e) {
        console.error('Error editing Telegram message:', e);
    }
}

async function answerTelegramCallbackQuery(callbackQueryId, text = '') {
    if (!TELEGRAM_BOT_TOKEN || !callbackQueryId) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
        });
    } catch (e) {
        console.error('Error answering callback query:', e);
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

const DASHBOARD_BUTTONS = [
    [
        { text: 'Records', callback_data: 'records' },
        { text: 'Upload', callback_data: 'upload' }
    ],
    [
        { text: 'Log Out', callback_data: 'logout' }
    ]
];

const BACK_BUTTON = [
    [
        { text: 'Back', callback_data: 'cancel_link' }
    ]
];

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
        if (!update) {
            return res.status(200).json({ status: 'ignored' });
        }

        // --- HANDLER 1: BUTTON CALLBACK QUERIES ---
        if (update.callback_query) {
            const cb = update.callback_query;
            const chatId = cb.message?.chat?.id;
            const messageId = cb.message?.message_id;
            const data = cb.data;

            await answerTelegramCallbackQuery(cb.id);

            if (!chatId) {
                return res.status(200).json({ status: 'no_chat_id' });
            }

            if (data === 'cancel_link' || data === 'unlink_account' || data === 'logout') {
                // Call SECURITY DEFINER RPC to reset both positive and negative chatId bindings
                await supabase.rpc('telegram_bot_unlink_agent', { p_chat_id: chatId });
                
                if (messageId) {
                    await editTelegramMessageText(chatId, messageId, 'Enter Identifier:');
                } else {
                    await sendTelegramMessage(chatId, 'Enter Identifier:');
                }
                return res.status(200).json({ status: data });
            }

            if (data === 'upload_awb' || data === 'upload') {
                await sendTelegramMessage(chatId, 'Forward or upload any TikTok AWB PDF file directly into this chat.');
                return res.status(200).json({ status: 'guide_sent' });
            }

            if (data === 'my_uploads' || data === 'records') {
                const { data: agent } = await supabase
                    .from('Users')
                    .select('UserID, StaffID, DisplayName')
                    .eq('TelegramChatID', chatId)
                    .eq('IsActive', true)
                    .single();

                if (agent) {
                    const { count } = await supabase
                        .from('PendingAWBUploads')
                        .select('*', { count: 'exact', head: true })
                        .eq('UserID', agent.UserID);
                    
                    await sendTelegramMessage(chatId, `Records: ${count || 0} PDF files.`, DASHBOARD_BUTTONS);
                } else {
                    await sendTelegramMessage(chatId, 'Enter Identifier:');
                }
                return res.status(200).json({ status: 'stats_sent' });
            }

            return res.status(200).json({ status: 'unknown_callback' });
        }

        // --- HANDLER 2: STANDARD MESSAGES ---
        if (!update.message) {
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
            .maybeSingle();

        // Check if chatId is currently pending password confirmation (negative ID = -chatId)
        const pendingChatId = -Math.abs(chatId);
        const { data: pendingAgent } = await supabase
            .from('Users')
            .select('UserID, StaffID, DisplayName, Email, TelegramChatID, Role')
            .eq('TelegramChatID', pendingChatId)
            .eq('IsActive', true)
            .maybeSingle();

        // --- COMMANDS: /relink or /logout ---
        if (text === '/relink' || text === '/logout') {
            await supabase.rpc('telegram_bot_unlink_agent', { p_chat_id: chatId });
            await sendTelegramMessage(chatId, 'Enter Identifier:');
            return res.status(200).json({ status: 'unlinked' });
        }

        // --- STEP 3: LINKED AGENT UPLOADS AWB PDF OR CHATS ---
        if (linkedAgent) {
            if (msg.document) {
                const doc = msg.document;
                const fileName = doc.file_name || 'TikTok_AWB.pdf';

                if (!fileName.toLowerCase().endsWith('.pdf') && doc.mime_type !== 'application/pdf') {
                    await sendTelegramMessage(chatId, 'Please upload a valid TikTok AWB PDF document.', DASHBOARD_BUTTONS);
                    return res.status(200).json({ status: 'invalid_file_type' });
                }

                try {
                    const fileUrl = await getTelegramFileUrl(doc.file_id);
                    const fileRes = await fetch(fileUrl);
                    const arrayBuffer = await fileRes.arrayBuffer();
                    const pdfBuffer = Buffer.from(arrayBuffer);

                    const { processAwbPdf } = await import('./_utils/processAwb.js');
                    const resOutput = await processAwbPdf({
                        pdfBuffer,
                        fileName,
                        agentId: linkedAgent.UserID,
                        staffId: linkedAgent.StaffID,
                        supabase
                    });

                    await sendTelegramMessage(chatId, `${resOutput.totalOrders} orders imported.`, DASHBOARD_BUTTONS);
                    return res.status(200).json({ status: 'awb_processed', orders: resOutput.totalOrders });
                } catch (err) {
                    console.error('Error processing PDF upload from Telegram:', err);
                    await sendTelegramMessage(chatId, `Failed to process AWB PDF: ${err.message || 'Unknown error'}`, DASHBOARD_BUTTONS);
                    return res.status(200).json({ status: 'awb_error', error: err.message });
                }
            }

            // If command or text sent while linked
            const setupText = `Setup Complete\nFull Name: ${linkedAgent.DisplayName || linkedAgent.StaffID}\nRole: ${linkedAgent.Role || 'Agent'}\nID: ${linkedAgent.StaffID || 'N/A'}`;
            await sendTelegramMessage(chatId, setupText, DASHBOARD_BUTTONS);
            return res.status(200).json({ status: 'dashboard_displayed' });
        }

        // --- STEP 2: PENDING AGENT SUBMITS ACCOUNT PASSWORD ---
        if (pendingAgent) {
            if (!text || text === '/start' || text === '/cancel') {
                await supabase.rpc('telegram_bot_unlink_agent', { p_chat_id: chatId });
                await sendTelegramMessage(chatId, 'Enter Identifier:');
                return res.status(200).json({ status: 'reset' });
            }

            // Verify password using official Supabase Auth signInWithPassword (same as /login)
            const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
                email: pendingAgent.Email,
                password: text
            });

            if (authErr || !authData?.user) {
                await sendTelegramMessage(chatId, 'Incorrect Password. Enter Password:', BACK_BUTTON);
                return res.status(200).json({ status: 'invalid_password' });
            }

            // Password is correct -> link agent account using SECURITY DEFINER RPC
            const { error: linkErr } = await supabase.rpc('telegram_bot_link_agent', {
                p_user_id: pendingAgent.UserID,
                p_chat_id: chatId
            });

            if (linkErr) {
                // Fallback direct update if RPC somehow fails
                await supabase.from('Users').update({ TelegramChatID: chatId }).eq('UserID', pendingAgent.UserID);
            }

            const setupText = `Setup Complete\nFull Name: ${pendingAgent.DisplayName || pendingAgent.StaffID}\nRole: ${pendingAgent.Role || 'Agent'}\nID: ${pendingAgent.StaffID || 'N/A'}`;
            await sendTelegramMessage(chatId, setupText, DASHBOARD_BUTTONS);
            return res.status(200).json({ status: 'setup_complete' });
        }

        // --- STEP 1: ONE-TIME SETUP IDENTIFIER ENTRY ---
        if (!text || text === '/start') {
            await sendTelegramMessage(chatId, 'Enter Identifier:');
            return res.status(200).json({ status: 'prompt_identifier' });
        }

        // Call SECURITY DEFINER RPC to match text against Username, Email, or StaffID and set pending (-chatId)
        const { data: pendingRes, error: pendingErr } = await supabase.rpc('telegram_bot_set_pending', {
            p_identifier: text,
            p_chat_id: chatId
        });

        if (pendingErr || !pendingRes) {
            await sendTelegramMessage(chatId, 'Enter Identifier:');
            return res.status(200).json({ status: 'invalid_identifier' });
        }

        // User matched cleanly, now prompt for password with Back button
        await sendTelegramMessage(chatId, 'Enter Password:', BACK_BUTTON);
        return res.status(200).json({ status: 'awaiting_password' });

    } catch (error) {
        console.error('Webhook Top Level Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

