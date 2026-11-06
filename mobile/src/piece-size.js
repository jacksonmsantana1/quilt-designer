// The size of a cut piece of fabric, as the person types it: in cm or in inches, a comma or a point for decimals. The
// app keeps fabrics in cm (how much cloth the picture's width covers), so inches are turned into cm here. The last size
// and unit are remembered on this phone, for the next piece cut the same.
import { comma, t } from '@quilt/shared/i18n.js';

const KEY = 'quilt-phone-piece.v1',
  CM_PER_IN = 2.54,
  // what the server takes as a fabric's width (server/src/routes/fabrics.js)
  MIN_CM = 1,
  MAX_CM = 300;

/** @typedef {'cm' | 'in'} Unit */
/** @typedef {{ w: string, h: string, unit: Unit }} PieceText what is in the boxes */

/** @returns {PieceText} */
function lastPiece() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v.w === 'string' && typeof v.h === 'string' && (v.unit === 'cm' || v.unit === 'in')) return v;
  } catch (e) {
    // nothing kept, or not readable: the usual starting size
  }
  return { w: '15', h: '15', unit: 'cm' };
}
/** @param {PieceText} p */
function keepPiece(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    // a phone that keeps nothing: the size is asked again next time
  }
}

/** A typed length: "15", "15,5", "15.5", " 6 ". NaN when it isn't one. @param {string} text */
function parseLength(text) {
  const s = String(text).trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** @param {number} v @param {Unit} unit */
const toCm = (v, unit) => (unit === 'in' ? v * CM_PER_IN : v);
/** @param {number} cm @param {Unit} unit */
const fromCm = (cm, unit) => (unit === 'in' ? cm / CM_PER_IN : cm);

/** A length for reading: at most one decimal, with the language's comma. @param {number} v */
const short = v => comma(String(Math.round(v * 10) / 10));

/** "15 × 15 cm", "6 × 6 in". @param {number} wCm @param {number} hCm @param {Unit} unit */
function sizeLabel(wCm, hCm, unit) {
  const w = short(fromCm(wCm, unit)),
    h = short(fromCm(hCm, unit));
  return unit === 'in' ? t('{w} × {h} in', { w, h }) : t('{w} × {h} cm', { w, h });
}

/**
 * The piece from the boxes, or why it isn't one.
 * @param {PieceText} p @returns {{ wCm: number, hCm: number, aspect: number, label: string } | { error: string }}
 */
function readPiece(p) {
  const w = parseLength(p.w),
    h = parseLength(p.h);
  if (!(w > 0) || !(h > 0)) return { error: t('Type the width and the height of the piece.') };
  const wCm = toCm(w, p.unit),
    hCm = toCm(h, p.unit);
  if (wCm < MIN_CM || hCm < MIN_CM || wCm > MAX_CM || hCm > MAX_CM)
    return { error: t('A piece can be from 1 to 300 cm on each side.') };
  return { wCm, hCm, aspect: wCm / hCm, label: sizeLabel(wCm, hCm, p.unit) };
}

/** The unit the person last used. @returns {Unit} */
const lastUnit = () => lastPiece().unit;

export { fromCm, keepPiece, lastPiece, lastUnit, MAX_CM, MIN_CM, parseLength, readPiece, short, sizeLabel, toCm };
