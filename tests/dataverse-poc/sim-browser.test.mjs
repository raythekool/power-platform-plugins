// Shared simulation in the browser: two windows on a scaffolded model-driven POC (edit, live refresh,
// conflict, create, reset) and the static dist staying read-only. Needs npm registry access and a
// Chromium browser (msedge, chrome or Playwright's own); set SKIP_E2E=1 to skip it.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const initScript = resolve('plugins/dataverse-poc/scripts/poc-init.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('shared simulation: two windows edit the same model-driven POC', { skip: process.env.SKIP_E2E === '1', timeout: 300000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-sim-'));
    const poc = join(dir, 'POC');
    let server;
    let browser;
    try {
        execFileSync(process.execPath, [initScript, '--root', poc, '--app-type', 'model-driven', '--prefix', 'ava_', '--name', 'Demo Sim', '--initiative', 'Sim', '--client', 'Contoso', '--json'], { stdio: 'pipe' });

        server = spawn(process.execPath, ['scripts/sim-server.mjs', '--port', '0'], { cwd: poc, stdio: 'pipe' });
        const base = await new Promise((resolveBase, reject) => {
            let out = '';
            server.stdout.on('data', (d) => { out += d; const m = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(out); if (m) resolveBase(`http://127.0.0.1:${m[1]}`); });
            server.on('exit', (code) => reject(new Error(`sim-server uscito con ${code}`)));
        });

        const { chromium } = createRequire(join(poc, 'package.json'))('playwright-core');
        for (const channel of ['msedge', 'chrome', undefined]) { try { browser = await chromium.launch({ channel }); break; } catch { /* next */ } }
        assert.ok(browser, 'nessun browser Chromium disponibile');

        const errors = [];
        async function open() {
            const p = await (await browser.newContext()).newPage();
            p.on('pageerror', (e) => errors.push(e.message));
            await p.goto(`${base}/`);
            await p.waitForSelector('#poc-sim-banner');
            return p;
        }
        const a = await open();
        const b = await open();

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
        await b.waitForSelector('.poc-sim-dialog');
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

        // Reset from A brings B back to the seed.
        await a.click('[data-sim-reset]');
        await a.click('.poc-sim-dialog [data-choice="yes"]');
        await b.waitForFunction(() => !document.body.textContent.includes('Richiesta nuova da A'), null, { timeout: 3000 });

        // The static dist stays read-only.
        const dist = readdirSync(join(poc, 'dist')).find((f) => f.endsWith('.html'));
        const s = await (await browser.newContext()).newPage();
        await s.goto(pathToFileURL(join(poc, 'dist', dist)).href);
        await s.click('tr[data-open]');
        await wait(300);
        assert.equal(await s.$('#poc-sim-banner'), null);
        assert.equal(await s.$('[data-sim-field]'), null);

        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        server?.kill();
        rmSync(dir, { recursive: true, force: true });
    }
});
