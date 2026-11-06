// Fabric folders and notes (how much, where it's kept). A fabric can be in several folders; taking it out of one, or
// deleting a folder, never deletes the fabric. Kept on the phone first, and shared with the person's other devices through
// the server, where the newest change wins (server/src/routes/organize.js).
import { repo } from '../../app/src/storage/repo.js';
import { all, drop, get, put } from './store.js';

/** @typedef {{ id: string, name: string, fabricIds: string[], position: number, deleted: boolean, updatedAt: number, dirty: boolean, owner?: string }} Folder */

const shownNow = r => r.owner == null || r.owner === repo.account();
const ownedNow = () => (repo.account() ? { owner: repo.account() } : {});

/** The folders, in the person's order. @returns {Folder[]} */
const folders = () =>
  all('folders')
    .filter(f => !f.deleted && shownNow(f))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
/** @param {string} id @returns {Folder | null} */
function folder(id) {
  const f = get('folders', id);
  return f && !f.deleted && shownNow(f) ? f : null;
}

function change(f, patch) {
  const next = { ...f, ...patch, updatedAt: Math.max(Date.now(), f.updatedAt + 1), dirty: true };
  put('folders', next);
  return next;
}

/** A new folder at the end of the list. @param {string} name @returns {Folder} */
function newFolder(name) {
  const f = {
    id: repo.designs.newId(),
    name: name.trim().slice(0, 60),
    fabricIds: [],
    position: folders().reduce((n, x) => Math.max(n, x.position + 1), 0),
    deleted: false,
    updatedAt: Date.now(),
    dirty: true,
    ...ownedNow(),
  };
  put('folders', f);
  return f;
}
/** @param {string} id @param {string} name */
function renameFolder(id, name) {
  const f = folder(id),
    clean = name.trim().slice(0, 60);
  if (f && clean && clean !== f.name) change(f, { name: clean });
}
/** The folder goes; its fabrics stay. @param {string} id */
function removeFolder(id) {
  const f = folder(id);
  if (f) change(f, { deleted: true, fabricIds: [] });
}
/** @param {string} id @param {string[]} ids */
function addToFolder(id, ids) {
  const f = folder(id);
  if (!f) return;
  const more = ids.filter(x => !f.fabricIds.includes(x));
  if (more.length) change(f, { fabricIds: [...f.fabricIds, ...more] });
}
/** @param {string} id @param {string[]} ids */
function removeFromFolder(id, ids) {
  const f = folder(id);
  if (f && f.fabricIds.some(x => ids.includes(x))) change(f, { fabricIds: f.fabricIds.filter(x => !ids.includes(x)) });
}
/** Moves a folder one place up (-1) or down (1). @param {string} id @param {number} by */
function moveFolder(id, by) {
  const list = folders(),
    i = list.findIndex(f => f.id === id),
    j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((f, n) => {
    if (f.position !== n) change(f, { position: n });
  });
}
/** @param {string} fabricId @returns {Folder[]} */
const foldersOf = fabricId => folders().filter(f => f.fabricIds.includes(fabricId));

// ---- notes
/** @param {string} fabricId @returns {{ amount: string, place: string }} */
function note(fabricId) {
  const n = get('notes', fabricId);
  return n && shownNow(n) ? n : { amount: '', place: '' };
}
/** @param {string} fabricId @param {{ amount?: string, place?: string }} patch */
function setNote(fabricId, patch) {
  const old = get('notes', fabricId),
    next = { amount: '', place: '', ...old, ...patch, fabricId };
  if (old ? old.amount === next.amount && old.place === next.place : !next.amount && !next.place) return;
  put('notes', {
    ...next,
    updatedAt: Math.max(Date.now(), (old?.updatedAt || 0) + 1),
    dirty: true,
    ...ownedNow(),
  });
}
/** A fabric was deleted: its place in folders and its note go too. @param {string} fabricId */
function forgetFabric(fabricId) {
  removeEverywhere([fabricId]);
  setNote(fabricId, { amount: '', place: '' });
}
function removeEverywhere(ids) {
  for (const f of folders()) removeFromFolder(f.id, ids);
}

// ---- with an account
/** What was organized here without an account now belongs to the one signing in. */
function adoptOrganize() {
  const owner = repo.account();
  if (!owner) return;
  for (const s of ['folders', 'notes'])
    for (const r of all(s)) if (r.owner == null) put(s, { ...r, owner, dirty: true });
}
/** Removes this phone's copy of the signed-in account's folders and notes. */
function forgetOrganize() {
  for (const f of all('folders')) if (shownNow(f)) drop('folders', f.id, { quiet: true });
  for (const n of all('notes')) if (shownNow(n)) drop('notes', n.fabricId, { quiet: true });
}

function takeFolder(r, owner) {
  const cur = get('folders', r.id);
  if (cur && cur.updatedAt > r.updatedAt) return; // changed here since: this one goes up next
  if (r.deleted) {
    if (cur) drop('folders', r.id, { quiet: true });
    return;
  }
  put('folders', { ...r, dirty: false, owner }, { quiet: true });
}
function takeNote(r, owner) {
  const cur = get('notes', r.fabricId);
  if (cur && cur.updatedAt > r.updatedAt) return;
  put('notes', { ...r, dirty: false, owner }, { quiet: true });
}

/**
 * Sends what changed here, and brings what changed elsewhere. @param {(method: string, path: string, body?: any) => Promise<{ status: number, body: any }>} request
 * @returns {Promise<boolean>} whether what's on this phone changed
 */
async function syncOrganize(request) {
  const owner = repo.account();
  if (!owner) return false;
  for (const f of all('folders').filter(x => x.dirty && x.owner === owner)) {
    const r = await request('PUT', `/v1/folders/${f.id}`, {
      name: f.name,
      fabricIds: f.fabricIds,
      position: f.position,
      deleted: f.deleted,
      updatedAt: f.updatedAt,
    });
    if (r.status === 200) takeFolder(r.body.record, owner);
  }
  for (const n of all('notes').filter(x => x.dirty && x.owner === owner)) {
    const r = await request('PUT', `/v1/fabric-notes/${n.fabricId}`, {
      amount: n.amount,
      place: n.place,
      updatedAt: n.updatedAt,
    });
    if (r.status === 200) takeNote(r.body.record, owner);
  }
  const got = await request('GET', '/v1/organize');
  if (got.status !== 200) return false;
  const before = JSON.stringify([folders(), all('notes')]);
  for (const f of got.body.folders) takeFolder(f, owner);
  for (const n of got.body.notes) takeNote(n, owner);
  return before !== JSON.stringify([folders(), all('notes')]);
}

export {
  addToFolder,
  adoptOrganize,
  folder,
  folders,
  foldersOf,
  forgetFabric,
  forgetOrganize,
  moveFolder,
  newFolder,
  note,
  removeFolder,
  removeFromFolder,
  renameFolder,
  setNote,
  syncOrganize,
};
