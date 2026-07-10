import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DownloadCloud, Info, Copy, CheckCircle2 } from 'lucide-react';

export function IOSShortcutDialog() {
    const { user } = useAuthStore();
    const [token, setToken] = useState('');
    const [copied, setCopied] = useState(false);

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

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-blue-950 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-3.5 mb-3 sm:mb-0">
                        <div className="bg-blue-600 text-white p-2.5 rounded-lg shrink-0 shadow-sm">
                            <DownloadCloud className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">iPhone User? Get iOS Shortcut</p>
                            <p className="text-gray-600 text-xs mt-0.5">Enable direct sharing from TikTok to HGH app</p>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" className="bg-white hover:bg-blue-50">Setup Now</Button>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>iOS Direct Share Setup</DialogTitle>
                    <DialogDescription>
                        Set up the iOS Shortcut to share AWBs directly to HGH in 3 taps.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                    <div className="bg-gray-50 p-4 rounded-lg border text-sm space-y-3">
                        <div className="flex gap-2">
                            <span className="font-bold text-gray-700">1.</span>
                            <p>Download the iOS Shortcut template (Requires Apple Shortcuts app).</p>
                        </div>
                        <Button className="w-full mt-2" variant="outline" asChild>
                            <a href="#" target="_blank" rel="noopener noreferrer">
                                Download HGH Shortcut
                            </a>
                        </Button>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border text-sm space-y-3">
                        <div className="flex gap-2">
                            <span className="font-bold text-gray-700">2.</span>
                            <p>Copy your unique Upload Token and paste it when installing the Shortcut.</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <code className="flex-1 bg-white border px-3 py-2 rounded-md font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                                {token || 'Loading...'}
                            </code>
                            <Button size="icon" variant="outline" onClick={handleCopy} disabled={!token}>
                                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex gap-2 items-start mt-4">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>After setup, open an AWB in TikTok Seller, tap Share, and select "HGH Upload". Then open this page to process it automatically.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
