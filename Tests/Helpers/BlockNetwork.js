import HTTP from 'node:http';
import HTTPS from 'node:https';
import Net from 'node:net';
import TLS from 'node:tls';
import DNS from 'node:dns';
import { syncBuiltinESMExports as SyncBuiltinESMExports } from 'node:module';

function BlockNetwork() {
    throw new Error('Network disabled in HGH isolated tests. Provide a synthetic service fixture.');
}

// Test preloader only. Explicit mocks may replace these methods; unmocked I/O
// fails before opening a socket. This is not a sandbox for untrusted code.
globalThis.fetch = BlockNetwork;
HTTP.request = HTTP.get = HTTPS.request = HTTPS.get = BlockNetwork;
Net.connect = Net.createConnection = Net.Socket.prototype.connect = BlockNetwork;
TLS.connect = BlockNetwork;
DNS.lookup = DNS.resolve = DNS.reverse = BlockNetwork;
DNS.promises.lookup = DNS.promises.resolve = DNS.promises.reverse = BlockNetwork;
SyncBuiltinESMExports();
