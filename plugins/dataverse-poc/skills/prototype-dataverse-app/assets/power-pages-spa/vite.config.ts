import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sorgente dati: mock in sviluppo (npm run dev) e con --mode mock, Web API di Power Pages nella build.
// La Web API (/_api/) non risponde su localhost senza la configurazione bearer descritta su Microsoft Learn:
// per lo sviluppo locale si usa il mock generato dai dataset YAML della POC.
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_DATA_SOURCE': JSON.stringify(command === 'serve' || mode === 'mock' ? 'mock' : 'webapi'),
  },
  build: { outDir: 'dist', emptyOutDir: true },
}));
