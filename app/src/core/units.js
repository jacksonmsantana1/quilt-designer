// @ts-check
// Millimetres or inches: which one lengths are shown and typed in. Pure (no DOM, no storage). A quilt is always kept
// in millimetres; this only changes how a length is written on screen and how a typed number is read. In inches,
// lengths are written the way quilters say them: to the nearest ⅛, with fractions (6½ in, 11¾ in).

import { fix, t } from '@quilt/shared/i18n.js';

/** @typedef {'mm' | 'in'} Unit */
const MM_PER_IN = 25.4;
const FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** @type {Unit} */
let unit = 'mm';
/** @type {(() => void)[]} */
const listeners = [];

/** The unit now in use. @returns {Unit} */
const getUnit = () => unit;
/** The unit as written on screen: "mm", and inches as "in" ("pol" in Portuguese). @returns {string} */
const unitName = () => (unit === 'in' ? t('in') : 'mm');
/** Changes the unit and tells everyone who asked (once, and only when it changed). @param {Unit} u */
function setUnit(u) {
  if (u !== 'mm' && u !== 'in') return;
  if (u === unit) return;
  unit = u;
  listeners.forEach(fn => fn());
}
/** Calls fn after the unit changes. @param {() => void} fn */
const onUnitChange = fn => {
  listeners.push(fn);
};

/** A length in inches as whole inches and eighths: 165 mm → "6½". @param {number} mm */
function inches(mm) {
  const eighths = Math.round((mm / MM_PER_IN) * 8),
    whole = Math.floor(eighths / 8),
    part = FRACTIONS[eighths % 8];
  return part && whole === 0 ? part : `${whole}${part}`;
}

/** A length as a number in the unit in use, without the unit's name ("6½" or "165"). @param {number} mm */
const num = mm => (unit === 'in' ? inches(mm) : String(Math.round(mm)));
/** A length with its unit's name: "165 mm" or "6½ in". @param {number} mm */
const len = mm => `${num(mm)} ${unitName()}`;
/**
 * How much fabric to buy for a length (mm): rounded up to 5 cm and written in metres, or rounded up to an eighth of a
 * yard and written in yards ("1⅝ yd").
 * @param {number} mm
 */
function buyLen(mm) {
  if (unit === 'mm') return `${fix(Math.ceil(mm / 50 - 1e-6) * 0.05, 2)} m`;
  const eighths = Math.ceil(mm / (MM_PER_IN * 4.5) - 1e-6),
    whole = Math.floor(eighths / 8),
    part = FRACTIONS[eighths % 8];
  // Shops in Brazil sell by the metre even when the pattern is in inches, so the metres come along in brackets.
  const metres = Math.ceil((eighths * MM_PER_IN * 4.5) / 50 - 1e-6) * 0.05;
  return `${part && whole === 0 ? part : whole + part} ${t('yd')} (${fix(metres, 2)} m)`;
}
/** Several lengths with the unit written once: "900 × 300 mm" or "35½ × 11¾ in". @param {number[]} mms @param {string} [sep] */
const dims = (mms, sep = ' × ') => `${mms.map(num).join(sep)} ${unitName()}`;

/**
 * The number to put in a number box for a length: whole millimetres, or inches to two decimals (a length that is
 * within half a millimetre of a sixteenth of an inch shows as that sixteenth: 152 mm is "6", not "5.98").
 * @param {number} mm @returns {number}
 */
function toInput(mm) {
  if (unit === 'mm') return Math.round(mm);
  const sixteenths = Math.round((mm / MM_PER_IN) * 16);
  if (Math.abs(sixteenths * (MM_PER_IN / 16) - mm) < 0.5) return sixteenths / 16;
  return Math.round((mm / MM_PER_IN) * 100) / 100;
}
/** The length (whole millimetres) a number typed in a number box means. @param {number} v @returns {number} */
const fromInput = v => (unit === 'in' ? Math.round(v * MM_PER_IN) : Math.round(v));
/**
 * The min, max and step of a number box for a length that goes from min to max millimetres.
 * @param {number} minMm @param {number} maxMm @returns {{ min: number, max: number, step: number }}
 */
function inputRange(minMm, maxMm) {
  return unit === 'in'
    ? { min: Math.ceil((minMm / MM_PER_IN) * 8) / 8, max: Math.floor((maxMm / MM_PER_IN) * 8) / 8, step: 0.125 }
    : { min: minMm, max: maxMm, step: 1 };
}

/**
 * A number of inches as whole inches and eighths, to the nearest eighth (what the inch boxes show: a whole number
 * and a fraction menu): 11.8125 → [11, 7], 6.5 → [6, 4]. @param {number} v @returns {[number, number]}
 */
function eighthsOf(v) {
  // the box holds inches to a sixteenth (toInput): a length exactly between two eighths was rounded up to that
  // sixteenth, so halves go down, as the written length (inches) has it: 300 mm is 11.8125 in the box, 11¾ written
  const e = Math.max(0, Math.round((Number.isFinite(v) ? Math.max(0, v) : 0) * 8 - 1e-6));
  return [Math.floor(e / 8), e % 8];
}

/**
 * A starting length that reads round in the unit in use: in inches the nearest whole inch, so a new quilt's 300 mm
 * blocks are 12 in (305 mm) and not 11¾. @param {number} mm @returns {number}
 */
const roundLen = mm => (unit === 'in' ? Math.round(Math.round(mm / MM_PER_IN) * MM_PER_IN) : mm);

/**
 * How many squares to cut for one block: a square cut in two or four can serve several blocks, so it may be a share
 * of one (half a square per block, three in all for six). @param {number} n
 */
function sharesOf(n) {
  const whole = Math.floor(n),
    part = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[n - whole];
  return part === undefined ? String(Math.ceil(n)) : `${whole || ''}${part}` || '0';
}

export {
  roundLen,
  sharesOf,
  FRACTIONS,
  MM_PER_IN,
  buyLen,
  dims,
  eighthsOf,
  fromInput,
  getUnit,
  inches,
  inputRange,
  len,
  num,
  onUnitChange,
  setUnit,
  toInput,
  unitName,
};
