// Pop-up to change the fabric of one part.
import './hover.js'; // load order: runs after designer/hover
import { design, selParts, setActiveFabric } from '../core/store.js';
import { setCamTarget } from './ui-state.js';
import { $ } from '../core/dom.js';
import { blockPolys, pathPoly, pathPolyInto } from '../core/geometry.js';
import { drawDesignerCanvas } from './canvas.js';
import { drawFabricPalette, drawPaletteInto } from './parts-editor.js';
import { openCamera } from '../camera/fabric-camera.js';
import { initHover } from './hover.js';
import { pieceFill } from '../render/fabric-fill.js';
import { dispatch } from './dispatch.js';
import { setPartFabric as setPartFabricEdit } from '../core/edits.js';

// ---- the fabric-only pop-up for one part
const partEdit = { bi: -1, part: -1, twins: [] };
function drawPartDialog() {
  const b = design.blocks[partEdit.bi];
  if (!b) return;
  drawPaletteInto($('dz-partfabs'), b.fabrics[partEdit.part]);
  const cv = $('dz-partdlg-cv'),
    dpr = Math.min(window.devicePixelRatio || 1, 2),
    S = 160;
  cv.width = cv.height = S * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const polys = blockPolys(b, 0, 0, S, S),
    pxPerCm = S / (design.blockMm / 10);
  polys.forEach((p, i) => {
    g.fillStyle = pieceFill(g, b, i, p, pxPerCm, partEdit.bi * 31 + i);
    pathPoly(g, p);
    g.fill();
  });
  g.save();
  g.beginPath();
  g.rect(0, 0, S, S);
  pathPolyInto(g, polys[partEdit.part]);
  g.fillStyle = 'rgba(20,24,34,.35)';
  g.fill('evenodd');
  g.restore();
  pathPoly(g, polys[partEdit.part]);
  g.lineWidth = 3;
  g.strokeStyle = '#fff';
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = '#e0592a';
  g.stroke();
}
function setPartFabric(fid) {
  const targets = [partEdit.bi, ...($('dz-partall').checked ? partEdit.twins : [])];
  setActiveFabric(fid);
  dispatch(setPartFabricEdit, targets, design.blocks[partEdit.bi].pattern, [partEdit.part], fid);
  drawPartDialog();
  drawFabricPalette();
}
function initPartDialog() {
  $('dz-partfabs').addEventListener('click', e => {
    const b = e.target.closest('button.fab');
    if (b) setPartFabric(b.dataset.f);
  });
  const close = () => $('dz-partdlg').close();
  $('dz-partdlg-x').addEventListener('click', close);
  $('dz-partdone').addEventListener('click', close);
  $('dz-partdlg').addEventListener('close', () => {
    selParts.clear();
    drawDesignerCanvas();
  });
  $('dz-partcam').addEventListener('click', () => {
    setCamTarget(id => setPartFabric(id));
    openCamera();
  });
}
initHover();
initPartDialog();
