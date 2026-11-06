// The fabrics a quilt on the phone can be made of: the app's basics and its collection (the same as the web app's), and
// the photos of whoever shared the quilt, which come with it as links, and the person's own. Each picture is made only
// when a quilt needs it.
import { BUNDLED, prepareSwatch } from '@quilt/shared/basic-fabrics.js';
import { collection, collectionCanvas } from '@quilt/shared/fabric-patterns.js';
import { fabricIdsIn } from '../../app/src/core/fabric-picks.js';
import { repo } from '../../app/src/storage/repo.js';

// a phone has no use for a fabric photo much larger than this, and little memory to spare
const PHOTO_PX = 1024;

/** @typedef {{ cm: number, canvas: HTMLCanvasElement | null, pattern?: any, url?: string, blob?: Blob, loading?: Promise<void> }} PhoneFabric */
/** @type {Map<string, PhoneFabric>} */
const byId = new Map();
/** @type {PhoneFabric} the stand-in for a fabric that can't be drawn */
let first = null;
/** @type {Promise<void> | null} */
let ready = null;

/** Gets the list of fabrics ready (once). */
function initFabrics() {
  return (ready ??= (async () => {
    const basics = await Promise.all(BUNDLED.map(d => prepareSwatch(d)));
    basics.forEach((s, i) => byId.set('b' + i, { cm: s.cm, canvas: s.canvas }));
    first = byId.get('b0');
    for (const p of collection()) byId.set(p.id, { cm: p.cm, canvas: null, pattern: p });
  })());
}

/** A photo from its link, on a canvas. @param {string} url @returns {Promise<HTMLCanvasElement>} */
function photoCanvas(url) {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, PHOTO_PX / Math.max(im.naturalWidth, im.naturalHeight)),
        c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k));
      c.height = Math.max(1, Math.round(im.naturalHeight * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      ok(c);
    };
    im.onerror = fail;
    im.src = url;
  });
}

/** @param {PhoneFabric} f */
async function ownOrLinked(f) {
  if (!f.blob) return photoCanvas(f.url);
  const url = URL.createObjectURL(f.blob);
  try {
    return await photoCanvas(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Makes the pictures this quilt needs. One that can't be fetched shows the first fabric instead.
 * @param {any} design @param {{ id: string, cm: number, url: string }[]} [photos] the shared quilt's fabric photos
 */
async function fabricsReady(design, photos = []) {
  await initFabrics();
  for (const p of photos) if (!byId.has(p.id)) byId.set(p.id, { cm: p.cm, canvas: null, url: p.url });
  for (const r of repo.fabrics.list())
    if (r.blob && !byId.has(r.id)) byId.set(r.id, { cm: r.cm, canvas: null, blob: r.blob });
  const jobs = [];
  for (const id of fabricIdsIn(design, s => byId.has(s))) {
    const f = byId.get(id);
    if (f.canvas) continue;
    f.loading ??= (f.pattern ? Promise.resolve(collectionCanvas(f.pattern)) : ownOrLinked(f)).then(
      c => {
        f.canvas = c;
      },
      () => {
        f.canvas = first.canvas;
      },
    );
    jobs.push(f.loading);
  }
  await Promise.all(jobs);
}

/** A fabric by id, as the quilt painter asks for it; unknown ids give the first fabric. @param {string} id */
function fabricById(id) {
  const f = byId.get(id) || first;
  return f.canvas ? f : first;
}

export { fabricById, fabricsReady, initFabrics };
