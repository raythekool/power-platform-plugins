---
name: dataverse-poc-plan-guide
description: "Direttive per qualsiasi agente che scrive o rivede il piano di una POC Dataverse (model-driven, code app, Power Pages SPA): domande iniziali, struttura obbligatoria del documento, ondate parallele di sotto-agenti, criteri di done verificabili da comando, regole per arrivare all'implementazione con il minimo di turni e token. Use when: piano POC Dataverse, pianificare una POC, plan, roadmap POC, brief ai sotto-agenti, ondate, criteri di done, rivedere un piano POC."
---

# Piano ottimizzato per una POC Dataverse

Queste direttive valgono per ogni agente che pianifica una POC Dataverse: l'agente **POC Dataverse**, un agente Plan, una skill di scrittura piani o un assistente generico. Il piano serve a una cosa sola: **arrivare all'implementazione con il minimo di turni, token e rilavorazioni**. Il piano non racconta: decide, assegna e definisce quando un passo è finito.

`<plugin-root>` è la cartella che contiene `plugin.json` (due livelli sopra questa skill).

## 1. Prima di scrivere: una sola richiesta di chiarimento

Raccogli in **un'unica domanda a scelta multipla** tutto ciò che manca. Non chiedere a rate, e non dedurre ciò che decide l'utente.

| Dato | Quando serve | Note |
| --- | --- | --- |
| `appType` | sempre | `model-driven`, `code-app` o `power-pages`: criteri in [tipi-di-app.md](../prototype-dataverse-app/references/tipi-di-app.md). **Mai dedotto.** |
| Prefisso, nome dell'app, cartella | sempre | prefisso di 2-8 minuscole più `_` |
| Stage finale | sempre | P (prototipo), R (ambiente DEV), D (rilascio) |
| Lingua e LCID | sempre | default italiano, `1040` |
| Baseline Sales Hub / Customer Service Hub | solo model-driven | evita di riprogettare la site map |
| Persone e web role | solo power-pages | chi è anonimo, chi accede e con quali ruoli |
| URL ambiente, solution, profili PAC/PACX | solo se lo stage finale è R o D | si confermano prima dello stage R, non all'inizio |

Il resto (schermate, campi, dati demo) si ricava dai requisiti. Se un requisito è ambiguo, la scelta raccomandata va nel piano come `DECISIONE APERTA`, senza bloccare il lavoro.

## 2. Struttura obbligatoria del documento

File: `POC/Piano_<Iniziativa>_<Cliente>.md`. Lo crea già `poc-init.mjs` con `--initiative` e `--client`: si completa quello, non se ne scrive uno nuovo. Le sezioni vanno in questo ordine, con questi titoli: gli script li leggono.

1. Titolo, poi un blockquote di contesto di 1-2 righe (obiettivo della demo, appType, prefisso, cartella).
2. `## 📑 Indice`.
3. `## 🎯 Target ambiente`: tabella `Chiave | Valore` con le chiavi esatte di `poc-init.mjs`, lette da `poc-preflight.mjs`. Valori ignoti: `da confermare`. `Conferma utente stage R`: `no` finché l'utente non conferma.
4. `## 🧭 Decisioni`: `Decisione | Valore | Fonte`. Fonte = utente, requisito o Microsoft Learn.
5. `## 🖥️ Schermate`: `Schermata | Tipo | Dataset | Requisiti`, più `Accesso` per power-pages.
6. `## 🧱 Modello dati`: per tabella, scelta fra standard, standard esteso o custom, con il link Learn della verifica.
7. `## 🌊 Ondate`: vedi sezione 4.
8. `## 📋 Todo`: checklist raggruppata per ondata e sotto-agente.
9. `## ⚠️ Rischi e simulato`: cosa resta simulato, non verificato o da pulire.
10. `## 🔁 Recap`: aggiornato a fine sessione, solo fatti.

## 3. Regole di ottimizzazione

1. **Prima il percorso demo.** Le schermate del `demoPath` sono i *Must* (MoSCoW); il resto è *Should* o *Could* e si rimanda se costa un'ondata in più.
2. **Schema prima della UI.** Nessuna schermata prima che `poc-datamodel` abbia chiuso la scelta standard/custom delle tabelle che legge.
3. **Script prima degli agenti.** Ogni passo meccanico è un comando, non un compito per un modello:

   | Bisogno | Comando |
   | --- | --- |
   | Postazione pronta | `node <plugin-root>/scripts/check-prereqs.mjs --stage P\|R` |
   | Scaffold, piano, primo check | `node <plugin-root>/scripts/poc-init.mjs ...` |
   | Baseline standard | `node <plugin-root>/scripts/poc-add-standard.mjs ...` |
   | Prototipo verificato | `npm run check -- --json` |
   | Progetto React del sito Power Pages | `node <plugin-root>/scripts/poc-spa-scaffold.mjs --root <poc-root> --build --json` |
   | Ambiente giusto prima di scrivere | `node <plugin-root>/scripts/poc-preflight.mjs --plan <piano> --json` |
   | Zip esportato corretto | `node <plugin-root>/scripts/poc-solution-zip.mjs <zip> --json` |

4. **Un artefatto, un proprietario.** Ogni file o componente ha un solo sotto-agente (tabella di ownership in [dataverse-poc-realization](../dataverse-poc-realization/SKILL.md), sezione 4). Due sotto-agenti nella stessa ondata non toccano mai lo stesso file.
5. **Ondate parallele.** Lavori indipendenti stanno nella stessa ondata (`∥`); una dipendenza crea l'ondata successiva (`→`). Una generative page vale un'istanza di `poc-genpage`.
6. **Done = comando con exit code.** Ogni ondata chiude con un criterio verificabile: `npm run check` verde, 0 requisiti scoperti, preflight 0, `npm run build` ok, report `COMPLETATO`. Formule come "UI completa" o "funziona" non sono criteri di done.
7. **Brief autosufficienti.** Ogni delega usa il contratto del brief (sezione 5 di `dataverse-poc-realization`): il sotto-agente non vede la conversazione. Nel brief vanno scope e fuori scope puntuali, input con i percorsi e i criteri di done dell'ondata.
8. **Stage come cancelli.** Lo stage R parte solo dopo la conferma dell'utente scritta nel piano, e ogni rilascio D ha la sua conferma. Fino ad allora le ondate R restano nel piano, ma non partono.
9. **Al massimo due rilanci.** Un report `PARZIALE` o `BLOCCATO` si rilancia con un brief corretto al massimo due volte, poi si porta all'utente con l'opzione raccomandata.
10. **Il piano è l'unico stato.** Decisioni, todo ed esiti vivono nel piano, non nella conversazione. Lo aggiorna solo l'orchestratore.
11. **Contesto minimo.** Si leggono solo le reference pertinenti al passo, Microsoft Learn solo per le tabelle candidate al riuso, e i gotcha solo prima dello stage R.
12. **Verificato, non verificato, simulato.** Il piano distingue sempre i tre stati; nulla è "fatto" senza l'evidenza del criterio di done.

## 4. Ondate tipiche

`poc-init.mjs` precompila la sezione `🌊 Ondate` per l'appType scelto. Si adatta allo scope, senza riscriverla da zero.

| Ondata | model-driven | code-app | power-pages |
| --- | --- | --- | --- |
| 1 · Schema (P) | `poc-datamodel` | `poc-datamodel` | `poc-datamodel` (con `entitySetName`) |
| 2 · Prototipo (P) | `poc-prototype-builder` ∥ `poc-demo-data` | uguale | uguale, più persone e table permission |
| 3 · Verso il codice (P) | — | — | `poc-power-pages`: scaffold SPA su mock |
| Base ambiente (R) | `poc-deployer` → `poc-datamodel` | uguale | uguale |
| UI in ambiente (R) | `poc-demo-data` ∥ `poc-forms-views` ∥ `poc-webresources` ∥ `poc-pcf`, poi `poc-genpage` ×N | `poc-demo-data` ∥ `poc-code-app` | `poc-demo-data` ∥ `poc-power-pages` |
| Verifica e rilascio (R/D) | `poc-tester` → `poc-deployer` | uguale | uguale, un giro per persona |

Ogni riga del piano riporta: ondata, sotto-agenti, input (percorsi), output (artefatti), criterio di done e dipendenze.

## 5. Anti-pattern

- Scrivere YAML di UI, HTML o codice prima che lo schema sia deciso.
- Pianificare validator, renderer, build o progetti React scritti a mano: esistono gli script.
- Mettere nella stessa ondata due sotto-agenti sullo stesso file, oppure un sotto-agente su un artefatto di un altro.
- Criteri di done non verificabili, o verificati "a vista".
- Fare domande una alla volta, o chiedere ambiente e solution quando si va solo al prototipo.
- Aprire lo stage R per inferenza, o selezionare profili PAC/PACX per tentativi.
- Rileggere per intero le reference a ogni passo, invece del solo file pertinente.
- Un piano lungo e narrativo: tabelle e checklist si leggono e si aggiornano meglio.

## 6. Esempio

Un piano compilato per una POC power-pages è in [references/esempio-piano.md](references/esempio-piano.md).
