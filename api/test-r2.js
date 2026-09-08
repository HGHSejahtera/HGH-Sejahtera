export default function HandleDisabledListing(Req, Res) {
    Res.setHeader('Cache-Control', 'private, no-store');
    return Res.status(410).json({ error: 'This endpoint is unavailable.' });
}
