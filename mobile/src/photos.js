// Photos of real quilts: of a saved design, or of a quilt with no design (an "album": its id starts with "a"). Private. A
// photo is kept on the phone first and goes up when there's a connection and an account, so taking one never has to wait.
import { repo } from '../../app/src/storage/repo.js';
import { t } from '@quilt/shared/i18n.js';
import { all, drop, get, put } from './store.js';

/** @typedef {{ id: string, quiltId: string, album?: string | null, takenAt: number, blob: Blob | null, url: string | null, sent: boolean, deleted: boolean, owner?: string }} Photo */

const shownNow = r => !r.deleted && (r.owner == null || r.owner === repo.account());
/** Every photo, newest first. @returns {Photo[]} */
const photos = () =>
  all('photos')
    .filter(shownNow)
    .sort((a, b) => b.takenAt - a.takenAt);
/** @param {string} quiltId @returns {Photo[]} */
const photosOf = quiltId => photos().filter(p => p.quiltId === quiltId);
/** The quilts with no design, from their photos, newest first. @returns {{ id: string, name: string }[]} */
function albums() {
  const seen = new Map();
  for (const p of photos()) if (p.album && !seen.has(p.quiltId)) seen.set(p.quiltId, { id: p.quiltId, name: p.album });
  return [...seen.values()];
}
/** A new album's id. */
const newAlbumId = () => 'a' + repo.designs.newId();

/** @param {Blob} blob a JPEG with nothing but the picture in it (images.js) @param {{ quiltId: string, album?: string | null }} where @returns {Photo} */
function addPhoto(blob, { quiltId, album = null }) {
  const p = {
    id: repo.designs.newId(),
    quiltId,
    album,
    takenAt: Date.now(),
    blob,
    url: null,
    sent: false,
    deleted: false,
    ...(repo.account() ? { owner: repo.account() } : {}),
  };
  put('photos', p);
  return p;
}
/** @param {string} id */
function removePhoto(id) {
  const p = get('photos', id);
  if (!p) return;
  if (p.sent) put('photos', { ...p, deleted: true, blob: null });
  else drop('photos', id);
}

// a picture's address on the screen, made once per photo
const urls = new Map();
/** @param {Photo} p @returns {string} */
function photoUrl(p) {
  if (!p.blob) return p.url || '';
  if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob));
  return urls.get(p.id);
}

/** What was taken here without an account now belongs to the one signing in. */
function adoptPhotos() {
  const owner = repo.account();
  if (owner) for (const p of all('photos')) if (p.owner == null) put('photos', { ...p, owner }, { quiet: true });
}
/** Removes this phone's copy of the photos of whoever is signed in. */
function forgetPhotos() {
  for (const p of all('photos'))
    if (p.owner == null || p.owner === repo.account()) drop('photos', p.id, { quiet: true });
}

async function send(p, request, errors) {
  const up = await request('POST', `/v1/photos/${p.id}/upload`, {
    quiltId: p.quiltId,
    ...(p.album ? { album: p.album } : {}),
    bytes: p.blob.size,
    takenAt: p.takenAt,
  });
  if (up.status !== 200) {
    errors.push(up.body?.error === 'storage_full' ? t('There is no more room in this account.') : '');
    return;
  }
  if (up.body.status === 'upload') {
    const stored = await fetch(up.body.url, { method: 'PUT', headers: up.body.headers, body: p.blob });
    if (!stored.ok) return; // next time
    const finished = await request('POST', `/v1/photos/${p.id}/done`);
    if (finished.status !== 200) return;
    put('photos', { ...get('photos', p.id), sent: true, url: finished.body.record.url }, { quiet: true });
  } else put('photos', { ...get('photos', p.id), sent: true, url: up.body.record.url }, { quiet: true });
}

/**
 * Sends what's waiting, and brings the list from the server (its links expire, so they're fetched afresh).
 * @param {(method: string, path: string, body?: any) => Promise<{ status: number, body: any }>} request
 * @returns {Promise<{ changed: boolean, errors: string[] }>} `changed`: what's on this phone changed
 */
async function syncPhotos(request) {
  const owner = repo.account();
  /** @type {string[]} */
  const errors = [];
  if (!owner) return { changed: false, errors };
  const before = photos().filter(p => p.sent).length;
  for (const p of all('photos').filter(x => x.owner === owner)) {
    if (p.deleted) {
      const r = await request('DELETE', `/v1/photos/${p.id}`);
      if (r.status === 200) drop('photos', p.id, { quiet: true });
    } else if (!p.sent && p.blob) await send(p, request, errors);
  }
  const got = await request('GET', '/v1/photos');
  if (got.status !== 200) return { changed: false, errors };
  const there = new Set();
  let changed = before !== photos().filter(p => p.sent).length;
  for (const r of got.body.items) {
    there.add(r.id);
    const cur = get('photos', r.id);
    if (cur?.deleted) continue;
    if (!cur) changed = true;
    put(
      'photos',
      {
        id: r.id,
        quiltId: r.quiltId,
        album: r.album,
        takenAt: r.takenAt,
        blob: cur?.blob || null,
        url: r.url,
        sent: true,
        deleted: false,
        owner,
      },
      { quiet: true },
    );
  }
  // deleted on another device (a full list may just have stopped before this one: the server sends 2000 at most)
  for (const p of got.body.items.length < 2000 ? all('photos') : [])
    if (p.owner === owner && p.sent && !p.deleted && !there.has(p.id)) {
      drop('photos', p.id, { quiet: true });
      changed = true;
    }
  return { changed, errors: errors.filter(Boolean) };
}

export { addPhoto, adoptPhotos, albums, forgetPhotos, newAlbumId, photoUrl, photos, photosOf, removePhoto, syncPhotos };
