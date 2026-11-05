// For working on the phone app in a browser: serves dist/ on this computer and passes the API's requests on to the live
// server, so the page sees real quilts without that server having to allow this address.
//   npm run dev -w @quilt/mobile      then open http://localhost:8200 (the browser's phone view is the closest thing)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)),
  OUT = path.join(HERE, 'dist'),
  PORT = +(process.env.PORT || 8200),
  API = process.env.API_TARGET || 'https://block-and-bind-api.fly.dev';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };

await buildApp('');
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/v1/')) {
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const headers = {};
        for (const h of ['content-type', 'authorization', 'x-dev-user'])
          if (req.headers[h]) headers[h] = req.headers[h];
        const r = await fetch(API + req.url, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
        res.end(Buffer.from(await r.arrayBuffer()));
      } catch (e) {
        res.writeHead(502).end();
      }
      return;
    }
    const file = path.join(OUT, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(OUT + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`The phone app: http://localhost:${PORT}, with quilts from ${API}`));
