import Test from 'node:test';
import Assert from 'node:assert/strict';
import { ReadTikTokSample } from '../api/_utils/TikTokReaders.js';
import { CreateTikTokClient, TikTokError } from '../api/_utils/TikTokClient.js';

const Row = { Shop: { Cipher: 'PrivateCipher' } }; const Tokens = { access_token: 'PrivateToken' };
Test('all six data readers use fixed read endpoints, bounded samples and distinct date filters', async () => {
    const Cases = { Orders: ['orders', '/order/202309/orders/search'], Products: ['products', '/product/202312/products/search'],
        Returns: ['return_orders', '/return_refund/202309/returns/search'], Floating: ['transactions', '/finance/202507/orders/unsettled'],
        Statements: ['statements', '/finance/202309/statements'], Withdrawals: ['withdrawals', '/finance/202309/withdrawals'] };
    for (const [Dataset, [Field, Path]] of Object.entries(Cases)) {
        const Provider = { Request: async (ActualPath, Token, Query, Body) => {
            Assert.equal(ActualPath, Path); Assert.equal(Token, 'PrivateToken'); Assert.equal(Query.page_size, '20');
            Assert.equal(Query.shop_cipher, 'PrivateCipher');
            if (Dataset === 'Orders') Assert.equal(Body.create_time_lt, 1800000000);
            if (Dataset === 'Returns') Assert.equal(Body.update_time_lt, 1800000000);
            if (Dataset === 'Floating') { Assert.equal(Query.search_time_lt, 1800000000); Assert.equal(Query.sort_field, 'order_create_time'); }
            if (Dataset === 'Withdrawals') Assert.equal(Query.types, 'WITHDRAW,REVERSE');
            return { [Field]: [], next_page_token: '' };
        } };
        const Result = await ReadTikTokSample(Provider, Row, Tokens, Dataset, 1800000000);
        Assert.equal(Result.Status, 'NoData'); Assert.equal(Result.Estimated, Dataset === 'Floating');
        Assert.ok(!JSON.stringify(Result).includes('Private'));
    }
});
Test('readers preserve empty versus malformed/error responses and label partial samples', async () => {
    await Assert.rejects(ReadTikTokSample({ Request: async () => ({}) }, Row, Tokens, 'Orders', 1800000000));
    await Assert.rejects(ReadTikTokSample({ Request: async () => { throw new TikTokError('ScopeRequired'); } }, Row, Tokens, 'Orders', 1800000000), /ScopeRequired/);
    await Assert.rejects(ReadTikTokSample({}, Row, Tokens, '__proto__', 1800000000));
    const Result = await ReadTikTokSample({ Request: async () => ({ statements: [{ id: '90071992547409931', settlement_amount: '0.00', buyer_name: 'PrivatePerson' }], next_page_token: 'PrivateCursor' }) }, Row, Tokens, 'Statements', 1800000000);
    Assert.equal(Result.SampleCount, 1); Assert.equal(Result.HasMore, true); Assert.equal(Result.Evidence.AmountStringSeen, true);
    Assert.ok(!JSON.stringify(Result).includes('Private'));
});
Test('API client redacts transport errors and refuses redirects, business errors and oversized payloads', async () => {
    const Config = { AppKey: 'App', AppSecret: 'PrivateSecret' };
    for (const Fetch of [async () => { throw new Error('https://secret.test/?PrivateSecret'); },
        async () => new Response(JSON.stringify({ code: 100, message: 'PrivateSecret' })),
        async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))]) {
        const Client = CreateTikTokClient(Config, Fetch);
        await Assert.rejects(Client.Shops('PrivateToken'), Failure => Failure instanceof TikTokError && !Failure.message.includes('Private'));
    }
    const Client = CreateTikTokClient(Config, async (URLValue, Options) => {
        Assert.equal(URLValue.origin, 'https://open-api.tiktokglobalshop.com'); Assert.equal(Options.redirect, 'error');
        Assert.equal(Options.headers['x-tts-access-token'], 'PrivateToken');
        Assert.ok(!URLValue.href.includes('PrivateToken')); return new Response(JSON.stringify({ code: 0, data: { shops: [] } }));
    });
    Assert.deepEqual(await Client.Shops('PrivateToken'), { shops: [] });
    await Assert.rejects(Client.Request('/evil/path', 'PrivateToken'));
});
