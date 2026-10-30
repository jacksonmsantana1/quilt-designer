// Symmetry maths (pure): mirror partners of a block and how their orientation changes.
// @ts-check
/** @typedef {import('@quilt/shared/types.js').Design} Design @typedef {import('@quilt/shared/types.js').Orientation} Orientation */
import { cellGrid, isOnPoint, normalizeSpans, setSpan, spanOf } from '@quilt/shared/geometry.js';

// ---- symmetry: an edit to a block is copied to its mirror partners, mirrored to match
// sym: 'off' | 'lr' (left-right) | 'tb' (top-bottom) | 'both' (4-way) | 'kal' (8-way, square layouts only)
const SYMS = {
  off: 'Off',
  lr: 'Mirror left–right',
  tb: 'Mirror top–bottom',
  both: 'Mirror both ways (4-way)',
  kal: 'Kaleidoscope (8-way)',
};
/**
 * The symmetry in force (kaleidoscope falls back to 4-way on a non-square layout; on point, a quilt that isn't
 * square has no mirror lines through its blocks, so its symmetry waits until it is square again).
 * @param {Design} d @returns {import('@quilt/shared/types.js').SymmetryMode}
 */
const symOf = d => {
  const s = d ? d.sym : undefined;
  if (!SYMS[s] || (isOnPoint(d) && d.cols !== d.rows)) return 'off';
  return s === 'kal' && d.cols !== d.rows ? 'both' : s;
};
// orientation algebra: M = F^flip ∘ R^rot, R = quarter turn, F = left-right mirror
/** @param {Orientation} o @returns {Orientation} */
const oLR = o => ({ rot: o.rot, flip: !o.flip });
/** @param {Orientation} o @returns {Orientation} */
const oTB = o => ({ rot: (o.rot + 2) % 4, flip: !o.flip });
/** @param {Orientation} o @returns {Orientation} */
const oDiag = o => (o.flip ? { rot: (o.rot + 3) % 4, flip: false } : { rot: (o.rot + 1) % 4, flip: true }); // transpose (main diagonal)
// partners of block bi: [[index, orientation transform], ...]
/** Mirror partners of block bi, each with the orientation change that mirrors it. @param {number} bi @param {Design} d @returns {[number, (o: Orientation) => Orientation][]} */
function symPartners(bi, d) {
  const s = symOf(d);
  if (s === 'off') return [];
  const g = cellGrid(d),
    [c, r] = g.cell(bi),
    C = d.cols,
    out = [],
    k = spanOf(d.blocks[bi]);
  const add = (cc, rr, f) => {
    const j = g.at(cc, rr);
    if (j >= 0 && j !== bi && !out.some(x => x[0] === j)) out.push([j, f]);
  };
  const id = o => o,
    comp = (f, g) => o => f(g(o));
  const lr = s === 'lr' || s === 'both' || s === 'kal',
    tb = s === 'tb' || s === 'both' || s === 'kal',
    base = [[c, r, id]];
  /** @type {(b: any[]) => any[]} the 8-way's extra mirror (across a diagonal) of a partner already found */
  let diag;
  if (!isOnPoint(d)) {
    const Rr = d.rows;
    if (lr) base.push([C - k - c, r, oLR]);
    if (tb) base.push([c, Rr - k - r, oTB]);
    if (lr && tb) base.push([C - k - c, Rr - k - r, comp(oLR, oTB)]);
    diag = ([cc, rr, f]) => [rr, cc, comp(oDiag, f)];
  } else {
    // on point the cells are (u, v) of the turned frame: u along a block's top edge (down-right on the screen),
    // v along its left edge (down-left). The screen's up-down line swaps u and v (a transpose of the block), its
    // left-right line swaps and reverses them, and the diagonals reverse just one; a square quilt of C × C has
    // its centre at u = C − ½, v = ½
    if (lr) base.push([r + C - 1, c - C + 1, oDiag]);
    if (tb) base.push([C - k - r, C - k - c, o => oLR(oTB(oDiag(o)))]);
    if (lr && tb) base.push([2 * C - 1 - k - c, 1 - k - r, comp(oLR, oTB)]);
    diag = ([u, v, f]) => [2 * C - 1 - k - u, v, comp(oLR, f)];
  }
  for (const b of base) {
    add(b[0], b[1], b[2]);
    if (s === 'kal') {
      const [x, y, f] = diag(b);
      add(x, y, f);
    }
  }
  return out;
}

/**
 * The design with the given blocks copied to their mirror partners, mirrored to match (pure).
 * Blocks listed later do not overwrite a partner already written from an earlier one.
 * @param {Design} d @param {number[]} sources @returns {Design}
 */
function withSymmetry(d, sources) {
  if (symOf(d) === 'off' || !sources.length) return d;
  let out = { ...d, blocks: d.blocks.slice() };
  const done = new Set();
  for (const bi of sources) {
    if (done.has(bi)) continue;
    const src = out.blocks[bi];
    if (!src || src.under != null) continue;
    const o = { rot: src.rot || 0, flip: !!src.flip };
    for (const [j, f] of symPartners(bi, out)) {
      if (sources.includes(j) && j !== bi && done.has(j)) continue;
      const t = f(o),
        { span: _s, under: _u, flip: _f, ...rest } = JSON.parse(JSON.stringify(src)),
        nb = { ...rest, rot: t.rot, ...(t.flip ? { flip: true } : {}) };
      if (spanOf(src) > 1) {
        out.blocks[j] = nb;
        out = setSpan(out, j, spanOf(src));
        out = { ...out, blocks: out.blocks.slice() };
      } else out.blocks[j] = nb;
      done.add(j);
    }
    done.add(bi);
  }
  return normalizeSpans(out);
}
/** The blocks whose mirror images decide the rest when a symmetry is turned on: the top-left half, quarter or eighth. @param {Design} d @returns {number[]} */
function symmetrySources(d) {
  const s = symOf(d),
    g = cellGrid(d),
    C = d.cols,
    R = d.rows,
    on = isOnPoint(d),
    src = [];
  if (s === 'off') return src;
  for (let i = 0; i < d.blocks.length; i++) {
    // the middle of the block's cell from the quilt's centre, in half-blocks across the screen (left and up negative)
    const [a, b] = g.cell(i),
      x = on ? a - b - (C - 1) : 2 * a - (C - 1),
      y = on ? a + b + 1 - C : 2 * b - (R - 1),
      inL = x <= 0,
      inT = y <= 0;
    if (s === 'lr' ? inL : s === 'tb' ? inT : s === 'both' ? inL && inT : inL && inT && x >= y) src.push(i);
  }
  return src;
}
/** Turns a symmetry on (mirroring the design from its top-left part straight away) or off. @param {Design} d @param {import('@quilt/shared/types.js').SymmetryMode} mode @returns {Design} */
function setSymmetry(d, mode) {
  const { sym: _old, ...rest } = d;
  const next = mode === 'off' ? rest : { ...rest, sym: mode };
  return withSymmetry(next, symmetrySources(next));
}
// it mirrors by itself
setSymmetry.mirror = false;

export { setSymmetry, symmetrySources, withSymmetry, SYMS, oDiag, oLR, oTB, symOf, symPartners };
