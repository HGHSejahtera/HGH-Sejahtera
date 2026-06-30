import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTabs } from './Settings';
import { User, KeyRound, Loader2, CheckCircle2, AlertCircle, ChevronDown, LayoutGrid, Mail } from 'lucide-react';

export function AccountSettings() {
    const { user } = useAuthStore();
    const { pinTimeout, setPinTimeout } = usePreferences();
    const [profile, setProfile] = useState({ staffId: '', username: '', email: '' });
    const [hasPin, setHasPin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Status states
    const [usernameStatus, setUsernameStatus] = useState('');
    const [emailStatus, setEmailStatus] = useState('');
    const [passwordStatus, setPasswordStatus] = useState('');
    const [pinStatus, setPinStatus] = useState('');

    // Accordion State
    const [expandedOption, setExpandedOption] = useState(null); // 'password' | 'pin' | 'username' | 'email' | 'staffid' | null
    const [isEditingPin, setIsEditingPin] = useState(false);
    const [isEditingPassword, setIsEditingPassword] = useState(false);

    // PIN state (Windows 11 Modal Style)
    const [oldPin, setOldPin] = useState('');
    const [newPinStr, setNewPinStr] = useState('');
    const [confirmPinStr, setConfirmPinStr] = useState('');

    // Password state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            const { data, error } = await supabase
                .from('Users')
                .select('StaffID, Username, Email, PINHash')
                .eq('UserID', user.id)
                .single();
                
            if (!error && data) {
                setProfile({ staffId: data.StaffID || '', username: data.Username || '', email: data.Email || '' });
                setHasPin(!!data.PINHash);
            }
            setIsLoading(false);
        };

        if (user?.id) {
            fetchProfile();
        }
    }, [user?.id]);

    const handleUpdateUsername = async () => {
        setUsernameStatus('loading');
        const { error } = await supabase
            .from('Users')
            .update({ Username: profile.username })
            .eq('UserID', user.id);
            
        if (error) {
            console.error(error);
            if (error.code === '23505') {
                setUsernameStatus('taken');
            } else {
                setUsernameStatus('error');
            }
        } else {
            setUsernameStatus('success');
            setTimeout(() => setUsernameStatus(''), 3000);
        }
    };

    const handleUpdateEmail = async () => {
        setEmailStatus('loading');
        const { error: authError } = await supabase.auth.updateUser({ email: profile.email });
        if (authError) {
            console.error(authError);
            setEmailStatus('error');
            return;
        }

        await supabase
            .from('Users')
            .update({ Email: profile.email })
            .eq('UserID', user.id);

        setEmailStatus('success');
        setTimeout(() => setEmailStatus(''), 5000);
    };

    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword || newPassword.length < 6) {
            setPasswordStatus('error');
            return;
        }
        setPasswordStatus('loading');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            console.error(error);
            setPasswordStatus('error');
        } else {
            setPasswordStatus('success');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordStatus(''), 3000);
        }
    };

    const submitWindowsPin = async () => {
        setPinStatus('loading');
        
        if (newPinStr.length !== 4 || newPinStr !== confirmPinStr) {
            setPinStatus('mismatch');
            return;
        }

        try {
            if (hasPin) {
                const { data: isValidOld } = await supabase.rpc('verify_my_pin', { entered_pin: oldPin });
                if (!isValidOld) {
                    setPinStatus('wrong_old');
                    return;
                }
            }

            // Set new PIN
            const { error: rpcError } = await supabase.rpc('set_my_pin', { new_pin: newPinStr });
            if (rpcError) throw rpcError;
            
            setPinStatus('success');
            setHasPin(true);
            setTimeout(() => {
                setPinStatus('');
                setOldPin('');
                setNewPinStr('');
                setConfirmPinStr('');
                setIsEditingPin(false);
            }, 1500);
        } catch (err) {
            console.error(err);
            setPinStatus('error');
        }
    };

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <h1 className="text-3xl font-bold tracking-tight mb-2">My Account</h1>
            <SettingsTabs />

            <div className="space-y-2 mt-6">
                
                {/* Staff ID Accordion */}
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden transition-all shadow-sm">
                    <button 
                        onClick={() => setExpandedOption(e => e === 'staffid' ? null : 'staffid')}
                        className="w-full flex items-center p-4 hover:bg-gray-50 text-left transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center mr-4 shrink-0">
                            <User className="w-6 h-6 text-gray-700" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Staff ID</p>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 pr-4 box-content ${expandedOption === 'staffid' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedOption === 'staffid' && (
                        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                            <div className="w-full max-w-2xl mx-auto space-y-4 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-gray-900 font-medium text-base">Staff ID</Label>
                                    </div>
                                    <Input 
                                        value={profile.staffId || 'Loading...'}
                                        readOnly
                                        className="w-full sm:w-48 bg-gray-100 text-gray-500 font-mono text-center cursor-not-allowed border-gray-200 shadow-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Username Accordion */}
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden transition-all shadow-sm">
                    <button 
                        onClick={() => setExpandedOption(e => e === 'username' ? null : 'username')}
                        className="w-full flex items-center p-4 hover:bg-gray-50 text-left transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center mr-4 shrink-0">
                            <User className="w-6 h-6 text-gray-700" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Username</p>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 pr-4 box-content ${expandedOption === 'username' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedOption === 'username' && (
                        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                            <div className="w-full max-w-2xl mx-auto space-y-4 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <Label className="text-gray-700 font-medium">Username</Label>
                                    <div className="w-full sm:w-64 relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
                                        <Input 
                                            className="w-full bg-white pl-8"
                                            value={profile.username}
                                            onChange={(e) => setProfile({...profile, username: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 mt-6">
                                    <Button 
                                        variant="outline" 
                                        className="bg-white px-6"
                                        onClick={() => {
                                            setExpandedOption(null); setUsernameStatus('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpdateUsername} disabled={usernameStatus === 'loading'} className="bg-indigo-600 hover:bg-indigo-700 px-6 min-w-[120px]">
                                        {usernameStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Update'}
                                    </Button>
                                </div>
                                
                                <div className="flex justify-end pt-1">
                                    {usernameStatus === 'success' && <p className="text-sm text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Username updated successfully</p>}
                                    {usernameStatus === 'taken' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> This username is already taken</p>}
                                    {usernameStatus === 'error' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Failed to update username</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Accordion */}
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden transition-all shadow-sm">
                    <button 
                        onClick={() => setExpandedOption(e => e === 'email' ? null : 'email')}
                        className="w-full flex items-center p-4 hover:bg-gray-50 text-left transition-colors"
                    >
                        <div className="w-10 h-10 flex items-center justify-center mr-4 shrink-0">
                            <Mail className="w-6 h-6 text-gray-700" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Email</p>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 pr-4 box-content ${expandedOption === 'email' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedOption === 'email' && (
                        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                            <div className="w-full max-w-2xl mx-auto space-y-4 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <Label className="text-gray-700 font-medium">Email Address</Label>
                                    <Input 
                                        type="email"
                                        className="w-full sm:w-64 bg-white"
                                        value={profile.email}
                                        onChange={(e) => setProfile({...profile, email: e.target.value})}
                                    />
                                </div>
                                
                                <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 mt-6">
                                    <Button 
                                        variant="outline" 
                                        className="bg-white px-6"
                                        onClick={() => {
                                            setExpandedOption(null); setEmailStatus('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleUpdateEmail} disabled={emailStatus === 'loading'} className="bg-indigo-600 hover:bg-indigo-700 px-6 min-w-[120px]">
                                        {emailStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Update'}
                                    </Button>
                                </div>
                                
                                <div className="flex justify-end pt-1">
                                    {emailStatus === 'success' && <p className="text-sm text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Check email for confirmation</p>}
                                    {emailStatus === 'error' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Failed to update email</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                    
                    {/* Password Accordion */}
                    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden transition-all shadow-sm">
                        <button 
                            onClick={() => setExpandedOption(e => e === 'password' ? null : 'password')}
                            className="w-full flex items-center p-4 hover:bg-gray-50 text-left transition-colors"
                        >
                            <div className="w-10 h-10 flex items-center justify-center mr-4 shrink-0">
                                <KeyRound className="w-6 h-6 text-gray-700" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">Password</p>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedOption === 'password' ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {expandedOption === 'password' && (
                            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                                <div className="w-full max-w-2xl mx-auto space-y-6">
                                    {!isEditingPassword ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-900 font-medium">Change your password</span>
                                            <Button variant="outline" className="bg-white" onClick={() => setIsEditingPassword(true)}>Change</Button>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-4 pt-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <Label className="text-gray-700 font-medium">New Password</Label>
                                                <Input 
                                                    type="password"
                                                    className="w-full sm:w-64 bg-white"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <Label className="text-gray-700 font-medium">Confirm New Password</Label>
                                                <Input 
                                                    type="password"
                                                    className="w-full sm:w-64 bg-white"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                />
                                            </div>
                                            
                                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 mt-6">
                                                <Button 
                                                    variant="outline" 
                                                    className="bg-white px-6"
                                                    onClick={() => {
                                                        setNewPassword(''); setConfirmPassword(''); setIsEditingPassword(false); setPasswordStatus('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button onClick={handleUpdatePassword} disabled={passwordStatus === 'loading'} className="bg-indigo-600 hover:bg-indigo-700 px-6 min-w-[150px]">
                                                    {passwordStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Change Password'}
                                                </Button>
                                            </div>
                                            
                                            <div className="flex justify-end pt-1">
                                                {passwordStatus === 'success' && <p className="text-sm text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Password updated</p>}
                                                {passwordStatus === 'error' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Failed or mismatch</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PIN Accordion */}
                    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden transition-all shadow-sm">
                        <div className={`w-full flex items-center transition-colors ${pinTimeout > 0 ? 'hover:bg-gray-50' : 'bg-white opacity-80'}`}>
                            <button 
                                onClick={() => setExpandedOption(e => e === 'pin' ? null : 'pin')}
                                className="flex-1 flex items-center p-4 text-left"
                            >
                                <div className="w-10 h-10 flex items-center justify-center mr-4 shrink-0">
                                    <LayoutGrid className="w-6 h-6 text-gray-700" />
                                </div>
                                <div className="flex-1 flex items-center justify-between mr-4">
                                    <p className="font-semibold text-gray-900">PIN</p>
                                </div>
                            </button>
                            <div className="pr-4 flex items-center gap-4">
                                <label className="relative inline-flex items-center cursor-pointer" title="Enable/Disable POS Lock">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={pinTimeout > 0} 
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setPinTimeout(isChecked ? 3 * 60 * 1000 : 0);
                                            if (isChecked) {
                                                setExpandedOption('pin');
                                            } else if (expandedOption === 'pin') {
                                                setExpandedOption(null);
                                                setIsEditingPin(false);
                                            }
                                        }} 
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                                <button 
                                    onClick={() => setExpandedOption(e => e === 'pin' ? null : 'pin')}
                                >
                                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedOption === 'pin' ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>
                        
                        {expandedOption === 'pin' && (
                            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100">
                                <div className="w-full max-w-2xl mx-auto space-y-6">
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-900 font-medium">Screen Lock Timeout</span>
                                            <Select value={pinTimeout.toString()} onValueChange={(val) => setPinTimeout(parseInt(val, 10))}>
                                                <SelectTrigger className="w-[150px] bg-white h-9">
                                                    <SelectValue placeholder="Select timeout" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value={(3 * 60 * 1000).toString()}>3 Minutes</SelectItem>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value={(5 * 60 * 1000).toString()}>5 Minutes</SelectItem>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value={(10 * 60 * 1000).toString()}>10 Minutes</SelectItem>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value={(30 * 60 * 1000).toString()}>30 Minutes</SelectItem>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value={(60 * 60 * 1000).toString()}>60 Minutes</SelectItem>
                                                    <SelectItem className="pr-2 [&>span.absolute]:hidden" value="0">Never</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <hr className="border-gray-200" />
                                    </>

                                    {!isEditingPin ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-900 font-medium">{hasPin ? 'Change your PIN' : 'Set up a PIN'}</span>
                                            <Button variant="outline" className="bg-white" onClick={() => setIsEditingPin(true)}>{hasPin ? 'Change PIN' : 'Set up'}</Button>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-4 pt-2">
                                            {hasPin && (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <Label className="text-gray-700 font-medium">Current PIN</Label>
                                                    <Input 
                                                        type="password" 
                                                        maxLength={4}
                                                        placeholder="••••"
                                                        className="w-full sm:w-32 text-center tracking-[0.5em] font-mono text-lg bg-white"
                                                        value={oldPin}
                                                        onChange={(e) => setOldPin(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <Label className="text-gray-700 font-medium">{hasPin ? 'New PIN' : 'Enter 4-digit PIN'}</Label>
                                                <Input 
                                                    type="password" 
                                                    maxLength={4}
                                                    placeholder="••••"
                                                    className="w-full sm:w-32 text-center tracking-[0.5em] font-mono text-lg bg-white"
                                                    value={newPinStr}
                                                    onChange={(e) => setNewPinStr(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <Label className="text-gray-700 font-medium">Confirm PIN</Label>
                                                <Input 
                                                    type="password" 
                                                    maxLength={4}
                                                    placeholder="••••"
                                                    className="w-full sm:w-32 text-center tracking-[0.5em] font-mono text-lg bg-white"
                                                    value={confirmPinStr}
                                                    onChange={(e) => setConfirmPinStr(e.target.value)}
                                                />
                                            </div>
                                            
                                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-200 mt-6">
                                                <Button 
                                                    variant="outline" 
                                                    className="bg-white px-6"
                                                    onClick={() => {
                                                        setOldPin(''); setNewPinStr(''); setConfirmPinStr(''); setIsEditingPin(false); setPinStatus('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button onClick={submitWindowsPin} disabled={pinStatus === 'loading'} className="bg-indigo-600 hover:bg-indigo-700 px-6 min-w-[120px]">
                                                    {pinStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (hasPin ? 'Save PIN' : 'Set PIN')}
                                                </Button>
                                            </div>
                                            
                                            <div className="flex justify-end pt-1">
                                                {pinStatus === 'success' && <p className="text-sm text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> PIN updated successfully</p>}
                                                {pinStatus === 'mismatch' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> PINs must match and be 4 digits</p>}
                                                {pinStatus === 'wrong_old' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Current PIN is incorrect</p>}
                                                {pinStatus === 'error' && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1" /> Failed to update PIN</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

        </div>
    );
}
