---
name: dataverse-poc-schema
description: "Disegna lo schema Dataverse di una POC. Use when: scegliere fra tabelle standard D365/Dataverse e custom, recuperare campi da Microsoft Learn, dichiarare entity.dataverse.table/tables e columns nei file YAML del prototipo."
---

# Schema Dataverse per POC

## Scopo

Questa skill decide quali tabelle e colonne Dataverse la POC rappresenta. Prima di proporre custom, controlla Microsoft Learn via MCP per verificare se esistono tabelle standard adatte (`account`, `contact`, `incident`, `opportunity`, `email`, ecc.). Per le tabelle gia coperte dalla baseline Sales Hub / Customer Service Hub, `../prototype-dataverse-app/assets/standard-entities/` ha gia la coppia view/form pronta (`source: standard`, `sourceUrl`, `reuseDecision` compilati): copiarla invece di ricostruirla da zero.

La skill non crea tabelle reali e non usa PAC/PACX: arricchisce i file `config/entities/*.yaml` con metadata abbastanza precisi per una futura implementazione.

## Procedura

1. Per ogni concetto dati principale, cercare su Microsoft Learn la tabella standard candidata.
2. Se lo standard copre il bisogno, usare `source: standard`, valorizzare `sourceUrl` e recuperare campi standard pertinenti.
3. Se serve estendere una tabella standard, lasciare `entity.dataverse.table.source: standard` e dichiarare i campi aggiuntivi con `fields[].dataverse.source: custom` o `entity.dataverse.columns[].source: custom`.
4. Creare una tabella custom solo dopo aver documentato `reuseDecision.checkedStandardTables` e `reuseDecision.reason`.
5. Per ogni colonna, dichiarare tipo, required level, source, formato e vincoli applicabili: option set con `{value,label}`, lookup targets, datetime format/behavior, limiti numerici, precisione, maxLength.
6. Validare con `npm run validate:config` quando il prototipo dispone di validator.

## Contratti YAML

Seguire i contratti già definiti in `../prototype-dataverse-app/references/dataverse-schema.md` e `../prototype-dataverse-app/references/yaml-schema.md`.

## Output Atteso

- Decisione standard/custom per ogni tabella.
- Campi standard riusati con URL Microsoft Learn.
- Campi custom con dettagli di creazione.
- Elenco finale: standard riusato, standard esteso, custom nuovo.
