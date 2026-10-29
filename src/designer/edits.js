// Edits to the selected blocks: fabric and pattern.
import './side-panel.js'; // load order: runs after designer/side-panel
import { design, focusBlock, selBlocks, selParts, setActiveFabric } from '../core/store.js';
import { $ } from '../core/dom.js';
import { drawFabricPalette } from './parts-editor.js';
import { openBlockEditor } from './side-panel.js';
import { dispatch } from './dispatch.js';
import { setPartFabric, setPattern } from '../core/edits.js';
import { rolesOf } from '../core/design.js';

function applyFabric(fid) {
  setActiveFabric(fid);
  if (!selParts.size) {
    drawFabricPalette();
    openBlockEditor();
    $('dz-parts-info').textContent = 'Select one or more parts first, then pick a fabric.';
    return;
  }
  const focus = design.blocks[focusBlock];
  if (!dispatch(setPartFabric, selBlocks, focus.pattern, selParts, fid)) drawFabricPalette();
}
function choosePattern(key) {
  // carry the focused block's colours over to the new pattern, role by role
  selParts.clear();
  dispatch(setPattern, selBlocks, key, rolesOf(design.blocks[focusBlock]));
}

export { applyFabric, choosePattern };
