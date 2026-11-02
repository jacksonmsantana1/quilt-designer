// Quilts shared with the community: only the owner shares, updates or stops sharing; everyone can look; the author
// name is shown, never the email; the photos a shared quilt uses come with links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign } from '@quilt/shared/design.js';
import { photoIds } from '../src/routes/community.js';
import { setup } from './helpers.js';

const { as, pool, store } = await setup();
const ana = as('cana'),
  ben = as('cben'),
  nobody = as(null);
/** the default quilt with its first block turned: not the same quilt as the default one */
const oneTurned = () => {
  const d = defaultDesign();
  return { ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, rot: (b.rot + 1) % 4 } : b)) };
};
const share = (who, id, extra = {}) =>
  who('PUT', `/v1/shared/${id}`, { name: 'Star', author: 'Ana S.', design: defaultDesign(), ...extra });

test('sharing needs a sign-in; looking does not', async () => {
  assert.equal((await share(nobody, 'q1')).status, 401);
  const r = await nobody('GET', '/v1/community');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.items));
});

test('a shared quilt is seen by everyone, under its author name, newest first; sharing again updates it', async () => {
  assert.equal((await share(ana, 'qa', { name: 'Ana star' })).status, 201);
  assert.equal((await share(ben, 'qb', { name: 'Ben star', author: 'Ben', design: oneTurned() })).status, 201);
  let list = (await nobody('GET', '/v1/community')).body.items;
  assert.deepEqual(
    list.filter(i => /star/.test(i.name)).map(i => [i.name, i.author]),
    [
      ['Ben star', 'Ben'],
      ['Ana star', 'Ana S.'],
    ],
  );
  assert.ok(list.every(i => !i.mine && i.designId === undefined)); // which design it is: the owner's business
  // shared again (changed): updated, first again, not a second copy
  assert.equal((await share(ana, 'qa', { name: 'Ana star 2', design: { ...defaultDesign(), cols: 4 } })).status, 200);
  list = (await ana('GET', '/v1/community')).body.items;
  assert.equal(list[0].name, 'Ana star 2');
  assert.equal(list[0].design.cols, 4);
  assert.equal(list[0].mine, true);
  assert.equal(list[0].designId, 'qa');
  assert.equal(list.filter(i => i.name.startsWith('Ana star')).length, 1);
  // and search finds names and authors
  assert.deepEqual(
    (await nobody('GET', '/v1/community?q=ben')).body.items.map(i => i.name),
    ['Ben star'],
  );
});

test('only the owner stops sharing; My shared lists my own', async () => {
  await share(ana, 'qc', { name: 'Ana to stop' });
  assert.equal((await ben('DELETE', '/v1/shared/qc')).status, 404); // Ben has no such shared quilt
  assert.ok((await ana('GET', '/v1/shared')).body.items.some(i => i.designId === 'qc'));
  assert.equal((await ana('DELETE', '/v1/shared/qc')).status, 200);
  assert.ok(!(await nobody('GET', '/v1/community')).body.items.some(i => i.name === 'Ana to stop'));
  assert.ok(!(await ana('GET', '/v1/shared')).body.items.some(i => i.designId === 'qc'));
});

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const keyOf = url => url.replace('memory://', '');
/** Uploads a picture to a shared quilt: the signed link, the upload, and `done`. */
async function sendPicture(who, id, bytes = JPEG) {
  const up = await who('POST', `/v1/shared/${id}/picture/upload`, { type: 'image/jpeg', bytes: bytes.length });
  assert.equal(up.status, 200);
  store.put(keyOf(up.body.url), bytes);
  return who('POST', `/v1/shared/${id}/picture/done`);
}
const inCommunity = async name => (await nobody('GET', '/v1/community')).body.items.find(i => i.name === name);

test('a shared quilt can have a realistic picture, which everyone sees', async () => {
  await share(ana, 'qp', { name: 'Ana photo', design: { ...defaultDesign(), cols: 3 } });
  assert.equal((await inCommunity('Ana photo')).pictureUrl, undefined);
  const done = await sendPicture(ana, 'qp');
  assert.equal(done.status, 200);
  const url = (await inCommunity('Ana photo')).pictureUrl;
  assert.match(url, /^memory:\/\/pictures\//);
  assert.deepEqual(await store.get(keyOf(url)), JPEG);
  assert.ok(!store.keys().some(k => k.includes('/picture-')), 'the upload was moved to its lasting place');
  // a new picture of the same quilt replaces it
  await sendPicture(ana, 'qp', Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 9]));
  const newer = (await inCommunity('Ana photo')).pictureUrl;
  assert.notEqual(newer, url);
  assert.equal(await store.get(keyOf(url)), null);
  // sharing it again unchanged keeps the picture; changing the quilt drops it, since it no longer shows that quilt
  await share(ana, 'qp', { name: 'Ana photo', design: { ...defaultDesign(), cols: 3 } });
  assert.equal((await inCommunity('Ana photo')).pictureUrl, newer);
  await share(ana, 'qp', { name: 'Ana photo', design: { ...defaultDesign(), cols: 2 } });
  assert.equal((await inCommunity('Ana photo')).pictureUrl, undefined);
  assert.equal(await store.get(keyOf(newer)), null);
});

test('only a real picture, on your own shared quilt, is accepted', async () => {
  await share(ana, 'qq', { name: 'Ana refused', design: { ...defaultDesign(), cols: 6 } });
  // not shared, or someone else's
  const body = { type: 'image/jpeg', bytes: 10 };
  assert.equal((await ana('POST', '/v1/shared/none/picture/upload', body)).status, 404);
  assert.equal((await ben('POST', '/v1/shared/qq/picture/upload', body)).status, 404);
  assert.equal((await nobody('POST', '/v1/shared/qq/picture/upload', body)).status, 401);
  // not a JPEG, too big, or not there
  assert.equal((await ana('POST', '/v1/shared/qq/picture/upload', { type: 'image/png', bytes: 10 })).status, 400);
  assert.equal(
    (await ana('POST', '/v1/shared/qq/picture/upload', { type: 'image/jpeg', bytes: 9 * 1024 * 1024 })).status,
    400,
  );
  assert.equal((await ana('POST', '/v1/shared/qq/picture/done')).status, 404); // no link asked for
  await ana('POST', '/v1/shared/qq/picture/upload', body);
  assert.equal((await ana('POST', '/v1/shared/qq/picture/done')).status, 409); // never uploaded
  const wrong = await sendPicture(ana, 'qq', Uint8Array.from([1, 2, 3, 4, 5, 6]));
  assert.deepEqual([wrong.status, wrong.body.error], [400, 'not_a_picture']);
  assert.equal((await inCommunity('Ana refused')).pictureUrl, undefined);
});

test('stopping sharing takes the picture away too', async () => {
  await share(ana, 'qs', { name: 'Ana gone', design: { ...defaultDesign(), cols: 7 } });
  await sendPicture(ana, 'qs');
  const url = (await inCommunity('Ana gone')).pictureUrl;
  assert.equal((await ana('DELETE', '/v1/shared/qs')).status, 200);
  assert.equal(await store.get(keyOf(url)), null);
});

test('a broken quilt, an email for a name, or a missing name is refused', async () => {
  assert.equal((await share(ana, 'qd', { design: { cols: 'x' } })).status, 400);
  const e = await share(ana, 'qd', { author: 'ana@example.com' });
  assert.deepEqual([e.status, e.body.error], [400, 'author_email']);
  assert.equal((await share(ana, 'qd', { author: '   ' })).status, 400);
  assert.equal((await share(ana, 'qd', { extra: 1 })).status, 400); // unknown fields refused
});

test('its fabric photos must be on the server; then they come with links', async () => {
  const photo = 'f' + 'ab'.repeat(12);
  const d = defaultDesign(),
    design = { ...d, blocks: d.blocks.map((b, i) => (i === 0 ? { ...b, fabrics: b.fabrics.map(() => photo) } : b)) };
  assert.deepEqual(photoIds(design), [photo]);
  const miss = await share(ana, 'qe', { design });
  assert.deepEqual([miss.status, miss.body.error, miss.body.missing], [409, 'photos_missing', [photo]]);
  // the photo, uploaded (as the upload route leaves it)
  const { rows } = await pool.query("select id from users where auth_sub = 'dev:cana'");
  await pool.query(
    `insert into fabrics (owner_id, id, name, cm, type, bytes, object_key, uploaded, rev, seq)
     values ($1, $2, 'Grandma linen', 15, 'image/jpeg', 1000, $3, true, 1, nextval('change_seq'))`,
    [rows[0].id, photo, `fabrics/${rows[0].id}/${photo}`],
  );
  assert.equal((await share(ana, 'qe', { design, name: 'With a photo' })).status, 201);
  const item = (await nobody('GET', '/v1/community?q=photo')).body.items[0];
  assert.deepEqual(
    item.fabrics.map(f => [f.id, f.name, f.cm]),
    [[photo, 'Grandma linen', 15]],
  );
  assert.match(item.fabrics[0].url, /^memory:\/\/fabrics\//);
});

test('the community list never shows an email', async () => {
  await pool.query("update users set email = 'secret@example.com' where auth_sub = 'dev:cana'");
  const body = JSON.stringify((await nobody('GET', '/v1/community')).body);
  assert.ok(!body.includes('secret@example.com'));
  assert.ok(!body.includes('dev:cana'));
});

test("someone else's shared quilt, unchanged, can't be shared again; changed, it can; the owner can update theirs", async () => {
  const original = { ...defaultDesign(), cols: 3, rows: 2, blocks: defaultDesign().blocks.slice(0, 6) };
  assert.equal((await share(ana, 'qorig', { name: 'Original', design: original })).status, 201);
  // Ben's copy, renamed but the same quilt
  const copy = await share(ben, 'qcopy', { name: 'My new name', author: 'Ben', design: original });
  assert.deepEqual(
    [copy.status, copy.body.error, copy.body.sharedAs],
    [409, 'not_changed', { name: 'Original', author: 'Ana S.' }],
  );
  assert.match(copy.body.message, /the same as “Original” by Ana S\./);
  // changed (one block turned), it is his own
  const changed = {
    ...original,
    blocks: original.blocks.map((b, i) => (i === 0 ? { ...b, rot: (b.rot + 1) % 4 } : b)),
  };
  assert.equal((await share(ben, 'qcopy', { name: 'My new name', author: 'Ben', design: changed })).status, 201);
  // Ana sharing her own again is an update, not a copy
  assert.equal((await share(ana, 'qorig', { name: 'Original v2', design: original })).status, 200);
});
