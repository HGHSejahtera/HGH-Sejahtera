import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export function AccountActivation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, isLoading } = useAuthStore();
    
    // Countdown state for auto-redirect
    const [countdown, setCountdown] = useState(10);
    const [isChecking, setIsChecking] = useState(false);
    
    // Parse errors synchronously during render (from both Implicit Flow hash and PKCE search params)
    // Fallback to sessionStorage in case supabase-js has already stripped the URL
    const searchString = location.search || sessionStorage.getItem('hgh_auth_search') || '';
    const hashString = location.hash || sessionStorage.getItem('hgh_auth_hash') || '';
    
    const searchParams = new URLSearchParams(searchString);
    const hashParams = new URLSearchParams(hashString.replace('#', '?'));
    const hashError = hashParams.get('error') || searchParams.get('error');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
    
    // Capture auth token presence on mount
    const [hadAuthTokens] = useState(() => 
        hashString.includes('access_token=') || searchString.includes('code=')
    );

    // Clean up sessionStorage to prevent stale data on future visits
    useEffect(() => {
        sessionStorage.removeItem('hgh_auth_search');
        sessionStorage.removeItem('hgh_auth_hash');
    }, []);
    
    const isPreview = searchParams.get('preview');
    const previewUser = { name: 'Mohamad Farizulhilmy Adzhar Amir', role: 'Developer' };
    
    // Derived state
    let status = 'processing';
    let errorMsg = '';
    let displayUser = user;

    if (isPreview) {
        if (isPreview === 'error') {
            status = 'error';
            errorMsg = 'Invalid or expired activation link. (Preview)';
        } else if (isPreview === 'pending') {
            status = 'success';
            displayUser = { ...previewUser, role: 'Pending' };
        } else if (isPreview === 'success') {
            status = 'success';
            displayUser = { ...previewUser, role: 'Staff' };
        } else if (isPreview === 'management') {
            status = 'success-management';
            displayUser = { ...previewUser, role: 'Developer' };
        }
    } else if (hashError) {
        status = 'error';
        errorMsg = errorDescription ? errorDescription.replace(/\+/g, ' ') : 'Invalid or expired activation link.';
    } else if (!isLoading) {
        if (isAuthenticated && ['Founder', 'Manager', 'Developer'].includes(user?.role)) {
            status = 'success-management';
        } else if (user?.role === 'Pending' || ['Staff', 'Agent'].includes(user?.role)) {
            status = 'success';
        }
    }

    const handleProceed = useCallback(() => {
        if (displayUser?.role === 'Agent') {
            navigate('/agent');
        } else {
            navigate('/dashboard');
        }
    }, [displayUser, navigate]);

    const [checkFeedback, setCheckFeedback] = useState("");

    const handleCheckStatus = async () => {
        setIsChecking(true);
        setCheckFeedback("");
        try {
            if (isPreview) {
                // Simulate network request for preview mode
                await new Promise(resolve => setTimeout(resolve, 800));
                setCheckFeedback("This is a preview. In the real app, this checks the database.");
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Re-fetch profile to check if role changed from Pending to Staff/Agent
                await useAuthStore.getState().handleSession(session);
                
                // If after re-fetching, they are still pending:
                if (useAuthStore.getState().user?.role === 'Pending') {
                    setCheckFeedback("Status checked: Your account is still pending approval.");
                }
            } else {
                setCheckFeedback("Status checked: No active session found.");
            }
        } finally {
            setTimeout(() => setIsChecking(false), 600); // Brief UX delay to show loading state
        }
    };

    useEffect(() => {
        if (isPreview) return; // Disable auto-redirects during preview mode

        // Handle auto-redirect countdown for management roles
        if (status === 'success-management') {
            if (countdown > 0) {
                const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
                return () => clearTimeout(timer);
            } else {
                handleProceed();
            }
        }
        
        // Fallback for missing hash/user
        // Only redirect if there were NO auth tokens on mount AND no user
        if (status === 'processing' && !isLoading && !hashError && !user && !hadAuthTokens) {
            navigate('/login');
        }
    }, [status, countdown, isLoading, hashError, user, hadAuthTokens, navigate, handleProceed, isPreview]);

    // Safety timeout: 15 seconds to prevent indefinite loading
    useEffect(() => {
        if (!hadAuthTokens || isPreview) return;
        const timeout = setTimeout(() => {
            // Note: This relies on component re-rendering to catch stuck status.
            // A more robust way would be to dispatch a state update, but for this specific component
            // simply redirecting to login on timeout is safer.
            if (status === 'processing') {
                navigate('/login?error=timeout');
            }
        }, 15000);
        return () => clearTimeout(timeout);
    }, [hadAuthTokens, status, navigate, isPreview]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
                
                {status === 'processing' && (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Activating Account</h2>
                        <p className="text-zinc-400">Please wait while we securely verify your credentials...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <div className="mx-auto size-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-500/5">
                            <AlertCircle className="size-8 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Activation Failed</h2>
                        <p className="text-zinc-400 mb-8">{errorMsg}</p>
                        <Button 
                            onClick={() => navigate('/login')}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 rounded-xl"
                        >
                            Return to Login
                        </Button>
                    </div>
                )}

                {(status === 'success' || status === 'success-management') && (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <div className="mx-auto size-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-500/5">
                            <CheckCircle2 className="size-8 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Email Successfully Verified</h2>
                        
                        {status === 'success-management' && (
                            <div className="space-y-6">
                                <p className="text-zinc-400 leading-relaxed mb-6">
                                    Welcome aboard, <span className="text-white font-medium">{displayUser?.name}</span>. Your <span className="text-indigo-400 font-semibold">{displayUser?.role}</span> account is now fully active.
                                </p>
                                
                                <div className="space-y-3">
                                    <Button 
                                        onClick={handleProceed}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 rounded-xl"
                                    >
                                        Enter Workspace
                                    </Button>
                                    
                                    <p className="text-xs text-zinc-500">
                                        You will be automatically redirected in {countdown} seconds...
                                    </p>
                                </div>
                            </div>
                        )}

                        {status === 'success' && displayUser?.role === 'Pending' && (
                            <>
                                <p className="text-zinc-400 mb-8 leading-relaxed text-balance mx-auto max-w-sm">
                                    Your email has been verified. However, your account is currently <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-400/10 rounded-md">Pending</span> approval from the HQ Management team.
                                </p>
                                <div className="space-y-3">
                                    <Button 
                                        onClick={handleCheckStatus}
                                        disabled={isChecking}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 rounded-xl"
                                    >
                                        {isChecking ? <Loader2 className="size-5 animate-spin mx-auto" /> : "Check Approval Status"}
                                    </Button>
                                    
                                    {checkFeedback && (
                                        <p className="text-amber-400 text-sm animate-in fade-in duration-300">
                                            {checkFeedback}
                                        </p>
                                    )}

                                    <Button 
                                        onClick={async () => {
                                            await useAuthStore.getState().logout();
                                            navigate('/login');
                                        }}
                                        disabled={isChecking}
                                        className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 hover:border-zinc-600 transition-all duration-300 rounded-xl shadow-lg"
                                    >
                                        Sign Out & Return
                                    </Button>
                                </div>
                            </>
                        )}

                        {status === 'success' && ['Staff', 'Agent'].includes(displayUser?.role) && (
                            <div className="space-y-6">
                                <p className="text-zinc-400 leading-relaxed mb-6">
                                    Your account is fully verified and active. You have been provisioned with the <span className="text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-500/10 rounded-md mx-1">{displayUser.role}</span> role.
                                </p>
                                <Button 
                                    onClick={handleProceed}
                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 rounded-xl"
                                >
                                    Enter Workspace
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
