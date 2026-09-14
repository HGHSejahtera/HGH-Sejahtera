import { build as Build } from 'vite';
import React from '@vitejs/plugin-react';
import Tailwind from '@tailwindcss/vite';
import { mkdir as MakeDirectory, readFile as ReadFile, writeFile as WriteFile, readdir as ReadDirectory, copyFile as CopyFile, symlink as CreateLink } from 'node:fs/promises';
import { fileURLToPath as FileURLToPath } from 'node:url';
import { parseEnv as ParseEnv } from 'node:util';
import { createHash as CreateHash } from 'node:crypto';
import { execFileSync as Execute } from 'node:child_process';
import Path from 'node:path';
import Process from 'node:process';
import { Buffer } from 'node:buffer';

function FrontendConfiguration(Values) {
    const URLValue = Values.VITE_SUPABASE_URL || Values.SUPABASE_URL;
    const Key = Values.VITE_SUPABASE_ANON_KEY || Values.SUPABASE_ANON_KEY;
    if (URLValue !== 'https://sfsukzdxtykevgzbpxna.supabase.co' || !Key) throw new Error('Expected HGH frontend configuration is missing.');
    const Claims = JSON.parse(Buffer.from(Key.split('.')[1] || '', 'base64url').toString('utf8'));
    if (Claims.role !== 'anon' || Claims.ref !== 'sfsukzdxtykevgzbpxna') throw new Error('Frontend key is not the HGH anon key.');
    return { VITE_SUPABASE_URL: URLValue, VITE_SUPABASE_ANON_KEY: Key };
}

const Source = Path.resolve(Path.dirname(FileURLToPath(import.meta.url)), '..');
const Name = Process.argv[2] || 'TikTokPageCandidate';
if (!/^TikTokPage[A-Za-z0-9]*Candidate$/.test(Name)) throw new Error('Invalid candidate name.');
const Destination = Path.resolve(Source, '../ReleaseValidation', Name);
await MakeDirectory(Destination); // Never replace an earlier artifact.
const Values = {};
for (const File of ['.env', '.env.local']) {
    try { Object.assign(Values, ParseEnv(await ReadFile(Path.join(Source, File), 'utf8'))); }
    catch (Failure) { if (Failure.code !== 'ENOENT') throw Failure; }
}
const Frontend = FrontendConfiguration(Values);
delete Frontend.VITE_PRIVATE_LOGIN_ENABLED;
const Define = Object.fromEntries(Object.entries(Frontend).map(([Key, Value]) => [`import.meta.env.${Key}`, JSON.stringify(Value)]));
const Entry = Path.join(Destination, 'index.html');
await WriteFile(Entry, '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HGH API Connection</title></head><body><div id="root"></div><script type="module" src="/TikTokPageEntry.jsx"></script></body></html>');
const Modules = new Set();
const AuthModuleIDs = new Set();
await Build({ configFile: false, envDir: false, envPrefix: 'HGHUnusedBuildVariable', root: Destination,
    publicDir: false, define: Define, base: '/', plugins: [
        { name: 'TikTokPageScope', enforce: 'pre', resolveId(ID) {
            if (ID === '/TikTokPageEntry.jsx') return Path.join(Source, 'Src/TikTokPage/TikTokPage.jsx').replaceAll('\\', '/');
            if (/^(?:@\/Hooks\/UseAuth|\.\.\/Hooks\/UseAuth)(?:\.js)?$/.test(ID) || /\/Src\/Hooks\/UseAuth(?:\.js)?$/.test(ID.replaceAll('\\', '/'))) return Path.join(Source, 'Src/TikTokPage/TikTokPageAuth.js').replaceAll('\\', '/');
        }, moduleParsed(Module) {
            const ID = Module.id.replaceAll('\\', '/');
            if (ID.endsWith('/TikTokPageAuth.js')) {
                AuthModuleIDs.add(Module.id);
                if (AuthModuleIDs.size > 1) throw new Error('Duplicate auth module identity in page build.');
            }
            if (ID.includes('/Src/')) Modules.add(ID.slice(ID.indexOf('/Src/') + 1));
            if (/\/(?:UseAWB|UseAuth\.js|PrivateLogin|Services\/PDF|api\/)/.test(ID)) throw new Error('Unexpected page dependency: ' + ID);
        } }, React(), Tailwind(),
    ], resolve: { alias: { '@': Path.join(Source, 'Src') }, dedupe: ['react', 'react-dom'] },
    build: { outDir: 'Assets', assetsDir: 'TikTokAssets', emptyOutDir: false, sourcemap: false },
});
const Manifest = [];
async function Record(Folder) {
    for (const EntryValue of await ReadDirectory(Path.join(Destination, Folder), { withFileTypes: true })) {
        const Relative = Path.posix.join(Folder, EntryValue.name);
        if (EntryValue.isDirectory()) { await Record(Relative); continue; }
        const Bytes = await ReadFile(Path.join(Destination, Relative));
        Manifest.push({ Path: Relative, SHA256: CreateHash('sha256').update(Bytes).digest('hex'), Bytes: Bytes.length });
    }
}
for (const File of ['Workers/TikTokWorker.js', 'Workers/TikTokPageWorker.js',
    ...['Client', 'ConnectionService', 'Credentials', 'HTTP', 'Readers', 'Runtime'].map(Part => `api/_utils/TikTok${Part}.js`)]) {
    await MakeDirectory(Path.dirname(Path.join(Destination, File)), { recursive: true });
    await CopyFile(Path.join(Source, File), Path.join(Destination, File));
}
const Config = JSON.parse(await ReadFile(Path.join(Source, 'Workers/TikTokWorker.jsonc'), 'utf8'));
Config.main = 'Workers/TikTokPageWorker.js';
Config.keep_vars = true;
Config.vars.TikTokConnectionEnabled = 'false'; // New candidates start disabled until their approved rollout.
Config.assets = { directory: './Assets', binding: 'Assets', run_worker_first: true, html_handling: 'none', not_found_handling: 'none' };
for (const Pattern of ['https://www.hghsejahtera.my/Settings/APIConnection*', 'https://www.hghsejahtera.my/TikTokAssets/*']) {
    if (!Config.routes.some(Route => Route.pattern === Pattern)) Config.routes.push({ pattern: Pattern, zone_id: Config.routes[0].zone_id });
}
await WriteFile(Path.join(Destination, 'TikTokPageWorker.jsonc'), JSON.stringify(Config, null, 2));
await CreateLink(Path.join(Source, 'node_modules'), Path.join(Destination, 'node_modules'), 'junction');
await Record('Assets'); await Record('Workers'); await Record('api');
const CSSFiles = Manifest.filter(File => File.Path.endsWith('.css'));
const CSS = (await Promise.all(CSSFiles.map(File => ReadFile(Path.join(Destination, File.Path), 'utf8')))).join('\n');
if (!CSS.includes('.flex{') || !CSS.includes('.p-6{') || !CSS.includes('.max-w-5xl{')) throw new Error('Page layout utilities missing from build.');
if (AuthModuleIDs.size !== 1) throw new Error('Expected exactly one page auth module.');
if (Manifest.some(File => /\.(?:map|pdf|png|jpe?g)$|(?:IC|SSM)/.test(File.Path))) throw new Error('Unexpected private/extra asset.');
await WriteFile(Path.join(Destination, 'TikTokPageManifest.json'), JSON.stringify({
    Base: Execute('git', ['rev-parse', 'HEAD'], { cwd: Source, windowsHide: true }).toString().trim(),
    ConfigSHA256: CreateHash('sha256').update(await ReadFile(Path.join(Destination, 'TikTokPageWorker.jsonc'))).digest('hex'),
    Files: Manifest, Modules: [...Modules].sort(), PrivateDocumentsCopied: false, ServiceWorker: false,
    ReadyToDeploy: false, Flag: false, Remaining: ['Cloud approval and final confirmation', 'Live login and test authorization'],
}, null, 2));
console.log(JSON.stringify({ Destination, Files: Manifest.length, Modules: Modules.size, ReadyToDeploy: false }));
