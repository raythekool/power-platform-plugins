#!/usr/bin/env node
// Deterministic scaffold of the React + Vite project of a Power Pages SPA site, generated from the YAML of a
// power-pages POC. The POC stays the single source: screens, fields, datasets, web roles and table permissions.
//
// node poc-spa-scaffold.mjs --root <poc-root> [--out realization/power-pages] [--force] [--build] [--json]
//   src/generated/* and power-pages/* are rewritten on every run; the other files (pages, data adapters, auth,
//   styles, configuration) are created only when missing, unless --force. --build also runs npm install and npm run build.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const template = resolve(here, '../skills/prototype-dataverse-app/assets/power-pages-spa');
const isWin = process.platform === 'win32';

function parseArgs(argv) {
    const out = { flags: new Set() };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
        else out.flags.add(key);
    }
    return out;
}
const args = parseArgs(process.argv.slice(2));
const json = args.flags.has('json');
const force = args.flags.has('force');
const fail = (msg) => { if (json) console.log(JSON.stringify({ ok: false, error: msg })); else console.error(`ERRORE  ${msg}`); process.exit(2); };

if (!args.root) fail('--root obbligatorio (cartella della POC)');
const root = resolve(args.root);
const modelLib = join(root, 'scripts', 'lib', 'poc-model.mjs');
if (!existsSync(modelLib)) fail(`${modelLib} mancante: creare la POC con poc-init.mjs (o aggiornarla con --update)`);

// Gate: lo scaffold parte solo da un prototipo valido (stesso validator di npm run check).
const v = spawnSync(process.execPath, [join(root, 'scripts', 'validate-poc-config.mjs'), '--json'], { cwd: root, encoding: 'utf8' });
if (v.status !== 0) {
    let errors;
    try { errors = JSON.parse(v.stdout.trim().split('\n').pop()).errors; } catch { errors = [(v.stderr || v.stdout).trim()]; }
    fail(`validate:config non superato, correggere i YAML prima dello scaffold: ${errors.slice(0, 5).join(' | ')}`);
}
// Import from the POC itself, so that js-yaml resolves from the POC node_modules.
const { loadModel } = await import(pathToFileURL(modelLib).href);
const model = loadModel();
const cfg = model.config;
if (cfg.appType !== 'power-pages') fail(`appType ${cfg.appType}: lo scaffold SPA vale solo per le POC power-pages`);

const out = resolve(root, args.out ?? join('realization', 'power-pages'));
const prefix = cfg.naming?.prefix ?? '';
const pp = cfg.powerPages ?? {};
const warnings = [];

// --- model ---------------------------------------------------------------------------------------
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const datasets = Object.fromEntries(model.datasets.map((d) => [d.doc.logicalName ?? d.ref.logicalName, d.doc]));
const entities = new Map(model.entities.map((e) => [e.doc.entity.logicalName, e.doc]));
const locals = new Map(model.components.map((c) => [c.doc.logicalName, c.doc]));
const definitions = new Map(model.definitions.map((c) => [c.doc.logicalName, c.doc]));
const parents = {};
for (const [ln, doc] of entities) if (doc.entity.targetForm) parents[doc.entity.targetForm] = ln;

const fieldKey = (f) => f.dataverse?.column ?? f.dataKey ?? f.logicalName;
const optionsOf = (f) => { const dv = f.dataverse ?? {}; return (Array.isArray(dv.choice) ? dv.choice : dv.choice?.options) ?? dv.options ?? f.options; };
const humanize = (k) => { const s = String(k).replace(new RegExp(`^${prefix}`), '').replace(/_/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
const toField = (f, key) => (f ? clean({
    key: key ?? fieldKey(f), label: f.displayName, control: f.control ?? 'text', readOnly: f.readOnly || undefined, required: f.required || undefined,
    options: optionsOf(f)?.map((o) => ({ value: o.value, label: o.label })),
}) : undefined);
const fieldsOf = (doc) => (doc.sections ?? []).flatMap((s) => s.fields ?? []);
const datasetOf = (ln) => entities.get(ln)?.entity.dataset ?? (parents[ln] ? entities.get(parents[ln]).entity.dataset : undefined);
const tableOf = (ln) => entities.get(ln)?.entity.dataverse?.table ?? (parents[ln] ? entities.get(parents[ln]).entity.dataverse?.table : undefined);

// Field metadata of a dataset, collected from every screen that reads it (labels, choice, types).
const metaByDataset = {};
for (const [ln, doc] of entities) {
    const ds = datasetOf(ln);
    if (ds) for (const f of fieldsOf(doc)) (metaByDataset[ds] ??= {})[fieldKey(f)] ??= f;
}
const isLookup = (f) => ['lookup', 'customer'].includes(f?.dataverse?.type ?? f?.control);
const selectName = (f) => (isLookup(f) ? `_${f.dataverse?.column ?? fieldKey(f)}_value` : fieldKey(f));

const roleNames = ['anonymous', 'authenticated', ...(pp.webRoles ?? []).map((r) => r.logicalName)];
const covers = (p, r) => p.roles?.includes(r) || (r !== 'anonymous' && p.roles?.includes('authenticated'));
const privilegesFor = (table) => Object.fromEntries(roleNames
    .map((r) => [r, [...new Set((pp.tablePermissions ?? []).filter((p) => p.table === table && covers(p, r)).flatMap((p) => p.privileges ?? []))]])
    .filter(([, list]) => list.length));
const path = (ln) => `/${ln.replace(new RegExp(`^${prefix}`), '').replace(/_/g, '-')}`;

function component(doc, override = {}) {
    if (!doc) return null;
    const b = { ...Object.fromEntries((doc.params ?? []).filter((p) => p.default !== undefined).map((p) => [p.name, p.default])), ...doc.bindings, ...override.args };
    return clean({
        logicalName: override.instance ?? doc.logicalName, displayName: override.displayName ?? doc.displayName, type: doc.type,
        items: b.items?.map((i) => ({ label: String(i.label), value: i.value })), groupBy: b.groupBy,
        groupField: b.groupBy ? toField(metaByDataset[b.dataset]?.[b.groupBy], b.groupBy) : undefined,
    });
}

const screens = {};
for (const [ln, doc] of entities) {
    const e = doc.entity;
    const kind = parents[ln] ? 'detail' : e.dataset ? 'list' : 'page';
    const ds = datasetOf(ln);
    const dsDoc = datasets[ds] ?? {};
    const t = tableOf(ln);
    const meta = metaByDataset[ds] ?? {};
    const tabs = doc.tabs?.length ? doc.tabs.map((x) => ({ logicalName: x.logicalName, displayName: x.displayName })) : [{ logicalName: '_main', displayName: 'Generale' }];
    let columns = [];
    if (kind === 'list') {
        const spec = e.columns?.length ? e.columns : Object.keys(dsDoc.records?.[0] ?? {}).filter((k) => k !== dsDoc.keyField).slice(0, 6);
        columns = spec.map((c) => {
            const key = typeof c === 'string' ? c : c.field;
            const f = toField(meta[key], key) ?? { key, label: humanize(key), control: 'text' };
            return typeof c === 'object' && c.label ? { ...f, label: c.label } : f;
        });
    }
    const sections = (doc.sections ?? []).map((s) => ({
        logicalName: s.logicalName ?? '_section', displayName: s.displayName ?? '', tab: kind === 'detail' ? (s.tab ?? tabs[0].logicalName) : undefined,
        fields: (s.fields ?? []).map((f) => toField(f)),
        components: [...(s.components ?? []).map((c) => component(locals.get(c))), ...(s.uses ?? []).map((u) => component(definitions.get(u.component), u))].filter(Boolean),
    })).map(clean);
    const dvKeys = kind === 'list' ? columns.map((c) => c.key) : kind === 'detail' ? fieldsOf(doc).map(fieldKey) : [];
    const select = [...new Set(dvKeys.map((k) => meta[k] ?? fieldsOf(doc).find((f) => fieldKey(f) === k)).filter((f) => f?.dataverse).map(selectName))];
    if (t && !t.entitySetName) warnings.push(`${ln}: entitySetName assente, usato ${t.logicalName}s (verificare sui metadata)`);
    screens[ln] = clean({
        logicalName: ln, displayName: e.displayName, path: path(ln), kind,
        access: e.access === undefined ? ['authenticated'] : [].concat(e.access),
        table: t?.logicalName, entitySet: t ? (t.entitySetName ?? `${t.logicalName}s`) : undefined, primaryId: t ? (t.primaryIdAttribute ?? `${t.logicalName}id`) : undefined,
        select, dataset: ds, keyField: ds ? (dsDoc.keyField ?? Object.keys(dsDoc.records?.[0] ?? {})[0]) : undefined,
        primaryField: t?.primaryNameAttribute ?? dsDoc.primaryField, columns, target: e.targetForm, parent: parents[ln],
        tabs, sections, hero: e.hero ? clean({ title: e.hero.title, text: e.hero.text }) : undefined,
        privileges: t ? privilegesFor(t.logicalName) : {},
    });
}

const navigation = pp.navigation ?? [...entities.keys()].filter((ln) => !parents[ln]);
const homeCandidate = cfg.demoPath?.[0];
const home = homeCandidate && screens[homeCandidate]?.kind !== 'detail' ? homeCandidate : navigation[0];
const personas = [{ logicalName: 'anonymous', displayName: 'Visitatore anonimo' }, { logicalName: 'authenticated', displayName: 'Utente autenticato' },
    ...(pp.webRoles ?? []).map((r) => ({ logicalName: r.logicalName, displayName: r.displayName }))];
const demoPersona = pp.demoPersona ?? personas[2]?.logicalName ?? 'authenticated';
const site = { name: cfg.application?.displayName ?? 'Sito', logicalName: cfg.application?.logicalName, prefix };

// Dataverse tables of the site: columns read by the screens, for the TS model and the Web API site settings.
const tables = {};
for (const [ln, doc] of entities) {
    const t = tableOf(ln);
    if (!t?.logicalName) continue;
    const entry = (tables[t.logicalName] ??= { table: t, columns: new Map() });
    for (const f of fieldsOf(doc)) if (f.dataverse && (!f.dataverse.table || f.dataverse.table === t.logicalName)) entry.columns.set(f.dataverse.column ?? fieldKey(f), f);
}
for (const s of Object.values(screens)) {
    const entry = s.table && tables[s.table];
    if (entry) for (const c of s.columns) { const f = metaByDataset[s.dataset]?.[c.key]; if (f?.dataverse) entry.columns.set(f.dataverse.column ?? c.key, f); }
}

// --- output ------------------------------------------------------------------------------------------
const J = (x) => JSON.stringify(x, null, 2);
const generated = [];
const write = (rel, content) => {
    const file = join(out, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    generated.push(rel);
};
const header = '// Generato da poc-spa-scaffold.mjs dai YAML della POC (config/): non modificare a mano, rieseguire lo script.\n';

write('src/generated/screens.ts', `${header}
export interface Option { value: number | string; label: string }
export interface Field { key: string; label: string; control: string; readOnly?: boolean; required?: boolean; options?: Option[] }
export interface Component { logicalName: string; displayName: string; type: string; items?: { label: string; value: string | number }[]; groupBy?: string; groupField?: Field }
export interface Section { logicalName: string; displayName: string; tab?: string; fields: Field[]; components: Component[] }
export interface Screen {
  logicalName: string;
  displayName: string;
  path: string;
  kind: 'list' | 'detail' | 'page';
  access: string[];
  table?: string;
  entitySet?: string;
  primaryId?: string;
  select: string[];
  dataset?: string;
  keyField?: string;
  primaryField?: string;
  columns: Field[];
  target?: string;
  parent?: string;
  tabs: { logicalName: string; displayName: string }[];
  sections: Section[];
  hero?: { title?: string; text?: string };
  privileges: Record<string, string[]>;
}

export const site = ${J(site)};
export const personas: { logicalName: string; displayName: string }[] = ${J(personas)};
export const demoPersona: string = ${J(demoPersona)};
export const navigation: string[] = ${J(navigation)};
export const home: string = ${J(home)};
export const screens: Record<string, Screen> = ${J(screens)};
`);

write('src/generated/mock-data.json', `${J(Object.fromEntries(Object.entries(datasets).map(([k, d]) => [k, d.records ?? []])))}\n`);

const TS = { string: 'string', text: 'string', memo: 'string', datetime: 'string', lookup: 'string', customer: 'string', file: 'string', boolean: 'boolean', multiselect: 'number[]' };
const pascal = (s) => String(s).split('_').filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join('');
write('src/generated/model.ts', `${header}
${Object.values(tables).map(({ table: t, columns }) => `export interface ${pascal(t.schemaName ?? t.logicalName)} {
  ${t.primaryIdAttribute ?? `${t.logicalName}id`}?: string;
${[...columns].map(([col, f]) => `  ${selectName({ ...f, dataverse: { ...f.dataverse, column: col } })}?: ${TS[f.dataverse.type ?? f.control] ?? (['choice', 'whole', 'decimal', 'money'].includes(f.dataverse.type ?? f.control) ? 'number' : 'string')} | null;`).join('\n')}
}`).join('\n\n')}

export const tables = ${J(Object.fromEntries(Object.values(tables).map(({ table: t, columns }) => [t.logicalName, {
        entitySet: t.entitySetName ?? `${t.logicalName}s`, primaryId: t.primaryIdAttribute ?? `${t.logicalName}id`, columns: [...columns.keys()].sort(),
    }])))} as const;
`);

const roleLabel = (r) => ({ anonymous: 'Anonymous Users', authenticated: 'Authenticated Users' }[r] ?? (pp.webRoles ?? []).find((x) => x.logicalName === r)?.displayName ?? r);
write('power-pages/site-settings.json', `${J(Object.values(tables).flatMap(({ table: t, columns }) => [
    { name: `Webapi/${t.logicalName}/enabled`, value: 'true' },
    { name: `Webapi/${t.logicalName}/fields`, value: [...columns.keys()].sort().join(',') },
]))}\n`);
write('power-pages/web-roles.json', `${J([
    { name: 'Anonymous Users', builtIn: true },
    { name: 'Authenticated Users', builtIn: true },
    ...(pp.webRoles ?? []).map((r) => ({ name: r.displayName, logicalName: r.logicalName, builtIn: false })),
])}\n`);
write('power-pages/table-permissions.json', `${J((pp.tablePermissions ?? []).map((p) => clean({
    name: p.displayName, logicalName: p.logicalName, table: p.table, scope: p.scope, privileges: p.privileges,
    webRoles: (p.roles ?? []).map(roleLabel), parentPermission: p.parentPermission, relationship: p.relationship,
})))}\n`);

// Template files: created only when missing (project code), placeholders replaced.
const created = [];
const kept = [];
const packageName = `${(site.logicalName ?? 'site').replace(/_/g, '-')}-site`;
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
for (const src of walk(template)) {
    const rel = relative(template, src).replaceAll('\\', '/').replace(/^gitignore$/, '.gitignore');
    const dest = join(out, rel);
    if (existsSync(dest) && !force) { kept.push(rel); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(src, 'utf8').replaceAll('__SITE_NAME__', site.name).replaceAll('__PACKAGE_NAME__', packageName));
    created.push(rel);
}

const steps = [];
if (args.flags.has('build')) {
    const npm = (cmdArgs) => spawnSync(isWin ? 'npm.cmd' : 'npm', cmdArgs, { cwd: out, encoding: 'utf8', shell: isWin });
    for (const [name, cmdArgs] of [['npm install', ['install', '--no-audit', '--no-fund', '--loglevel=error']], ['npm run build', ['run', 'build']]]) {
        const r = npm(cmdArgs);
        steps.push({ step: name, ok: r.status === 0, detail: r.status === 0 ? '' : (r.stderr || r.stdout).trim().split('\n').slice(-5).join(' ') });
        if (r.status !== 0) break;
    }
}

const ok = steps.every((s) => s.ok);
if (json) {
    console.log(JSON.stringify({ ok, out, screens: Object.keys(screens).length, tables: Object.keys(tables), generated, created, kept, warnings, steps }));
} else {
    console.log(`SPA Power Pages in ${out}: ${Object.keys(screens).length} schermate, tabelle ${Object.keys(tables).join(', ') || 'nessuna'}`);
    console.log(`Rigenerati: ${generated.join(', ')}`);
    if (created.length) console.log(`Creati: ${created.length} file del progetto`);
    if (kept.length) console.log(`Conservati (gia presenti): ${kept.length} file`);
    warnings.forEach((w) => console.warn(`AVVISO  ${w}`));
    for (const s of steps) console.log(`${s.ok ? 'OK ' : 'KO '} ${s.step}${s.detail ? `  ${s.detail}` : ''}`);
    console.log(`\nProssimi passi: cd "${out}" && npm install && npm run dev`);
}
process.exit(ok ? 0 : 1);
