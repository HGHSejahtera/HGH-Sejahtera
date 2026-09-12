import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { FormatProductPrice, UpdateProductPrice } from '../Src/Lib/ProductPricing.js';

Test('price suggestions use exact cents, including zero and leading decimals', () => {
    for (const [Cost, Fake, Retail] of [['0', '1.00', '0.00'], ['0.29', '1.29', '0.58'],
        ['.05', '1.05', '0.10'], ['999.99', '1000.99', '1999.98']]) {
        const Result = UpdateProductPrice({}, 'CostPrice', Cost);
        Assert.equal(Result.FakeCostPrice, Fake);
        Assert.equal(Result.RetailPrice, Retail);
    }
    Assert.equal(FormatProductPrice('0010.1'), '10.10');
    Assert.equal(UpdateProductPrice({}, 'CostPrice', '10.10').AgentPrice, '11.60');
    Assert.equal(UpdateProductPrice({}, 'CostPrice', '0.29').AgentPrice, '1.79');
});
Test('manual prices including zero and empty stay manual through later cost changes', () => {
    let Draft = UpdateProductPrice({}, 'CostPrice', '10');
    Draft = UpdateProductPrice(Draft, 'RetailPrice', '0');
    Draft = UpdateProductPrice(Draft, 'FakeCostPrice', '');
    const Result = UpdateProductPrice(Draft, 'CostPrice', '20');
    Assert.equal(Result.RetailPrice, '0');
    Assert.equal(Result.FakeCostPrice, '');
    Assert.equal(Result.StockistPrice, '22.00');
    Assert.equal(Result.WholesalePrice, '23.00');
    Assert.equal(Draft.CostPrice, '10', 'previous draft is not mutated');
});
Test('clearing cost clears automatic suggestions, but invalid cost invents no prices', () => {
    let Draft = UpdateProductPrice({}, 'CostPrice', '10');
    Draft = UpdateProductPrice(Draft, 'RetailPrice', '35.00');
    const Cleared = UpdateProductPrice(Draft, 'CostPrice', '');
    Assert.equal(Cleared.FakeCostPrice, '');
    Assert.equal(Cleared.RetailPrice, '35.00');
    for (const Invalid of ['-1', '1.005', 'Infinity', '1e3', 'invalid', '999999999999999999999']) {
        Assert.equal(UpdateProductPrice(Draft, 'CostPrice', Invalid).StockistPrice, '12.00');
        Assert.equal(FormatProductPrice(Invalid), Invalid);
    }
});
