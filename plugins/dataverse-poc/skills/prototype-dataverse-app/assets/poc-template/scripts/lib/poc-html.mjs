// HTML shell shared by prepare-runtime-poc (linked files) and build-static-poc (everything inlined).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pocDir } from './poc-model.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// app/ files in load order; mda-shell.* only exists in model-driven POCs.
export function appAssets(appType) {
    const css = ['app/mda-shell.css', 'app/poc-app.css', 'app/custom.css'];
    const js = ['app/mda-shell.js', 'app/poc-app.js', 'app/custom.js'];
    const keep = (f) => existsSync(join(pocDir, f)) && (appType === 'model-driven' || !f.includes('mda-shell'));
    return { css: css.filter(keep), js: js.filter(keep) };
}

// JSON safe inside a <script> element.
export const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function page({ title, lang = 'it', head = '', body = '' }) {
    return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="dataverse-poc pipeline">
<title>${esc(title)}</title>
${head}
</head>
<body>
<div id="app"></div>
${body}
</body>
</html>
`;
}

export const read = (f) => readFileSync(join(pocDir, f), 'utf8');
