/* eslint-disable react-refresh/only-export-components -- Dedicated page entry, not a reusable module. */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '../Components/UI/Button.jsx';
import { Input } from '../Components/UI/Input.jsx';
import { APIConnection } from '../Pages/Settings/APIConnection.jsx';
import { useAuthStore } from './TikTokPageAuth.js';
import { useIdleTimeout } from '../Hooks/UseIdleTimeout.js';
import { usePreferences } from '../Hooks/UsePreferences.js';
import './TikTokPage.css';

function TikTokPage() {
    const Auth = useAuthStore();
    const [PIN, SetPIN] = useState('');
    const [Busy, SetBusy] = useState(false);
    const [ErrorText, SetErrorText] = useState('');
    const Timeout = usePreferences().pinTimeout;
    useIdleTimeout(Auth.lockApp, Timeout);
    useEffect(() => { useAuthStore.getState().initialize(); }, []);
    async function Unlock(Event) {
        Event.preventDefault();
        if (Busy) return;
        SetBusy(true); SetErrorText('');
        const Success = await Auth.unlockApp(PIN);
        SetPIN(''); SetBusy(false);
        if (!Success) SetErrorText('Unable to unlock. Check your PIN and try again.');
    }
    return <div className="min-h-screen bg-background text-foreground">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
            <div className="h-full max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between gap-4">
                <Button asChild variant="outline" className="min-h-11 gap-2 bg-white">
                    <a href="/Settings/Account" aria-label="Back to HGH Settings"><ArrowLeft aria-hidden="true" className="size-4" />Back</a>
                </Button>
                <span className="text-sm font-semibold text-gray-900">HGH Centre</span>
            </div>
        </header>
        <main>
        {Auth.isLoading ? <p role="status" className="max-w-5xl mx-auto p-6 text-sm text-muted-foreground">Checking your HGH account…</p>
            : !Auth.isAuthenticated ? <section className="max-w-lg mx-4 sm:mx-auto mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
                <h1 className="text-xl font-bold tracking-tight">API Connection</h1>
                <p role="status" className="text-sm text-muted-foreground">{Auth.AuthError || 'Sign in to HGH, then return to this page.'}</p>
                <div className="flex flex-wrap gap-3">
                    <Button asChild><a href="/login" target="_blank" rel="noopener noreferrer">Open HGH Login<span className="sr-only"> (new tab)</span></a></Button>
                    <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" className="size-4" />Refresh after login</Button>
                </div></section>
            : Auth.isLocked ? <form onSubmit={Unlock} className="max-w-sm mx-4 sm:mx-auto mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <h1 className="text-xl font-semibold">Unlock API Connection</h1>
                <label className="block text-sm font-medium">HGH PIN<Input autoFocus className="mt-2" type="password" inputMode="numeric"
                    autoComplete="off" maxLength={4} value={PIN} onChange={Event => SetPIN(Event.target.value.replace(/\D/g, ''))} /></label>
                <Button type="submit" disabled={Busy || PIN.length !== 4}>{Busy ? 'Checking…' : 'Unlock'}</Button>
                {ErrorText && <p role="alert" className="text-sm text-red-700">{ErrorText}</p>}
            </form> : <APIConnection Standalone />}
        </main>
    </div>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><TikTokPage /></BrowserRouter>);
