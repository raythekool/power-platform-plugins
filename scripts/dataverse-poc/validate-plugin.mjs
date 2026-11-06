// Validates the dataverse-poc plugin: manifests, skill/agent frontmatter, subagent references,
// Claude Code variant (.claude-plugin/ + claude/), relative links, hook scripts, plugin scripts referenced by
// agents and skills, JavaScript syntax.
// Repository-wide checks (both marketplaces, versions, confidentiality) live in scripts/validate-marketplace.mjs.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLUGIN = 'dataverse-poc';
const errors = [];
const BUILTIN_AGENTS = new Set(['Explore', 'Plan']);

const readJson = (file) => {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
        errors.push(`${file}: JSON non valido (${e.message})`);
        return null;
    }
};

const frontmatter = (file) => {
    if (!existsSync(file)) return null;
    const m = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const get = (key) => {
        const r = m[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
        return r ? r[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };
    const list = (key) => {
        const r = m[1].match(new RegExp(`^${key}:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
        return r ? r[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
    };
    return { get, list };
};

const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === 'node_modules' || n === '.git' ? [] : walk(p)) : [p];
});

const market = readJson(join(root, '.github', 'plugin', 'marketplace.json'));
const entry = (market?.plugins ?? []).find((p) => p.name === PLUGIN);
if (!entry) errors.push(`marketplace: voce ${PLUGIN} mancante`);
const pluginDir = entry ? resolve(root, entry.source) : null;
if (pluginDir && !existsSync(pluginDir)) errors.push(`marketplace: source mancante ${entry.source}`);

if (pluginDir && existsSync(pluginDir)) {
    const manifest = readJson(join(pluginDir, 'plugin.json'));
    if (manifest) {
        if (manifest.name !== entry.name) errors.push(`${entry.name}: name diverso fra marketplace e plugin.json`);
        if (manifest.version !== entry.version) errors.push(`${entry.name}: version diversa fra marketplace (${entry.version}) e plugin.json (${manifest.version})`);

        // Copilot format: skills/, agents/, hooks.json
        const skillsDir = join(pluginDir, manifest.skills ?? 'skills');
        for (const skill of readdirSync(skillsDir)) {
            const fm = frontmatter(join(skillsDir, skill, 'SKILL.md'));
            if (!fm) { errors.push(`skill ${skill}: SKILL.md o frontmatter mancante`); continue; }
            if (fm.get('name') !== skill) errors.push(`skill ${skill}: name "${fm.get('name')}" diverso dalla cartella`);
            if (!fm.get('description')) errors.push(`skill ${skill}: description mancante`);
        }

        const agentsDir = join(pluginDir, manifest.agents ?? 'agents');
        const agents = readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md')).map((f) => ({ f, fm: frontmatter(join(agentsDir, f)) }));
        const names = new Set(agents.map((a) => a.fm?.get('name')));
        for (const { f, fm } of agents) {
            if (!fm?.get('name') || !fm.get('description')) errors.push(`agent ${f}: name o description mancante`);
            // Only the main agent (the one with `agents:`) is shown in the picker; sub-agents are hidden.
            const isMain = (fm?.list('agents') ?? []).length > 0;
            if (!isMain && fm?.get('user-invocable') !== 'false') errors.push(`agent ${f}: sotto-agente senza user-invocable: false (comparirebbe nel selettore)`);
            if (isMain && fm?.get('user-invocable') === 'false') errors.push(`agent ${f}: l'agente principale non deve avere user-invocable: false`);
            for (const sub of fm?.list('agents') ?? []) {
                if (!names.has(sub) && !BUILTIN_AGENTS.has(sub)) errors.push(`agent ${f}: sotto-agente "${sub}" inesistente`);
            }
        }

        // Plugin scripts named in agents and skills must exist (agents run them by name).
        // Copilot files use <plugin-root>, the generated Claude files ${CLAUDE_PLUGIN_ROOT}.
        for (const file of walk(pluginDir).filter((f) => f.endsWith('.md'))) {
            for (const m of readFileSync(file, 'utf8').matchAll(/(?:<plugin-root>|\$\{CLAUDE_PLUGIN_ROOT\})\/scripts\/([\w.-]+\.m?c?js)/g)) {
                if (!existsSync(join(pluginDir, 'scripts', m[1]))) errors.push(`${file.replace(root, '.')}: script inesistente scripts/${m[1]}`);
            }
        }

        const hooksFile = join(pluginDir, manifest.hooks ?? 'hooks.json');
        if (existsSync(hooksFile)) {
            for (const script of readFileSync(hooksFile, 'utf8').match(/scripts\/[\w.-]+/g) ?? []) {
                if (!existsSync(join(pluginDir, script))) errors.push(`hooks: script mancante ${script}`);
            }
        }

        // Claude Code format: .claude-plugin/plugin.json + claude/ (generated by build-claude.mjs).
        // VS Code also loads this format (and agents/ on top), so every Claude sub-agent must be hidden from its picker.
        const claudeFile = join(pluginDir, '.claude-plugin', 'plugin.json');
        const claude = existsSync(claudeFile) ? readJson(claudeFile) : null;
        if (!claude) errors.push(`${entry.name}: .claude-plugin/plugin.json mancante`);
        else {
            if (claude.name !== entry.name || claude.version !== manifest.version) errors.push(`${entry.name}: name/version di .claude-plugin/plugin.json diversi da plugin.json`);
            const claudeAgentsDir = join(pluginDir, 'claude', 'agents');
            const files = existsSync(claudeAgentsDir) ? readdirSync(claudeAgentsDir).sort() : [];
            const listed = [].concat(claude.agents ?? []).map((a) => a.replace(/^\.\/claude\/agents\//, '')).sort();
            if (JSON.stringify(listed) !== JSON.stringify(files)) errors.push(`${entry.name}: "agents" di .claude-plugin/plugin.json non coincide con claude/agents/`);
            const subAgents = agents.filter((a) => !a.fm?.list('agents').length).map((a) => a.f.replace(/\.agent\.md$/, '.md')).sort();
            if (JSON.stringify(subAgents) !== JSON.stringify(files)) errors.push(`${entry.name}: claude/agents/ non corrisponde ai sotto-agenti di agents/ (eseguire build-claude.mjs)`);
            for (const f of files) {
                const fm = frontmatter(join(claudeAgentsDir, f));
                if (!fm?.get('name') || !fm.get('description')) errors.push(`claude agent ${f}: name o description mancante`);
                if (fm?.get('tools')) errors.push(`claude agent ${f}: 'tools' non previsto (il sotto-agente eredita gli strumenti)`);
                if (fm?.get('user-invocable') !== 'false') errors.push(`claude agent ${f}: user-invocable: false mancante (in VS Code comparirebbe nel selettore)`);
            }
            for (const dir of [].concat(claude.skills ?? [])) {
                const base = resolve(pluginDir, dir);
                for (const skill of existsSync(base) ? readdirSync(base) : []) {
                    const fm = frontmatter(join(base, skill, 'SKILL.md'));
                    if (!fm || fm.get('name') !== skill || !fm.get('description')) errors.push(`claude skill ${skill}: frontmatter mancante, name diverso dalla cartella o description mancante`);
                }
            }
            const claudeHooks = typeof claude.hooks === 'string' ? resolve(pluginDir, claude.hooks) : null;
            const hooks = claudeHooks && existsSync(claudeHooks) ? readJson(claudeHooks) : null;
            if (!hooks?.hooks?.PreToolUse) errors.push(`${entry.name}: hooks Claude con PreToolUse mancanti (${claude.hooks})`);
            else for (const script of JSON.stringify(hooks).match(/scripts\/[\w.-]+/g) ?? []) {
                if (!existsSync(join(pluginDir, script))) errors.push(`hooks Claude: script mancante ${script}`);
            }
            // With plugin.json present the Claude marketplace entry must not add components (they would be appended).
            const claudeEntry = (readJson(join(root, '.claude-plugin', 'marketplace.json'))?.plugins ?? []).find((p) => p.name === PLUGIN);
            for (const k of ['agents', 'skills', 'hooks', 'commands']) if (claudeEntry?.[k]) errors.push(`${entry.name}: la voce di .claude-plugin/marketplace.json non deve dichiarare "${k}"`);
        }
    }

    for (const file of walk(pluginDir).filter((f) => f.endsWith('.md'))) {
        const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\r\n]*`/g, '');
        for (const m of text.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
            const target = m[1];
            if (/^(https?:|mailto:)/.test(target)) continue;
            if (!existsSync(resolve(dirname(file), decodeURIComponent(target)))) errors.push(`${file.replace(root, '.')}: link rotto ${target}`);
        }
    }
}

// Syntax check of every script of this plugin (plugin scripts, POC template, assets) and of its tooling.
const jsRoots = [pluginDir, join(root, 'scripts', PLUGIN), join(root, 'tests', PLUGIN)].filter((d) => d && existsSync(d));
for (const file of jsRoots.flatMap(walk).filter((f) => /\.(mjs|cjs|js)$/.test(f))) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0) errors.push(`${file.replace(root, '.')}: sintassi non valida (${r.stderr.trim().split('\n').find((l) => /Error/.test(l)) ?? ''})`);
}

if (errors.length) {
    errors.forEach((e) => console.error(`ERRORE  ${e}`));
    process.exit(1);
}
console.log(`Plugin ${PLUGIN} valido.`);
