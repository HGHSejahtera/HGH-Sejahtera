import handler from './api/Proxy-PDF.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const req = {
        query: {
            url: 'Order Archive/TikTok/AGT001/2026/07/TikTokSeller-AGT001-585293998948058661-20260731-0948.pdf'
        }
    };

    let status = null;
    let jsonBody = null;
    let headers = {};
    
    const res = {
        status: (code) => {
            status = code;
            return res;
        },
        json: (data) => {
            jsonBody = data;
        },
        send: (buffer) => {
            console.log("Send called with buffer size:", buffer.length);
        },
        setHeader: (name, value) => {
            headers[name] = value;
        }
    };

    await handler(req, res);
    console.log("Status:", status);
    console.log("JSON:", jsonBody);
}
run();
