// Web API di Power Pages (/_api/<entitySet>). Prerequisiti in ambiente, generati in power-pages/:
// site setting Webapi/<tabella>/enabled e Webapi/<tabella>/fields, table permission e web role.
// Le scritture richiedono il token anti-CSRF della pagina (/_layout/tokenhtml).
import type { Screen } from '../generated/screens';
import type { DataAdapter, Row } from './adapter';

let token: string | null = null;

async function csrf(): Promise<string> {
  if (token) return token;
  const html = await (await fetch('/_layout/tokenhtml', { credentials: 'same-origin' })).text();
  token = /value="([^"]+)"/.exec(html)?.[1] ?? '';
  return token;
}

async function call(url: string, init: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' };
  if (init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['__RequestVerificationToken'] = await csrf();
  }
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Web API ${res.status} su ${url}`);
  return res.status === 204 ? null : res.json();
}

const query = (s: Screen) => (s.select.length ? `?$select=${s.select.join(',')}` : '');
const withKey = (s: Screen, r: Record<string, unknown>): Row => ({ ...r, __key: String(r[s.primaryId ?? ''] ?? '') });

export const webApiAdapter: DataAdapter = {
  async list(s) {
    const body = await call(`/_api/${s.entitySet}${query(s)}`);
    return ((body?.value ?? []) as Record<string, unknown>[]).map((r) => withKey(s, r));
  },
  async get(s, key) {
    return withKey(s, await call(`/_api/${s.entitySet}(${key})${query(s)}`));
  },
  async update(s, key, patch) {
    await call(`/_api/${s.entitySet}(${key})`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
};
