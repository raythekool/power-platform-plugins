## Repository instructions

This repository is the `power-platform-plugins` marketplace: it holds several agent plugins under `plugins/<plugin>/`, listed in `.github/plugin/marketplace.json` (VS Code, Copilot CLI) and `.claude-plugin/marketplace.json` (Claude Code). See [CONTRIBUTING.md](../CONTRIBUTING.md) for layout, conventions and workflow.

### Version management on commit and push

VS Code, Copilot CLI and Claude Code offer a plugin update only when its version changes. Before every commit or push:

1. Group the changed files by plugin. A plugin needs a bump when anything under `plugins/<plugin>/` changed, except its `README.md` and `CHANGELOG.md`. Changes limited to `docs/`, `scripts/`, `tests/`, `site/` or root files need no bump.
2. For each plugin that needs a bump, propose the SemVer level and ask for confirmation before applying it:
   - patch: fixes;
   - minor: new features;
   - major: breaking changes. These also need a CHANGELOG "Breaking" section and migration steps.
3. After confirmation:
   - bump `version` in `plugins/<plugin>/plugin.json`, `plugins/<plugin>/.claude-plugin/plugin.json`, and in the plugin entry of both marketplace manifests;
   - update the version in the README catalog;
   - add a heading for the version, with its date, to `plugins/<plugin>/CHANGELOG.md`;
   - for `dataverse-poc`, run `node scripts/dataverse-poc/build-claude.mjs` after any change to `agents/`;
   - run the checks listed in CONTRIBUTING.md;
   - suggest the tag `<plugin>-vX.Y.Z`.
4. Never push or create tags without explicit confirmation.
