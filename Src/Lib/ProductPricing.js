export const AutomaticPriceFields = Object.freeze(['FakeCostPrice', 'StockistPrice', 'WholesalePrice', 'RetailPrice', 'AgentPrice']);

function ReadSen(Value) {
    const Text = String(Value ?? '').trim();
    if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(Text)) return null;
    const [Ringgit, Fraction = ''] = Text.split('.');
    const Sen = Number(Ringgit || '0') * 100 + Number(Fraction.padEnd(2, '0'));
    return Number.isSafeInteger(Sen) && Sen <= Math.floor((Number.MAX_SAFE_INTEGER - 300) / 2) ? Sen : null;
}

function FormatSen(Sen) {
    return `${Math.floor(Sen / 100)}.${String(Sen % 100).padStart(2, '0')}`;
}

export function FormatProductPrice(Value) {
    const Sen = ReadSen(Value);
    return Sen === null ? Value : FormatSen(Sen);
}

export function AutoFillProductPrices(Values) {
    if (ReadSen(Values.CostPrice) === null) return null;
    return UpdateProductPrice({ ...Values, ManualPriceFields: {} }, 'CostPrice', Values.CostPrice);
}

export function UpdateProductPrice(Values, Field, Value) {
    const ManualPriceFields = Values.ManualPriceFields || {};
    if (AutomaticPriceFields.includes(Field)) {
        return { ...Values, [Field]: Value, ManualPriceFields: { ...ManualPriceFields, [Field]: true } };
    }
    const Updated = { ...Values, [Field]: Value };
    if (Field !== 'CostPrice') return Updated;
    const Empty = String(Value).trim() === '';
    const Sen = ReadSen(Value);
    if (!Empty && Sen === null) return Updated;
    const Suggestions = Empty ? Object.fromEntries(AutomaticPriceFields.map(Name => [Name, ''])) : {
        FakeCostPrice: FormatSen(Sen + 100),
        StockistPrice: FormatSen(Sen + 200),
        WholesalePrice: FormatSen(Sen + 300),
        RetailPrice: FormatSen(Sen * 2),
        AgentPrice: FormatSen(Sen + 150),
    };
    for (const Name of AutomaticPriceFields) {
        if (!ManualPriceFields[Name]) Updated[Name] = Suggestions[Name];
    }
    return Updated;
}
