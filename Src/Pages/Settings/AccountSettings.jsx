import { useEffect, useRef, useState } from 'react';
import { UserRound, Shield, Lock, Loader2 } from 'lucide-react';
import { supabase as Supabase } from '@/Lib/Supabase';
import { ChangeAccount, AccountChangesReady, PINChangesReady, IsAccountChangeReady } from '@/Lib/AccountChange';
import { useAuthStore } from '@/Hooks/UseAuth';
import { useTranslation } from '@/Hooks/UseTranslation';
import { usePreferences } from '@/Hooks/UsePreferences';
import { Button } from '@/Components/UI/Button';
import { Input } from '@/Components/UI/Input';
import { Label } from '@/Components/UI/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/UI/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/UI/Dialog';
import { SettingsPage } from './SettingsPage';

function AccountSection({ Title, Icon, children }) {
    return <section className="border-t border-gray-100"><h2 className="flex items-center gap-2 px-5 py-3 bg-gray-50/70 text-sm font-semibold text-gray-700"><Icon aria-hidden="true" className="size-4 text-primary"/>{Title}</h2><div className="divide-y divide-gray-100">{children}</div></section>;
}
function AccountRow({ Label, Value, children }) {
    return <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-medium text-gray-900">{Label}</h3>{Value && <p className="mt-1 text-sm text-gray-500 break-all">{Value}</p>}</div>{children}</div>;
}
export function AccountSettings() {
    const Auth = useAuthStore();
    if (!Auth.isAuthenticated || Auth.isLocked || !Auth.user?.id) return null;
    return <AccountPanel key={Auth.user.id} Auth={Auth}/>;
}
function AccountPanel({ Auth }) {
    const { t: Translate } = useTranslation();
    const Text = Key => Translate('Account.' + Key);
    const { pinTimeout: PINTimeout, setPinTimeout: SetPINTimeout } = usePreferences();
    const [Profile, SetProfile] = useState(null);
    const [Nickname, SetNickname] = useState('');
    const [EditingNickname, SetEditingNickname] = useState(false);
    const [Loading, SetLoading] = useState(true);
    const [LoadError, SetLoadError] = useState(false);
    const [Revision, SetRevision] = useState(0);
    const [Editor, SetEditor] = useState(null);
    const [Value, SetValue] = useState('');
    const [Confirmation, SetConfirmation] = useState('');
    const [CurrentPassword, SetCurrentPassword] = useState('');
    const [Busy, SetBusy] = useState(false);
    const [ErrorKey, SetError] = useState('');
    const [Notice, SetNotice] = useState('');
    const [NicknameError, SetNicknameError] = useState('');
    const [NicknameNotice, SetNicknameNotice] = useState('');
    const [PasswordChanged, SetPasswordChanged] = useState(false);
    const Request = useRef(null);
    const Running = useRef(false);
    const UserID = Auth.user?.id;
    useEffect(() => {
        let Active = true;
        async function Load() {
            try {
                const [{ data: Data, error: Failure }, { data: Identity, error: AuthFailure }] = await Promise.all([
                    Supabase.from('Users').select('StaffID, Username, Nickname').eq('UserID', UserID).single(), Supabase.auth.getUser()
                ]);
                if (!Active) return;
                if (Failure || AuthFailure || !Data || Identity?.user?.id !== UserID) throw new Error();
                SetProfile({ ...Data, Email: Identity.user.email || '', PendingEmail: Identity.user.new_email || '' });
                SetNickname(Data.Nickname || '');
            } catch { if (Active) SetLoadError(true); }
            finally { if (Active) SetLoading(false); }
        }
        Load();
        const Requests = Request;
        return () => { Active = false; Requests.current?.abort(); };
    }, [UserID, Revision]);
    const CurrentIdentity = () => { const State = useAuthStore.getState(); return State.user?.id === UserID && State.isAuthenticated && !State.isLocked; };
    function Open(Action) {
        if (Running.current || !IsAccountChangeReady(Action)) return;
        SetEditor(Action); SetValue(Action === 'Username' ? Profile.Username : Action === 'Email' ? Profile.Email : '');
        SetCurrentPassword(''); SetConfirmation(''); SetError(''); SetNotice('');
    }
    function Close() { if (!Running.current) { SetEditor(null); SetCurrentPassword(''); SetValue(''); SetConfirmation(''); SetError(''); } }
    async function SaveNickname(Event) {
        Event.preventDefault();
        if (Running.current || !CurrentIdentity()) return;
        const Name = Nickname.trim();
        if (!Name || Name.length > 50) { SetNicknameError('NicknameInvalid'); return; }
        Running.current = true; SetBusy(true); SetNicknameError(''); SetNicknameNotice('');
        try {
            const { data: Data, error: Failure } = await Supabase.from('Users').update({ Nickname: Name }).eq('UserID', UserID).select('Nickname').single();
            if (!CurrentIdentity()) return;
            if (Failure || !Data) throw new Error();
            SetProfile(Previous => ({ ...Previous, Nickname: Data.Nickname })); SetNickname(Data.Nickname);
            useAuthStore.setState(State => State.user?.id === UserID ? { user: { ...State.user, nickname: Data.Nickname, name: Data.Nickname } } : {});
            SetNicknameNotice('Updated'); SetEditingNickname(false);
        } catch { if (CurrentIdentity()) SetNicknameError('UpdateFailed'); }
        finally { Running.current = false; SetBusy(false); }
    }
    async function Submit(Event) {
        Event.preventDefault();
        if (Running.current || !CurrentIdentity()) return;
        const Next = ['Username', 'Email'].includes(Editor) ? Value.trim() : Value;
        if (!CurrentPassword || (Editor !== 'DisablePIN' && !Next)) { SetError('Required'); return; }
        if (['Password', 'SetPIN'].includes(Editor) && Next !== Confirmation) { SetError('Mismatch'); return; }
        if (['Username', 'Email'].includes(Editor) && Next === Profile[Editor]) { SetError('NoChange'); return; }
        if (Editor === 'Password' && (Array.from(Next).length < 15 || new TextEncoder().encode(Next).length > 72 || Next === CurrentPassword)) { SetError('PasswordInvalid'); return; }
        Running.current = true; SetBusy(true); SetError('');
        Request.current = new AbortController();
        try {
            const Result = await ChangeAccount(Editor, Next, CurrentPassword, Request.current.signal);
            SetCurrentPassword(''); SetValue(''); SetConfirmation(''); SetEditor(null);
            if (Editor === 'Password') { SetPasswordChanged(true); SetNotice(Result.SignOutComplete ? 'PasswordChanged' : 'PasswordSignOutWarning'); }
            else if (Editor === 'Email') { SetProfile(Previous => ({ ...Previous, PendingEmail: Next })); SetNotice('EmailPending'); }
            else if (Editor === 'Username') { SetProfile(Previous => ({ ...Previous, Username: Next })); SetNotice('Updated'); }
            else { useAuthStore.setState(State => State.user?.id === UserID ? { user: { ...State.user, hasPin: Editor === 'SetPIN' } } : {}); SetNotice('Updated'); }
        } catch (Failure) {
            const Known = ['WrongPassword','UsernameTaken','EmailTaken','UsernameInvalid','EmailInvalid','PasswordInvalid','PINInvalid','TooManyAttempts','SignIn','Unavailable','SetupRequired','Invalid','UpdateFailed'];
            SetError(Known.includes(Failure.message) ? Failure.message : 'UpdateFailed'); SetCurrentPassword('');
        } finally { Running.current = false; SetBusy(false); }
    }
    const Titles = { Username:'ChangeUsername', Email:'ChangeEmail', Password:'ChangePassword', SetPIN: Auth.user?.hasPin ? 'ChangePIN' : 'SetPIN', DisablePIN:'DisablePIN' };
    const Hints = { Username:'UsernameHint', Email:'EmailHint', Password:'PasswordHint', SetPIN:'PINHint', DisablePIN:'DisablePINHint' };
    return <SettingsPage Title={Text('Title')}>
        {Loading ? <p role="status" className="p-6 rounded-2xl bg-white border">{Text('Loading')}</p> : LoadError || !Profile ? <div className="p-6 rounded-2xl bg-white border space-y-3"><p role="alert">{Text('LoadFailed')}</p><Button onClick={() => { SetLoading(true); SetLoadError(false); SetRevision(Previous => Previous + 1); }}>{Text('Retry')}</Button></div> : <>
            {Notice && <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-3"><p>{Text(Notice)}</p>{PasswordChanged && <Button onClick={() => Auth.logout()}>{Text('SignInAgain')}</Button>}</div>}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-5"><div aria-hidden="true" className="size-11 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">{(Profile.Nickname || Profile.Username || 'H').slice(0,1).toUpperCase()}</div><div className="min-w-0"><h2 className="text-base font-semibold break-words">{Profile.Nickname || Profile.Username}</h2><p className="text-xs text-gray-500 mt-0.5">{Text('StaffID')}: {Profile.StaffID || '—'}</p></div></div>
                <AccountSection Title={Text('Profile')} Icon={UserRound}>
                    <AccountRow Label={Text('Nickname')} Value={!EditingNickname ? Profile.Nickname : undefined}>{!EditingNickname && <Button variant="ghost" className="min-h-11 text-primary" disabled={Busy || PasswordChanged} onClick={()=>SetEditingNickname(true)}>{Text('Change')}</Button>}</AccountRow>
                    {EditingNickname && <form onSubmit={SaveNickname} className="px-5 py-4 space-y-3"><Label htmlFor="AccountNickname">{Text('Nickname')}</Label><Input id="AccountNickname" value={Nickname} onChange={Event=>SetNickname(Event.target.value)} maxLength={50} required disabled={Busy || PasswordChanged} className="min-h-11"/><div className="flex gap-2"><Button type="submit" disabled={Busy || PasswordChanged || Nickname.trim() === Profile.Nickname} className="min-h-11">{Text(Busy && !Editor ? 'Saving' : 'Save')}</Button><Button type="button" variant="ghost" disabled={Busy} onClick={()=>{SetNickname(Profile.Nickname || '');SetEditingNickname(false);SetNicknameError('');}}>{Text('Cancel')}</Button></div></form>}
                    {NicknameError && <p role="alert" className="px-5 py-3 text-sm text-red-700">{Text(NicknameError)}</p>}{NicknameNotice && <p role="status" className="px-5 py-3 text-sm text-primary">{Text(NicknameNotice)}</p>}
                </AccountSection>
                <AccountSection Title={Text('SignInDetails')} Icon={Lock}>
                    {!AccountChangesReady && <p role="status" className="px-5 py-3 text-sm text-amber-900 bg-amber-50">{Text('SignInUnavailable')}</p>}
                    {['Username','Email'].map(Field=><AccountRow key={Field} Label={Text(Field)} Value={Profile[Field] || Text('NoEmail')}><Button variant="ghost" className="min-h-11 text-primary" aria-label={Text(Field === 'Username' ? 'ChangeUsername' : 'ChangeEmail')} disabled={!AccountChangesReady || Busy || PasswordChanged} onClick={()=>Open(Field)}>{Text('Change')}</Button></AccountRow>)}
                    {Profile.PendingEmail && <p className="px-5 py-3 text-sm text-gray-500 break-all">{Text('PendingEmail')}: {Profile.PendingEmail}</p>}
                    <AccountRow Label={Text('Password')}><Button variant="ghost" className="min-h-11 text-primary" disabled={!AccountChangesReady || Busy || PasswordChanged} onClick={()=>Open('Password')}>{Text('ChangePassword')}</Button></AccountRow>
                </AccountSection>
                <AccountSection Title={Text('ScreenLock')} Icon={Shield}>
                    <AccountRow Label={Text('PIN')} Value={Text(Auth.user?.hasPin ? 'PINActive' : 'PINOff')}><div className="flex flex-wrap gap-2"><Button variant="ghost" className="min-h-11 text-primary" disabled={!PINChangesReady || Busy || PasswordChanged} onClick={()=>Open('SetPIN')}>{Text(Auth.user?.hasPin ? 'ChangePIN' : 'SetPIN')}</Button>{Auth.user?.hasPin && <Button variant="ghost" className="min-h-11 text-red-700" disabled={!PINChangesReady || Busy || PasswordChanged} onClick={()=>Open('DisablePIN')}>{Text('DisablePIN')}</Button>}</div></AccountRow>
                    <div className="px-5 py-4 flex flex-wrap justify-between items-center gap-3"><Label htmlFor="AccountAutoLock">{Text('AutoLock')}</Label><Select value={String(PINTimeout)} onValueChange={Next=>SetPINTimeout(Number(Next))} disabled={!Auth.user?.hasPin || PasswordChanged}><SelectTrigger id="AccountAutoLock" className="min-h-11 w-40"><SelectValue/></SelectTrigger><SelectContent>{[3,5,10,30,60].map(Minutes=><SelectItem key={Minutes} value={String(Minutes*60000)}>{Minutes} {Text('Minutes')}</SelectItem>)}<SelectItem value="0">{Text('Never')}</SelectItem></SelectContent></Select></div>
                </AccountSection>
            </div>
        </>}
        <Dialog open={!!Editor} onOpenChange={Open=>{if(!Open)Close();}}><DialogContent CloseLabel={Text('Cancel')} className="sm:max-w-md max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{Editor && Text(Titles[Editor])}</DialogTitle><DialogDescription>{Editor && Text(Hints[Editor])}</DialogDescription></DialogHeader><form onSubmit={Submit} className="space-y-4">
            {Editor !== 'DisablePIN' && <div className="space-y-2"><Label htmlFor="AccountNewValue">{Editor && Text(Editor==='Password'?'NewPassword':Editor==='SetPIN'?'NewPIN':Editor)}</Label><Input id="AccountNewValue" autoFocus type={['Password','SetPIN'].includes(Editor)?'password':Editor==='Email'?'email':'text'} autoComplete={Editor==='Password'?'new-password':Editor==='Email'?'email':'off'} inputMode={Editor==='SetPIN'?'numeric':undefined} maxLength={Editor==='SetPIN'?4:Editor==='Username'?30:undefined} value={Value} onChange={Event=>SetValue(Editor==='SetPIN'?Event.target.value.replace(/\D/g,''):Event.target.value)} disabled={Busy} required className="min-h-11"/></div>}
            {['Password','SetPIN'].includes(Editor) && <div className="space-y-2"><Label htmlFor="AccountConfirmation">{Text(Editor==='Password'?'ConfirmPassword':'ConfirmPIN')}</Label><Input id="AccountConfirmation" type="password" autoComplete={Editor==='Password'?'new-password':'off'} inputMode={Editor==='SetPIN'?'numeric':undefined} maxLength={Editor==='SetPIN'?4:undefined} value={Confirmation} onChange={Event=>SetConfirmation(Event.target.value)} required disabled={Busy} className="min-h-11"/></div>}
            <div className="space-y-2 border-t pt-4"><Label htmlFor="AccountCurrentPassword">{Text('CurrentPassword')}</Label><Input id="AccountCurrentPassword" type="password" autoComplete="current-password" value={CurrentPassword} onChange={Event=>SetCurrentPassword(Event.target.value)} required disabled={Busy} className="min-h-11"/></div>
            {ErrorKey && <p role="alert" className="text-sm text-red-700">{Text(ErrorKey)}</p>}<DialogFooter><Button type="button" variant="outline" onClick={Close} disabled={Busy} className="min-h-11">{Text('Cancel')}</Button><Button type="submit" variant={Editor==='DisablePIN'?'destructive':'default'} disabled={Busy} className="min-h-11">{Busy && <Loader2 aria-hidden="true" className="size-4 animate-spin"/>}{Text(Busy?'Saving':Editor==='DisablePIN'?'DisablePIN':'Confirmation')}</Button></DialogFooter>
        </form></DialogContent></Dialog>
    </SettingsPage>;
}
