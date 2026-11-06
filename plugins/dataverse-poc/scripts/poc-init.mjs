#!/usr/bin/env node
// Deterministic scaffold of a new POC: folders, pipeline scripts, renderer, sample YAML, package.json,
// optional plan document and Sales Hub / Customer Service Hub baseline. Replaces the hand-written scaffold.
//
// node poc-init.mjs --root <dir> --app-type model-driven|code-app --prefix ava_ --name "Order Service"
//   [--hub sales-hub|customer-service-hub] [--plan <file.md> | --initiative X --client Y]
//   [--lcid 1040] [--no-sample] [--no-install] [--no-check] [--force] [--json]
// node poc-init.mjs --root <dir> --update   aggiorna solo scripts/, app/poc-app.*, app/mda-shell.* e gli script npm
//   di una POC esistente (config/ non viene toccata).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, '../skills/prototype-dataverse-app/assets');
const isWin = process.platform === 'win32';

const PIPELINE_SCRIPTS = {
    'validate:config': 'node scripts/validate-poc-config.mjs',
    'validate:data': 'node scripts/validate-poc-data.mjs',
    'prepare:runtime': 'node scripts/prepare-runtime-poc.mjs',
    'build:static': 'node scripts/build-static-poc.mjs',
    build: 'npm run validate:config && npm run validate:data && npm run prepare:runtime && npm run build:static',
    check: 'node scripts/check-poc.mjs',
    'test:smoke': 'node scripts/smoke-test.mjs',
    serve: 'node scripts/serve.mjs',
};
const PIPELINE_DEPS = { 'js-yaml': '^4.1.0', 'playwright-core': '^1.48.0' };

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
const fail = (msg) => { if (json) console.log(JSON.stringify({ ok: false, error: msg })); else console.error(`ERRORE  ${msg}`); process.exit(2); };

const update = args.flags.has('update');
if (update) {
    if (!args.root) fail('--root obbligatorio');
    const root = resolve(args.root);
    const indexFile = join(root, 'config', 'index.yaml');
    if (!existsSync(indexFile)) fail(`${indexFile} mancante: --update vale solo per POC esistenti`);
    const type = (readFileSync(indexFile, 'utf8').match(/^appType:\s*([\w-]+)/m) || [])[1];
    cpSync(join(assets, 'poc-template'), root, { recursive: true });
    cpSync(join(assets, 'smoke-test.mjs'), join(root, 'scripts', 'smoke-test.mjs'));
    if (type === 'model-driven') for (const f of ['mda-shell.css', 'mda-shell.js']) cpSync(join(assets, f), join(root, 'app', f));
    const pkgFile = join(root, 'package.json');
    const pkg = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, 'utf8')) : { name: 'poc', private: true };
    pkg.type = 'module';
    pkg.scripts = { ...pkg.scripts, ...PIPELINE_SCRIPTS };
    pkg.devDependencies = { ...pkg.devDependencies, ...PIPELINE_DEPS };
    writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
    const r = args.flags.has('no-install') ? { status: 0 } : spawnSync(isWin ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: root, encoding: 'utf8', shell: isWin });
    const out = { ok: r.status === 0, root, appType: type, updated: ['scripts/*', 'app/poc-app.*', type === 'model-driven' ? 'app/mda-shell.*' : null, 'package.json'].filter(Boolean) };
    console.log(json ? JSON.stringify(out) : `Pipeline aggiornata in ${root}: eseguire npm run check`);
    process.exit(out.ok ? 0 : 1);
}

const appType = args['app-type'];
const prefix = args.prefix;
const name = args.name;
if (!args.root) fail('--root obbligatorio (cartella della POC)');
if (!['model-driven', 'code-app'].includes(appType)) fail('--app-type obbligatorio: model-driven o code-app (va chiesto all\'utente, mai dedotto)');
if (!prefix || !/^[a-z][a-z0-9]{1,7}_$/.test(prefix)) fail('--prefix obbligatorio: 2-8 caratteri minuscoli seguiti da underscore (es. ava_)');
if (!name) fail('--name obbligatorio (nome visibile dell\'applicazione)');
if (args.hub && appType !== 'model-driven') fail('--hub e ammesso solo con --app-type model-driven');
if (args.hub && !['sales-hub', 'customer-service-hub'].includes(args.hub)) fail('--hub: sales-hub o customer-service-hub');

const root = resolve(args.root);
if (existsSync(root) && readdirSync(root).length && !args.flags.has('force')) fail(`${root} non e vuota: usare --force per scrivere comunque (i file esistenti vengono sovrascritti)`);

const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'app';
const appName = `${prefix}${slug}`;
const p = prefix;
const sample = !args.flags.has('no-sample');
const md = appType === 'model-driven';
const written = [];
const write = (rel, content) => {
    const file = join(root, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    written.push(rel);
};
const q = (s) => JSON.stringify(String(s));

// --- pipeline, renderer, smoke test ------------------------------------------------------
for (const d of ['config/entities', 'config/components', 'config/data']) mkdirSync(join(root, d), { recursive: true });
cpSync(join(assets, 'poc-template'), root, { recursive: true });
cpSync(join(assets, 'smoke-test.mjs'), join(root, 'scripts', 'smoke-test.mjs'));
if (md) for (const f of ['mda-shell.css', 'mda-shell.js']) cpSync(join(assets, f), join(root, 'app', f));
written.push('scripts/*', 'app/*');

write('package.json', `${JSON.stringify({
    name: `${slug.replace(/_/g, '-')}-poc`,
    private: true,
    type: 'module',
    scripts: PIPELINE_SCRIPTS,
    devDependencies: PIPELINE_DEPS,
}, null, 2)}\n`);
write('.gitignore', 'node_modules/\nrealization/solutions/*.zip\nrealization/test-reports/*.png\n');

// --- config ------------------------------------------------------------------------------------
const requirements = sample ? `requirements:
  - id: RF-001
    title: Elenco delle richieste aperte
    scope: in-scope
    source: Esempio dello scaffold
  - id: RF-002
    title: Dettaglio di una richiesta
    scope: in-scope
    source: Esempio dello scaffold
  - id: RF-003
    title: ${md ? 'Riepilogo assistito della richiesta' : 'Indicatori per stato'}
    scope: in-scope
    source: Esempio dello scaffold
` : 'requirements: []\n';
write('config/requirements.yaml', `version: 1\n# Manifest canonico dei requisiti in scope: sostituire gli esempi con quelli della POC.\n${requirements}`);

const listName = md ? `${p}richiesta_view` : `${p}richieste_elenco`;
const formName = md ? `${p}richiesta_form` : `${p}richiesta_dettaglio`;
const entitiesIndex = sample ? `entities:
  - logicalName: ${listName}
    displayName: Richieste${md ? '\n    pageType: view' : ''}
    file: entities/${listName}.yaml
  - logicalName: ${formName}
    displayName: Richiesta${md ? '\n    pageType: form' : ''}
    file: entities/${formName}.yaml
` : 'entities: []\n';
const navigation = md ? `navigation:
  showHome: true
  showRecent: true
  showPinned: true
  areas:
    - logicalName: ${p}area_principale
      displayName: ${q(name)}
      groups:
        - displayName: Lavoro
          items: [${sample ? listName : ''}]
${sample ? `demoPath:\n  - ${listName}\n  - ${formName}\n` : ''}` : (sample ? `demoPath:\n  - ${listName}\n` : '');
write('config/index.yaml', `version: 1
appType: ${appType}            # deciso con l'utente: model-driven | code-app
mode: requirements
naming:
  prefix: ${p}
  case: snake_lower
application:
  logicalName: ${appName}
  displayName: ${q(name)}
showPrototypeBanner: true
${entitiesIndex}${navigation}`);

// --- sample entities, data, components -----------------------------------------------------------
if (sample) {
    const table = `  dataverse:
    table:
      source: custom
      logicalName: ${p}richiesta
      schemaName: ${p}Richiesta
      displayName: Richiesta
      displayCollectionName: Richieste
      primaryIdAttribute: ${p}richiestaid
      primaryNameAttribute: ${p}titolo
      ownershipType: UserOwned
      sourceUrl: null
      reuseDecision:
        outcome: create-custom
        checkedStandardTables: [incident, task]
        reason: Esempio dello scaffold, da sostituire con le entita reali della POC dopo la verifica su Microsoft Learn.`;
    const choice = (col, label, opts) => `        dataverse:
          table: ${p}richiesta
          column: ${p}${col}
          source: custom
          schemaName: ${p}${col}
          type: choice
          requiredLevel: ApplicationRequired
          choice:
            scope: local
            options:
${opts.map(([v, l]) => `              - { value: ${v}, label: ${l} }`).join('\n')}`;
    write(`config/entities/${listName}.yaml`, `version: 1
entity:
  logicalName: ${listName}
  displayName: Richieste
  requirements: [RF-001]
${table}
  dataset: ${p}richieste
  targetForm: ${formName}
  primaryColumn: ${p}titolo
  columns: [${p}titolo, ${p}stato, ${p}priorita, ${p}data_apertura, ${p}importo]
sections:
  - logicalName: ${p}richieste_sintesi
    displayName: Sintesi
    components: [${p}richieste_per_stato]
`);
    write(`config/entities/${formName}.yaml`, `version: 1
entity:
  logicalName: ${formName}
  displayName: Richiesta
  requirements: [RF-002]
${table}
  dataset: ${p}richieste
tabs:
  - logicalName: ${p}richiesta_generale
    displayName: Generale
  - logicalName: ${p}richiesta_dettagli
    displayName: Dettagli
sections:
  - logicalName: ${p}richiesta_dati
    displayName: Dati principali
    tab: ${p}richiesta_generale
    layout: repeat(2, minmax(0, 1fr))
    fields:
      - logicalName: ${p}richiesta_titolo
        displayName: Titolo
        control: text
        required: true
        dataverse:
          table: ${p}richiesta
          column: ${p}titolo
          source: custom
          schemaName: ${p}Titolo
          type: string
          format: Text
          maxLength: 200
          requiredLevel: ApplicationRequired
      - logicalName: ${p}richiesta_stato
        displayName: Stato
        control: choice
${choice('stato', 'Stato', [[10, 'Nuova'], [20, 'In lavorazione'], [30, 'Chiusa']])}
      - logicalName: ${p}richiesta_priorita
        displayName: Priorita
        control: choice
${choice('priorita', 'Priorita', [[1, 'Bassa'], [2, 'Media'], [3, 'Alta']])}
      - logicalName: ${p}richiesta_data_apertura
        displayName: Data apertura
        control: datetime
        dataverse:
          table: ${p}richiesta
          column: ${p}data_apertura
          source: custom
          schemaName: ${p}DataApertura
          type: datetime
          format: DateOnly
          behavior: DateOnly
          requiredLevel: None
      - logicalName: ${p}richiesta_importo
        displayName: Importo stimato
        control: money
        dataverse:
          table: ${p}richiesta
          column: ${p}importo
          source: custom
          schemaName: ${p}Importo
          type: money
          precision: 2
          minValue: 0
          maxValue: 1000000
          requiredLevel: None
  - logicalName: ${p}richiesta_note
    displayName: Descrizione
    tab: ${p}richiesta_dettagli
    layout: 1fr
    fields:
      - logicalName: ${p}richiesta_descrizione
        displayName: Descrizione
        control: memo
        dataverse:
          table: ${p}richiesta
          column: ${p}descrizione
          source: custom
          schemaName: ${p}Descrizione
          type: memo
          maxLength: 4000
          requiredLevel: None
${md ? `  - logicalName: ${p}richiesta_assistente
    displayName: Riepilogo assistito
    tab: ${p}richiesta_generale
    components: [${p}richiesta_riepilogo_ai]
` : ''}`);
    write('config/components/' + `${p}richieste_per_stato.yaml`, `version: 1
logicalName: ${p}richieste_per_stato
displayName: Richieste per stato
type: kpi
requirements: [${md ? 'RF-001' : 'RF-003'}]
bindings:
  dataset: ${p}richieste
  groupBy: ${p}stato
fallback: html
`);
    if (md) write('config/components/' + `${p}richiesta_riepilogo_ai.yaml`, `version: 1
logicalName: ${p}richiesta_riepilogo_ai
displayName: Riepilogo della richiesta
type: generative-page
requirements: [RF-003]
simulation:
  fidelity: wireframe
  hostApp: ${q(name)}
  note: Simulazione a scopo dimostrativo, il testo non e generato da un modello reale
bindings:
  text: La richiesta e in lavorazione da 3 giorni; il cliente ha gia ricevuto una prima risposta. Prossimo passo suggerito, confermare la stima.
fallback: html
`);
    write('config/data/index.yaml', `version: 1\ndatasets:\n  - logicalName: ${p}richieste\n    file: ${p}richieste.yaml\n`);
    write('config/data/_schema.yaml', `version: 1\n# Relazioni del modello demo: { dataset, field, references } (references = dataset di destinazione, per keyField)\nrelationships: []\n`);
    const rows = [
        ['RIC-0001', 'Verifica fattura di marzo', 20, 2, '2026-09-02', 1200, 'Il cliente chiede il dettaglio delle voci.'],
        ['RIC-0002', 'Attivazione nuovo servizio', 10, 3, '2026-09-05', 5400, 'Richiesta di attivazione entro fine mese.'],
        ['RIC-0003', 'Cambio indirizzo di fatturazione', 30, 1, '2026-08-21', 0, 'Aggiornamento anagrafico completato.'],
        ['RIC-0004', 'Reclamo su ritardo consegna', 20, 3, '2026-09-08', 350, 'Consegna prevista slittata di una settimana.'],
        ['RIC-0005', 'Preventivo manutenzione annuale', 10, 2, '2026-09-10', 8900, 'Da preparare il preventivo con due opzioni.'],
    ];
    write(`config/data/${p}richieste.yaml`, `version: 1
logicalName: ${p}richieste
displayName: Richieste
keyField: ${p}richiesta_id
primaryField: ${p}titolo
records:
${rows.map(([id, t, s, pr, d, imp, desc]) => `  - ${p}richiesta_id: ${id}
    ${p}titolo: ${q(t)}
    ${p}stato: ${s}
    ${p}priorita: ${pr}
    ${p}data_apertura: "${d}"
    ${p}importo: ${imp}
    ${p}descrizione: ${q(desc)}`).join('\n')}
`);
} else {
    write('config/data/index.yaml', 'version: 1\ndatasets: []\n');
    write('config/data/_schema.yaml', 'version: 1\nrelationships: []\n');
}

write('README.md', `# ${name} — prototipo POC

Prototipo HTML/YAML (\`appType: ${appType}\`, prefisso \`${p}\`) generato con lo scaffold del plugin dataverse-poc.

## Comandi

\`\`\`powershell
npm install
npm run check          # validator + runtime + statico + copertura + smoke test
npm run build          # solo validator e generazione
npm run serve          # runtime su http://127.0.0.1:8080/poc-runtime.html
\`\`\`

L'HTML autosufficiente da consegnare e in \`dist/${appName}.html\`; la copertura dei requisiti in \`dist/requirements-coverage.md\`.

## Dove si modifica

| Cosa | Dove |
| --- | --- |
| Schermate, campi, contratto Dataverse | \`config/entities/\` |
| Dati demo sintetici | \`config/data/\` |
| KPI, BPF, timeline, subgrid${md ? ', componenti simulati' : ''} | \`config/components/\` |
| Requisiti | \`config/requirements.yaml\` |
| Stili o renderer specifici | \`app/custom.css\`, \`app/custom.js\` (\`PocApp.registerComponent\`) |

Non modificare a mano \`poc-runtime.html\`, \`config/poc-config.js\`, \`config/data/poc-data.js\`, \`dist/\`, \`scripts/\` e \`app/poc-app.*\`${md ? ', `app/mda-shell.*`' : ''}: si rigenerano o arrivano dal plugin.
`);

// --- plan document --------------------------------------------------------------------------------
let planPath = args.plan;
if (!planPath && args.initiative && args.client) planPath = join(dirname(root), `Piano_${args.initiative}_${args.client}.md`.replace(/\s+/g, ''));
if (planPath) {
    planPath = resolve(planPath);
    if (existsSync(planPath) && !args.flags.has('force')) fail(`il piano ${planPath} esiste gia`);
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, `# Piano POC — ${name}

> POC ${appType} con prefisso \`${p}\`. Prototipo in \`${relative(dirname(planPath), root).replaceAll('\\', '/') || '.'}\`. Stato aggiornato solo dall'orchestratore.

## 📑 Indice

- [🎯 Target ambiente](#-target-ambiente)
- [🧭 Decisioni](#-decisioni)
- [🖥️ Schermate](#️-schermate)
- [📋 Todo](#-todo)
- [🔁 Recap](#-recap)

## 🎯 Target ambiente

| Chiave | Valore |
| --- | --- |
| URL ambiente | da confermare |
| Profilo PAC | da confermare |
| Profilo PACX | da confermare |
| Solution (unique name) | da confermare |
| Publisher prefix | ${p.replace(/_$/, '')} |
| App module (unique name) | da confermare |
| LCID etichette | ${args.lcid ?? '1040'} |
| Conferma utente stage R | no |

## 🧭 Decisioni

| Decisione | Valore | Fonte |
| --- | --- | --- |
| appType | ${appType} | utente |
| Prefisso | ${p} | utente |
| Modalita | requirements | scaffold |
${args.hub ? `| Baseline | ${args.hub} | utente |\n` : ''}
## 🖥️ Schermate

| Schermata | Tipo | Dataset | Requisiti |
| --- | --- | --- | --- |

## 📋 Todo

- [ ] Stage P: sostituire gli esempi dello scaffold con le schermate della POC (poc-datamodel → poc-prototype-builder)
- [ ] Stage P: \`npm run check\` verde e copertura senza requisiti scoperti (poc-tester)

## 🔁 Recap

- Scaffold creato con poc-init.
`);
    written.push(relative(process.cwd(), planPath));
}

// --- install, baseline, check ------------------------------------------------------------------------
const steps = [];
const npm = (cmdArgs) => spawnSync(isWin ? 'npm.cmd' : 'npm', cmdArgs, { cwd: root, encoding: 'utf8', shell: isWin });
if (!args.flags.has('no-install')) {
    const r = npm(['install', '--no-audit', '--no-fund', '--loglevel=error']);
    steps.push({ step: 'npm install', ok: r.status === 0, detail: r.status === 0 ? '' : (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ') });
}
if (args.hub) {
    const r = spawnSync(process.execPath, [join(here, 'poc-add-standard.mjs'), '--root', root, '--hub', args.hub, '--json'], { encoding: 'utf8' });
    let detail = '';
    try { const out = JSON.parse(r.stdout.trim().split('\n').pop()); detail = `${out.entities?.length ?? 0} entita, ${out.datasets?.length ?? 0} dataset`; } catch { detail = (r.stderr || r.stdout).trim().slice(0, 300); }
    steps.push({ step: `baseline ${args.hub}`, ok: r.status === 0, detail });
}
if (!args.flags.has('no-check') && !args.flags.has('no-install')) {
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'check-poc.mjs'), '--json'], { cwd: root, encoding: 'utf8' });
    let detail = '';
    try { const out = JSON.parse(r.stdout.trim().split('\n').pop()); detail = out.steps.map((s) => `${s.step}:${s.ok ? 'ok' : 'KO'}`).join(' '); } catch { detail = (r.stderr || r.stdout).trim().slice(0, 300); }
    steps.push({ step: 'npm run check', ok: r.status === 0, detail });
}

const ok = steps.every((s) => s.ok);
if (json) {
    console.log(JSON.stringify({ ok, root, appType, prefix: p, application: appName, plan: planPath ?? null, written, steps }));
} else {
    console.log(`POC creata in ${root} (${appType}, prefisso ${p}, app ${appName})`);
    if (planPath) console.log(`Piano: ${planPath}`);
    for (const s of steps) console.log(`${s.ok ? 'OK ' : 'KO '} ${s.step}${s.detail ? `  ${s.detail}` : ''}`);
    console.log(ok ? `\nProssimi passi: cd "${root}" && npm run serve, poi sostituire gli esempi in config/.` : '\nCorreggere gli errori sopra e rieseguire npm run check nella cartella della POC.');
}
process.exit(ok ? 0 : 1);
