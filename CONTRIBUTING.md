# 🤝 Contributing

This repository is the marketplace and source of the Power Platform agent plugins listed in the [README](README.md). The rules below apply to every plugin. Plugin-specific conventions follow at the end.

## 📏 Ground rules

- 🚫 **No customer data.** Never commit customer names, environment URLs, tenant or app ids, connection ids, repositories, people, screenshots or documents. Use the fictional *Contoso* in examples and fixtures. `scripts/validate-marketplace.mjs` blocks known identifiers, e-mail addresses and GUIDs in `plugins/`. Add private patterns locally with `PPP_DENYLIST` (semicolon-separated regexes); the LLM Wiki validator also reads `LLMWIKI_DENYLIST`.
- 🔑 **No secrets** in any file, including examples.
- 🐚 **Deterministic first.** If a script can do a step (parsing, checks, conversion), write it as a script instead of adding instructions for the LLM.
- 🪶 **Keep instructions small.** Every line of an agent or skill costs tokens on every run. Prefer references loaded on demand.
- 🧭 **One plugin, one folder.** A change to a plugin touches only its own folders (see the layout below).

## 🗂️ Layout

| Path | Content |
| --- | --- |
| `plugins/<plugin>/` | **Only what gets installed**: `plugin.json` (Copilot), `.claude-plugin/plugin.json` (Claude Code), agents, skills, hooks, scripts used at runtime, `README.md` (short and self-contained), `CHANGELOG.md` (the only changelog), `LICENSE` |
| `docs/<plugin>/` | Extended documentation and images |
| `scripts/<plugin>/` | Validators and build scripts for maintainers |
| `tests/<plugin>/` | Tests and fixtures |
| `site/<plugin>/` | Plugin website (optional), published under `/<plugin>/` on GitHub Pages; `site/index.html` is the home |
| `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json` | The two marketplace manifests. They must stay identical |
| `scripts/validate-marketplace.mjs` | Repository-wide checks |

## 🏷️ Versions and releases

Each plugin has its own SemVer version. VS Code, Copilot CLI and Claude Code offer an update only when the version changes.

1. A bump is needed when anything under `plugins/<plugin>/` changes, except `README.md` and `CHANGELOG.md`. Changes limited to `docs/`, `scripts/`, `tests/` or `site/` need no bump.
2. Levels: patch for fixes, minor for new features, major for breaking changes (and a CHANGELOG "Breaking" section with migration steps).
3. Write the new version in every place it appears:
   - `plugins/<plugin>/plugin.json`;
   - `plugins/<plugin>/.claude-plugin/plugin.json`, if the plugin has one;
   - the plugin entry in `.github/plugin/marketplace.json`;
   - the plugin entry in `.claude-plugin/marketplace.json`.

   Also update the version column of the README catalog.
4. Add a `CHANGELOG.md` heading for the version with its date.
5. Run the checks (below) and tag `<plugin>-vX.Y.Z`.

The marketplace `metadata.version` changes only when the marketplace itself changes (plugins added, removed or renamed).

## ➕ Adding a plugin

1. Create `plugins/<name>/` with `plugin.json` (Copilot), `README.md`, `CHANGELOG.md` and `LICENSE`.
   For Claude Code, add `.claude-plugin/plugin.json` with the same `name` and `version`.
   Note that VS Code then loads the plugin in the Claude format, and it always scans `agents/` on top of the paths the manifest lists. If the Copilot and Claude agents differ, every agent that must not appear in the VS Code picker needs `user-invocable: false`, Claude copies included.
2. Add the entry, with `source: ./plugins/<name>`, to **both** marketplace manifests.
3. Add a row to the README catalog. Add `docs/`, `scripts/`, `tests/` folders only if needed.
4. Add a job to `.github/workflows/validate.yml` if the plugin has its own checks.
5. Run `node scripts/validate-marketplace.mjs` and `claude plugin validate .`.

## ✅ Checks

```shell
node scripts/validate-marketplace.mjs
node scripts/dataverse-poc/validate-plugin.mjs
node scripts/dataverse-poc/build-claude.mjs --check
node --test tests/dataverse-poc/*.test.mjs
pwsh ./scripts/power-platform-llm-wiki/Validate-Plugin.ps1 -Human
pwsh ./tests/power-platform-llm-wiki/Invoke-Tests.ps1
claude plugin validate .
```

CI runs the same checks, except `claude plugin validate`. Open a pull request from a branch; never push tags or releases without review.

## 🧪 dataverse-poc

- The content (agents, skills, references) is in Italian.
- **The Copilot format is the source.** That means `agents/*.agent.md`, `skills/` and `hooks.json`.
- Only the main agent **POC Dataverse** (`agents/poc-dataverse.agent.md`) is shown in the agent picker. Sub-agents have `user-invocable: false`, and the validator enforces it.
- The Claude Code files are **generated**:
  - `claude/agents/poc-*.md`;
  - the `claude/skills/poc/` skill (`/dataverse-poc:poc`);
  - `.claude-plugin/plugin.json` and `claude/hooks.json`.

  Regenerate them after every change to `agents/` with `node scripts/dataverse-poc/build-claude.mjs`; CI fails when they are out of date. In Claude Code sub-agents cannot start other sub-agents, so the main agent becomes a skill that runs in the main conversation.
- Because of `.claude-plugin/plugin.json`, VS Code loads both `agents/` and `claude/agents/`. The generated Claude sub-agents therefore carry `user-invocable: false` (Claude Code ignores it), and the validator checks it on both sets. Never declare components in the dataverse-poc entry of `.claude-plugin/marketplace.json`: Claude Code would append them to the manifest.
- Front matter: skills and agents have `name` (equal to the folder or the file) and `description`. Sub-agents are listed in the main agent's `agents:`.
- `claude/hooks.json` (Claude Code and VS Code) and `hooks.json` (Copilot CLI) call the same `scripts/poc-guard.cjs`; keep it compatible with both payloads.
- Agents and skills refer to the plugin folder as `<plugin-root>`. The generator turns it into `${CLAUDE_PLUGIN_ROOT}`, and the validator checks that every `<plugin-root>/scripts/...` exists.
- Mechanical work goes into Node scripts in `plugins/dataverse-poc/scripts/` (Node 18+, no dependencies), with tests in `tests/dataverse-poc/scripts.test.mjs`. The end-to-end test needs npm registry access; set `SKIP_E2E=1` to skip it.
- The tutorial and images are in `docs/dataverse-poc/`. The website (`site/dataverse-poc/`, built by `scripts/dataverse-poc/build-site.mjs`) includes live demos generated with the plugin's own scaffold.

## 📖 power-platform-llm-wiki

- Skills: front matter with `name` (equal to the folder) and `description`; optional `argument-hint`, `user-invocable`. Do not use `context:` or `disable-model-invocation: true`. Each skill states what it may read and write, and appends to `wiki/log.md`.
- Paths in skills: projects run the engine from `llm-wiki/.engine/`. Refer to scripts as `llm-wiki/.engine/scripts/<name>.ps1`, and to the plugin root as "two folders above this SKILL.md"; only `init` and `config` need the plugin root.
- Scripts: PowerShell 7 (`#Requires -Version 7.0`), explicit UTF-8 I/O (`Read-Utf8Text` / `Write-Utf8Text`), JSON output, exit code 1 on failure. Never name a variable `$host`. New scripts used by projects are copied by `Install-Engine.ps1` and must be listed in the validator's required files.
- Wiki content conventions (links, front matter, lifecycle) live in `references/AGENTS.md`; change them there and in `Test-WikiLint.ps1` together.
- Every script change gets a fixture and assertions in `tests/power-platform-llm-wiki/Invoke-Tests.ps1`.
- Images are self-contained SVG files in `docs/power-platform-llm-wiki/images/`, with a background and `<title>`/`<desc>`. The website copies them at build time.
- Breaking changes to links, front matter, configuration or host layout require migration steps in `/power-platform-llm-wiki:config --migrate` and in `docs/power-platform-llm-wiki/`. After an update, projects run `/power-platform-llm-wiki:config --refresh-engine`.
