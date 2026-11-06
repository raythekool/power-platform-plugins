---
name: dataverse-poc-model-driven
description: "Crea o aggiorna una POC Dataverse model-driven. Use when: appType model-driven, Dynamics 365 CE chrome, site map, views, forms, dashboards, generative pages simulate, PCF simulate, mda-shell assets."
---

# POC Model-Driven Dataverse

## Scopo

Questa skill genera o aggiorna prototipi `appType: model-driven`: site map, dashboard, viste, form, schede di sessione, componenti simulati, generative page e PCF inseriti in punti specifici.

Usa gli asset `../prototype-dataverse-app/assets/mda-shell.css` e `../prototype-dataverse-app/assets/mda-shell.js` come shell di riferimento quando serve fedeltà Dynamics 365 CE.

## Procedura

1. Verificare che `config/index.yaml` dichiari `appType: model-driven`.
2. Se la POC rappresenta una Sales Hub o Customer Service Hub standard, partire dagli asset pronti in `../prototype-dataverse-app/assets/standard-navigation/` (blocco `navigation`) e `../prototype-dataverse-app/assets/standard-entities/` (coppie view/form) invece di disegnare aree, gruppi ed entita da zero; `../prototype-dataverse-app/references/standard-apps.md` resta la fonte narrativa e la matrice di copertura.
3. Caricare o creare il modello di navigazione: `pageType`, `navigation.areas`, `demoPath`, `targetForm` per le view.
4. Usare `dataverse-poc-schema` per completare `entity.dataverse.table/tables` e colonne prima di inventare custom.
5. Disegnare viste come griglie cliccabili che aprono form; non mettere form nella site map.
6. Simulare generative page e PCF solo come componenti con badge `Simulazione`, `simulation.note` e `enabled: false` per PCF, seguendo la procedura "simulare un componente" in `../prototype-dataverse-app/references/procedure.md`.
7. Rigenerare runtime/statico e fare smoke test su lista, form, subgrid e componente simulato.

## Regole

- Non usare questa skill per `appType: code-app`.
- Non creare generative page o PCF reali.
- Non modificare artefatti generati a mano.
- Lasciare sempre visibili i badge di simulazione sui componenti.
