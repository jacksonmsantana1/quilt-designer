// Edits to the selected blocks: fabric and pattern.
import './side-panel.js'; // load order: runs after designer/side-panel
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { drawFabricPalette } from './parts-editor.js';
import { openBlockEditor } from './side-panel.js';
import { dispatch } from './dispatch.js';
import { setPartFabric, setPattern } from '../core/edits.js';
import { rolesOf } from '../core/design.js';

function applyFabric(fid) {
  shared.activeFabric = fid;
  if (!shared.selParts.size) {
    drawFabricPalette();
    openBlockEditor();
    $('dz-parts-info').textContent = 'Select one or more parts first, then pick a fabric.';
    return;
  }
  const focus = shared.design.blocks[shared.focusBlock];
  if (!dispatch(setPartFabric, shared.selBlocks, focus.pattern, shared.selParts, fid)) drawFabricPalette();
}
function choosePattern(key) {
  // carry the focused block's colours over to the new pattern, role by role
  shared.selParts.clear();
  dispatch(setPattern, shared.selBlocks, key, rolesOf(shared.design.blocks[shared.focusBlock]));
}

export { applyFabric, choosePattern };
