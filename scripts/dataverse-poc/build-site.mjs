// Builds the dataverse-poc website into one folder (default _site/dataverse-poc): copies site/dataverse-poc/ and
// docs/dataverse-poc/images/ (shared with the docs), resolves {{BASE_URL}}, {{REPO_URL}}, {{REPO_SLUG}}, {{VERSION}} and generates the live demos with the
// plugin's own scaffold (poc-init + Sales Hub baseline). Needs npm registry access unless --no-demo.
//
// node scripts/dataverse-poc/build-site.mjs [--out _site/dataverse-poc] [--base-url https://owner.github.io/repo/dataverse-poc] [--repo-url https://github.com/owner/repo] [--no-demo]
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const out = resolve(opt('out') ?? '_site/dataverse-poc');

let repoUrl = opt('repo-url');
if (!repoUrl) {
    const remote = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    repoUrl = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
}
repoUrl = repoUrl.replace(/\/$/, '');
const slug = repoUrl.replace(/^https:\/\/github\.com\//, '');
if (!/^[^/]+\/[^/]+$/.test(slug)) throw new Error(`URL del repository inatteso: ${repoUrl}`);
const [owner, name] = slug.split('/');
const baseUrl = (opt('base-url') ?? `https://${owner}.github.io/${name}/dataverse-poc`).replace(/\/$/, '');
const version = JSON.parse(readFileSync(join(root, 'plugins/dataverse-poc/plugin.json'), 'utf8')).version;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'site/dataverse-poc'), out, { recursive: true });
cpSync(join(root, 'docs/dataverse-poc/images'), join(out, 'images'), { recursive: true });
writeFileSync(join(out, '.nojekyll'), '');

// Live demos: the same scaffold users get, built into self-contained HTML files.
const demos = [];
if (!argv.includes('--no-demo')) {
    const work = mkdtempSync(join(tmpdir(), 'dvpoc-site-'));
    const scripts = join(root, 'plugins/dataverse-poc/scripts');
    const node = (args, cwd) => {
        const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
    };
    const builds = [
        { file: 'model-driven.html', args: ['--app-type', 'model-driven', '--name', 'Order Service'], hub: 'sales-hub' },
        { file: 'code-app.html', args: ['--app-type', 'code-app', '--name', 'Configuratore Offerte'] },
        { file: 'power-pages.html', args: ['--app-type', 'power-pages', '--name', 'Portale Assistenza'] },
    ];
    mkdirSync(join(out, 'demo'), { recursive: true });
    for (const b of builds) {
        const poc = join(work, b.file.replace('.html', ''));
        node([join(scripts, 'poc-init.mjs'), '--root', poc, '--prefix', 'demo_', '--no-check', '--json', ...b.args]);
        if (b.hub) node([join(scripts, 'poc-add-standard.mjs'), '--root', poc, '--hub', b.hub, '--json']);
        node([join(poc, 'scripts', 'build-static-poc.mjs')], poc);
        const html = readdirSync(join(poc, 'dist')).find((f) => f.endsWith('.html'));
        cpSync(join(poc, 'dist', html), join(out, 'demo', b.file));
        demos.push(`demo/${b.file}`);
    }
    rmSync(work, { recursive: true, force: true });
}

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
let replaced = 0;
for (const file of walk(out).filter((f) => ['.html', '.xml', '.txt'].includes(extname(f)) && !f.includes(`${join(out, 'demo')}`))) {
    const text = readFileSync(file, 'utf8');
    const next = text.replaceAll('{{BASE_URL}}', baseUrl).replaceAll('{{REPO_URL}}', repoUrl).replaceAll('{{REPO_SLUG}}', slug).replaceAll('{{VERSION}}', version);
    const left = next.match(/\{\{[A-Z_]+\}\}/);
    if (left) throw new Error(`Segnaposto non risolto in ${file}: ${left[0]}`);
    if (next !== text) { writeFileSync(file, next); replaced++; }
}
if (!argv.includes('--no-demo') && !demos.every((d) => existsSync(join(out, d)))) throw new Error('demo mancanti');

console.log(JSON.stringify({ out, baseUrl, repoUrl, version, demos, files: walk(out).length, replaced }, null, 2));
