import { RequireFileAccess, ResolveAWBAccess, SendFileError } from './_utils/FileAccess.js';
import { GetFileStorage, ReadPrivatePDF } from './_utils/FileStorage.js';

export default async function HandlePDF(Req, Res) {
    Res.setHeader('Cache-Control', 'private, no-store');
    Res.setHeader('X-Content-Type-Options', 'nosniff');
    if (Req.method !== 'GET') return Res.status(405).json({ error: 'Method Not Allowed' });
    try {
        const Access = await RequireFileAccess(Req);
        const File = await ResolveAWBAccess(Access, Req.query?.url, Req.query?.OrderID);
        const Bytes = await ReadPrivatePDF(GetFileStorage(), File);
        const FileName = File.Key.split('/').at(-1);
        const Disposition = Req.query?.download === 'true' ? 'attachment' : 'inline';
        const EncodedName = encodeURIComponent(FileName).replace(/['()*]/g, Character => '%' + Character.charCodeAt(0).toString(16).toUpperCase());
        Res.setHeader('Content-Type', 'application/pdf');
        Res.setHeader('Content-Disposition', Disposition + '; filename="AWB.pdf"; filename*=UTF-8\'\'' + EncodedName);
        return Res.status(200).send(Bytes);
    } catch (ErrorValue) {
        return SendFileError(Res, ErrorValue);
    }
}
