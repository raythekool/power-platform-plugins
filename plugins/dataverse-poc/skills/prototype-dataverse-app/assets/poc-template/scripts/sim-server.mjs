// Shared local simulation (stage P): back-office on /, portal on /portal/, shared demo state on /_sim.
// Usage: node scripts/sim-server.mjs [--port <n>] [--reset]
// Listens on 127.0.0.1 only, never calls out, never rewrites config/data. See references/simulazione-condivisa.md.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadModel, pocDir } from './lib/poc-model.mjs';
import { createSimServer } from './lib/sim-http.mjs';
import { createSimStore, seedFromModel } from './lib/sim-store.mjs';

const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const stop = (message) => { console.error(`ERRORE  ${message}`); process.exit(1); };

const model = loadModel();
const dataErrors = model.errors.filter((e) => e.includes('config/'));
if (dataErrors.length) stop(`${dataErrors[0]} (eseguire npm run check)`);
if (!model.datasets.length) stop('nessun dataset in config/data: la simulazione parte solo da dati demo sintetici');

const sim = model.config.simulation ?? {};
const port = Number(option('--port') ?? process.env.SIM_PORT ?? sim.port ?? 8090);
// 0 = porta libera scelta dal sistema (usata dai test).
if (!Number.isInteger(port) || port < 0 || port > 65535) stop(`porta non valida: ${port}`);

let portalDir = null;
if (sim.portal) {
    portalDir = resolve(pocDir, sim.portal.path ?? 'realization/power-pages', sim.portal.dist ?? 'dist-sim');
    if (!existsSync(portalDir)) console.warn(`AVVISO  portale non ancora compilato: ${portalDir} (build con base /portal/)`);
}
if (!existsSync(join(pocDir, 'poc-runtime.html'))) console.warn('AVVISO  poc-runtime.html mancante: eseguire npm run prepare:runtime');

const store = createSimStore({ stateDir: join(pocDir, '.sim'), seed: seedFromModel(model), poc: model.config.application?.logicalName ?? '' });
if (args.includes('--reset')) {
    const { backup } = store.reset();
    console.log(`Stato ripristinato dai dati iniziali${backup ? ` (backup in .sim/${backup})` : ''}`);
}
const health = store.health();
if (health.status === 'corrupt') console.warn('AVVISO  .sim/state.json illeggibile: le UI mostrano "Ripristina" (oppure npm run sim -- --reset)');
if (health.seedChanged) console.warn('AVVISO  i dati in config/data sono cambiati dopo l\'avvio della simulazione: usare Ripristina per ripartire dal nuovo seed');

const server = createSimServer({ pocDir, store, portalDir });
server.on('error', (e) => stop(e.code === 'EADDRINUSE' ? `porta ${port} occupata: usare --port` : e.message));
server.listen(port, '127.0.0.1', () => {
    const actual = server.address().port;
    console.log('Simulazione locale: dati sintetici, nessun Dataverse');
    console.log(`  back-office  http://127.0.0.1:${actual}/`);
    if (portalDir) console.log(`  portale      http://127.0.0.1:${actual}/portal/`);
    console.log(`  stato        .sim/state.json (rev ${store.rev})  —  Ctrl+C per fermare`);
});
const shutdown = () => server.closeAll().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
