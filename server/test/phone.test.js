// What the phone app adds: photos of quilts, fabric folders and notes, blocking someone, and deleting an account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultDesign } from '@quilt/shared/design.js';
import { setup } from './helpers.js';

const { as, pool, store } = await setup();
const ana = as('pana'),
  ben = as('pben'),
  nobody = as(null);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const keyOf = url => url.replace('memory://', '');
const body = (extra = {}) => ({ quiltId: 'quilt-1', bytes: JPEG.length, takenAt: 1_780_000_000_000, ...extra });
/** Uploads a photo: the signed link, the upload, and `done`. */
async function sendPhoto(who, id = randomUUID(), extra = {}, bytes = JPEG) {
  const up = await who('POST', `/v1/photos/${id}/upload`, body({ bytes: bytes.length, ...extra }));
  assert.equal(up.status, 200);
  store.put(keyOf(up.body.url), bytes);
  const done = await who('POST', `/v1/photos/${id}/done`);
  return { id, done };
}

test('photos need a sign-in, and are only ever seen by their owner', async () => {
  assert.equal((await nobody('GET', '/v1/photos')).status, 401);
  assert.equal((await nobody('POST', `/v1/photos/${randomUUID()}/upload`, body())).status, 401);
  const { id, done } = await sendPhoto(ana);
  assert.equal(done.status, 200);
  const mine = (await ana('GET', '/v1/photos')).body.items;
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].id, mine[0].quiltId, mine[0].takenAt], [id, 'quilt-1', 1_780_000_000_000]);
  assert.deepEqual(await store.get(keyOf(mine[0].url)), JPEG);
  assert.ok(!store.keys().some(k => k.includes('/photo-')), 'the upload was moved to its lasting place');
  assert.deepEqual((await ben('GET', '/v1/photos')).body.items, []);
  assert.equal((await ben('POST', `/v1/photos/${id}/done`)).status, 404);
  // Ben deleting Ana's photo does nothing
  assert.equal((await ben('DELETE', `/v1/photos/${id}`)).status, 200);
  assert.equal((await ana('GET', '/v1/photos')).body.items.length, 1);
  assert.equal((await ana('DELETE', `/v1/photos/${id}`)).status, 200);
  assert.deepEqual((await ana('GET', '/v1/photos')).body.items, []);
  assert.equal(await store.get(keyOf(mine[0].url)), null);
  assert.equal((await ana('DELETE', `/v1/photos/${id}`)).status, 200, 'already gone is fine');
});

test('a photo offline can be sent again without a copy, and a quilt with no design has an album', async () => {
  const id = randomUUID();
  await ana('POST', `/v1/photos/${id}/upload`, body()); // the connection is lost here
  assert.deepEqual((await ana('GET', '/v1/photos')).body.items, [], 'not listed until it arrives');
  assert.equal((await ana('POST', `/v1/photos/${id}/done`)).status, 409, 'not uploaded yet');
  await sendPhoto(ana, id, { quiltId: 'album-1', album: 'Grandma’s quilt' });
  const again = await ana('POST', `/v1/photos/${id}/upload`, body());
  assert.equal(again.body.status, 'have');
  const list = (await ana('GET', '/v1/photos')).body.items.filter(p => p.id === id);
  assert.deepEqual([list.length, list[0].album], [1, 'Grandma’s quilt']);
  await ana('DELETE', `/v1/photos/${id}`);
});

test('only a real picture of the announced size is kept, and a person’s room runs out', async () => {
  const wrong = await sendPhoto(ana, undefined, {}, Uint8Array.from([1, 2, 3, 4, 5, 6]));
  assert.deepEqual([wrong.done.status, wrong.done.body.error], [400, 'not_a_picture']);
  assert.equal((await ana('POST', `/v1/photos/${randomUUID()}/upload`, body({ bytes: 9 * 1024 * 1024 }))).status, 400);
  assert.equal((await ana('POST', `/v1/photos/not-an-id/upload`, body())).status, 400);
  const tight = await setup({ MAX_PHOTO_MB_PER_PERSON: '1' });
  const up = await tight.as('tight')('POST', `/v1/photos/${randomUUID()}/upload`, body({ bytes: 1024 * 1024 + 1 }));
  assert.deepEqual([up.status, up.body.error], [413, 'storage_full']);
});

test('folders: only the owner’s, the newest change wins, and a deleted one stays as a marker', async () => {
  const id = randomUUID(),
    put = (who, name, updatedAt, extra = {}) =>
      who('PUT', `/v1/folders/${id}`, {
        name,
        fabricIds: ['b1', 'c4'],
        position: 2,
        deleted: false,
        updatedAt,
        ...extra,
      });
  assert.equal((await put(nobody, 'Christmas', 10)).status, 401);
  assert.equal((await put(ana, 'Christmas', 1000)).body.record.name, 'Christmas');
  // an older change from another device doesn't overwrite it, and the answer says what the server has
  assert.equal((await put(ana, 'Old name', 500)).body.record.name, 'Christmas');
  assert.equal((await put(ana, 'Xmas', 2000)).body.record.name, 'Xmas');
  assert.deepEqual((await ben('GET', '/v1/organize')).body.folders, []);
  const [f] = (await ana('GET', '/v1/organize')).body.folders;
  assert.deepEqual([f.name, f.fabricIds, f.position, f.deleted], ['Xmas', ['b1', 'c4'], 2, false]);
  await put(ana, 'Xmas', 3000, { deleted: true });
  assert.equal((await ana('GET', '/v1/organize')).body.folders[0].deleted, true);
  assert.equal((await put(ana, 'x'.repeat(61), 4000)).status, 400);
  assert.equal((await put(ana, 'Bad', 4000, { fabricIds: ['no spaces'] })).status, 400);
});

test('notes on a fabric: the owner’s, and the newest change wins', async () => {
  const put = (who, amount, updatedAt) => who('PUT', '/v1/fabric-notes/b1', { amount, place: 'Box 1', updatedAt });
  assert.equal((await put(nobody, '2 m', 10)).status, 401);
  assert.equal((await put(ana, '2 m', 1000)).body.record.amount, '2 m');
  assert.equal((await put(ana, '9 m', 500)).body.record.amount, '2 m');
  assert.equal((await put(ana, '1 m', 2000)).body.record.amount, '1 m');
  assert.deepEqual((await ben('GET', '/v1/organize')).body.notes, []);
  assert.deepEqual(
    (await ana('GET', '/v1/organize')).body.notes.map(n => [n.fabricId, n.amount, n.place]),
    [['b1', '1 m', 'Box 1']],
  );
});

test('a fabric photo sent again with another name is renamed, and other devices learn of it', async () => {
  const data = Uint8Array.from([1, 2, 3, 4]);
  const { createHash } = await import('node:crypto');
  const id = 'f' + createHash('sha256').update(data).digest('hex').slice(0, 24);
  const send = (name, cm = 30) =>
    ana('POST', `/v1/fabrics/${id}/upload`, { name, cm, type: 'image/jpeg', bytes: data.length });
  const up = await send('Fabric 1');
  store.put(keyOf(up.body.url), data);
  const done = await ana('POST', `/v1/fabrics/${id}/done`);
  assert.equal(done.status, 200);
  const before = (await ana('GET', '/v1/changes?since=0')).body.since;
  const same = await send('Fabric 1');
  assert.deepEqual([same.body.status, same.body.record.rev], ['have', done.body.record.rev], 'nothing changed');
  const renamed = await send('Deep rose');
  assert.deepEqual([renamed.body.record.name, renamed.body.record.rev], ['Deep rose', done.body.record.rev + 1]);
  const { changes } = (await ana('GET', `/v1/changes?since=${before}`)).body;
  assert.deepEqual(
    changes.map(c => [c.id, c.name]),
    [[id, 'Deep rose']],
  );
});

test('blocking someone hides their quilts from me only; unblocking brings them back', async () => {
  const lia = as('plia'),
    theo = as('ptheo');
  const put = await theo('PUT', '/v1/shared/qt', {
    name: 'Theo quilt',
    author: 'Theo',
    design: { ...defaultDesign(), cols: 3 },
  });
  const { id } = put.body.item;
  const names = async who => (await who('GET', '/v1/community')).body.items.map(i => i.name);
  assert.ok((await names(lia)).includes('Theo quilt'));
  assert.equal((await nobody('POST', `/v1/community/${id}/block`)).status, 401);
  assert.equal((await theo('POST', `/v1/community/${id}/block`)).status, 400, 'not oneself');
  assert.equal((await lia('POST', `/v1/community/${randomUUID()}/block`)).status, 404);
  assert.equal((await lia('POST', `/v1/community/${id}/block`)).status, 200);
  assert.ok(!(await names(lia)).includes('Theo quilt'));
  assert.ok((await names(nobody)).includes('Theo quilt'), 'everyone else still sees it');
  const blocked = (await lia('GET', '/v1/blocks')).body.items;
  assert.deepEqual(
    blocked.map(b => b.author),
    ['Theo'],
  );
  assert.equal((await lia('DELETE', `/v1/blocks/${blocked[0].id}`)).status, 200);
  assert.ok((await names(lia)).includes('Theo quilt'));
  assert.deepEqual((await lia('GET', '/v1/blocks')).body.items, []);
});

test('deleting an account removes everything of theirs, and only theirs', async () => {
  const gone = as('pgone'),
    stays = as('pstays');
  await stays('PUT', '/v1/shared/qs', { name: 'Stays', author: 'S', design: { ...defaultDesign(), cols: 4 } });
  const shared = await gone('PUT', '/v1/shared/qg', {
    name: 'Gone quilt',
    author: 'G',
    design: { ...defaultDesign(), cols: 6 },
  });
  const up = await gone('POST', '/v1/shared/qg/picture/upload', { type: 'image/jpeg', bytes: JPEG.length });
  store.put(keyOf(up.body.url), JPEG);
  const pic = await gone('POST', '/v1/shared/qg/picture/done');
  const { id: photoId } = await sendPhoto(gone);
  const photoUrl = (await gone('GET', '/v1/photos')).body.items[0].url;
  await gone('PUT', `/v1/folders/${randomUUID()}`, {
    name: 'F',
    fabricIds: [],
    position: 0,
    deleted: false,
    updatedAt: 1,
  });
  assert.ok(photoId && shared.body.item.id);

  assert.equal((await gone('DELETE', '/v1/account', { confirm: 'nope' })).status, 400, 'has to be confirmed');
  assert.equal((await nobody('DELETE', '/v1/account', { confirm: 'DELETE' })).status, 401);
  assert.equal((await gone('DELETE', '/v1/account', { confirm: 'DELETE' })).status, 200);

  const { rows } = await pool.query("select count(*)::int as n from users where auth_sub = 'dev:pgone'");
  assert.equal(rows[0].n, 0);
  assert.equal(await store.get(keyOf(photoUrl)), null, 'the photo is gone');
  assert.equal(await store.get(keyOf(pic.body.item.pictureUrl)), null, 'the shared picture is gone');
  const names = (await nobody('GET', '/v1/community')).body.items.map(i => i.name);
  assert.ok(!names.includes('Gone quilt'));
  assert.ok(names.includes('Stays'));
  // signing in again starts afresh
  assert.deepEqual((await gone('GET', '/v1/photos')).body.items, []);
});
