// The app's sync (app/src/storage/sync.js) against this API, with two "devices": each its own storage
// (app/src/storage/repo.js on an in-memory database) talking to the same server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign } from '@quilt/shared/design.js';
import { createRepo } from '../../app/src/storage/repo.js';
import { memoryDb } from '../../app/src/storage/idb.js';
import { createSync } from '../../app/src/storage/sync.js';
import { setup } from './helpers.js';

const { app, store } = await setup();

/** fetch for the app's code: API calls go to app.inject, memory:// links to the in-memory photo storage */
let offline = false;
async function fakeFetch(url, init = {}) {
  if (offline) throw new TypeError('Failed to fetch');
  if (url.startsWith('memory://')) {
    const key = url.slice('memory://'.length);
    if (init.method === 'PUT') {
      store.put(key, new Uint8Array(await new Response(init.body).arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    const b = await store.get(key);
    return b ? new Response(b) : new Response(null, { status: 404 });
  }
  const u = new URL(url);
  const r = await app.inject({
    method: init.method || 'GET',
    url: u.pathname + u.search,
    headers: init.headers,
    payload: init.body,
  });
  return new Response(r.rawPayload.length ? r.rawPayload : null, {
    status: r.statusCode,
    headers: { 'content-type': String(r.headers['content-type'] || '') },
  });
}

async function device(user = 'ana') {
  const repo = createRepo();
  await repo.openStorage({ db: memoryDb(), legacy: null });
  const events = [];
  const sync = createSync({ repo, fetch: fakeFetch, onRemote: e => events.push(e) });
  sync.configure({ url: 'http://api.test/', user });
  return { repo, sync, events };
}
const quilt = (cols = 5) => ({ ...defaultDesign(), cols, rows: 5, blocks: defaultDesign().blocks.slice(0, cols * 5) });
const names = repo =>
  repo.designs
    .list()
    .map(d => d.name)
    .sort();
const jpeg = n =>
  new Blob([new Uint8Array(Array.from({ length: 3000 }, (_, i) => (i * 13 + n) % 256))], { type: 'image/jpeg' });

test('a quilt and a photo saved on the laptop appear on the phone', async () => {
  const laptop = await device('u1'),
    phone = await device('u1');
  const { id: fid } = await laptop.repo.fabrics.add(jpeg(1), { name: 'Paisley', cm: 15 });
  const q = laptop.repo.designs.save({ id: laptop.repo.designs.newId(), name: 'Star', design: quilt() });
  let s = await laptop.sync.syncNow();
  assert.deepEqual([s.state, s.pending], ['ok', 0]);
  s = await phone.sync.syncNow();
  assert.equal(s.state, 'ok');
  assert.deepEqual(names(phone.repo), ['Star']);
  assert.deepEqual(phone.repo.designs.get(q.id).design, q.design);
  const f = phone.repo.fabrics.get(fid);
  assert.equal(f.name, 'Paisley');
  assert.equal(f.blob.size, 3000);
  assert.deepEqual(phone.events.map(e => e.kind).sort(), ['design', 'fabric']);
  // nothing new: a second sync changes nothing and nobody is told anything
  phone.events.length = 0;
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  assert.deepEqual(phone.events, []);
  assert.deepEqual(names(laptop.repo), ['Star']);
});

test('changes go both ways; each device’s own changes are not applied twice', async () => {
  const laptop = await device('u2'),
    phone = await device('u2');
  const id = laptop.repo.designs.newId();
  laptop.repo.designs.save({ id, name: 'Nine patch', design: quilt(5) });
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  phone.repo.designs.save({ id, name: 'Nine patch', design: quilt(4) });
  await phone.sync.syncNow();
  assert.deepEqual(phone.events.filter(e => e.id === id && e.kind === 'design').length, 1); // only the first arrival
  await laptop.sync.syncNow();
  assert.equal(laptop.repo.designs.get(id).design.cols, 4);
  assert.equal(laptop.repo.designs.get(id).dirty, false);
});

test('the same quilt changed on both devices: nothing is lost, the second keeps a copy', async () => {
  const laptop = await device('u3'),
    phone = await device('u3');
  const id = laptop.repo.designs.newId();
  laptop.repo.designs.save({ id, name: 'Medallion', design: quilt(5) });
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  laptop.repo.designs.save({ id, name: 'Medallion', design: quilt(3) });
  phone.repo.designs.save({ id, name: 'Medallion', design: quilt(4) });
  await laptop.sync.syncNow(); // first to the server: its version keeps the place
  await phone.sync.syncNow();
  assert.deepEqual(names(phone.repo), ['Medallion', 'Medallion (this device)']);
  assert.equal(phone.repo.designs.get(id).design.cols, 3);
  const copy = phone.repo.designs.list().find(d => d.name.endsWith('(this device)'));
  assert.equal(copy.design.cols, 4);
  assert.deepEqual(
    phone.events.find(e => e.kind === 'conflict'),
    {
      kind: 'conflict',
      id,
      copyId: copy.id,
      name: 'Medallion',
      deleted: false,
    },
  );
  await laptop.sync.syncNow();
  assert.deepEqual(names(laptop.repo), ['Medallion', 'Medallion (this device)']);
});

test('a deletion reaches the other device; a quilt deleted here but changed elsewhere comes back', async () => {
  const laptop = await device('u4'),
    phone = await device('u4');
  const a = laptop.repo.designs.newId(),
    b = laptop.repo.designs.newId();
  laptop.repo.designs.save({ id: a, name: 'A', design: quilt() });
  laptop.repo.designs.save({ id: b, name: 'B', design: quilt() });
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  laptop.repo.designs.remove(a);
  await laptop.sync.syncNow();
  assert.equal(laptop.repo.designs.raw(a), null); // the marker is dropped once the server has the deletion
  await phone.sync.syncNow();
  assert.deepEqual(names(phone.repo), ['B']);
  // B: deleted on the phone, changed on the laptop at the same time
  phone.repo.designs.remove(b);
  laptop.repo.designs.save({ id: b, name: 'B, edited', design: quilt(3) });
  await laptop.sync.syncNow();
  await phone.sync.syncNow();
  assert.deepEqual(names(phone.repo), ['B, edited']);
  assert.ok(phone.events.some(e => e.kind === 'restored' && e.id === b));
});

test('offline: changes wait, and go when the server is back', async () => {
  const laptop = await device('u5'),
    phone = await device('u5');
  laptop.repo.designs.save({ id: laptop.repo.designs.newId(), name: 'On the train', design: quilt() });
  offline = true;
  const s = await laptop.sync.syncNow();
  offline = false;
  assert.deepEqual([s.state, s.pending], ['offline', 1]);
  assert.equal((await laptop.sync.syncNow()).state, 'ok');
  await phone.sync.syncNow();
  assert.deepEqual(names(phone.repo), ['On the train']);
});

test('a quilt the server repairs comes back repaired; one it refuses stays here with a message', async () => {
  const laptop = await device('u6');
  const broken = { ...quilt(), blockMm: 5000 };
  const id = laptop.repo.designs.newId();
  laptop.repo.designs.save({ id, name: 'Huge blocks', design: broken });
  const newer = laptop.repo.designs.newId();
  laptop.repo.designs.save({ id: newer, name: 'From the future', design: { ...quilt(), v: 99 } });
  const s = await laptop.sync.syncNow();
  assert.equal(s.state, 'error');
  assert.match(s.message, /From the future/);
  assert.equal(laptop.repo.designs.get(id).design.blockMm, 1000);
  assert.equal(laptop.repo.designs.get(newer).dirty, true);
  assert.equal(s.pending, 1);
});

test('a photo with the simple fingerprint (plain http page) stays on this device, with a message', async () => {
  const laptop = await device('u7');
  laptop.repo.fabrics.applyRemote({ id: 'h0123456789abcdef', name: 'Old photo', cm: 10, rev: 0, blob: jpeg(2) });
  laptop.repo.fabrics.resetSync(); // as if it had just been added here
  const s = await laptop.sync.syncNow();
  assert.equal(s.state, 'error');
  assert.match(s.message, /Old photo.*stays on this device/);
  assert.equal(laptop.repo.fabrics.get('h0123456789abcdef').dirty, true);
});

test("signed out (bad login): the sync stops and says so; another account doesn't get the first one's designs", async () => {
  const laptop = await device('bad name!');
  laptop.repo.designs.save({ id: laptop.repo.designs.newId(), name: 'Mine', design: quilt() });
  assert.equal((await laptop.sync.syncNow()).state, 'login');
  laptop.sync.configure({ url: 'http://api.test', user: 'u9' }); // another account: the design isn't its own
  assert.equal(laptop.sync.status().pending, 0);
  assert.equal((await laptop.sync.syncNow()).state, 'ok');
  const other = await device('u9');
  await other.sync.syncNow();
  assert.deepEqual(names(other.repo), []);
});

test('two syncs asked at once run one after the other', async () => {
  const laptop = await device('u10');
  laptop.repo.designs.save({ id: laptop.repo.designs.newId(), name: 'Q', design: quilt() });
  const [a, b] = await Promise.all([laptop.sync.syncNow(), laptop.sync.syncNow()]);
  assert.equal(a.state, 'ok');
  assert.equal(b.state, 'ok');
  const phone = await device('u10');
  await phone.sync.syncNow();
  assert.deepEqual(names(phone.repo), ['Q']); // sent once
});

// ---- signed in with Auth0: the sync sends the library's token instead of a name

/** a device whose requests are only recorded (answered with an empty change list) */
async function recorder(getToken) {
  const repo = createRepo();
  await repo.openStorage({ db: memoryDb(), legacy: null });
  const sent = [];
  const fetch = async (url, init = {}) => {
    sent.push(init.headers || {});
    return new Response(JSON.stringify({ changes: [], since: 0, more: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const sync = createSync({ repo, fetch, getToken });
  sync.configure({ url: 'http://api.test', auth0: 'auth0|ana', who: 'ana@example.com' });
  return { repo, sync, sent };
}

test('signed in with Auth0: each request carries a fresh token, and no name', async () => {
  let n = 0;
  const { sync, sent } = await recorder(async () => `token-${++n}`);
  assert.equal((await sync.syncNow()).state, 'ok');
  assert.ok(sent.length >= 1);
  assert.deepEqual(
    sent.map(h => h.authorization),
    sent.map((_, i) => `Bearer token-${i + 1}`),
  );
  assert.ok(sent.every(h => !('x-dev-user' in h)));
  assert.equal(sync.config().who, 'ana@example.com');
});

test('signed out on this device (no token): sync stops and asks to sign in again, nothing is sent', async () => {
  const { sync, sent } = await recorder(() => Promise.reject(new Error('login_required')));
  const s = await sync.syncNow();
  assert.deepEqual([s.state, s.message], ['login', 'Please sign in again.']);
  assert.equal(sent.length, 0);
});

test('another account on the same server starts afresh; the same account signing in again does not', async () => {
  const { repo, sync } = await recorder(async () => 't');
  await sync.syncNow();
  repo.setSession('sync', { ...sync.config(), since: 42 });
  sync.configure({ url: 'http://api.test/', auth0: 'auth0|ana', who: 'ana@new-mail.com' });
  assert.deepEqual([sync.config().since, sync.config().who], [42, 'ana@new-mail.com']);
  sync.configure({ url: 'http://api.test', auth0: 'auth0|bea', who: 'bea@example.com' });
  assert.equal(sync.config().since, 0);
});

// ---- one browser, several people: each account sees and syncs only its own designs

/** what the server keeps for a (development) user: the names of their designs */
async function serverNames(user) {
  const r = await app.inject({ method: 'GET', url: '/v1/changes?since=0', headers: { 'x-dev-user': user } });
  return JSON.parse(r.body)
    .changes.filter(c => c.kind === 'design' && !c.deleted)
    .map(c => c.name)
    .sort();
}
async function sharedBrowser() {
  const repo = createRepo();
  await repo.openStorage({ db: memoryDb(), legacy: null });
  const sync = createSync({ repo, fetch: fakeFetch });
  return { repo, sync, as: user => sync.configure({ url: 'http://api.test/', user }) };
}

test("two people on one browser: neither sees nor uploads the other's designs", async () => {
  const b = await sharedBrowser();
  b.as('share1');
  b.repo.designs.save({ id: b.repo.designs.newId(), name: 'Ann quilt', design: quilt() });
  await b.sync.syncNow();
  b.sync.configure(null); // signed out: Ann's quilt is out of sight
  assert.deepEqual(names(b.repo), []);
  b.as('share2');
  assert.deepEqual(names(b.repo), []);
  b.repo.designs.save({ id: b.repo.designs.newId(), name: 'Ben quilt', design: quilt() });
  await b.sync.syncNow();
  assert.deepEqual(await serverNames('share2'), ['Ben quilt']); // nothing of Ann's went to Ben's account
  b.as('share1'); // Ann again: hers are back, Ben's are not
  await b.sync.syncNow();
  assert.deepEqual(names(b.repo), ['Ann quilt']);
  assert.deepEqual(await serverNames('share1'), ['Ann quilt']);
});

test('designs made without an account stay local until the account takes them; the samples are never offered', async () => {
  const b = await sharedBrowser();
  b.repo.designs.save({ id: b.repo.designs.newId(), name: 'Made here', design: quilt() });
  b.repo.designs.save({ id: 'qsample', name: 'Sample', design: quilt() });
  b.repo.designs.markSample('qsample');
  b.as('share3');
  assert.deepEqual(names(b.repo), ['Made here', 'Sample']); // listed for the account too
  assert.deepEqual(
    b.repo.designs.strays().map(r => r.name),
    ['Made here'],
  );
  await b.sync.syncNow();
  assert.deepEqual(await serverNames('share3'), []); // not sent before the account takes them
  assert.equal(b.repo.designs.adoptStrays(), 1);
  await b.sync.syncNow();
  assert.deepEqual(await serverNames('share3'), ['Made here']);
  b.sync.configure(null);
  assert.deepEqual(names(b.repo), ['Sample']); // now the account's: out of sight when signed out
});

test("set up before designs had owners: what was synced becomes that account's, what was not stays local", async () => {
  const repo = createRepo();
  await repo.openStorage({ db: memoryDb(), legacy: null });
  repo.designs.save({ id: 'old1', name: 'Synced before', design: quilt() });
  repo.designs.markSynced('old1', 1, 3); // on the server already (rev 3)
  repo.designs.save({ id: 'old2', name: 'Never synced', design: quilt() });
  repo.setSession('sync', { url: 'http://api.test', user: 'Share4', since: 0 }); // an older version's setting
  createSync({ repo, fetch: fakeFetch });
  assert.equal(repo.account(), 'dev:share4');
  assert.equal(repo.designs.get('old1').owner, 'dev:share4');
  assert.equal(repo.designs.get('old2').owner, undefined);
});
