#!/usr/bin/env node
// Stage R/D preflight, read-only: compares PAC/PACX active profiles with the target of the plan.
// Replaces the manual "pac org who + pacx auth list + compare" step of every sub-agent.
//
// node poc-preflight.mjs --plan <Piano.md> [--url <env>] [--pac-profile x] [--pacx-profile y] [--solution s] [--json]
// Exit 0 = target confirmed and profiles aligned; 1 = mismatch or stage not confirmed; 2 = tool missing.
import { findOnPath, firstLine, run } from './lib/proc.mjs';
import { hostOf, readTarget } from './lib/plan.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined; };
const json = argv.includes('--json');

const target = opt('plan') ? readTarget(opt('plan')) : {};
for (const [k, a] of [['url', 'url'], ['pacProfile', 'pac-profile'], ['pacxProfile', 'pacx-profile'], ['solution', 'solution']]) if (opt(a)) target[k] = opt(a);
const checks = [];
const add = (id, status, detail) => checks.push({ id, status, detail });
const host = hostOf(target.url);

if (!host) add('target', 'error', 'URL ambiente mancante o "da confermare" nel piano: lo stage R non e aperto');
else if (!/\.(crm\d*\.)?dynamics\.com$/.test(host)) add('target', 'warning', `URL non Dataverse standard: ${target.url}`);
else add('target', 'ok', target.url);
if (opt('plan')) {
    const confirmed = /^(s[iì]|yes|true|confermat)/i.test(target.confirmed ?? '');
    add('conferma', confirmed ? 'ok' : 'error', confirmed ? `conferma utente: ${target.confirmed}` : 'manca la conferma utente dello stage R nel piano');
}

const pac = findOnPath('pac');
const pacx = findOnPath('pacx');
if (!pac) add('pac', 'missing', 'pac non trovato: dotnet tool install --global Microsoft.PowerApps.CLI.Tool');
if (!pacx) add('pacx', 'missing', 'pacx non trovato: dotnet tool install --global Greg.Xrm.Command');

if (pac && host) {
    // In sub-agent terminals `pac org who` sometimes exits 1 with partial output: retry once.
    let who = await run(pac, ['org', 'who']);
    if (who.code !== 0) who = await run(pac, ['org', 'who']);
    const whoUrl = (who.out.match(/https:\/\/[^\s/]+/) || [])[0];
    if (!whoUrl) add('pac org who', 'error', `nessun URL nell'output: ${firstLine(who.out)}`);
    else add('pac org who', hostOf(whoUrl) === host ? 'ok' : 'error', hostOf(whoUrl) === host ? whoUrl : `punta a ${whoUrl}, il piano a ${target.url}: non selezionare profili per tentativi`);

    const list = await run(pac, ['auth', 'list']);
    const active = list.out.split(/\r?\n/).find((l) => /\*/.test(l) && /https?:\/\//.test(l)) ?? '';
    if (target.pacProfile) add('pac profilo', active.includes(target.pacProfile) ? 'ok' : 'error', active.includes(target.pacProfile) ? target.pacProfile : `profilo attivo diverso da ${target.pacProfile}: ${active.trim() || firstLine(list.out)}`);

    if (target.solution) {
        const sol = await run(pac, ['solution', 'list'], 60000);
        const found = new RegExp(`\\b${target.solution.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sol.out);
        add('solution', found ? 'ok' : 'info', found ? `${target.solution} presente` : `${target.solution} non trovata: va creata da poc-deployer`);
    }
}
if (pacx && host) {
    const list = await run(pacx, ['auth', 'list']);
    const lines = list.out.split(/\r?\n/);
    const hit = lines.find((l) => l.toLowerCase().includes(host) || (target.pacxProfile && l.includes(target.pacxProfile)));
    add('pacx auth', hit ? 'ok' : 'warning', hit ? hit.trim() : `nessun profilo PACX per ${host}: pacx auth create (credenziali inserite dall'utente)`);
}

const status = checks.some((c) => c.status === 'missing') ? 2 : checks.some((c) => c.status === 'error') ? 1 : 0;
if (json) console.log(JSON.stringify({ ok: status === 0, target, checks }));
else {
    const icon = { ok: '✔', error: '✖', missing: '✖', warning: '⚠', info: '·' };
    checks.forEach((c) => console.log(`${icon[c.status]} ${c.id.padEnd(14)} ${c.detail}`));
    console.log(status === 0 ? 'Preflight OK' : 'Preflight FALLITO: restituire BLOCCATO con questo output');
}
process.exit(status);
