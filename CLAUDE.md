# CLAUDE.md

Marketplace `power-platform-plugins`: agent plugins for Power Platform / Dataverse / Dynamics 365, distributed to **VS Code (Copilot)**, **Copilot CLI** and **Claude Code** from one repo.
Full rules: [CONTRIBUTING.md](CONTRIBUTING.md). Version workflow: [.github/copilot-instructions.md](.github/copilot-instructions.md). This file is the short version.

## Layout

| Path | What | Version bump? |
| --- | --- | --- |
| `plugins/<plugin>/` | Only what gets installed (manifests, agents, skills, hooks, runtime scripts, README, CHANGELOG, LICENSE) | **Yes**, except README/CHANGELOG |
| `docs/<plugin>/` | Extended docs, SVG images | No |
| `scripts/<plugin>/`, `scripts/validate-marketplace.mjs` | Maintainer validators/builds | No |
| `tests/<plugin>/` | Tests and fixtures | No |
| `site/` | GitHub Pages (home + one folder per plugin) | No |
| `.github/plugin/marketplace.json` + `.claude-plugin/marketplace.json` | The two marketplace manifests — **must stay identical** | — |

Plugins:
- **`dataverse-poc`** (Node 18+, zero dependencies, content in **Italian**) — orchestrator agent + hidden sub-agents for Dataverse POCs.
- **`power-platform-llm-wiki`** (PowerShell 7) — code-first project wiki, one agent + 5 skills (init, config, update, ingest, query).

## Checks (run before declaring done)

```powershell
node scripts/validate-marketplace.mjs                  # manifests, versions, confidentiality
node scripts/dataverse-poc/validate-plugin.mjs
node scripts/dataverse-poc/build-claude.mjs --check    # generated Claude files in sync
node --test tests/dataverse-poc/*.test.mjs             # $env:SKIP_E2E=1 to skip npm/Chrome e2e
pwsh ./scripts/power-platform-llm-wiki/Validate-Plugin.ps1 -Human
pwsh ./tests/power-platform-llm-wiki/Invoke-Tests.ps1
claude plugin validate .                               # optional
```

Run only the checks for the plugin you touched, plus `validate-marketplace.mjs`. CI (`.github/workflows/validate.yml`) runs the same set.

## Hard rules

- **No customer data, no secrets.** Use the fictional *Contoso*. `validate-marketplace.mjs` blocks known identifiers, e-mails and GUIDs under `plugins/`.
- **Deterministic first:** if a script can do a step, write a script, not more LLM instructions. Keep agent/skill text short (it costs tokens on every run); put detail in `references/` loaded on demand.
- **One plugin, one folder:** a change to a plugin touches only its own folders.
- **Never push, tag or release without explicit confirmation.** Work on a branch, open a PR.

## Versioning (any change under `plugins/<plugin>/` except README/CHANGELOG)

1. Propose patch/minor/major and **ask before applying**. Major ⇒ CHANGELOG "Breaking" section + migration steps.
2. Update the version in all 4 places: `plugins/<p>/plugin.json`, `plugins/<p>/.claude-plugin/plugin.json`, entry in both marketplace manifests. Also the README catalog table.
3. Add a dated heading in `plugins/<p>/CHANGELOG.md`.
4. Run the checks; suggest tag `<plugin>-vX.Y.Z`.

## dataverse-poc specifics

- **Copilot format is the source of truth:** `agents/*.agent.md`, `skills/`, `hooks.json`.
- **`claude/` is generated — never edit by hand.** After any change in `agents/` run `node scripts/dataverse-poc/build-claude.mjs` (regenerates `claude/agents/`, `claude/skills/poc/`, `claude/hooks.json`, `.claude-plugin/plugin.json`).
- Only `poc-dataverse.agent.md` is user-invocable; every sub-agent (both sets) has `user-invocable: false`.
- In agents/skills write `<plugin-root>/scripts/...` (becomes `${CLAUDE_PLUGIN_ROOT}`); the validator checks those paths exist.
- `scripts/poc-guard.cjs` serves both hook payloads (Claude/VS Code and Copilot CLI) — keep it compatible with both.
- New mechanical logic → `plugins/dataverse-poc/scripts/*.mjs` + tests in `tests/dataverse-poc/scripts.test.mjs`.
- Don't declare components in the dataverse-poc entry of `.claude-plugin/marketplace.json`.

## power-platform-llm-wiki specifics

- Scripts: `#Requires -Version 7.0`, UTF-8 via `Read-Utf8Text`/`Write-Utf8Text`, JSON output, exit 1 on failure, never a variable named `$host`.
- New project-facing scripts must be copied by `Install-Engine.ps1` and listed in the validator's required files.
- Every script change ⇒ fixture + assertions in `tests/power-platform-llm-wiki/Invoke-Tests.ps1`.
- Skills reference scripts as `llm-wiki/.engine/scripts/<name>.ps1`; no `context:` or `disable-model-invocation: true` in front matter.
- Wiki conventions live in `references/AGENTS.md` — change them together with `Test-WikiLint.ps1`.
- Breaking changes to links/front matter/config need migration in `/power-platform-llm-wiki:config --migrate` and in `docs/`.

## Environment notes

- Windows + PowerShell 7 is the primary dev shell; CI runs on Ubuntu (Node 22, pwsh). Keep scripts cross-platform (paths, line endings).
