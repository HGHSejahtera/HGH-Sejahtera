import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertCircle, ExternalLink, X } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use CDN to ensure the worker version perfectly matches the loaded pdfjs API version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function AwbPdfViewer({ url, open, onOpenChange }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [viewport, setViewport] = useState({
        w: window.innerWidth,
        h: window.innerHeight,
    });

    // Track viewport size for responsive PDF scaling
    useEffect(() => {
        const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Reset state when dialog opens or url changes
    useEffect(() => {
        if (open) {
            queueMicrotask(() => {
                setLoading(true);
                setError(false);
                setPageNumber(1);
                setNumPages(null);
            });
        }
    }, [url, open]);

    // Close on Escape key (since we're not using Radix Dialog anymore)
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onOpenChange(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onOpenChange]);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setPageNumber(1);
        setLoading(false);
        setError(false);
    }

    function onDocumentLoadError() {
        setLoading(false);
        setError(true);
    }

    const handleOpen = () => window.open(url ? `/api/proxy-pdf?url=${encodeURIComponent(url)}` : '', '_blank');
    const handleClose = () => onOpenChange(false);

    if (!open) return null;

    // On mobile (portrait): constrain by WIDTH so PDF fits horizontally
    // On desktop (landscape): constrain by HEIGHT so PDF fits vertically
    // react-pdf auto-calculates the other dimension from the PDF's aspect ratio
    const isMobile = viewport.w < 768;
    const pageProps = isMobile
        ? { width: viewport.w * 0.92 }
        : { height: viewport.h * 0.88 };

    return createPortal(
        <div className="fixed inset-0 z-50 animate-in fade-in-0 duration-150">
            {/* Overlay — matches current Shadcn dialog overlay */}
            <div
                className="absolute inset-0 bg-black/10 backdrop-blur-xs"
                onClick={handleClose}
            />

            {/* PDF Container — centered, pointer-events only on PDF itself */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto">

                    {/* Loading State */}
                    {loading && !error && (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                            <p className="font-medium text-sm">Loading AWB...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="flex flex-col items-center justify-center text-red-400 max-w-sm text-center px-4">
                            <AlertCircle className="w-10 h-10 mb-3" />
                            <p className="font-medium mb-1 text-sm">Failed to load PDF.</p>
                            <p className="text-xs opacity-70 mb-4">The PDF may be corrupted or cannot be fetched.</p>
                            <button
                                onClick={handleOpen}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-full flex items-center transition-colors font-medium"
                            >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Open PDF
                            </button>
                        </div>
                    )}

                    {/* PDF Document — relative container for anchoring X and Open buttons */}
                    {url && !error && (
                        <div className={`relative ${loading ? 'hidden' : 'block'}`}>
                            {/* X Button — top-right corner of PDF */}
                            <button
                                onClick={handleClose}
                                className="absolute top-2 right-2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>

                            <Document
                                file={`/api/proxy-pdf?url=${encodeURIComponent(url)}`}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    {...pageProps}
                                />
                            </Document>

                            {/* Open Button — bottom-left corner of PDF */}
                            <button
                                onClick={handleOpen}
                                className="absolute bottom-2 left-2 z-10 bg-black/40 hover:bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-none transition-colors backdrop-blur-sm flex items-center gap-1.5"
                                title="Open in new tab"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Open
                            </button>

                            {/* Pagination — bottom-right, only when more than 1 page */}
                            {numPages > 1 && (
                                <div className="absolute bottom-2 right-2 z-10 bg-black/40 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
                                    {pageNumber}/{numPages}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
