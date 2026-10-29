// The side panel and its round buttons.
import './block-library.js'; // load order: runs after designer/block-library
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { drawDesignerCanvas } from './canvas.js';
import { drawFabricPalette, drawPartsEditor } from './parts-editor.js';
import { setFold, syncPartsTitle } from '../ui/folds.js';
import { clearHover } from './hover.js';

// The block editor lives in the pop-up while the design tools are hidden. When the tools are
// shown it moves into the side panel instead, and clicking a block just edits it there.
let editorInSide = false;
shared.toolsSnap = null;
shared.showTools = () => {};
shared.showToolsPanel = () => {};
shared.hideTools = () => {};
shared.toolsPanel = null;
const PANEL_CARDS = { parts: 'dz-sideparts', sash: 'sash-card', brd: 'brd-card' };
function syncRail() {
  for (const n of Object.keys(PANEL_CARDS)) {
    const b = $('rail-' + n);
    if (b) b.setAttribute('aria-pressed', String(!$('dz-side').hidden && shared.toolsPanel === n));
  }
}
function placeBlockEditor(side) {
  editorInSide = side;
  const dlg = $('dz-dialog'),
    card = $('dz-sideparts');
  if (side) {
    if (dlg.open) dlg.close();
    card.append($('dz-partsbox'), $('dz-fabbox'), $('dz-libbox'), $('dz-patbox')); // fabrics right under the block, pattern choice last
    if (typeof syncPartsTitle === 'function') syncPartsTitle();
  } else {
    dlg.insertBefore($('dz-libbox'), dlg.querySelector('.dlg-foot'));
    dlg.insertBefore($('dz-fabbox'), $('dz-libbox'));
    dlg.insertBefore($('dz-partsbox'), $('dz-fabbox'));
    if (typeof syncPartsTitle === 'function') syncPartsTitle();
  }
}
function openBlockEditor() {
  const dlg = $('dz-dialog');
  drawPartsEditor();
  drawFabricPalette();
  shared.showTools(); // a block always opens in the side panel's Block parts (there is no block pop-up any more)
  if (editorInSide) {
    if ($('dz-sideparts').classList.contains('folded')) setFold($('dz-sideparts'), 'dz:block parts', false);
    // on narrow screens the side panel sits below the quilt: bring the editor into view
    const card = $('dz-sideparts'),
      r = card.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  clearHover();
  if (!dlg.open) {
    try {
      dlg.showModal();
    } catch (e) {
      dlg.setAttribute('open', '');
    }
  }
  drawDesignerCanvas();
}
function updateMultiUI() {} // (the "Select several" mode was removed; kept as a no-op for callers)
function eachSelected(fn) {
  for (const bi of shared.selBlocks) if (shared.design.blocks[bi].under == null) fn(shared.design.blocks[bi], bi);
}

export { PANEL_CARDS, eachSelected, editorInSide, openBlockEditor, placeBlockEditor, syncRail, updateMultiUI };
