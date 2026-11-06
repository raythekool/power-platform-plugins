---
name: dataverse-poc-init
description: "Setup (init) di una nuova POC Dataverse in pochi minuti: verifica dei requisiti della postazione, quattro domande (appType, prefisso, nome app, cartella), scaffold deterministico con poc-init, baseline Sales Hub o Customer Service Hub opzionale, piano della POC e primo npm run check. Use when: init, nuova POC, setup, scaffold, iniziare un prototipo Dataverse."
argument-hint: "Nome dell'app e, se noti, appType (model-driven, code-app o power-pages), prefisso e cartella"
---

# Init di una POC Dataverse

Procedura breve e quasi tutta a script. `<plugin-root>` e la cartella che contiene `plugin.json` (due livelli sopra questa skill). Tutorial completo per le persone: `docs/dataverse-poc/tutorial-init.md` del repository `raythekool/power-platform-plugins`.

## Passi

1. **Requisiti**: `node <plugin-root>/scripts/check-prereqs.mjs --stage P`. Se l'esito e diverso da 0, mostrare all'utente le righe `✖` con il comando di installazione e fermarsi.
2. **Domande** (una sola richiesta, a scelta dove possibile; non dedurre `appType`):
   - `appType`: `model-driven` (record, viste, moduli, D365), `code-app` (UI su misura per utenti interni) o `power-pages` (sito SPA React per utenti esterni o anonimi). Criteri in [tipi-di-app.md](../prototype-dataverse-app/references/tipi-di-app.md).
   - prefisso (`ava_`, `cli_`, ...: 2-8 minuscole + `_`), nome visibile dell'app, cartella (default `POC/<NomeApp>`).
   - solo model-driven: partire da una baseline `sales-hub`, `customer-service-hub` o nessuna.
   - iniziativa e cliente per il nome del piano (`POC/Piano_<Iniziativa>_<Cliente>.md`), oppure nessun piano.
3. **Scaffold**: `node <plugin-root>/scripts/poc-init.mjs --root <cartella> --app-type <tipo> --prefix <p_> --name "<nome>" [--hub <hub>] [--initiative <I> --client <C>] --json`. Lo script installa le dipendenze ed esegue `npm run check`.
4. **Esito**: riportare all'utente cartella, piano, passi `ok`/`KO` e il comando per vedere il prototipo (`npm run serve` oppure il file `dist/<app>.html`). Se un passo e `KO`, mostrare il dettaglio e il rimedio (tipicamente: rete per `npm install`, Edge/Chrome per lo smoke test).
5. **Prossimo passo**: proporre di descrivere requisiti e schermate all'agente **POC Dataverse**, che sostituira gli esempi dello scaffold. Con `power-pages` segnalare anche il progetto React generabile subito con `poc-spa-scaffold.mjs` (skill `dataverse-poc-power-pages`).

## Regole

- Nessun file scritto a mano in questa fase: se lo script non copre un caso, segnalarlo invece di improvvisare.
- Cartella non vuota: chiedere conferma prima di usare `--force`.
- Lo stage R (ambiente Dataverse) non fa parte dell'init: richiede `check-prereqs.mjs --stage R`, profili `pac`/`pacx` creati dall'utente e la conferma del target nel piano.
