import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { can, useRoles } from '../auth/user';
import { data, isConflict, type Row } from '../data/adapter';
import { datetimeInputValue, datetimePatch, fmt } from '../data/format';
import { screens, type Field, type Screen } from '../generated/screens';

// Chiave di percorso del nuovo record (solo con la simulazione condivisa, che supporta create).
export const NEW_KEY = 'nuovo';

export default function DetailPage({ screen }: { screen: Screen }) {
  const { key = '' } = useParams();
  return <RecordDetail key={`${screen.logicalName}:${key}`} screen={screen} recordKey={key} />;
}

function RecordDetail({ screen, recordKey: key }: { screen: Screen; recordKey: string }) {
  const roles = useRoles();
  const [record, setRecord] = useState<Row | null | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState(screen.tabs[0]?.logicalName);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const request = useRef(0);
  const dirty = useRef(false);
  const navigate = useNavigate();
  const isNew = key === NEW_KEY && !!data.create;
  dirty.current = Object.keys(draft).length > 0;
  useEffect(() => {
    const id = ++request.current;
    setRecord(isNew ? { __key: '' } : undefined);
    setDraft({});
    setTab(screen.tabs[0]?.logicalName);
    setMessage(null);
    setSaving(false);
    setStale(false);
    if (isNew) return () => { request.current++; };
    const load = () => data.get(screen, key).then(
      (row) => { if (request.current === id) setRecord(row); },
      (e) => { if (request.current === id) setMessage(String(e)); },
    );
    load();
    // Simulazione condivisa: senza modifiche in corso il record si ricarica; con modifiche in corso si avvisa.
    const unsubscribe = data.subscribe?.((event) => {
      if (event.type === 'reset') { setDraft({}); setStale(false); setMessage(null); load(); return; }
      if (event.dataset !== screen.dataset || event.key !== key) return;
      if (dirty.current) setStale(true);
      else load();
    });
    return () => { request.current++; unsubscribe?.(); };
  }, [screen, key, isNew]);

  const editable = can(screen.privileges, roles, isNew ? 'create' : 'write');
  const parent = screen.parent ? screens[screen.parent] : undefined;
  const value = (f: Field) => (f.key in draft ? draft[f.key] : record?.[f.key]);
  const save = async (expectedRev = record?.__rev) => {
    const id = request.current;
    setSaving(true);
    setMessage(null);
    try {
      if (isNew) {
        const created = await data.create!(screen, draft);
        if (request.current === id) navigate(`${screen.path}/${encodeURIComponent(created.__key)}`, { replace: true });
        return;
      }
      await data.update(screen, key, draft, expectedRev);
      if (request.current !== id) return;
      setRecord((await data.get(screen, key)) ?? { ...record!, ...draft });
      setDraft({});
      setStale(false);
      setMessage('Modifiche salvate.');
    } catch (e) {
      if (request.current !== id) return;
      if (isConflict(e)) {
        // Conferma = sovrascrivi con le proprie modifiche; Annulla = ricarica la versione salvata altrove.
        if (window.confirm('Il record è stato modificato in un\'altra finestra. OK per sovrascrivere con le tue modifiche, Annulla per ricaricarlo.')) {
          setSaving(false);
          return save(e.current._rev as number);
        }
        setDraft({});
        setStale(false);
        setRecord(await data.get(screen, key));
        setMessage('Record ricaricato con la versione dell\'altra finestra.');
      } else setMessage(`Salvataggio non riuscito: ${String(e)}`);
    } finally {
      if (request.current === id) setSaving(false);
    }
  };

  if (record === undefined) return <p className="empty">{message ?? 'Caricamento…'}</p>;
  if (record === null) return <p className="empty">Record non trovato.</p>;
  const title = isNew ? `Nuovo: ${screen.displayName}` : screen.primaryField ? fmt(record[screen.primaryField]) : screen.displayName;
  return (
    <>
      <div className="head">
        {parent && <Link className="button" to={parent.path}>← {parent.displayName}</Link>}
        <h1>{title || screen.displayName}</h1>
        <span className="grow" />
        {editable && <button className="primary" disabled={saving || !Object.keys(draft).length} onClick={() => save()}>Salva</button>}
      </div>
      {stale && <p className="message warning" role="status">Il record è stato modificato in un'altra finestra: al salvataggio potrai sovrascriverlo o ricaricarlo.</p>}
      {message && <p className="message" role="status">{message}</p>}
      {screen.tabs.length > 1 && (
        <div className="tabs">
          {screen.tabs.map((t) => (
            <button key={t.logicalName} className={t.logicalName === tab ? 'active' : ''} onClick={() => setTab(t.logicalName)}>{t.displayName}</button>
          ))}
        </div>
      )}
      {screen.sections.filter((s) => s.fields.length && (!s.tab || s.tab === tab)).map((s) => (
        <section key={s.logicalName} className="card">
          <h2>{s.displayName}</h2>
          <div className="fields">
            {s.fields.map((f) => (
              <label key={f.key} className={f.control === 'memo' ? 'wide' : ''}>
                <span>{f.label}{f.required && ' *'}</span>
                {editable && !f.readOnly ? <Input field={f} value={value(f)} disabled={saving} onChange={(v) => setDraft({ ...draft, [f.key]: v })} /> : <output>{fmt(value(f), f) || '—'}</output>}
              </label>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Input({ field, value, disabled, onChange }: { field: Field; value: unknown; disabled: boolean; onChange: (v: unknown) => void }) {
  if (field.options) {
    return (
      <select disabled={disabled} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">—</option>
        {field.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    );
  }
  if (field.control === 'memo') return <textarea disabled={disabled} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  if (['money', 'decimal', 'whole'].includes(field.control)) {
    return <input disabled={disabled} type="number" value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  }
  if (field.control === 'datetime') return <input disabled={disabled} type={field.format === 'DateOnly' || field.behavior === 'DateOnly' ? 'date' : 'datetime-local'} step="any" value={datetimeInputValue(value, field)} onChange={(e) => onChange(datetimePatch(e.target.value, field))} />;
  if (field.control === 'boolean') return <input disabled={disabled} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  return <input disabled={disabled} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}
