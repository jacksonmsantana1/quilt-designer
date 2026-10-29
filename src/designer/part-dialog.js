// Pop-up to change the fabric of one part.
import './hover.js';          // load order: runs after designer/hover
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { saveDesign } from './design-state.js';
import { blockPolys, pathPoly, pathPolyInto, pieceFill } from '../core/geometry.js';
import { drawDesignerCanvas } from './canvas.js';
import { drawFabricPalette, drawPaletteInto } from './parts-editor.js';
import { symApply } from './symmetry.js';
import { openCamera } from '../camera/fabric-camera.js';
import { clearHover, initHover } from './hover.js';

// ---- the fabric-only pop-up for one part
const partEdit = { bi: -1, part: -1, twins: [] };
function openPartFabric(bi, part) {
  partEdit.bi = bi; partEdit.part = part;
  const b = shared.design.blocks[bi], key = b.pattern + '|' + b.fabrics.join(',');
  partEdit.twins = shared.design.blocks.map((x, i) => i !== bi && x.pattern + '|' + x.fabrics.join(',') === key ? i : -1).filter(i => i >= 0);
  shared.selBlocks = new Set([bi]); shared.focusBlock = bi; shared.selParts = new Set([part]);
  $('dz-partdlg-sub').textContent = `${partsOf(b.pattern)[part].name} · ${PATTERNS[b.pattern].label} · block ${Math.floor(bi / shared.design.cols) + 1}, ${bi % shared.design.cols + 1}`;
  $('dz-partall-row').hidden = !partEdit.twins.length; $('dz-partall').checked = false;
  $('dz-partall-txt').textContent = `Also in the ${partEdit.twins.length} other block${partEdit.twins.length === 1 ? '' : 's'} just like this one`;
  drawPartDialog();
  clearHover();
  const d = $('dz-partdlg'); if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  drawDesignerCanvas();
}
function drawPartDialog() {
  const b = shared.design.blocks[partEdit.bi]; if (!b) return;
  drawPaletteInto($('dz-partfabs'), b.fabrics[partEdit.part]);
  const cv = $('dz-partdlg-cv'), dpr = Math.min(window.devicePixelRatio || 1, 2), S = 160;
  cv.width = cv.height = S * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const polys = blockPolys(b, 0, 0, S, S), pxPerCm = S / (shared.design.blockMm / 10);
  polys.forEach((p, i) => { g.fillStyle = pieceFill(g, b, i, p, pxPerCm, partEdit.bi * 31 + i); pathPoly(g, p); g.fill(); });
  g.save(); g.beginPath(); g.rect(0, 0, S, S); pathPolyInto(g, polys[partEdit.part]); g.fillStyle = 'rgba(20,24,34,.35)'; g.fill('evenodd'); g.restore();
  pathPoly(g, polys[partEdit.part]); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.stroke();
}
function setPartFabric(fid) {
  const targets = [partEdit.bi, ...($('dz-partall').checked ? partEdit.twins : [])];
  for (const bi of targets) shared.design.blocks[bi].fabrics[partEdit.part] = fid;
  symApply(targets);
  shared.activeFabric = fid;
  saveDesign(); drawPartDialog(); drawDesignerCanvas(); drawFabricPalette();
}
function initPartDialog() {
  $('dz-partfabs').addEventListener('click', e => { const b = e.target.closest('button.fab'); if (b) setPartFabric(b.dataset.f); });
  const close = () => $('dz-partdlg').close();
  $('dz-partdlg-x').addEventListener('click', close); $('dz-partdone').addEventListener('click', close);
  $('dz-partdlg').addEventListener('close', () => { shared.selParts.clear(); drawDesignerCanvas(); });
  $('dz-partcam').addEventListener('click', () => { shared.camTarget = id => setPartFabric(id); openCamera(); });
}
initHover();
 initPartDialog();
