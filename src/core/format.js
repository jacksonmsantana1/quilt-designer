// @ts-check
// The saved design format: its version, the upgrades from older versions, and the checks that make any saved
// design safe to open (pure). Every place that opens a design calls readDesign.
//
// To change the format: change the design, bump FORMAT_VERSION, add one function to MIGRATIONS (from the
// previous version to the new one), add a saved example to tests/fixtures/designs, and update `check` if needed.
import { PATTERNS, partsOf } from './patterns.js';
import { BORDER_TYPES, normalizeSpans } from './geometry.js';
import { FORMAT_VERSION, ROLE_DEFAULT, defaultDesign } from './design.js';
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Block} Block */

/**
 * MIGRATIONS[n] upgrades a version-n design to version n + 1. Each one is pure and only does its own step;
 * readDesign runs them in turn. Version 0 is every design saved before designs had a version.
 * @type {((d: any) => any)[]}
 */
const MIGRATIONS = [
  // 0 → 1: designs saved before block sizes and backing fabrics existed
  d => ({
    ...d,
    blockMm: d.blockMm > 0 ? d.blockMm : Math.round(2290 / (d.cols || 5)),
    backFabric: d.backFabric || 'b0',
    v: 1,
  }),
];

/** @type {Record<string, [number, number]>} */
const LIMITS = { grid: [1, 20], blockMm: [50, 1000], borderMm: [10, 400], sashMm: [0, 400], span: [2, 4] };
const SYMS = ['off', 'lr', 'tb', 'both', 'kal'];
const QUILTING = ['ditch', 'cross', 'fans', 'meander'];

const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const isFabric = x => typeof x === 'string' && x.length > 0 && x.length < 64;
const num = x => typeof x === 'number' && Number.isFinite(x);
/** @param {number} x @param {[number, number]} r */
const clamp = (x, [lo, hi]) => Math.max(lo, Math.min(hi, x));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Checks a current-version design and repairs what can be repaired safely. Never changes its input.
 * Returns null when it is not a quilt at all; otherwise the repaired design and what was repaired.
 * @param {any} d @returns {{ design: Design, problems: string[] } | null}
 */
function check(d) {
  if (!isObj(d) || !num(d.cols) || !num(d.rows) || !Array.isArray(d.blocks)) return null;
  const problems = [];
  const count = {};
  const note = (key, n = 1) => (count[key] = (count[key] || 0) + n);
  const cols = clamp(Math.round(d.cols), LIMITS.grid),
    rows = clamp(Math.round(d.rows), LIMITS.grid);
  if (cols !== d.cols || rows !== d.rows) problems.push(`The layout was changed to ${cols} × ${rows}.`);

  // blocks: one per cell; a missing cell becomes a plain block, extra blocks are dropped
  const n = cols * rows;
  if (d.blocks.length !== n) {
    if (d.blocks.length > n) note('extra', d.blocks.length - n); // missing ones are counted by checkBlock
  }
  /** @type {Block[]} */
  const blocks = [];
  for (let i = 0; i < n; i++) blocks.push(checkBlock(d.blocks[i], note));
  if (count.missing)
    problems.push(
      `${plural(count.missing, 'missing block')} ${count.missing === 1 ? 'was' : 'were'} filled with a plain square.`,
    );
  if (count.extra)
    problems.push(`${plural(count.extra, 'extra block')} ${count.extra === 1 ? 'was' : 'were'} left out.`);
  if (count.pattern)
    problems.push(
      `${plural(count.pattern, 'block')} with an unknown pattern became ${count.pattern === 1 ? 'a plain square' : 'plain squares'}.`,
    );
  if (count.fabric)
    problems.push(
      `${plural(count.fabric, 'missing fabric')} ${count.fabric === 1 ? 'was' : 'were'} filled in with the default colours.`,
    );
  if (count.block)
    problems.push(
      `${plural(count.block, 'block setting')} that could not be read ${count.block === 1 ? 'was' : 'were'} reset.`,
    );

  /** @type {Design} */
  const out = { ...d, v: FORMAT_VERSION, cols, rows, blocks };
  if (!num(d.blockMm) || d.blockMm !== clamp(Math.round(d.blockMm), LIMITS.blockMm)) {
    out.blockMm = num(d.blockMm) ? clamp(Math.round(d.blockMm), LIMITS.blockMm) : Math.round(2290 / cols);
    problems.push(`The block size was changed to ${out.blockMm} mm.`);
  }
  if (!isFabric(d.backFabric)) {
    out.backFabric = 'b0';
    if (d.backFabric !== undefined) problems.push('The backing fabric was reset.');
  }

  if (d.sashing !== undefined) {
    const s = d.sashing;
    if (isObj(s) && num(s.mm)) {
      out.sashing = {
        mm: clamp(Math.round(s.mm), LIMITS.sashMm),
        fabric: isFabric(s.fabric) ? s.fabric : 'b0',
        corner: isFabric(s.corner) ? s.corner : 'b3',
        border: s.border === true,
      };
    } else {
      delete out.sashing;
      problems.push('The sashing could not be read and was taken off.');
    }
  }

  if (d.borders !== undefined) {
    const list = Array.isArray(d.borders) ? d.borders : [];
    let adjusted = 0;
    out.borders = list
      .filter(b => isObj(b) && BORDER_TYPES[b.type] && num(b.mm))
      .map(b => {
        const nb = {
          ...b,
          mm: clamp(Math.round(b.mm), LIMITS.borderMm),
          fabrics: (Array.isArray(b.fabrics) ? b.fabrics : []).map(f => (isFabric(f) ? f : 'b0')),
        };
        if (nb.mm !== b.mm || !Array.isArray(b.fabrics) || !b.fabrics.every(isFabric)) adjusted++;
        return nb;
      });
    if (!out.borders.length) delete out.borders;
    const lost = (Array.isArray(d.borders) ? d.borders.length : 1) - (out.borders || []).length;
    if (adjusted) problems.push(`${plural(adjusted, 'border')} had a width or fabric that was put right.`);
    if (lost)
      problems.push(`${plural(lost, 'border')} that could not be read ${lost === 1 ? 'was' : 'were'} taken off.`);
  }

  if (d.sym !== undefined && !SYMS.includes(d.sym)) {
    delete out.sym;
    problems.push('The symmetry setting was turned off.');
  }
  if (d.quilting !== undefined && !QUILTING.includes(d.quilting)) {
    delete out.quilting;
    problems.push('The quilting went back to stitch in the ditch.');
  }
  return { design: normalizeSpans(out), problems };
}

/** @param {any} b @param {(key: string) => void} note @returns {Block} */
function checkBlock(b, note) {
  if (b === undefined) {
    note('missing');
    return { pattern: 'plain', rot: 0, fabrics: ['b0'] };
  }
  if (!isObj(b) || !PATTERNS[b.pattern]) {
    note('pattern');
    return {
      pattern: 'plain',
      rot: 0,
      fabrics: [isObj(b) && Array.isArray(b.fabrics) && isFabric(b.fabrics[0]) ? b.fabrics[0] : 'b0'],
    };
  }
  const parts = partsOf(b.pattern),
    given = Array.isArray(b.fabrics) ? b.fabrics : [];
  const fabrics = parts.map((p, k) => {
    if (isFabric(given[k])) return given[k];
    note('fabric');
    return ROLE_DEFAULT[p.role] || 'b0';
  });
  if (given.length > parts.length) note('block');
  /** @type {Block} */
  const out = { ...b, fabrics, rot: num(b.rot) ? ((Math.round(b.rot) % 4) + 4) % 4 : 0 };
  if (b.rot !== out.rot && b.rot !== undefined) note('block');
  delete out.under; // worked out again from the spans
  if ('flip' in b && typeof b.flip !== 'boolean') {
    delete out.flip;
    note('block');
  }
  if ('span' in b && !(num(b.span) && b.span === clamp(Math.round(b.span), LIMITS.span))) {
    delete out.span;
    note('block');
  }
  if ('fussy' in b) {
    /** @type {Record<number, [number, number]>} */
    const ok = {};
    if (isObj(b.fussy))
      for (const [k, uv] of Object.entries(b.fussy))
        if (+k >= 0 && +k < parts.length && Array.isArray(uv) && uv.length === 2 && uv.every(num)) ok[k] = uv;
    if (Object.keys(ok).length) out.fussy = ok;
    else delete out.fussy;
    if (!isObj(b.fussy) || Object.keys(ok).length !== Object.keys(b.fussy).length) note('block');
  }
  return out;
}

/**
 * Opens a saved design: parses it, upgrades it to the current version and checks it.
 * - `design`: ready to use (a copy; the input is never changed)
 * - `problems`: what had to be repaired, in words for the user (empty when nothing was wrong)
 * - `newer`: saved by a newer version of the app: show it, but do not save over it
 * Returns null when the data is not a quilt at all.
 * @param {string | object | null | undefined} raw JSON text or a parsed design
 * @returns {{ design: Design, problems: string[], from: number, newer: boolean } | null}
 */
function readDesign(raw) {
  let d = raw;
  if (typeof raw === 'string') {
    try {
      d = JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (!isObj(d)) return null;
  const from = num(d.v) ? d.v : 0;
  const newer = from > FORMAT_VERSION;
  if (!newer) for (let v = from; v < FORMAT_VERSION; v++) d = MIGRATIONS[v](d);
  const r = check(d);
  if (!r) return null;
  if (newer) r.design.v = from; // keep its own version, so it is not mistaken for ours
  return { ...r, from, newer };
}

/** readDesign, or the default design when the data cannot be opened. @param {string | object | null | undefined} raw */
function readDesignOrDefault(raw) {
  return readDesign(raw) || { design: defaultDesign(), problems: [], from: FORMAT_VERSION, newer: false };
}

export { FORMAT_VERSION, MIGRATIONS, check as checkDesign, readDesign, readDesignOrDefault };
