// Contratto unico dei dati: le pagine non sanno se leggono il mock o la Web API di Power Pages.
import type { Screen } from '../generated/screens';
import { mockAdapter } from './mock';
import { webApiAdapter } from './webapi';

// __key e la chiave del record: keyField del dataset (mock) o primary id della tabella (Web API).
export type Row = Record<string, unknown> & { __key: string };

export interface DataAdapter {
  list(screen: Screen): Promise<Row[]>;
  get(screen: Screen, key: string): Promise<Row | null>;
  update(screen: Screen, key: string, patch: Record<string, unknown>): Promise<void>;
}

export const data: DataAdapter = import.meta.env.VITE_DATA_SOURCE === 'mock' ? mockAdapter : webApiAdapter;
