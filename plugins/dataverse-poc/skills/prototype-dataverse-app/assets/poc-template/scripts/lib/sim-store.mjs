// Shared demo state for the local simulation (contract: references/simulazione-condivisa.md).
// Seed = YAML datasets (never rewritten). Current state = <stateDir>/state.json, written atomically.
// No dependencies: the YAML is loaded by the caller (seedFromModel) so this module stays testable on its own.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectRelationships, lookupValues, realDataKinds, REAL_DATA_MESSAGES } from './poc-data-rules.mjs';

export const STATE_VERSION = 1;
const BACKUPS_KEPT = 5;

export class SimError extends Error {
    constructor(status, code, message, extra = {}) {
        super(message);
        Object.assign(this, { status, code, extra });
    }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

// Builds the seed from loadModel() output: { datasets: { ln: { keyField, records } }, relationships, seedHash }.
export function seedFromModel(model) {
    const byName = new Map();
    for (const { ref, file, doc } of model.datasets ?? []) {
        const ln = doc.logicalName ?? ref.logicalName;
        if (ln && doc.keyField && Array.isArray(doc.records)) byName.set(ln, { file, doc });
    }
    const datasets = Object.fromEntries([...byName].map(([ln, { doc }]) => [ln, { keyField: doc.keyField, records: clone(doc.records) }]));
    const relationships = collectRelationships(model.dataSchema, byName)
        .filter((r) => r.dataset && r.field && r.references)
        .map(({ dataset, field, references }) => ({ dataset, field, references }));
    return makeSeed(datasets, relationships);
}

export function makeSeed(datasets, relationships = []) {
    const seedHash = createHash('sha256').update(JSON.stringify({ datasets, relationships })).digest('hex');
    return { datasets, relationships, seedHash };
}

// Next key following the most common "<prefix><number>" pattern of the dataset (PRE-010 -> PRE-011).
export function nextKey(keys) {
    const groups = new Map();
    for (const key of keys) {
        const m = /^(.*?)(\d+)$/.exec(String(key));
        if (!m) continue;
        const g = groups.get(m[1]) ?? { count: 0, max: -1, width: 0 };
        g.count++;
        g.max = Math.max(g.max, Number(m[2]));
        g.width = Math.max(g.width, m[2].length);
        groups.set(m[1], g);
    }
    if (!groups.size) return null;
    const [prefix, g] = [...groups].sort((a, b) => b[1].count - a[1].count)[0];
    const taken = new Set(keys.map(String));
    let n = g.max + 1;
    while (taken.has(prefix + String(n).padStart(g.width, '0'))) n++;
    return prefix + String(n).padStart(g.width, '0');
}

function seedState(seed, rev) {
    const datasets = {};
    for (const [ln, d] of Object.entries(seed.datasets)) {
        datasets[ln] = { keyField: d.keyField, records: d.records.map((r) => ({ ...clone(r), _rev: 1 })) };
    }
    return { version: STATE_VERSION, seedHash: seed.seedHash, rev, datasets };
}

function isValidState(s) {
    if (!s || typeof s !== 'object' || s.version !== STATE_VERSION || !Number.isInteger(s.rev) || typeof s.seedHash !== 'string') return false;
    if (!s.datasets || typeof s.datasets !== 'object') return false;
    for (const d of Object.values(s.datasets)) {
        if (!d || typeof d.keyField !== 'string' || !Array.isArray(d.records)) return false;
        for (const r of d.records) if (!r || typeof r !== 'object' || !Number.isInteger(r._rev) || r[d.keyField] === undefined) return false;
    }
    return true;
}

const isScalar = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

export function createSimStore({ stateDir, seed, poc = '' }) {
    const stateFile = join(stateDir, 'state.json');
    const backupDir = join(stateDir, 'backup');
    const listeners = new Set();
    // Columns known per dataset: whatever the seed records use. Writes cannot invent new columns.
    const columns = Object.fromEntries(Object.entries(seed.datasets).map(([ln, d]) => [ln, new Set([d.keyField, ...d.records.flatMap((r) => Object.keys(r))])]));
    let state = null;
    let status = 'ok';

    mkdirSync(stateDir, { recursive: true });
    // The state folder ignores itself, so a POC does not need to touch its own .gitignore.
    const ignoreFile = join(stateDir, '.gitignore');
    if (!existsSync(ignoreFile)) writeFileSync(ignoreFile, '*\n');

    function save() {
        const tmp = `${stateFile}.tmp`;
        writeFileSync(tmp, JSON.stringify(state, null, 2));
        renameSync(tmp, stateFile);
    }

    function load() {
        if (!existsSync(stateFile)) { state = seedState(seed, 1); status = 'ok'; save(); return; }
        try {
            const parsed = JSON.parse(readFileSync(stateFile, 'utf8'));
            if (!isValidState(parsed)) throw new Error('struttura non valida');
            state = parsed;
            status = 'ok';
        } catch {
            // Never self-heal: the file stays as it is until an explicit reset (which backs it up first).
            state = null;
            status = 'corrupt';
        }
    }

    function emit(event) { for (const fn of listeners) fn(event); }

    function requireOk() {
        if (status !== 'ok') throw new SimError(503, 'state_corrupt', 'Stato della simulazione illeggibile: usa Ripristina (POST /_sim/reset o npm run sim -- --reset).');
    }

    function dataset(ln) {
        requireOk();
        const d = state.datasets[ln];
        if (!d) throw new SimError(404, 'not_found', `Dataset "${ln}" inesistente.`);
        return d;
    }

    function find(d, key) {
        return d.records.find((r) => String(r[d.keyField]) === String(key));
    }

    // Blocking version of the validate-poc-data rules, applied to the written columns only.
    function validate(ln, d, changes) {
        const details = [];
        if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return ['il body deve essere un oggetto JSON'];
        for (const [field, value] of Object.entries(changes)) {
            if (field.startsWith('_')) { details.push(`${field}: colonna riservata`); continue; }
            if (!columns[ln]?.has(field)) { details.push(`${field}: colonna sconosciuta nel dataset ${ln}`); continue; }
            const values = Array.isArray(value) ? value : [value];
            if (!values.every(isScalar)) { details.push(`${field}: ammessi solo testo, numeri, booleani, null o liste di questi`); continue; }
            for (const v of values) for (const kind of realDataKinds(field, v)) details.push(`${field}: ${REAL_DATA_MESSAGES[kind](v)}`);
        }
        for (const rel of seed.relationships) {
            if (rel.dataset !== ln || !(rel.field in changes)) continue;
            const target = state.datasets[rel.references];
            for (const v of lookupValues(changes[rel.field])) {
                if (!target || !find(target, v)) details.push(`${rel.field} = "${v}" non esiste in ${rel.references}`);
            }
        }
        return details;
    }

    function commit(op, ln, key, clientId) {
        state.rev++;
        save();
        const event = { rev: state.rev, op, dataset: ln, key: String(key), clientId: clientId ?? null };
        emit({ type: 'change', ...event });
        return event;
    }

    function backup(label) {
        if (!existsSync(stateFile)) return null;
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        let name = `${label}-${stamp}.json`;
        for (let i = 1; existsSync(join(backupDir, name)); i++) name = `${label}-${stamp}-${i}.json`;
        copyFileSync(stateFile, join(backupDir, name));
        const old = readdirSync(backupDir).filter((f) => f.endsWith('.json')).sort().reverse().slice(BACKUPS_KEPT);
        for (const f of old) rmSync(join(backupDir, f), { force: true });
        return `backup/${name}`;
    }

    load();

    return {
        get status() { return status; },
        get rev() { return state?.rev ?? 0; },

        onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },

        health() {
            return {
                ok: status === 'ok',
                status,
                poc,
                rev: state?.rev ?? 0,
                seedHash: seed.seedHash,
                seedChanged: status === 'ok' && state.seedHash !== seed.seedHash,
                datasets: status === 'ok' ? Object.keys(state.datasets) : [],
            };
        },

        summary() {
            requireOk();
            return { rev: state.rev, datasets: Object.fromEntries(Object.entries(state.datasets).map(([ln, d]) => [ln, { keyField: d.keyField, count: d.records.length }])) };
        },

        list(ln) {
            const d = dataset(ln);
            return { rev: state.rev, keyField: d.keyField, records: clone(d.records) };
        },

        get(ln, key) {
            const d = dataset(ln);
            const r = find(d, key);
            if (!r) throw new SimError(404, 'not_found', `Record "${key}" inesistente in ${ln}.`);
            return clone(r);
        },

        patch(ln, key, ifMatch, changes, clientId) {
            const d = dataset(ln);
            const r = find(d, key);
            if (!r) throw new SimError(404, 'not_found', `Record "${key}" inesistente in ${ln}.`);
            if (ifMatch === undefined || ifMatch === null || ifMatch === '') throw new SimError(428, 'precondition_required', 'Manca If-Match con la _rev del record.');
            if (Number(ifMatch) !== r._rev) throw new SimError(409, 'conflict', 'Record modificato in un\'altra finestra.', { current: clone(r) });
            const details = validate(ln, d, changes);
            if (changes && typeof changes === 'object' && d.keyField in changes && String(changes[d.keyField]) !== String(key)) details.push(`${d.keyField}: la chiave non si modifica`);
            if (details.length) throw new SimError(422, 'invalid', 'Modifica non valida.', { details });
            Object.assign(r, changes, { _rev: r._rev + 1 });
            commit('update', ln, key, clientId);
            return clone(r);
        },

        create(ln, record, clientId) {
            const d = dataset(ln);
            const details = validate(ln, d, record);
            if (details.length) throw new SimError(422, 'invalid', 'Record non valido.', { details });
            let key = record[d.keyField];
            if (key === undefined || key === null || key === '') {
                key = nextKey(d.records.map((r) => r[d.keyField]));
                if (key === null) throw new SimError(422, 'invalid', 'Record non valido.', { details: [`${d.keyField}: chiave obbligatoria (nessun pattern da cui generarla)`] });
            }
            if (find(d, key)) throw new SimError(409, 'duplicate_key', `Chiave "${key}" già presente in ${ln}.`);
            const created = { ...clone(record), [d.keyField]: key, _rev: 1 };
            d.records.push(created);
            commit('create', ln, key, clientId);
            return clone(created);
        },

        // Elimina solo se nessun record lo usa in un lookup (stesse relazioni di validate-poc-data).
        remove(ln, key, ifMatch, clientId) {
            const d = dataset(ln);
            const r = find(d, key);
            if (!r) throw new SimError(404, 'not_found', `Record "${key}" inesistente in ${ln}.`);
            if (ifMatch === undefined || ifMatch === null || ifMatch === '') throw new SimError(428, 'precondition_required', 'Manca If-Match con la _rev del record.');
            if (Number(ifMatch) !== r._rev) throw new SimError(409, 'conflict', 'Record modificato in un\'altra finestra.', { current: clone(r) });
            const usedBy = [];
            for (const rel of seed.relationships) {
                if (rel.references !== ln) continue;
                const from = state.datasets[rel.dataset];
                for (const x of from?.records ?? []) if (lookupValues(x[rel.field]).some((v) => String(v) === String(key))) usedBy.push(`${rel.dataset}/${x[from.keyField]}`);
            }
            if (usedBy.length) throw new SimError(409, 'referenced', `Record "${key}" usato da altri record: eliminarli o cambiarli prima.`, { usedBy });
            d.records.splice(d.records.indexOf(r), 1);
            commit('delete', ln, key, clientId);
        },

        reset() {
            const saved = backup(status === 'ok' ? 'state' : 'state-corrupt');
            state = seedState(seed, (state?.rev ?? 0) + 1);
            status = 'ok';
            save();
            emit({ type: 'reset', rev: state.rev });
            return { rev: state.rev, backup: saved };
        },
    };
}
