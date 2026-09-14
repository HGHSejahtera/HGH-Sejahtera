import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Link2, Zap } from 'lucide-react';
import { Button } from '@/Components/UI/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/UI/Dialog';
import { useAuthStore } from '@/Hooks/UseAuth';
import { useTikTokConnection } from '@/Hooks/UseTikTokConnection';
import { SettingsPage } from './SettingsPage';

const StatusLabels = { PendingConfirmation: 'Confirm shop', Connected: 'Connected', Disconnected: 'Disconnected', ReconnectRequired: 'Reconnect required' };
const DateText = Value => Value ? new Date(Value * 1000).toLocaleString('en-MY') : 'Not checked';

export function APIConnection({ Standalone = false } = {}) {
    const Auth = useAuthStore();
    if (!Auth.isAuthenticated || Auth.isLocked || Auth.LogoutPending || !['Founder', 'Manager', 'Developer'].includes(Auth.user?.role)) return null;
    // Unmount on PIN lock/account changes to abort requests and discard private state.
    return <ConnectionPanel key={`${Auth.user.id}:${Auth.ProfileRevision}`} Standalone={Standalone} />;
}

function ConnectionPanel({ Standalone }) {
    const { Connections, Loading, Busy, ErrorText, Checks, Run } = useTikTokConnection();
    const [DisconnectID, SetDisconnectID] = useState(null);
    const [Search] = useSearchParams();
    const Result = Search.get('Result');
    return <SettingsPage Title="API Connection" Description="Manage your TikTok Shop connection." ReloadDocument={Standalone}>
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm space-y-5" aria-label="TikTok Shop connection" aria-busy={Loading || Busy}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="size-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Zap aria-hidden="true" className="size-5" /></div>
                    <div><h2 className="text-lg font-semibold text-gray-900">TikTok Shop</h2><p className="text-sm text-gray-500">HGH Centre · Test connection</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button className="min-h-11" variant="outline" onClick={() => Run('Refresh')} disabled={Loading || Busy}><RefreshCw aria-hidden="true" className="size-4" />Refresh</Button>
                    <Button className="min-h-11" onClick={() => Run('Connect')} disabled={Loading || Busy}><Link2 aria-hidden="true" className="size-4" />Connect Test Shop</Button>
                </div>

            </div>
            <p className="text-sm text-gray-600">Connect HGH Test Centre to check API access. Orders and payments are not synced yet.</p>
            {Result === 'Ready' && Connections.some(Connection => Connection.Status === 'PendingConfirmation') && <p role="status" className="text-sm">Confirm the shop below to finish connecting.</p>}
            {Result === 'Error' && <p role="alert" className="text-sm text-red-700">Authorization did not finish. Start a new connection.</p>}
            {ErrorText && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{ErrorText}</p>}
            {Loading ? <p role="status" className="rounded-xl bg-gray-50 p-6 text-sm text-gray-500">Loading connection…</p> : Connections.length === 0 && !ErrorText ?
                <div className="rounded-xl border border-gray-200/80 bg-gray-50 px-4 py-8 text-center space-y-2">
                    <Link2 aria-hidden="true" className="size-6 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-900">No test shop connected.</p>
                    <p className="text-sm text-gray-500">Select Connect Test Shop to connect HGH Test Centre.</p>
                </div> : null}
            {Connections.map(Connection => <article key={Connection.GrantID} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words">{Connection.Shop.Name}</h3><span className="text-sm">{StatusLabels[Connection.Status] || 'Unavailable'}</span></div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-gray-500">Shop ID</dt><dd className="break-all">{Connection.Shop.ShopID}</dd></div>
                    <div><dt className="text-gray-500">Market</dt><dd>Malaysia · Test</dd></div>
                    <div><dt className="text-gray-500">Access expires</dt><dd>{DateText(Connection.AccessExpiresAt)}</dd></div>
                    <div><dt className="text-gray-500">Last data check</dt><dd>{DateText(Connection.LastCheckedAt)}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2">
                    {Connection.Status === 'PendingConfirmation' && <Button disabled={Busy} onClick={() => Run('Confirm', Connection.GrantID)}>Confirm Test Shop</Button>}
                    {Connection.Status !== 'Disconnected' && <Button variant="outline" disabled={Busy} onClick={() => SetDisconnectID(Connection.GrantID)}>Disconnect</Button>}
                </div>
                {Connection.Status === 'Connected' && <div className="space-y-2 border-t pt-3">
                    <h4 className="font-medium">Check API data</h4>
                    <p className="text-sm text-gray-600">Up to 20 records from the last 30 days; products include all dates. These checks do not calculate profit or agent payments.</p>
                    {['Orders', 'Products', 'Returns', 'Floating', 'Statements', 'Withdrawals'].map(Dataset => {
                        const Check = Checks[`${Connection.GrantID}:${Dataset}`];
                        return <div key={Dataset} className="flex flex-wrap items-center gap-3">
                            <Button variant="outline" disabled={Busy} onClick={() => Run('CheckData', Connection.GrantID, Dataset)}>Check {Dataset}</Button>
                            <span className="text-sm" role="status">{Check ? `${Check.SampleCount} sample records${Check.HasMore ? ' · more records available' : ''}${Check.Estimated ? ' · estimates only' : ''} · ${DateText(Check.CheckedAt)}` : 'Not checked'}</span>
                        </div>;
                    })}
                </div>}
            </article>)}
        </section>
        <Dialog open={Boolean(DisconnectID)} onOpenChange={Open => { if (!Open) SetDisconnectID(null); }}>
            <DialogContent><DialogHeader><DialogTitle>Disconnect test shop?</DialogTitle><DialogDescription>HGH will stop using this connection and remove its saved tokens. This does not revoke the app in TikTok Seller Center.</DialogDescription></DialogHeader>
                <DialogFooter><Button variant="outline" onClick={() => SetDisconnectID(null)}>Cancel</Button><Button disabled={Busy} onClick={() => { const ID = DisconnectID; SetDisconnectID(null); void Run('Disconnect', ID); }}>Disconnect</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </SettingsPage>;
}
