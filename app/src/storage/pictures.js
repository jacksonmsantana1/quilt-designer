// The realistic pictures made on this device, kept by the fingerprint of the quilt they show (core/quilt-sig.js), so a
// quilt has its picture for as long as it stays the same quilt, whichever design it is saved as. No side effects when
// loaded. They have their own database: a new store in the app's main one would need every other open tab of the app
// to close first, and until then the app couldn't read its designs. Falls back to memory where IndexedDB can't be opened.

const DB_NAME = 'quilt-pictures',
  STORE = 'pictures',
  KEEP = 30; // the newest ones; a quilt changed many times shouldn't fill the disk

/** @typedef {{ key: string, blob: Blob, width: number, height: number, createdAt: number }} PictureRecord */

/** @param {IDBFactory | undefined} [factory] */
function createPictures(factory = globalThis.indexedDB) {
  /** @type {Promise<IDBDatabase | null> | null} */
  let opening = null;
  /** @type {Map<string, PictureRecord>} only when IndexedDB can't be opened */
  const memory = new Map();
  /** @type {Map<string, number>} every picture kept: its key and when it was made */
  const index = new Map();
  /** @type {Promise<void> | null} */
  let ready = null;

  const req = r =>
    new Promise((resolve, reject) => {
      r.addEventListener('success', () => resolve(r.result));
      r.addEventListener('error', () => reject(r.error));
    });
  const open = () =>
    (opening ??= new Promise(resolve => {
      if (!factory) return resolve(null);
      try {
        const o = factory.open(DB_NAME, 1);
        o.onupgradeneeded = () => o.result.createObjectStore(STORE, { keyPath: 'key' });
        o.onsuccess = () => resolve(o.result);
        o.onerror = () => resolve(null);
        o.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    }));
  /** Reads which pictures there are (not the pictures themselves). */
  const load = () =>
    (ready ??= (async () => {
      const db = await open();
      if (!db) return;
      const rows = await req(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
      for (const r of rows) index.set(r.key, r.createdAt);
    })());

  return {
    load,
    /** Whether this quilt has a picture (after load()). @param {string} key */
    has: key => index.has(key),
    /** @param {string} key @returns {Promise<PictureRecord | null>} */
    async get(key) {
      await load();
      const db = await open();
      if (!db) return memory.get(key) || null;
      return (await req(db.transaction(STORE, 'readonly').objectStore(STORE).get(key))) || null;
    },
    /** @param {string} key @param {Blob} blob @param {{ width: number, height: number }} size */
    async put(key, blob, size) {
      await load();
      const rec = { key, blob, ...size, createdAt: Date.now() },
        db = await open();
      index.set(key, rec.createdAt);
      const old = [...index.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(KEEP)
        .map(e => e[0]);
      for (const k of old) index.delete(k);
      if (!db) {
        memory.set(key, rec);
        for (const k of old) memory.delete(k);
        return;
      }
      const tx = db.transaction(STORE, 'readwrite'),
        os = tx.objectStore(STORE);
      os.put(rec);
      for (const k of old) os.delete(k);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

/** The app's pictures. */
const pictures = createPictures();

export { KEEP, createPictures, pictures };
