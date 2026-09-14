import { Hash, RandomToken, EncryptTokens, DecryptTokens, ValidateTokens } from './TikTokCredentials.js';
import { TikTokError } from './TikTokClient.js';
import { IsTikTokDataset, ReadTikTokSample } from './TikTokReaders.js';

const Hex = Value => typeof Value === 'string' && /^[a-f0-9]{64}$/.test(Value);
const Fail = (Kind, Status = 409) => { throw new TikTokError(Kind, Status); };

export function CreateTikTokConnection({ Config, Store, Provider, CheckActor, Now = () => Math.floor(Date.now() / 1000) }) {
    const Call = (Action, Input) => Store(Action, { ...Input, AppKey: Config.AppKey, Environment: 'Test' });
    async function Owned(ActorUserID, GrantID) {
        await CheckActor(ActorUserID);
        if (!Hex(GrantID)) Fail('InvalidConnection', 400);
        const Row = await Call('Get', { ActorUserID, GrantID });
        if (!Row || Row.ActorUserID !== ActorUserID || Row.Environment !== 'Test' ||
            Row.AppKey !== Config.AppKey || Row.Shop?.ShopID !== Config.TestShopID) Fail('ConnectionNotFound', 404);
        return Row;
    }
    const View = Row => ({ GrantID: Row.GrantID, Status: Row.Status, Environment: 'Test',
        Shop: { ShopID: Row.Shop.ShopID, Name: Row.Shop.Name, Region: Row.Shop.Region },
        AccessExpiresAt: Row.AccessExpiresAt, RefreshExpiresAt: Row.RefreshExpiresAt,
        UpdatedAt: Row.UpdatedAt, LastCheckedAt: Row.LastCheckedAt || null });
    async function Start(ActorUserID) {
        await CheckActor(ActorUserID);
        const State = RandomToken(); const Browser = RandomToken();
        const Created = await Call('CreateIntent', { ActorUserID, StateHash: Hash(State), BrowserHash: Hash(Browser),
            ExpectedShopID: Config.TestShopID, CreatedAt: Now(), ExpiresAt: Now() + 600 });
        if (!Created) Fail('RateLimited', 429);
        const URLValue = new URL('https://services.tiktokshop.com/open/authorize');
        URLValue.search = new URLSearchParams({ service_id: Config.ServiceID, state: State }).toString();
        return { URL: URLValue.href, State, Browser };
    }
    async function Callback({ State, Browser, Code, Denied = false }) {
        if (!Hex(State) || !Hex(Browser)) Fail('InvalidAuthorization', 400);
        const Intent = await Call('ClaimIntent', { StateHash: Hash(State), BrowserHash: Hash(Browser) });
        if (!Intent || Intent.Environment !== 'Test' || Intent.AppKey !== Config.AppKey ||
            Intent.ExpectedShopID !== Config.TestShopID || Intent.ExpiresAt <= Now()) Fail('InvalidAuthorization', 400);
        if (Denied) Fail('AuthorizationDenied', 400);
        if (typeof Code !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(Code) || Code === 'null') Fail('InvalidAuthorization', 400);
        await CheckActor(Intent.ActorUserID);
        const Tokens = ValidateTokens(await Provider.Exchange(Code), Now());
        const Data = await Provider.Shops(Tokens.access_token);
        const Shops = Array.isArray(Data?.shops) ? Data.shops.filter(Shop => Shop.id === Config.TestShopID) : [];
        if (Shops.length !== 1 || Shops[0].region !== 'MY' || typeof Shops[0].cipher !== 'string' ||
            !Shops[0].cipher || Shops[0].cipher.length > 2048 || typeof Shops[0].name !== 'string' || Shops[0].name.length > 200) Fail('WrongShop', 403);
        await CheckActor(Intent.ActorUserID);
        const GrantID = Hash(`${Config.AppKey}\0${Tokens.open_id}\0Test`);
        const Saved = await Call('StageGrant', { GrantID, ActorUserID: Intent.ActorUserID, SellerID: Tokens.open_id,
            IntentHash: Hash(State), IntentCreatedAt: Intent.CreatedAt, Status: 'PendingConfirmation', ConfirmBy: Now() + 600,
            Envelope: EncryptTokens(Tokens, `${GrantID}:Test`, Config.Keys),
            AccessExpiresAt: Tokens.access_token_expire_in, RefreshExpiresAt: Tokens.refresh_token_expire_in,
            Shop: { ShopID: Shops[0].id, Name: Shops[0].name, Region: 'MY', Cipher: Shops[0].cipher }, UpdatedAt: Now() });
        if (!Saved) Fail('ConnectionConflict');
    }
    async function List(ActorUserID) {
        await CheckActor(ActorUserID);
        const Rows = await Call('List', { ActorUserID });
        if (!Array.isArray(Rows)) Fail('StorageUnavailable', 503);
        return Rows.filter(Row => Row.ActorUserID === ActorUserID && Row.Environment === 'Test' &&
            Row.AppKey === Config.AppKey && Row.Shop?.ShopID === Config.TestShopID).map(View);
    }
    async function Confirm(ActorUserID, GrantID) {
        const Row = await Owned(ActorUserID, GrantID);
        if (Row.Status !== 'PendingConfirmation' || Row.ConfirmBy <= Now() || Row.AccessExpiresAt <= Now()) Fail('AuthorizationExpired');
        if (!await Call('Confirm', { ActorUserID, GrantID, Version: Row.Version })) Fail('ConnectionChanged');
    }
    async function Disconnect(ActorUserID, GrantID) {
        const Row = await Owned(ActorUserID, GrantID);
        if (!await Call('Disconnect', { ActorUserID, GrantID, Version: Row.Version })) Fail('ConnectionChanged');
    }
    async function Reconnect(Row) {
        await Call('Reconnect', { ActorUserID: Row.ActorUserID, GrantID: Row.GrantID, Version: Row.Version });
        Fail('ReconnectRequired');
    }
    async function Access(ActorUserID, GrantID) {
        let Row = await Owned(ActorUserID, GrantID);
        if (Row.Status !== 'Connected') Fail('ReconnectRequired');
        if (Row.RefreshExpiresAt <= Now() || (Row.LeaseID && Row.LeaseUntil <= Now())) return Reconnect(Row);
        if (Row.LeaseID) Fail('ConnectionBusy');
        let Tokens;
        try { Tokens = DecryptTokens(Row.Envelope, `${GrantID}:Test`, Config.Keys); }
        catch { Fail('CredentialUnavailable', 503); }
        if (Row.AccessExpiresAt <= Now() + 120) {
            const LeaseID = RandomToken();
            Row = await Call('AcquireRefresh', { ActorUserID, GrantID, Version: Row.Version, LeaseID });
            if (!Row) Fail('ConnectionBusy');
            try {
                Tokens = ValidateTokens(await Provider.Refresh(Tokens.refresh_token, Row.SellerID), Now(), Row.SellerID);
                await CheckActor(ActorUserID);
                const Saved = await Call('FinishRefresh', { ActorUserID, GrantID, Version: Row.Version, LeaseID,
                    Update: { Envelope: EncryptTokens(Tokens, `${GrantID}:Test`, Config.Keys),
                        AccessExpiresAt: Tokens.access_token_expire_in, RefreshExpiresAt: Tokens.refresh_token_expire_in, UpdatedAt: Now() } });
                if (!Saved) Fail('ConnectionChanged');
            } catch {
                // A timed-out refresh may already have rotated the provider token.
                // CAS prevents this failure from clobbering a disconnect/new grant.
                await Call('Reconnect', { ActorUserID, GrantID, Version: Row.Version });
                Fail('ReconnectRequired');
            }
        }
        const Current = await Owned(ActorUserID, GrantID);
        if (Current.Status !== 'Connected' || Current.LeaseID) Fail('ConnectionChanged');
        // Always read the current envelope after races; never return a replaced token.
        try { Tokens = ValidateTokens(DecryptTokens(Current.Envelope, `${GrantID}:Test`, Config.Keys), Now(), Current.SellerID); }
        catch { Fail('CredentialUnavailable', 503); }
        return { Row: Current, Tokens };
    }
    async function CheckData(ActorUserID, GrantID, Dataset) {
        if (!IsTikTokDataset(Dataset)) Fail('InvalidDataset', 400);
        const Initial = await Owned(ActorUserID, GrantID);
        if (Initial.Status !== 'Connected') Fail('ReconnectRequired');
        const CheckID = RandomToken();
        if (!await Call('BeginCheck', { ActorUserID, GrantID, Dataset, CheckID, Version: Initial.Version })) Fail('RateLimited', 429);
        const { Row, Tokens } = await Access(ActorUserID, GrantID);
        let Result;
        try { Result = await ReadTikTokSample(Provider, Row, Tokens, Dataset, Now()); }
        catch (Failure) {
            if (Failure instanceof TikTokError && Failure.Kind === 'ReconnectRequired') return Reconnect(Row);
            throw Failure;
        }
        await CheckActor(ActorUserID);
        if (!await Call('FinishCheck', { ActorUserID, GrantID, Dataset, CheckID, Version: Row.Version, CheckedAt: Result.CheckedAt })) Fail('ConnectionChanged');
        return Result;
    }
    return { Start, Callback, List, Confirm, Disconnect, Access, CheckData };
}
