#!/usr/bin/env node
// Read-only inspection of an exported solution zip: name, version, managed flag, root components by type,
// generative pages (uxagentprojects/<pageId>/) and their files. No unzip tool needed.
//
// node poc-solution-zip.mjs <solution.zip> [--pages <pageId,pageId>] [--json]
// Exit 0 when every expected page is in the zip with page.tsx and page.compiled, 1 otherwise.
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const zipPath = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--pages');
const pagesArg = argv[argv.indexOf('--pages') + 1];
const expected = argv.includes('--pages') && pagesArg ? pagesArg.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
if (!zipPath) { console.error('Uso: node poc-solution-zip.mjs <solution.zip> [--pages id1,id2] [--json]'); process.exit(2); }

// Minimal zip reader: end of central directory -> central directory -> local headers.
const buf = readFileSync(zipPath);
let eocd = -1;
for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
if (eocd < 0) { console.error(`${zipPath}: non e uno zip valido`); process.exit(2); }
const count = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);
const entries = [];
for (let n = 0; n < count && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    entries.push({ name: buf.toString('utf8', p + 46, p + 46 + nameLen).replaceAll('\\', '/'), method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
}
const read = (entry) => {
    const start = entry.offset + 30 + buf.readUInt16LE(entry.offset + 26) + buf.readUInt16LE(entry.offset + 28);
    const raw = buf.subarray(start, start + entry.size);
    return (entry.method === 8 ? inflateRawSync(raw) : raw).toString('utf8').replace(/^﻿/, '');
};

const names = entries.map((e) => e.name);
const solutionEntry = entries.find((e) => /(^|\/)solution\.xml$/i.test(e.name));
const solution = {};
if (solutionEntry) {
    const xml = read(solutionEntry);
    solution.uniqueName = (xml.match(/<UniqueName>([^<]+)<\/UniqueName>/) || [])[1];
    solution.version = (xml.match(/<Version>([^<]+)<\/Version>/) || [])[1];
    solution.managed = (xml.match(/<Managed>(\d)<\/Managed>/) || [])[1] === '1';
    solution.rootComponents = {};
    for (const m of xml.matchAll(/<RootComponent\b[^>]*\btype="(\d+)"/g)) solution.rootComponents[m[1]] = (solution.rootComponents[m[1]] ?? 0) + 1;
}

// Generative pages are not RootComponents: they are folders in the zip.
const pages = [...new Set(names.map((n) => (n.match(/^uxagentprojects\/([^/]+)\//i) || [])[1]).filter(Boolean).map((s) => s.toLowerCase()))];
const pageFiles = names.filter((n) => /^uxagentprojectfiles\//i.test(n));
const tsx = pageFiles.filter((n) => /page\.tsx$/i.test(n)).length;
const compiled = pageFiles.filter((n) => /page\.compiled/i.test(n)).length;
const missing = expected.filter((id) => !pages.includes(id));
const problems = [];
if (!solutionEntry) problems.push('solution.xml assente');
if (missing.length) problems.push(`generative page mancanti nello zip: ${missing.join(', ')}`);
if (pages.length && (tsx < pages.length || compiled < pages.length)) problems.push(`file pagina incompleti: ${pages.length} pagine, ${tsx} page.tsx, ${compiled} page.compiled`);
if (names.some((n) => /(^|\/)data\.xml$/i.test(n))) problems.push('lo zip contiene data.xml: non committarlo');

const result = { ok: !problems.length, zip: zipPath, entries: names.length, solution, generativePages: { found: pages, expected, missing, pageTsx: tsx, pageCompiled: compiled }, problems };
if (json) console.log(JSON.stringify(result));
else {
    console.log(`${solution.uniqueName ?? '?'} ${solution.version ?? ''} ${solution.managed ? 'managed' : 'unmanaged'} · ${names.length} file`);
    console.log(`RootComponents per tipo: ${JSON.stringify(solution.rootComponents ?? {})}`);
    console.log(`Generative page: ${pages.length} (${tsx} page.tsx, ${compiled} page.compiled)${pages.length ? `\n  ${pages.join('\n  ')}` : ''}`);
    problems.forEach((x) => console.error(`ERRORE  ${x}`));
    console.log(result.ok ? 'Zip OK' : 'Zip con problemi');
}
process.exit(result.ok ? 0 : 1);
