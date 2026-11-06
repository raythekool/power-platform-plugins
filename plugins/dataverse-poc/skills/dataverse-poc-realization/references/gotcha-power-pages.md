# Gotcha — siti Power Pages SPA

Da leggere prima di uno stage R con `appType: power-pages`. Fonte: [Create and deploy a single-page application in Power Pages](https://learn.microsoft.com/power-pages/configure/create-code-sites) (GA gennaio 2026).

## Prerequisiti dell'ambiente

- PAC CLI 1.44 o successiva: `node <plugin-root>/scripts/check-prereqs.mjs --stage R --app-type power-pages`.
- Sito Power Pages 9.7.4.x o successivo, e privilegi di amministratore sul sito.
- L'ambiente deve consentire l'upload di file `.js`. Se `js` è fra le estensioni bloccate delle impostazioni di privacy e sicurezza, l'upload fallisce: va segnalato all'utente, non aggirato.

## Upload e attivazione

- `pac pages upload-code-site --rootPath <cartella>` legge `powerpages.config.json` (`siteName`, `compiledPath`, `defaultLandingPage`, `bundleFilePatterns`). I parametri da riga di comando prevalgono sul file.
- `bundleFilePatterns` cancella dai web file del sito i bundle che corrispondono ai pattern prima di caricare quelli nuovi. Se la build produce chunk con nomi nuovi, i pattern vanno aggiunti, altrimenti i vecchi file si accumulano.
- Al primo upload il sito risulta fra i **siti inattivi** e va riattivato. Gli upload successivi aggiornano il sito attivo.
- La Git integration di Power Platform non supporta i siti SPA. Il sorgente vive nel repository della POC; `pac pages download-code-site` serve solo per recupero o confronto.

## Web API e sicurezza

- Ogni tabella letta o scritta dal sito richiede i site setting `Webapi/<tabella>/enabled = true` e `Webapi/<tabella>/fields`. Quest'ultimo contiene i logical name delle colonne, separati da virgola e case-sensitive: lo scaffold li genera in `power-pages/site-settings.json`.
- Senza una table permission per il ruolo dell'utente, la Web API risponde con un errore anche se il site setting c'è. Il validator del prototipo anticipa il controllo, ma l'ambiente resta la verifica finale.
- Le scritture (`POST`, `PATCH`, `DELETE`) richiedono il token anti-CSRF (`/_layout/tokenhtml`, header `__RequestVerificationToken`). È già gestito in `src/data/webapi.ts`.
- I lookup arrivano dalla Web API come `_<colonna>_value`, e il mock usa invece il nome della colonna. Le pagine che li mostrano vanno adattate.
- Nell'SPA la sicurezza per pagina non esiste lato server: le route riservate si nascondono lato client leggendo i ruoli dell'utente. La protezione dei dati resta alle table permission.

## Utente, sviluppo locale, routing

- Utente corrente: `window.Microsoft.Dynamic365.Portal.User`. Il nome della proprietà con i web role e l'URL di accesso del provider configurato vanno verificati sul sito e allineati in `src/auth/user.ts`.
- La Web API non risponde su `localhost` senza l'autenticazione bearer di sviluppo (Entra ID v1, site setting `Authentication/BearerAuthentication/*`, proxy Vite). Per una POC si sviluppa sul mock (`npm run dev`) e si verifica sul sito caricato.
- Un refresh sul sito restituisce sempre la pagina radice e il router client rende la sotto-route: `BrowserRouter` funziona senza configurazioni server.
- Liquid, web template, workspace Pagine e Stile di Power Pages non si applicano ai siti SPA.
