// Shared loader for the POC YAML layers: config, requirements, entities, components, data.
// Used by validators, runtime/static builders and check-poc. Never writes files.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

export const pocDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const configDir = join(pocDir, 'config');

export const rel = (file) => relative(pocDir, file).replaceAll('\\', '/');

export function readYaml(file, errors) {
    try {
        return load(readFileSync(file, 'utf8')) ?? {};
    } catch (e) {
        errors?.push(`${rel(file)}: YAML non valido (${e.reason || e.message})`);
        return null;
    }
}

const yamlFiles = (dir) => existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && /\.ya?ml$/i.test(d.name))
        .map((d) => join(dir, d.name))
        .sort()
    : [];

// Returns the whole POC as plain objects plus the load errors (missing or invalid files).
export function loadModel() {
    const errors = [];
    const indexFile = join(configDir, 'index.yaml');
    if (!existsSync(indexFile)) {
        errors.push('config/index.yaml mancante: eseguire prima lo scaffold (poc-init)');
        return { config: {}, requirements: [], entities: [], components: [], definitions: [], datasets: [], dataSchema: {}, errors };
    }
    const config = readYaml(indexFile, errors) ?? {};

    const reqFile = join(configDir, 'requirements.yaml');
    const requirements = existsSync(reqFile) ? (readYaml(reqFile, errors)?.requirements ?? []) : null;

    const entities = [];
    for (const ref of config.entities ?? []) {
        if (!ref?.file) { errors.push(`config/index.yaml: entita ${ref?.logicalName ?? '?'} senza file`); continue; }
        const file = join(configDir, ref.file);
        if (!existsSync(file)) { errors.push(`config/index.yaml: file mancante ${ref.file}`); continue; }
        const doc = readYaml(file, errors);
        if (doc) entities.push({ ref, file: rel(file), doc });
    }

    const componentsDir = join(configDir, 'components');
    const components = yamlFiles(componentsDir)
        .filter((f) => basename(f) !== 'index.yaml')
        .map((f) => ({ file: rel(f), doc: readYaml(f, errors) }))
        .filter((c) => c.doc);
    const definitions = yamlFiles(join(componentsDir, '_definitions'))
        .map((f) => ({ file: rel(f), doc: readYaml(f, errors) }))
        .filter((c) => c.doc);

    const dataDir = join(configDir, 'data');
    const dataIndexFile = join(dataDir, 'index.yaml');
    const dataIndex = existsSync(dataIndexFile) ? readYaml(dataIndexFile, errors) ?? {} : null;
    const datasetRefs = dataIndex?.datasets
        ?? yamlFiles(dataDir).filter((f) => !['index.yaml', '_schema.yaml'].includes(basename(f))).map((f) => ({ file: basename(f) }));
    const datasets = [];
    for (const ref of datasetRefs) {
        const file = join(dataDir, ref.file ?? '');
        if (!ref.file || !existsSync(file)) { errors.push(`config/data/index.yaml: file mancante ${ref.file ?? '(vuoto)'}`); continue; }
        const doc = readYaml(file, errors);
        if (doc) datasets.push({ ref, file: rel(file), doc });
    }
    const schemaFile = join(dataDir, '_schema.yaml');
    const dataSchema = existsSync(schemaFile) ? readYaml(schemaFile, errors) ?? {} : {};

    return { config, requirements, entities, components, definitions, dataIndex, datasets, dataSchema, errors };
}

// Plain JSON consumed by the browser renderer (app/poc-app.js).
export function toBrowserModel(model) {
    const byName = (list) => Object.fromEntries(list.map((x) => [x.doc.logicalName ?? x.doc.entity?.logicalName, x.doc]));
    return {
        config: model.config,
        requirements: model.requirements ?? [],
        entities: Object.fromEntries(model.entities.map((e) => [e.doc.entity?.logicalName ?? e.ref.logicalName, e.doc])),
        components: byName(model.components),
        definitions: byName(model.definitions),
        data: Object.fromEntries(model.datasets.map((d) => [d.doc.logicalName ?? d.ref.logicalName, d.doc])),
    };
}

// Walks every element that can carry `requirements` and returns [{ id, logicalName }].
export function requirementRefs(model) {
    const refs = [];
    const add = (list, logicalName) => { for (const id of list ?? []) refs.push({ id: String(id), logicalName }); };
    for (const { doc } of model.entities) {
        const entityName = doc.entity?.logicalName;
        add(doc.entity?.requirements, entityName);
        for (const tab of doc.tabs ?? []) add(tab.requirements, `${entityName}.${tab.logicalName}`);
        for (const section of doc.sections ?? []) {
            add(section.requirements, `${entityName}.${section.logicalName}`);
            for (const field of section.fields ?? []) add(field.requirements, `${entityName}.${field.logicalName}`);
            for (const use of section.uses ?? []) add(use.requirements, use.instance);
        }
    }
    for (const { doc } of [...model.components, ...model.definitions]) add(doc.requirements, doc.logicalName);
    for (const { doc } of model.datasets) add(doc.requirements, doc.logicalName);
    return refs;
}

// Coverage contract of yaml-schema.md: coperto | scoperto | non-rappresentabile | fuori-scope.
export function computeCoverage(model) {
    const refs = requirementRefs(model);
    return (model.requirements ?? []).map((r) => {
        const references = [...new Set(refs.filter((x) => x.id === String(r.id)).map((x) => x.logicalName))];
        const status = r.scope === 'out-of-scope' ? 'fuori-scope'
            : r.scope === 'non-rappresentabile' ? 'non-rappresentabile'
                : references.length ? 'coperto' : 'scoperto';
        return { id: String(r.id), title: r.title ?? '', status, references };
    });
}

// Common CLI output: human readable by default, compact JSON with --json.
export function report(name, errors, warnings, extra = {}) {
    const json = process.argv.includes('--json');
    if (json) {
        console.log(JSON.stringify({ step: name, ok: !errors.length, errors, warnings, ...extra }));
    } else {
        warnings.forEach((w) => console.warn(`AVVISO  ${w}`));
        errors.forEach((e) => console.error(`ERRORE  ${e}`));
        console.log(errors.length ? `${name}: ${errors.length} errori, ${warnings.length} avvisi` : `${name}: OK (${warnings.length} avvisi)`);
    }
    process.exitCode = errors.length ? 1 : 0;
}
