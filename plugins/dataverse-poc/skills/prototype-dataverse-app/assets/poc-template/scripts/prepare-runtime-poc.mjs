// Generates poc-runtime.html plus the bootstraps config/poc-config.js and config/data/poc-data.js.
// Open the runtime through `npm run serve` (http://127.0.0.1:8080/poc-runtime.html).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appAssets, page, scriptJson } from './lib/poc-html.mjs';
import { loadModel, pocDir, report, toBrowserModel } from './lib/poc-model.mjs';

const model = loadModel();
const errors = [...model.errors];
if (!errors.length) {
    const { data, ...ui } = toBrowserModel(model);
    const banner = '// Generato da scripts/prepare-runtime-poc.mjs: non modificare a mano.\n';
    writeFileSync(join(pocDir, 'config', 'poc-config.js'), `${banner}window.POC_MODEL = Object.assign(window.POC_MODEL || {}, ${scriptJson(ui)});\n`);
    writeFileSync(join(pocDir, 'config', 'data', 'poc-data.js'), `${banner}window.POC_MODEL = Object.assign(window.POC_MODEL || {}, { data: ${scriptJson(data)} });\n`);
    const { css, js } = appAssets(model.config.appType);
    const head = css.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n');
    const body = ['config/poc-config.js', 'config/data/poc-data.js', ...js].map((f) => `<script src="${f}"></script>`).join('\n');
    writeFileSync(join(pocDir, 'poc-runtime.html'), page({ title: `${model.config.application?.displayName ?? 'POC'} (runtime)`, head, body }));
}
report('prepare:runtime', errors, [], { output: errors.length ? [] : ['poc-runtime.html', 'config/poc-config.js', 'config/data/poc-data.js'] });
