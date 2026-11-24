import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { can, useRoles } from '../auth/user';
import { data, type Row } from '../data/adapter';
import { fmt } from '../data/format';
import { screens, type Screen } from '../generated/screens';
import { NEW_KEY } from './DetailPage';
import Sections from './Sections';

export default function ListPage({ screen }: { screen: Screen }) {
  const roles = useRoles();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => data.list(screen).then(setRows, (e) => setError(String(e)));
    load();
    // Simulazione condivisa: la lista si aggiorna con le modifiche fatte altrove (altre finestre, back-office).
    return data.subscribe?.((event) => { if (event.type === 'reset' || event.dataset === screen.dataset) load(); });
  }, [screen]);
  const target = screen.target ? screens[screen.target] : undefined;
  const primaryColumn = screen.columns.find((c) => c.key === screen.primaryField) ?? screen.columns[0];

  return (
    <>
      <div className="head">
        <h1>{screen.displayName}</h1>
        <span className="grow" />
        {can(screen.privileges, roles, 'create') && (
          <button className="primary" onClick={() => target && data.create && navigate(`${target.path}/${NEW_KEY}`)}>Nuovo</button>
        )}
      </div>
      <Sections sections={screen.sections} rows={rows ?? []} />
      {error ? (
        <p className="error">{error}</p>
      ) : !rows ? (
        <p className="empty">Caricamento…</p>
      ) : !rows.length ? (
        <p className="empty">Nessun record.</p>
      ) : (
        <div className="card table">
          <table>
            <thead>
              <tr>{screen.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.__key} className={target ? 'clickable' : ''} onClick={() => target && navigate(`${target.path}/${encodeURIComponent(r.__key)}`)}>
                  {screen.columns.map((c) => (
                    <td key={c.key}>
                      {target && c === primaryColumn ? (
                        <Link to={`${target.path}/${encodeURIComponent(r.__key)}`} onClick={(e) => e.stopPropagation()}>{fmt(r[c.key], c) || r.__key}</Link>
                      ) : fmt(r[c.key], c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
