// Repository-level checks for the power-platform-plugins marketplace:
// both marketplace manifests list the same plugins, each source resolves to a plugin whose
// Copilot (plugin.json) and Claude Code (.claude-plugin/plugin.json) manifests agree on name and version,
// each plugin ships README, CHANGELOG (with an entry for the current version) and LICENSE,
// and distributed files contain no customer identifiers, e-mail addresses or environment GUIDs.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const rel = (p) => relative(root, p).replaceAll('\\', '/');

const readJson = (file) => {
    if (!existsSync(file)) { errors.push(`missing file ${rel(file)}`); return null; }
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) { errors.push(`${rel(file)}: invalid JSON (${e.message})`); return null; }
};

const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === 'node_modules' || n === '.git' ? [] : walk(p)) : [p];
});

const MARKETS = ['.github/plugin/marketplace.json', '.claude-plugin/marketplace.json'];
const markets = MARKETS.map((m) => [m, readJson(join(root, m))]).filter(([, j]) => j);

for (const [m, j] of markets) {
    if (j.name !== 'power-platform-plugins') errors.push(`${m}: name must be "power-platform-plugins"`);
    if (!j.owner?.name) errors.push(`${m}: owner.name missing`);
    if (!Array.isArray(j.plugins) || !j.plugins.length) errors.push(`${m}: plugins[] empty`);
}

if (markets.length === 2) {
    const [[m1, a], [m2, b]] = markets;
    const key = (j) => JSON.stringify((j.plugins ?? []).map((p) => [p.name, p.source, p.version]).sort());
    if (key(a) !== key(b)) errors.push(`${m1} and ${m2} list different plugins, sources or versions`);
    if (a.metadata?.version !== b.metadata?.version) errors.push('marketplace metadata.version differs between the two manifests');
}

const readme = existsSync(join(root, 'README.md')) ? readFileSync(join(root, 'README.md'), 'utf8') : '';
if (!readme) errors.push('missing README.md');
const seen = new Set();
for (const entry of markets[0]?.[1].plugins ?? []) {
    const { name, source, version } = entry;
    if (seen.has(name)) errors.push(`duplicate plugin entry ${name}`);
    seen.add(name);
    if (!/^\.\/plugins\/[a-z0-9-]+$/.test(source ?? '')) { errors.push(`${name}: source "${source}" must be ./plugins/<name>`); continue; }
    const dir = resolve(root, source);
    if (!existsSync(dir)) { errors.push(`${name}: source folder ${source} not found`); continue; }

    for (const manifest of ['plugin.json', '.claude-plugin/plugin.json']) {
        const j = readJson(join(dir, manifest));
        if (!j) continue;
        if (j.name !== name) errors.push(`${name}: ${manifest} name "${j.name}" differs from marketplace`);
        if (j.version !== version) errors.push(`${name}: ${manifest} version ${j.version} differs from marketplace ${version}`);
    }

    for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
        if (!existsSync(join(dir, f))) errors.push(`${name}: missing ${f}`);
    }
    const changelog = join(dir, 'CHANGELOG.md');
    if (existsSync(changelog)) {
        const esc = String(version).replaceAll('.', '\\.');
        if (!new RegExp(`^#{2,3} ${esc}\\b`, 'm').test(readFileSync(changelog, 'utf8'))) errors.push(`${name}: CHANGELOG.md has no heading for ${version}`);
    }
    // README catalog row: "| ... [`<name>`](plugins/<name>/README.md) | <version> |"
    const row = readme.split(/\r?\n/).find((l) => l.startsWith('|') && l.includes(`[\`${name}\`](plugins/${name}/README.md)`));
    if (!row) errors.push(`README.md: catalog row for ${name} missing`);
    else if (row.split('|')[2]?.trim() !== version) errors.push(`README.md: catalog version for ${name} is "${row.split('|')[2]?.trim()}", expected ${version}`);
}

// Confidentiality: distributed files only. Extra private regexes via PPP_DENYLIST (semicolon-separated).
const deny = [/ava-client-[a-z0-9-]+/gi, ...(process.env.PPP_DENYLIST ?? '').split(';').filter(Boolean).map((p) => new RegExp(p, 'gi'))];
const EMAIL = /\b[A-Za-z0-9._%+-]+@(?!example\.|contoso\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const TEXT = /\.(md|json|ya?ml|js|cjs|mjs|ps1|css|html|txt)$/i;
for (const file of walk(join(root, 'plugins')).filter((f) => TEXT.test(f))) {
    const text = readFileSync(file, 'utf8');
    for (const re of [...deny, EMAIL, GUID]) {
        for (const m of text.matchAll(re)) errors.push(`${rel(file)}: confidential-looking value "${m[0]}"`);
    }
}

if (errors.length) {
    errors.forEach((e) => console.error(`ERROR  ${e}`));
    process.exit(1);
}
console.log(`Marketplace valid: ${[...seen].join(', ')}.`);
