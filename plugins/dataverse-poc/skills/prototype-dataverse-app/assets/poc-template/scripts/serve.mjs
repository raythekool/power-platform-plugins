// Minimal static server for the runtime mode, no dependencies. Usage: node scripts/serve.mjs [port]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { pocDir } from './lib/poc-model.mjs';

const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.yaml': 'text/yaml', '.md': 'text/markdown' };

createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(pocDir, path === '/' ? 'poc-runtime.html' : path));
    if (!file.startsWith(pocDir + sep) && file !== pocDir) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`POC su http://127.0.0.1:${port}/poc-runtime.html (Ctrl+C per fermare)`));
