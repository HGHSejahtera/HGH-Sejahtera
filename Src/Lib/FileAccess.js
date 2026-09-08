import { supabase } from './Supabase.js';

const FileEndpoints = new Set(['/api/generate-r2-url', '/api/get-r2-download-url', '/api/proxy-pdf', '/api/stamp-awb']);

export async function FetchFileAPI(Path, Options = {}) {
    // Never attach a Supabase token to R2 signed URLs or arbitrary origins.
    const Target = new URL(Path, window.location.origin);
    if (Target.origin !== window.location.origin || Target.username || Target.password || !FileEndpoints.has(Target.pathname)) {
        throw new Error('Invalid file API destination.');
    }
    const { data: SessionData, error: SessionError } = await supabase.auth.getSession();
    if (SessionError || !SessionData?.session?.access_token) throw new Error('Please sign in to access files.');
    const HeadersValue = new Headers(Options.headers);
    HeadersValue.set('Authorization', `Bearer ${SessionData.session.access_token}`);
    return fetch(Target.href, { ...Options, headers: HeadersValue, redirect: 'error', cache: 'no-store' });
}

export async function FetchAuthorizedPDF(Reference, Signal) {
    const Response = await FetchFileAPI(`/api/proxy-pdf?url=${encodeURIComponent(Reference)}`, { signal: Signal });
    if (!Response.ok) {
        const Data = await Response.json().catch(() => ({}));
        throw new Error(Data.error || 'Unable to load this PDF.');
    }
    if (!Response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Invalid PDF response.');
    return Response.blob();
}

export function GetPDFFileName(Reference) {
    try {
        return decodeURIComponent(String(Reference).split('?')[0].split('/').at(-1))
            .replace(/[\\/:*?"<>|]/g, '_') || 'AWB.pdf';
    } catch { return 'AWB.pdf'; }
}

export function DownloadPDFBlob(BlobValue, FileName) {
    const ObjectURL = URL.createObjectURL(BlobValue);
    const Link = document.createElement('a');
    Link.href = ObjectURL;
    Link.download = FileName;
    document.body.appendChild(Link);
    Link.click();
    Link.remove();
    // Give mobile browsers time to accept the download before releasing bytes.
    setTimeout(() => URL.revokeObjectURL(ObjectURL), 60000);
}

export function OpenPDFBlob(BlobValue) {
    const PDFWindow = window.open('about:blank', '_blank');
    if (!PDFWindow) throw new Error('Allow popups to open the PDF.');
    PDFWindow.opener = null;
    const ObjectURL = URL.createObjectURL(BlobValue);
    try {
        PDFWindow.location.replace(ObjectURL);
    } catch (ErrorValue) {
        URL.revokeObjectURL(ObjectURL);
        PDFWindow.close();
        throw ErrorValue;
    }
    // Keep a separate URL alive after the modal closes, until the PDF tab closes.
    const Timer = setInterval(() => {
        if (PDFWindow.closed) {
            URL.revokeObjectURL(ObjectURL);
            clearInterval(Timer);
        }
    }, 1000);
}
