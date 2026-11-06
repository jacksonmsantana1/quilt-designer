// The app's storage (no side effects when loaded; storage/boot.js opens it before the app starts).
//
// IndexedDB holds four stores:
//   designs    saved quilts (My designs): { id, name, design, createdAt, updatedAt, rev, syncRev, deleted, dirty }
//   fabrics    the user's own fabric photos: { id, name, cm, blob, createdAt, updatedAt, rev, syncRev, deleted, dirty }
//   timelines  undo history per design: { key, steps, i, seq } (kept on this device only)
//   session    the quilt being edited and small values: { key, value }
// Everything is read into memory when the app starts, so reads are synchronous; every change is written to
// IndexedDB right after (several changes in one moment go in one transaction).
//
// Designs and fabrics are what storage/sync.js shares with the server: ids made here (UUIDs, or the image's
// hash for fabrics); `rev` counts this device's saves; `syncRev` is the server's save counter this copy is based
// on (0: never uploaded); `dirty` means "changed here since the last upload"; `deleted` records stay as markers
// until the server has them.
//
// Several people can use one browser: each design and fabric carries `owner`, the account it belongs to (none:
// made here while nobody was signed in). Only the signed-in account's records and the ones without an owner are
// listed, and only the signed-in account's are synced; another account's stay on the device, out of sight, until
// it signs in again. The account is set by the sync (setAccount) and kept in the session.
//
// createRepo() makes an independent storage (the tests make one per "device"); the app uses the one exported
// below.
import { memoryDb, openIdb } from './idb.js';
import { migrateLocalStorage } from './migrate.js';

/** @typedef {import('./idb.js').Db} Db */
/** @typedef {{ id: string, name: string, design: any, createdAt: number, updatedAt: number, rev: number, syncRev?: number, deleted: boolean, dirty: boolean, owner?: string, sample?: boolean, from?: { id: string, name: string, author: string, sig: string } }} DesignRecord */
/** @typedef {{ id: string, name: string, cm: number, blob: Blob | null, createdAt: number, updatedAt: number, rev: number, syncRev?: number, deleted: boolean, dirty: boolean, owner?: string }} FabricRecord */
/** @typedef {'designs' | 'fabrics'} SyncedStore */

/** A new id for a record (a UUID). */
function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const h = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-${h()}-${h()}${h()}${h()}`;
}

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

function createRepo() {
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
  /** @type {Set<(store: SyncedStore, id: string) => void>} */
  const listeners = new Set();
  const changed = (store, id) => listeners.forEach(f => f(store, id));

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
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('IndexedDB timed out')), opts.timeoutMs || 6000),
          ),
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

  // ---- whose records: the account signed in on this device (null: nobody)
  /** @returns {string | null} */
  const account = () => getSession('account') || null;
  /** Shown to the account signed in: its own, and the ones made here while nobody was signed in. */
  const visible = r => !r.deleted && (r.owner == null || r.owner === account());
  /** The account's own (what the sync shares); none while nobody is signed in. */
  const mine = r => r.owner != null && r.owner === account();
  /** A new record belongs to whoever is signed in. */
  const ownedNow = () => (account() ? { owner: account() } : {});

  /** What sync needs from designs and fabrics alike. @param {SyncedStore} store */
  const syncSide = store => ({
    /** the signed-in account's records changed here since the last upload, deletion markers included */
    dirty: () => [...cache[store].values()].filter(r => r.dirty && mine(r)),
    /** the record, deleted or not */
    raw: id => cache[store].get(id) || null,
    /**
     * After an upload: the server has this copy at server rev `syncRev`. Still dirty if the record was changed
     * again while it was being uploaded (its local rev moved on), so the next sync sends that too.
     * @param {string} id @param {number} localRev @param {number} syncRev @param {object} [patch]
     */
    markSynced(id, localRev, syncRev, patch = {}) {
      const r = cache[store].get(id);
      if (!r) return;
      if (r.deleted && r.rev === localRev) return del(store, id); // the server has the deletion: marker no longer needed
      put(store, id, { ...r, ...(r.rev === localRev ? patch : {}), syncRev, dirty: r.rev !== localRev });
    },
    /** Puts the server's copy here (from another device): not dirty. @param {any} rec */
    applyRemote(rec) {
      const old = cache[store].get(rec.id);
      if (rec.deleted) {
        if (old) del(store, rec.id);
        return;
      }
      put(store, rec.id, {
        createdAt: rec.createdAt || now(),
        ...old,
        ...rec,
        ...ownedNow(), // it came from the signed-in account's space on the server
        rev: (old?.rev || 0) + 1,
        syncRev: rec.rev,
        deleted: false,
        dirty: false,
      });
    },
    /** Removes a record outright (a deletion marker the server never needed to know about). @param {string} id */
    purge: id => cache[store].has(id) && del(store, id),
    /**
     * Connecting the account to another server: its records here are all new to it (its deletion markers are
     * dropped). Other accounts' records are not touched.
     */
    resetSync() {
      for (const r of [...cache[store].values()]) {
        if (!mine(r)) continue;
        if (r.deleted) del(store, r.id);
        else put(store, r.id, { ...r, syncRev: 0, dirty: true });
      }
    },
    /** The ones made here while nobody was signed in (not the samples): what Sign in offers to add to the account. */
    strays: () => [...cache[store].values()].filter(r => !r.deleted && r.owner == null && !r.sample),
    /** Adds those to the signed-in account: they are then synced. @returns {number} how many */
    adoptStrays() {
      const acc = account();
      if (!acc) return 0;
      const them = [...cache[store].values()].filter(r => !r.deleted && r.owner == null && !r.sample);
      for (const r of them) put(store, r.id, { ...r, owner: acc, syncRev: 0, dirty: true, rev: r.rev + 1 });
      return them.length;
    },
    /**
     * Records from before records had owners that were already on the server (synced): the account they were
     * synced with. Run once, when the app starts with sync set up. @param {string} acc
     */
    claimSynced(acc) {
      for (const r of [...cache[store].values()])
        if (r.owner == null && (r.syncRev || 0) > 0 && !r.sample) put(store, r.id, { ...r, owner: acc });
    },
  });

  // ---- designs (My designs)
  const designs = {
    /** @returns {DesignRecord[]} the saved designs the signed-in account sees, not counting deleted ones */
    list: () => [...cache.designs.values()].filter(visible),
    /** @param {string} id @returns {DesignRecord | null} (null for another account's) */
    get: id => {
      const r = cache.designs.get(id);
      return r && visible(r) ? r : null;
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
        ...ownedNow(), // a new one belongs to whoever is signed in; a changed one keeps its owner
        ...(old && !old.deleted ? old : {}),
        syncRev: old?.syncRev || 0,
        ...rec,
        updatedAt: t,
        rev: (old?.rev || 0) + 1,
        deleted: false,
        dirty: true,
      };
      put('designs', next.id, next);
      changed('designs', next.id);
      return next;
    },
    /**
     * Marks one of the app's own sample designs (they are never offered to an account as "made on this device").
     * Not a change of the design: nothing to sync. @param {string} id
     */
    markSample(id) {
      const r = cache.designs.get(id);
      if (r && !r.sample) put('designs', id, { ...r, sample: true });
    },
    /** Deletes a design (kept as a marker until the server has the deletion). @param {string} id */
    remove(id) {
      const old = cache.designs.get(id);
      if (!old || old.deleted) return;
      put('designs', id, { ...old, design: null, deleted: true, dirty: true, updatedAt: now(), rev: old.rev + 1 });
      changed('designs', id);
    },
    newId,
    ...syncSide('designs'),
  };

  // ---- fabrics: the user's own photos, named by the image's content
  const fabrics = {
    /** @returns {FabricRecord[]} the photos the signed-in account sees */
    list: () => [...cache.fabrics.values()].filter(visible).sort((a, b) => a.createdAt - b.createdAt),
    /** @param {string} id @returns {FabricRecord | null} (any account's: a quilt that uses it still draws) */
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
      if (old && !old.deleted && visible(old)) return { id, isNew: false };
      // the same photo kept by another account here: this account gets it too (one copy per id on a device)
      if (old && !old.deleted) {
        put('fabrics', id, { ...old, owner: account() || undefined, syncRev: 0, dirty: true, rev: old.rev + 1 });
        changed('fabrics', id);
        return { id, isNew: true };
      }
      const t = now();
      put('fabrics', id, {
        id,
        ...ownedNow(),
        name: meta.name,
        cm: meta.cm,
        blob,
        createdAt: t,
        updatedAt: t,
        rev: (old?.rev || 0) + 1,
        syncRev: old?.syncRev || 0,
        deleted: false,
        dirty: true,
      });
      changed('fabrics', id);
      return { id, isNew: true };
    },
    /** Gives a fabric photo another name. @param {string} id @param {string} name */
    rename(id, name) {
      const old = cache.fabrics.get(id);
      if (!old || old.deleted || old.name === name) return;
      put('fabrics', id, { ...old, name, dirty: true, updatedAt: now(), rev: old.rev + 1 });
      changed('fabrics', id);
    },
    /** Says how much cloth a fabric photo's width covers, in cm: the print's size on quilts. @param {string} id @param {number} cm */
    resize(id, cm) {
      const old = cache.fabrics.get(id);
      if (!old || old.deleted || !(cm > 0) || old.cm === cm) return;
      put('fabrics', id, { ...old, cm, dirty: true, updatedAt: now(), rev: old.rev + 1 });
      changed('fabrics', id);
    },
    /** Deletes a fabric photo (kept as a marker until the server has the deletion). @param {string} id */
    remove(id) {
      const old = cache.fabrics.get(id);
      if (!old || old.deleted) return;
      put('fabrics', id, { ...old, blob: null, deleted: true, dirty: true, updatedAt: now(), rev: old.rev + 1 });
      changed('fabrics', id);
    },
    ...syncSide('fabrics'),
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

  return {
    openStorage,
    flush,
    /** @param {(e: unknown) => void} f called when a write fails (storage full, …) */
    onStorageError: f => void (onError = f),
    /** Whether changes are kept after a reload (false when IndexedDB couldn't be opened). */
    isPersistent: () => persistent,
    /** Calls f(store, id) after every change made on this device to a design or fabric (not ones from sync). */
    onChange: f => void listeners.add(f),
    getSession,
    setSession,
    /** The account signed in on this device (its records are listed and synced), or null. */
    account,
    /** @param {string | null} acc */
    setAccount: acc => setSession('account', acc || undefined),
    designs,
    fabrics,
    timelines,
  };
}

/** The app's storage. */
const repo = createRepo();
const {
  designs,
  fabrics,
  flush,
  getSession,
  isPersistent,
  onChange,
  onStorageError,
  openStorage,
  setSession,
  timelines,
} = repo;

export {
  blobHash,
  createRepo,
  designs,
  fabrics,
  flush,
  getSession,
  isPersistent,
  onChange,
  onStorageError,
  openStorage,
  repo,
  setSession,
  timelines,
};
