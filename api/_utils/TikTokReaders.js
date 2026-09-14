import { TikTokError } from './TikTokClient.js';

// Official request tables checked 2026-09-12; only reads are permitted here.
// This is one bounded sample, not a sync cursor or a financial total.
const Definitions = {
    Orders: { Path: '/order/202309/orders/search', List: 'orders', ID: 'id', Sort: 'create_time',
        Body: (From, To) => ({ create_time_ge: From, create_time_lt: To }) },
    Products: { Path: '/product/202312/products/search', List: 'products', ID: 'id', Body: () => ({ status: 'ALL' }) },
    Returns: { Path: '/return_refund/202309/returns/search', List: 'return_orders', ID: 'return_id', Sort: 'update_time',
        Body: (From, To) => ({ update_time_ge: From, update_time_lt: To }) },
    Floating: { Path: '/finance/202507/orders/unsettled', List: 'transactions', ID: 'id', Sort: 'order_create_time',
        Filter: (From, To) => ({ search_time_ge: From, search_time_lt: To }) },
    Statements: { Path: '/finance/202309/statements', List: 'statements', ID: 'id', Sort: 'statement_time',
        Filter: (From, To) => ({ statement_time_ge: From, statement_time_lt: To }) },
    Withdrawals: { Path: '/finance/202309/withdrawals', List: 'withdrawals', ID: 'id',
        Filter: (From, To) => ({ create_time_ge: From, create_time_lt: To, types: 'WITHDRAW,REVERSE' }) },
};
export function IsTikTokDataset(Dataset) { return Object.hasOwn(Definitions, Dataset); }

export async function ReadTikTokSample(Provider, Row, Tokens, Dataset, Now) {
    if (!IsTikTokDataset(Dataset)) throw new TikTokError('InvalidDataset', 400);
    const Definition = Definitions[Dataset]; const From = Now - 30 * 86400;
    const Query = { shop_cipher: Row.Shop.Cipher, page_size: '20',
        ...(Definition.Sort ? { sort_field: Definition.Sort, sort_order: 'DESC' } : {}),
        ...(Definition.Filter ? Definition.Filter(From, Now) : {}) };
    const Data = await Provider.Request(Definition.Path, Tokens.access_token, Query, Definition.Body?.(From, Now));
    const Rows = Data?.[Definition.List]; const Next = Data?.next_page_token;
    if (!Array.isArray(Rows) || Rows.length > 20 || Rows.some(Item => !Item || typeof Item[Definition.ID] !== 'string' || !Item[Definition.ID]) ||
        (Next !== undefined && Next !== null && typeof Next !== 'string')) throw new TikTokError('InvalidResponse');
    // Only schema evidence leaves this function. No names, addresses, tracking,
    // provider cursors, raw financial amounts or customer messages reach the UI.
    const Evidence = {};
    if (Dataset === 'Products') Evidence.SellerSKUSeen = Rows.some(Item => Array.isArray(Item.skus) && Item.skus.some(SKU => typeof SKU.seller_sku === 'string'));
    if (Dataset === 'Orders') Evidence.OrderCreationTimeSeen = Rows.some(Item => Number.isSafeInteger(Item.create_time));
    if (Dataset === 'Returns') Evidence.ReturnStatusSeen = Rows.some(Item => typeof Item.return_status === 'string');
    if (Dataset === 'Statements' || Dataset === 'Withdrawals') {
        const Field = Dataset === 'Statements' ? 'settlement_amount' : 'amount';
        Evidence.AmountStringSeen = Rows.some(Item => typeof Item[Field] === 'string' && /^-?\d+(\.\d+)?$/.test(Item[Field]));
    }
    return { Dataset, Status: Rows.length ? 'DataFound' : 'NoData', SampleCount: Rows.length,
        HasMore: Boolean(Next), CheckedAt: Now, From: Dataset === 'Products' ? null : From, To: Now,
        Estimated: Dataset === 'Floating', Evidence };
}
