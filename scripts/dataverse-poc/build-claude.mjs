// Generates the Claude Code variant of the dataverse-poc agents from the Copilot sources.
//   agents/poc-*.agent.md                    -> claude/agents/poc-*.md        (sub-agents)
//   agents/dataverse-poc-orchestrator.agent.md -> claude/skills/orchestrator/SKILL.md
// The body is copied as is (relative links re-based); only the front matter changes.
// In Claude Code sub-agents cannot start other sub-agents, so the orchestrator runs as a skill
// in the main conversation. Usage: node build-claude.mjs [--check]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = join(root, 'plugins', 'dataverse-poc');
const check = process.argv.includes('--check');
const ORCHESTRATOR = 'dataverse-poc-orchestrator.agent.md';
// Copilot tool sets without `edit` become read-only sub-agents in Claude Code.
const READ_ONLY = 'Edit, Write, NotebookEdit';

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

// Re-bases relative Markdown links from the source folder to the target folder.
const rebase = (body, fromDir, toDir) => body.replace(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (all, target) => {
    const abs = resolve(fromDir, target);
    return `](${relative(toDir, abs).split('\\').join(posix.sep)})`;
});

const header = (source) => `<!-- Generated from agents/${source} by scripts/dataverse-poc/build-claude.mjs: edit the source, not this file. -->\n`;

const outputs = new Map();
const agentsDir = join(plugin, 'agents');
for (const f of readdirSync(agentsDir).filter((n) => n.endsWith('.agent.md')).sort()) {
    const src = parse(join(agentsDir, f));
    if (f === ORCHESTRATOR) {
        const toDir = join(plugin, 'claude', 'skills', 'orchestrator');
        const subs = src.list('agents').filter((a) => a !== 'Explore');
        const fm = [
            '---',
            'name: orchestrator',
            `description: ${src.get('description')}`,
            src.get('argument-hint') ? `argument-hint: ${src.get('argument-hint')}` : null,
            '---',
        ].filter(Boolean).join('\n');
        const preamble = [
            '> [!NOTE]',
            '> **Claude Code.** Questa skill è l\'orchestratore e lavora nella conversazione principale, perché in Claude Code solo il thread principale può delegare.',
            `> Delega con lo strumento Agent impostando \`subagent_type\` a \`dataverse-poc:<nome>\` (${subs.map((s) => `\`dataverse-poc:${s}\``).join(', ')}); \`Explore\` resta \`Explore\`.`,
            '> Le skill del plugin si richiamano come `dataverse-poc:<skill>`. Dove il testo parla di "todo" usa la lista dei task di Claude Code.',
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
        '---',
    ].filter(Boolean).join('\n');
    outputs.set(join(toDir, f.replace(/\.agent\.md$/, '.md')), `${fm}\n\n${header(f)}\n${rebase(src.body.replace(/^\n+/, ''), agentsDir, toDir)}`);
}

let stale = 0;
for (const [file, content] of outputs) {
    const current = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current === content) continue;
    if (check) { console.error(`STALE  ${relative(root, file)}`); stale++; continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
    console.log(`wrote  ${relative(root, file)}`);
}
// Generated agent files that no longer have a source.
const genAgents = join(plugin, 'claude', 'agents');
if (existsSync(genAgents)) {
    for (const f of readdirSync(genAgents)) {
        if (![...outputs.keys()].includes(join(genAgents, f))) { console.error(`ORPHAN ${relative(root, join(genAgents, f))}`); stale++; }
    }
}
if (stale) { console.error(check ? 'Claude files out of date: run node scripts/dataverse-poc/build-claude.mjs' : 'Remove orphan files.'); process.exit(1); }
console.log(check ? 'Claude files up to date.' : `${outputs.size} Claude files in sync.`);
