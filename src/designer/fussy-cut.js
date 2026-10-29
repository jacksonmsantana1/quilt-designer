// Fussy cut: choosing which part of a print shows in a piece.
import './canvas.js'; // load order: runs after designer/canvas
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { orientPoly, partsOf } from '../core/patterns.js';
import { fabricById } from './fabric-library.js';
import { saveDesign } from './design-state.js';
import { blockSizeMm, pathPoly, pathPolyInto, polyCentre, spanOf } from '../core/geometry.js';
import { drawDesignerCanvas } from './canvas.js';
import { drawPartsEditor } from './parts-editor.js';
import { eachSelected } from './side-panel.js';
import { symApply } from './symmetry.js';

// ---- fussy cut: with one part selected in a printed fabric, click the print to choose what shows in that part
function drawFussy() {
  const box = $('dz-fussy');
  if (!box || !shared.design) return;
  const b = shared.design.blocks[shared.focusBlock],
    pi = shared.selParts.size === 1 ? [...shared.selParts][0] : -1,
    fab = pi >= 0 ? fabricById(b.fabrics[pi]) : null;
  box.hidden = !(fab && fab.print);
  if (box.hidden) return;
  const cv = $('dz-fussy-cv'),
    S = 170,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = S * dpr;
  cv.height = S * dpr;
  cv.style.width = S + 'px';
  cv.style.height = S + 'px';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(fab.canvas, 0, 0, S, S); // one repeat of the print
  const f = b.fussy && b.fussy[pi];
  $('dz-fussy-st').textContent = f
    ? 'Fussy cut: the outline shows the part of the print that will be in this piece. Click or drag to move it.'
    : 'Click the print to choose which part of it shows in this piece (a fussy cut).';
  $('dz-fussy-clear').hidden = !f;
  if (!f) return;
  // the piece at its real size on this repeat (the repeat is fab.cm wide)
  const size = blockSizeMm(shared.design, spanOf(b)) / 10,
    k = S / fab.cm;
  const poly = orientPoly(partsOf(b.pattern)[pi].poly, b).map(([u, v]) => [u * size * k, v * size * k]),
    [cx, cy] = polyCentre(poly);
  const offs = [
    [0, 0],
    [-S, 0],
    [S, 0],
    [0, -S],
    [0, S],
  ].map(([dx, dy]) => poly.map(([x, y]) => [x + f[0] * S - cx + dx, y + f[1] * S - cy + dy]));
  g.save();
  g.beginPath();
  g.rect(0, 0, S, S);
  for (const p of offs) pathPolyInto(g, p);
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.fill('evenodd');
  for (const p of offs) {
    pathPoly(g, p);
    g.lineWidth = 2;
    g.strokeStyle = '#e0592a';
    g.stroke();
  }
  g.restore();
}
function setFussy(u, v) {
  const pi = [...shared.selParts][0];
  eachSelected(b => {
    if (b.pattern === shared.design.blocks[shared.focusBlock].pattern) {
      b.fussy = b.fussy || {};
      if (u == null) delete b.fussy[pi];
      else b.fussy[pi] = [u, v];
      if (!Object.keys(b.fussy).length) delete b.fussy;
    }
  });
  symApply([...shared.selBlocks]);
  saveDesign();
  drawDesignerCanvas();
  drawPartsEditor();
}
{
  const cv = $('dz-fussy-cv');
  let drag = false;
  const at = e => {
    const r = cv.getBoundingClientRect();
    setFussy(
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    );
  };
  cv.addEventListener('pointerdown', e => {
    drag = true;
    cv.setPointerCapture(e.pointerId);
    at(e);
  });
  cv.addEventListener('pointermove', e => {
    if (drag) at(e);
  });
  cv.addEventListener('pointerup', () => {
    drag = false;
  });
  $('dz-fussy-clear').addEventListener('click', () => setFussy(null));
}

export { drawFussy };
