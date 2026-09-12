import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { readFile as ReadFile } from 'node:fs/promises';
import { runInNewContext as RunInNewContext } from 'node:vm';
import { transformWithOxc as TransformWithOxc } from 'vite';

const Original = await ReadFile(new URL('../Src/Pages/Inventory/InventoryDashboard.jsx', import.meta.url), 'utf8');
const Names = [...Original.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g)]
    .flatMap(Match => Match[1].split(',').map(Name => Name.trim()).filter(Boolean));
const Source = Original.replace(/^import[\s\S]*?;\r?$/gm, '')
    .replace('export function InventoryDashboard', 'function InventoryDashboard');
const { code: Code } = await TransformWithOxc(Source, 'InventoryDashboard.jsx', {
    jsx: { runtime: 'classic', pragma: 'Element', pragmaFrag: 'Fragment' },
});
function Find(Node, Predicate) {
    if (!Node || typeof Node !== 'object') return;
    if (Predicate(Node)) return Node;
    for (const Child of Node.Children || []) { const Found = Find(Child, Predicate); if (Found) return Found; }
}
function Fixture() {
    const States = [];
    let Index = 0, Refreshes = 0;
    const Context = {
        ...Object.fromEntries(Names.map(Name => [Name, Name])),
        Fragment: 'Fragment',
        Element: (Type, Props, ...Children) => ({ Type, Props: Props || {}, Children }),
        useState: Initial => { const Position = Index++; if (!(Position in States)) States[Position] = typeof Initial === 'function' ? Initial() : Initial;
            return [States[Position], Value => { States[Position] = typeof Value === 'function' ? Value(States[Position]) : Value; }]; },
        useMemo: Compute => Compute(), useProducts: () => ({}), useSecretMode: () => ({ isHGHMode: false }),
        useInventoryProducts: () => ({ data: [], refetch: () => Refreshes++ }),
        useInventoryLogs: () => ({ data: [] }), useProductMatcher: () => ({}),
        cn: (...Values) => Values.filter(Value => typeof Value === 'string').join(' '),
    };
    RunInNewContext(Code, Context);
    const Render = () => { Index = 0; return Context.InventoryDashboard(); };
    const Toolbar = () => Find(Render(), Node => Node.Type === 'DataTable').Props.rightActionElement;
    return { Render, Toolbar, Refreshes: () => Refreshes };
}
Test('scan toggle sits immediately before Refresh and persists across modal reopen and data refresh', () => {
    const UI = Fixture();
    const Toolbar = UI.Toolbar();
    const Toggle = Toolbar.Children[0];
    Assert.equal(Toggle.Props['aria-label'], 'Manual Scan');
    Assert.ok(Toggle.Children.includes('Manual Scan'));
    Assert.equal(Toggle.Props['aria-pressed'], false);
    Assert.equal(Toolbar.Children[1].Props.title, 'Refresh Inventory');
    Toggle.Props.onClick();
    Assert.equal(UI.Toolbar().Children[0].Props['aria-pressed'], true);
    Assert.ok(UI.Toolbar().Children[0].Children.includes('Auto Scan'));
    for (let Open = 0; Open < 2; Open++) {
        Find(UI.Render(), Node => Node.Type === 'Button' && Node.Children.includes('Add Product')).Props.onClick();
        const Modal = Find(UI.Render(), Node => Node.Type === 'ProductModal');
        Assert.equal(Modal.Props.ScanAutoSave, true);
        Modal.Props.onClose();
    }
    UI.Toolbar().Children[1].Props.onClick();
    Assert.equal(UI.Refreshes(), 1);
    Assert.equal(UI.Toolbar().Children[0].Props['aria-pressed'], true);
    UI.Toolbar().Children[0].Props.onClick();
    Assert.equal(UI.Toolbar().Children[0].Props['aria-pressed'], false);
    Assert.equal(Fixture().Toolbar().Children[0].Props['aria-pressed'], false);
});
