import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import path from 'node:path';
import { bundle, root } from './bundle.mjs';
const publicRoot = path.join(root, 'public');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const gzipAsync = promisify(gzip);
const compressible = /^(?:text\/|application\/(?:javascript|json|wasm)|image\/svg\+xml)/;
async function send(request, response, body, headers = {}) {
  const value = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const type = headers['Content-Type'] || '';
  const acceptsGzip = /(?:^|,)\s*gzip(?:\s*;[^,]*)?/i.test(request.headers['accept-encoding'] || '') && !/gzip\s*;\s*q\s*=\s*0/i.test(request.headers['accept-encoding'] || '');
  const compressed = acceptsGzip && value.length >= 1024 && compressible.test(type);
  const payload = compressed ? await gzipAsync(value, { level: 6 }) : value;
  response.writeHead(200, { ...headers, 'Content-Length': payload.length, ...(compressed ? { 'Content-Encoding':'gzip', Vary:'Accept-Encoding' } : {}) });
  response.end(request.method === 'HEAD' ? undefined : payload);
}
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/canvas-assets.js') { await send(request, response, 'window.LUOYE_IMAGE_DATA = {};', { 'Content-Type':mime['.js'] }); return; }
    if (pathname === '/app.js') { await send(request, response, await bundle(), { 'Content-Type': mime['.js'], 'Cache-Control':'no-store' }); return; }
    if (pathname === '/health') { await send(request, response, JSON.stringify({ ok:true, app:'luoye-artboard' }), { 'Content-Type':'application/json' }); return; }
    if (pathname.includes('\0')) throw new Error('Invalid path');
    // Development-only test/source routes; never copied into the client bundle.
    const allowedRoot = pathname.startsWith('/tests/') ? path.join(root,'tests') : pathname.startsWith('/src/') ? path.join(root,'src') : publicRoot;
    const relative = allowedRoot === publicRoot ? (pathname === '/' ? 'index.html' : pathname) : pathname.split('/').slice(2).join('/');
    const target = await realpath(path.join(allowedRoot, relative));
    if (!target.startsWith(allowedRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    const content = await readFile(target);
    await send(request, response, content, { 'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`落叶画板 http://127.0.0.1:${server.address().port}`));
