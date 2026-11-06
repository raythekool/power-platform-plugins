## Changelog

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
