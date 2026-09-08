import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function BarcodeScanner({ onScanSuccess, onScanError }) {
    const scannerRef = useRef(null);

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );

        scanner.render(
            (decodedText) => {
                if (onScanSuccess) {
                    onScanSuccess(decodedText);
                    // Prevent multiple rapid fires
                    scanner.pause();
                    setTimeout(() => scanner.resume(), 1500);
                }
            },
            (error) => {
                if (onScanError) onScanError(error);
            }
        );

        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }, [onScanSuccess, onScanError]);

    return (
        <div className="w-full max-w-sm mx-auto overflow-hidden rounded-lg shadow-sm border">
            <div id="reader" className="w-full" />
        </div>
    );
}
