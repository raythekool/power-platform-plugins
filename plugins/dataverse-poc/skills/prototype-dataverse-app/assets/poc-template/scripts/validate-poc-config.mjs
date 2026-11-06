// Validates the UI layers (config/index.yaml, entities, components) against the rules of yaml-schema.md,
// tipi-di-app.md and dynamics-365-chrome.md. Usage: node scripts/validate-poc-config.mjs [--json]
import { loadModel, report } from './lib/poc-model.mjs';

const APP_TYPES = ['model-driven', 'code-app'];
const MODES = ['requirements', 'legacy-html'];
const PAGE_TYPES = ['dashboard', 'view', 'form', 'custom-page'];
const CONTROLS = ['text', 'memo', 'choice', 'lookup', 'money', 'decimal', 'whole', 'datetime', 'boolean', 'file'];
const COMPONENT_TYPES = ['kpi', 'bpf', 'timeline', 'subgrid', 'generative-page', 'pcf'];
const SIMULATED = ['generative-page', 'pcf'];
const PARAM_TYPES = ['dataset', 'field', 'field-list', 'text', 'number', 'boolean', 'choice'];
const REQUIRED_LEVELS = ['None', 'ApplicationRequired', 'SystemRequired', 'Recommended'];

const model = loadModel();
const errors = [...model.errors];
const warnings = [];
const { config } = model;

const appType = config.appType;
const md = appType === 'model-driven';
const legacy = config.mode === 'legacy-html';
if (!APP_TYPES.includes(appType)) errors.push(`config/index.yaml: appType mancante o non valido (${appType ?? 'assente'}): ammessi ${APP_TYPES.join(', ')}`);
if (!MODES.includes(config.mode)) errors.push(`config/index.yaml: mode mancante o non valido (${config.mode ?? 'assente'})`);
const prefix = config.naming?.prefix;
if (!prefix || !/^[a-z][a-z0-9]*_$/.test(prefix)) errors.push(`config/index.yaml: naming.prefix mancante o non valido (atteso es. ava_)`);
const namePattern = new RegExp(`^${prefix ?? ''}[a-z0-9_]+$`);

// --- logicalName / displayName ------------------------------------------------
const owners = new Map();
function name(where, obj, { unique = true, scope = '' } = {}) {
    const ln = obj?.logicalName;
    if (!ln) { errors.push(`${where}: logicalName mancante`); return; }
    if (!namePattern.test(ln)) errors.push(`${where}: logicalName "${ln}" non conforme al prefisso ${prefix}`);
    if (unique) {
        const key = scope + ln;
        if (owners.has(key) && owners.get(key) !== where) errors.push(`${where}: logicalName "${ln}" duplicato (gia in ${owners.get(key)})`);
        else owners.set(key, where);
    }
}
function display(where, obj) {
    const dn = obj?.displayName;
    if (!dn || !String(dn).trim()) errors.push(`${where}: displayName mancante`);
    else if (!/[\p{L}\p{N}]/u.test(String(dn))) errors.push(`${where}: displayName "${dn}" composto solo da simboli`);
    else if (dn === obj.logicalName) errors.push(`${where}: displayName uguale al logicalName`);
}

if (config.application) { name('application', config.application, { unique: false }); display('application', config.application); }
else errors.push('config/index.yaml: blocco application mancante');

// --- requirements manifest -------------------------------------------------------
const reqIds = new Set();
if (model.requirements === null) errors.push('config/requirements.yaml mancante: e il manifest canonico dei requisiti');
for (const r of model.requirements ?? []) {
    if (!r.id) { errors.push('config/requirements.yaml: requisito senza id'); continue; }
    if (reqIds.has(String(r.id))) errors.push(`config/requirements.yaml: id duplicato ${r.id}`);
    reqIds.add(String(r.id));
    if (r.scope && !['in-scope', 'out-of-scope', 'non-rappresentabile'].includes(r.scope)) errors.push(`config/requirements.yaml: ${r.id} scope non valido (${r.scope})`);
}
const checkReqs = (where, list) => {
    for (const id of list ?? []) if (model.requirements && !reqIds.has(String(id))) errors.push(`${where}: requisito ${id} assente da config/requirements.yaml`);
};

// --- datasets known to the config (full data checks are in validate-poc-data) --------------
const datasetNames = new Set(model.datasets.map((d) => d.doc.logicalName ?? d.ref.logicalName));
const checkDataset = (where, ds) => { if (ds && !datasetNames.has(ds)) warnings.push(`${where}: dataset "${ds}" senza dati demo in config/data/ (la vista resta vuota)`); };

// --- dataverse contracts ---------------------------------------------------------------------
function checkTable(where, t) {
    if (!t.source || !['standard', 'custom'].includes(t.source)) errors.push(`${where}: source deve essere standard o custom`);
    if (!t.logicalName) errors.push(`${where}: logicalName della tabella mancante`);
    if (t.source === 'custom') {
        if (!t.reuseDecision?.reason) errors.push(`${where}: tabella custom senza reuseDecision.reason`);
        if (!t.reuseDecision?.checkedStandardTables?.length) errors.push(`${where}: tabella custom senza reuseDecision.checkedStandardTables (verifica Microsoft Learn)`);
    }
    if (t.source === 'standard' && !t.sourceUrl) warnings.push(`${where}: tabella standard senza sourceUrl Microsoft Learn`);
}
function checkColumn(where, field) {
    const dv = field.dataverse;
    if (!dv) return;
    for (const k of ['type', 'source', 'requiredLevel']) if (!dv[k]) errors.push(`${where}: dataverse.${k} mancante`);
    if (dv.requiredLevel && !REQUIRED_LEVELS.includes(dv.requiredLevel)) errors.push(`${where}: requiredLevel non valido (${dv.requiredLevel})`);
    const strict = dv.source === 'custom';
    const flag = (msg) => (strict ? errors : warnings).push(`${where}: ${msg}`);
    const type = dv.type ?? field.control;
    if (['choice', 'multiselect'].includes(type) || field.control === 'choice') {
        const options = Array.isArray(dv.choice) ? dv.choice : dv.choice?.options ?? dv.options;
        if (!options?.length) flag('choice senza opzioni {value, label}');
        else if (options.some((o) => o?.value === undefined || !o?.label)) errors.push(`${where}: opzioni choice incomplete (servono value e label)`);
    }
    if (['lookup', 'customer'].includes(type) && !dv.targets?.length) flag('lookup senza targets');
    if (type === 'datetime' && (!dv.format || !dv.behavior)) flag('datetime senza format e behavior');
}

// --- components ----------------------------------------------------------------------------------
const definitions = new Map();
for (const { file, doc } of model.definitions) {
    name(file, doc); display(file, doc); checkReqs(file, doc.requirements);
    if (doc.kind !== 'definition') errors.push(`${file}: kind: definition mancante`);
    checkComponentType(file, doc);
    for (const p of doc.params ?? []) {
        if (!p.name || !PARAM_TYPES.includes(p.type)) errors.push(`${file}: parametro ${p.name ?? '?'} con type non valido (${p.type})`);
        if (p.type === 'choice' && !p.options?.length) errors.push(`${file}: parametro choice ${p.name} senza options`);
    }
    definitions.set(doc.logicalName, { file, doc, used: 0 });
}
const locals = new Map();
for (const { file, doc } of model.components) {
    name(file, doc); display(file, doc); checkReqs(file, doc.requirements);
    checkComponentType(file, doc);
    if (legacy && !doc.hostSelector) errors.push(`${file}: hostSelector obbligatorio in modalita legacy-html`);
    if (doc.bindings?.dataset) checkDataset(file, doc.bindings.dataset);
    locals.set(doc.logicalName, { file, doc, hosts: [] });
}
function checkComponentType(file, doc) {
    if (!COMPONENT_TYPES.includes(doc.type)) errors.push(`${file}: type non valido (${doc.type})`);
    if (SIMULATED.includes(doc.type)) {
        if (!md) errors.push(`${file}: type ${doc.type} non ammesso con appType ${appType}`);
        if (!doc.simulation?.fidelity || !doc.simulation?.note) errors.push(`${file}: componente simulato senza simulation.fidelity e simulation.note`);
    }
    if (doc.pcf) {
        if (doc.pcf.logicalName) name(`${file} (pcf)`, doc.pcf);
        if (doc.pcf.enabled === true) warnings.push(`${file}: pcf.enabled true: ammesso solo con un bundle reale importato e verificato`);
    }
}
function checkArgs(where, def, args = {}) {
    const params = new Map((def.params ?? []).map((p) => [p.name, p]));
    for (const [k, v] of Object.entries(args)) {
        const p = params.get(k);
        if (!p) { errors.push(`${where}: argomento "${k}" non dichiarato nei params di ${def.logicalName}`); continue; }
        const ok = { dataset: typeof v === 'string', field: typeof v === 'string', 'field-list': Array.isArray(v), text: typeof v === 'string', number: typeof v === 'number', boolean: typeof v === 'boolean', choice: (p.options ?? []).includes(v) }[p.type];
        if (!ok) errors.push(`${where}: argomento "${k}" incompatibile con il tipo ${p.type}`);
        if (p.type === 'dataset') checkDataset(where, v);
    }
    for (const p of params.values()) if (p.required && args[p.name] === undefined) errors.push(`${where}: parametro obbligatorio "${p.name}" mancante`);
}

// --- entities ------------------------------------------------------------------------------------
const entityByName = new Map();
for (const e of model.entities) {
    const where = e.file;
    const ent = e.doc.entity;
    if (!ent) { errors.push(`${where}: blocco entity mancante`); continue; }
    name(where, ent); display(where, ent); checkReqs(where, ent.requirements);
    if (ent.logicalName !== e.ref.logicalName) errors.push(`${where}: entity.logicalName "${ent.logicalName}" diverso da config/index.yaml (${e.ref.logicalName})`);
    const pageType = e.ref.pageType ?? ent.pageType;
    if (e.ref.pageType && ent.pageType && e.ref.pageType !== ent.pageType) errors.push(`${where}: pageType diverso fra index (${e.ref.pageType}) ed entita (${ent.pageType})`);
    entityByName.set(ent.logicalName, { ...e, pageType });

    if (md && !PAGE_TYPES.includes(pageType)) errors.push(`${where}: pageType mancante o non valido (${pageType ?? 'assente'})`);
    if (!md && pageType) errors.push(`${where}: pageType non ammesso con appType code-app`);
    const isRecordScreen = md ? ['view', 'form'].includes(pageType) : Boolean(ent.dataset);
    if (isRecordScreen && !ent.dataverse?.table && !ent.dataverse?.tables && !ent.informational) errors.push(`${where}: schermata record senza entity.dataverse.table (o informational: true)`);
    if (ent.dataverse?.table) checkTable(`${where} dataverse.table`, ent.dataverse.table);
    for (const [i, t] of (ent.dataverse?.tables ?? []).entries()) checkTable(`${where} dataverse.tables[${i}]`, t);
    if (ent.dataset) checkDataset(where, ent.dataset);
    if (md && pageType === 'view') {
        if (!ent.dataset) errors.push(`${where}: una view deve dichiarare dataset`);
        if (!('targetForm' in ent)) errors.push(`${where}: una view deve dichiarare targetForm`);
        else if (ent.targetForm === null) warnings.push(`${where}: targetForm null (eccezione documentata, es. activitypointer)`);
    }

    const tabNames = new Set();
    for (const tab of e.doc.tabs ?? []) { name(`${where} tab`, tab, { scope: `${ent.logicalName}:` }); display(`${where} tab ${tab.logicalName}`, tab); tabNames.add(tab.logicalName); checkReqs(where, tab.requirements); }
    for (const section of e.doc.sections ?? []) {
        const sw = `${where} sezione ${section.logicalName ?? '?'}`;
        if (section.logicalName || section.displayName) { name(sw, section); display(sw, section); }
        checkReqs(sw, section.requirements);
        if (section.tab && !tabNames.has(section.tab)) errors.push(`${sw}: tab "${section.tab}" inesistente`);
        if (!section.fields?.length && !section.uses?.length && !section.components?.length) errors.push(`${sw}: sezione senza campi e senza componenti`);
        for (const field of section.fields ?? []) {
            const fw = `${where} campo ${field.logicalName ?? '?'}`;
            name(fw, field); display(fw, field); checkReqs(fw, field.requirements);
            if (!CONTROLS.includes(field.control)) errors.push(`${fw}: control non valido (${field.control})`);
            if (legacy && !field.selector) errors.push(`${fw}: selector obbligatorio in modalita legacy-html`);
            if (field.dataverse) checkColumn(fw, field);
            else if (isRecordScreen) warnings.push(`${fw}: campo senza contratto dataverse`);
        }
        for (const use of section.uses ?? []) {
            const uw = `${sw} istanza ${use.instance ?? '?'}`;
            const def = definitions.get(use.component);
            if (!use.instance) errors.push(`${uw}: instance mancante`);
            else name(uw, { logicalName: use.instance });
            if (use.displayName !== undefined) display(uw, { ...use, logicalName: use.instance });
            checkReqs(uw, use.requirements);
            if (legacy && !use.hostSelector) errors.push(`${uw}: hostSelector obbligatorio in modalita legacy-html`);
            if (!def) { errors.push(`${uw}: definizione "${use.component}" inesistente in config/components/_definitions/`); continue; }
            def.used++;
            checkArgs(uw, def.doc, use.args);
        }
        for (const ref of section.components ?? []) {
            const local = locals.get(ref);
            if (!local) errors.push(`${sw}: componente locale "${ref}" inesistente in config/components/`);
            else local.hosts.push(ent.logicalName);
        }
    }
}
for (const def of definitions.values()) if (!def.used) errors.push(`${def.file}: definizione mai usata da nessuna istanza`);
for (const local of locals.values()) {
    if (!local.hosts.length && !legacy) warnings.push(`${local.file}: componente locale non collegato a nessuna sezione (sections[].components)`);
}
// Two local components with the same type and fields on different screens should become a definition.
const signatures = new Map();
for (const local of locals.values()) {
    const fields = local.doc.bindings?.fields;
    if (!fields?.length) continue;
    const sig = `${local.doc.type}|${[...fields].sort().join(',')}`;
    const prev = signatures.get(sig);
    if (prev && prev.hosts.join() !== local.hosts.join()) warnings.push(`${local.file}: stesso type e campi di ${prev.file}: promuovere a definizione riusabile`);
    else signatures.set(sig, local);
}

// --- navigation (model-driven) -------------------------------------------------------------------------
const navItems = [];
function collectNav(where, navigation) {
    for (const area of navigation?.areas ?? []) {
        name(`${where} area`, area, { unique: false }); display(`${where} area ${area.logicalName}`, area);
        for (const group of area.groups ?? []) {
            display(`${where} gruppo`, { ...group, logicalName: undefined });
            for (const item of group.items ?? []) navItems.push({ where, item });
        }
    }
}
if (md) {
    if (!config.navigation?.areas?.length && !config.modelDrivenApps?.some((a) => a.navigation?.areas)) errors.push('config/index.yaml: navigation.areas mancante (appType model-driven)');
    collectNav('navigation', config.navigation);
    for (const app of config.modelDrivenApps ?? []) {
        name(`modelDrivenApps ${app.logicalName}`, app, { unique: false }); display(`modelDrivenApps ${app.logicalName}`, app);
        if (app.navigation && app.navigation !== 'current') collectNav(`modelDrivenApps ${app.logicalName}`, app.navigation);
    }
    const reachable = new Set();
    for (const { where, item } of navItems) {
        const ln = typeof item === 'object' ? item.logicalName : item;
        const ent = entityByName.get(ln);
        if (!ent && typeof item !== 'object') { errors.push(`${where}: voce "${ln}" non corrisponde a nessuna entita`); continue; }
        const pageType = ent?.pageType ?? item.pageType;
        if (pageType === 'form') errors.push(`${where}: la voce "${ln}" e un form: i form non compaiono mai nella site map`);
        if (!ent) { display(`${where} voce ${ln}`, item); if (!PAGE_TYPES.includes(pageType)) errors.push(`${where}: voce "${ln}" con pageType non valido`); }
        reachable.add(ln);
    }
    const formTargets = new Set();
    for (const e of entityByName.values()) if (e.doc.entity.targetForm) formTargets.add(e.doc.entity.targetForm);
    for (const c of [...model.components, ...model.definitions]) if (c.doc.bindings?.targetForm) formTargets.add(c.doc.bindings.targetForm);
    for (const e of model.entities) for (const s of e.doc.sections ?? []) for (const u of s.uses ?? []) if (u.args?.targetForm) formTargets.add(u.args.targetForm);
    for (const [ln, e] of entityByName) {
        if (e.pageType === 'view' && e.doc.entity.targetForm) {
            const target = entityByName.get(e.doc.entity.targetForm);
            if (!target) errors.push(`${e.file}: targetForm "${e.doc.entity.targetForm}" inesistente`);
            else if (target.pageType !== 'form') errors.push(`${e.file}: targetForm "${e.doc.entity.targetForm}" non ha pageType form`);
        }
        if (e.pageType && e.pageType !== 'form' && !reachable.has(ln)) errors.push(`${e.file}: schermata orfana, non raggiungibile dalla site map`);
        if (e.pageType === 'form' && !formTargets.has(ln)) errors.push(`${e.file}: form mai aperto da una view (targetForm) ne da un componente`);
    }
    for (const ln of config.demoPath ?? []) if (!entityByName.has(ln) && !navItems.some(({ item }) => item?.logicalName === ln)) errors.push(`config/index.yaml: demoPath "${ln}" inesistente`);
} else if (appType === 'code-app') {
    if (config.navigation) errors.push('config/index.yaml: blocco navigation non ammesso con appType code-app');
    for (const e of entityByName.values()) {
        const target = e.doc.entity.targetForm;
        if (target && !entityByName.has(target)) errors.push(`${e.file}: targetForm "${target}" inesistente`);
    }
}

report('validate:config', errors, warnings, { entities: entityByName.size, components: locals.size, definitions: definitions.size });
