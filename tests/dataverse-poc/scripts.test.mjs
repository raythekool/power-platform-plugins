// Tests for the dataverse-poc plugin scripts. Run: node --test tests/dataverse-poc/*.test.mjs
// The end-to-end scaffold test needs npm registry access (npm install in a temp POC); set SKIP_E2E=1 to skip it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { parseTarget } from '../../plugins/dataverse-poc/scripts/lib/plan.mjs';

const scripts = resolve(import.meta.dirname, '../../plugins/dataverse-poc/scripts');
const node = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', ...opts });

// Builds a zip in memory (deflate) without external tools.
function zip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
        const data = deflateRawSync(Buffer.from(content));
        const n = Buffer.from(name);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(content.length, 22); local.writeUInt16LE(n.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(content.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42);
        locals.push(local, n, data);
        centrals.push(central, n);
        offset += 30 + n.length + data.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}

test('parseTarget reads the target table and ignores placeholders', () => {
    const t = parseTarget(`# Piano\n\n## 🎯 Target ambiente\n\n| Chiave | Valore |\n| --- | --- |\n| URL ambiente | \`https://demo.crm4.dynamics.com\` |\n| Profilo PAC | da confermare |\n| Solution (unique name) | demosol |\n| Sito Power Pages (nome) | Portale Demo |\n| URL sito | da confermare |\n| Conferma utente stage R | sì, 2026-10-01 |\n\n## Altro\n| URL ambiente | https://wrong |\n`);
    assert.equal(t.url, 'https://demo.crm4.dynamics.com');
    assert.equal(t.solution, 'demosol');
    assert.equal(t.site, 'Portale Demo');
    assert.equal(t.siteUrl, undefined);
    assert.equal(t.pacProfile, undefined);
    assert.match(t.confirmed, /^sì/);
});

test('poc-preflight blocks when the plan has no confirmed target', () => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-'));
    const plan = join(dir, 'Piano.md');
    writeFileSync(plan, '## 🎯 Target ambiente\n\n| Chiave | Valore |\n| --- | --- |\n| URL ambiente | da confermare |\n| Conferma utente stage R | no |\n');
    const r = node([join(scripts, 'poc-preflight.mjs'), '--plan', plan, '--json'], { env: { ...process.env, PATH: '' } });
    const out = JSON.parse(r.stdout);
    assert.notEqual(r.status, 0);
    assert.equal(out.checks.find((c) => c.id === 'target').status, 'error');
    assert.equal(out.checks.find((c) => c.id === 'conferma').status, 'error');
    rmSync(dir, { recursive: true });
});

test('poc-solution-zip finds generative pages outside RootComponents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-'));
    const file = join(dir, 's.zip');
    const id = '11111111-2222-3333-4444-555555555555';
    writeFileSync(file, zip({
        'solution.xml': '<ImportExportXml><SolutionManifest><UniqueName>demosol</UniqueName><Version>1.0.0.1</Version><Managed>0</Managed><RootComponents><RootComponent type="1" schemaName="account"/></RootComponents></SolutionManifest></ImportExportXml>',
        [`uxagentprojects/${id}/uxagentproject.xml`]: '<x/>',
        'uxagentprojectfiles/aaa/filecontent/page.tsx': 'export default 1',
        'uxagentprojectfiles/bbb/filecontent/page.compiled': 'x',
    }));
    const ok = JSON.parse(node([join(scripts, 'poc-solution-zip.mjs'), file, '--pages', id, '--json']).stdout);
    assert.equal(ok.ok, true);
    assert.equal(ok.solution.uniqueName, 'demosol');
    assert.deepEqual(ok.solution.rootComponents, { 1: 1 });
    const ko = node([join(scripts, 'poc-solution-zip.mjs'), file, '--pages', `${id},99999999-0000-0000-0000-000000000000`, '--json']);
    assert.equal(ko.status, 1);
    assert.equal(JSON.parse(ko.stdout).generativePages.missing.length, 1);
    rmSync(dir, { recursive: true });
});

test('poc-guard asks before destructive or environment-changing PAC/PACX commands', () => {
    const guard = join(scripts, 'poc-guard.cjs');
    const ask = (input) => node([guard], { input: JSON.stringify(input) }).stdout;
    assert.match(ask({ tool_name: 'run_in_terminal', tool_input: { command: 'pacx table delete --name ava_x' } }), /"ask"/);
    assert.match(ask({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'pac auth select --index 2' }) }), /"ask"/);
    assert.match(ask({ tool_name: 'run_in_terminal', tool_input: { command: 'pac solution import --path s.zip' } }), /"ask"/);
    assert.match(ask({ tool_name: 'run_in_terminal', tool_input: { command: 'pac pages upload-code-site --rootPath .' } }), /"ask"/);
    for (const alias of ['pages', 'powerpages', 'paportal']) {
        for (const command of ['upload', 'upload-code-site']) {
            assert.match(ask({ tool_name: 'run_in_terminal', tool_input: { command: `pac ${alias} ${command} --path .` } }), /"ask"/);
        }
        assert.equal(ask({ tool_name: 'run_in_terminal', tool_input: { command: `pac ${alias} list` } }), '');
    }
    assert.equal(ask({ tool_name: 'run_in_terminal', tool_input: { command: 'pac pages list' } }), '');
    assert.equal(ask({ tool_name: 'run_in_terminal', tool_input: { command: 'pac org who' } }), '');
    assert.equal(ask({ tool_name: 'edit', tool_input: { content: 'pacx table delete' } }), '');
});

test('check-prereqs reports JSON and fails when Node tools are missing from PATH', () => {
    const r = node([join(scripts, 'check-prereqs.mjs'), '--json'], { env: { ...process.env, PATH: '' } });
    const out = JSON.parse(r.stdout);
    assert.equal(out.stage, 'P');
    assert.equal(r.status, 1);
    assert.ok(out.checks.some((c) => c.id === 'npm' && c.status === 'missing'));
});

test('poc-init validates its arguments', () => {
    const r = node([join(scripts, 'poc-init.mjs'), '--root', join(tmpdir(), 'x'), '--prefix', 'ava_', '--name', 'X', '--json']);
    assert.equal(r.status, 2);
    assert.match(JSON.parse(r.stdout).error, /app-type/);
    const hub = node([join(scripts, 'poc-init.mjs'), '--root', join(tmpdir(), 'x'), '--app-type', 'power-pages', '--hub', 'sales-hub', '--prefix', 'ava_', '--name', 'X', '--json']);
    assert.equal(hub.status, 2);
    assert.match(JSON.parse(hub.stdout).error, /hub/);
});

test('poc-spa-scaffold refuses a folder that is not a POC', () => {
    const r = node([join(scripts, 'poc-spa-scaffold.mjs'), '--root', join(tmpdir(), 'not-a-poc'), '--json']);
    assert.equal(r.status, 2);
    assert.match(JSON.parse(r.stdout).error, /poc-model\.mjs/);
});

// Power Pages: React project generated from the YAML, regenerated parts vs project code, permission check in the validator.
async function checkPowerPages(root) {
    const plan = readFileSync(join(root, '..', 'Piano_Test_powerpages.md'), 'utf8');
    assert.match(plan, /## 🌊 Ondate[\s\S]*poc-power-pages/);
    assert.match(plan, /\| Sito Power Pages \(nome\) \| da confermare \|/);
    const scaffold = () => JSON.parse(node([join(scripts, 'poc-spa-scaffold.mjs'), '--root', root, '--json']).stdout);
    const first = scaffold();
    assert.equal(first.ok, true, JSON.stringify(first));
    const spa = join(root, 'realization', 'power-pages');
    for (const f of ['src/generated/screens.ts', 'src/generated/model.ts', 'src/generated/mock-data.json', 'src/data/webapi.ts', 'powerpages.config.json', '.gitignore']) {
        assert.ok(existsSync(join(spa, f)), f);
    }
    const settings = JSON.parse(readFileSync(join(spa, 'power-pages', 'site-settings.json'), 'utf8'));
    assert.ok(settings.some((s) => s.name === 'Webapi/tst_richiesta/enabled' && s.value === 'true'));
    assert.match(settings.find((s) => s.name === 'Webapi/tst_richiesta/fields').value, /tst_titolo/);
    assert.equal(JSON.parse(readFileSync(join(spa, 'powerpages.config.json'), 'utf8')).siteName, 'Test App');
    checkPowerPagesPermissions(root);
    await checkPowerPagesSpa(root);
    // A second run keeps the project code and rewrites the generated files.
    writeFileSync(join(spa, 'src', 'data', 'adapter.ts'), '// codice del progetto\n');
    const second = scaffold();
    assert.ok(second.kept.includes('src/data/adapter.ts'));
    assert.ok(second.generated.includes('src/generated/screens.ts'));
    assert.equal(readFileSync(join(spa, 'src', 'data', 'adapter.ts'), 'utf8'), '// codice del progetto\n');
    // Without the table permission the screens of the role are no longer readable: the validator must fail.
    const index = join(root, 'config', 'index.yaml');
    const yaml = readFileSync(index, 'utf8');
    writeFileSync(index, yaml.replace(/tablePermissions:[\s\S]*?roles: \[tst_cliente\]/, 'tablePermissions: []'));
    const r = node([join(root, 'scripts', 'validate-poc-config.mjs'), '--json'], { cwd: root });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /nessuna table permission con read su tst_richiesta per il ruolo tst_cliente/);
    writeFileSync(index, yaml);
}

function checkPowerPagesPermissions(root) {
    const yaml = createRequire(join(root, 'package.json'))('js-yaml');
    const index = join(root, 'config', 'index.yaml');
    const detail = join(root, 'config', 'entities', 'tst_richiesta_dettaglio.yaml');
    const originalIndex = readFileSync(index, 'utf8');
    const originalDetail = readFileSync(detail, 'utf8');
    const validate = () => node([join(root, 'scripts', 'validate-poc-config.mjs'), '--json'], { cwd: root });
    const cfg = yaml.load(originalIndex);
    const doc = yaml.load(originalDetail);
    const lookup = doc.sections.flatMap((s) => s.fields ?? []).find((f) => f.dataverse?.targets?.includes('contact'));
    assert.equal(lookup.dataverse.relationship, cfg.powerPages.tablePermissions[0].relationship);
    try {
        for (const scope of ['contact', 'account']) {
            const broken = structuredClone(cfg);
            broken.powerPages.tablePermissions[0].scope = scope;
            delete broken.powerPages.tablePermissions[0].relationship;
            writeFileSync(index, yaml.dump(broken));
            assert.match(validate().stdout, new RegExp(`scope ${scope} senza relationship verso ${scope}`));
        }
        delete doc.entity.dataverse;
        delete doc.entity.dataset;
        writeFileSync(detail, yaml.dump(doc));
        writeFileSync(index, originalIndex);
        assert.equal(validate().status, 0, 'detail inherits the parent table');
        cfg.powerPages.tablePermissions[0].privileges = ['read'];
        writeFileSync(index, yaml.dump(cfg));
        assert.match(validate().stdout, /campi modificabili senza table permission con write su tst_richiesta/);
        cfg.powerPages.webRoles.push({ logicalName: 'tst_operatore', displayName: 'Operatore' });
        cfg.powerPages.tablePermissions.push({
            logicalName: 'tst_tp_operatore', displayName: 'Operatori', table: 'tst_richiesta',
            scope: 'global', privileges: ['read', 'write'], roles: ['tst_operatore'],
        });
        doc.entity.access = ['tst_cliente', 'tst_operatore'];
        writeFileSync(detail, yaml.dump(doc));
        writeFileSync(index, yaml.dump(cfg));
        assert.equal(validate().status, 0, 'read-only customers and editing operators');
        doc.entity.access = 'anonymous';
        cfg.powerPages.tablePermissions[0].scope = 'global';
        cfg.powerPages.tablePermissions[0].roles = ['anonymous', 'authenticated'];
        writeFileSync(detail, yaml.dump(doc));
        writeFileSync(index, yaml.dump(cfg));
        assert.equal(validate().status, 0, 'public viewers need not receive write privileges');
        cfg.powerPages.tablePermissions[0].roles = ['authenticated'];
        writeFileSync(index, yaml.dump(cfg));
        assert.match(validate().stdout, /nessuna table permission con read su tst_richiesta per il ruolo anonymous/);
    } finally {
        writeFileSync(index, originalIndex);
        writeFileSync(detail, originalDetail);
    }
}

async function checkPowerPagesSpa(root) {
    const require = createRequire(join(root, 'package.json'));
    const yaml = require('js-yaml');
    const spa = join(root, 'realization', 'power-pages');
    const files = ['index.yaml', 'entities/tst_richieste_elenco.yaml', 'entities/tst_richiesta_dettaglio.yaml', 'data/tst_richieste.yaml', 'components/tst_richieste_per_stato.yaml'];
    const originals = new Map(files.map((f) => [join(root, 'config', f), readFileSync(join(root, 'config', f), 'utf8')]));
    const docs = files.map((f) => yaml.load(originals.get(join(root, 'config', f))));
    const [cfg, list, detail, dataset, kpi] = docs;
    const name = 'Portale "Clienti" & <Contoso> $& $` $\' $$';
    cfg.application.displayName = name;
    list.entity.columns = ['tst_subject'];
    list.entity.dataverse.table.primaryNameAttribute = 'title';
    delete detail.entity.dataverse;
    delete detail.entity.dataset;
    const fields = detail.sections.flatMap((s) => s.fields ?? []);
    const title = fields.find((f) => f.dataverse?.column === 'tst_titolo');
    title.dataKey = 'tst_subject';
    title.dataverse.column = 'title';
    const status = fields.find((f) => f.dataverse?.column === 'tst_stato');
    status.dataKey = 'tst_stage';
    status.dataverse.column = 'statuscode';
    const date = fields.find((f) => f.control === 'datetime');
    date.dataverse.format = 'DateAndTime';
    date.dataverse.behavior = 'UserLocal';
    kpi.bindings.groupBy = 'tst_stage';
    for (const record of dataset.records) {
        record.tst_subject = record.tst_titolo;
        delete record.tst_titolo;
        record.tst_stage = record.tst_stato;
        delete record.tst_stato;
        record.tst_data_apertura = '2026-11-06T14:30:45.123Z';
    }
    dataset.primaryField = 'tst_subject';
    try {
        files.forEach((f, i) => writeFileSync(join(root, 'config', f), yaml.dump(docs[i])));
        const build = node([join(scripts, 'poc-spa-scaffold.mjs'), '--root', root, '--force', '--build', '--json']);
        assert.equal(build.status, 0, build.stdout + build.stderr);
        assert.equal(JSON.parse(readFileSync(join(spa, 'powerpages.config.json'), 'utf8')).siteName, name);
        assert.ok(readFileSync(join(spa, 'index.html'), 'utf8').includes('Portale &quot;Clienti&quot; &amp; &lt;Contoso&gt; $&amp; $` $&#39; $$'));
        const generated = readFileSync(join(spa, 'src', 'generated', 'screens.ts'), 'utf8');
        const screens = JSON.parse(generated.split('export const screens: Record<string, Screen> = ')[1].trim().slice(0, -1));
        assert.equal(screens.tst_richieste_elenco.columns[0].key, 'title');
        assert.equal(screens.tst_richieste_elenco.columns[0].label, 'Titolo');
        assert.deepEqual(screens.tst_richieste_elenco.select.sort(), ['statuscode', 'title']);
        assert.equal(screens.tst_richieste_elenco.sections[0].components[0].groupBy, 'statuscode');
        assert.equal(screens.tst_richieste_elenco.mockKeys.title, 'tst_subject');
        assert.equal(screens.tst_richiesta_dettaglio.sections[0].fields.find((f) => f.control === 'datetime').behavior, 'UserLocal');
        await checkPowerPagesBrowser(root, spa);
    } finally {
        for (const [file, text] of originals) writeFileSync(file, text);
        assert.equal(node([join(scripts, 'poc-spa-scaffold.mjs'), '--root', root, '--force', '--json']).status, 0);
    }
}

async function checkPowerPagesBrowser(root, spa) {
    const { createServer } = await import(pathToFileURL(join(spa, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
    const { chromium } = createRequire(join(root, 'package.json'))('playwright-core');
    const server = await createServer({ root: spa, mode: 'mock', server: { port: 0, host: '127.0.0.1' } });
    let browser;
    try {
        await server.listen();
        for (const channel of ['msedge', 'chrome', undefined]) {
            try { browser = await chromium.launch({ channel }); break; } catch { /* try the next installed browser */ }
        }
        assert.ok(browser, 'an installed browser is required by the end-to-end tests');
        const page = await browser.newPage({ timezoneId: 'Europe/Rome' });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/richieste-elenco`);
        const results = await page.evaluate(async () => {
            const { screens } = await import('/src/generated/screens.ts');
            const { mockAdapter } = await import('/src/data/mock.ts');
            const { webApiAdapter } = await import('/src/data/webapi.ts');
            const { datetimeInputValue, datetimePatch } = await import('/src/data/format.ts');
            const s = screens.tst_richieste_elenco;
            const row = (await mockAdapter.list(s))[0];
            await mockAdapter.update(s, row.__key, { title: 'Titolo aggiornato' });
            const updated = await mockAdapter.get(s, row.__key);
            await mockAdapter.update(s, row.__key, { title: row.title });
            const calls = [];
            const fetch = window.fetch;
            window.fetch = async (url, init) => {
                calls.push({ url, headers: init?.headers, body: init?.body });
                return String(url).includes('tokenhtml') ? new Response('<input value="csrf-test">')
                    : new Response(init?.method === 'PATCH' ? null : JSON.stringify({ value: [], tst_richiestaid: 'record' }), { status: init?.method === 'PATCH' ? 204 : 200 });
            };
            try {
                await webApiAdapter.list(s);
                await webApiAdapter.get(s, 'record');
                await webApiAdapter.update(s, 'record', { title: 'API title' });
            } finally { window.fetch = fetch; }
            const field = { key: 'date', label: 'Data', control: 'datetime', format: 'DateAndTime', behavior: 'UserLocal' };
            const independent = { ...field, behavior: 'TimeZoneIndependent' };
            const dateOnly = { ...field, format: 'DateOnly', behavior: 'DateOnly' };
            return {
                title: row.title, updatedTitle: updated.title, updatedMockTitle: updated.tst_subject, calls,
                local: datetimeInputValue('2026-11-06T14:30:45.123Z', field),
                utc: datetimePatch('2026-11-07T15:30:45.123', field),
                independent: datetimePatch(datetimeInputValue('2026-11-06T14:30:45.123Z', independent), independent),
                date: datetimePatch(datetimeInputValue('2026-11-06T14:30:45.123Z', dateOnly), dateOnly),
                cleared: datetimePatch('', field),
            };
        });
        assert.equal(results.title, 'Verifica fattura di marzo');
        assert.equal(results.updatedTitle, 'Titolo aggiornato');
        assert.equal(results.updatedMockTitle, 'Titolo aggiornato');
        for (const call of results.calls.filter((c) => String(c.url).startsWith('/_api/'))) {
            assert.equal(call.headers.__RequestVerificationToken, 'csrf-test');
            assert.equal(call.headers['Content-Type'], call.body ? 'application/json' : undefined);
        }
        assert.equal(results.calls.at(-1).body, '{"title":"API title"}');
        assert.equal(results.local, '2026-11-06T15:30:45.123');
        assert.equal(results.utc, '2026-11-07T14:30:45.123Z');
        assert.equal(results.independent, '2026-11-06T14:30:45.123Z');
        assert.equal(results.date, '2026-11-06');
        assert.equal(results.cleared, null);
        const first = page.getByRole('link', { name: 'Verifica fattura di marzo', exact: true });
        await first.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL('**/richiesta-dettaglio/RIC-0001');
        const title = page.getByLabel(/^Titolo/);
        await title.fill('Bozza del primo record');
        const navigate = async (key) => page.evaluate((key) => {
            history.pushState({}, '', `/richiesta-dettaglio/${key}`);
            dispatchEvent(new PopStateEvent('popstate'));
        }, key);
        await navigate('RIC-0002');
        await page.getByRole('heading', { name: 'Attivazione nuovo servizio', exact: true }).waitFor();
        assert.equal(await title.inputValue(), 'Attivazione nuovo servizio');
        assert.equal(await page.getByRole('button', { name: 'Salva', exact: true }).isDisabled(), true);
        assert.equal(await page.getByLabel('Data apertura').getAttribute('type'), 'datetime-local');
        await page.evaluate(async () => {
            const { data } = await import('/src/data/adapter.ts');
            window.originalUpdate = data.update;
            data.update = async () => { throw new Error('PATCH non riuscito'); };
        });
        await title.fill('Bozza da riprovare');
        await page.getByRole('button', { name: 'Salva', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Salvataggio non riuscito' }).waitFor();
        assert.equal(await title.inputValue(), 'Bozza da riprovare');
        assert.equal(await page.getByRole('button', { name: 'Salva', exact: true }).isEnabled(), true);
        await page.evaluate(async () => {
            const { data } = await import('/src/data/adapter.ts');
            data.update = window.originalUpdate;
            window.originalGet = data.get;
            window.pending = {};
            data.get = (s, key) => new Promise((resolve) => { window.pending[key] = () => window.originalGet(s, key).then(resolve); });
        });
        await navigate('RIC-0001');
        await page.waitForFunction(() => Boolean(window.pending['RIC-0001']));
        await navigate('RIC-0003');
        await page.waitForFunction(() => Boolean(window.pending['RIC-0003']));
        await page.evaluate(() => window.pending['RIC-0003']());
        await page.getByRole('heading', { name: 'Cambio indirizzo di fatturazione', exact: true }).waitFor();
        await page.evaluate(() => window.pending['RIC-0001']());
        assert.equal(await title.inputValue(), 'Cambio indirizzo di fatturazione');
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await server.close();
    }
}

test('scaffold + Sales Hub baseline + pipeline check (end to end)', { skip: process.env.SKIP_E2E === '1', timeout: 300000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-'));
    for (const [appType, extra] of [['model-driven', ['--hub', 'sales-hub']], ['code-app', []], ['power-pages', []]]) {
        const root = join(dir, appType);
        const r = node([join(scripts, 'poc-init.mjs'), '--root', root, '--app-type', appType, '--prefix', 'tst_', '--name', 'Test App', '--initiative', 'Test', '--client', appType.replace('-', ''), '--json', ...extra]);
        const out = JSON.parse(r.stdout);
        assert.equal(out.ok, true, JSON.stringify(out.steps));
        const coverage = JSON.parse(readFileSync(join(root, 'dist', 'requirements-coverage.json'), 'utf8'));
        assert.equal(coverage.filter((c) => c.status === 'scoperto').length, 0);
        if (appType === 'power-pages') await checkPowerPages(root);
        // A broken reference must make the validator fail.
        const index = join(root, 'config', 'index.yaml');
        writeFileSync(index, readFileSync(index, 'utf8').replace(/appType: \S+/, 'appType: canvas'));
        assert.throws(() => execFileSync(process.execPath, [join(root, 'scripts', 'validate-poc-config.mjs')], { stdio: 'pipe' }));
    }
    rmSync(dir, { recursive: true });
});
