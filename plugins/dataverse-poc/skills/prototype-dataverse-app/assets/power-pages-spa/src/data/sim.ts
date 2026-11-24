// Simulazione condivisa (npm run sim nella POC): stessi dati demo del prototipo, letti e scritti su /_sim.
// Contratto: references/simulazione-condivisa.md del plugin. Solo build --mode sim, mai la build di produzione.
import type { Screen } from '../generated/screens';
import type { DataAdapter, Row } from './adapter';

type Rec = Record<string, unknown> & { _rev?: number };

export class ConflictError extends Error {
  constructor(public current: Rec) {
    super('Record modificato in un\'altra finestra.');
    this.name = 'ConflictError';
  }
}

const clientId = (() => {
  try {
    const saved = sessionStorage.getItem('poc-sim-client');
    if (saved) return saved;
    const id = `w-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('poc-sim-client', id);
    return id;
  } catch {
    return `w-${Math.random().toString(36).slice(2, 10)}`;
  }
})();

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(path, {
    method,
    cache: 'no-store',
    headers: { 'X-Sim-Client': clientId, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 409 && json?.error === 'conflict') throw new ConflictError(json.current);
  if (!res.ok) throw Object.assign(new Error([json?.message ?? `Simulazione ${res.status}`, ...(json?.details ?? [])].join(' ')), { status: res.status });
  return json;
}

const url = (s: Screen, key?: string) => `/_sim/api/data/${encodeURIComponent(s.dataset ?? '')}${key === undefined ? '' : `/${encodeURIComponent(key)}`}`;

// Record del dataset -> riga della pagina: colonne Dataverse lette dalle chiavi del dataset (mockKeys), come il mock.
const toRow = (s: Screen, r: Rec): Row => ({
  ...r,
  ...Object.fromEntries(Object.entries(s.mockKeys).filter(([, key]) => key in r).map(([key, mockKey]) => [key, r[mockKey]])),
  __key: String(r[s.keyField ?? ''] ?? ''),
  __rev: r._rev,
});
const toRecord = (s: Screen, patch: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(patch).map(([key, value]) => [s.mockKeys[key] ?? key, value]));

export const simAdapter: DataAdapter = {
  async list(s) {
    if (!s.dataset) return [];
    return ((await call('GET', url(s))).records as Rec[]).map((r) => toRow(s, r));
  },
  async get(s, key) {
    if (!s.dataset) return null;
    try {
      return toRow(s, await call('GET', url(s, key)));
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  },
  // expectedRev: la revisione su cui l'utente ha iniziato a modificare; 409 -> ConflictError con il record attuale.
  async update(s, key, patch, expectedRev) {
    await call('PATCH', url(s, key), toRecord(s, patch), { 'If-Match': `"${expectedRev ?? ''}"` });
  },
  async create(s, values) {
    return toRow(s, await call('POST', url(s), toRecord(s, values)));
  },
  // Notifica ogni cambio fatto da qualunque finestra (anche dal back-office) e i ripristini.
  subscribe(listener) {
    const source = new EventSource('/_sim/events');
    const onChange = (e: MessageEvent) => listener({ type: 'change', ...JSON.parse(e.data) });
    const onReset = () => listener({ type: 'reset' });
    source.addEventListener('change', onChange);
    source.addEventListener('reset', onReset);
    return () => source.close();
  },
  async reset() {
    await call('POST', '/_sim/reset', {});
  },
};
