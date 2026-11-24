import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';

const plugin = resolve(import.meta.dirname, '../../plugins/dataverse-poc');
const init = join(plugin, 'scripts', 'poc-init.mjs');
const shellSource = readFileSync(join(plugin, 'skills', 'prototype-dataverse-app', 'assets', 'mda-shell.js'), 'utf8');

function shell() {
    const styles = {};
    const context = {
        window: { scrollTo() {} },
        document: { documentElement: { style: { setProperty: (name, value) => { styles[name] = value; } } } },
    };
    runInNewContext(shellSource, context);
    return { api: context.window.MdaShell, styles };
}

function config(value) {
    const cfg = {
        application: { logicalName: 'tst_workspace', displayName: 'Workspace' },
        demoPath: ['tst_view'],
        navigation: { areas: [{ logicalName: 'tst_area', groups: [] }] },
    };
    if (value !== undefined) cfg.customerServiceWorkspace = value;
    return cfg;
}

const tabstrip = (api, state) => api.renderTabstrip(state, (tab) => tab.screen, () => 'view');
const runInit = (root, extra = []) => spawnSync(process.execPath, [
    init, '--root', root, '--app-type', 'model-driven', '--prefix', 'tst_', '--name', 'Test App',
    '--no-install', '--no-check', '--json', ...extra,
], { encoding: 'utf8' });

test('model-driven defaults to a single page and keeps recent records', () => {
    for (const setting of [undefined, false]) {
        const { api, styles } = shell();
        const state = api.createState(config(setting));
        assert.equal(tabstrip(api, state), '');
        assert.equal(styles['--tabstrip-h'], '0px');

        api.openRecord(state, 'tst_form', 'one');
        api.openRecord(state, 'tst_form', 'two');
        assert.equal(state.tabs.length, 1);
        assert.equal(api.activeTab(state).key, 'two');
        assert.equal(state.recent.map((record) => record.key).join(','), 'two,one');
        api.pinRecent(state, 1);
        assert.equal(state.pinned[0].key, 'one');
        api.openInCurrentTab(state, 'tst_view');
        assert.equal(api.activeTab(state).screen, 'tst_view');
        assert.equal(api.activeTab(state).key, null);
    }
});

test('explicit Customer Service Workspace preserves session tabs and the ten-tab limit', () => {
    const { api, styles } = shell();
    const state = api.createState(config(true));
    assert.match(tabstrip(api, state), /class="tabstrip"/);
    assert.equal(styles['--tabstrip-h'], '40px');

    for (let i = 1; i <= 12; i++) api.openRecord(state, 'tst_form', String(i));
    assert.equal(state.tabs.length, 10);
    assert.equal(api.activeTab(state).key, '12');
    assert.equal(state.tabs[0].key, '3');
    api.openRecord(state, 'tst_form', '3');
    assert.equal(state.tabs.length, 10);
    assert.equal(api.activeTab(state).key, '3');
    api.closeTab(state, 0);
    assert.equal(state.tabs.length, 9);
});

test('standard app selections do not inherit workspace tabs and restore them on return', () => {
    const { api, styles } = shell();
    const state = api.createState(config(true));
    api.openRecord(state, 'tst_form', 'workspace-record');
    api.selectApp(state, 'tst_customer_service_hub');
    assert.equal(tabstrip(api, state), '');
    assert.equal(styles['--tabstrip-h'], '0px');
    assert.equal(state.tabs.length, 1);

    api.openRecord(state, 'tst_form', 'hub-record');
    assert.equal(state.tabs.length, 1);
    api.selectApp(state, 'tst_workspace');
    assert.match(tabstrip(api, state), /class="tabstrip"/);
    assert.equal(styles['--tabstrip-h'], '40px');
    assert.equal(state.tabs.length, 2);
    assert.equal(api.activeTab(state).key, 'workspace-record');
});

test('shell rejects invalid workspace settings', () => {
    const { api } = shell();
    for (const value of ['true', 1, null, [], {}]) {
        assert.throws(() => api.createState(config(value)), /customerServiceWorkspace deve essere true o false/);
    }
});

test('scaffold persists a workspace only when explicitly requested', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-layout-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const [name, extra, enabled] of [
        ['standard', [], false],
        ['workspace', ['--customer-service-workspace'], true],
    ]) {
        const root = join(dir, name);
        const plan = join(dir, `${name}.md`);
        const result = runInit(root, [...extra, '--plan', plan]);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(JSON.parse(result.stdout).customerServiceWorkspace, enabled);
        assert.match(readFileSync(join(root, 'config', 'index.yaml'), 'utf8'), new RegExp(`^customerServiceWorkspace: ${enabled}$`, 'm'));
        assert.match(readFileSync(plan, 'utf8'), enabled ? /Customer Service Workspace \(multisessione\) \| utente/ : /Standard \(sessione singola\) \| default/);
    }
});

test('scaffold rejects workspace flags for other app types, values and updates', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-layout-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const type of ['code-app', 'power-pages']) {
        const result = spawnSync(process.execPath, [
            init, '--root', join(dir, type), '--app-type', type, '--prefix', 'tst_', '--name', 'Test',
            '--customer-service-workspace', '--no-install', '--no-check', '--json',
        ], { encoding: 'utf8' });
        assert.equal(result.status, 2);
        assert.match(JSON.parse(result.stdout).error, /solo con --app-type model-driven/);
    }
    for (const extra of [['--customer-service-workspace', 'true'], ['--customer-service-workspace=true']]) {
        const result = runInit(join(dir, 'invalid'), extra);
        assert.equal(result.status, 2);
        assert.match(JSON.parse(result.stdout).error, /flag senza valore/);
    }
    const result = spawnSync(process.execPath, [
        init, '--root', join(dir, 'update'), '--update', '--customer-service-workspace', '--json',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(JSON.parse(result.stdout).error, /non modifica config/);
});

test('updating an existing POC leaves its workspace decision untouched', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-layout-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const root = join(dir, 'poc');
    assert.equal(runInit(root, ['--customer-service-workspace']).status, 0);
    const index = join(root, 'config', 'index.yaml');
    // Project extensions survive the update; the shared simulation files arrive with it.
    const customJs = '/* progetto */ PocApp.onDataChanged(function () {});\n';
    writeFileSync(join(root, 'app', 'custom.js'), customJs);
    writeFileSync(join(root, 'app', 'custom.css'), '.x { color: red; }\n');
    const afterUpdate = () => {
        assert.equal(readFileSync(join(root, 'app', 'custom.js'), 'utf8'), customJs);
        assert.equal(readFileSync(join(root, 'app', 'custom.css'), 'utf8'), '.x { color: red; }\n');
        assert.ok(readFileSync(join(root, 'app', 'poc-sim.js'), 'utf8').includes('global.PocSim'));
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        assert.equal(pkg.scripts.sim, 'node scripts/sim-server.mjs');
    };
    for (const text of [
        readFileSync(index, 'utf8'),
        readFileSync(index, 'utf8').replace(/^customerServiceWorkspace: true\r?\n/m, ''),
    ]) {
        writeFileSync(index, text);
        const result = spawnSync(process.execPath, [init, '--root', root, '--update', '--no-install', '--json'], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(readFileSync(index, 'utf8'), text);
        afterUpdate();
    }
});

async function checkBrowserPage(browser, url, workspace, banner) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    try {
        await page.goto(url);
        await page.locator('tr[data-key="RIC-0001"]').first().waitFor();
        const layout = await page.evaluate(() => {
            const header = document.querySelector('.mda-header').getBoundingClientRect();
            const banner = document.querySelector('.proto-banner')?.getBoundingClientRect();
            const strip = document.querySelector('.tabstrip')?.getBoundingClientRect();
            const sitemap = document.querySelector('.sitemap').getBoundingClientRect();
            return {
                height: getComputedStyle(document.documentElement).getPropertyValue('--tabstrip-h').trim(),
                strip: Boolean(strip),
                banner: Boolean(banner),
                top: sitemap.top,
                expectedTop: (strip || banner || header).bottom,
            };
        });
        assert.equal(layout.strip, workspace, url);
        assert.equal(layout.height, workspace ? '40px' : '0px', url);
        assert.equal(layout.banner, banner, url);
        assert.ok(Math.abs(layout.top - layout.expectedTop) < 1.5, JSON.stringify(layout));

        await page.locator('tr[data-key="RIC-0001"]').first().click();
        assert.equal(await page.locator('.form-head h1').textContent(), 'Verifica fattura di marzo');
        assert.equal(await page.locator('.form-tabs [data-form-tab]').count(), 2);
        await page.getByRole('button', { name: 'Dettagli', exact: true }).click();
        assert.match(await page.getByRole('button', { name: 'Dettagli', exact: true }).getAttribute('class'), /active/);

        if (workspace) {
            assert.equal(await page.locator('.tabstrip .tab').count(), 2);
            await page.locator('.tabstrip [data-tab="0"]').click();
        } else {
            assert.equal(await page.locator('.tabstrip').count(), 0);
            await page.locator('.form-head .crumb [data-nav]').click();
        }
        await page.locator('tr[data-key="RIC-0002"]').first().click();
        assert.equal(await page.locator('.form-head h1').textContent(), 'Attivazione nuovo servizio');

        if (workspace) {
            assert.equal(await page.locator('.tabstrip .tab').count(), 3);
            await page.locator('.tabstrip [data-tab="1"]').click();
            assert.equal(await page.locator('.form-head h1').textContent(), 'Verifica fattura di marzo');
            await page.locator('[data-app-menu]').click();
            await page.locator('[data-app-select="tst_customer_service_hub"]').click();
            assert.equal(await page.locator('.tabstrip').count(), 0);
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tabstrip-h').trim()), '0px');
            await page.locator('[data-app-menu]').click();
            await page.locator('[data-app-select="tst_test_app"]').click();
            assert.equal(await page.locator('.tabstrip .tab').count(), 3);
            assert.equal(await page.locator('.form-head h1').textContent(), 'Verifica fattura di marzo');
        } else {
            assert.equal(await page.locator('.tabstrip').count(), 0);
            await page.locator('.sitemap [data-open][data-key="RIC-0001"]').click();
            assert.equal(await page.locator('.form-head h1').textContent(), 'Verifica fattura di marzo');
        }
        assert.deepEqual(errors, [], url);
    } finally {
        await page.close();
    }
}

test('model-driven pipeline validates and renders both session layouts end to end', {
    skip: process.env.SKIP_E2E === '1',
    timeout: 300000,
}, async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-layout-e2e-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const root = join(dir, 'poc');
    const scaffold = spawnSync(process.execPath, [
        init, '--root', root, '--app-type', 'model-driven', '--prefix', 'tst_', '--name', 'Test App',
        '--hub', 'customer-service-hub', '--no-check', '--json',
    ], { encoding: 'utf8' });
    assert.equal(scaffold.status, 0, scaffold.stdout + scaffold.stderr);
    assert.equal(JSON.parse(scaffold.stdout).customerServiceWorkspace, false);

    const require = createRequire(join(root, 'package.json'));
    const yaml = require('js-yaml');
    const { chromium } = require('playwright-core');
    const index = join(root, 'config', 'index.yaml');
    const baseConfig = yaml.load(readFileSync(index, 'utf8'));
    assert.equal(baseConfig.customerServiceWorkspace, false);
    assert.ok(baseConfig.modelDrivenApps.some((app) => app.logicalName === 'tst_customer_service_hub'));
    const writeConfig = (cfg) => writeFileSync(index, yaml.dump(cfg, { lineWidth: -1 }));
    const run = (script) => spawnSync(process.execPath, [join(root, 'scripts', script), '--json'], { encoding: 'utf8' });

    for (const [type, value, message] of [
        ['model-driven', 'true', /customerServiceWorkspace deve essere true o false/],
        ['code-app', true, /customerServiceWorkspace e ammesso solo con appType model-driven/],
        ['power-pages', false, /customerServiceWorkspace e ammesso solo con appType model-driven/],
    ]) {
        writeConfig({ ...baseConfig, appType: type, customerServiceWorkspace: value });
        const result = run('validate-poc-config.mjs');
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(JSON.parse(result.stdout).errors.join('\n'), message);
    }

    const launchErrors = [];
    let browser;
    for (const channel of ['msedge', 'chrome', undefined]) {
        try {
            browser = await chromium.launch({ channel });
            break;
        } catch (error) {
            launchErrors.push(`${channel ?? 'chromium'}: ${error.message}`);
        }
    }
    assert.ok(browser, launchErrors.join('\n'));
    try {
        for (const [setting, banner] of [[undefined, true], [false, false], [true, true], [true, false]]) {
            const cfg = { ...baseConfig, showPrototypeBanner: banner };
            if (setting === undefined) delete cfg.customerServiceWorkspace;
            else cfg.customerServiceWorkspace = setting;
            writeConfig(cfg);
            for (const script of ['validate-poc-config.mjs', 'prepare-runtime-poc.mjs', 'build-static-poc.mjs']) {
                const result = run(script);
                assert.equal(result.status, 0, result.stdout + result.stderr);
            }
            for (const file of ['poc-runtime.html', join('dist', 'tst_test_app.html')]) {
                await checkBrowserPage(browser, pathToFileURL(join(root, file)).href, setting === true, banner);
            }
            if (setting === false || (setting === true && banner)) {
                const result = run('smoke-test.mjs');
                assert.equal(result.status, 0, result.stdout + result.stderr);
            }
        }
    } finally {
        await browser.close();
    }
});
