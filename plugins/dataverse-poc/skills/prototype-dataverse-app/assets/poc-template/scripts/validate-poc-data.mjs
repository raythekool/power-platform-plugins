// Validates the demo datasets: manifest, keys, referential integrity, synthetic-data heuristics.
// Usage: node scripts/validate-poc-data.mjs [--json]
import { loadModel, report } from './lib/poc-model.mjs';

const model = loadModel();
const errors = model.errors.filter((e) => e.includes('config/data'));
const warnings = [];
const prefix = model.config.naming?.prefix ?? '';
const legacy = model.config.mode === 'legacy-html';
const namePattern = new RegExp(`^${prefix}[a-z0-9_]+$`);

// Emails must use reserved/demo domains; IBAN and Italian tax codes never belong in a POC.
const DEMO_DOMAINS = /@([a-z0-9-]+\.)*(example\.(com|org|net)|[a-z0-9-]+\.(test|example|invalid|local)|contoso\.com|fabrikam\.com|adventure-works\.com|northwind(traders)?\.com|demo\.[a-z]+)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/;
const CODICE_FISCALE = /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/i;

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
            if (typeof value !== 'string') continue;
            if (EMAIL.test(value) && !DEMO_DOMAINS.test(value)) warnings.push(`${file}: ${k}.${field} email "${value}" non su dominio demo (example.com, contoso.com, *.test)`);
            if (IBAN.test(value) && /iban/i.test(field)) warnings.push(`${file}: ${k}.${field} sembra un IBAN reale`);
            if (CODICE_FISCALE.test(value)) warnings.push(`${file}: ${k}.${field} sembra un codice fiscale reale`);
        }
    });
    if (records.length && records.length < 3) warnings.push(`${file}: solo ${records.length} record, per una demo ne servono 5-15`);
    datasets.set(ln, { file, keys, records, doc });
}

// Relationships: _schema.yaml `relationships` plus per-dataset `relations`, both as { field, references }.
const relationships = [
    ...(model.dataSchema.relationships ?? []).map((r) => ({ ...r, where: 'config/data/_schema.yaml' })),
    ...[...datasets.entries()].flatMap(([ln, d]) => (d.doc.relations ?? []).map((r) => ({ dataset: ln, ...r, where: d.file }))),
];
for (const rel of relationships) {
    const from = datasets.get(rel.dataset);
    const to = datasets.get(rel.references);
    if (!from) { errors.push(`${rel.where}: relazione su dataset inesistente "${rel.dataset}"`); continue; }
    if (!to) { errors.push(`${rel.where}: relazione ${rel.dataset}.${rel.field} verso dataset inesistente "${rel.references}"`); continue; }
    for (const r of from.records) {
        const values = Array.isArray(r[rel.field]) ? r[rel.field] : [r[rel.field]];
        for (const v of values) {
            if (v === undefined || v === null || v === '') continue;
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
