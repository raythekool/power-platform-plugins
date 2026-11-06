import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { can, useRoles } from '../auth/user';
import { data, type Row } from '../data/adapter';
import { fmt } from '../data/format';
import { screens, type Field, type Screen } from '../generated/screens';

export default function DetailPage({ screen }: { screen: Screen }) {
  const { key = '' } = useParams();
  const roles = useRoles();
  const [record, setRecord] = useState<Row | null | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState(screen.tabs[0]?.logicalName);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    data.get(screen, key).then(setRecord, (e) => setMessage(String(e)));
  }, [screen, key]);

  const editable = can(screen.privileges, roles, 'write');
  const parent = screen.parent ? screens[screen.parent] : undefined;
  const value = (f: Field) => (f.key in draft ? draft[f.key] : record?.[f.key]);
  const save = async () => {
    await data.update(screen, key, draft);
    setRecord({ ...record!, ...draft });
    setDraft({});
    setMessage('Modifiche salvate.');
  };

  if (record === undefined) return <p className="empty">{message ?? 'Caricamento…'}</p>;
  if (record === null) return <p className="empty">Record non trovato.</p>;
  const title = screen.primaryField ? fmt(record[screen.primaryField]) : screen.displayName;
  return (
    <>
      <div className="head">
        {parent && <Link className="button" to={parent.path}>← {parent.displayName}</Link>}
        <h1>{title || screen.displayName}</h1>
        <span className="grow" />
        {editable && <button className="primary" disabled={!Object.keys(draft).length} onClick={save}>Salva</button>}
      </div>
      {message && <p className="message">{message}</p>}
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
                {editable && !f.readOnly ? <Input field={f} value={value(f)} onChange={(v) => setDraft({ ...draft, [f.key]: v })} /> : <output>{fmt(value(f), f) || '—'}</output>}
              </label>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Input({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  if (field.options) {
    return (
      <select value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">—</option>
        {field.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    );
  }
  if (field.control === 'memo') return <textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  if (['money', 'decimal', 'whole'].includes(field.control)) {
    return <input type="number" value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  }
  if (field.control === 'datetime') return <input type="date" value={String(value ?? '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
  if (field.control === 'boolean') return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  return <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}
