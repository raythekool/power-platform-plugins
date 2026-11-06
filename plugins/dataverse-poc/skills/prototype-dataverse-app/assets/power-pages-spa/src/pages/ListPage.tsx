import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can, useRoles } from '../auth/user';
import { data, type Row } from '../data/adapter';
import { fmt } from '../data/format';
import { screens, type Screen } from '../generated/screens';
import Sections from './Sections';

export default function ListPage({ screen }: { screen: Screen }) {
  const roles = useRoles();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    data.list(screen).then(setRows, (e) => setError(String(e)));
  }, [screen]);
  const target = screen.target ? screens[screen.target] : undefined;

  return (
    <>
      <div className="head">
        <h1>{screen.displayName}</h1>
        <span className="grow" />
        {can(screen.privileges, roles, 'create') && <button className="primary">Nuovo</button>}
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
                  {screen.columns.map((c) => <td key={c.key}>{fmt(r[c.key], c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
