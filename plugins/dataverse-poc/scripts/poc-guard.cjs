// PreToolUse guard: asks the user before PAC/PACX commands that delete, switch environment or import solutions.
'use strict';

const RULES = [
    { re: /\b(delete|remove|unregister|reset|purge)\b/i, why: 'operazione distruttiva' },
    { re: /\b(auth|org|env)\s+(select|create|switch)\b/i, why: 'cambio di profilo o ambiente' },
    { re: /(--environment|--url|--env|-env|-u)\s+["']?https?:\/\//i, why: 'comando verso un URL di ambiente esplicito' },
    { re: /\bsolution\s+import\b/i, why: 'import di solution (stage D)' },
];

function decide(text) {
    if (!/\bpacx?(\.exe)?\b/i.test(text)) return null;
    const hit = RULES.find((r) => r.re.test(text));
    return hit ? hit.why : null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
    let event;
    try {
        event = JSON.parse(raw || '{}');
    } catch {
        process.exit(0);
    }
    const toolName = String(event.tool_name || event.toolName || '');
    // VS Code sends tool_input as an object; Copilot CLI sends toolArgs as a JSON string.
    let input = event.tool_input ?? event.toolArgs ?? {};
    if (typeof input === 'string') {
        try { input = JSON.parse(input); } catch { input = { command: input }; }
    }
    // Only terminal commands are inspected: file edits that merely mention pac/pacx must pass.
    const command = typeof input.command === 'string' ? input.command : '';

    let why = command ? decide(command) : null;
    if (!why && /delete/i.test(toolName) && /dataverse|appmaker|greg_xrm/i.test(toolName)) why = 'operazione distruttiva via MCP';
    if (!why) process.exit(0);

    const reason = `Guardia POC: ${why}. Confermare solo se previsto dal piano e autorizzato per l'ambiente target.`;
    process.stdout.write(JSON.stringify({
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: reason,
        },
    }));
});
