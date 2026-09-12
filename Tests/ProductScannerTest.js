import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { CreateProductScanner } from '../Src/Lib/ProductScanner.js';

function Fixture() {
    let Time = 0;
    const Scans = [], Target = { tagName: 'INPUT', value: 'Original', isConnected: false };
    const Scanner = CreateProductScanner(() => ({ Name: Target.value }), (...Args) => Scans.push(Args), () => Time);
    function Key(Value, Delay = 10, Extra = {}) {
        Time += Delay;
        const Event = { key: Value, target: Target, preventDefault() { this.Prevented = true; },
            stopImmediatePropagation() { this.Stopped = true; }, ...Extra };
        Scanner.KeyDown(Event);
        if (Value.length === 1) Target.value += Value;
        return Event;
    }
    return { Scans, Key, Scanner, Target };
}
Test('scanner Enter and Tab replace complete values and preserve leading zeros', () => {
    for (const Suffix of ['Enter', 'Tab']) {
        const F = Fixture();
        for (const Digit of '0012345678901') F.Key(Digit);
        const End = F.Key(Suffix);
        Assert.equal(End.Prevented, true);
        Assert.equal(End.Stopped, true);
        Assert.equal(F.Scans[0][0], '0012345678901');
        Assert.equal(F.Scans[0][1].Name, 'Original');
        F.Key(Suffix);
        Assert.equal(F.Scans.length, 1);
    }
});
Test('normal typing, short bursts, stale scans and shortcuts do not scan', () => {
    for (const [Code, Delay, FinishDelay] of [['12345678', 120, 10], ['123', 10, 10], ['12345678', 10, 1000]]) {
        const F = Fixture();
        for (const Digit of Code) F.Key(Digit, Delay);
        F.Key('Enter', FinishDelay);
        Assert.equal(F.Scans.length, 0);
    }
    const F = Fixture();
    for (const Digit of '12345678') F.Key(Digit);
    F.Key('v', 10, { ctrlKey: true });
    F.Key('Enter');
    Assert.equal(F.Scans.length, 0);
});
Test('focus change or pointer reset cannot combine separate inputs into a barcode', () => {
    const F = Fixture();
    for (const Digit of '12345678') F.Key(Digit);
    F.Scanner.Reset();
    F.Key('Enter');
    Assert.equal(F.Scans.length, 0);
    for (const Digit of '1234') F.Key(Digit);
    F.Key('5', 10, { target: {} });
    for (const Digit of '678') F.Key(Digit);
    F.Key('Enter');
    Assert.equal(F.Scans.length, 0);
});
