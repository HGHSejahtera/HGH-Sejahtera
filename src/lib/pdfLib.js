/**
 * Lazy-load pdf-lib from pre-built browser bundle (bypasses Vite/Rolldown bundler).
 * This avoids TDZ errors caused by Rolldown's ES module processing of pdf-lib.
 * The pre-built UMD file is served from /pdf-lib.min.js in the public folder.
 */

let PdfLibPromise = null;

export function LoadPdfLib() {
    if (PdfLibPromise) return PdfLibPromise;

    PdfLibPromise = new Promise((Resolve, Reject) => {
        // Already loaded (e.g. from a previous call that completed)
        if (window.PDFLib) {
            Resolve(window.PDFLib);
            return;
        }

        const Script = document.createElement('script');
        Script.src = '/pdf-lib.min.js';
        Script.onload = () => {
            if (window.PDFLib) {
                Resolve(window.PDFLib);
            } else {
                Reject(new Error('pdf-lib loaded but PDFLib global not found.'));
            }
        };
        Script.onerror = () => {
            PdfLibPromise = null; // Allow retry
            Reject(new Error('Failed to load pdf-lib script.'));
        };
        document.head.appendChild(Script);
    });

    return PdfLibPromise;
}
