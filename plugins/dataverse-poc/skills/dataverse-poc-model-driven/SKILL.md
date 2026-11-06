---
name: dataverse-poc-model-driven
description: "Crea o aggiorna una POC Dataverse model-driven. Use when: appType model-driven, Dynamics 365 CE chrome, site map, views, forms, dashboards, generative pages simulate, PCF simulate, mda-shell assets."
---

# POC Model-Driven Dataverse

## Scopo

Questa skill genera o aggiorna prototipi `appType: model-driven`: site map, dashboard, viste, form, schede di sessione, componenti simulati, generative page e PCF inseriti in punti specifici.

La shell Dynamics 365 CE (`mda-shell.*`) e il renderer generico arrivano dallo scaffold (`dataverse-poc-init` / `poc-init.mjs`). `<plugin-root>` e la cartella con `plugin.json`, due livelli sopra questa skill.

## Procedura

1. Verificare che `config/index.yaml` dichiari `appType: model-driven`.
2. Se la POC rappresenta una Sales Hub o Customer Service Hub standard, non disegnare aree, gruppi ed entita da zero: `node <plugin-root>/scripts/poc-add-standard.mjs --root <poc-root> --hub sales-hub|customer-service-hub` (o `--tables account,contact,...` per singole tabelle) copia navigazione e coppie view/form con il prefisso e genera dati sintetici. `../prototype-dataverse-app/references/standard-apps.md` resta la fonte narrativa e la matrice di copertura.
3. Caricare o creare il modello di navigazione: `pageType`, `navigation.areas`, `demoPath`, `targetForm` per le view.
4. Usare `dataverse-poc-schema` per completare `entity.dataverse.table/tables` e colonne prima di inventare custom.
5. Disegnare viste come griglie cliccabili che aprono form; non mettere form nella site map.
6. Simulare generative page e PCF solo come componenti con badge `Simulazione`, `simulation.note` e `enabled: false` per PCF, seguendo la procedura "simulare un componente" in `../prototype-dataverse-app/references/procedure.md`.
7. `npm run check -- --json` nella cartella POC: validator, build, copertura e smoke test su lista, form e componente simulato. Il renderer generico disegna tutto dai YAML (chiavi in `yaml-schema.md`): niente HTML o JavaScript di dominio.

## Regole

- Non usare questa skill per `appType: code-app`.
- Non creare generative page o PCF reali.
- Non modificare artefatti generati a mano.
- Lasciare sempre visibili i badge di simulazione sui componenti.
