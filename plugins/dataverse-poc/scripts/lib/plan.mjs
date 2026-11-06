// Reads the "🎯 Target ambiente" table of the POC plan document (see dataverse-poc-realization).
import { readFileSync } from 'node:fs';

const KEYS = {
    'url ambiente': 'url', 'profilo pac': 'pacProfile', 'profilo pacx': 'pacxProfile', 'solution (unique name)': 'solution',
    solution: 'solution', 'publisher prefix': 'prefix', 'app module (unique name)': 'appModule', 'lcid etichette': 'lcid',
    'conferma utente stage r': 'confirmed',
};
const PLACEHOLDER = /^(|-|—|da confermare|tbd|n\/d|se esiste)$/i;

export function parseTarget(text) {
    const lines = String(text).split(/\r?\n/);
    const start = lines.findIndex((l) => /^#{1,6}\s.*target ambiente/i.test(l));
    const target = {};
    if (start < 0) return target;
    for (const line of lines.slice(start + 1)) {
        if (/^#{1,6}\s/.test(line)) break;
        const cells = line.split('|').map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
        if (cells.length < 2 || /^-+$/.test(cells[0].replace(/:/g, ''))) continue;
        const key = KEYS[cells[0].replace(/`/g, '').toLowerCase()];
        const value = cells[1].replace(/`/g, '').trim();
        if (key && !PLACEHOLDER.test(value)) target[key] = value;
    }
    return target;
}

export const readTarget = (file) => parseTarget(readFileSync(file, 'utf8'));

export const hostOf = (url) => { try { return new URL(url).host.toLowerCase(); } catch { return null; } };
