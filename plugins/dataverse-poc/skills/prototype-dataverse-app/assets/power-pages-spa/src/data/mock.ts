// Dati mock: i dataset YAML della POC (src/generated/mock-data.json), modificabili in memoria.
import mockData from '../generated/mock-data.json';
import type { Screen } from '../generated/screens';
import type { DataAdapter, Row } from './adapter';

type Records = Record<string, Record<string, unknown>[]>;
const store: Records = JSON.parse(JSON.stringify(mockData)) as Records;

const rows = (s: Screen): Row[] =>
  (s.dataset ? store[s.dataset] ?? [] : []).map((r) => ({ ...r, __key: String(r[s.keyField ?? ''] ?? '') }));

export const mockAdapter: DataAdapter = {
  async list(s) {
    return rows(s);
  },
  async get(s, key) {
    return rows(s).find((r) => r.__key === key) ?? null;
  },
  async update(s, key, patch) {
    const record = (store[s.dataset ?? ''] ?? []).find((r) => String(r[s.keyField ?? '']) === key);
    if (record) Object.assign(record, patch);
  },
};
