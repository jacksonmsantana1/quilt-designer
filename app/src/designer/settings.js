// Symmetry, block size and quilting settings; cancel and double-click to close.
import './borders-ui.js'; // load order: runs after designer/borders-ui
import { design, focusBlock, setSelBlocks, setToolsSnap, toolsSnap } from '../core/store.js';
import { hideTools } from './ui-state.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { blockSizeMm, spanOf } from '@quilt/shared/geometry.js';
import { quiltingOf } from '../render/quilting.js';
import { tl, tlCommit, tlGo } from '../timeline/timeline.js';
import { setSymmetry, symOf } from '../core/symmetry.js';
import { dispatch, openDesign } from './dispatch.js';
import { setBlockSpan, setQuilting } from '../core/edits.js';

// small round button on the Block parts card: undo everything done since the design tools were opened, and close them
// symmetry setting (Block parts): turning one on mirrors the design from its top-left part straight away
function syncSymUI() {
  if ($('dz-quilting') && design) $('dz-quilting').value = quiltingOf(design);
  const el = $('dz-sym');
  if (!el || !design) return;
  for (const o of el.options) o.disabled = o.value === 'kal' && design.cols !== design.rows;
  el.value = symOf(design);
  const sp = $('dz-span'),
    b = design.blocks[focusBlock];
  if (!sp || !b) return;
  const c = focusBlock % design.cols,
    r = Math.floor(focusBlock / design.cols),
    max = Math.min(design.cols - c, design.rows - r);
  for (const o of sp.options) {
    o.disabled = +o.value > max;
    o.textContent = `${o.value} × ${o.value} cell${o.value > 1 ? 's' : ''} · ${blockSizeMm(design, +o.value)} mm`;
  }
  sp.value = String(spanOf(b));
}
$('dz-quilting').addEventListener('change', e => {
  if (!design) return;
  dispatch(setQuilting, e.target.value);
});
$('dz-span').addEventListener('change', e => {
  if (!design) return;
  setSelBlocks(new Set([focusBlock]));
  dispatch(setBlockSpan, focusBlock, +e.target.value);
});
$('dz-sym').addEventListener('change', e => {
  if (!design) return;
  dispatch(setSymmetry, e.target.value);
});
const cancelTools = () => {
  if (toolsSnap && design) {
    tlCommit();
    const k = tl.steps.findIndex(st => st.d === toolsSnap.d);
    if (tl.key === toolsSnap.key && JSON.stringify(design) !== toolsSnap.d && k >= 0)
      tlGo(k); // the later steps stay available as redo
    else if (JSON.stringify(design) !== toolsSnap.d) {
      openDesign(toolsSnap.d, { keepFocus: true, quiet: true });
    }
  }
  setToolsSnap(null);
  hideTools();
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
  hideTools();
  if (!$('tl-panel').hidden && tl.showBar) tl.showBar(false); // and the timeline closes too
  if (tl.hideRow) tl.hideRow();
});

export { syncSymUI };
