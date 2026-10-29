// Symmetry: copying an edit to the mirror partners of a block.
import './side-panel.js'; // load order: runs after designer/side-panel
import { shared } from '../core/shared.js';
import { normalizeSpans, setSpan, spanOf } from '../core/geometry.js';
import { symOf, symPartners } from '../core/symmetry.js';

function symApply(sources) {
  if (symOf(shared.design) === 'off') return;
  const done = new Set();
  for (const bi of sources) {
    if (done.has(bi)) continue;
    const src = shared.design.blocks[bi];
    if (src.under != null) continue;
    const o = { rot: src.rot || 0, flip: !!src.flip };
    for (const [j, f] of symPartners(bi, shared.design)) {
      if (sources.includes(j) && j !== bi && done.has(j)) continue;
      const t = f(o),
        nb = JSON.parse(JSON.stringify(src));
      nb.rot = t.rot;
      if (t.flip) nb.flip = true;
      else delete nb.flip;
      if (spanOf(src) > 1) {
        shared.design.blocks[j] = nb;
        setSpan(shared.design, j, spanOf(src));
      } else {
        delete nb.span;
        shared.design.blocks[j] = nb;
      }
      done.add(j);
    }
    done.add(bi);
  }
  normalizeSpans(shared.design);
}

export { symApply };
