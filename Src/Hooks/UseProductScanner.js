import { useEffect, useRef } from 'react';
import { CreateProductScanner } from '@/Lib/ProductScanner';

export function useProductScanner(Enabled, ReadSnapshot, OnScan) {
    const Callbacks = useRef({ ReadSnapshot, OnScan });
    useEffect(() => { Callbacks.current = { ReadSnapshot, OnScan }; }, [ReadSnapshot, OnScan]);
    useEffect(() => {
        if (!Enabled) return;
        const Scanner = CreateProductScanner(() => Callbacks.current.ReadSnapshot(),
            (Code, Snapshot) => Callbacks.current.OnScan(Code, Snapshot));
        window.addEventListener('keydown', Scanner.KeyDown, true);
        window.addEventListener('pointerdown', Scanner.Reset, true);
        window.addEventListener('blur', Scanner.Reset);
        return () => {
            window.removeEventListener('keydown', Scanner.KeyDown, true);
            window.removeEventListener('pointerdown', Scanner.Reset, true);
            window.removeEventListener('blur', Scanner.Reset);
        };
    }, [Enabled]);
}
