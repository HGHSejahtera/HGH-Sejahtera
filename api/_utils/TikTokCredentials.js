import { createCipheriv as CreateCipher, createDecipheriv as CreateDecipher,
    createHash as CreateHash, createHmac as CreateHMAC, randomBytes as RandomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

export function Hash(Value) { return CreateHash('sha256').update(Value).digest('hex'); }
export function RandomToken() { return RandomBytes(32).toString('hex'); }

function KeyFor(Keys, Version) {
    const Encoded = Keys?.Values?.[Version];
    if (typeof Encoded !== 'string') throw new Error('Credential key unavailable.');
    const Key = Buffer.from(Encoded, 'base64');
    if (Key.length !== 32 || Key.toString('base64') !== Encoded) throw new Error('Invalid credential key.');
    return Key;
}

export function EncryptTokens(Tokens, Binding, Keys) {
    const IV = RandomBytes(12);
    const Cipher = CreateCipher('aes-256-gcm', KeyFor(Keys, Keys.Current), IV);
    Cipher.setAAD(Buffer.from(Binding));
    const Ciphertext = Buffer.concat([Cipher.update(JSON.stringify(Tokens), 'utf8'), Cipher.final()]);
    return { KeyVersion: Keys.Current, IV: IV.toString('base64'),
        Tag: Cipher.getAuthTag().toString('base64'), Ciphertext: Ciphertext.toString('base64') };
}

export function DecryptTokens(Envelope, Binding, Keys) {
    const IV = Buffer.from(Envelope.IV, 'base64');
    const Tag = Buffer.from(Envelope.Tag, 'base64');
    if (IV.length !== 12 || Tag.length !== 16) throw new Error('Invalid credential envelope.');
    const Decipher = CreateDecipher('aes-256-gcm', KeyFor(Keys, Envelope.KeyVersion), IV);
    Decipher.setAAD(Buffer.from(Binding));
    Decipher.setAuthTag(Tag);
    return JSON.parse(Buffer.concat([Decipher.update(Buffer.from(Envelope.Ciphertext, 'base64')), Decipher.final()]).toString('utf8'));
}

export function ValidateTokens(Data, Now, ExpectedSellerID) {
    if (!Data || Data.user_type !== 0 || typeof Data.open_id !== 'string' || !Data.open_id || Data.open_id.length > 256 ||
        (ExpectedSellerID && Data.open_id !== ExpectedSellerID) ||
        !['access_token', 'refresh_token'].every(Name => typeof Data[Name] === 'string' && Data[Name].length > 0 && Data[Name].length <= 8192) ||
        !['access_token_expire_in', 'refresh_token_expire_in'].every(Name => Number.isSafeInteger(Data[Name]) && Data[Name] > Now && Data[Name] < 253402300799)) {
        throw new Error('Invalid seller credentials.');
    }
    // Persist only required credentials, never the entire provider response.
    return { access_token: Data.access_token, refresh_token: Data.refresh_token, open_id: Data.open_id,
        user_type: 0, access_token_expire_in: Data.access_token_expire_in,
        refresh_token_expire_in: Data.refresh_token_expire_in,
        ...(Array.isArray(Data.granted_scopes) ? { granted_scopes: Data.granted_scopes.filter(Value => typeof Value === 'string') } : {}) };
}

export function SignRequest(Path, Query, Body, Secret) {
    const Parameters = Object.keys(Query).filter(Name => Name !== 'sign' && Name !== 'access_token').sort()
        .map(Name => Name + String(Query[Name])).join('');
    return CreateHMAC('sha256', Secret).update(Secret + Path + Parameters + Body + Secret).digest('hex');
}
