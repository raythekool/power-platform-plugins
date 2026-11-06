// Shell del sito: menu, persona (solo con dati mock), route generate da src/generated/screens.ts.
// Le route si rigenerano con poc-spa-scaffold.mjs; questo file e le pagine sono codice del progetto.
// Su Power Pages un refresh restituisce sempre la pagina radice e il router client rende la sotto-route.
import { useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { canSee, currentRoles, currentUser, isMock, RolesContext, signInUrl, useRoles } from './auth/user';
import { demoPersona, home, navigation, personas, screens, site } from './generated/screens';
import DetailPage from './pages/DetailPage';
import HomePage from './pages/HomePage';
import ListPage from './pages/ListPage';

function ScreenRoute({ ln }: { ln: string }) {
  const screen = screens[ln];
  const roles = useRoles();
  if (!canSee(screen.access, roles)) {
    return (
      <div className="denied">
        <h1>{screen.displayName}</h1>
        {roles.includes('anonymous') ? (
          <p>Accedi per continuare: la pagina è riservata agli utenti autenticati. {isMock ? 'Scegli una persona autenticata in alto.' : <a href={signInUrl}>Accedi</a>}</p>
        ) : (
          <p>Il tuo profilo non ha accesso a questa pagina.</p>
        )}
      </div>
    );
  }
  if (screen.kind === 'list') return <ListPage key={ln} screen={screen} />;
  if (screen.kind === 'detail') return <DetailPage key={ln} screen={screen} />;
  return <HomePage key={ln} screen={screen} />;
}

export default function App() {
  const [persona, setPersona] = useState(demoPersona);
  const roles = currentRoles(persona);
  const user = currentUser();
  return (
    <RolesContext.Provider value={roles}>
      <BrowserRouter>
        <div className="site">
          <header className="top">
            <Link to="/" className="brand">{site.name}</Link>
            <nav>
              {navigation.map((ln) => (
                <NavLink key={ln} to={screens[ln].path}>{screens[ln].displayName}</NavLink>
              ))}
            </nav>
            <span className="grow" />
            {isMock ? (
              <select aria-label="Persona simulata" value={persona} onChange={(e) => setPersona(e.target.value)}>
                {personas.map((p) => <option key={p.logicalName} value={p.logicalName}>{p.displayName}</option>)}
              </select>
            ) : user ? (
              <span className="user">{user.firstName ?? user.userName}</span>
            ) : (
              <a className="button" href={signInUrl}>Accedi</a>
            )}
          </header>
          {isMock && <div className="banner">Dati mock dai dataset YAML della POC. Nella build il sito legge la Web API di Power Pages.</div>}
          <main>
            <Routes>
              <Route path="/" element={<ScreenRoute ln={home} />} />
              {Object.values(screens).map((s) => (
                <Route key={s.logicalName} path={s.kind === 'detail' ? `${s.path}/:key` : s.path} element={<ScreenRoute ln={s.logicalName} />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer>{site.name}</footer>
        </div>
      </BrowserRouter>
    </RolesContext.Provider>
  );
}
