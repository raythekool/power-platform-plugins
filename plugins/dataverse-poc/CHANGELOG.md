## Changelog

### 1.1.0 — 2026-11-06

- **Claude Code**: nuovo `.claude-plugin/plugin.json`. I 10 sotto-agenti sono in `claude/agents/` e l'orchestratore è la skill `/dataverse-poc:orchestrator`, perché in Claude Code solo la conversazione principale può delegare. Il hook `poc-guard` è in formato Claude (`claude/hooks.json`). I file Claude sono generati da `agents/` con `scripts/dataverse-poc/build-claude.mjs`; il formato Copilot non cambia.
- Il plugin è distribuito dal marketplace `raythekool/power-platform-plugins`, che sostituisce `raythekool/dataverse-poc-agents`.
- Licenza MIT.

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
