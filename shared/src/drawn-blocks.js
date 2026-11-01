// Blocks people draw themselves in the block editor (pure).
// @ts-check
//
// A drawn block is written in the grid notation of grid-blocks.js: an n × n grid, one token per cell. A quilt
// carries the drawings of its own blocks in `design.drawn`, keyed by drawnKey, so sync, sharing and copies take
// them along. The key comes from the drawing alone (not its name): the same drawing is always the same pattern,
// in every quilt and on every device, and a changed drawing is a new pattern (quilts using the old one keep it).
import { PATTERNS, PCACHE } from './patterns.js';
import { gridParts } from './grid-blocks.js';

/** @typedef {import('./types.js').DrawnBlock} DrawnBlock */

/** The family drawn blocks are listed under in the block library. */
const DRAWN_FAMILY = 'My blocks';
const MAX_N = 12; // cells per side
const MAX_DRAWN = 200; // drawings one quilt can carry
const MAX_LABEL = 60;

/** The rows written the one way: one line per row, cells separated by one space. @param {string} rows */
const tidyRows = rows =>
  rows
    .trim()
    .split('\n')
    .map(l => l.trim().split(/\s+/).join(' '))
    .join('\n');

/** 32-bit FNV-1a of a string, from a given start. @param {string} s @param {number} start */
function fnv(s, start) {
  let h = start;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The pattern key of a drawing: "my" + 12 hex digits from the drawing (not its name). @param {{ n: number, rows: string }} def */
function drawnKey(def) {
  const s = `${def.n}|${tidyRows(def.rows)}`;
  const a = fnv(s, 0x811c9dc5),
    b = fnv(s, 0x050c5d1f);
  return 'my' + a.toString(16).padStart(8, '0') + (b >>> 16).toString(16).padStart(4, '0');
}

/**
 * A drawing made safe, or null when it can't be drawn: n × n cells that the grid notation reads and that cover the
 * whole block. @param {any} def @returns {DrawnBlock | null}
 */
function checkDrawn(def) {
  if (!def || typeof def !== 'object' || typeof def.rows !== 'string' || def.rows.length > 4000) return null;
  const n = def.n;
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) return null;
  const rows = tidyRows(def.rows),
    lines = rows.split('\n');
  if (lines.length !== n || lines.some(l => l.split(' ').length !== n)) return null;
  let parts;
  try {
    parts = gridParts({ n, rows });
  } catch (e) {
    return null;
  }
  // every cell belongs to a piece ("x" cells would leave holes)
  const area = parts.reduce((sum, p) => {
    let a = 0;
    p.poly.forEach(([x0, y0], i) => {
      const [x1, y1] = p.poly[(i + 1) % p.poly.length];
      a += x0 * y1 - x1 * y0;
    });
    return sum + Math.abs(a) / 2;
  }, 0);
  if (Math.abs(area - 1) > 1e-6) return null;
  const label = typeof def.label === 'string' && def.label.trim() ? def.label.trim().slice(0, MAX_LABEL) : 'My block';
  return { label, n, rows };
}

/** Makes a drawing a pattern the whole app knows (block library, cutting guide, PDF). @param {string} key @param {DrawnBlock} def */
function registerDrawn(key, def) {
  const known = PATTERNS[key];
  if (known && known.drawn) {
    known.label = def.label; // same drawing: only the name can differ
    known.def = def;
    return;
  }
  if (known) return; // never replace one of the app's own blocks
  delete PCACHE[key];
  PATTERNS[key] = { label: def.label, family: DRAWN_FAMILY, drawn: true, def, parts: () => gridParts(def) };
}

/**
 * A quilt's drawings checked and made known: the good ones (registered as patterns), and how many were left out.
 * A drawing is left out when it can't be drawn or isn't stored under its own key.
 * @param {any} raw @returns {{ drawn: Record<string, DrawnBlock>, lost: number }}
 */
function readDrawn(raw) {
  /** @type {Record<string, DrawnBlock>} */
  const drawn = {};
  let lost = 0;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { drawn, lost: raw === undefined ? 0 : 1 };
  for (const [key, def] of Object.entries(raw)) {
    const ok = Object.keys(drawn).length < MAX_DRAWN ? checkDrawn(def) : null;
    if (!ok || drawnKey(ok) !== key) {
      lost++;
      continue;
    }
    drawn[key] = ok;
    registerDrawn(key, ok);
  }
  return { drawn, lost };
}

export { DRAWN_FAMILY, checkDrawn, drawnKey, readDrawn, registerDrawn, tidyRows };
