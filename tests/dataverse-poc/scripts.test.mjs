// Tests for the dataverse-poc plugin scripts. Run: node --test tests/dataverse-poc/*.test.mjs
// The end-to-end scaffold test needs npm registry access (npm install in a temp POC); set SKIP_E2E=1 to skip it.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
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
    const t = parseTarget(`# Piano\n\n## 🎯 Target ambiente\n\n| Chiave | Valore |\n| --- | --- |\n| URL ambiente | \`https://demo.crm4.dynamics.com\` |\n| Profilo PAC | da confermare |\n| Solution (unique name) | demosol |\n| Conferma utente stage R | sì, 2026-10-01 |\n\n## Altro\n| URL ambiente | https://wrong |\n`);
    assert.equal(t.url, 'https://demo.crm4.dynamics.com');
    assert.equal(t.solution, 'demosol');
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
});

test('scaffold + Sales Hub baseline + pipeline check (end to end)', { skip: process.env.SKIP_E2E === '1', timeout: 300000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'poc-'));
    for (const [appType, extra] of [['model-driven', ['--hub', 'sales-hub']], ['code-app', []]]) {
        const root = join(dir, appType);
        const r = node([join(scripts, 'poc-init.mjs'), '--root', root, '--app-type', appType, '--prefix', 'tst_', '--name', 'Test App', '--initiative', 'Test', '--client', appType.replace('-', ''), '--json', ...extra]);
        const out = JSON.parse(r.stdout);
        assert.equal(out.ok, true, JSON.stringify(out.steps));
        const coverage = JSON.parse(readFileSync(join(root, 'dist', 'requirements-coverage.json'), 'utf8'));
        assert.equal(coverage.filter((c) => c.status === 'scoperto').length, 0);
        // A broken reference must make the validator fail.
        const index = join(root, 'config', 'index.yaml');
        writeFileSync(index, readFileSync(index, 'utf8').replace(/appType: \S+/, 'appType: canvas'));
        assert.throws(() => execFileSync(process.execPath, [join(root, 'scripts', 'validate-poc-config.mjs')], { stdio: 'pipe' }));
    }
    rmSync(dir, { recursive: true });
});
