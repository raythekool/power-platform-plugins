---
name: dataverse-poc-pipeline
description: "Gestisce scaffold, estrazione legacy HTML, validazione, build runtime/statico e report di copertura per POC Dataverse YAML. Use when: npm run validate/build, scaffold POC, legacy-html extraction, generated artifacts."
---

# Pipeline POC Dataverse

## Scopo

Questa skill gestisce la meccanica del prototipo: struttura cartelle, loader YAML, validator, generazione `poc-runtime.html`, `config/data/poc-data.js`, `dist/*.html` e report di copertura.

Non decide appType, datamodel o UX: esegue e valida quanto deciso dalle skill planner/schema/model-driven/code-app.

## Procedura

1. Se la POC non esiste, creare lo scaffold seguendo `../prototype-dataverse-app/references/scaffold.md`.
2. Se la POC deriva da HTML monolitico, usare la modalità `legacy-html` e anonimizzare i dati prima dell'estrazione; per modifiche puntuali a una POC solo HTML valutare la deroga `html-diretto`. Entrambe le procedure sono in `../prototype-dataverse-app/references/procedure.md`.
3. Non modificare mai a mano `poc-runtime.html`, `config/data/poc-data.js` o `dist/*.html`.
4. Eseguire `npm run validate:config`, `npm run validate:data`, poi `npm run build`.
5. Se il validator fallisce, correggere YAML o validator prima di rigenerare lo statico.
6. Eseguire `npm run test:smoke` (Playwright sull'HTML statico: navigazione, viste, form, badge di simulazione, errori console). Se la POC non ha lo script, aggiungerlo copiando `../prototype-dataverse-app/assets/smoke-test.mjs` in `scripts/` come descritto in `../prototype-dataverse-app/references/scaffold.md`.

## Output Atteso

- Comandi eseguiti e risultato.
- Artefatti generati.
- Errori o warning residui, distinti da diagnostiche markdown non pertinenti.
