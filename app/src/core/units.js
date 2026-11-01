// @ts-check
// Millimetres or inches: which one lengths are shown and typed in. Pure (no DOM, no storage). A quilt is always kept
// in millimetres; this only changes how a length is written on screen and how a typed number is read. In inches,
// lengths are written the way quilters say them: to the nearest ⅛, with fractions (6½ in, 11¾ in).

/** @typedef {'mm' | 'in'} Unit */
const MM_PER_IN = 25.4;
const FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** @type {Unit} */
let unit = 'mm';
/** @type {(() => void)[]} */
const listeners = [];

/** The unit now in use. @returns {Unit} */
const getUnit = () => unit;
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
const len = mm => `${num(mm)} ${unit}`;
/**
 * How much fabric to buy for a length (mm): rounded up to 5 cm and written in metres, or rounded up to an eighth of a
 * yard and written in yards ("1⅝ yd").
 * @param {number} mm
 */
function buyLen(mm) {
  if (unit === 'mm') return `${(Math.ceil(mm / 50 - 1e-6) * 0.05).toFixed(2)} m`;
  const eighths = Math.ceil(mm / (MM_PER_IN * 4.5) - 1e-6),
    whole = Math.floor(eighths / 8),
    part = FRACTIONS[eighths % 8];
  return `${part && whole === 0 ? part : whole + part} yd`;
}
/** Several lengths with the unit written once: "900 × 300 mm" or "35½ × 11¾ in". @param {number[]} mms @param {string} [sep] */
const dims = (mms, sep = ' × ') => `${mms.map(num).join(sep)} ${unit}`;

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

export { MM_PER_IN, buyLen, dims, fromInput, getUnit, inches, inputRange, len, num, onUnitChange, setUnit, toInput };
