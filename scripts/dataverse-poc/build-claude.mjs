// Generates the Claude Code variant of dataverse-poc from the Copilot sources.
//   agents/poc-*.agent.md          -> plugins/dataverse-poc/claude/agents/poc-*.md    (sub-agents)
//   agents/poc-dataverse.agent.md  -> plugins/dataverse-poc/claude/skills/poc/SKILL.md (main agent, /dataverse-poc:poc)
//   manifest and PreToolUse hook   -> plugins/dataverse-poc/.claude-plugin/plugin.json, claude/hooks.json
// The body is copied as is (relative links re-based); only the front matter changes.
//
// Two harnesses read these files:
// - Claude Code reads only the agents listed in .claude-plugin/plugin.json (the "agents" key replaces the default
//   agents/ scan). In Claude Code sub-agents cannot start other sub-agents, so the main agent becomes a skill.
// - VS Code picks the Claude format whenever .claude-plugin/plugin.json exists, and it always scans agents/ too:
//   it loads both the Copilot agents and the Claude copies. The Claude copies therefore carry
//   `user-invocable: false`, so that only the main agent appears in the VS Code agent picker.
//
// Usage: node scripts/dataverse-poc/build-claude.mjs [--check]
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLUGIN = 'dataverse-poc';
const plugin = join(root, 'plugins', PLUGIN);
const check = process.argv.includes('--check');
const MAIN_AGENT = 'poc-dataverse.agent.md';
const MAIN_SKILL = 'poc';
// Copilot tool sets without `edit` become read-only sub-agents in Claude Code.
const READ_ONLY = 'Edit, Write, NotebookEdit';
const HOOKS = {
    PreToolUse: [
        {
            matcher: 'Bash|PowerShell|mcp__.*',
            hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/poc-guard.cjs'], timeout: 10 }],
        },
    ],
};

const parse = (file) => {
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) throw new Error(`${file}: front matter missing`);
    const fm = m[1];
    const get = (key) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1].trim();
    const list = (key) => fm.match(new RegExp(`^${key}:\\s*\\[([\\s\\S]*?)\\]`, 'm'))?.[1]
        .split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) ?? [];
    return { get, list, body: m[2] };
};

// Re-bases relative Markdown links from the source folder to the target folder, and turns the Copilot
// placeholder <plugin-root> into ${CLAUDE_PLUGIN_ROOT}, which Claude Code substitutes in agent and skill bodies.
const rebase = (body, fromDir, toDir) => body.replaceAll('<plugin-root>', '${CLAUDE_PLUGIN_ROOT}').replace(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (all, target) => {
    const abs = resolve(fromDir, target);
    return `](${relative(toDir, abs).split('\\').join(posix.sep)})`;
});

const header = (source) => `<!-- Generated from agents/${source} by scripts/dataverse-poc/build-claude.mjs: edit the source, not this file. -->\n`;

const outputs = new Map();
const agentsDir = join(plugin, 'agents');
const subAgents = [];
let mainFound = false;
for (const f of readdirSync(agentsDir).filter((n) => n.endsWith('.agent.md')).sort()) {
    const src = parse(join(agentsDir, f));
    if (f === MAIN_AGENT) {
        mainFound = true;
        const toDir = join(plugin, 'claude', 'skills', MAIN_SKILL);
        const subs = src.list('agents').filter((a) => a !== 'Explore');
        const fm = [
            '---',
            `name: ${MAIN_SKILL}`,
            `description: ${src.get('description')}`,
            src.get('argument-hint') ? `argument-hint: ${src.get('argument-hint')}` : null,
            '---',
        ].filter(Boolean).join('\n');
        const preamble = [
            '> [!NOTE]',
            `> **Claude Code.** Questa skill è l'agente ${src.get('name').replace(/^["']|["']$/g, '')} e lavora nella conversazione principale, perché in Claude Code solo il thread principale può delegare.`,
            `> Delega con lo strumento Agent impostando \`subagent_type\` a \`${PLUGIN}:<nome>\` (${subs.map((s) => `\`${PLUGIN}:${s}\``).join(', ')}); \`Explore\` resta \`Explore\`.`,
            `> Le skill del plugin si richiamano come \`${PLUGIN}:<skill>\`. Dove il testo parla di "todo" usa la lista dei task di Claude Code.`,
            '',
        ].join('\n');
        outputs.set(join(toDir, 'SKILL.md'), `${fm}\n\n${header(f)}\n${preamble}\n${rebase(src.body.replace(/^\n+/, ''), agentsDir, toDir)}`);
        continue;
    }
    const toDir = join(plugin, 'claude', 'agents');
    const name = src.get('name').replace(/^["']|["']$/g, '');
    const tools = src.list('tools');
    const fm = [
        '---',
        `name: ${name}`,
        `description: ${src.get('description')}`,
        tools.includes('edit') ? null : `disallowedTools: ${READ_ONLY}`,
        // Ignored by Claude Code; hides this copy from the VS Code agent picker (see the header).
        'user-invocable: false',
        '---',
    ].filter(Boolean).join('\n');
    const file = f.replace(/\.agent\.md$/, '.md');
    subAgents.push(`./claude/agents/${file}`);
    outputs.set(join(toDir, file), `${fm}\n\n${header(f)}\n${rebase(src.body.replace(/^\n+/, ''), agentsDir, toDir)}`);
}
if (!mainFound) throw new Error(`agents/${MAIN_AGENT} not found`);

// Claude manifest: name, version, author and keywords follow the Copilot plugin.json; components point to claude/.
const copilot = JSON.parse(readFileSync(join(plugin, 'plugin.json'), 'utf8'));
const manifest = {
    name: copilot.name,
    version: copilot.version,
    description: 'Multi-agent Dataverse POC: the poc skill (agent POC Dataverse) plans the POC (model-driven, code app or Power Pages SPA site), opens stages with user confirmation and delegates to sub-agents for HTML/YAML prototype, data model, demo data, forms/views/sitemap, generative pages, PCF, web resources, code app, React Power Pages site, tests and deploy. Deterministic scripts do the mechanical work; a PreToolUse guard asks before risky PAC/PACX commands.',
    author: copilot.author,
    repository: 'https://github.com/raythekool/power-platform-plugins',
    license: 'MIT',
    keywords: copilot.keywords,
    agents: subAgents,
    skills: ['./claude/skills/'],
    hooks: './claude/hooks.json',
};
outputs.set(join(plugin, '.claude-plugin', 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
outputs.set(join(plugin, 'claude', 'hooks.json'), `${JSON.stringify({ hooks: HOOKS }, null, 2)}\n`);

let stale = 0;
for (const [file, content] of outputs) {
    const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current === content) continue;
    if (check) { console.error(`STALE  ${relative(root, file)}`); stale++; continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
    console.log(`wrote  ${relative(root, file)}`);
}
// Generated files that no longer have a source.
const expected = {
    [join(plugin, 'claude', 'agents')]: subAgents.map((a) => a.split('/').pop()),
    [join(plugin, 'claude', 'skills')]: [MAIN_SKILL],
    [join(plugin, 'claude')]: ['agents', 'skills', 'hooks.json'],
};
for (const [dir, keep] of Object.entries(expected)) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => !keep.includes(n))) {
        const p = join(dir, f);
        if (check) { console.error(`ORPHAN ${relative(root, p)}`); stale++; } else { rmSync(p, { recursive: true, force: true }); console.log(`removed ${relative(root, p)}`); }
    }
}
if (stale) { console.error('Claude files out of date: run node scripts/dataverse-poc/build-claude.mjs'); process.exit(1); }
console.log(check ? 'Claude files up to date.' : `${outputs.size} Claude files in sync.`);
