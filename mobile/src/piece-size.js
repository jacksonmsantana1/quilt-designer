// The size of a cut piece of fabric, as the person types it: in cm or in inches, a comma or a point for decimals. The
// app keeps fabrics in cm (how much cloth the picture's width covers), so inches are turned into cm here. The last size
// and unit are remembered on this phone, for the next piece cut the same. In inches each box has a fraction menu beside
// it (⅛ … ⅞), and sizes are written the way quilters say them, as the web app does: 6½ × 4¼ in.
import { comma, t } from '@quilt/shared/i18n.js';

const KEY = 'quilt-phone-piece.v1',
  CM_PER_IN = 2.54,
  // what the server takes as a fabric's width (server/src/routes/fabrics.js)
  MIN_CM = 1,
  MAX_CM = 300,
  // the web app's inch fractions (app/src/core/units.js)
  FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** @typedef {'cm' | 'in'} Unit */
/**
 * What is in the boxes: the numbers as typed, and in inches the eighths chosen beside them ('0' … '7').
 * @typedef {{ w: string, h: string, unit: Unit, wf?: string, hf?: string }} PieceText
 */

/** @param {unknown} f */
const isEighths = f => f === undefined || (typeof f === 'string' && /^[0-7]$/.test(f));

/** @returns {PieceText} */
function lastPiece() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (
      v &&
      typeof v.w === 'string' &&
      typeof v.h === 'string' &&
      (v.unit === 'cm' || v.unit === 'in') &&
      isEighths(v.wf) &&
      isEighths(v.hf)
    )
      return v;
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

/** Inches as whole inches and eighths, to the nearest eighth: 6.5 → "6½", 0.25 → "¼". @param {number} v */
function inches(v) {
  const eighths = Math.round(v * 8),
    whole = Math.floor(eighths / 8),
    part = FRACTIONS[eighths % 8];
  return part && whole === 0 ? part : `${whole}${part}`;
}

/** "15 × 15 cm", "6½ × 4¼ in". @param {number} wCm @param {number} hCm @param {Unit} unit */
function sizeLabel(wCm, hCm, unit) {
  if (unit === 'in') return t('{w} × {h} in', { w: inches(fromCm(wCm, unit)), h: inches(fromCm(hCm, unit)) });
  return t('{w} × {h} cm', { w: short(wCm), h: short(hCm) });
}

/**
 * One side: the number typed, and in inches the eighths chosen beside it. The number may be left empty for "⅞ in".
 * NaN when it isn't a length. @param {string} text @param {string | undefined} eighthsText @param {Unit} unit
 */
function readSide(text, eighthsText, unit) {
  const eighths = unit === 'in' ? Number(eighthsText || 0) / 8 : 0;
  if (eighths && !String(text).trim()) return eighths;
  return parseLength(text) + eighths;
}

/**
 * What to put in a box and its fraction menu for a length: in cm "15,5" (no fraction), in inches the whole inches and
 * the nearest eighth, 6.5 in → "6" and "4". @param {number} cm @param {Unit} unit @returns {{ text: string, eighths: string }}
 */
function boxesFor(cm, unit) {
  if (unit !== 'in') return { text: short(cm), eighths: '0' };
  const e = Math.round(fromCm(cm, unit) * 8);
  return { text: String(Math.floor(e / 8)), eighths: String(e % 8) };
}

/** The fraction menu beside an inch box: 0, ⅛, ¼ … ⅞, as in the web app. @param {string} id @param {string} label */
function fractionMenu(id, label) {
  const menu = document.createElement('select');
  menu.id = id;
  menu.className = 'frac-box';
  menu.setAttribute('aria-label', label);
  FRACTIONS.forEach((f, i) => menu.add(new Option(f || '0', String(i))));
  return menu;
}

/**
 * The piece from the boxes, or why it isn't one.
 * @param {PieceText} p @returns {{ wCm: number, hCm: number, aspect: number, label: string } | { error: string }}
 */
function readPiece(p) {
  const w = readSide(p.w, p.wf, p.unit),
    h = readSide(p.h, p.hf, p.unit);
  if (!(w > 0) || !(h > 0)) return { error: t('Type the width and the height of the piece.') };
  const wCm = toCm(w, p.unit),
    hCm = toCm(h, p.unit);
  if (wCm < MIN_CM || hCm < MIN_CM || wCm > MAX_CM || hCm > MAX_CM)
    return { error: t('A piece can be from 1 to 300 cm on each side.') };
  return { wCm, hCm, aspect: wCm / hCm, label: sizeLabel(wCm, hCm, p.unit) };
}

/** The unit the person last used. @returns {Unit} */
const lastUnit = () => lastPiece().unit;

export {
  boxesFor,
  fractionMenu,
  fromCm,
  inches,
  keepPiece,
  lastPiece,
  lastUnit,
  MAX_CM,
  MIN_CM,
  readPiece,
  readSide,
  sizeLabel,
  toCm,
};
