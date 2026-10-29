// The distinct blocks in the quilt, to copy from.
import './parts-editor.js'; // load order: runs after designer/parts-editor
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { PATTERNS } from '../core/patterns.js';
import { saveDesign } from './design-state.js';
import { blockPolys, pathPoly } from '../core/geometry.js';
import { drawPartsEditor, renderDesigner } from './parts-editor.js';
import { eachSelected } from './side-panel.js';
import { symApply } from './symmetry.js';
import { pieceFill } from '../render/fabric-fill.js';

// ---- library of the distinct blocks in the quilt (pop-up)
// Two blocks count as the same when they look the same: same fabric on the same piece positions,
// whatever pattern rotation produced them (a symmetric block turned 90° is still the same block).
const bkCache = new Map();
const blockKey = b => {
  const raw =
    b.pattern +
    '|' +
    b.rot +
    (b.flip ? 'f' : '') +
    '|' +
    b.fabrics.join(',') +
    (b.fussy ? '|' + JSON.stringify(b.fussy) : '');
  let k = bkCache.get(raw);
  if (!k) {
    k = blockPolys(b, 0, 0, 1, 1)
      .map(
        (p, i) =>
          b.fabrics[i] +
          ':' +
          p
            .map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`)
            .sort()
            .join(';'),
      )
      .sort()
      .join('|');
    if (bkCache.size > 5000) bkCache.clear();
    bkCache.set(raw, k);
  }
  return k;
};
function drawBlockLibrary() {
  const box = $('dz-library');
  if (!box || !shared.design) return;
  const seen = new Map();
  shared.design.blocks.forEach((b, i) => {
    if (b.under != null) return;
    const k = blockKey(b);
    if (!seen.has(k)) seen.set(k, { b, i, n: 0 });
    seen.get(k).n++;
  });
  const cur = blockKey(shared.design.blocks[shared.focusBlock]);
  box.innerHTML = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 2),
    S = 68,
    realCm = shared.design.blockMm / 10;
  for (const [k, { b, i, n }] of seen) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'blib-item';
    btn.dataset.src = i;
    btn.setAttribute('aria-pressed', String(k === cur));
    btn.title = `${PATTERNS[b.pattern].label} · used ${n}×`;
    const c = document.createElement('canvas');
    c.width = c.height = S * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    blockPolys(b, 0, 0, S, S).forEach((poly, pi) => {
      g.fillStyle = pieceFill(g, b, pi, poly, S / realCm, i * 31 + pi);
      pathPoly(g, poly);
      g.fill();
    });
    g.lineWidth = 0.75;
    g.strokeStyle = 'rgba(255,255,255,.7)';
    blockPolys(b, 0, 0, S, S).forEach(poly => {
      pathPoly(g, poly);
      g.stroke();
    });
    const s = document.createElement('span');
    s.textContent = `${PATTERNS[b.pattern].label} ×${n}`;
    btn.append(c, s);
    box.appendChild(btn);
  }
}
function copyBlockFrom(srcIndex) {
  const src = JSON.parse(JSON.stringify(shared.design.blocks[srcIndex]));
  eachSelected((b, bi) => {
    const k = b.span;
    shared.design.blocks[bi] = JSON.parse(JSON.stringify(src));
    if (k > 1) shared.design.blocks[bi].span = k;
    else delete shared.design.blocks[bi].span;
  });
  symApply([...shared.selBlocks]);
  shared.selParts.clear();
  saveDesign();
  renderDesigner();
}
shared.partTap = null;
function selectSameFabric(pi) {
  const b = shared.design.blocks[shared.focusBlock],
    ref = b.fabrics[pi];
  shared.selParts = new Set(b.fabrics.map((f, i) => (f === ref ? i : -1)).filter(i => i >= 0));
  drawPartsEditor();
}

export { blockKey, copyBlockFrom, drawBlockLibrary, selectSameFabric };
