import { test as Test } from 'node:test';
import Assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac as CreateHMAC } from 'node:crypto';
import { EncryptTokens, DecryptTokens, ValidateTokens, SignRequest } from '../api/_utils/TikTokCredentials.js';

const Keys = { Current: '1', Values: { '1': Buffer.alloc(32, 7).toString('base64') } };
const Tokens = { access_token: 'PrivateAccess', refresh_token: 'PrivateRefresh', open_id: 'SellerA',
    user_type: 0, access_token_expire_in: 2000001000, refresh_token_expire_in: 2000010000 };

Test('encrypted credentials cannot be moved to another grant, changed, or read with the wrong key', () => {
    const Envelope = EncryptTokens(Tokens, 'GrantA:Test', Keys);
    Assert.deepEqual(DecryptTokens(Envelope, 'GrantA:Test', Keys), Tokens);
    Assert.equal(JSON.stringify(Envelope).includes('PrivateAccess'), false);
    Assert.notEqual(Envelope.IV, EncryptTokens(Tokens, 'GrantA:Test', Keys).IV);
    Assert.throws(() => DecryptTokens(Envelope, 'GrantB:Test', Keys));
    Assert.throws(() => DecryptTokens({ ...Envelope, Tag: Buffer.alloc(16).toString('base64') }, 'GrantA:Test', Keys));
    Assert.throws(() => DecryptTokens(Envelope, 'GrantA:Test', { Current: '1', Values: { '1': Buffer.alloc(32, 8).toString('base64') } }));
});

Test('rotation keeps old ciphertext readable without silently accepting a missing key', () => {
    const Envelope = EncryptTokens(Tokens, 'GrantA:Test', Keys);
    const Rotated = { Current: '2', Values: { ...Keys.Values, '2': Buffer.alloc(32, 9).toString('base64') } };
    Assert.deepEqual(DecryptTokens(Envelope, 'GrantA:Test', Rotated), Tokens);
    Assert.equal(EncryptTokens(Tokens, 'GrantA:Test', Rotated).KeyVersion, '2');
    Assert.throws(() => DecryptTokens(Envelope, 'GrantA:Test', { Current: '2', Values: { '2': Rotated.Values['2'] } }));
});

Test('seller token validation treats expiry as Unix time and rejects expired or different identities', () => {
    Assert.equal(ValidateTokens(Tokens, 2000000000).open_id, 'SellerA');
    for (const Change of [{ user_type: 1 }, { access_token: '' }, { access_token_expire_in: 604800 },
        { refresh_token_expire_in: 2000000000 }, { open_id: '' }]) {
        Assert.throws(() => ValidateTokens({ ...Tokens, ...Change }, 2000000000));
    }
    Assert.throws(() => ValidateTokens(Tokens, 2000000000, 'SellerB'));
});

Test('TikTok signature follows the documented key wrapping and signs exact body bytes', () => {
    const Path = '/authorization/202309/shops';
    const Query = { timestamp: '1234567890', app_key: '123456', sign: 'excluded', access_token: 'excluded' };
    const Expected = CreateHMAC('sha256', 'abc000def111')
        .update('abc000def111/authorization/202309/shopsapp_key123456timestamp1234567890abc000def111').digest('hex');
    Assert.equal(SignRequest(Path, Query, '', 'abc000def111'), Expected);
    Assert.notEqual(SignRequest(Path, Query, '{"A":1}', 'abc000def111'), SignRequest(Path, Query, '{ "A":1}', 'abc000def111'));
});
