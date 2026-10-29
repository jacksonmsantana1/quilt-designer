// Edits to the selected blocks: fabric and pattern.
import './symmetry.js'; // load order: runs after designer/symmetry
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { partsOf } from '../core/patterns.js';
import { ROLE_DEFAULT } from './fabric-library.js';
import { newBlock, saveDesign } from './design-state.js';
import { drawDesignerCanvas } from './canvas.js';
import { drawFabricPalette, drawPartsEditor, renderDesigner } from './parts-editor.js';
import { eachSelected, openBlockEditor } from './side-panel.js';
import { symApply } from './symmetry.js';

function applyFabric(fid) {
  shared.activeFabric = fid;
  if (!shared.selParts.size) {
    drawFabricPalette();
    openBlockEditor();
    $('dz-parts-info').textContent = 'Select one or more parts first, then pick a fabric.';
    return;
  }
  const focus = shared.design.blocks[shared.focusBlock];
  eachSelected(b => {
    if (b.pattern === focus.pattern) for (const pi of shared.selParts) b.fabrics[pi] = fid;
  });
  symApply([...shared.selBlocks]);
  saveDesign();
  drawFabricPalette();
  drawDesignerCanvas();
  drawPartsEditor();
}
function setPattern(key) {
  // carry the focused block's colours over to the new pattern, role by role
  const b0 = shared.design.blocks[shared.focusBlock],
    roles = [...ROLE_DEFAULT],
    seen = [false, false, false];
  partsOf(b0.pattern).forEach((p, i) => {
    if (!seen[p.role]) {
      roles[p.role] = b0.fabrics[i];
      seen[p.role] = true;
    }
  });
  eachSelected((b, bi) => {
    shared.design.blocks[bi] = {
      ...newBlock(key, roles),
      rot: b.rot,
      ...(b.flip ? { flip: true } : {}),
      ...(b.span > 1 ? { span: b.span } : {}),
    };
  });
  symApply([...shared.selBlocks]);
  shared.selParts.clear();
  saveDesign();
  renderDesigner();
}

export { applyFabric, setPattern };
