// Quilts shared with the community: only the owner shares, updates or stops sharing; everyone can look; the author
// name is shown, never the email; the photos a shared quilt uses come with links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDesign } from '@quilt/shared/design.js';
import { photoIds } from '../src/routes/community.js';
import { setup } from './helpers.js';

const { as, pool } = await setup();
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
