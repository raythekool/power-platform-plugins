// One command for agents and CI: validators, runtime, static build, coverage and (optionally) smoke test.
// Prints one compact JSON summary with --json. Usage: node scripts/check-poc.mjs [--json] [--no-smoke]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pocDir } from './lib/poc-model.mjs';

const json = process.argv.includes('--json');
const steps = ['validate-poc-config', 'validate-poc-data', 'prepare-runtime-poc', 'build-static-poc'];
const results = [];
let ok = true;
for (const step of steps) {
    const r = spawnSync(process.execPath, [join(pocDir, 'scripts', `${step}.mjs`), '--json'], { cwd: pocDir, encoding: 'utf8' });
    let parsed;
    try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { parsed = { step, ok: false, errors: [r.stderr.trim() || r.stdout.trim() || `uscita ${r.status}`], warnings: [] }; }
    results.push(parsed);
    if (!parsed.ok) { ok = false; break; }
}

const smokeScript = join(pocDir, 'scripts', 'smoke-test.mjs');
if (ok && !process.argv.includes('--no-smoke') && existsSync(smokeScript)) {
    const r = spawnSync(process.execPath, [smokeScript], { cwd: pocDir, encoding: 'utf8' });
    const lines = `${r.stdout}\n${r.stderr}`.split(/\r?\n/).filter(Boolean);
    const smoke = {
        step: 'test:smoke',
        ok: r.status === 0,
        errors: lines.filter((l) => l.startsWith('ERRORE') || /Cannot find package|Error:/.test(l)).map((l) => l.replace(/^ERRORE\s+/, '')),
        warnings: lines.filter((l) => l.startsWith('AVVISO')).map((l) => l.replace(/^AVVISO\s+/, '')),
        pages: lines.filter((l) => /schermate,/.test(l)),
    };
    results.push(smoke);
    ok = smoke.ok;
}

if (json) {
    console.log(JSON.stringify({ ok, steps: results }));
} else {
    for (const r of results) {
        r.warnings?.forEach((w) => console.warn(`AVVISO  [${r.step}] ${w}`));
        r.errors?.forEach((e) => console.error(`ERRORE  [${r.step}] ${e}`));
        const extra = r.coverage ? ` · copertura ${JSON.stringify(r.coverage)}` : '';
        console.log(`${r.ok ? 'OK ' : 'KO '} ${r.step} (${r.errors?.length ?? 0} errori, ${r.warnings?.length ?? 0} avvisi)${extra}`);
    }
    console.log(ok ? 'Check POC OK' : 'Check POC FALLITO');
}
process.exit(ok ? 0 : 1);
