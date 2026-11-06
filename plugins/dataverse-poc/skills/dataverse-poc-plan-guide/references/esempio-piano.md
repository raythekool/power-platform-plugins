# Piano POC — Portale Assistenza

> POC power-pages con prefisso `ava_`: portale in cui i clienti di Contoso aprono e seguono le richieste di assistenza. Prototipo in `PortaleAssistenza`. Stato aggiornato solo dall'orchestratore.

## 📑 Indice

- [🎯 Target ambiente](#-target-ambiente)
- [🧭 Decisioni](#-decisioni)
- [🖥️ Schermate](#️-schermate)
- [🧱 Modello dati](#-modello-dati)
- [🌊 Ondate](#-ondate)
- [📋 Todo](#-todo)
- [⚠️ Rischi e simulato](#️-rischi-e-simulato)
- [🔁 Recap](#-recap)

## 🎯 Target ambiente

| Chiave | Valore |
| --- | --- |
| URL ambiente | da confermare |
| Profilo PAC | da confermare |
| Profilo PACX | da confermare |
| Solution (unique name) | da confermare |
| Publisher prefix | ava |
| Sito Power Pages (nome) | da confermare |
| URL sito | da confermare |
| LCID etichette | 1040 |
| Conferma utente stage R | no |

## 🧭 Decisioni

| Decisione | Valore | Fonte |
| --- | --- | --- |
| appType | power-pages | utente |
| Prefisso | ava_ | utente |
| Stage finale | R | utente |
| Persone | anonimo, Cliente | requisiti RF-001..RF-004 |
| Richiesta | tabella standard `incident` estesa | Microsoft Learn (incident) |

## 🖥️ Schermate

| Schermata | Tipo | Dataset | Accesso | Requisiti |
| --- | --- | --- | --- | --- |
| `ava_home` | pagina | — | anonymous | RF-001 |
| `ava_casi_elenco` | elenco | `ava_casi` | Cliente | RF-002 |
| `ava_caso_dettaglio` | dettaglio | `ava_casi` | Cliente | RF-003 |

## 🧱 Modello dati

| Tabella | Scelta | Colonne nuove | Table permission |
| --- | --- | --- | --- |
| `incident` | standard estesa | `ava_canale` (choice) | Cliente · contact · read, create, write |

## 🌊 Ondate

| Ondata | Sotto-agenti | Input | Output | Done |
| --- | --- | --- | --- | --- |
| 1 · Schema (P) | poc-datamodel | requisiti, `config/` | blocchi `dataverse` con `entitySetName: incidents` | `npm run validate:config` ok |
| 2 · Prototipo (P) | poc-prototype-builder ∥ poc-demo-data | ondata 1 | schermate, persone, permessi, dataset | `npm run check` ok, 0 scoperti |
| 3 · SPA su mock (P) | poc-power-pages | ondata 2 | `realization/power-pages/` | `npm run build` ok |
| 4 · Base ambiente (R) | poc-deployer → poc-datamodel | conferma stage R | solution, colonna `ava_canale` | preflight 0, publish |
| 5 · Sito (R) | poc-demo-data ∥ poc-power-pages | ondata 4 | record, site setting, ruolo, permesso, upload | URL del sito nel report |
| 6 · Verifica (R) | poc-tester | URL sito, persone | report per persona | percorso demo verde per anonimo e Cliente |

## 📋 Todo

- [ ] Ondata 1 · poc-datamodel: estensione di `incident`, verifica Learn
- [ ] Ondata 2 · poc-prototype-builder: tre schermate e blocco `powerPages`
- [ ] Ondata 2 · poc-demo-data: 8 casi sintetici
- [ ] Ondata 3 · poc-power-pages: scaffold e pagine su mock
- [ ] Gate stage R: conferma utente su ambiente, solution, sito

## ⚠️ Rischi e simulato

- Accesso: nel prototipo e su mock la persona si sceglie da menu; il provider di identità si configura in stage R.
- Upload `.js` da verificare nelle impostazioni dell'ambiente prima dell'ondata 5.

## 🔁 Recap

- Scaffold creato con poc-init; ondate 1-3 pianificate.
