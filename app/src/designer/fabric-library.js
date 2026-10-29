// The fabric library used by the designer.
import '../sim/controls.js'; // load order: runs after sim/controls

import { BUNDLED, prepareSwatch } from '../sim/patchwork.js';
import { fabrics } from '../storage/repo.js';

// ---- fabric library (bundled scans + the user's photos)
const fabricLib = []; // {id, name, canvas, cm}
const fabricById = id => fabricLib.find(f => f.id === id) || fabricLib[0];
let loading = null;
/** Loads the bundled fabrics, then the user's own photos kept in storage. */
function initFabricLib() {
  return (loading ??= (async () => {
    const preps = await Promise.all(BUNDLED.map(prepareSwatch));
    preps.forEach((s, i) =>
      fabricLib.push({
        id: 'b' + i,
        name: s.name,
        canvas: s.canvas,
        cm: s.cm,
        print: !s.tint && !/linen/i.test(s.name),
      }),
    );
    for (const r of fabrics.list()) {
      try {
        fabricLib.push({ id: r.id, name: r.name, canvas: await blobCanvas(r.blob), cm: r.cm });
      } catch (e) {} // an image the browser can't read any more: its parts show the first fabric
    }
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
/** A photo that arrived from another device (sync): into the fabric list, once. @param {{ id: string, name: string, cm: number, blob: Blob }} r */
async function addStoredFabric(r) {
  if (fabricLib.some(f => f.id === r.id)) return;
  fabricLib.push({ id: r.id, name: r.name, canvas: await blobCanvas(r.blob), cm: r.cm });
}
/**
 * Adds a fabric from a photo and keeps it in storage. The same photo twice gives the same fabric.
 * @param {HTMLCanvasElement} canvas @param {{ name: string, cm: number }} meta @returns {Promise<string>} its id
 */
async function addFabric(canvas, meta) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/jpeg', 0.92),
  );
  const { id } = await fabrics.add(blob, meta);
  if (!fabricLib.some(f => f.id === id)) fabricLib.push({ id, name: meta.name, canvas, cm: meta.cm });
  return id;
}
const ROLE_DEFAULT = ['b0', 'b1', 'b3']; // cream, indigo, mustard

export { ROLE_DEFAULT, addFabric, addStoredFabric, fabricById, fabricLib, initFabricLib };
