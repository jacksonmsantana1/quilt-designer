// Block parts panel: the enlarged block, its parts, patterns and fabrics.
import './fussy-cut.js'; // load order: runs after designer/fussy-cut
import { activeFabric, design, focusBlock, selBlocks, selParts, setFocusBlock } from '../core/store.js';
import { $, themeColour } from '../core/dom.js';
import { inputRange, toInput } from '../core/units.js';
import { PATTERNS, partsOf } from '@quilt/shared/patterns.js';
import { fabricById } from './fabric-library.js';
import { drawShortList } from './fabric-picker.js';
import { drawPatternList } from './block-picker.js';
import { blockPolys, cellName, isOnPoint, pathPoly } from '@quilt/shared/geometry.js';
import { BLOCK_PX, drawDesignerCanvas } from './canvas.js';
import { drawFussy } from './fussy-cut.js';
import { drawBlockLibrary } from './block-library.js';
import { renderFitSuggestions } from '../sim/bed.js';
import { renderSashUI } from './sashing-ui.js';
import { renderBorderUI } from './borders-ui.js';
import { syncSymUI } from './settings.js';
import { tlEnsure } from '../timeline/timeline.js';
import { pieceFill } from '../render/fabric-fill.js';
import { mosaicBrush } from './ui-state.js';

function drawPartsEditor() {
  if (!design) return;
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
  const b = design.blocks[focusBlock],
    polys = blockPolys(b, 0, 0, css, css);
  const realCm = design.blockMm / 10,
    pxPerCm = css / realCm;
  polys.forEach((poly, pi) => {
    g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, focusBlock * 31 + pi);
    pathPoly(g, poly);
    g.fill();
  });
  polys.forEach((poly, pi) => {
    pathPoly(g, poly);
    if (selParts.has(pi)) {
      g.fillStyle = 'rgba(214,98,52,.28)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.lineWidth = 1.5;
      g.strokeStyle = themeColour('--mark', '#d2602f');
      g.stroke();
    } else {
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(20,20,20,.45)';
      g.stroke();
    }
  });
  const names = [...selParts].map(i => partsOf(b.pattern)[i].name);
  $('dz-parts-info').textContent =
    selParts.size === 0
      ? 'Click a part to select it, or double-click to select every part in the same fabric. Then pick a fabric.'
      : selParts.size === 1
        ? `Selected: ${names[0]} · ${fabricById(b.fabrics[[...selParts][0]]).name}${b.fussy && b.fussy[[...selParts][0]] ? ' · fussy cut' : ''}`
        : `${selParts.size} parts selected`;
  drawFussy();
  $('dz-blockname').textContent =
    `${PATTERNS[b.pattern].label} · block ${cellName(design, focusBlock)}` +
    (selBlocks.size > 1 ? ` · editing ${selBlocks.size} blocks` : '');
}
/** The list under "Block pattern" (designer/block-picker.js). */
function drawPatternButtons() {
  drawPatternList();
}
function drawFabricPalette() {
  for (const id of ['dz-fabrics', 'dz-fabrics2']) if ($(id)) drawPaletteInto($(id));
  if (design) {
    drawPaletteInto($('dz-backfabs'), design.backFabric);
    if ($('set-fabs')) drawPaletteInto($('set-fabs'), design.settingFabric || 'b0');
  }
}
/** A fabric choice: its short list (designer/fabric-picker.js) with the chosen fabric pressed. */
function drawPaletteInto(box, selected = activeFabric) {
  drawShortList(box, selected);
}
function renderDesigner() {
  if (!design) return;
  if (design.blocks[focusBlock] && design.blocks[focusBlock].under != null)
    setFocusBlock(design.blocks[focusBlock].under);
  // a mosaic: the steppers count its shapes across and down (up to 60)
  const grid = design.mosaic || design;
  $('dz-cols').value = grid.cols;
  $('dz-rows').value = grid.rows;
  $('dz-cols').max = $('dz-rows').max = design.mosaic ? '60' : '20';
  // layout: on point, the setting triangles have a fabric (symmetry and large blocks wait, see syncSymUI)
  $('dz-setting').value = design.mosaic ? 'mosaic' : isOnPoint(design) ? 'onpoint' : 'straight';
  // the block tools would change the blocks under a mosaic, which don't show: they wait until it's blocks again
  for (const id of ['rail-parts', 'rail-sash', 'sym-wrap']) if ($(id)) $(id).hidden = !!design.mosaic;
  if (design.mosaic) {
    Object.assign($('mos-mm'), inputRange(10, 200));
    if (document.activeElement !== $('mos-mm')) $('mos-mm').value = String(toInput(design.mosaic.mm));
    $('mos-shape').value = design.mosaic.shape;
    // Same way: for diamonds and triangles (all hexagons lie the same way)
    $('mos-tools').querySelector('[data-tool="way"]').hidden = design.mosaic.shape === 'hex';
    drawPaletteInto($('mos-fabs'), mosaicBrush);
  }
  drawPaletteInto($('set-fabs'), design.settingFabric || 'b0');
  syncSymUI();
  Object.assign($('dz-bmm3'), inputRange(50, 1000));
  for (const id of ['dz-bmm3']) if (document.activeElement !== $(id)) $(id).value = String(toInput(design.blockMm));
  $('dz-rot').textContent = `Rotate 90° (${design.blocks[focusBlock].rot * 90}°)`;
  drawDesignerCanvas();
  drawPartsEditor();
  drawPatternButtons();
  renderFitSuggestions();
  tlEnsure();
  if (typeof renderSashUI === 'function') renderSashUI();
  if (typeof renderBorderUI === 'function') renderBorderUI();
}

export { drawFabricPalette, drawPaletteInto, drawPartsEditor, renderDesigner };
