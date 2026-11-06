// Getting a picture ready to keep. Drawing it on a canvas and saving that makes a new file: what the camera wrote in the
// old one (where it was taken, which phone) stays behind. The browser turns the picture upright as it draws it.
import { fabricColours } from '../../app/src/core/colour-match.js';

const QUILT_PX = 2000,
  FABRIC_PX = 1600;

/** @param {Blob} blob @returns {Promise<HTMLImageElement>} */
function loadImage(blob) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(blob),
      im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      ok(im);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      fail(new Error('not a picture'));
    };
    im.src = url;
  });
}

/** Part of a picture as a new JPEG. @param {HTMLImageElement} im @param {{ x: number, y: number, w: number, h: number }} part in the picture's pixels @param {number} maxSide @returns {Promise<Blob>} */
function jpegOf(im, { x, y, w, h }, maxSide) {
  const k = Math.min(1, maxSide / Math.max(w, h)),
    c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => {
    c.toBlob(b => (b ? ok(b) : fail(new Error('could not save the picture'))), 'image/jpeg', 0.86);
  });
}

/** A photo of a quilt, ready to keep. @param {Blob} blob @returns {Promise<Blob>} */
async function quiltPhoto(blob) {
  const im = await loadImage(blob);
  return jpegOf(im, { x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight }, QUILT_PX);
}

/** The cropped part of a fabric's photo, ready to keep. @param {HTMLImageElement} im @param {{ x: number, y: number, w: number, h: number }} part @returns {Promise<Blob>} */
const fabricPhoto = (im, part) => jpegOf(im, part, FABRIC_PX);

/** A picture's main colours, from a small copy of it. @param {Blob} blob @returns {Promise<{ rgb: number[], share: number }[]>} */
async function measureColours(blob) {
  const N = 48,
    c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(await loadImage(blob), 0, 0, N, N);
  return fabricColours(g.getImageData(0, 0, N, N).data);
}

export { fabricPhoto, loadImage, measureColours, quiltPhoto };
