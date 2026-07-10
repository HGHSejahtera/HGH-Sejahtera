import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DownloadCloud, Info, Copy, CheckCircle2, CheckCircle, Apple } from 'lucide-react';

export function IOSShortcutDialog() {
    const { user } = useAuthStore();
    const [token, setToken] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Check if the agent has already completed the setup
    const [isSetupComplete, setIsSetupComplete] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('iosShortcutComplete') === 'true';
        }
        return false;
    });

    useEffect(() => {
        
        const fetchToken = async () => {
            if (!user?.id) return;
            const { data, error } = await supabase
                .from('Users')
                .select('UploadToken')
                .eq('UserID', user.id)
                .single();
            
            if (!error && data?.UploadToken) {
                setToken(data.UploadToken);
            }
        };
        fetchToken();
    }, [user?.id]);

    const handleCopy = () => {
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleMarkComplete = () => {
        localStorage.setItem('iosShortcutComplete', 'true');
        setIsSetupComplete(true);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                {isSetupComplete ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-green-950 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3.5 mb-3 sm:mb-0">
                            <div className="bg-green-600 text-white p-2.5 rounded-lg shrink-0 shadow-sm">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">iOS Shortcut Ready</p>
                                <p className="text-gray-600 text-xs mt-0.5">You can now share AWBs directly from TikTok Seller.</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="bg-white hover:bg-green-50 text-green-700 border-green-200">View Setup</Button>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-blue-950 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3.5 mb-3 sm:mb-0">
                            <div className="bg-blue-600 text-white p-2.5 rounded-lg shrink-0 shadow-sm">
                                <Apple className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">iPhone User? Get iOS Shortcut</p>
                                <p className="text-gray-600 text-xs mt-0.5">Enable direct sharing from TikTok to HGH app in 3 taps</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200">Setup Now</Button>
                    </div>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>iOS Direct Share Setup</DialogTitle>
                    <DialogDescription>
                        Complete this 1-time setup to share AWBs directly from TikTok to HGH.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                    <div className="bg-gray-50 p-4 rounded-lg border text-sm space-y-3">
                        <div className="flex gap-2">
                            <span className="font-bold text-gray-700">1.</span>
                            <p>Copy your unique Upload Token below. You will need to paste this in the next step.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 bg-white border px-3 py-2 rounded-md font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                                {token || 'Loading...'}
                            </code>
                            <Button size="icon" variant={copied ? "default" : "outline"} onClick={handleCopy} disabled={!token} className={copied ? "bg-green-600 hover:bg-green-700" : ""}>
                                {copied ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border text-sm space-y-3">
                        <div className="flex gap-2">
                            <span className="font-bold text-gray-700">2.</span>
                            <p>Download the iOS Shortcut and paste the token when prompted.</p>
                        </div>
                        <Button className="w-full mt-2" variant="outline" asChild>
                            <a href="#" target="_blank" rel="noopener noreferrer">
                                <DownloadCloud className="w-4 h-4 mr-2" /> Download HGH Shortcut
                            </a>
                        </Button>
                    </div>

                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex gap-2 items-start mt-4">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>After setup, open an AWB in TikTok Seller, tap Share, and select "HGH Upload". Then open this page to process it automatically.</p>
                    </div>

                    {!isSetupComplete && (
                        <Button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white" onClick={handleMarkComplete}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> I have completed the setup
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
