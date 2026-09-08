import { useEffect, useState, useCallback } from 'react';

export function useHardwareScanner(onScan, timeout = 50) {
    const [barcode, setBarcode] = useState('');
    const [lastKeystrokeTime, setLastKeystrokeTime] = useState(() => Date.now());

    const handleKeyDown = useCallback((e) => {
        // Ignore keydowns if user is explicitly typing in an input field (except if it's the intended scanner input field, but usually we listen globally)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const currentTime = Date.now();
        const timeDiff = currentTime - lastKeystrokeTime;

        // If time diff is longer than timeout (e.g. 50ms), it's likely a human typing, reset the buffer
        if (timeDiff > timeout) {
            setBarcode(e.key.length === 1 ? e.key : '');
        } else {
            // Append to barcode if it's a single character
            if (e.key.length === 1) {
                setBarcode(prev => prev + e.key);
            }
        }

        // Hardware scanners typically send an 'Enter' key at the end of the scan
        if (e.key === 'Enter') {
            if (barcode.length >= 3) { // Assuming a valid barcode is at least 3 chars
                onScan(barcode);
                setBarcode(''); // reset after successful scan
            }
        }

        setLastKeystrokeTime(currentTime);
    }, [barcode, lastKeystrokeTime, onScan, timeout]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
}
