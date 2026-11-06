---
name: dataverse-poc-realization
description: "Regole condivise per la gestione multi-agente di una POC Dataverse: stage gate prototipo/realizzazione/rilascio, contratto del brief e del report fra orchestratore e sotto-agenti, ownership degli artefatti, guardrail sull'ambiente target, gotcha verificati (PACX, PAC, AppMaker, generative pages). Use when: un sotto-agente poc-* riceve un brief, l'orchestratore deve delegare, si crea/modifica qualcosa in un ambiente Dataverse reale per una POC. Non usare per progetti di delivery reali."
user-invocable: false
---

# Realizzazione POC Dataverse — regole condivise

Questa skill è il contratto comune fra l'agente `Dataverse POC Orchestrator` e i sotto-agenti nascosti `poc-*`. Ogni sotto-agente la legge **prima** di agire.

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

Solo l'orchestratore aggiorna il piano. I sotto-agenti riportano nel report cosa è cambiato.

## 3. Guardrail (stage R e D)

1. **Preflight obbligatorio** prima di ogni scrittura: `pac org who` e `pacx auth list` devono puntare all'URL del brief. Se non coincidono: fermarsi, non selezionare profili diversi per tentativi.
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

## 7. Gotcha verificati

Ambiente e CLI:

- In `run_in_terminal` i blocchi PowerShell multi-riga spesso restituiscono solo l'eco del prompt: eseguire comandi su una riga.
- Non filtrare l'output di PAC/PACX con `Select-String`: nasconde gli errori.
- Se `node` non è nel `PATH`: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`.
- `pacx script all/table`: la sezione entità e la sezione relazioni hanno lo stesso formato di riga; isolare la sezione prima di contare. Verificare sempre statistiche sorprendenti prima di scriverle in un deliverable.

Dataverse:

- I valori delle choice locali su tabelle custom partono da `7139500xx` (dipende dal publisher): leggerli dai metadata, non assumerli.
- PACX crea le choice locali con suffisso `code` (es. `ava_categorycode`): mappare il nome del dataset sul logical name reale.
- Sitemap: i titoli richiedono la LCID della lingua utente (es. `1040`) o compaiono come "Nuova area secondaria"; aggiornare con AppMaker `sitemap_update`, poi `pacx publish all`.

Generative page nella solution (verificato con PAC 2.12.2):

- Le generative page sono *solution-aware*: tabella `uxagentproject` ("UX Agent Project"), con i file in `uxagentprojectfile`. Il **page id coincide con `uxagentprojectid`**. `pac model genpage upload` non ha un parametro di solution e non aggiunge la pagina alla solution.
- Aggiungerle **una per una per nome di tipo**: `pac solution add-solution-component --solutionUniqueName <sol> --component <pageId> --componentType uxagentproject --AddRequiredComponents true`. I file della pagina entrano come componenti richiesti.
- Non usare codici numerici di tipo: il codice di `uxagentproject` dipende dall'ambiente (si legge da `solutioncomponentdefinition`). Passare dall'app non funziona: `--componentType 80` restituisce "Component Type Id (80) is not known" e `--componentType AppModule` restituisce "Invalid component type 9006".
- Elenco delle pagine in ambiente: `pacx data query -q "<fetch><entity name='uxagentproject'><attribute name='name'/></entity></fetch>"`.
- Verifica dopo l'export: lo zip contiene `uxagentprojects/<pageId>/uxagentproject.xml` e `uxagentprojectfiles/<fileId>/filecontent/` con `page.tsx`, `page.compiled`, `config.json` e `firstPrompt.json`. Le pagine **non** compaiono in `<RootComponents>` di `solution.xml`: per verificarle, controllare le cartelle nello zip.
- Nel target arrivano solo il primo prompt e il codice pubblicato, non la conversazione. Le pagine create in preview vanno aperte una volta nel designer per migrarle.
- Una solution managed non si importa nell'ambiente dove la stessa solution è unmanaged (tipicamente il DEV sorgente): l'import viene rifiutato. Prima di un rilascio managed, verificare che l'URL del profilo di destinazione sia diverso da quello sorgente. Se coincide, fare solo l'export managed e restituire `BLOCCATO` per l'import. Non cancellare la solution unmanaged per "convertirla".
- Alternativa code-first: `pac model genpage download` dall'origine, `upload` nella destinazione, poi `pac model genpage add` per agganciarle alla sitemap. Fonte: [Adding generative pages to solutions](https://learn.microsoft.com/power-apps/maker/model-driven-apps/generative-pages#adding-generative-pages-to-solutions).

Strumenti e sotto-agenti:

- Nei sotto-agenti gli strumenti MCP "deferred" (es. AppMaker) possono non essere caricabili: in quel caso usare letture CLI (`pac`/`pacx`, ispezione dello zip esportato) oppure restituire `BLOCCATO` indicando la verifica da far eseguire all'agente principale.
- `pac org who` in un terminale di sotto-agente può restituire output parziale con exit code 1: ripetere una volta; i nomi dei profili PAC si leggono con `pac auth list`, quelli PACX con `pacx auth list` (possono essere diversi per lo stesso URL).

Generative page:

- `dataApi.queryTable` restituisce i lookup come `/tabella(guid)`, non come GUID: estrarre il GUID prima dei join.
- Spread su iteratori (`[...map.entries()]`) compila in array vuoto (niente `downlevelIteration`): usare array e oggetti semplici.
- `pac model genpage upload --page-id` richiede anche `--prompt`.
- URL diretto: `main.aspx?appid=<app>&pagetype=genux&id=<pageId>`. Se il browser riporta l'elemento "not visible", usare `run_playwright_code` con `dispatchEvent('click')`.
