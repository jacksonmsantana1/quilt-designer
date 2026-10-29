// A small promise wrapper around IndexedDB (no side effects when loaded), and an in-memory stand-in with the same
// methods for browsers where IndexedDB can't be opened (some private modes) and for the unit tests.

/** @typedef {{ getAll(store: string): Promise<any[]>, write(ops: [string, string, any][]): Promise<void>, close(): void }} Db */

const DB_NAME = 'quilt';
const DB_VERSION = 1;
/** Object stores, each keyed by `key` (session, timelines) or `id` (designs, fabrics). */
const STORES = { designs: 'id', fabrics: 'id', timelines: 'key', session: 'key' };

const req = r =>
  new Promise((resolve, reject) => {
    r.addEventListener('success', () => resolve(r.result));
    r.addEventListener('error', () => reject(r.error));
  });

/**
 * Opens the app's database. Rejects when IndexedDB is missing or blocked.
 * @param {IDBFactory} [factory] @returns {Promise<Db>}
 */
async function openIdb(factory = globalThis.indexedDB, name = DB_NAME) {
  if (!factory) throw new Error('IndexedDB is not available');
  const open = factory.open(name, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const [s, keyPath] of Object.entries(STORES))
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath });
  };
  /** @type {IDBDatabase} */
  const db = await req(open);
  return {
    getAll: s => req(db.transaction(s, 'readonly').objectStore(s).getAll()),
    // ops: [store, key, value] — value undefined deletes; all in one transaction, so they are kept together or not at all
    write: ops =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([...new Set(ops.map(o => o[0]))], 'readwrite');
        for (const [s, key, value] of ops) {
          const os = tx.objectStore(s);
          if (value === undefined) os.delete(key);
          else os.put(value);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('aborted'));
      }),
    close: () => db.close(),
  };
}

/** The same methods, kept in memory only (nothing survives a reload). @returns {Db} */
function memoryDb() {
  /** @type {Record<string, Map<string, any>>} */
  const data = Object.fromEntries(Object.keys(STORES).map(s => [s, new Map()]));
  return {
    getAll: async s => [...data[s].values()],
    write: async ops => {
      for (const [s, key, value] of ops) {
        if (value === undefined) data[s].delete(key);
        else data[s].set(key, value);
      }
    },
    close: () => {},
  };
}

export { DB_NAME, STORES, memoryDb, openIdb };
