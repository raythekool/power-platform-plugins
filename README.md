# 🧩 Power Platform plugins

**Agent plugins for Microsoft Power Platform, Dataverse and Dynamics 365 delivery.**
One repository, one marketplace: add it once to **VS Code (GitHub Copilot)**, **GitHub Copilot CLI** or **Claude Code** and install the plugins you need from there.

<p>
  <a href="#-plugins">📦 Plugins</a> ·
  <a href="#-install">🚀 Install</a> ·
  <a href="#-moving-from-the-old-marketplaces">🔁 Migration</a> ·
  <a href="#%EF%B8%8F-repository-layout">🗂️ Layout</a> ·
  <a href="CONTRIBUTING.md">🤝 Contributing</a>
</p>

---

## 📦 Plugins

| Plugin | Version | What it does | VS Code | Copilot CLI | Claude Code | Docs |
| --- | --- | --- | :-: | :-: | :-: | --- |
| 🧪 [`dataverse-poc`](plugins/dataverse-poc/README.md) | 1.2.0 | Multi-agent **Dataverse POC**: an orchestrator plans the POC (model-driven or code app) and delegates to sub-agents for the HTML/YAML prototype, data model, demo data, forms/views/sitemap, generative pages, PCF, web resources, code app, tests and deploy. Deterministic scripts do the mechanical work: init, prototype pipeline, preflight and solution checks. A `PreToolUse` guard asks before risky PAC/PACX commands. Content in Italian. | ✅ | ✅ | ✅ | [README](plugins/dataverse-poc/README.md) · [Tutorial 🇮🇹](docs/dataverse-poc/tutorial-init.md) · [CHANGELOG](plugins/dataverse-poc/CHANGELOG.md) · [Website](https://raythekool.github.io/power-platform-plugins/dataverse-poc/) |
| 📖 [`power-platform-llm-wiki`](plugins/power-platform-llm-wiki/README.md) | 3.3.1 | **LLM Wiki**: a code-first project knowledge base for Dynamics 365 (CE / Power Platform and F&O). It analyses code, Dataverse and F&O metadata, work items, meetings and FDD/TDD, and publishes to Azure DevOps Wiki or GitHub Wiki. | ✅ | ✅ | ✅ | [Guide](docs/power-platform-llm-wiki/README.md) · [Guida utente 🇮🇹](docs/power-platform-llm-wiki/guida-utente.md) · [CHANGELOG](plugins/power-platform-llm-wiki/CHANGELOG.md) · [Website](https://raythekool.github.io/power-platform-plugins/power-platform-llm-wiki/) |

## 🚀 Install

The marketplace is `raythekool/power-platform-plugins`. Inside a tool, each plugin is `<plugin>@power-platform-plugins`.

### 🟦 VS Code (GitHub Copilot)

1. In settings enable **Chat > Plugins: Enabled**.
2. Add `raythekool/power-platform-plugins` to **Chat > Plugins: Marketplaces** (`chat.plugins.marketplaces`).
3. In the Extensions view search `@agentPlugins` (or `@agentPlugins dataverse-poc`, `@agentPlugins power-platform-llm-wiki`) and install.

### ⌨️ GitHub Copilot CLI

```shell
copilot plugin marketplace add raythekool/power-platform-plugins
copilot plugin install dataverse-poc@power-platform-plugins
copilot plugin install power-platform-llm-wiki@power-platform-plugins
```

To update a plugin: `copilot plugin update <plugin>`.

### 🟠 Claude Code

```shell
claude plugin marketplace add raythekool/power-platform-plugins
claude plugin install dataverse-poc@power-platform-plugins
claude plugin install power-platform-llm-wiki@power-platform-plugins
```

The same commands work inside a session as `/plugin marketplace add ...` and `/plugin install ...`. Run `/plugin` to browse the marketplace. To update: `claude plugin update <plugin>@power-platform-plugins`.

> [!IMPORTANT]
> Plugin commands are namespaced: for example `/dataverse-poc:orchestrator` and `/power-platform-llm-wiki:init`. Each plugin README explains how to start it in each tool.

## 🔁 Moving from the old marketplaces

Both plugins used to have a marketplace of their own. Those repositories are archived and receive no more updates.

| Old marketplace | Old install name | New install name |
| --- | --- | --- |
| `raythekool/dataverse-poc-agents` | `dataverse-poc@dataverse-poc-agents` | `dataverse-poc@power-platform-plugins` |
| `raythekool/power-platform-llm-wiki` | `power-platform-llm-wiki@power-platform-llm-wiki` | `power-platform-llm-wiki@power-platform-plugins` |

1. Uninstall the plugin installed from the old marketplace and remove that marketplace:
   - VS Code: remove the old entry from `chat.plugins.marketplaces`;
   - Copilot CLI: `copilot plugin marketplace remove <old>`;
   - Claude Code: `claude plugin marketplace remove <old>`.
2. Add `raythekool/power-platform-plugins` and install again, as shown in [🚀 Install](#-install).
3. LLM Wiki projects: run `/power-platform-llm-wiki:config --refresh-engine` once. Nothing else changes in the project.

## 🗂️ Repository layout

```text
.github/plugin/marketplace.json     # marketplace for VS Code and Copilot CLI
.claude-plugin/marketplace.json     # same marketplace for Claude Code (kept identical)
plugins/<plugin>/                   # what gets installed: manifests, agents, skills, scripts, README, CHANGELOG, LICENSE
├── plugin.json                     #   Copilot manifest
└── .claude-plugin/plugin.json      #   Claude Code manifest
docs/<plugin>/                      # extended documentation and images
scripts/validate-marketplace.mjs    # repository-wide checks (both marketplaces, versions, confidentiality)
scripts/<plugin>/                   # plugin-specific validators and build scripts
tests/<plugin>/                     # tests and fixtures
site/                               # GitHub Pages: home + one folder per plugin website
.github/workflows/                  # validate.yml (CI), pages.yml (website)
```

## 🛠️ Development

```shell
node scripts/validate-marketplace.mjs                         # both marketplaces, manifests, versions, confidentiality
node scripts/dataverse-poc/validate-plugin.mjs                # dataverse-poc structure and links
node scripts/dataverse-poc/build-claude.mjs --check           # Claude Code files are in sync with agents/
node --test tests/dataverse-poc/*.test.mjs                    # dataverse-poc scripts + end-to-end scaffold (SKIP_E2E=1 to skip)
pwsh ./scripts/power-platform-llm-wiki/Validate-Plugin.ps1 -Human
pwsh ./tests/power-platform-llm-wiki/Invoke-Tests.ps1
claude plugin validate .                                      # optional, if Claude Code is installed
```

CI (`.github/workflows/validate.yml`) runs the same checks on every push and pull request. Conventions, releases and how to add a new plugin: [CONTRIBUTING.md](CONTRIBUTING.md).

## 📜 License

[MIT](LICENSE) © raythekool. Each plugin ships its own copy of the license.
