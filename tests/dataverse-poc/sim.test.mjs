// Shared local simulation: sim-store (state, revisions, validation, reset) and sim-http (API, SSE, static, guards).
// No npm dependencies: the modules under test never load YAML.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const lib = '../../plugins/dataverse-poc/skills/prototype-dataverse-app/assets/poc-template/scripts/lib';
const { createSimStore, makeSeed, nextKey, seedFromModel } = await import(`${lib}/sim-store.mjs`);
const { createSimServer } = await import(`${lib}/sim-http.mjs`);

const seed = () => makeSeed({
    ava_siti: { keyField: 'codice', records: [{ codice: 'SITO-001', nome: 'Torre Nord' }, { codice: 'SITO-002', nome: 'Torre Sud' }] },
    ava_prenotazioni: {
        keyField: 'codice',
        records: [
            { codice: 'PRE-001', sito: 'SITO-001', stato: 1, referente: 'anna@contoso.com' },
            { codice: 'PRE-009', sito: 'SITO-002', stato: 2, referente: 'luca@example.com' },
            { codice: 'PRE-010', sito: 'SITO-002', stato: 1, referente: 'mia@contoso.com' },
        ],
    },
}, [{ dataset: 'ava_prenotazioni', field: 'sito', references: 'ava_siti' }]);

function tempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'poc-sim-'));
    test.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}

const code = (fn) => { try { fn(); } catch (e) { return `${e.status} ${e.code}`; } return 'ok'; };

test('nextKey follows the dominant numeric pattern', () => {
    assert.equal(nextKey(['PRE-001', 'PRE-009', 'PRE-010']), 'PRE-011');
    assert.equal(nextKey(['A1', 'A2', 'X-1']), 'A3');
    assert.equal(nextKey(['alpha', 'beta']), null);
});

test('seedFromModel keeps datasets and relationships, ignores the YAML file layout', () => {
    const s = seedFromModel({
        datasets: [{ ref: { file: 'a.yaml' }, file: 'config/data/a.yaml', doc: { logicalName: 'ava_a', keyField: 'k', records: [{ k: 'A-1', b: 'B-1' }], relations: [{ field: 'b', references: 'ava_b' }] } },
            { ref: { file: 'b.yaml' }, file: 'config/data/b.yaml', doc: { logicalName: 'ava_b', keyField: 'k', records: [{ k: 'B-1' }] } }],
        dataSchema: {},
    });
    assert.deepEqual(Object.keys(s.datasets), ['ava_a', 'ava_b']);
    assert.deepEqual(s.relationships, [{ dataset: 'ava_a', field: 'b', references: 'ava_b' }]);
    assert.match(s.seedHash, /^[0-9a-f]{64}$/);
});

test('store: seed, update with revisions, conflicts, validation, create', () => {
    const dir = tempDir();
    const store = createSimStore({ stateDir: join(dir, '.sim'), seed: seed(), poc: 'ava_demo' });
    const events = [];
    store.onEvent((e) => events.push(e));

    assert.equal(store.health().status, 'ok');
    assert.equal(readFileSync(join(dir, '.sim', '.gitignore'), 'utf8'), '*\n');
    assert.equal(store.get('ava_prenotazioni', 'PRE-001')._rev, 1);

    const updated = store.patch('ava_prenotazioni', 'PRE-001', '1', { stato: 3 }, 'win-a');
    assert.equal(updated._rev, 2);
    assert.equal(updated.stato, 3);
    assert.deepEqual(events.at(-1), { type: 'change', rev: 2, op: 'update', dataset: 'ava_prenotazioni', key: 'PRE-001', clientId: 'win-a' });

    assert.equal(code(() => store.patch('ava_prenotazioni', 'PRE-001', '1', { stato: 4 })), '409 conflict');
    try { store.patch('ava_prenotazioni', 'PRE-001', '1', { stato: 4 }); } catch (e) { assert.equal(e.extra.current.stato, 3); }
    assert.equal(code(() => store.patch('ava_prenotazioni', 'PRE-001', '', { stato: 4 })), '428 precondition_required');
    assert.equal(code(() => store.patch('ava_prenotazioni', 'PRE-404', '1', {})), '404 not_found');
    assert.equal(code(() => store.list('ava_nulla')), '404 not_found');

    const invalid = [
        { sito: 'SITO-999' },                 // lookup to a missing key
        { referente: 'mario.rossi@gmail.com' }, // real-looking email
        { colonnaNuova: 'x' },                // unknown column
        { _rev: 9 },                          // reserved column
        { codice: 'PRE-777' },                // key change
        { stato: { nested: true } },          // not a scalar
    ];
    for (const body of invalid) assert.equal(code(() => store.patch('ava_prenotazioni', 'PRE-001', '2', body)), '422 invalid', JSON.stringify(body));
    assert.equal(store.get('ava_prenotazioni', 'PRE-001')._rev, 2, 'rejected writes leave the record untouched');

    const created = store.create('ava_prenotazioni', { sito: 'SITO-001', stato: 1 }, 'win-b');
    assert.equal(created.codice, 'PRE-011');
    assert.equal(created._rev, 1);
    assert.equal(code(() => store.create('ava_prenotazioni', { codice: 'PRE-011', sito: 'SITO-001' })), '409 duplicate_key');
    assert.equal(code(() => store.create('ava_prenotazioni', { sito: 'SITO-404' })), '422 invalid');
    assert.equal(store.rev, 3);

    // Persistence: a new store on the same folder sees the same state.
    const again = createSimStore({ stateDir: join(dir, '.sim'), seed: seed() });
    assert.equal(again.rev, 3);
    assert.equal(again.get('ava_prenotazioni', 'PRE-011').sito, 'SITO-001');
});

test('store: delete checks revision and lookups that still use the record', () => {
    const dir = tempDir();
    const store = createSimStore({ stateDir: join(dir, '.sim'), seed: seed() });
    const events = [];
    store.onEvent((e) => events.push(e));
    assert.equal(code(() => store.remove('ava_prenotazioni', 'PRE-009', '')), '428 precondition_required');
    assert.equal(code(() => store.remove('ava_prenotazioni', 'PRE-009', '7')), '409 conflict');
    assert.equal(code(() => store.remove('ava_prenotazioni', 'PRE-404', '1')), '404 not_found');
    try { store.remove('ava_siti', 'SITO-002', '1'); assert.fail('referenced'); } catch (e) {
        assert.equal(e.code, 'referenced');
        assert.deepEqual(e.extra.usedBy, ['ava_prenotazioni/PRE-009', 'ava_prenotazioni/PRE-010']);
    }
    store.remove('ava_prenotazioni', 'PRE-009', '1', 'win-a');
    assert.deepEqual(events.at(-1), { type: 'change', rev: 2, op: 'delete', dataset: 'ava_prenotazioni', key: 'PRE-009', clientId: 'win-a' });
    assert.equal(code(() => store.get('ava_prenotazioni', 'PRE-009')), '404 not_found');
    store.remove('ava_prenotazioni', 'PRE-010', '1');
    store.remove('ava_siti', 'SITO-002', '1');
    assert.equal(store.list('ava_siti').records.length, 1);
});

test('store: reset backs up, keeps rev monotonic and keeps the last 5 backups', () => {
    const dir = tempDir();
    const store = createSimStore({ stateDir: join(dir, '.sim'), seed: seed() });
    store.patch('ava_siti', 'SITO-001', '1', { nome: 'Torre Est' });
    const events = [];
    store.onEvent((e) => events.push(e));
    const { rev, backup } = store.reset();
    assert.equal(rev, 3);
    assert.match(backup, /^backup\/state-.*\.json$/);
    assert.equal(JSON.parse(readFileSync(join(dir, '.sim', backup), 'utf8')).datasets.ava_siti.records[0].nome, 'Torre Est');
    assert.equal(store.get('ava_siti', 'SITO-001').nome, 'Torre Nord');
    assert.deepEqual(events, [{ type: 'reset', rev: 3 }]);
    for (let i = 0; i < 6; i++) store.reset();
    assert.equal(readdirSync(join(dir, '.sim', 'backup')).length, 5);
});

test('store: corrupt state is never wiped silently; reset recovers it', () => {
    const dir = tempDir();
    mkdirSync(join(dir, '.sim'));
    writeFileSync(join(dir, '.sim', 'state.json'), '{corrupt');
    const store = createSimStore({ stateDir: join(dir, '.sim'), seed: seed() });
    assert.equal(store.health().status, 'corrupt');
    assert.equal(code(() => store.list('ava_siti')), '503 state_corrupt');
    assert.equal(readFileSync(join(dir, '.sim', 'state.json'), 'utf8'), '{corrupt', 'file left as it was');
    const { backup } = store.reset();
    assert.match(backup, /^backup\/state-corrupt-/);
    assert.equal(readFileSync(join(dir, '.sim', backup), 'utf8'), '{corrupt');
    assert.equal(store.health().status, 'ok');
});

test('store: a changed seed keeps the state and raises seedChanged', () => {
    const dir = tempDir();
    const first = createSimStore({ stateDir: join(dir, '.sim'), seed: seed() });
    first.patch('ava_siti', 'SITO-002', '1', { nome: 'Torre Ovest' });
    const changed = seed();
    changed.datasets.ava_siti.records.push({ codice: 'SITO-003', nome: 'Torre Nuova' });
    const next = createSimStore({ stateDir: join(dir, '.sim'), seed: makeSeed(changed.datasets, changed.relationships) });
    assert.equal(next.health().seedChanged, true);
    assert.equal(next.get('ava_siti', 'SITO-002').nome, 'Torre Ovest');
    next.reset();
    assert.equal(next.health().seedChanged, false);
    assert.equal(next.list('ava_siti').records.length, 3);
});

// ---- HTTP ----

async function startServer() {
    const dir = tempDir();
    writeFileSync(join(dir, 'poc-runtime.html'), '<!doctype html><title>bo</title>');
    writeFileSync(join(dir, 'secret.txt'), 'outside');
    mkdirSync(join(dir, 'pocdir'));
    const pocDir = join(dir, 'pocdir');
    writeFileSync(join(pocDir, 'poc-runtime.html'), '<!doctype html><title>back-office</title>');
    mkdirSync(join(pocDir, 'portal-dist'));
    writeFileSync(join(pocDir, 'portal-dist', 'index.html'), '<!doctype html><title>portal</title>');
    const store = createSimStore({ stateDir: join(pocDir, '.sim'), seed: seed(), poc: 'ava_demo' });
    const server = createSimServer({ pocDir, store, portalDir: join(pocDir, 'portal-dist') });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    test.after(() => server.closeAll());
    return { base: `http://127.0.0.1:${server.address().port}`, port: server.address().port, pocDir };
}

const write = (base, method, path, body, headers = {}) => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Sim-Client': 'test', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
});

function rawGet(port, path, host) {
    return new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path, headers: { Host: host } }, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.end();
    });
}

// Reads SSE events until `count` named events (hello excluded) arrived.
async function collectEvents(base, count, action) {
    const ctrl = new AbortController();
    const res = await fetch(`${base}/_sim/events`, { signal: ctrl.signal });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const events = [];
    let buffer = '';
    let started = false;
    while (events.length < count) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i;
        while ((i = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, i);
            buffer = buffer.slice(i + 2);
            const name = /^event: (.+)$/m.exec(block)?.[1];
            const data = /^data: (.+)$/m.exec(block)?.[1];
            if (name === 'hello') { if (!started) { started = true; await action(); } continue; }
            if (name) events.push({ name, data: JSON.parse(data) });
        }
    }
    ctrl.abort();
    return events;
}

test('http: API contract, conflicts and SSE fan-out', async () => {
    const { base } = await startServer();

    const health = await (await fetch(`${base}/_sim/health`)).json();
    assert.deepEqual([health.ok, health.status, health.poc, health.rev, health.seedChanged], [true, 'ok', 'ava_demo', 1, false]);

    const summary = await (await fetch(`${base}/_sim/api/data`)).json();
    assert.deepEqual(summary.datasets.ava_prenotazioni, { keyField: 'codice', count: 3 });

    const one = await fetch(`${base}/_sim/api/data/ava_prenotazioni/PRE-001`);
    assert.equal(one.headers.get('etag'), '"1"');

    const events = await collectEvents(base, 2, async () => {
        const ok = await write(base, 'PATCH', '/_sim/api/data/ava_prenotazioni/PRE-001', { stato: 3 }, { 'If-Match': '"1"' });
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get('etag'), '"2"');
        const created = await write(base, 'POST', '/_sim/api/data/ava_prenotazioni', { sito: 'SITO-002', stato: 1 });
        assert.equal(created.status, 201);
        assert.equal((await created.json()).codice, 'PRE-011');
    });
    assert.deepEqual(events.map((e) => [e.name, e.data.op, e.data.key, e.data.clientId]), [['change', 'update', 'PRE-001', 'test'], ['change', 'create', 'PRE-011', 'test']]);

    const stale = await write(base, 'PATCH', '/_sim/api/data/ava_prenotazioni/PRE-001', { stato: 4 }, { 'If-Match': '"1"' });
    assert.equal(stale.status, 409);
    const body = await stale.json();
    assert.equal(body.error, 'conflict');
    assert.equal(body.current._rev, 2);

    assert.equal((await write(base, 'PATCH', '/_sim/api/data/ava_prenotazioni/PRE-001', { stato: 4 })).status, 428);
    assert.equal((await write(base, 'PATCH', '/_sim/api/data/ava_prenotazioni/PRE-001', { sito: 'SITO-999' }, { 'If-Match': '2' })).status, 422);
    assert.equal((await write(base, 'POST', '/_sim/api/data/ava_prenotazioni', { codice: 'PRE-001' })).status, 409);
    assert.equal((await fetch(`${base}/_sim/api/data/ava_prenotazioni`, { method: 'POST', headers: { 'X-Sim-Client': 't' }, body: '{}' })).status, 415);
    assert.equal((await fetch(`${base}/_sim/api/data/ava_prenotazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal((await fetch(`${base}/_sim/api/data/ava_prenotazioni/PRE-009`, { method: 'DELETE', headers: { 'If-Match': '"1"' } })).status, 400);
    assert.equal((await fetch(`${base}/_sim/api/data/ava_prenotazioni/PRE-009`, { method: 'DELETE', headers: { 'If-Match': '"1"', 'X-Sim-Client': 't' } })).status, 204);
    assert.equal((await fetch(`${base}/_sim/api/data/ava_siti/SITO-001`, { method: 'DELETE', headers: { 'If-Match': '"1"', 'X-Sim-Client': 't' } })).status, 409);
    assert.equal((await fetch(`${base}/_sim/api/data`, { method: 'DELETE' })).status, 405);
    const bad = await fetch(`${base}/_sim/api/data/ava_prenotazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sim-Client': 't' }, body: '{not json' });
    assert.equal(bad.status, 422);
});

test('http: reset broadcasts and returns to the seed', async () => {
    const { base } = await startServer();
    await write(base, 'PATCH', '/_sim/api/data/ava_siti/SITO-001', { nome: 'Torre Est' }, { 'If-Match': '1' });
    const events = await collectEvents(base, 1, async () => {
        const r = await write(base, 'POST', '/_sim/reset', {});
        assert.equal(r.status, 200);
    });
    assert.equal(events[0].name, 'reset');
    assert.equal((await (await fetch(`${base}/_sim/api/data/ava_siti/SITO-001`)).json()).nome, 'Torre Nord');
});

test('http: static UIs, guards and isolation', async () => {
    const { base, port, pocDir } = await startServer();
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /back-office/);
    assert.equal(root.headers.get('content-security-policy'), "connect-src 'self'");
    assert.match(await (await fetch(`${base}/portal/prenotazioni/PRE-001`)).text(), /portal/, 'SPA fallback');
    assert.equal((await fetch(`${base}/portal`, { redirect: 'manual' })).status, 302);
    assert.equal((await fetch(`${base}/.sim/state.json`)).status, 404, 'state folder never served');
    assert.ok(existsSync(join(pocDir, '.sim', 'state.json')));
    assert.notEqual((await fetch(`${base}/..%2Fsecret.txt`)).status, 200, 'no path traversal');
    assert.equal(await rawGet(port, '/_sim/health', 'evil.example:80'), 403, 'DNS rebinding blocked');
    assert.equal(await rawGet(port, '/_sim/health', `localhost:${port}`), 200);
});
