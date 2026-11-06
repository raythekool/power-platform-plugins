---
name: dataverse-poc-pipeline
description: "Scaffold, validazione, build runtime/statico, copertura requisiti e smoke test di una POC Dataverse YAML, tutto con script pronti del plugin. Use when: creare una POC (poc-init), npm run check/build/validate, aggiungere la baseline Sales Hub o Customer Service Hub, artefatti generati, report di copertura."
---

# Pipeline POC Dataverse

## Scopo

La meccanica del prototipo e interamente a script: nessun validator, renderer o build va scritto a mano. Questa skill dice quale script lanciare; le decisioni (appType, schema, UX) restano alle skill planner/schema/model-driven/code-app.

`<plugin-root>` e la cartella che contiene `plugin.json` (due livelli sopra questa skill).

## Procedura

1. **POC nuova**: `node <plugin-root>/scripts/poc-init.mjs --root <poc-root> --app-type <model-driven|code-app> --prefix <p_> --name "<nome app>" [--hub sales-hub|customer-service-hub] [--initiative <I> --client <C>]`. Crea struttura, script, renderer, esempi, `package.json`, piano (con `--initiative/--client` o `--plan`), esegue `npm install` e `npm run check`. `appType` e prefisso vanno chiesti all'utente prima.
2. **Baseline standard** su una POC esistente: `node <plugin-root>/scripts/poc-add-standard.mjs --root <poc-root> --hub sales-hub` (oppure `--tables account,contact`). Copia viste e form, aggiorna `config/index.yaml` e genera dati demo sintetici.
3. **Modifiche**: si toccano solo i YAML in `config/` (e, se serve, `app/custom.css` / `app/custom.js`). Mai a mano `poc-runtime.html`, `config/poc-config.js`, `config/data/poc-data.js`, `dist/`, `scripts/`, `app/poc-app.*`, `app/mda-shell.*`.
4. **Verifica**: `npm run check -- --json` nella cartella POC. Esegue in ordine validator config, validator dati, runtime, statico + copertura, smoke test Playwright, e si ferma al primo passo fallito. Correggere gli errori nei YAML, non negli script.
5. Passi singoli quando serve: `npm run validate:config`, `npm run validate:data`, `npm run build`, `npm run test:smoke`, `npm run serve` (runtime su `http://127.0.0.1:8080/poc-runtime.html`).
6. **POC esistente con script vecchi o scritti a mano**: `node <plugin-root>/scripts/poc-init.mjs --root <poc-root> --update` aggiorna `scripts/`, `app/poc-app.*`, `app/mda-shell.*` e gli script npm senza toccare `config/`. Se la POC usava un renderer di dominio, spostarne le parti specifiche in `app/custom.js` con `PocApp.registerComponent`.

La modalita `legacy-html` (estrazione da HTML monolitico) e la deroga `html-diretto` restano procedure guidate: vedi [procedure.md](../prototype-dataverse-app/references/procedure.md).

## Output atteso

- Esito JSON di `npm run check` (passi, errori, avvisi, copertura, requisiti scoperti).
- Artefatti: `dist/<app>.html`, `dist/requirements-coverage.md`.
- Avvisi residui distinti dagli errori.
