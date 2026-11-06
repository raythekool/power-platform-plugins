// Sezioni non legate a un record: KPI statici o raggruppati sui record della pagina.
// Gli altri componenti del prototipo compaiono come segnaposto da implementare.
import type { Row } from '../data/adapter';
import { fmt } from '../data/format';
import type { Section } from '../generated/screens';

export default function Sections({ sections, rows = [] }: { sections: Section[]; rows?: Row[] }) {
  return (
    <>
      {sections.filter((s) => s.components.length).map((s) => (
        <section key={s.logicalName} className="card">
          <h2>{s.displayName}</h2>
          {s.components.map((c) => {
            if (c.items) return <Tiles key={c.logicalName} items={c.items} />;
            if (c.type === 'kpi' && c.groupBy) {
              const counts = new Map<string, number>();
              rows.forEach((r) => {
                const label = fmt(r[c.groupBy!], c.groupField) || '(vuoto)';
                counts.set(label, (counts.get(label) ?? 0) + 1);
              });
              return <Tiles key={c.logicalName} items={[...counts].map(([label, value]) => ({ label, value }))} />;
            }
            return <p key={c.logicalName} className="todo">Da implementare: {c.displayName} ({c.type})</p>;
          })}
        </section>
      ))}
    </>
  );
}

function Tiles({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="tiles">
      {items.map((t) => (
        <div key={t.label} className="tile"><b>{t.value}</b><span>{t.label}</span></div>
      ))}
    </div>
  );
}
