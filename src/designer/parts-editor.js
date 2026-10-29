// Block parts panel: the enlarged block, its parts, patterns and fabrics.
import './fussy-cut.js'; // load order: runs after designer/fussy-cut
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { fabricById, fabricLib } from './fabric-library.js';
import { blockPolys, normalizeSpans, pathPoly } from '../core/geometry.js';
import { BLOCK_PX, drawDesignerCanvas } from './canvas.js';
import { drawFussy } from './fussy-cut.js';
import { drawBlockLibrary } from './block-library.js';
import { renderFitSuggestions } from '../sim/bed.js';
import { renderSashUI } from './sashing-ui.js';
import { renderBorderUI } from './borders-ui.js';
import { syncSymUI } from './settings.js';
import { tlEnsure } from '../timeline/timeline.js';
import { updatePatPicker } from './pattern-picker.js';
import { pieceFill } from '../render/fabric-fill.js';

function drawPartsEditor() {
  if (!shared.design) return;
  drawBlockLibrary();
  const cv = $('dz-block'),
    css = BLOCK_PX,
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = css * dpr;
  cv.style.width = css + 'px';
  cv.style.height = 'auto';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, css, css);
  const b = shared.design.blocks[shared.focusBlock],
    polys = blockPolys(b, 0, 0, css, css);
  const realCm = shared.design.blockMm / 10,
    pxPerCm = css / realCm;
  polys.forEach((poly, pi) => {
    g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, shared.focusBlock * 31 + pi);
    pathPoly(g, poly);
    g.fill();
  });
  polys.forEach((poly, pi) => {
    pathPoly(g, poly);
    if (shared.selParts.has(pi)) {
      g.fillStyle = 'rgba(224,89,42,.28)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.lineWidth = 1.5;
      g.strokeStyle = '#e0592a';
      g.stroke();
    } else {
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(20,20,20,.45)';
      g.stroke();
    }
  });
  const names = [...shared.selParts].map(i => partsOf(b.pattern)[i].name);
  $('dz-parts-info').textContent =
    shared.selParts.size === 0
      ? 'Click a part to select it, or double-click to select every part in the same fabric. Then pick a fabric.'
      : shared.selParts.size === 1
        ? `Selected: ${names[0]} · ${fabricById(b.fabrics[[...shared.selParts][0]]).name}${b.fussy && b.fussy[[...shared.selParts][0]] ? ' · fussy cut' : ''}`
        : `${shared.selParts.size} parts selected`;
  drawFussy();
  $('dz-blockname').textContent =
    `${PATTERNS[b.pattern].label} · block ${Math.floor(shared.focusBlock / shared.design.cols) + 1}, ${(shared.focusBlock % shared.design.cols) + 1}` +
    (shared.selBlocks.size > 1 ? ` · editing ${shared.selBlocks.size} blocks` : '');
}
function drawPatternButtons() {
  if (!shared.design) return;
  const box = $('dz-patterns');
  if (!box.childElementCount) {
    for (const [key, p] of Object.entries(PATTERNS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pat';
      b.dataset.p = key;
      b.title = p.label;
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d');
      const cols = ['#efe5cf', '#2f466f', '#c79a45'];
      partsOf(key).forEach(part => {
        g.fillStyle = cols[part.role];
        pathPoly(
          g,
          part.poly.map(([u, v]) => [u * 96, v * 96]),
        );
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.25)';
        g.stroke();
      });
      const s = document.createElement('span');
      s.textContent = p.label;
      b.append(c, s);
      box.appendChild(b);
    }
  }
  const cur = shared.design.blocks[shared.focusBlock].pattern;
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.p === cur));
}
function drawFabricPalette() {
  for (const id of ['dz-fabrics', 'dz-fabrics2']) if ($(id)) drawPaletteInto($(id));
  if (shared.design) drawPaletteInto($('dz-backfabs'), shared.design.backFabric);
}
function drawPaletteInto(box, selected = shared.activeFabric) {
  box.innerHTML = '';
  for (const f of fabricLib) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fab';
    b.dataset.f = f.id;
    b.title = f.name;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const k = Math.min(f.canvas.width, f.canvas.height, 360);
    c.getContext('2d').drawImage(f.canvas, 0, 0, k, k, 0, 0, 64, 64);
    const s = document.createElement('span');
    s.textContent = f.name;
    b.append(c, s);
    b.setAttribute('aria-pressed', String(f.id === selected));
    box.appendChild(b);
  }
}
function renderDesigner() {
  if (!shared.design) return;
  shared.design = normalizeSpans(shared.design);
  if (shared.design.blocks[shared.focusBlock] && shared.design.blocks[shared.focusBlock].under != null)
    shared.focusBlock = shared.design.blocks[shared.focusBlock].under;
  $('dz-cols').value = shared.design.cols;
  $('dz-rows').value = shared.design.rows;
  syncSymUI();
  for (const id of ['dz-bmm3']) if (document.activeElement !== $(id)) $(id).value = shared.design.blockMm;
  $('dz-rot').textContent = `Rotate 90° (${shared.design.blocks[shared.focusBlock].rot * 90}°)`;
  $('dz-rot2').textContent = `Rotate 90° · now ${shared.design.blocks[shared.focusBlock].rot * 90}°`;
  const ps = $('dz-patsel');
  if (!ps.options.length) for (const [k, p] of Object.entries(PATTERNS)) ps.add(new Option(p.label, k));
  ps.value = shared.design.blocks[shared.focusBlock].pattern;
  updatePatPicker();
  drawDesignerCanvas();
  drawPartsEditor();
  drawPatternButtons();
  renderFitSuggestions();
  tlEnsure();
  if (typeof renderSashUI === 'function') renderSashUI();
  if (typeof renderBorderUI === 'function') renderBorderUI();
}

export { drawFabricPalette, drawPaletteInto, drawPartsEditor, renderDesigner };
