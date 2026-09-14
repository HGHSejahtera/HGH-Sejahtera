import Test from 'node:test';
import Assert from 'node:assert/strict';
import { readFile as ReadFile } from 'node:fs/promises';
import { runInNewContext as Run } from 'node:vm';
import { transformWithOxc as Transform } from 'vite';

const Source = (await ReadFile(new URL('../Src/Pages/Settings/APIConnection.jsx', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?$/gm, '').replace('export function APIConnection', 'function APIConnection');
const { code: Code } = await Transform(Source, 'APIConnection.jsx', { jsx: { runtime: 'classic', pragma: 'Element' } });
function Fixture(Status = 'Connected') {
    const Calls = []; const States = []; let Index = 0;
    const Auth = { isAuthenticated: true, user: { id: 'ActorA', role: 'Manager' }, ProfileRevision: 1 };
    const Data = { Connections: [{ GrantID: 'Grant', Status, Shop: { Name: 'Test Shop', ShopID: '123' } }], Checks: {}, Run: (...Args) => Calls.push(Args) };
    const Context = { Date, useAuthStore: () => Auth, useTikTokConnection: () => Data,
        useState: Initial => { const Position = Index++; if (!(Position in States)) States[Position] = Initial;
            return [States[Position], Value => { States[Position] = Value; }]; },
        useSearchParams: () => [new URLSearchParams()],
        Element: (Type, Props, ...Children) => typeof Type === 'function' ? Type(Props) : { Type, Props: Props || {}, Children: Children.flat(Infinity) },
        Button: 'Button', RefreshCw: 'Icon', Link2: 'Icon', Zap: 'Icon', SettingsTabs: 'Tabs', Dialog: 'Dialog', DialogContent: 'DialogContent',
        DialogHeader: 'Header', DialogTitle: 'Title', DialogDescription: 'Description', DialogFooter: 'Footer' };
    Run(Code, Context);
    return { Calls, Auth, Data, Render: () => { Index = 0; return Context.APIConnection(); } };
}
function Find(Node, Predicate) {
    if (!Node || typeof Node !== 'object') return;
    if (Predicate(Node)) return Node;
    for (const Child of Node.Children || []) { const Match = Find(Child, Predicate); if (Match) return Match; }
}
Test('connection UI exposes all six read checks and does not sync or pay', () => {
    const F = Fixture(); const Tree = F.Render();
    for (const Dataset of ['Orders', 'Products', 'Returns', 'Floating', 'Statements', 'Withdrawals']) {
        const Button = Find(Tree, Node => Node.Type === 'Button' && Node.Children.includes(Dataset));
        Assert.ok(Button); Button.Props.onClick();
        Assert.deepEqual(F.Calls.at(-1), ['CheckData', 'Grant', Dataset]);
    }
    F.Auth.isLocked = true; Assert.equal(F.Render(), null);
    F.Auth.isLocked = false; F.Auth.user.role = 'Agent'; Assert.equal(F.Render(), null);
});
Test('pending confirmation cannot read; disconnect requires a separate confirm click', () => {
    const F = Fixture('PendingConfirmation'); let Tree = F.Render();
    Assert.equal(Find(Tree, Node => Node.Children?.includes('Orders')), undefined);
    Find(Tree, Node => Node.Type === 'Button' && Node.Children.includes('Confirm Test Shop')).Props.onClick();
    Assert.deepEqual(F.Calls.pop(), ['Confirm', 'Grant']);
    Find(Tree, Node => Node.Type === 'Button' && Node.Children.includes('Disconnect')).Props.onClick();
    Assert.equal(F.Calls.length, 0); Tree = F.Render();
    const Dialog = Find(Tree, Node => Node.Type === 'Dialog'); Assert.equal(Dialog.Props.open, true);
    Find(Dialog, Node => Node.Type === 'Button' && Node.Children.includes('Disconnect')).Props.onClick();
    Assert.deepEqual(F.Calls.pop(), ['Disconnect', 'Grant']);
});

const ClientSource = (await ReadFile(new URL('../Src/Lib/TikTokConnection.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?$/gm, '').replaceAll('export async function', 'async function').replaceAll('export function', 'function');
Test('connection client supports baseline auth fields and rejects a late response after logout', async () => {
    let Current = { isAuthenticated: true, isLocked: false, user: { id: 'A' } };
    let Logout = false;
    const Context = { URL, Set, Error, useAuthStore: { getState: () => Current },
        supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'FixtureToken', user: { id: 'A' } } } }) } },
        fetch: async () => {
            if (Logout) Current = { ...Current, isAuthenticated: false, user: null };
            return { ok: true, json: async () => ({ Connections: [] }) };
        } };
    Run(ClientSource, Context);
    Assert.equal((await Context.FetchTikTokConnection('/api/TikTokConnection')).Connections.length, 0);
    Logout = true;
    await Assert.rejects(Context.FetchTikTokConnection('/api/TikTokConnection'), /session changed/);
});
Test('client rejects credential exfiltration destinations and late responses after lock/account changes', async () => {
    let Current = { isAuthenticated: true, user: { id: 'A' }, ProfileRevision: 1 };
    const Context = { URL, Set, Error, useAuthStore: { getState: () => Current },
        supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'PrivateSession', user: { id: 'A' } } } }) } },
        fetch: async () => { Current = { ...Current, isLocked: true }; return { ok: true, json: async () => ({ Connections: [] }) }; } };
    Run(ClientSource, Context);
    Assert.throws(() => Context.ValidateTikTokDestination('https://evil.test/open/authorize'));
    await Assert.rejects(Context.FetchTikTokConnection('https://evil.test', undefined, new AbortController().signal));
    await Assert.rejects(Context.FetchTikTokConnection('/api/TikTokConnection', undefined, new AbortController().signal), /session changed/);
});
