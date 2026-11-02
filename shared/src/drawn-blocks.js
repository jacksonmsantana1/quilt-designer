// Blocks people draw themselves in the block editor (pure).
// @ts-check
//
// A drawn block is written in the grid notation of grid-blocks.js: an n × n grid, one token per cell. A quilt
// carries the drawings of its own blocks in `design.drawn`, keyed by drawnKey, so sync, sharing and copies take
// them along. The key comes from the drawing alone (not its name): the same drawing is always the same pattern,
// in every quilt and on every device, and a changed drawing is a new pattern (quilts using the old one keep it).
//
// A block drawn on graph paper has every cell "x" and its pieces in `extra` (polygons in cells, found from its seam
// lines by seam-faces.js), and keeps the lines and the fills in `paper` so it can be opened again to change it.
import { PATTERNS, PCACHE } from './patterns.js';
import { gridParts } from './grid-blocks.js';
import { t } from './i18n.js';

/** @typedef {import('./types.js').DrawnBlock} DrawnBlock */

/** The family drawn blocks are listed under in the block library. A code, in English like the others: t(family) to show it. */
const DRAWN_FAMILY = 'My blocks';
const MAX_N = 12; // cells per side
const MAX_DRAWN = 200; // drawings one quilt can carry
const MAX_LABEL = 60;
const MAX_PIECES = 400; // pieces of a graph-paper drawing
const MAX_MARKS = 600; // its lines, and its fills

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

/**
 * The pattern key of a drawing: "my" + 12 hex digits from its pieces (not its name, nor the lines it was drawn with).
 * @param {{ n: number, rows: string, extra?: [string, number, number[]][] }} def
 */
function drawnKey(def) {
  let s = `${def.n}|${tidyRows(def.rows)}`;
  if (def.extra?.length)
    s += '|' + def.extra.map(([, r, f]) => `${r}:${f.map(v => Math.round(v * 1e4)).join(',')}`).join(';');
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
  const num = v => typeof v === 'number' && Number.isFinite(v),
    within = v => num(v) && v >= -1e-9 && v <= n + 1e-9;
  /** @type {[string, number, number[]][] | undefined} */
  let extra;
  if (def.extra !== undefined) {
    if (!Array.isArray(def.extra) || def.extra.length > MAX_PIECES) return null;
    extra = [];
    for (const piece of def.extra) {
      if (!Array.isArray(piece) || piece.length !== 3) return null;
      const [name, role, flat] = piece;
      if (typeof name !== 'string' || name.length > 80 || !Number.isInteger(role) || role < 0 || role > 5) return null;
      if (!Array.isArray(flat) || flat.length < 6 || flat.length > 400 || flat.length % 2 || !flat.every(within))
        return null;
      extra.push([name, role, flat.slice()]);
    }
  }
  let parts;
  try {
    parts = gridParts(extra ? { n, rows, extra } : { n, rows });
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
  const label =
    typeof def.label === 'string' && def.label.trim() ? def.label.trim().slice(0, MAX_LABEL) : t('My block');
  /** @type {DrawnBlock} */
  const out = { label, n, rows };
  if (extra) out.extra = extra;
  // the lines it was drawn with: only for opening it again, so a damaged copy is just left off
  const p = def.paper,
    marks = (a, k) => Array.isArray(a) && a.length <= MAX_MARKS && a.every(m => Array.isArray(m) && m.length === k);
  if (
    extra &&
    p &&
    marks(p.lines, 4) &&
    marks(p.fills, 3) &&
    p.lines.every(l => l.every(within)) &&
    p.fills.every(([x, y, r]) => within(x) && within(y) && Number.isInteger(r) && r >= 0 && r <= 5)
  )
    out.paper = { lines: p.lines.map(l => l.slice()), fills: p.fills.map(m => m.slice()) };
  return out;
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

/** Makes the app forget every drawn block (the server: see server/src/read-quilt.js). */
function forgetDrawn() {
  for (const [key, p] of Object.entries(PATTERNS))
    if (p.drawn) {
      delete PATTERNS[key];
      delete PCACHE[key];
    }
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

export { DRAWN_FAMILY, checkDrawn, drawnKey, forgetDrawn, readDrawn, registerDrawn, tidyRows };
