---
name: dataverse-poc-planner
description: "Pianifica una POC Dataverse prima dello scaffold. Use when: scegliere appType model-driven, code-app o power-pages, delimitare requisiti, schermate, persone, percorso demo, scope e decisioni iniziali di un prototipo Dataverse. Non genera HTML."
---

# Pianificazione POC Dataverse

## Scopo

Questa skill governa la fase iniziale di una POC Dataverse: trasforma requisiti, minute o backlog in una decisione di target (`model-driven`, `code-app` o `power-pages`), inventario schermate, percorso demo e backlog di configurazione.

Non scrive renderer e non genera artefatti statici: produce le decisioni che le skill esecutive useranno dopo. Il documento di piano segue [dataverse-poc-plan-guide](../dataverse-poc-plan-guide/SKILL.md).

## Procedura

1. Leggere i requisiti e ricavare obiettivo della demo, attori, dati principali, schermate e percorso demo.
2. Decidere con l'utente `appType` usando i criteri già consolidati:
   - model-driven, quando la UI deriva da record, viste, moduli e processi Dataverse;
   - code app, quando serve una UI custom code-first per utenti interni;
   - power-pages, quando gli utenti sono esterni o anonimi (portale clienti, fornitori, cittadini, self-service).
3. Stabilire `naming.prefix`, nome applicazione, modalità (`requirements`, `legacy-html`, `html-diretto`) e cartella `<poc-root>`.
4. Produrre una tabella di schermate con: logical name, display name, scopo, attori, dataset principale, requisiti coperti, tipo pagina atteso.
5. Se `appType: model-driven`, classificare ogni schermata come dashboard, view, form o custom-page e indicare quali view aprono quali form. Se `appType: power-pages`, indicare per ogni schermata chi la vede (anonimo, autenticato, web role) e, per tabella, la table permission necessaria (scope e privilegi).
6. Se la richiesta e "una Sales Hub standard" o "una Customer Service Hub standard" (non un'app custom), verificare prima `../prototype-dataverse-app/references/standard-apps.md`: contiene il sitemap out-of-the-box gia mappato alle tabelle Dataverse standard. La baseline si applica a script con `poc-init.mjs --hub` o `poc-add-standard.mjs`, senza ricopiare YAML a mano.
7. Passare alla skill Dataverse schema prima di creare tabelle custom o campi custom.

## Output Atteso

- `appType` scelto e motivazione.
- Inventario schermate.
- Percorso demo.
- Decisioni aperte da chiedere all'utente.
- Parametri per lo scaffold (`--app-type`, `--prefix`, `--name`, `--root`, `--hub`) se la POC non esiste ancora.
- Indicazione della skill successiva: init, schema Dataverse, model-driven POC, code-app POC, power-pages POC o legacy extraction.
