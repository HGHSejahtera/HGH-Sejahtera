import { useState } from 'react';

// TODO: Replace '#' with actual iCloud Shortcut link once created
const SHORTCUT_LINK = '#';

export function IOSShortcutDialog() {
    const [isPWA] = useState(() => {
        if (typeof window !== 'undefined') {
            return (
                window.matchMedia('(display-mode: standalone)').matches ||
                window.navigator.standalone === true
            );
        }
        return false;
    });

    // Completely hide the banner if they are in Safari browser
    if (!isPWA) return null;

    return (
        <a
            href={SHORTCUT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between text-sm shadow-sm hover:shadow-md transition-shadow no-underline"
        >
            <div className="flex items-center space-x-3.5">
                <img 
                    src="/Logo/Shortcuts.png" 
                    alt="iOS Shortcuts" 
                    className="h-10 w-10 shrink-0 shadow-sm rounded-lg"
                />
                <div>
                    <p className="font-semibold text-gray-900">TikTok Direct Share</p>
                    <p className="text-gray-500 text-xs mt-0.5">Enable 1-click AWB upload</p>
                </div>
            </div>
            <span className="text-blue-600 font-medium text-sm shrink-0 ml-3">Install →</span>
        </a>
    );
}
