// The fabric library used by the designer.
import '../sim/controls.js'; // load order: runs after sim/controls

import { BUNDLED, prepareSwatch } from '@quilt/shared/basic-fabrics.js';
import { fabrics, getSession } from '../storage/repo.js';
import { fabricIdsIn, withRecent } from '../core/fabric-picks.js';
import { collection, collectionCanvas } from '@quilt/shared/fabric-patterns.js';

// ---- fabric library (bundled scans, the collection drawn in code, the user's photos)
// A photo is turned into a picture to draw with (`canvas`) only when a quilt uses it or someone picks it: with
// hundreds of photos, making them all at start took seconds and hundreds of MB. Until then its entry has the
// stored `blob`, and lists show it with a small <img>. The collection's 1500 fabrics are drawn by code
// (shared/src/fabric-patterns.js) the same way: only when used; lists show a small copy kept on its own.
/** @typedef {{ id: string, name: string, cm: number, canvas: HTMLCanvasElement | null, blob?: Blob,
 *   basic?: boolean, print?: boolean, added?: number, loading?: Promise<void>, broken?: boolean,
 *   collection?: boolean, pattern?: import('@quilt/shared/fabric-patterns.js').CollectionFabric }} Fabric */
/** @type {Fabric[]} */
const fabricLib = [];
const byId = new Map();
const put = f => {
  fabricLib.push(f);
  byId.set(f.id, f);
};
const isFabric = id => byId.has(id);
let loading = null;
/** Lists the bundled fabrics and the user's own photos kept in storage; makes pictures of those the saved quilt uses. */
function initFabricLib() {
  return (loading ??= (async () => {
    const preps = await Promise.all(BUNDLED.map(prepareSwatch));
    preps.forEach((s, i) =>
      put({
        id: 'b' + i,
        name: s.name,
        canvas: s.canvas,
        cm: s.cm,
        basic: true,
        print: !s.tint && !/linen/i.test(BUNDLED[i].src || ''), // (the file: the name is in the language in use)
      }),
    );
    for (const p of collection())
      put({
        id: p.id,
        name: p.name,
        cm: p.cm,
        canvas: null,
        collection: true,
        pattern: p,
        print: p.kind !== 'Solid' && p.kind !== 'Mottled',
      });
    for (const r of fabrics.list()) addStoredFabric(r);
    await loadFabrics(fabricIdsIn(getSession('current'), isFabric));
  })());
}
/** @param {Blob} blob @returns {Promise<HTMLCanvasElement>} */
async function blobCanvas(blob) {
  const bm = await createImageBitmap(blob),
    c = document.createElement('canvas');
  c.width = bm.width;
  c.height = bm.height;
  c.getContext('2d').drawImage(bm, 0, 0);
  bm.close?.();
  return c;
}
// small copies of collection fabrics for the lists: browsing all 1500 would otherwise keep 1500 big pictures
const THUMB = 64;
const thumbs = new Map();
/**
 * What a list draws a fabric's tile (or measures its colours) from: a picture and the size of the square to take
 * from its corner (about 9 cm of cloth on the bundled scans). Not for photos (lists show those with an <img>).
 * @param {Fabric} f @returns {[CanvasImageSource, number]}
 */
function tileSource(f) {
  if (f.canvas) return [f.canvas, Math.min(f.canvas.width, f.canvas.height, 360)];
  if (!thumbs.has(f.id)) {
    const big = collectionCanvas(f.pattern),
      t = document.createElement('canvas');
    t.width = t.height = THUMB;
    t.getContext('2d').drawImage(big, 0, 0, 360, 360, 0, 0, THUMB, THUMB);
    thumbs.set(f.id, t);
  }
  return [thumbs.get(f.id), THUMB];
}
/** A stored photo (kept here, or arrived from another device): into the fabric list, once. @param {{ id: string, name: string, cm: number, blob: Blob, createdAt?: number }} r */
function addStoredFabric(r) {
  if (!byId.has(r.id)) put({ id: r.id, name: r.name, cm: r.cm, canvas: null, blob: r.blob, added: r.createdAt || 0 });
}

// called when pictures finish loading after something was already drawn with a stand-in (app/pages.js redraws)
const loadedListeners = [];
let loadedSoon = false;
/** @param {() => void} fn */
const onFabricsLoaded = fn => loadedListeners.push(fn);
/**
 * Makes the pictures of these fabrics, if they aren't made yet. A photo the browser can't read any more is
 * left out of the lists and its parts show the first fabric.
 * @param {Iterable<string>} ids @returns {Promise<void>}
 */
async function loadFabrics(ids) {
  const jobs = [];
  for (const id of ids) {
    const fab = byId.get(id);
    if (!fab || fab.canvas) continue;
    fab.loading ??= (
      fab.pattern ? Promise.resolve().then(() => collectionCanvas(fab.pattern)) : blobCanvas(fab.blob)
    ).then(
      c => {
        fab.canvas = c;
      },
      () => {
        fab.broken = true;
        fab.canvas = fabricLib[0].canvas;
      },
    );
    jobs.push(fab.loading);
  }
  await Promise.all(jobs);
}
/**
 * A fabric by id; unknown ids give the first fabric. One whose picture isn't made yet is drawn with the first
 * fabric's picture for now, and everything is redrawn once its own picture is ready.
 */
const fabricById = id => {
  const f = byId.get(id) || fabricLib[0];
  if (f.canvas) return f;
  loadFabrics([f.id]).then(() => {
    if (loadedSoon) return;
    loadedSoon = true;
    setTimeout(() => {
      loadedSoon = false;
      loadedListeners.forEach(fn => fn());
    }, 0);
  });
  return { ...f, canvas: fabricLib[0].canvas };
};
/** The fabrics to show in lists (not photos that can't be read). */
const listedFabrics = () => fabricLib.filter(f => !f.broken);
/** A link to show a photo in a list (kept: the photo stays in memory anyway). @param {Fabric} f */
const urls = new Map();
const thumbUrl = f => {
  if (!urls.has(f.id)) urls.set(f.id, URL.createObjectURL(f.blob));
  return urls.get(f.id);
};

// ---- recently picked fabrics, per device
const RECENT_KEY = 'quilt-recent-fabrics.v1';
/** @returns {string[]} */
function recentFabrics() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter(isFabric) : [];
  } catch (e) {
    return [];
  }
}
/** Remembers a photo as recently picked (the basics are always in the lists anyway). @param {string} id */
function noteRecent(id) {
  if (!byId.get(id) || byId.get(id).basic) return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(withRecent(recentFabrics(), id)));
  } catch (e) {}
}

// ---- the palette: the fabrics kept in the short lists, in order (× takes one off, the library puts it back);
// per device. null until the person changes it: the lists then show the default (core/fabric-picks.js)
const PALETTE_KEY = 'quilt-fabric-palette.v1';
/** @returns {string[] | null} */
function fabricPalette() {
  try {
    const v = JSON.parse(localStorage.getItem(PALETTE_KEY) || 'null');
    return Array.isArray(v) ? v.filter(isFabric) : null;
  } catch (e) {
    return null;
  }
}
/** Keeps the palette (null: back to the default). @param {string[] | null} ids */
function setFabricPalette(ids) {
  try {
    if (ids) localStorage.setItem(PALETTE_KEY, JSON.stringify(ids));
    else localStorage.removeItem(PALETTE_KEY);
  } catch (e) {}
}

/**
 * Adds a fabric from a photo and keeps it in storage. The same photo twice gives the same fabric. A photo just
 * added counts as recently picked, and joins the palette (when there is one), so it shows in the short lists.
 * @param {HTMLCanvasElement} canvas @param {{ name: string, cm: number }} meta @returns {Promise<string>} its id
 */
async function addFabric(canvas, meta) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/jpeg', 0.92),
  );
  const { id } = await fabrics.add(blob, meta);
  if (!byId.has(id)) put({ id, name: meta.name, canvas, cm: meta.cm, blob, added: Date.now() });
  noteRecent(id);
  const palette = fabricPalette();
  if (palette && !palette.includes(id)) setFabricPalette([...palette, id]);
  return id;
}
const ROLE_DEFAULT = ['b0', 'b1', 'b3']; // cream, indigo, mustard

export {
  ROLE_DEFAULT,
  addFabric,
  addStoredFabric,
  fabricById,
  fabricLib,
  fabricPalette,
  initFabricLib,
  isFabric,
  listedFabrics,
  loadFabrics,
  noteRecent,
  onFabricsLoaded,
  recentFabrics,
  setFabricPalette,
  thumbUrl,
  tileSource,
};
