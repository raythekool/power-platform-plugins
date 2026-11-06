// Generates the self-contained HTML in dist/ (YAML layers, data, CSS and JS inlined, opens from the
// file system) and the requirements coverage report dist/requirements-coverage.{md,json}.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appAssets, page, read, scriptJson } from './lib/poc-html.mjs';
import { computeCoverage, loadModel, pocDir, report, toBrowserModel } from './lib/poc-model.mjs';

const model = loadModel();
const errors = [...model.errors];
const warnings = [];
const distDir = join(pocDir, 'dist');
let coverage = [];
if (!errors.length) {
    mkdirSync(distDir, { recursive: true });
    const { css, js } = appAssets(model.config.appType);
    const head = css.map((f) => `<style>/* ${f} */\n${read(f)}</style>`).join('\n');
    const body = [`<script>window.POC_MODEL = ${scriptJson(toBrowserModel(model))};</script>`,
        ...js.map((f) => `<script>/* ${f} */\n${read(f).replace(/<\/script/gi, '<\\/script')}</script>`)].join('\n');
    const fileName = `${model.config.application?.logicalName ?? 'poc'}.html`;
    writeFileSync(join(distDir, fileName), page({ title: model.config.application?.displayName ?? 'POC', head, body }));

    coverage = computeCoverage(model);
    writeFileSync(join(distDir, 'requirements-coverage.json'), JSON.stringify(coverage, null, 2));
    const label = { coperto: 'Coperto', scoperto: 'Scoperto', 'non-rappresentabile': 'Non rappresentabile', 'fuori-scope': 'Fuori scope' };
    const md = ['## Copertura requisiti', '', '| Requisito | Titolo | Stato | Dove |', '| --- | --- | --- | --- |',
        ...coverage.map((c) => `| ${c.id} | ${c.title} | ${label[c.status]} | ${c.references.map((r) => `\`${r}\``).join(', ') || '—'} |`), ''];
    writeFileSync(join(distDir, 'requirements-coverage.md'), md.join('\n'));
    for (const c of coverage.filter((x) => x.status === 'scoperto')) warnings.push(`requisito ${c.id} scoperto: nessun elemento lo referenzia`);
}
const summary = Object.fromEntries(['coperto', 'scoperto', 'non-rappresentabile', 'fuori-scope'].map((s) => [s, coverage.filter((c) => c.status === s).length]));
report('build:static', errors, warnings, { coverage: summary, uncovered: coverage.filter((c) => c.status === 'scoperto').map((c) => c.id) });
