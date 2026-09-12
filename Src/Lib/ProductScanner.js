// Keyboard-wedge scanners have no browser device identity. Recognize only a
// rapid numeric burst with Enter/Tab; normal typing and paste stay native.
export function CreateProductScanner(ReadSnapshot, OnScan, Now = () => performance.now()) {
    let Buffer = '', Started = 0, Last = 0, Snapshot, Target, OriginalValue, Selection;
    function Reset() { Buffer = ''; Snapshot = undefined; Target = undefined; }
    function KeyDown(Event) {
        if (Event.isComposing || Event.repeat || Event.ctrlKey || Event.altKey || Event.metaKey) { Reset(); return; }
        const Time = Now();
        const Terminator = Event.key === 'Enter' || Event.key === 'Tab';
        if (Terminator) {
            const IsScan = Buffer.length >= 8 && Time - Last <= 60 && (Last - Started) / (Buffer.length - 1) <= 35;
            if (IsScan) {
                Event.preventDefault();
                Event.stopImmediatePropagation();
                const Code = Buffer, Before = Snapshot;
                // Restore native/combobox search text before restoring React form state.
                if ((Target?.tagName === 'INPUT' || Target?.tagName === 'TEXTAREA') &&
                    typeof OriginalValue === 'string' && Target.isConnected) {
                    const View = Target.ownerDocument.defaultView;
                    const Prototype = Target.tagName === 'TEXTAREA' ? View.HTMLTextAreaElement.prototype : View.HTMLInputElement.prototype;
                    const Setter = Object.getOwnPropertyDescriptor(Prototype, 'value')?.set;
                    Setter?.call(Target, OriginalValue);
                    Target.dispatchEvent(new View.Event('input', { bubbles: true }));
                    if (Selection?.[0] != null) Target.setSelectionRange?.(...Selection);
                }
                Reset();
                OnScan(Code, Before);
            } else Reset();
            return;
        }
        if (!/^\d$/.test(Event.key)) { Reset(); return; }
        if (!Buffer || Time - Last > 60 || Target !== Event.target) {
            Buffer = ''; Started = Time; Snapshot = ReadSnapshot(); Target = Event.target;
            OriginalValue = Target?.value;
            Selection = [Target?.selectionStart, Target?.selectionEnd];
        }
        Buffer += Event.key;
        Last = Time;
        if (Buffer.length > 128) Reset();
    }
    return { KeyDown, Reset };
}
