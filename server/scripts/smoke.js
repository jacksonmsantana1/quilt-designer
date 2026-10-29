// A quick check of a running server, end to end over HTTP, with real photo storage:
//   API_URL=http://localhost:8787 npm run smoke -w @quilt/server
// Saves a quilt, uploads a fabric photo through its signed link, reads both back through /v1/changes.
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { defaultDesign } from '@quilt/shared/design.js';

const API = process.env.API_URL || 'http://localhost:8787';
const user = 'smoke-' + Date.now();
const call = async (method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'x-dev-user': user, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(json)}`);
  return json;
};
const step = (t, v) => console.log(`✓ ${t}${v ? ': ' + v : ''}`);

const id = randomUUID();
const saved = await call('PUT', `/v1/designs/${id}`, { name: 'Smoke test', design: defaultDesign(), baseRev: 0 });
step('quilt saved', `rev ${saved.record.rev}`);

const img = fs.readFileSync(new URL('../../app/assets/fabric/paisley.jpg', import.meta.url));
const fid = 'f' + createHash('sha256').update(img).digest('hex').slice(0, 24);
const up = await call('POST', `/v1/fabrics/${fid}/upload`, {
  name: 'Paisley',
  cm: 15,
  type: 'image/jpeg',
  bytes: img.length,
});
step('upload link', up.status);
const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: img });
if (!put.ok) throw new Error(`upload to storage: ${put.status} ${await put.text()}`);
step('photo uploaded straight to storage', `${img.length} bytes`);
const done = await call('POST', `/v1/fabrics/${fid}/done`);
step('photo checked by the server', `rev ${done.record.rev}`);
// using the upload link again cannot change the checked photo: it was moved to its lasting place
await fetch(up.url, { method: 'PUT', headers: up.headers, body: img.subarray(0, 100) });
const ch = await call('GET', '/v1/changes?since=0');
step('changes', ch.changes.map(c => `${c.kind} ${c.name}`).join(', '));
const got = await call('GET', `/v1/fabrics/${fid}`);
const back = Buffer.from(await (await fetch(got.url)).arrayBuffer());
step('photo read back through its link', back.equals(img) ? 'identical' : 'DIFFERENT');
if (!back.equals(img)) process.exitCode = 1;
