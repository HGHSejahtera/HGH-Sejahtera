import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/useAuth';
import { usePreferences } from '@/hooks/usePreferences';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTabs } from './Settings';
import { 
    User, 
    KeyRound, 
    Loader2, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    Mail, 
    Lock, 
    Clock, 
    IdCard,
    Shield
} from 'lucide-react';

export function AccountSettings() {
    const { user } = useAuthStore();
    const { pinTimeout, setPinTimeout } = usePreferences();
    const [profile, setProfile] = useState({ staffId: '', username: '', email: '', nickname: '' });
    const [hasPin, setHasPin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Status states
    const [usernameStatus, setUsernameStatus] = useState('');
    const [nicknameStatus, setNicknameStatus] = useState('');
    const [emailStatus, setEmailStatus] = useState('');
    const [passwordStatus, setPasswordStatus] = useState('');
    const [pinStatus, setPinStatus] = useState('');

    const [isEditingPin, setIsEditingPin] = useState(false);
    const [isEditingPassword, setIsEditingPassword] = useState(false);

    // PIN state
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
                .select('StaffID, Username, Email, PINHash, Nickname')
                .eq('UserID', user.id)
                .single();
                
            if (!error && data) {
                setProfile({ 
                    staffId: data.StaffID || '', 
                    username: data.Username || '', 
                    email: data.Email || '', 
                    nickname: data.Nickname || '' 
                });
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
            setUsernameStatus(error.code === '23505' ? 'taken' : 'error');
        } else {
            setUsernameStatus('success');
            setTimeout(() => setUsernameStatus(''), 3000);
        }
    };

    const handleUpdateNickname = async () => {
        setNicknameStatus('loading');
        const formattedNickname = profile.nickname 
            ? profile.nickname.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            : '';
        const { error } = await supabase
            .from('Users')
            .update({ Nickname: formattedNickname })
            .eq('UserID', user.id);
            
        if (error) {
            console.error(error);
            setNicknameStatus('error');
        } else {
            setProfile({ ...profile, nickname: formattedNickname });
            setNicknameStatus('success');
            setTimeout(() => setNicknameStatus(''), 3000);
        }
    };

    const handleUpdateEmail = async () => {
        setEmailStatus('loading');
        const { error } = await supabase.auth.updateUser({ email: profile.email });
        if (error) {
            console.error(error);
            setEmailStatus('error');
        } else {
            setEmailStatus('success');
            setTimeout(() => setEmailStatus(''), 4000);
        }
    };

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword !== confirmPassword) {
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
            setIsEditingPassword(false);
            setTimeout(() => setPasswordStatus(''), 3000);
        }
    };

    const submitWindowsPin = async () => {
        if (!newPinStr || newPinStr.length !== 4 || newPinStr !== confirmPinStr) {
            setPinStatus('mismatch');
            return;
        }

        setPinStatus('loading');

        try {
            if (hasPin) {
                const { data: userData, error: fetchError } = await supabase
                    .from('Users')
                    .select('PINHash')
                    .eq('UserID', user.id)
                    .single();

                if (fetchError || !userData?.PINHash) {
                    setPinStatus('error');
                    return;
                }

                const hashedInputOld = btoa(oldPin);
                if (userData.PINHash !== hashedInputOld) {
                    setPinStatus('wrong_old');
                    return;
                }
            }

            const hashedNewPin = btoa(newPinStr);
            const { error: updateError } = await supabase
                .from('Users')
                .update({ PINHash: hashedNewPin })
                .eq('UserID', user.id);

            if (updateError) {
                setPinStatus('error');
            } else {
                setHasPin(true);
                setPinStatus('success');
                setOldPin('');
                setNewPinStr('');
                setConfirmPinStr('');
                setIsEditingPin(false);
                setTimeout(() => setPinStatus(''), 3000);
            }
        } catch (err) {
            console.error(err);
            setPinStatus('error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">Account Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your personal details, credentials, and POS screen lock security.</p>
                </div>
                <SettingsTabs />
            </div>

            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 border border-gray-800">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-2xl font-black text-indigo-300 shadow-inner">
                        {(profile.nickname || profile.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-2xl font-bold tracking-tight text-white">
                                {profile.nickname || profile.username || 'User Profile'}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                                {profile.staffId || 'STAFF'}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">
                            @{profile.username} • {profile.email || 'No email configured'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${hasPin ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                        <span className="text-xs font-semibold text-gray-200">
                            {hasPin ? 'POS PIN Security Active' : 'PIN Not Configured'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-8">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Personal Information</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Update your display name and login identifiers.</p>
                            </div>
                            <User className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="p-6 sm:p-8 space-y-8 divide-y divide-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <Label className="text-sm font-semibold text-gray-900">Staff ID</Label>
                                    <p className="text-xs text-gray-500 mt-0.5">Unique system employee code</p>
                                </div>
                                <div className="w-full sm:w-64">
                                    <Input 
                                        value={profile.staffId || '—'}
                                        readOnly
                                        className="w-full bg-gray-100/80 text-gray-600 font-mono text-center font-bold cursor-not-allowed border-gray-200 shadow-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-900">Nickname / Nama Panggilan</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">Used across dashboards and receipts</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-80">
                                        <Input 
                                            className="w-full bg-white"
                                            value={profile.nickname}
                                            placeholder="Contoh: Riz"
                                            onChange={(e) => setProfile({...profile, nickname: e.target.value})}
                                        />
                                        <Button 
                                            onClick={handleUpdateNickname} 
                                            disabled={nicknameStatus === 'loading'}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 shrink-0"
                                        >
                                            {nicknameStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                                {nicknameStatus === 'success' && (
                                    <p className="text-xs text-emerald-600 font-medium flex items-center justify-end">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Nickname updated successfully
                                    </p>
                                )}
                                {nicknameStatus === 'error' && (
                                    <p className="text-xs text-red-600 font-medium flex items-center justify-end">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Failed to update nickname
                                    </p>
                                )}
                            </div>

                            <div className="pt-6 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-900">Username</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">Your primary login handle</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-80">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
                                            <Input 
                                                className="w-full bg-white pl-8"
                                                value={profile.username}
                                                onChange={(e) => setProfile({...profile, username: e.target.value})}
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleUpdateUsername} 
                                            disabled={usernameStatus === 'loading'}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 shrink-0"
                                        >
                                            {usernameStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                                {usernameStatus === 'success' && (
                                    <p className="text-xs text-emerald-600 font-medium flex items-center justify-end">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Username updated successfully
                                    </p>
                                )}
                                {usernameStatus === 'taken' && (
                                    <p className="text-xs text-red-600 font-medium flex items-center justify-end">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> This username is already taken
                                    </p>
                                )}
                                {usernameStatus === 'error' && (
                                    <p className="text-xs text-red-600 font-medium flex items-center justify-end">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Failed to update username
                                    </p>
                                )}
                            </div>

                            <div className="pt-6 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-900">Email Address</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">For account recovery and notices</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-80">
                                        <Input 
                                            type="email"
                                            className="w-full bg-white"
                                            value={profile.email}
                                            onChange={(e) => setProfile({...profile, email: e.target.value})}
                                        />
                                        <Button 
                                            onClick={handleUpdateEmail} 
                                            disabled={emailStatus === 'loading'}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 shrink-0"
                                        >
                                            {emailStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                                {emailStatus === 'success' && (
                                    <p className="text-xs text-emerald-600 font-medium flex items-center justify-end">
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Check your email box for confirmation
                                    </p>
                                )}
                                {emailStatus === 'error' && (
                                    <p className="text-xs text-red-600 font-medium flex items-center justify-end">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1" /> Failed to update email
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">POS Screen Lock & PIN</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Control automatic terminal locking</p>
                            </div>
                            <Shield className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-gray-500" /> Auto-Lock Timeout
                                    </Label>
                                    <p className="text-xs text-gray-500">Lock terminal screen when idle</p>
                                </div>
                                <Select value={pinTimeout.toString()} onValueChange={(val) => setPinTimeout(parseInt(val, 10))}>
                                    <SelectTrigger className="w-[140px] bg-white h-9 text-xs font-semibold">
                                        <SelectValue placeholder="Select timeout" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={(3 * 60 * 1000).toString()}>3 Minutes</SelectItem>
                                        <SelectItem value={(5 * 60 * 1000).toString()}>5 Minutes</SelectItem>
                                        <SelectItem value={(10 * 60 * 1000).toString()}>10 Minutes</SelectItem>
                                        <SelectItem value={(30 * 60 * 1000).toString()}>30 Minutes</SelectItem>
                                        <SelectItem value={(60 * 60 * 1000).toString()}>60 Minutes</SelectItem>
                                        <SelectItem value="0">Never</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-900">Terminal PIN Code</Label>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {hasPin ? 'PIN is currently set up and active' : 'Set a 4-digit PIN for quick unlock'}
                                        </p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsEditingPin(!isEditingPin)}
                                        className="font-semibold text-xs"
                                    >
                                        {isEditingPin ? 'Close' : (hasPin ? 'Change PIN' : 'Set PIN')}
                                    </Button>
                                </div>

                                {isEditingPin && (
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-4 pt-4 mt-2">
                                        {hasPin && (
                                            <div className="flex items-center justify-between gap-3">
                                                <Label className="text-xs font-semibold text-gray-700">Current PIN</Label>
                                                <Input 
                                                    type="password" 
                                                    maxLength={4}
                                                    placeholder="••••"
                                                    className="w-28 text-center tracking-[0.4em] font-mono text-base bg-white h-9"
                                                    value={oldPin}
                                                    onChange={(e) => setOldPin(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between gap-3">
                                            <Label className="text-xs font-semibold text-gray-700">
                                                {hasPin ? 'New PIN' : 'Enter 4-digit PIN'}
                                            </Label>
                                            <Input 
                                                type="password" 
                                                maxLength={4}
                                                placeholder="••••"
                                                className="w-28 text-center tracking-[0.4em] font-mono text-base bg-white h-9"
                                                value={newPinStr}
                                                onChange={(e) => setNewPinStr(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <Label className="text-xs font-semibold text-gray-700">Confirm PIN</Label>
                                            <Input 
                                                type="password" 
                                                maxLength={4}
                                                placeholder="••••"
                                                className="w-28 text-center tracking-[0.4em] font-mono text-base bg-white h-9"
                                                value={confirmPinStr}
                                                onChange={(e) => setConfirmPinStr(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <Button 
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setOldPin(''); setNewPinStr(''); setConfirmPinStr(''); setIsEditingPin(false); setPinStatus('');
                                                }}
                                                className="text-xs"
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                size="sm"
                                                onClick={submitWindowsPin} 
                                                disabled={pinStatus === 'loading'} 
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4"
                                            >
                                                {pinStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save PIN'}
                                            </Button>
                                        </div>

                                        {pinStatus === 'success' && <p className="text-xs text-emerald-600 font-medium">PIN updated successfully</p>}
                                        {pinStatus === 'mismatch' && <p className="text-xs text-red-600 font-medium">PINs must match and be 4 digits</p>}
                                        {pinStatus === 'wrong_old' && <p className="text-xs text-red-600 font-medium">Current PIN is incorrect</p>}
                                        {pinStatus === 'error' && <p className="text-xs text-red-600 font-medium">Failed to update PIN</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Password</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Change your account login password</p>
                            </div>
                            <Lock className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-semibold text-gray-900">Account Password</Label>
                                    <p className="text-xs text-gray-500 mt-0.5">Keep your account secure with a strong password</p>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setIsEditingPassword(!isEditingPassword)}
                                    className="font-semibold text-xs"
                                >
                                    {isEditingPassword ? 'Close' : 'Change Password'}
                                </Button>
                            </div>

                            {isEditingPassword && (
                                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-4 pt-4 mt-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">New Password</Label>
                                        <Input 
                                            type="password"
                                            className="w-full bg-white h-9"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-700">Confirm New Password</Label>
                                        <Input 
                                            type="password"
                                            className="w-full bg-white h-9"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        <Button 
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setNewPassword(''); setConfirmPassword(''); setIsEditingPassword(false); setPasswordStatus('');
                                            }}
                                            className="text-xs"
                                        >
                                            Cancel
                                        </Button>
                                        <Button 
                                            size="sm"
                                            onClick={handleUpdatePassword} 
                                            disabled={passwordStatus === 'loading'} 
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4"
                                        >
                                            {passwordStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update Password'}
                                        </Button>
                                    </div>

                                    {passwordStatus === 'success' && <p className="text-xs text-emerald-600 font-medium">Password updated successfully</p>}
                                    {passwordStatus === 'error' && <p className="text-xs text-red-600 font-medium">Failed to update or passwords mismatch</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
