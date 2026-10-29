// The app's storage (no side effects when loaded; storage/boot.js opens it before the app starts).
//
// IndexedDB holds four stores:
//   designs    saved quilts (My designs): { id, name, design, createdAt, updatedAt, rev, deleted, dirty }
//   fabrics    the user's own fabric photos: { id, name, cm, blob, createdAt, updatedAt, rev, deleted, dirty }
//   timelines  undo history per design: { key, steps, i, seq } (kept on this device only)
//   session    the quilt being edited and small values: { key, value }
// Everything is read into memory when the app starts, so reads are synchronous; every change is written to
// IndexedDB right after (several changes in one moment go in one transaction). designs and fabrics records are
// shaped for a future server: ids made here (UUIDs, or the image's hash for fabrics), a save counter `rev` to
// spot edits from two devices, `deleted` instead of erasing (so other devices learn of it) and `dirty` for
// "not uploaded yet".
import { memoryDb, openIdb } from './idb.js';
import { migrateLocalStorage } from './migrate.js';

/** @typedef {import('./idb.js').Db} Db */
/** @typedef {{ id: string, name: string, design: any, createdAt: number, updatedAt: number, rev: number, deleted: boolean, dirty: boolean }} DesignRecord */
/** @typedef {{ id: string, name: string, cm: number, blob: Blob, createdAt: number, updatedAt: number, rev: number, deleted: boolean, dirty: boolean }} FabricRecord */

/** @type {Db | null} */
let db = null;
let persistent = false;
/** @type {Record<string, Map<string, any>>} */
const cache = { designs: new Map(), fabrics: new Map(), timelines: new Map(), session: new Map() };
/** @type {Map<string, [string, string, any]>} pending writes, the last one per record */
let pending = new Map();
let scheduled = false;
/** @type {Promise<void>} */
let writing = Promise.resolve();
/** @type {(e: unknown) => void} */
let onError = () => {};

function queue(store, key, value) {
  pending.set(store + '\u0000' + key, [store, key, value]);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(writeNow);
  }
}
function writeNow() {
  scheduled = false;
  if (!pending.size || !db) return writing;
  const ops = [...pending.values()],
    d = db;
  pending = new Map();
  writing = writing.then(() => d.write(ops)).catch(e => onError(e));
  return writing;
}
/** Waits until every change so far is written. */
async function flush() {
  await writeNow();
}

const now = () => Date.now();
/** A new id for a record (a UUID). */
function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const h = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

/**
 * Opens the database, reads everything into memory and, the first time, moves the data the app kept in
 * localStorage before. Falls back to memory only (nothing kept after a reload) when IndexedDB can't be opened.
 * @param {{ factory?: IDBFactory, legacy?: Storage | null, timeoutMs?: number, db?: Db }} [opts]
 * @returns {Promise<{ persistent: boolean, migrated: boolean }>}
 */
async function openStorage(opts = {}) {
  const legacy = 'legacy' in opts ? opts.legacy : globalThis.localStorage;
  if (opts.db) {
    db = opts.db;
    persistent = true;
  } else {
    try {
      db = await Promise.race([
        openIdb(opts.factory),
        new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB timed out')), opts.timeoutMs || 6000)),
      ]);
      persistent = true;
    } catch (e) {
      db = memoryDb();
      persistent = false;
    }
  }
  for (const m of Object.values(cache)) m.clear();
  for (const s of Object.keys(cache)) for (const r of await db.getAll(s)) cache[s].set(r.id ?? r.key, r);
  let migrated = false;
  if (!cache.session.has('migrated')) {
    const out = legacy ? migrateLocalStorage(legacy) : { designs: [], timelines: [], session: [] };
    for (const r of out.designs) put('designs', r.id, r);
    for (const r of out.timelines) put('timelines', r.key, r);
    for (const [k, v] of out.session) setSession(k, v);
    setSession('migrated', now());
    migrated = out.designs.length + out.timelines.length + out.session.length > 0;
    await flush();
  }
  return { persistent, migrated };
}
/** @param {(e: unknown) => void} f called when a write fails (storage full, …) */
function onStorageError(f) {
  onError = f;
}

function put(store, key, value) {
  cache[store].set(key, value);
  queue(store, key, value);
}
function del(store, key) {
  cache[store].delete(key);
  queue(store, key, undefined);
}

// ---- session: the quilt being edited, which saved design it is, small flags
/** @param {string} key */
const getSession = key => cache.session.get(key)?.value;
/** @param {string} key @param {any} value undefined removes it */
function setSession(key, value) {
  if (value === undefined) del('session', key);
  else put('session', key, { key, value });
}

// ---- designs (My designs)
const designs = {
  /** @returns {DesignRecord[]} the saved designs, not counting deleted ones */
  list: () => [...cache.designs.values()].filter(r => !r.deleted),
  /** @param {string} id @returns {DesignRecord | null} */
  get: id => {
    const r = cache.designs.get(id);
    return r && !r.deleted ? r : null;
  },
  /**
   * Saves a new design or changes one: `rec` is merged into the record; the save counter goes up and the
   * record is marked for upload. @param {Partial<DesignRecord> & { id: string }} rec @returns {DesignRecord}
   */
  save(rec) {
    const old = cache.designs.get(rec.id),
      t = now();
    const next = {
      name: '',
      design: null,
      createdAt: t,
      ...(old && !old.deleted ? old : {}),
      ...rec,
      updatedAt: t,
      rev: (old?.rev || 0) + 1,
      deleted: false,
      dirty: true,
    };
    put('designs', next.id, next);
    return next;
  },
  /** Deletes a design (kept as a marker, so a server can pass the deletion on). @param {string} id */
  remove(id) {
    const old = cache.designs.get(id);
    if (!old || old.deleted) return;
    put('designs', id, { ...old, design: null, deleted: true, dirty: true, updatedAt: now(), rev: old.rev + 1 });
  },
  newId,
};

// ---- fabrics: the user's own photos, named by the image's content
/** sha-256 of the image's bytes (a simple hash where Web Crypto is not available, e.g. on plain http). */
async function blobHash(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return 'f' + [...h.slice(0, 12)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  let a = 0x811c9dc5,
    b = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i], 16777619);
    b = Math.imul(b ^ bytes[i], 2246822519);
  }
  return 'h' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const fabrics = {
  /** @returns {FabricRecord[]} */
  list: () => [...cache.fabrics.values()].filter(r => !r.deleted).sort((a, b) => a.createdAt - b.createdAt),
  /** @param {string} id @returns {FabricRecord | null} */
  get: id => {
    const r = cache.fabrics.get(id);
    return r && !r.deleted ? r : null;
  },
  /**
   * Keeps a fabric photo. The same image always gets the same id, so adding it twice keeps one copy.
   * @param {Blob} blob @param {{ name: string, cm: number }} meta @returns {Promise<{ id: string, isNew: boolean }>}
   */
  async add(blob, meta) {
    const id = await blobHash(blob),
      old = cache.fabrics.get(id);
    if (old && !old.deleted) return { id, isNew: false };
    const t = now();
    put('fabrics', id, {
      id,
      name: meta.name,
      cm: meta.cm,
      blob,
      createdAt: t,
      updatedAt: t,
      rev: (old?.rev || 0) + 1,
      deleted: false,
      dirty: true,
    });
    return { id, isNew: true };
  },
};

// ---- timelines (undo history), one per design: its id, 'draft' for the unsaved one, 'tour'
const timelines = {
  /** @param {string} key */
  get: key => cache.timelines.get(key) || null,
  /** @param {string} key @param {{ steps: any[], i: number, seq: number }} t */
  set: (key, t) => put('timelines', key, { key, steps: t.steps, i: t.i, seq: t.seq }),
  /** @param {string} key */
  remove: key => cache.timelines.has(key) && del('timelines', key),
  /** @param {string} from @param {string} to */
  copy(from, to) {
    const t = cache.timelines.get(from);
    if (t) timelines.set(to, t);
  },
};

/** Whether changes are kept after a reload (false when IndexedDB couldn't be opened). */
const isPersistent = () => persistent;

export { designs, fabrics, flush, getSession, isPersistent, onStorageError, openStorage, setSession, timelines };
