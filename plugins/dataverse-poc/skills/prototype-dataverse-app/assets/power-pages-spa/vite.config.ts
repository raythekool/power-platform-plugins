import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sorgente dati: mock in sviluppo (npm run dev) e con --mode mock, Web API di Power Pages nella build.
// La Web API (/_api/) non risponde su localhost senza la configurazione bearer descritta su Microsoft Learn:
// per lo sviluppo locale si usa il mock generato dai dataset YAML della POC.
// --mode sim: simulazione condivisa della POC (npm run sim). In sviluppo /_sim va al server della POC
// (SIM_PORT, default 8090); la build va in dist-sim con base /portal/, servita dallo stesso server.
export default defineConfig(({ command, mode }) => {
  const sim = mode === 'sim';
  return {
    plugins: [react()],
    base: sim && command === 'build' ? '/portal/' : '/',
    define: {
      'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(sim ? 'sim' : command === 'serve' || mode === 'mock' ? 'mock' : 'webapi'),
    },
    server: sim ? { proxy: { '/_sim': `http://127.0.0.1:${process.env.SIM_PORT ?? 8090}` } } : undefined,
    build: { outDir: sim ? 'dist-sim' : 'dist', emptyOutDir: true },
  };
});
