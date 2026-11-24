// Validates the demo datasets: manifest, keys, referential integrity, synthetic-data heuristics.
// Usage: node scripts/validate-poc-data.mjs [--json]
import { collectRelationships, lookupValues, realDataKinds, REAL_DATA_MESSAGES } from './lib/poc-data-rules.mjs';
import { loadModel, report } from './lib/poc-model.mjs';

const model = loadModel();
const errors = model.errors.filter((e) => e.includes('config/data'));
const warnings = [];
const prefix = model.config.naming?.prefix ?? '';
const legacy = model.config.mode === 'legacy-html';
const namePattern = new RegExp(`^${prefix}[a-z0-9_]+$`);

const datasets = new Map();
for (const { ref, file, doc } of model.datasets) {
    const ln = doc.logicalName ?? ref.logicalName;
    if (!ln) { errors.push(`${file}: logicalName mancante`); continue; }
    if (!namePattern.test(ln)) errors.push(`${file}: logicalName "${ln}" non conforme al prefisso ${prefix}`);
    if (ref.logicalName && doc.logicalName && ref.logicalName !== doc.logicalName) errors.push(`${file}: logicalName diverso da config/data/index.yaml (${ref.logicalName})`);
    if (datasets.has(ln)) errors.push(`${file}: dataset "${ln}" duplicato`);
    if (!doc.displayName) warnings.push(`${file}: displayName mancante`);
    if (legacy && !(doc.sourceVariable ?? ref.sourceVariable)) errors.push(`${file}: sourceVariable obbligatorio in modalita legacy-html`);
    const records = Array.isArray(doc.records) ? doc.records : [];
    if (!Array.isArray(doc.records)) errors.push(`${file}: records mancante o non e una lista`);
    const keyField = doc.keyField;
    if (!keyField) errors.push(`${file}: keyField mancante`);
    const keys = new Set();
    records.forEach((r, i) => {
        if (!r || typeof r !== 'object') { errors.push(`${file}: record ${i} non valido`); return; }
        const k = r[keyField];
        if (keyField && (k === undefined || k === null || k === '')) errors.push(`${file}: record ${i} senza ${keyField}`);
        else if (keys.has(String(k))) errors.push(`${file}: chiave duplicata ${k}`);
        else keys.add(String(k));
        for (const [field, value] of Object.entries(r)) {
            for (const kind of realDataKinds(field, value)) warnings.push(`${file}: ${k}.${field} ${REAL_DATA_MESSAGES[kind](value)}`);
        }
    });
    if (records.length && records.length < 3) warnings.push(`${file}: solo ${records.length} record, per una demo ne servono 5-15`);
    datasets.set(ln, { file, keys, records, doc });
}

const relationships = collectRelationships(model.dataSchema, datasets);
for (const rel of relationships) {
    const from = datasets.get(rel.dataset);
    const to = datasets.get(rel.references);
    if (!from) { errors.push(`${rel.where}: relazione su dataset inesistente "${rel.dataset}"`); continue; }
    if (!to) { errors.push(`${rel.where}: relazione ${rel.dataset}.${rel.field} verso dataset inesistente "${rel.references}"`); continue; }
    for (const r of from.records) {
        for (const v of lookupValues(r[rel.field])) {
            if (!to.keys.has(String(v))) errors.push(`${from.file}: ${r[from.doc.keyField]}.${rel.field} = "${v}" non esiste in ${rel.references}`);
        }
    }
}

// Datasets referenced by the UI layers.
const used = new Set();
for (const { doc } of model.entities) if (doc.entity?.dataset) used.add(doc.entity.dataset);
for (const { doc } of model.components) if (doc.bindings?.dataset) used.add(doc.bindings.dataset);
for (const { doc } of model.entities) for (const s of doc.sections ?? []) for (const u of s.uses ?? []) if (u.args?.dataset) used.add(u.args.dataset);
for (const [ln, d] of datasets) if (!used.has(ln) && !relationships.some((r) => r.references === ln)) warnings.push(`${d.file}: dataset non usato da viste, componenti o relazioni`);

report('validate:data', errors, warnings, { datasets: datasets.size, records: [...datasets.values()].reduce((n, d) => n + d.records.length, 0) });
