// Symmetry maths (pure): mirror partners of a block and how their orientation changes.
// @ts-check
/** @typedef {import('./types.js').Design} Design @typedef {import('./types.js').Orientation} Orientation */
import { spanOf } from './geometry.js';

// ---- symmetry: an edit to a block is copied to its mirror partners, mirrored to match
// sym: 'off' | 'lr' (left-right) | 'tb' (top-bottom) | 'both' (4-way) | 'kal' (8-way, square layouts only)
const SYMS = {
  off: 'Off',
  lr: 'Mirror left–right',
  tb: 'Mirror top–bottom',
  both: 'Mirror both ways (4-way)',
  kal: 'Kaleidoscope (8-way)',
};
/** The symmetry in force (kaleidoscope falls back to 4-way on a non-square layout). @param {Design} d @returns {import('./types.js').SymmetryMode} */
const symOf = d => {
  const s = d ? d.sym : undefined;
  return s === 'kal' && d.cols !== d.rows ? 'both' : SYMS[s] ? s : 'off';
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
  const C = d.cols,
    Rr = d.rows,
    c = bi % C,
    r = Math.floor(bi / C),
    out = [],
    k = spanOf(d.blocks[bi]);
  const add = (cc, rr, f) => {
    const j = rr * C + cc;
    if (j !== bi && !out.some(x => x[0] === j)) out.push([j, f]);
  };
  const id = o => o,
    comp = (f, g) => o => f(g(o));
  const base = [[c, r, id]];
  if (s === 'lr' || s === 'both' || s === 'kal') base.push([C - k - c, r, oLR]);
  if (s === 'tb' || s === 'both' || s === 'kal') base.push([c, Rr - k - r, oTB]);
  if (s === 'both' || s === 'kal') base.push([C - k - c, Rr - k - r, comp(oLR, oTB)]);
  for (const [cc, rr, f] of base) {
    add(cc, rr, f);
    if (s === 'kal') add(rr, cc, comp(oDiag, f));
  }
  return out;
}

export { SYMS, oDiag, oLR, oTB, symOf, symPartners };
