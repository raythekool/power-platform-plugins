## Changelog

### 2.1.0 — 2026-11-24

#### Aggiunto

- **Simulazione condivisa in stage P** (`simulation` in `config/index.yaml`, `npm run sim`): back-office e portale girano come siti locali sugli stessi dati demo sintetici, e una modifica fatta in una UI compare nell'altra.
  - Server locale `scripts/sim-server.mjs` senza dipendenze: risponde solo su `127.0.0.1` e non fa chiamate in uscita.
  - Lo stato vive in `.sim/` e lo YAML non viene mai riscritto.
  - Concorrenza per revisione, con conflitto visibile e scelta tra ricarica e sovrascrittura.
  - Le scritture rispettano le regole di `validate-poc-data`.
  - Ripristino con backup. Uno stato illeggibile non viene mai cancellato in silenzio.
  - Contratto in `references/simulazione-condivisa.md`.
- **Prototipo model-driven modificabile** con la simulazione attiva: Salva, Salva e chiudi, Nuovo, Elimina e Aggiorna nei moduli. Le altre finestre si aggiornano senza ricaricare. `app/custom.js` riceve i cambi con `PocApp.onDataChanged`.
- **Portale React del plugin sulla simulazione**:
  - modalità `sim` dell'SPA, con gli script `dev:sim` e `build:sim` (servita su `/portal/`);
  - `poc-spa-scaffold.mjs` genera il portale anche per una POC model-driven, con `simulation.portal.kind: plugin-spa` e `simulation.portal.screens`.
- Script npm `sim` e `sim:reset` in `poc-init.mjs`; `.sim/` escluso da git. `--update` porta i nuovi file senza toccare `config/` e `app/custom.*`.

#### Invariato

- Senza il blocco `simulation` tutto funziona come prima:
  - `dist/*.html` aperto dal disco resta statico e in sola lettura;
  - `npm run serve` serve il prototipo in sola lettura;
  - l'SPA `dev` resta su mock e `build` resta sulla Web API, senza il codice della simulazione.
- La simulazione non apre lo stage R e non usa `pac`/`pacx`.

### 2.0.0 — 2026-11-08

#### Breaking

- Le POC model-driven usano la sessione singola per default: dopo l'aggiornamento della shell, una configurazione senza `customerServiceWorkspace: true` non mostra piu le schede di sessione. Le schede interne dei form restano disponibili.
- Customer Service Hub non abilita automaticamente la multisessione, che resta riservata alle POC Customer Service Workspace richieste esplicitamente.

#### Migrazione

- Per conservare le schede in una POC Customer Service Workspace esistente, impostare `customerServiceWorkspace: true` in `config/index.yaml`, eseguire `node <plugin-root>/scripts/poc-init.mjs --root <poc-root> --update` e rigenerare con `npm run check`.
- Per una nuova POC Customer Service Workspace richiesta esplicitamente, aggiungere `--customer-service-workspace` a `poc-init.mjs`. Per le altre POC non serve alcuna configurazione aggiuntiva.

#### Aggiunto

- Validator e smoke test verificano il contratto di sessione; la shell conserva le schede del workspace quando si passa a un'altra app e le ripristina al ritorno.
- Le istruzioni per la realizzazione e il collaudo dell'app reale prevedono la verifica di `NavigationType` e dello stato multisessione.

### 1.4.0 — 2026-11-06

- **POC di siti Power Pages SPA in React** (`appType: power-pages`):
  - il prototipo YAML/HTML ha una shell da sito: menu in alto, home pubblica, pagine riservate, persona simulata (anonimo, autenticato, web role) e table permission in evidenza;
  - il validator controlla che ogni ruolo che vede una tabella abbia una table permission con `read`, e `write` sui dettagli modificabili;
  - lo smoke test percorre il sito con ogni persona.
- **Nuovo script `poc-spa-scaffold.mjs`**: genera dagli stessi YAML un progetto React + Vite + TypeScript che funziona subito con dati mock. Contiene:
  - route, colonne e tipi dei dati;
  - adattatore Web API `/_api/` con token CSRF;
  - `powerpages.config.json`;
  - il contratto dell'ambiente: site setting `Webapi/*`, web role e table permission.
  
  Si rilancia dopo ogni modifica ai YAML senza sovrascrivere le pagine già scritte. Template in `skills/prototype-dataverse-app/assets/power-pages-spa/`.
- Nuovo sotto-agente `poc-power-pages`, nuova skill `dataverse-poc-power-pages` e gotcha `gotcha-power-pages.md`: upload con `pac pages upload-code-site`, siti inattivi, Web API, sviluppo su mock.
- **Nuova skill `dataverse-poc-plan-guide`**: direttive per qualsiasi agente che pianifica una POC Dataverse. Copre domande iniziali in un'unica richiesta, struttura obbligatoria del piano, ondate parallele per ownership, criteri di done verificabili da comando e anti-pattern, con un esempio compilato. L'orchestratore e la planner la seguono.
- `poc-init.mjs`:
  - accetta `--app-type power-pages`;
  - il piano generato ha le sezioni `🧱 Modello dati`, `🌊 Ondate` (precompilate per appType) e `⚠️ Rischi e simulato`;
  - con power-pages, la tabella `🎯 Target ambiente` ha in più `Sito Power Pages (nome)` e `URL sito`.
- `poc-guard` chiede conferma anche prima di `pac pages upload-code-site`. `check-prereqs.mjs --stage R --app-type power-pages` richiede PAC 1.44 o successiva.

### 1.3.0 — 2026-11-06

- **VS Code: nel selettore degli agenti compare solo l'agente principale.** Dalla 1.2.0 VS Code mostrava anche i sotto-agenti. Il motivo: quando una cartella di plugin contiene `.claude-plugin/plugin.json`, VS Code usa il formato Claude. In quel formato carica `agents/` e anche `claude/agents/`, e le copie Claude dei sotto-agenti non erano nascoste. Ora anche le copie generate hanno `user-invocable: false`; Claude Code ignora il campo.
- **Agente rinominato** da "Dataverse POC Orchestrator" a **"POC Dataverse"** (`agents/poc-dataverse.agent.md`). In Claude Code la skill passa da `/dataverse-poc:orchestrator` a **`/dataverse-poc:poc`**.
- Anche `.claude-plugin/plugin.json` e `claude/hooks.json` sono generati da `build-claude.mjs`; il validator controlla `user-invocable: false` sui sotto-agenti Copilot e Claude.

### 1.2.0 — 2026-11-06

- **Claude Code**: nuovo `.claude-plugin/plugin.json`. I 10 sotto-agenti sono in `claude/agents/` e l'orchestratore è la skill `/dataverse-poc:orchestrator`, perché in Claude Code solo la conversazione principale può delegare. Il hook `poc-guard` è in formato Claude (`claude/hooks.json`). I file Claude sono generati da `agents/` con `scripts/dataverse-poc/build-claude.mjs`: `<plugin-root>` diventa `${CLAUDE_PLUGIN_ROOT}`. Il formato Copilot non cambia.
- Il plugin è distribuito dal marketplace `raythekool/power-platform-plugins`, che sostituisce `raythekool/dataverse-poc-agents`. Tutorial, sito e test sono in `docs/dataverse-poc/`, `site/dataverse-poc/` e `tests/dataverse-poc/` di quel repository.
- Licenza MIT.

### 1.1.0 — 2026-10-30

Meno token, piu script: il lavoro meccanico non passa piu da un modello.

- **Pipeline del prototipo pronta** (`skills/prototype-dataverse-app/assets/poc-template/`): validator di config e dati, build runtime e statica, report di copertura, `npm run check` con riepilogo JSON, server senza dipendenze. Prima andavano scritti a mano per ogni POC.
- **Renderer generico** `app/poc-app.js`: viste, moduli, dashboard, KPI, subgrid, timeline, BPF, generative page e PCF simulati disegnati dai soli YAML, sia model-driven (su `mda-shell`) sia code app. Estensioni di progetto con `PocApp.registerComponent` in `app/custom.js`.
- **Init in un comando**: skill `/dataverse-poc-init` e script `poc-init.mjs` (scaffold, esempi, piano con `🎯 Target ambiente`, `npm install`, primo check); `--update` aggiorna script e renderer di una POC esistente senza toccare `config/`.
- `poc-add-standard.mjs`: baseline Sales Hub / Customer Service Hub o singole tabelle standard con prefisso e dati demo sintetici generati, senza copia manuale.
- `check-prereqs.mjs`: verifica in sola lettura di Node, npm, browser, `pac`, `pacx`, profili e server MCP, per stage P o R.
- `poc-preflight.mjs`: confronta `pac org who`, `pac auth list` e `pacx auth list` con il target del piano e blocca senza conferma dello stage R. `poc-solution-zip.mjs`: legge versione, componenti e generative page di uno zip esportato senza `unzip`.
- Orchestratore: esegue direttamente gli script e `npm run check` (stage P) invece di delegare a un sotto-agente; `poc-tester` resta per browser, ambiente e metadata.
- Skill `dataverse-poc-realization` alleggerita: gotcha spostati in `references/gotcha-ambiente.md` e `references/gotcha-genpage.md`, letti solo quando servono.
- `validate:data` segnala email non su domini demo, IBAN e codici fiscali; lo smoke test conta le simulazioni anche nel record aperto e non le richiede nelle code app.
- Fix: `MdaShell.renderHeader` leggeva una variabile globale `state` non dichiarata; ora accetta lo stato come terzo parametro.
- Tutorial `docs/tutorial-init.md`, test `node:test` degli script e del flusso end-to-end in CI, sito GitHub Pages.

### 1.0.1 — 2026-10-06

- Generative page nella solution: procedura verificata su ambiente reale. Ogni pagina si aggiunge come `uxagentproject` con `--AddRequiredComponents`, perché la strada via app module fallisce con PAC 2.12.2. La verifica si fa sullo zip (`uxagentprojects/<pageId>/`), non su `<RootComponents>`.
- `poc-genpage` aggiunge la pagina alla solution subito dopo l'upload; `poc-deployer` controlla le pagine mancanti prima dell'export e le verifica nello zip.
- Segnalati sotto-agenti senza strumenti MCP deferred e profili PAC/PACX con nomi diversi.

### 1.0.0 — 2026-10-06

- Prima versione, estratta dal repository di pre-sales in cui è nata.
- Agente `Dataverse POC Orchestrator` e 10 sotto-agenti nascosti `poc-*`.
- Skill `dataverse-poc-*` e `prototype-dataverse-app` (riferimenti, asset, smoke test Playwright).
- Hook `PreToolUse` `poc-guard` compatibile con i payload di VS Code e Copilot CLI.
- Rimossi riferimenti a clienti, URL di ambiente e identificativi di app.
