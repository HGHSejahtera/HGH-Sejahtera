import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { readFile as ReadFile } from 'node:fs/promises';
import { runInNewContext as RunInNewContext } from 'node:vm';
import { transformWithOxc as TransformWithOxc } from 'vite';
import { AutomaticPriceFields, FormatProductPrice, UpdateProductPrice } from '../Src/Lib/ProductPricing.js';

const Source = (await ReadFile(new URL('../Src/Pages/Inventory/ProductModal.jsx', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?$/gm, '').replace('export function ProductModal', 'function ProductModal');
const { code: Code } = await TransformWithOxc(Source, 'ProductModal.jsx', {
    jsx: { runtime: 'classic', pragma: 'Element', pragmaFrag: 'Fragment' },
});
function Find(Node, Predicate) {
    if (!Node || typeof Node !== 'object') return;
    if (Predicate(Node)) return Node;
    for (const Child of Node.Children || []) { const Found = Find(Child, Predicate); if (Found) return Found; }
}
function Fixture(Product = null, Save = async () => ({ ProductID: 'Test' })) {
    const States = [], Refs = [];
    let Index = 0, RefIndex = 0, Scanner, Closed = 0;
    const Context = {
        AutomaticPriceFields, FormatProductPrice, UpdateProductPrice,
        useState: Initial => { const Position = Index++; if (!(Position in States)) States[Position] = Initial;
            return [States[Position], Value => { States[Position] = typeof Value === 'function' ? Value(States[Position]) : Value; }]; },
        useRef: Initial => { const Position = RefIndex++; return Refs[Position] ||= { current: Initial }; },
        useEffect: () => {}, useMemo: Compute => Compute(),
        useProductScanner: (Enabled, ReadSnapshot, OnScan) => { Scanner = { Enabled, ReadSnapshot, OnScan }; },
        useProducts: () => ({ data: [], addProduct: { mutateAsync: Save }, updateProduct: { mutateAsync: Save } }),
        useBrands: () => ({ data: [] }), useCategories: () => ({ data: [] }),
        useBulkUpdatePricing: () => ({}), useTranslation: () => ({ t: Value => Value }),
        Element: (Type, Props, ...Children) => ({ Type, Props: Props || {}, Children }),
        Button: 'Button', Input: 'Input', Label: 'Label', CreatableCombobox: 'CreatableCombobox',
        ImageDropzone: 'ImageDropzone', X: 'X', AlertTriangle: 'AlertTriangle', Wand2: 'Wand2',
        console: { error() {} },
    };
    RunInNewContext(Code, Context);
    const Render = () => { Index = 0; RefIndex = 0;
        return Context.ProductModal({ isOpen: true, product: Product, onClose: () => Closed++ }); };
    const ClickSave = () => {
        const Button = Find(Render(), Node => Node.Type === 'Button' && Node.Children.includes('Save Product'));
        if (Button.Props.onClick) return Button.Props.onClick();
        return Find(Render(), Node => Node.Type === 'form').Props.onSubmit({ preventDefault() {} });
    };
    return { Render, ClickSave, GetScanner: () => Scanner, Closed: () => Closed };
}

Test('saving a product without a barcode leaves it unassigned', async () => {
    let Saved;
    const UI = Fixture(null, async Data => { Saved = Data; return { ProductID: 'Test' }; });
    await UI.ClickSave();
    Assert.equal(Saved.Barcode, null);
    Assert.equal(Saved.SellerSKU, null);
});

function ChangePrice(UI, Name, Value) {
    Find(UI.Render(), Node => Node.Props.id === Name).Props.onChange({ target: { name: Name, value: Value } });
}
function ReadPrice(UI, Name) { return Find(UI.Render(), Node => Node.Props.id === Name).Props.value; }

Test('Cost Price fills the four requested prices and leaves Agent Price alone', async () => {
    let Saved;
    const UI = Fixture(null, async Data => { Saved = Data; return { ProductID: 'Test' }; });
    ChangePrice(UI, 'AgentPrice', '45.00');
    ChangePrice(UI, 'CostPrice', '10.10');
    Assert.equal(ReadPrice(UI, 'FakeCostPrice'), '11.10');
    Assert.equal(ReadPrice(UI, 'StockistPrice'), '12.10');
    Assert.equal(ReadPrice(UI, 'WholesalePrice'), '13.10');
    Assert.equal(ReadPrice(UI, 'RetailPrice'), '20.20');
    Assert.equal(ReadPrice(UI, 'AgentPrice'), '45.00');
    ChangePrice(UI, 'RetailPrice', '21.50');
    await UI.ClickSave();
    Assert.equal(Saved.RetailPrice, 21.5);
});

Test('opening Edit preserves stored prices without applying new formulas', () => {
    const UI = Fixture({ ProductID: 'Test', CostPrice: 10, FakeCostPrice: 18,
        StockistPrice: 20, WholesalePrice: 22, RetailPrice: 50 });
    Assert.equal(ReadPrice(UI, 'FakeCostPrice'), 18);
    Assert.equal(ReadPrice(UI, 'RetailPrice'), 50);
});

Test('manual price survives changing cost; scanner restores automatic price state', async () => {
    const UI = Fixture();
    ChangePrice(UI, 'CostPrice', '10');
    ChangePrice(UI, 'RetailPrice', '30');
    ChangePrice(UI, 'CostPrice', '12');
    Assert.equal(ReadPrice(UI, 'RetailPrice'), '30');
    Assert.equal(ReadPrice(UI, 'StockistPrice'), '14.00');
    UI.Render();
    const Snapshot = UI.GetScanner().ReadSnapshot();
    // A scanner briefly types into a price input before its terminating key.
    ChangePrice(UI, 'StockistPrice', '1412345678');
    await UI.GetScanner().OnScan('12345678', Snapshot);
    Assert.equal(ReadPrice(UI, 'StockistPrice'), '14.00');
    ChangePrice(UI, 'CostPrice', '15');
    Assert.equal(ReadPrice(UI, 'StockistPrice'), '17.00');
    Assert.equal(ReadPrice(UI, 'RetailPrice'), '30');
});
Test('Enter submit alone never saves a product', async () => {
    let Count = 0;
    const UI = Fixture(null, async () => { Count++; return { ProductID: 'Test' }; });
    await Find(UI.Render(), Node => Node.Type === 'form').Props.onSubmit({ preventDefault() {} });
    Assert.equal(Count, 0);
    let Prevented = false;
    UI.Render().Props.onKeyDownCapture({ key: 'Enter', target: { tagName: 'BUTTON' }, preventDefault() { Prevented = true; } });
    Assert.equal(Prevented, true, 'scanner Enter cannot activate a focused Save button');
});
Test('Add scan restores other fields, replaces barcode and waits for Save', async () => {
    let Count = 0;
    const UI = Fixture(null, async () => { Count++; return { ProductID: 'Test' }; });
    UI.Render();
    const Snapshot = UI.GetScanner().ReadSnapshot();
    Find(UI.Render(), Node => Node.Props.id === 'ProductName').Props.onChange({ target: { name: 'ProductName', value: '12345678' } });
    await UI.GetScanner().OnScan('0012345678901', Snapshot);
    Assert.equal(Find(UI.Render(), Node => Node.Props.id === 'Barcode').Props.value, '0012345678901');
    Assert.equal(Find(UI.Render(), Node => Node.Props.id === 'ProductName').Props.value, '');
    Assert.equal(Count, 0);
    Assert.equal(Find(UI.Render(), Node => Node.Props.id === 'FastScan'), undefined);
});
Test('Edit scan defaults to manual save; fast mode saves new barcode once', async () => {
    const Saved = [];
    const UI = Fixture({ ProductID: 'Test', Barcode: '11111111', ProductName: 'Original' }, async Data => Saved.push(Data));
    let Tree = UI.Render();
    Assert.equal(Find(Tree, Node => Node.Props.id === 'FastScan').Props.checked, false);
    await UI.GetScanner().OnScan('22222222', UI.GetScanner().ReadSnapshot());
    Assert.equal(Saved.length, 0);
    Tree = UI.Render();
    Find(Tree, Node => Node.Props.id === 'FastScan').Props.onChange({ target: { checked: true } });
    UI.Render();
    await UI.GetScanner().OnScan('33333333', UI.GetScanner().ReadSnapshot());
    Assert.equal(Saved.length, 1);
    Assert.equal(Saved[0].updates.Barcode, '33333333');
    Assert.equal(Saved[0].updates.ProductName, 'Original');
    Assert.equal(UI.Closed(), 1);
});
Test('fast save failure keeps the form open; concurrent scan cannot save twice', async () => {
    let Reject, Count = 0;
    const UI = Fixture({ ProductID: 'Test', Barcode: '11111111' }, () => { Count++; return new Promise((Resolve, Fail) => { Reject = Fail; }); });
    Find(UI.Render(), Node => Node.Props.id === 'FastScan').Props.onChange({ target: { checked: true } });
    UI.Render();
    const Pending = UI.GetScanner().OnScan('22222222', UI.GetScanner().ReadSnapshot());
    await UI.GetScanner().OnScan('33333333', UI.GetScanner().ReadSnapshot());
    Reject(new Error('Save rejected'));
    await Pending;
    Assert.equal(Count, 1);
    Assert.equal(UI.Closed(), 0);
    Assert.equal(Find(UI.Render(), Node => Node.Props.id === 'Barcode').Props.value, '22222222');
});
