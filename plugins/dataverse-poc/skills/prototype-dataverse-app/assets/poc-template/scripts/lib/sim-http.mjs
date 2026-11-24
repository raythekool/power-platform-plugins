// HTTP layer of the shared simulation: static UIs + /_sim API + Server-Sent Events.
// Contract: references/simulazione-condivisa.md. No dependencies; the caller decides where to listen (127.0.0.1 only).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { SimError } from './sim-store.mjs';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.yaml': 'text/yaml', '.md': 'text/markdown' };
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;
const MAX_BODY = 1024 * 1024;
const HEARTBEAT_MS = 15000;

const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
};
const fail = (res, e) => {
    if (e instanceof SimError) return json(res, e.status, { error: e.code, message: e.message, ...e.extra });
    return json(res, 500, { error: 'internal', message: `Errore interno della simulazione: ${e.message}` });
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) { reject(new SimError(413, 'too_large', 'Body oltre 1 MB.')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (!text) return resolve({});
            try { resolve(JSON.parse(text)); } catch { reject(new SimError(422, 'invalid', 'Body non valido.', { details: ['JSON non valido'] })); }
        });
        req.on('error', reject);
    });
}

// Serves one file under `root`; dotted segments (.sim, .git, .env…) are never served.
function serveFile(res, root, path, fallback) {
    if (path.split('/').some((s) => s.startsWith('.') && s.length > 1)) return json(res, 404, { error: 'not_found', message: 'Risorsa inesistente.' });
    let file = normalize(join(root, path));
    if (!file.startsWith(root + sep) && file !== root) return json(res, 403, { error: 'forbidden', message: 'Percorso non ammesso.' });
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && fallback && !extname(path)) file = fallback;
    if (!existsSync(file)) return json(res, 404, { error: 'not_found', message: 'Risorsa inesistente.' });
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const headers = { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    // The simulated UIs may only talk to this server.
    if (type === 'text/html') headers['Content-Security-Policy'] = "connect-src 'self'";
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
}

export function createSimServer({ pocDir, store, portalDir = null }) {
    const root = normalize(pocDir);
    const portalRoot = portalDir ? normalize(portalDir) : null;
    const streams = new Set();

    const unsubscribe = store.onEvent((event) => {
        const { type, ...data } = event;
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const res of streams) res.write(payload);
    });

    const heartbeat = setInterval(() => { for (const res of streams) res.write(': heartbeat\n\n'); }, HEARTBEAT_MS);
    heartbeat.unref();

    async function api(req, res, path) {
        const method = req.method;
        if (path === '/_sim/health' && method === 'GET') return json(res, 200, store.health());
        if (path === '/_sim/events' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
            res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ rev: store.rev, status: store.status })}\n\n`);
            streams.add(res);
            req.on('close', () => streams.delete(res));
            return;
        }

        const writing = method === 'POST' || method === 'PATCH';
        let body;
        if (writing) {
            if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) throw new SimError(415, 'unsupported_media_type', 'Serve Content-Type: application/json.');
            if (!req.headers['x-sim-client']) throw new SimError(400, 'client_required', 'Manca l\'header X-Sim-Client.');
            body = await readBody(req);
        }
        const clientId = req.headers['x-sim-client'] ?? null;

        if (path === '/_sim/reset') {
            if (method !== 'POST') throw new SimError(405, 'method_not_allowed', 'Metodo non ammesso.');
            return json(res, 200, store.reset());
        }

        const m = /^\/_sim\/api\/data(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(path);
        if (!m) throw new SimError(404, 'not_found', 'Risorsa inesistente.');
        const [, ln, key] = m;
        if (!ln) {
            if (method !== 'GET') throw new SimError(405, 'method_not_allowed', 'Metodo non ammesso.');
            return json(res, 200, store.summary());
        }
        if (!key) {
            if (method === 'GET') return json(res, 200, store.list(ln));
            if (method === 'POST') { const r = store.create(ln, body, clientId); return json(res, 201, r, { ETag: `"${r._rev}"` }); }
            throw new SimError(405, 'method_not_allowed', 'Metodo non ammesso.');
        }
        if (method === 'GET') { const r = store.get(ln, key); return json(res, 200, r, { ETag: `"${r._rev}"` }); }
        const ifMatch = (req.headers['if-match'] ?? '').replace(/^W\//, '').replace(/"/g, '').trim();
        if (method === 'PATCH') {
            const r = store.patch(ln, key, ifMatch, body, clientId);
            return json(res, 200, r, { ETag: `"${r._rev}"` });
        }
        if (method === 'DELETE') {
            // Come le altre scritture: header custom obbligatorio, cosi un altro sito non puo chiamarla senza preflight.
            if (!clientId) throw new SimError(400, 'client_required', 'Manca l\'header X-Sim-Client.');
            store.remove(ln, key, ifMatch, clientId);
            res.writeHead(204, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        throw new SimError(405, 'method_not_allowed', 'Metodo non ammesso.');
    }

    const server = createServer(async (req, res) => {
        try {
            // Blocks DNS rebinding: only local Host headers are answered.
            if (!LOCAL_HOST.test(req.headers.host ?? '')) return json(res, 403, { error: 'host_not_allowed', message: 'Solo richieste locali.' });
            let path;
            try { path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch { return json(res, 400, { error: 'bad_request', message: 'URL non valido.' }); }
            if (path.startsWith('/_sim/')) return await api(req, res, path);
            if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method_not_allowed', message: 'Metodo non ammesso.' });
            if (path === '/favicon.ico' && !existsSync(join(root, 'favicon.ico'))) { res.writeHead(204).end(); return; }
            if (path === '/portal') { res.writeHead(302, { Location: '/portal/' }).end(); return; }
            if (path.startsWith('/portal/')) {
                if (!portalRoot) return json(res, 404, { error: 'not_found', message: 'Nessun portale configurato in simulation.portal.' });
                return serveFile(res, portalRoot, path.slice('/portal'.length), join(portalRoot, 'index.html'));
            }
            return serveFile(res, root, path === '/' ? '/poc-runtime.html' : path);
        } catch (e) {
            fail(res, e);
        }
    });

    server.closeAll = () => new Promise((resolve) => {
        clearInterval(heartbeat);
        unsubscribe();
        for (const res of streams) res.end();
        streams.clear();
        server.close(() => resolve());
        server.closeAllConnections?.();
    });
    return server;
}
