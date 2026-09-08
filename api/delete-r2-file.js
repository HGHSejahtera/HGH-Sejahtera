// Closed until deletion has an approved ownership, recovery and audit workflow.
export default function HandleDisabledDelete(Req, Res) {
    Res.setHeader('Cache-Control', 'private, no-store');
    return Res.status(410).json({ error: 'File deletion is unavailable.' });
}
