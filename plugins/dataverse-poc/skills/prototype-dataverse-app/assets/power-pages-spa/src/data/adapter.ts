// Contratto unico dei dati: le pagine non sanno se leggono il mock, la simulazione condivisa o la Web API di Power Pages.
import type { Screen } from '../generated/screens';
import { mockAdapter } from './mock';
import { simAdapter } from './sim';
import { webApiAdapter } from './webapi';

// __key e la chiave del record: keyField del dataset (mock, sim) o primary id della tabella (Web API).
// __rev: revisione del record, solo con la simulazione condivisa.
export type Row = Record<string, unknown> & { __key: string; __rev?: number };

export interface DataEvent { type: 'change' | 'reset'; dataset?: string; key?: string; clientId?: string }

export interface DataAdapter {
  list(screen: Screen): Promise<Row[]>;
  get(screen: Screen, key: string): Promise<Row | null>;
  update(screen: Screen, key: string, patch: Record<string, unknown>, expectedRev?: number): Promise<void>;
  // Solo simulazione condivisa: creazione e notifica dei cambi fatti in altre finestre o nel back-office.
  create?(screen: Screen, values: Record<string, unknown>): Promise<Row>;
  subscribe?(listener: (event: DataEvent) => void): () => void;
  reset?(): Promise<void>;
}

// Conflitto di revisione (solo simulazione): `current` e il record salvato in un'altra finestra.
export const isConflict = (e: unknown): e is Error & { current: Record<string, unknown> } =>
  e instanceof Error && e.name === 'ConflictError' && 'current' in e;

export const source = import.meta.env.VITE_DATA_SOURCE as 'mock' | 'sim' | 'webapi';
export const data: DataAdapter = source === 'sim' ? simAdapter : source === 'mock' ? mockAdapter : webApiAdapter;
