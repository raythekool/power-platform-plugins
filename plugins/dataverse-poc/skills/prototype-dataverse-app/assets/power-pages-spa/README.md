# __SITE_NAME__ — sito Power Pages (SPA React)

Progetto generato da `poc-spa-scaffold.mjs` (plugin dataverse-poc) dai YAML del prototipo. Funziona subito con i dati mock dei dataset della POC; nella build legge la Web API di Power Pages.

## Comandi

```powershell
npm install
npm run dev          # http://localhost:5173 con dati mock e persona scelta nell'header
npm run build        # dist/ per Power Pages (Web API)
npm run build:mock   # dist/ con dati mock, per una demo senza ambiente
pac pages upload-code-site --rootPath .   # stage R, legge powerpages.config.json
```

## Cosa si rigenera e cosa no

| Percorso | Proprietario |
| --- | --- |
| `src/generated/` (`screens.ts`, `model.ts`, `mock-data.json`) | Rigenerato da `poc-spa-scaffold.mjs` a ogni esecuzione: non modificare |
| `power-pages/` (`site-settings.json`, `table-permissions.json`, `web-roles.json`) | Rigenerato: è il contratto da applicare nell'ambiente |
| `src/pages/`, `src/data/`, `src/auth/`, `src/App.tsx`, stili, configurazione | Codice del progetto: lo scaffold li crea solo se mancano (`--force` per sovrascrivere) |

## Limiti noti del punto di partenza

- Lookup: il mock usa il nome della colonna, la Web API restituisce `_<colonna>_value`; adattare le pagine che li mostrano.
- Utente reale: `src/auth/user.ts` legge `window.Microsoft.Dynamic365.Portal.User`; nome della proprietà dei ruoli e URL di accesso vanno verificati sul sito.
- Nuovo record: il pulsante compare se la table permission concede `create`, il modulo va implementato.
