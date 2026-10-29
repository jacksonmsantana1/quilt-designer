// Symmetry, block size and quilting settings; cancel and double-click to close.
import './borders-ui.js'; // load order: runs after designer/borders-ui
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { saveDesign } from './design-state.js';
import { blockSizeMm, setSpan, spanOf } from '../core/geometry.js';
import { drawPartsEditor, renderDesigner } from './parts-editor.js';
import { symApply } from './symmetry.js';
import { quiltingOf } from '../render/quilting.js';
import { tl, tlCommit, tlGo } from '../timeline/timeline.js';
import { symOf } from '../core/symmetry.js';

// small round button on the Block parts card: undo everything done since the design tools were opened, and close them
// symmetry setting (Block parts): turning one on mirrors the design from its top-left part straight away
function syncSymUI() {
  if ($('dz-quilting') && shared.design) $('dz-quilting').value = quiltingOf(shared.design);
  const el = $('dz-sym');
  if (!el || !shared.design) return;
  for (const o of el.options) o.disabled = o.value === 'kal' && shared.design.cols !== shared.design.rows;
  el.value = symOf(shared.design);
  const sp = $('dz-span'),
    b = shared.design.blocks[shared.focusBlock];
  if (!sp || !b) return;
  const c = shared.focusBlock % shared.design.cols,
    r = Math.floor(shared.focusBlock / shared.design.cols),
    max = Math.min(shared.design.cols - c, shared.design.rows - r);
  for (const o of sp.options) {
    o.disabled = +o.value > max;
    o.textContent = `${o.value} × ${o.value} cell${o.value > 1 ? 's' : ''} · ${blockSizeMm(shared.design, +o.value)} mm`;
  }
  sp.value = String(spanOf(b));
}
$('dz-quilting').addEventListener('change', e => {
  if (!shared.design) return;
  shared.design.quilting = e.target.value;
  if (shared.design.quilting === 'ditch') delete shared.design.quilting;
  saveDesign();
  renderDesigner();
});
$('dz-span').addEventListener('change', e => {
  if (!shared.design) return;
  setSpan(shared.design, shared.focusBlock, +e.target.value);
  shared.selBlocks = new Set([shared.focusBlock]);
  symApply([shared.focusBlock]);
  saveDesign();
  renderDesigner();
  drawPartsEditor();
});
$('dz-sym').addEventListener('change', e => {
  if (!shared.design) return;
  shared.design.sym = e.target.value;
  if (shared.design.sym === 'off') delete shared.design.sym;
  const s = symOf(shared.design),
    C = shared.design.cols,
    R = shared.design.rows,
    src = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const inL = c < Math.ceil(C / 2),
        inT = r < Math.ceil(R / 2);
      if (s === 'lr' ? inL : s === 'tb' ? inT : s === 'both' ? inL && inT : s === 'kal' ? inL && inT && c >= r : false)
        src.push(r * C + c);
    }
  symApply(src);
  saveDesign();
  renderDesigner();
});
const cancelTools = () => {
  if (shared.toolsSnap && shared.design) {
    tlCommit();
    const k = tl.steps.findIndex(st => st.d === shared.toolsSnap.d);
    if (tl.key === shared.toolsSnap.key && JSON.stringify(shared.design) !== shared.toolsSnap.d && k >= 0)
      tlGo(k); // the later steps stay available as redo
    else if (JSON.stringify(shared.design) !== shared.toolsSnap.d) {
      shared.design = JSON.parse(shared.toolsSnap.d);
      shared.selBlocks = new Set([Math.min(shared.focusBlock, shared.design.blocks.length - 1)]);
      shared.focusBlock = [...shared.selBlocks][0];
      shared.selParts.clear();
      saveDesign();
      renderDesigner();
    }
  }
  shared.toolsSnap = null;
  shared.hideTools();
};
for (const b of document.querySelectorAll('.dz-cancel'))
  b.addEventListener('click', e => {
    e.stopPropagation();
    cancelTools();
  });
// a double-click on empty page space (not on a control, the quilt, the panel or the timeline) closes the side panel
document.addEventListener('dblclick', e => {
  if (state.page !== 'design' || document.body.classList.contains('tour-active')) return;
  if (
    e.target.closest(
      'button, input, select, textarea, label, a, canvas, .card, #dz-side, .rail, #tl-panel, .tour, dialog',
    )
  )
    return;
  shared.hideTools();
  if (!$('tl-panel').hidden && tl.showBar) tl.showBar(false); // and the timeline closes too
  if (tl.hideRow) tl.hideRow();
});

export { syncSymUI };
