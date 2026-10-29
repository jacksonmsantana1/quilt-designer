// Symmetry, block size and quilting settings; cancel and double-click to close.
import './borders-ui.js'; // load order: runs after designer/borders-ui
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { blockSizeMm, spanOf } from '../core/geometry.js';
import { quiltingOf } from '../render/quilting.js';
import { tl, tlCommit, tlGo } from '../timeline/timeline.js';
import { setSymmetry, symOf } from '../core/symmetry.js';
import { dispatch, replaceDesign } from './dispatch.js';
import { setBlockSpan, setQuilting } from '../core/edits.js';

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
  dispatch(setQuilting, e.target.value);
});
$('dz-span').addEventListener('change', e => {
  if (!shared.design) return;
  shared.selBlocks = new Set([shared.focusBlock]);
  dispatch(setBlockSpan, shared.focusBlock, +e.target.value);
});
$('dz-sym').addEventListener('change', e => {
  if (!shared.design) return;
  dispatch(setSymmetry, e.target.value);
});
const cancelTools = () => {
  if (shared.toolsSnap && shared.design) {
    tlCommit();
    const k = tl.steps.findIndex(st => st.d === shared.toolsSnap.d);
    if (tl.key === shared.toolsSnap.key && JSON.stringify(shared.design) !== shared.toolsSnap.d && k >= 0)
      tlGo(k); // the later steps stay available as redo
    else if (JSON.stringify(shared.design) !== shared.toolsSnap.d) {
      replaceDesign(JSON.parse(shared.toolsSnap.d), { keepFocus: true });
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
