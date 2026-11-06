#!/usr/bin/env node
// Adds the out-of-the-box Sales Hub / Customer Service Hub baseline (or single standard tables) to a
// model-driven POC: copies view/form assets with the project prefix, updates config/index.yaml and seeds
// synthetic demo datasets from the form fields. Deterministic: no AI needed for the standard part.
//
// node poc-add-standard.mjs --root <poc> (--hub sales-hub|customer-service-hub | --tables account,contact)
//   [--seed 6] [--json]
// Needs `npm install` in the POC (uses its js-yaml). Comments in config/index.yaml are not preserved.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../skills/prototype-dataverse-app/assets');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined; };
const json = argv.includes('--json');
const fail = (msg) => { if (json) console.log(JSON.stringify({ ok: false, error: msg })); else console.error(`ERRORE  ${msg}`); process.exit(2); };

const root = resolve(opt('root') ?? '.');
const hub = opt('hub');
const tablesArg = opt('tables');
const seedCount = Number(opt('seed') ?? 6);
if (!hub && !tablesArg) fail('indicare --hub sales-hub|customer-service-hub oppure --tables account,contact,...');
if (hub && !['sales-hub', 'customer-service-hub'].includes(hub)) fail('--hub: sales-hub o customer-service-hub');
const indexFile = join(root, 'config', 'index.yaml');
if (!existsSync(indexFile)) fail(`${indexFile} mancante: creare prima la POC con poc-init`);
let yaml;
try { yaml = createRequire(join(root, 'package.json'))('js-yaml'); } catch { fail('js-yaml non trovato: eseguire npm install nella cartella della POC'); }

for (const d of ['entities', 'data']) mkdirSync(join(root, 'config', d), { recursive: true });
const dump = (doc) => yaml.dump(doc, { lineWidth: -1, noRefs: true, flowLevel: -1 });
const config = yaml.load(readFileSync(indexFile, 'utf8'));
if (config.appType !== 'model-driven') fail('le baseline standard valgono solo con appType model-driven');
const prefix = config.naming?.prefix;
const loadAsset = (rel) => yaml.load(readFileSync(join(assets, rel), 'utf8').replaceAll('{{prefix}}', prefix));
const assetExists = (rel) => existsSync(join(assets, rel));

// --- which tables -----------------------------------------------------------------------------------
let navigation = null;
let tables;
if (hub) {
    navigation = loadAsset(`standard-navigation/${hub}.yaml`).navigation;
    tables = [];
    for (const area of navigation.areas) for (const g of area.groups) for (const i of g.items) {
        if (typeof i === 'object' && i.pageType === 'view' && i.table && !tables.includes(i.table)) tables.push(i.table);
    }
} else {
    tables = tablesArg.split(',').map((t) => t.trim()).filter(Boolean);
}

config.entities ??= [];
const known = new Set(config.entities.map((e) => e.logicalName));
const added = [];
const skipped = [];
const views = [];
for (const table of tables) {
    if (!assetExists(`standard-entities/${table}_view.yaml`)) { skipped.push(`${table}: nessun asset view/form`); continue; }
    const view = loadAsset(`standard-entities/${table}_view.yaml`);
    const docs = [view];
    if (view.entity.targetForm && assetExists(`standard-entities/${table}_form.yaml`)) docs.push(loadAsset(`standard-entities/${table}_form.yaml`));
    for (const doc of docs) {
        const ln = doc.entity.logicalName;
        if (known.has(ln)) { skipped.push(`${ln}: gia presente`); continue; }
        const file = `entities/${ln}.yaml`;
        writeFileSync(join(root, 'config', file), `# Copiato da prototype-dataverse-app/assets/standard-entities/ (${table}).\n${dump(doc)}`);
        config.entities.push({ logicalName: ln, displayName: doc.entity.displayName, pageType: doc.entity.pageType, file });
        known.add(ln);
        added.push(ln);
    }
    views.push({ table, view, form: docs[1] ?? null });
}

// --- navigation ---------------------------------------------------------------------------------------
const hubName = { 'sales-hub': 'Hub delle vendite', 'customer-service-hub': 'Hub del servizio clienti' };
const hasItems = (nav) => (nav?.areas ?? []).some((a) => (a.groups ?? []).some((g) => (g.items ?? []).length));
if (navigation) {
    if (!hasItems(config.navigation)) {
        config.navigation = navigation;
    } else {
        config.modelDrivenApps ??= [{ logicalName: config.application.logicalName, displayName: config.application.displayName, navigation: 'current' }];
        const ln = `${prefix}${hub.replace(/-/g, '_')}`;
        if (!config.modelDrivenApps.some((a) => a.logicalName === ln)) config.modelDrivenApps.push({ logicalName: ln, displayName: hubName[hub], navigation });
    }
} else if (views.length) {
    config.navigation ??= { showHome: true, showRecent: true, showPinned: true, areas: [] };
    if (!config.navigation.areas.length) config.navigation.areas.push({ logicalName: `${prefix}area_standard`, displayName: 'Standard', groups: [] });
    const area = config.navigation.areas[0];
    let group = area.groups.find((g) => g.displayName === 'Tabelle standard');
    if (!group) area.groups.push(group = { displayName: 'Tabelle standard', items: [] });
    for (const v of views) if (!group.items.includes(v.view.entity.logicalName)) group.items.push(v.view.entity.logicalName);
}
const firstView = views[0]?.view.entity.logicalName;
if ((!config.demoPath || !config.demoPath.length) && firstView) config.demoPath = [firstView];
writeFileSync(indexFile, dump(config));

// --- synthetic demo data ------------------------------------------------------------------------------------
const COMPANIES = ['Alfa Logistica', 'Borealis Energia', 'Cobalto Servizi', 'Delta Meccanica', 'Eridano Foods', 'Fenice Tessile', 'Gamma Software', 'Iride Costruzioni', 'Lambda Farma', 'Orione Trasporti', 'Polaris Retail', 'Vega Assicurazioni'];
const FIRST = ['Giulia', 'Marco', 'Sara', 'Luca', 'Elena', 'Paolo', 'Chiara', 'Davide', 'Marta', 'Andrea', 'Irene', 'Stefano'];
const LAST = ['Rossi', 'Bianchi', 'Esposito', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'Costa', 'Fontana'];
const CITIES = ['Milano', 'Torino', 'Bologna', 'Firenze', 'Roma', 'Napoli', 'Bari', 'Verona', 'Padova', 'Genova'];
const code = (table) => table.replace(/^msdyn_/, '').slice(0, 3).toUpperCase();
const keyOf = (table, i) => `${code(table)}-${String(i + 1).padStart(4, '0')}`;
const seeded = new Set(views.filter((v) => v.view.entity.dataset).map((v) => v.table));
const datasets = [];
const relationships = [];
const dataIndexFile = join(root, 'config', 'data', 'index.yaml');
const dataIndex = existsSync(dataIndexFile) ? yaml.load(readFileSync(dataIndexFile, 'utf8')) ?? {} : {};
dataIndex.version ??= 1;
dataIndex.datasets ??= [];
const datasetByTable = Object.fromEntries(views.map((v) => [v.table, v.view.entity.dataset]));

function value(field, table, i, t) {
    const dv = field.dataverse ?? {};
    const col = dv.column ?? field.logicalName;
    const person = { first: FIRST[i % FIRST.length], last: LAST[(i * 5) % LAST.length] };
    const opts = Array.isArray(dv.choice) ? dv.choice : dv.choice?.options ?? dv.options;
    if (opts?.length) return opts[i % opts.length].value;
    if (['lookup', 'customer'].includes(dv.type) || field.control === 'lookup') {
        const target = (dv.targets ?? []).find((x) => seeded.has(x) && x !== table);
        if (!target) return undefined;
        relationships.push({ dataset: datasetByTable[table], field: col, references: datasetByTable[target] });
        return keyOf(target, (i * 5) % seedCount);
    }
    if (col === t.primaryNameAttribute || /^(name|title|subject|fullname)$/.test(col)) {
        if (table === 'account' || table === 'competitor') return `${COMPANIES[i % COMPANIES.length]} S.r.l.`;
        if (['contact', 'lead'].includes(table) || col === 'fullname') return `${person.first} ${person.last}`;
        return `${t.displayName ?? table} ${String(i + 1).padStart(3, '0')}`;
    }
    if (col === 'firstname') return person.first;
    if (col === 'lastname') return person.last;
    if (/email/.test(col)) return `${person.first}.${person.last}@example.com`.toLowerCase();
    if (/telephone|phone/.test(col)) return `+39 02 0000 ${String(1000 + i * 7)}`;
    if (/city/.test(col)) return CITIES[i % CITIES.length];
    if (/website|url/.test(col)) return `https://www.example.com/${table}/${i + 1}`;
    const type = dv.type ?? field.control;
    if (['datetime'].includes(type)) return `2026-0${1 + (i % 9)}-${String(3 + i * 2).padStart(2, '0')}`;
    if (['money', 'decimal', 'float'].includes(type)) return 1000 * (i + 1) + 250 * (i % 3);
    if (['whole', 'integer'].includes(type)) return (i + 1) * 3;
    if (type === 'boolean') return i % 2 === 0;
    if (type === 'memo') return `Nota sintetica ${i + 1} per ${t.displayName ?? table}.`;
    return `${field.displayName} ${i + 1}`;
}

if (seedCount > 0) {
    for (const { table, view, form } of views) {
        const ds = view.entity.dataset;
        if (!ds || dataIndex.datasets.some((d) => d.logicalName === ds)) continue;
        const t = view.entity.dataverse?.table ?? {};
        const keyField = t.primaryIdAttribute ?? `${table}id`;
        const fields = (form?.sections ?? []).flatMap((s) => s.fields ?? []);
        const primary = t.primaryNameAttribute ?? 'name';
        if (!fields.some((f) => (f.dataverse?.column ?? f.logicalName) === primary)) fields.unshift({ logicalName: primary, displayName: t.displayName ?? table, dataverse: { column: primary } });
        const records = Array.from({ length: seedCount }, (_, i) => {
            const r = { [keyField]: keyOf(table, i) };
            for (const f of fields) {
                const v = value(f, table, i, t);
                if (v !== undefined) r[f.dataverse?.column ?? f.logicalName] = v;
            }
            return r;
        });
        const file = `${ds}.yaml`;
        writeFileSync(join(root, 'config', 'data', file), `# Dati sintetici generati da poc-add-standard.mjs (tabella standard ${table}).\n${dump({ version: 1, logicalName: ds, displayName: t.displayCollectionName ?? t.displayName ?? table, keyField, primaryField: primary, records })}`);
        dataIndex.datasets.push({ logicalName: ds, file });
        datasets.push(ds);
    }
    writeFileSync(dataIndexFile, dump(dataIndex));
    if (relationships.length) {
        const schemaFile = join(root, 'config', 'data', '_schema.yaml');
        const schema = existsSync(schemaFile) ? yaml.load(readFileSync(schemaFile, 'utf8')) ?? {} : {};
        schema.version ??= 1;
        schema.relationships ??= [];
        for (const r of relationships) {
            if (!schema.relationships.some((x) => x.dataset === r.dataset && x.field === r.field)) schema.relationships.push(r);
        }
        writeFileSync(schemaFile, dump(schema));
    }
}

const result = { ok: true, root, hub: hub ?? null, entities: added, datasets, skipped };
if (json) console.log(JSON.stringify(result));
else {
    console.log(`Aggiunte ${added.length} entita e ${datasets.length} dataset sintetici a ${root}`);
    skipped.forEach((s) => console.log(`  saltato: ${s}`));
    console.log('Eseguire npm run check nella cartella della POC.');
}
