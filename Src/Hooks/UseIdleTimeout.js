import { useEffect, useRef } from 'react';

// Default idle timeout: 3 minutes
const DEFAULT_IDLE_TIMEOUT = 3 * 60 * 1000;

export function useIdleTimeout(onIdle, timeoutMs = DEFAULT_IDLE_TIMEOUT) {
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (timeoutMs <= 0) return;

        const handleActivity = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                onIdle();
            }, timeoutMs);
        };

        // Initialize the first timer
        handleActivity();

        // Attach listeners for any user interaction
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('scroll', handleActivity, true);
        window.addEventListener('touchstart', handleActivity);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('scroll', handleActivity, true);
            window.removeEventListener('touchstart', handleActivity);
        };
    }, [onIdle, timeoutMs]);
}
