#!/usr/bin/env node
// Read-only check of the tools used by the dataverse-poc plugin. Never installs or changes anything.
// Usage: node check-prereqs.mjs [--stage P|R] [--json]
//   P (default): prototype stage — Node.js 18+, npm, Edge/Chrome for the smoke test.
//   R: adds PAC CLI, PACX and their auth profiles (realization in a DEV environment).
// Exit code 0 when every required tool is available, 1 otherwise.
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { findOnPath, isWin, run } from './lib/proc.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const stageArg = (args[args.indexOf('--stage') + 1] || 'P').toUpperCase();
const stage = args.includes('--stage') ? stageArg : 'P';
if (!['P', 'R'].includes(stage)) { console.error('--stage deve essere P o R'); process.exit(2); }
const version = (text) => (String(text).match(/\d+\.\d+(?:\.\d+){0,2}/) || [null])[0];

function findBrowser() {
    const candidates = isWin
        ? ['ProgramFiles(x86)', 'ProgramFiles', 'LOCALAPPDATA'].flatMap((v) => process.env[v] ? [
            join(process.env[v], 'Microsoft/Edge/Application/msedge.exe'),
            join(process.env[v], 'Google/Chrome/Application/chrome.exe')] : [])
        : platform() === 'darwin'
            ? ['/Applications/Microsoft Edge.app', '/Applications/Google Chrome.app']
            : [];
    const hit = candidates.find((p) => existsSync(p));
    if (hit) return hit;
    for (const n of ['microsoft-edge', 'microsoft-edge-stable', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
        const p = findOnPath(n);
        if (p) return p;
    }
    const pwCache = isWin ? join(process.env.LOCALAPPDATA || '', 'ms-playwright') : join(homedir(), platform() === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
    return existsSync(pwCache) ? pwCache : null;
}

// MCP servers the agents reference by name: search the usual VS Code / Copilot CLI config files.
function mcpConfigText() {
    const home = homedir();
    const files = [
        join(process.cwd(), '.vscode/mcp.json'),
        isWin ? join(process.env.APPDATA || '', 'Code/User/mcp.json') : platform() === 'darwin'
            ? join(home, 'Library/Application Support/Code/User/mcp.json') : join(home, '.config/Code/User/mcp.json'),
        isWin ? join(process.env.APPDATA || '', 'Code/User/settings.json') : platform() === 'darwin'
            ? join(home, 'Library/Application Support/Code/User/settings.json') : join(home, '.config/Code/User/settings.json'),
        join(home, '.copilot/mcp-config.json'),
    ];
    return files.filter((f) => existsSync(f)).map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n').toLowerCase();
}

const specs = [
    { id: 'node', name: 'Node.js 18+', cmd: 'node', args: ['--version'], stages: ['P', 'R'], min: '18.0.0', install: 'https://nodejs.org (LTS) oppure winget install OpenJS.NodeJS.LTS' },
    { id: 'npm', name: 'npm', cmd: 'npm', args: ['--version'], stages: ['P', 'R'], install: 'incluso in Node.js' },
    { id: 'git', name: 'git', cmd: 'git', args: ['--version'], stages: [], install: 'winget install Git.Git oppure https://git-scm.com' },
    { id: 'dotnet', name: '.NET SDK', cmd: 'dotnet', args: ['--version'], stages: [], install: 'https://dotnet.microsoft.com/download (serve per installare pac/pacx come dotnet tool)' },
    { id: 'pac', name: 'Power Platform CLI (pac)', cmd: 'pac', args: ['help'], stages: ['R'], install: 'dotnet tool install --global Microsoft.PowerApps.CLI.Tool' },
    { id: 'pacx', name: 'PACX', cmd: 'pacx', args: ['--version'], stages: ['R'], install: 'dotnet tool install --global Greg.Xrm.Command' },
    { id: 'code', name: 'VS Code', cmd: 'code', args: ['--version'], stages: [], install: 'https://code.visualstudio.com' },
    { id: 'copilot', name: 'GitHub Copilot CLI', cmd: 'copilot', args: ['--version'], stages: [], install: 'npm install -g @github/copilot' },
];

const checks = await Promise.all(specs.map(async (s) => {
    const path = findOnPath(s.cmd);
    const required = s.stages.includes(stage);
    if (!path) return { id: s.id, name: s.name, status: 'missing', version: null, required, detail: '', install: s.install };
    const r = await run(path, s.args);
    const v = version(r.out);
    let status = 'ok';
    let detail = r.code === 0 ? '' : `verifica versione fallita: ${String(r.out).trim().split(/\r?\n/)[0]?.slice(0, 120)}`;
    if (s.min && v && v.localeCompare(s.min, undefined, { numeric: true }) < 0) { status = 'missing'; detail = `versione < ${s.min}`; }
    return { id: s.id, name: s.name, status, version: v, required, detail, install: s.install };
}));

const browser = findBrowser();
checks.push({ id: 'browser', name: 'Edge o Chrome (smoke test)', status: browser ? 'ok' : 'missing', version: null, required: true, detail: browser || '', install: 'installare Edge o Chrome, oppure npx playwright install chromium' });

// Stage R: auth profiles must exist (credentials are always created by the user).
if (stage === 'R') {
    for (const [id, cmd] of [['pac-auth', 'pac'], ['pacx-auth', 'pacx']]) {
        const path = findOnPath(cmd);
        if (!path) continue;
        const r = await run(path, ['auth', 'list']);
        const hasProfile = r.code === 0 && /https?:\/\//i.test(r.out);
        checks.push({ id, name: `Profili ${cmd} auth`, status: hasProfile ? 'ok' : 'warning', version: null, required: false,
            detail: hasProfile ? 'almeno un profilo con URL' : 'nessun profilo trovato', install: `${cmd} auth create --environment <url ambiente DEV>` });
    }
}

const mcp = mcpConfigText();
for (const [id, pattern, use, st] of [
    ['mcp-learn', /microsoftdocs|microsoft-learn|mslearn|learn\.microsoft\.com/, 'Microsoft Learn: riuso tabelle standard', ['P', 'R']],
    ['mcp-appmaker', /appmaker/, 'AppMaker: metadata, form, viste, sitemap', ['R']],
    ['mcp-playwright', /playwright/, 'verifiche nel browser', ['R']],
    ['mcp-markitdown', /markitdown/, 'conversione documenti sorgente', []],
    ['mcp-icons', /icons/, 'icone delle tabelle', []],
]) {
    const found = pattern.test(mcp);
    checks.push({ id, name: `MCP ${id.slice(4)}`, status: found ? 'ok' : (st.includes(stage) ? 'warning' : 'info'), version: null, required: false,
        detail: found ? 'configurato' : `non trovato nelle configurazioni MCP (${use})`, install: 'aggiungere il server in mcp.json di VS Code' });
}

const missingRequired = checks.filter((c) => c.required && c.status === 'missing');
const ok = missingRequired.length === 0;
if (json) {
    console.log(JSON.stringify({ stage, ok, checks }, null, 2));
} else {
    const icon = { ok: '✔', missing: '✖', warning: '⚠', info: '·' };
    console.log(`Verifica requisiti dataverse-poc — stage ${stage}\n`);
    for (const c of checks) {
        const line = `${icon[c.status]} ${c.name.padEnd(30)} ${(c.version || '').padEnd(10)} ${c.required ? 'richiesto' : 'opzionale'}`;
        console.log(c.detail ? `${line}  ${c.detail}` : line);
        if (c.status !== 'ok' && (c.required || c.status === 'warning')) console.log(`    → ${c.install}`);
    }
    console.log(ok ? '\nRequisiti soddisfatti.' : `\nMancano ${missingRequired.length} requisiti obbligatori.`);
}
process.exit(ok ? 0 : 1);
