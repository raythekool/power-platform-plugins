---
name: dataverse-poc-realization
description: "Regole condivise per la gestione multi-agente di una POC Dataverse: stage gate prototipo/realizzazione/rilascio, contratto del brief e del report fra orchestratore e sotto-agenti, ownership degli artefatti, guardrail sull'ambiente target, gotcha verificati (PACX, PAC, AppMaker, generative pages). Use when: un sotto-agente poc-* riceve un brief, l'orchestratore deve delegare, si crea/modifica qualcosa in un ambiente Dataverse reale per una POC. Non usare per progetti di delivery reali."
user-invocable: false
---

# Realizzazione POC Dataverse — regole condivise

Questa skill è il contratto comune fra l'agente `POC Dataverse` e i sotto-agenti nascosti `poc-*`. Ogni sotto-agente la legge **prima** di agire.

## 1. Stage gate

| Stage | Cosa si produce | Dove | Gate di ingresso |
| --- | --- | --- | --- |
| **P — Prototipo** | YAML + HTML runtime/statico, componenti simulati | `<poc-root>/` nel repo | `appType` deciso |
| **R — Realizzazione DEV** | Metadata, dati demo, form/viste/app, generative page, PCF, web resource in un ambiente DEV/demo | Ambiente target + sorgenti nel repo | Prototipo validato **e** target ambiente confermato dall'utente |
| **D — Rilascio** | Export/import solution verso un altro ambiente, attivazione flow | Ambiente di destinazione | Conferma esplicita dell'utente per **ogni** rilascio |

Uno stage non si apre per inferenza: lo apre solo l'orchestratore, dopo conferma dell'utente. Un sotto-agente che riceve un brief di stage R/D senza target confermato restituisce `BLOCCATO`.

## 2. Target ambiente

Lo stato della POC vive nel **documento di piano** (es. `POC/Piano_<Iniziativa>_<Cliente>.md`): todo, decisioni, stato. Il piano contiene una tabella `🎯 Target ambiente` con:

| Chiave                   | Esempio                           |
| ------------------------ | --------------------------------- |
| URL ambiente             | `https://<org>.crm4.dynamics.com` |
| Profilo PAC              | nome profilo in `pac auth list`   |
| Profilo PACX             | nome profilo in `pacx auth list`  |
| Solution (unique name)   | `<cliente>demo`                   |
| Publisher prefix         | `ava`                             |
| App module (unique name) | se esiste                         |
| LCID etichette           | `1040`                            |
| Conferma utente stage R  | `sì, <data>` (letta da `poc-preflight.mjs`) |

Solo l'orchestratore aggiorna il piano. I sotto-agenti riportano nel report cosa è cambiato.

## 3. Guardrail (stage R e D)

1. **Preflight obbligatorio** prima di ogni scrittura: `poc-preflight.mjs` (sezione 7) verifica che `pac org who`, `pac auth list` e `pacx auth list` puntino all'URL del piano e che lo stage R sia confermato. Se non coincidono: fermarsi, non selezionare profili diversi per tentativi.
2. **Mai produzione** né ambienti cliente senza conferma esplicita riportata nel brief.
3. Ogni componente nasce **dentro la solution** del brief, con il prefisso del publisher.
4. Tabelle standard (`account`, `incident`, `email`, …): solo **aggiunta** di colonne prefissate; mai modificare colonne, form o viste standard esistenti; mai colonne obbligatorie.
5. **Nessuna cancellazione** (tabelle, colonne, record, componenti, solution) senza che il brief la autorizzi esplicitamente. In caso di dubbio: proporre il comando, non eseguirlo.
6. Dati **solo sintetici**, derivati dai dataset YAML già anonimizzati del prototipo.
7. Nessun segreto, client secret, connection id o token nel repo né nei report.
8. Preferire `pacx` a `pac` quando supporta l'operazione; `pac` solo dove `pacx` non arriva (es. `pac model genpage`, `pac pcf push`, `pac solution export/import`).
9. Dopo modifiche di metadata: `pacx publish all` (o publish mirato) prima di dichiarare il lavoro concluso.
10. Etichette nella lingua del target (LCID del brief, es. `1040` per l'italiano) oltre all'inglese dove la piattaforma lo richiede.
11. I componenti simulati restano dichiarati come tali: non portare `pcf.enabled: true` nel prototipo finché non esiste un bundle reale importato e verificato.

Il plugin installa un hook `PreToolUse` ([hooks.json](../../hooks.json), script [poc-guard.cjs](../../scripts/poc-guard.cjs)) che impone una conferma dell'utente prima di comandi PAC/PACX che cancellano, cambiano profilo o ambiente, puntano a un URL esplicito o importano solution, e prima di strumenti MCP Dataverse di cancellazione. Se la conferma viene negata, il sotto-agente restituisce `BLOCCATO`: non cerca vie alternative.

## 4. Ownership degli artefatti

Due sotto-agenti non lavorano in parallelo sullo stesso artefatto.

| Sotto-agente | Possiede (repo) | Possiede (ambiente) |
| --- | --- | --- |
| `poc-datamodel` | blocchi `dataverse` in `config/entities/*.yaml`, `config/data/_schema.yaml` | tabelle, colonne, choice, relazioni, chiavi |
| `poc-demo-data` | `config/data/*.yaml` (dataset) | record demo |
| `poc-prototype-builder` | resto di `config/`, `app/`, `scripts/`, `README.md` della POC | — |
| `poc-forms-views` | — (eventuali export in `<poc-root>/realization/forms-views/`) | form, viste, app module, sitemap |
| `poc-genpage` | `<poc-root>/realization/genpages/` (o la cartella indicata nel piano) | generative page |
| `poc-pcf` | `<poc-root>/realization/pcf/<Control>/` | PCF e relativi componenti di solution |
| `poc-webresources` | `<poc-root>/realization/webresources/` | web resource, comandi ribbon |
| `poc-code-app` | `<poc-root>/realization/code-app/` | code app pubblicata |
| `poc-tester` | `<poc-root>/realization/test-reports/` | sola lettura |
| `poc-deployer` | `<poc-root>/realization/solutions/` (zip esportati, se richiesti) | solution, publish, import/export, flow |

Ordine di dipendenza tipico in stage R (model-driven): `poc-deployer` (preflight + solution) → `poc-datamodel` → `poc-demo-data` ∥ `poc-forms-views` ∥ `poc-webresources` ∥ `poc-pcf` → `poc-genpage` (una istanza per pagina, in parallelo) → `poc-forms-views` (sitemap finale) → `poc-tester` → `poc-deployer` (publish/export).

In stage R con `appType: code-app`: `poc-deployer` → `poc-datamodel` → `poc-demo-data` ∥ `poc-code-app` → `poc-tester` → `poc-deployer`.

## 5. Contratto del brief (orchestratore → sotto-agente)

L'orchestratore passa sempre un brief autosufficiente: i sotto-agenti non vedono la conversazione.

```text
STAGE: P | R | D
POC_ROOT: <percorso>
PIANO: <percorso del documento di piano>
TARGET: <url> · solution <unique name> · prefix <prefix> · LCID <lcid> · conferma utente: <sì, data>
OBIETTIVO: <una frase>
SCOPE: <elenco puntuale: tabelle/campi/pagine/controlli/file>
FUORI SCOPE: <cosa non toccare>
INPUT: <file YAML, requisiti RF/RNF, decisioni già prese>
AUTORIZZAZIONI SPECIALI: <es. cancellazione X autorizzata | nessuna>
CRITERI DI DONE: <verifiche attese>
```

## 6. Contratto del report (sotto-agente → orchestratore)

Ogni sotto-agente chiude con questo blocco e nient'altro di prolisso:

```text
ESITO: COMPLETATO | PARZIALE | BLOCCATO
FATTO: <elenco puntuale di cosa è stato creato/modificato, con logical name>
FILE TOCCATI: <percorsi>
AMBIENTE: <componenti creati/aggiornati, solution di appartenenza, publish sì/no>
VERIFICHE: <comandi eseguiti e risultato>
DECISIONI APERTE: <domande da girare all'utente, con opzione raccomandata>
RISCHI/DEBITI: <cosa resta simulato, non verificato o da pulire>
```

`BLOCCATO` è un esito legittimo: meglio fermarsi che improvvisare su ambiente, scope o cancellazioni.

## 7. Script deterministici (prima degli strumenti AI)

Il lavoro meccanico lo fanno script Node senza dipendenze, nella cartella `scripts/` del plugin (`<plugin-root>`, la cartella con `plugin.json`, due livelli sopra questa skill). Usarli sempre al posto di ragionamenti o comandi composti a mano: sono piu veloci, ripetibili e consumano meno contesto. Tutti accettano `--json` per un output compatto.

| Bisogno | Comando |
| --- | --- |
| Requisiti della postazione | `node <plugin-root>/scripts/check-prereqs.mjs --stage P\|R` |
| Scaffold di una POC nuova | `node <plugin-root>/scripts/poc-init.mjs --root <dir> --app-type <tipo> --prefix <p_> --name "<nome>"` |
| Baseline Sales Hub / Customer Service Hub o tabelle standard | `node <plugin-root>/scripts/poc-add-standard.mjs --root <dir> --hub sales-hub` |
| Preflight stage R/D (sostituisce `pac org who` + confronto manuale) | `node <plugin-root>/scripts/poc-preflight.mjs --plan <piano> --json` |
| Verifica dello zip esportato (versione, componenti, generative page) | `node <plugin-root>/scripts/poc-solution-zip.mjs <zip> --pages <id,...> --json` |
| Validator, build, copertura, smoke test del prototipo | `npm run check -- --json` nella cartella POC |

Esito del preflight diverso da 0: fermarsi e restituire `BLOCCATO` con l'output dello script.

## 8. Gotcha verificati

Leggere solo il file pertinente al brief:

- [gotcha-ambiente.md](references/gotcha-ambiente.md): terminale, PAC/PACX, choice e sitemap Dataverse, strumenti MCP nei sotto-agenti.
- [gotcha-genpage.md](references/gotcha-genpage.md): generative page, solution `uxagentproject`, export e URL diretti.
