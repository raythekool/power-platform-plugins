// Demo data rules shared by validate-poc-data (warnings) and the shared simulation (blocking on writes).
// No dependencies: works on plain records, never reads YAML.

// Emails must use reserved/demo domains; IBAN and Italian tax codes never belong in a POC.
const DEMO_DOMAINS = /@([a-z0-9-]+\.)*(example\.(com|org|net)|[a-z0-9-]+\.(test|example|invalid|local)|contoso\.com|fabrikam\.com|adventure-works\.com|northwind(traders)?\.com|demo\.[a-z]+)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/;
const CODICE_FISCALE = /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/i;

// Returns the kinds of real-looking data found in one value: 'email', 'iban', 'codice-fiscale'.
export function realDataKinds(field, value) {
    if (typeof value !== 'string') return [];
    const kinds = [];
    if (EMAIL.test(value) && !DEMO_DOMAINS.test(value)) kinds.push('email');
    if (IBAN.test(value) && /iban/i.test(field)) kinds.push('iban');
    if (CODICE_FISCALE.test(value)) kinds.push('codice-fiscale');
    return kinds;
}

export const REAL_DATA_MESSAGES = {
    email: (value) => `email "${value}" non su dominio demo (example.com, contoso.com, *.test)`,
    iban: () => 'sembra un IBAN reale',
    'codice-fiscale': () => 'sembra un codice fiscale reale',
};

// Relationships: _schema.yaml `relationships` plus per-dataset `relations`, both as { field, references }.
// `datasets` is a Map logicalName -> { file, doc }.
export function collectRelationships(dataSchema, datasets) {
    return [
        ...(dataSchema?.relationships ?? []).map((r) => ({ ...r, where: 'config/data/_schema.yaml' })),
        ...[...datasets.entries()].flatMap(([ln, d]) => (d.doc.relations ?? []).map((r) => ({ dataset: ln, ...r, where: d.file }))),
    ];
}

// Lookup values of one record as a flat list (a field can hold one key or a list of keys).
export const lookupValues = (value) => (Array.isArray(value) ? value : [value]).filter((v) => v !== undefined && v !== null && v !== '');
