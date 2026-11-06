---
name: prototype-dataverse-app
description: "Riferimenti e asset condivisi per i prototipi HTML/YAML di app Dataverse: tipi di app (model-driven, code-app, power-pages), schema YAML, contratto Dataverse di tabelle e colonne, componenti simulati (PCF, generative page), chrome Dynamics 365 CE (mda-shell), Sales Hub e Customer Service Hub standard, scaffold, procedure legacy-html e html-diretto. Use when: serve una regola o un asset del prototipo; per creare o aggiornare una POC usare l'agent POC Dataverse o le skill dataverse-poc-*."
user-invocable: false
---

# Prototipo di applicazione Dataverse — riferimenti condivisi

Questa skill non è più un punto di ingresso: contiene le regole e gli asset comuni a cui rimandano le skill `dataverse-poc-*` e i sotto-agenti `poc-*`. Per creare o modificare una POC si passa dall'agent `POC Dataverse`.

| Fase | Skill |
| --- | --- |
| Setup di una POC nuova (requisiti, scaffold, primo check) | `dataverse-poc-init` |
| Scelta appType, scope e percorso demo | `dataverse-poc-planner` |
| Riuso standard/custom e metadata Dataverse | `dataverse-poc-schema` |
| UI model-driven, chrome D365, generative page e PCF simulati | `dataverse-poc-model-driven` |
| UI code app custom | `dataverse-poc-code-app` |
| Sito Power Pages SPA (persone, web role, table permission, progetto React) | `dataverse-poc-power-pages` |
| Struttura del piano, ondate, criteri di done | `dataverse-poc-plan-guide` |
| Scaffold, validator, build, smoke test e report | `dataverse-poc-pipeline` |
| Realizzazione in ambiente, contratto multi-agente | `dataverse-poc-realization` |

## Principi

- L'HTML è solo una shell di presentazione: tutto ciò che è configurabile vive in YAML, in quattro layer: entità (UI + contratto Dataverse) in `config/entities/`, dati demo in `config/data/`, componenti in `config/components/`, artefatti generati (`poc-runtime.html`, `dist/*.html`).
- Prima decisione: `appType` (`model-driven`, `code-app` o `power-pages`), da dichiarare in `config/index.yaml` e mai da dedurre. Generative page e PCF sono componenti di una model-driven, non tipi di app.
- Nomi tecnici con il prefisso `naming.prefix`, minuscoli e underscore; il testo visibile usa sempre `displayName`. I logical name della POC non attestano l'esistenza di tabelle reali: quelli reali stanno nei blocchi `dataverse`.
- Riuso prima di creazione: prima di proporre una tabella o colonna custom, verificare su Microsoft Learn lo standard candidato e documentare `reuseDecision`.
- I componenti Power Platform si **simulano**, sempre con contrassegno visibile, dati sintetici e interazioni apparenti; `pcf.enabled: false` finché non esiste un bundle reale.

| `type` componente | Cosa rappresenta | `appType` |
| --- | --- | --- |
| `kpi`, `bpf`, `timeline`, `subgrid` | Riquadro di sintesi, business process flow, cronologia, elenco correlato | tutti |
| `generative-page` | Pagina generativa dentro una model-driven | solo `model-driven` |
| `pcf` | Controllo che sostituirà un campo o una griglia | solo `model-driven` |

## Struttura di una POC

Generata da `scripts/poc-init.mjs` del plugin: dettaglio in [scaffold.md](references/scaffold.md). Si modificano solo i YAML in `config/` (piu `app/custom.*` se serve); script, renderer e artefatti generati arrivano dal plugin o dalla build.

## Riferimenti

- [tipi-di-app.md](references/tipi-di-app.md): model-driven vs code app, cosa può ospitare ciascuna. **Da leggere per primo.**
- [procedure.md](references/procedure.md): modalità `requirements` / `legacy-html` / `html-diretto`, componenti locali vs riusabili, simulazione di un componente, aggiornamenti, comandi, verifica, regole di sicurezza.
- [yaml-schema.md](references/yaml-schema.md): schema dei layer YAML e regole di validazione.
- [dataverse-schema.md](references/dataverse-schema.md): standard vs custom e metadata di tabelle e colonne.
- [requisiti-to-poc.md](references/requisiti-to-poc.md): da requisiti a schermate, dati demo e copertura.
- [scaffold.md](references/scaffold.md): scaffold, validator e script npm in un contesto nuovo.
- [componenti-simulati.md](references/componenti-simulati.md): resa di generative page e PCF simulati.
- [dynamics-365-chrome.md](references/dynamics-365-chrome.md): site map, sessioni, viste e moduli in stile D365 CE (solo model-driven).
- [standard-apps.md](references/standard-apps.md): site map standard di Sales Hub e Customer Service Hub.

## Asset

- `assets/poc-template/`: pipeline (`scripts/`: validator, build runtime/statico, copertura, check, server) e renderer generico (`app/poc-app.js`, `app/poc-app.css`), copiati da `poc-init.mjs`.
- `assets/mda-shell.css`, `assets/mda-shell.js`: shell model-driven composta dal renderer, copiata solo con `appType: model-driven`.
- `assets/standard-navigation/`, `assets/standard-entities/`: blocco `navigation` e coppie view/form per Sales Hub e Customer Service Hub; si applicano con `scripts/poc-add-standard.mjs`, che sostituisce `{{prefix}}` e genera i dati sintetici.
- `assets/smoke-test.mjs`: smoke test Playwright per `npm run test:smoke`.
- `assets/power-pages-spa/`: template React + Vite del sito Power Pages, copiato e completato da `scripts/poc-spa-scaffold.mjs`.
