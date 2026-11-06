// Utente e ruoli. Con dati mock la persona si sceglie nell'header; sul sito reale si legge l'utente
// che Power Pages espone nella pagina (window.Microsoft.Dynamic365.Portal.User).
// Da verificare in stage R: nome della proprieta con i web role dell'utente e URL di accesso del provider configurato.
import { createContext, useContext } from 'react';
import { personas } from '../generated/screens';

export interface PortalUser {
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  contactId?: string;
  userRoles?: string[];
}

declare global {
  interface Window {
    Microsoft?: { Dynamic365?: { Portal?: { User?: PortalUser } } };
  }
}

export const isMock = import.meta.env.VITE_DATA_SOURCE === 'mock';
export const signInUrl = '/SignIn';

export function currentUser(): PortalUser | null {
  const user = window.Microsoft?.Dynamic365?.Portal?.User;
  return user?.userName ? user : null;
}

// Ruoli effettivi: anonymous, oppure authenticated piu i web role (logical name della POC).
export function currentRoles(persona: string): string[] {
  if (isMock) {
    if (persona === 'anonymous') return ['anonymous'];
    return persona === 'authenticated' ? ['authenticated'] : ['authenticated', persona];
  }
  const user = currentUser();
  if (!user) return ['anonymous'];
  const names = user.userRoles ?? [];
  return ['authenticated', ...personas.filter((p) => names.includes(p.displayName)).map((p) => p.logicalName)];
}

// Una pagina anonima e visibile a tutti; le altre richiedono authenticated o uno dei ruoli elencati.
export function canSee(access: string[], roles: string[]): boolean {
  return access.includes('anonymous') || access.some((a) => roles.includes(a));
}

// Privilegi della table permission per ruolo (calcolati dallo scaffold dal blocco powerPages della POC).
export function can(privileges: Record<string, string[]>, roles: string[], privilege: string): boolean {
  return roles.some((r) => privileges[r]?.includes(privilege));
}

export const RolesContext = createContext<string[]>(['anonymous']);
export const useRoles = () => useContext(RolesContext);
