// Shared simulation in the browser, on one scaffolded model-driven POC with a plugin SPA portal:
// - two back-office windows: edit, live refresh, conflict, create, delete, reset; static dist stays read-only;
// - back-office (/) and portal (/portal/): changes flow both ways, create, conflict, reset.
// Needs npm registry access and a Chromium browser (msedge, chrome or Playwright's own); set SKIP_E2E=1 to skip it.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const plugin = resolve('plugins/dataverse-poc/scripts');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SIMULATION = `
simulation:
  portal:
    kind: plugin-spa
    screens: [ava_richiesta_view]
powerPages:
  navigation: [ava_richiesta_view]
  tablePermissions:
    - logicalName: ava_tp_richieste
      displayName: Richieste (demo)
      table: ava_richiesta
      scope: global
      privileges: [read, write, create]
      roles: [authenticated]
`;

test('shared simulation in the browser', { skip: process.env.SKIP_E2E === '1', timeout: 600000 }, async (t) => {
    // Canonical path: Vite and Playwright compare real paths (Windows tmpdir can be an 8.3 short path).
    const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'poc-sim-')));
    const poc = join(dir, 'POC');
    let server;
    let browser;
    const errors = [];
    try {
        execFileSync(process.execPath, [join(plugin, 'poc-init.mjs'), '--root', poc, '--app-type', 'model-driven', '--prefix', 'ava_', '--name', 'Demo Sim', '--initiative', 'Sim', '--client', 'Contoso', '--json'], { stdio: 'pipe' });
        appendFileSync(join(poc, 'config', 'index.yaml'), SIMULATION);
        execFileSync(process.execPath, [join(plugin, 'poc-spa-scaffold.mjs'), '--root', poc, '--build', '--json'], { stdio: 'pipe' });

        server = spawn(process.execPath, ['scripts/sim-server.mjs', '--port', '0'], { cwd: poc, stdio: 'pipe' });
        const base = await new Promise((resolveBase, reject) => {
            let out = '';
            server.stdout.on('data', (d) => { out += d; const m = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out); if (m) resolveBase(`http://127.0.0.1:${m[1]}`); });
            server.on('exit', (code) => reject(new Error(`sim-server uscito con ${code}`)));
        });
        const { chromium } = createRequire(join(poc, 'package.json'))('playwright-core');
        for (const channel of ['msedge', 'chrome', undefined]) { try { browser = await chromium.launch({ channel }); break; } catch { /* next */ } }
        assert.ok(browser, 'nessun browser Chromium disponibile');

        async function open(path, ready) {
            const p = await (await browser.newContext()).newPage();
            p.on('pageerror', (e) => errors.push(e.message));
            p.on('dialog', (d) => d.accept());
            await p.goto(base + path);
            await p.waitForSelector(ready);
            return p;
        }
        const resetAll = () => fetch(`${base}/_sim/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sim-Client': 'test' }, body: '{}' });

        await t.test('two back-office windows', async () => {
            const a = await open('/', '#poc-sim-banner');
            const b = await open('/', '#poc-sim-banner');

            // A edits, B sees it without reload.
            await a.click('tr[data-open][data-key="RIC-0001"]');
            await a.fill('[data-sim-field="ava_titolo"]', 'Titolo da A');
            await a.selectOption('[data-sim-field="ava_stato"]', '30');
            await a.click('[data-sim-action="save"]');
            await a.waitForSelector('[data-sim-message]:has-text("Modifiche salvate")');
            await b.waitForSelector('td:has-text("Titolo da A")', { timeout: 2000 });

            // Conflict: B starts editing, A saves again, B is warned, keeps its draft and can overwrite.
            await b.click('tr[data-open][data-key="RIC-0001"]');
            await b.fill('[data-sim-field="ava_titolo"]', 'Titolo da B');
            await a.fill('[data-sim-field="ava_titolo"]', 'Titolo da A, seconda');
            await a.click('[data-sim-action="save"]');
            await a.waitForSelector('[data-sim-message]:has-text("Modifiche salvate")');
            await b.waitForSelector('.message-bar.warning', { timeout: 2000 });
            assert.equal(await b.inputValue('[data-sim-field="ava_titolo"]'), 'Titolo da B');
            await b.click('[data-sim-action="save"]');
            await b.click('.poc-sim-dialog [data-choice="overwrite"]');
            await b.waitForSelector('[data-sim-message]:has-text("Modifiche salvate")');
            await a.waitForFunction(() => document.querySelector('[data-sim-field="ava_titolo"]')?.value === 'Titolo da B', null, { timeout: 2000 });

            // A creates a record from the view; the key is generated.
            await a.goto(`${base}/`);
            await a.waitForSelector('#poc-sim-banner');
            await a.click('[data-sim-action="new"]');
            await a.fill('[data-sim-field="ava_titolo"]', 'Richiesta nuova da A');
            await a.click('[data-sim-action="save"]');
            await a.waitForSelector('[data-sim-message]:has-text("Record creato")');
            await b.goto(`${base}/`);
            await b.waitForSelector('td:has-text("Richiesta nuova da A")', { timeout: 3000 });

            // A deletes it, B's view drops it.
            await a.click('[data-sim-action="delete"]');
            await a.click('.poc-sim-dialog [data-choice="yes"]');
            await b.waitForFunction(() => !document.body.textContent.includes('Richiesta nuova da A'), null, { timeout: 2000 });

            // Reset from A brings B back to the seed.
            await a.click('[data-sim-reset]');
            await a.click('.poc-sim-dialog [data-choice="yes"]');
            await b.waitForFunction(() => !document.body.textContent.includes('Titolo da B'), null, { timeout: 3000 });

            // The static dist stays read-only.
            const dist = readdirSync(join(poc, 'dist')).find((f) => f.endsWith('.html'));
            const s = await (await browser.newContext()).newPage();
            await s.goto(pathToFileURL(join(poc, 'dist', dist)).href);
            await s.click('tr[data-open]');
            await wait(300);
            assert.equal(await s.$('#poc-sim-banner'), null);
            assert.equal(await s.$('[data-sim-field]'), null);
        });

        await t.test('back-office and portal share the state', async () => {
            await resetAll();
            const field = (label) => `label:has(span:text-is("${label}")) input, label:has(span:text-is("${label} *")) input`;
            const bo = await open('/', '#poc-sim-banner');
            const po = await open('/portal/', '.banner.sim');
            await po.waitForSelector('td:has-text("Verifica fattura di marzo")');

            // Portal -> back-office.
            await po.click('a:has-text("Verifica fattura di marzo")');
            await po.fill(field('Titolo'), 'Titolo dal portale');
            await po.click('button:has-text("Salva")');
            await po.waitForSelector('.message:has-text("Modifiche salvate")');
            await bo.waitForSelector('td:has-text("Titolo dal portale")', { timeout: 2000 });

            // Back-office -> portal list.
            await po.click('a.button');
            await po.waitForSelector('td:has-text("Titolo dal portale")');
            await bo.click('tr[data-open][data-key="RIC-0002"]');
            await bo.fill('[data-sim-field="ava_titolo"]', 'Titolo dal back-office');
            await bo.click('[data-sim-action="save"]');
            await bo.waitForSelector('[data-sim-message]:has-text("Modifiche salvate")');
            await po.waitForSelector('td:has-text("Titolo dal back-office")', { timeout: 2000 });

            // Portal creates, back-office sees it.
            await po.click('button:has-text("Nuovo")');
            await po.fill(field('Titolo'), 'Richiesta dal portale');
            await po.click('button:has-text("Salva")');
            await po.waitForURL(/richiesta-form\/RIC-\d+$/);
            await bo.click('[data-nav]');
            await bo.waitForSelector('td:has-text("Richiesta dal portale")', { timeout: 2000 });

            // Conflict: portal draft, back-office saves, portal is warned and overwrites (dialog accepted).
            await po.goto(`${base}/portal/richiesta-form/RIC-0003`);
            await po.fill(field('Titolo'), 'Bozza portale');
            await bo.click('tr[data-open][data-key="RIC-0003"]');
            await bo.fill('[data-sim-field="ava_titolo"]', 'Salvato dal back-office');
            await bo.click('[data-sim-action="save"]');
            await bo.waitForSelector('[data-sim-message]:has-text("Modifiche salvate")');
            await po.waitForSelector('.message.warning', { timeout: 2000 });
            await po.click('button:has-text("Salva")');
            await po.waitForSelector('.message:has-text("Modifiche salvate")');
            await bo.waitForFunction(() => document.querySelector('[data-sim-field="ava_titolo"]')?.value === 'Bozza portale', null, { timeout: 2000 });

            // Reset from the portal reaches the back-office.
            await po.click('.banner.sim button');
            await bo.waitForFunction(() => document.querySelector('[data-sim-field="ava_titolo"]')?.value !== 'Bozza portale', null, { timeout: 3000 });
        });

        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        server?.kill();
        // On Windows, native binaries loaded during the SPA build can stay locked for a moment.
        try { rmSync(dir, { recursive: true, force: true }); } catch (error) { if (process.platform !== 'win32') throw error; }
    }
});
