// Symmetry maths (pure): mirror partners of a block and how their orientation changes.
// @ts-check
/** @typedef {import('@quilt/shared/types.js').Design} Design @typedef {import('@quilt/shared/types.js').Orientation} Orientation */
import { normalizeSpans, setSpan, spanOf } from '@quilt/shared/geometry.js';

// ---- symmetry: an edit to a block is copied to its mirror partners, mirrored to match
// sym: 'off' | 'lr' (left-right) | 'tb' (top-bottom) | 'both' (4-way) | 'kal' (8-way, square layouts only)
const SYMS = {
  off: 'Off',
  lr: 'Mirror left–right',
  tb: 'Mirror top–bottom',
  both: 'Mirror both ways (4-way)',
  kal: 'Kaleidoscope (8-way)',
};
/** The symmetry in force (kaleidoscope falls back to 4-way on a non-square layout). @param {Design} d @returns {import('@quilt/shared/types.js').SymmetryMode} */
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
    C = d.cols,
    R = d.rows,
    src = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const inL = c < Math.ceil(C / 2),
        inT = r < Math.ceil(R / 2);
      if (s === 'lr' ? inL : s === 'tb' ? inT : s === 'both' ? inL && inT : s === 'kal' ? inL && inT && c >= r : false)
        src.push(r * C + c);
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
