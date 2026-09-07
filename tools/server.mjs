import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { bundle, root } from './bundle.mjs';
const publicRoot = path.join(root, 'public');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/canvas-assets.js') { response.writeHead(200, { 'Content-Type':mime['.js'] }); response.end('window.LUOYE_IMAGE_DATA = {};'); return; }
    if (pathname === '/app.js') { response.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control':'no-store' }); response.end(await bundle()); return; }
    if (pathname === '/health') { response.writeHead(200, { 'Content-Type':'application/json' }); response.end(JSON.stringify({ ok:true, app:'luoye-artboard' })); return; }
    if (pathname.includes('\0')) throw new Error('Invalid path');
    // Development-only test/source routes; never copied into the client bundle.
    const allowedRoot = pathname.startsWith('/tests/') ? path.join(root,'tests') : pathname.startsWith('/src/') ? path.join(root,'src') : publicRoot;
    const relative = allowedRoot === publicRoot ? (pathname === '/' ? 'index.html' : pathname) : pathname.split('/').slice(2).join('/');
    const target = await realpath(path.join(allowedRoot, relative));
    if (!target.startsWith(allowedRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`落叶画板 http://127.0.0.1:${server.address().port}`));
