import { createClient } from '@supabase/supabase-js';

export class FileAccessError extends Error {
    constructor(Status, Message) {
        super(Message);
        this.Status = Status;
    }
}

const FileRoles = new Set(['Founder', 'Manager', 'Developer', 'Staff', 'Agent']);

export async function RequireFileAccess(Req) {
    const Authorization = Req.headers?.authorization;
    if (typeof Authorization !== 'string' || !/^Bearer \S+$/i.test(Authorization)) {
        throw new FileAccessError(401, 'Please sign in to access files.');
    }
    const Token = Authorization.slice(7);
    const SupabaseURL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const PublicKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!SupabaseURL || !PublicKey) throw new FileAccessError(503, 'File access is unavailable.');
    // Keep sessions separate and retain user-scoped RLS.
    const Database = createClient(SupabaseURL, PublicKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${Token}` } },
    });
    const { data: AuthData, error: AuthError } = await Database.auth.getUser(Token);
    if (AuthError || !AuthData?.user?.id) throw new FileAccessError(401, 'Please sign in again.');
    const UserID = AuthData.user.id;
    const { data: Profile, error: ProfileError } = await Database.from('Users')
        .select('UserID, Role, IsActive, StaffID').eq('UserID', UserID).maybeSingle();
    if (ProfileError) throw new FileAccessError(503, 'File access is unavailable.');
    if (!Profile || Profile.IsActive !== true || !FileRoles.has(Profile.Role)) {
        throw new FileAccessError(403, 'File access is not allowed for this account.');
    }
    // Release prerequisite: protect Role/StaffID and signup role assignment in
    // the database. JWT validation cannot fix caller-editable authorization data.
    return { Database, UserID, Profile };
}

export function ParseAWBKey(Reference) {
    if (typeof Reference !== 'string' || !Reference || Reference.length > 2048) {
        throw new FileAccessError(400, 'A valid AWB reference is required.');
    }
    let DecodedReference;
    try { DecodedReference = decodeURIComponent(Reference); } catch {
        throw new FileAccessError(400, 'Invalid AWB reference.');
    }
    // URL parsers normalize dot segments and backslashes; reject them first.
    if ([...DecodedReference].some(Character => Character.charCodeAt(0) < 32 || Character.charCodeAt(0) === 127) ||
        DecodedReference.includes('\\') || DecodedReference.split('/').some(Part => Part === '.' || Part === '..')) {
        throw new FileAccessError(400, 'Invalid AWB reference.');
    }
    let Key = Reference;
    if (/^https:\/\//i.test(Reference)) {
        let Parsed;
        let Allowed;
        try {
            Parsed = new URL(Reference);
            Allowed = new URL(process.env.VITE_R2_PUBLIC_URL || '');
        } catch {
            throw new FileAccessError(400, 'External file URLs are not supported.');
        }
        if (Parsed.origin !== Allowed.origin || Parsed.username || Parsed.password || Parsed.search || Parsed.hash) {
            throw new FileAccessError(400, 'External file URLs are not supported.');
        }
        // Resolve known legacy URLs locally; never make an HTTP fetch.
        try { Key = decodeURIComponent(Parsed.pathname.slice(1)); } catch {
            throw new FileAccessError(400, 'Invalid AWB reference.');
        }
    }
    const HasControlCharacter = [...Key].some(Character => Character.charCodeAt(0) < 32 || Character.charCodeAt(0) === 127);
    if (HasControlCharacter || /[\\%?#]/.test(Key) || Key.split('/').some(Part => !Part || Part === '.' || Part === '..')) {
        throw new FileAccessError(400, 'Invalid AWB reference.');
    }
    if (!/^Order Archive\/TikTok\/[A-Za-z0-9_-]+\/\d{4}\/(0[1-9]|1[0-2])\/[^/]+\.pdf$/.test(Key)) {
        throw new FileAccessError(400, 'Unsupported AWB path.');
    }
    return Key;
}

function GetStaffID(Profile) {
    if (typeof Profile.StaffID !== 'string' || !/^[A-Za-z0-9_-]+$/.test(Profile.StaffID)) {
        throw new FileAccessError(403, 'This account has no valid file folder.');
    }
    return Profile.StaffID;
}

export async function ResolveAWBAccess(Access, Reference, OrderID) {
    const Key = ParseAWBKey(Reference);
    let Query = Access.Database.from('ImportOrders')
        .select('ImportOrderID, AwbUrl, OrderImports!inner(AgentID)');
    if (OrderID !== undefined && OrderID !== null && OrderID !== '') {
        if (typeof OrderID !== 'string' || !/^[0-9a-f-]{36}$/i.test(OrderID)) {
            throw new FileAccessError(400, 'Invalid order reference.');
        }
        Query = Query.eq('ImportOrderID', OrderID);
    } else {
        Query = Query.eq('AwbUrl', Reference);
    }
    const { data: Order, error: OrderError } = await Query.maybeSingle();
    if (OrderError || !Order || ParseAWBKey(Order.AwbUrl) !== Key) {
        throw new FileAccessError(404, 'AWB not found or access denied.');
    }
    const OwnerID = Order.OrderImports?.AgentID;
    if (!OwnerID) throw new FileAccessError(404, 'AWB not found or access denied.');
    if (Access.Profile.Role === 'Agent') {
        const StaffID = GetStaffID(Access.Profile);
        if (OwnerID !== Access.UserID || !Key.startsWith(`Order Archive/TikTok/${StaffID}/`)) {
            throw new FileAccessError(404, 'AWB not found or access denied.');
        }
    }
    return { Key, Bucket: process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb', Order };
}

export function ResolveUploadAccess(Access, Body) {
    if (!Body || typeof Body !== 'object' || Array.isArray(Body)) throw new FileAccessError(400, 'Invalid upload request.');
    const { fileName: FileName, fileType: FileType, isPrivate: IsPrivate = false, FileSize } = Body;
    if (typeof IsPrivate !== 'boolean') throw new FileAccessError(400, 'Invalid upload destination.');
    const MaxBytes = IsPrivate ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!Number.isSafeInteger(FileSize) || FileSize <= 0 || FileSize > MaxBytes) {
        throw new FileAccessError(400, IsPrivate ? 'PDFs must be 20 MB or smaller.' : 'Images must be 5 MB or smaller.');
    }
    let Key;
    let Bucket;
    if (IsPrivate) {
        Key = ParseAWBKey(FileName);
        const StaffID = GetStaffID(Access.Profile);
        if (FileType !== 'application/pdf' || !Key.startsWith(`Order Archive/TikTok/${StaffID}/`) ||
            !Key.split('/').at(-1).startsWith(`TikTokSeller-${StaffID}-`)) {
            throw new FileAccessError(403, 'Upload is not allowed for this file.');
        }
        Bucket = process.env.R2_PRIVATE_BUCKET_NAME || 'hgh-awb';
    } else {
        if (Access.Profile.Role === 'Agent') throw new FileAccessError(403, 'Product image upload is not allowed.');
        if (FileType !== 'image/webp' || typeof FileName !== 'string' || !/^[A-Za-z0-9_-]+\.webp$/.test(FileName)) {
            throw new FileAccessError(400, 'A valid WebP image is required.');
        }
        Key = FileName;
        Bucket = process.env.R2_BUCKET_NAME;
    }
    if (!Bucket) throw new FileAccessError(503, 'File storage is unavailable.');
    return { Key, Bucket, FileType, FileSize, IsPrivate };
}

export function SendFileError(Res, ErrorValue) {
    Res.setHeader('Cache-Control', 'private, no-store');
    if (ErrorValue instanceof FileAccessError) return Res.status(ErrorValue.Status).json({ error: ErrorValue.message });
    if (ErrorValue?.name === 'NoSuchKey' || ErrorValue?.$metadata?.httpStatusCode === 404) {
        return Res.status(404).json({ error: 'AWB not found or access denied.' });
    }
    // Do not log SDK errors containing signed URLs or private object names.
    return Res.status(503).json({ error: 'File service is unavailable. Please try again.' });
}
