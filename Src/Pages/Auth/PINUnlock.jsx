import { useState, useEffect } from 'react';
import { useAuthStore } from '@/Hooks/UseAuth';
import { Delete, Loader2, AlertCircle, X } from 'lucide-react';

const NumpadBtn = ({ num, onClick, disabled }) => (
    <button 
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-20 h-20 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full text-2xl font-semibold flex items-center justify-center transition-colors backdrop-blur-sm disabled:opacity-50"
    >
        {num}
    </button>
);

export function PINUnlock() {
    const { user, unlockApp, isLocked, logout } = useAuthStore();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Reset state when it becomes locked (React recommended way to avoid effect cascades)
    const [prevLocked, setPrevLocked] = useState(isLocked);
    if (isLocked !== prevLocked) {
        setPrevLocked(isLocked);
        if (isLocked) {
            setPin('');
            setError('');
            setIsVerifying(false);
        }
    }

    // Handle physical keyboard input
    useEffect(() => {
        if (!isLocked) return;

        const handleKeyDown = (e) => {
            if (isVerifying) return;
            
            // Handle numbers
            if (/^[0-9]$/.test(e.key)) {
                handleNumber(e.key);
            }
            // Handle Backspace/Delete
            else if (e.key === 'Backspace' || e.key === 'Delete') {
                handleDelete();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLocked, isVerifying, pin]);

    // Auto-verify when 4 digits are entered
    useEffect(() => {
        if (pin.length === 4) {
            verifyPin();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin]);

    async function verifyPin() {
        setIsVerifying(true);
        setError('');
        
        const success = await unlockApp(pin);
        
        if (!success) {
            setError('Incorrect PIN. Please try again.');
            setPin('');
            setIsVerifying(false);
        }
    }

    function handleNumber(num) {
        if (pin.length < 4 && !isVerifying) {
            setPin(p => p + num);
            setError('');
        }
    }

    function handleDelete() {
        if (!isVerifying) {
            setPin(p => p.slice(0, -1));
            setError('');
        }
    }

    if (!isLocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
            
            <button 
                onClick={logout} 
                className="absolute top-6 right-6 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                title="Cancel & Logout"
            >
                <X className="w-8 h-8" />
            </button>
            
            {/* User Profile */}
            <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-4 border-4 border-indigo-900">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{user?.name || 'Staff'}</h2>
            </div>

            {/* PIN Dots */}
            <div className="flex gap-4 justify-center mb-8 h-6">
                {isVerifying ? (
                    <div className="flex items-center text-white gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Verifying...</span>
                    </div>
                ) : (
                    [0, 1, 2, 3].map((i) => (
                        <div 
                            key={i} 
                            className={`w-4 h-4 rounded-full transition-all duration-200 ${
                                pin.length > i ? 'bg-indigo-400 scale-110 shadow-[0_0_15px_rgba(129,140,248,0.5)]' : 'bg-white/20'
                            }`} 
                        />
                    ))
                )}
            </div>

            {/* Error Message */}
            <div className="h-8 mb-4">
                {error && (
                    <div className="flex items-center gap-1.5 text-red-400 text-sm font-medium animate-in shake">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <NumpadBtn key={num} num={num} onClick={() => handleNumber(num.toString())} disabled={isVerifying} />
                ))}
                <div className="flex items-center justify-center"></div>
                <NumpadBtn num="0" onClick={() => handleNumber('0')} disabled={isVerifying} />
                <button 
                    onClick={handleDelete}
                    disabled={isVerifying || pin.length === 0}
                    className="w-20 h-20 text-white/60 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors disabled:opacity-20"
                >
                    <Delete className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
}
