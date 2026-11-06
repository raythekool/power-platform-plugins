---
name: dataverse-poc-power-pages
description: "Crea o aggiorna una POC Dataverse power-pages: sito Power Pages SPA in React per utenti esterni o anonimi. Use when: appType power-pages, portale clienti o fornitori, self-service, sito pubblico su Dataverse, web role, table permission, persone anonimo/autenticato, passaggio rapido al progetto React (poc-spa-scaffold)."
---

# POC Power Pages SPA

## Scopo

Questa skill gestisce i prototipi `appType: power-pages`, cioè un sito Power Pages a pagina singola (SPA, React) su Dataverse, rivolto a utenti esterni o anonimi.

Il prototipo resta HTML/YAML come per gli altri tipi. Il renderer generico disegna la shell del sito: menu in alto, persona simulata (anonimo, autenticato, web role), pagine riservate, table permission in evidenza. Dagli stessi YAML lo script `poc-spa-scaffold.mjs` genera il progetto React + Vite, con dati mock, da cui parte lo stage R.

`<plugin-root>` è la cartella che contiene `plugin.json` (due livelli sopra questa skill).

## Procedura

1. Verificare che `config/index.yaml` dichiari `appType: power-pages` (POC nuova: skill `dataverse-poc-init`).
2. Persone e sicurezza nel blocco `powerPages` di `config/index.yaml`:
   - `webRoles`; `anonymous` e `authenticated` sono impliciti;
   - `tablePermissions` con `table`, `scope` (`global`, `contact`, `account`, `self`, `parent`), `privileges` e `roles`;
   - `demoPersona` e, se serve, `navigation`.
   
   Schema in [yaml-schema.md](../prototype-dataverse-app/references/yaml-schema.md).
3. Per ogni schermata:
   - `entity.access`: `anonymous`, `authenticated` o `[ruoli]`; il default è `authenticated`;
   - con una tabella Dataverse, `dataverse.table.entitySetName` (nome della Web API);
   - home e pagine informative senza `dataset`, con `hero: {title, text}` e componenti statici.
4. Elenchi con `dataset` e `targetForm`, dettagli a schede: come nella code app. Niente `pageType`, `navigation` top-level, `type: pcf` o `type: generative-page`.
5. `npm run check -- --json` nella cartella POC. Il validator blocca le schermate che un ruolo vede senza una table permission con `read`, e i dettagli modificabili senza `write`. Lo smoke test percorre il sito con ogni persona.
6. **Passaggio all'implementazione**, appena il check è verde e anche prima dello stage R: `node <plugin-root>/scripts/poc-spa-scaffold.mjs --root <poc-root> --build --json`.
   
   Crea `<poc-root>/realization/power-pages/`, un progetto React + Vite + TypeScript che funziona subito sui dataset YAML. Rigenera a ogni esecuzione `src/generated/` (route, colonne, tipi, mock) e `power-pages/` (site setting `Webapi/*`, web role, table permission). Non sovrascrive il codice già scritto in `src/pages/`, `src/data/` e `src/auth/`.

## Regole

- Le pagine anonime le vedono anche gli utenti autenticati: servono table permission per entrambi.
- Dati sensibili mai in pagine `anonymous`. Lo scope `global` va usato solo per dati pubblici o di riferimento.
- Il sito è solo SPA: Liquid, web template e lo studio di design di Power Pages sono fuori scopo.
- Non scrivere a mano `src/generated/` né `power-pages/*.json`: si cambiano i YAML e si rilancia lo scaffold.
- La realizzazione in ambiente spetta a `poc-power-pages` (stage R, dopo conferma). I gotcha sono in [gotcha-power-pages.md](../dataverse-poc-realization/references/gotcha-power-pages.md).
