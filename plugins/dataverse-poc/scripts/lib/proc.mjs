// Process helpers shared by the plugin scripts: PATH lookup (PATHEXT aware) and spawn with timeout.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export const isWin = process.platform === 'win32';

export function findOnPath(name) {
    const exts = isWin ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')] : [''];
    for (const dir of (process.env.PATH || '').split(delimiter)) {
        if (!dir) continue;
        for (const ext of exts) {
            for (const candidate of [name + ext.toLowerCase(), name + ext]) {
                const p = join(dir, candidate);
                if (existsSync(p) && (!isWin || ext)) return p;
            }
        }
    }
    return null;
}

// Resolves { code, out } and never rejects; out merges stdout and stderr.
export function run(path, args, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const shell = isWin && /\.(cmd|bat)$/i.test(path);
        let out = '';
        let child;
        try {
            child = spawn(shell ? `"${path}"` : path, args, { shell, windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
        } catch (e) { resolve({ code: -1, out: e.message }); return; }
        const timer = setTimeout(() => { child.kill(); resolve({ code: -1, out: `timeout dopo ${timeoutMs / 1000}s` }); }, timeoutMs);
        child.stdout.on('data', (d) => (out += d));
        child.stderr.on('data', (d) => (out += d));
        child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out: e.message }); });
        child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    });
}

export const firstLine = (text) => String(text).trim().split(/\r?\n/)[0]?.slice(0, 160) ?? '';
