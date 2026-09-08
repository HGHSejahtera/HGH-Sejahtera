import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock } from 'lucide-react';
import { Button } from '@/Components/UI/Button';
import { useAuthStore } from '@/Hooks/UseAuth';
import { supabase } from '@/Lib/Supabase';

export function PendingApproval() {
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(false);
    const [checkFeedback, setCheckFeedback] = useState("");

    const handleCheckStatus = async () => {
        setIsChecking(true);
        setCheckFeedback("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await useAuthStore.getState().handleSession(session);
                
                // If they are still pending after re-fetching
                if (useAuthStore.getState().user?.role === 'Pending') {
                    setCheckFeedback("Status checked: Your account is still pending approval.");
                } else {
                    // If they are approved, useAuthStore handles the redirection via App.jsx
                    // but we can manually push them if needed. Usually App.jsx auto-routes when isAuthenticated becomes true.
                    navigate('/dashboard');
                }
            } else {
                setCheckFeedback("Status checked: No active session found.");
            }
        } finally {
            setTimeout(() => setIsChecking(false), 600);
        }
    };

    const handleSignOut = async () => {
        await useAuthStore.getState().logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
                    
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                            <div className="size-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center relative">
                                <Clock className="size-8 text-amber-500" />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-4">
                        Account Pending Approval
                    </h2>

                    <p className="text-zinc-400 mb-8 leading-relaxed text-balance mx-auto max-w-sm">
                        Your account is currently <span className="text-amber-400 font-semibold px-2 py-0.5 bg-amber-400/10 rounded-md">Pending</span> approval from the HQ Management team. You will be able to access the system once your role has been assigned.
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
                            onClick={handleSignOut}
                            disabled={isChecking}
                            className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 hover:border-zinc-600 transition-all duration-300 rounded-xl shadow-lg"
                        >
                            Sign Out & Return
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
