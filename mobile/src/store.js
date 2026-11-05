// What only the phone app keeps: fabric folders, notes on fabrics, quilt photos and measured colours. In a database of its
// own, like the web app's realistic pictures, read into memory at the start. Without IndexedDB everything still works
// until the app closes.
const DB_NAME = 'quilt-phone';
const STORES = { folders: 'id', notes: 'fabricId', photos: 'id', colours: 'id' };

/** @type {Record<string, Map<string, any>>} */
const cache = { folders: new Map(), notes: new Map(), photos: new Map(), colours: new Map() };
/** @type {IDBDatabase | null} */
let db = null;
/** @type {() => void} */
let writeFailed = () => {};
/** @type {Set<(store: string) => void>} */
const listeners = new Set();

const done = e =>
  new Promise((ok, fail) => {
    e.onsuccess = () => ok(e.result);
    e.onerror = () => fail(e.error);
  });

async function openStore() {
  try {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      for (const [s, keyPath] of Object.entries(STORES)) open.result.createObjectStore(s, { keyPath });
    };
    db = /** @type {IDBDatabase} */ (await done(open));
    for (const [s, keyPath] of Object.entries(STORES))
      for (const r of /** @type {any[]} */ (await done(db.transaction(s).objectStore(s).getAll())))
        cache[s].set(r[keyPath], r);
  } catch (e) {
    db = null;
  }
}

function write(s, act) {
  if (!db) return;
  try {
    const tx = db.transaction(s, 'readwrite');
    act(tx.objectStore(s));
    tx.onerror = tx.onabort = () => writeFailed();
  } catch (e) {
    writeFailed();
  }
}

/** Every record of a store. @param {string} s @returns {any[]} */
const all = s => [...cache[s].values()];
/** @param {string} s @param {string} key @returns {any} */
const get = (s, key) => cache[s].get(key) ?? null;
/** Keeps a record. quiet: nothing to send to the server (a measured colour, say). @param {string} s @param {any} rec @param {{ quiet?: boolean }} [o] */
function put(s, rec, { quiet = false } = {}) {
  cache[s].set(rec[STORES[s]], rec);
  write(s, os => os.put(rec));
  if (!quiet) listeners.forEach(f => f(s));
}
/** @param {string} s @param {string} key @param {{ quiet?: boolean }} [o] */
function drop(s, key, { quiet = false } = {}) {
  cache[s].delete(key);
  write(s, os => os.delete(key));
  if (!quiet) listeners.forEach(f => f(s));
}
/** Calls f after a change made on this phone. @param {(store: string) => void} f */
const onStoreChange = f => void listeners.add(f);
/** @param {() => void} f called when the phone couldn't keep something */
const onWriteFailed = f => void (writeFailed = f);

export { all, drop, get, onStoreChange, onWriteFailed, openStore, put };
