// Symmetry: copying an edit to the mirror partners of a block.
import './side-panel.js';          // load order: runs after designer/side-panel
import { shared } from '../core/shared.js';
import { normalizeSpans, setSpan, spanOf } from '../core/geometry.js';

// ---- symmetry: an edit to a block is copied to its mirror partners, mirrored to match
// sym: 'off' | 'lr' (left-right) | 'tb' (top-bottom) | 'both' (4-way) | 'kal' (8-way, square layouts only)
const SYMS = { off: 'Off', lr: 'Mirror left–right', tb: 'Mirror top–bottom', both: 'Mirror both ways (4-way)', kal: 'Kaleidoscope (8-way)' };
const symOf = d => { const s = d && d.sym; return s === 'kal' && d.cols !== d.rows ? 'both' : (SYMS[s] ? s : 'off'); };
// orientation algebra: M = F^flip ∘ R^rot, R = quarter turn, F = left-right mirror
const oLR = o => ({ rot: o.rot, flip: !o.flip });
const oTB = o => ({ rot: (o.rot + 2) % 4, flip: !o.flip });
const oDiag = o => o.flip ? { rot: (o.rot + 3) % 4, flip: false } : { rot: (o.rot + 1) % 4, flip: true };   // transpose (main diagonal)
// partners of block bi: [[index, orientation transform], ...]
function symPartners(bi, d = shared.design) {
  const s = symOf(d); if (s === 'off') return [];
  const C = d.cols, Rr = d.rows, c = bi % C, r = Math.floor(bi / C), out = [], k = spanOf(d.blocks[bi]);
  const add = (cc, rr, f) => { const j = rr * C + cc; if (j !== bi && !out.some(x => x[0] === j)) out.push([j, f]); };
  const id = o => o, comp = (f, g) => o => f(g(o));
  const base = [[c, r, id]];
  if (s === 'lr' || s === 'both' || s === 'kal') base.push([C - k - c, r, oLR]);
  if (s === 'tb' || s === 'both' || s === 'kal') base.push([c, Rr - k - r, oTB]);
  if (s === 'both' || s === 'kal') base.push([C - k - c, Rr - k - r, comp(oLR, oTB)]);
  for (const [cc, rr, f] of base) { add(cc, rr, f); if (s === 'kal') add(rr, cc, comp(oDiag, f)); }
  return out;
}
function symApply(sources) {
  if (symOf(shared.design) === 'off') return;
  const done = new Set();
  for (const bi of sources) {
    if (done.has(bi)) continue;
    const src = shared.design.blocks[bi]; if (src.under != null) continue;
    const o = { rot: src.rot || 0, flip: !!src.flip };
    for (const [j, f] of symPartners(bi)) {
      if (sources.includes(j) && j !== bi && done.has(j)) continue;
      const t = f(o), nb = JSON.parse(JSON.stringify(src)); nb.rot = t.rot; if (t.flip) nb.flip = true; else delete nb.flip;
      if (spanOf(src) > 1) { shared.design.blocks[j] = nb; setSpan(shared.design, j, spanOf(src)); } else { delete nb.span; shared.design.blocks[j] = nb; }
      done.add(j);
    }
    done.add(bi);
  }
  normalizeSpans(shared.design);
}

export { symApply, symOf };
