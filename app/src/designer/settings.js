// Symmetry, block size and quilting settings; cancel and double-click to close.
import './borders-ui.js'; // load order: runs after designer/borders-ui
import { design, focusBlock, selBlocks, selParts, setSelBlocks, setToolsSnap, toolsSnap } from '../core/store.js';
import { hideTools, toolsPanel } from './ui-state.js';
import { drawDesignerCanvas, flipped } from './canvas.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { isOnPoint } from '@quilt/shared/geometry.js';
import { quiltingOf } from '../render/quilting.js';
import { tl, tlCommit, tlGo } from '../timeline/timeline.js';
import { setSymmetry, symOf } from '../core/symmetry.js';
import { dispatch, openDesign } from './dispatch.js';
import { setQuilting } from '../core/edits.js';
import { t } from '@quilt/shared/i18n.js';

// small round button on the Block parts card: undo everything done since the design tools were opened, and close them
// symmetry (a round button on the tool rail): turning one on mirrors the design from its top-left part straight away
function syncSymUI() {
  if ($('dz-quilting') && design) $('dz-quilting').value = quiltingOf(design);
  const btn = $('rail-sym');
  if (!btn || !design) return;
  // the round Symmetry button shows the current choice, filled while one is on
  const cur = symOf(design),
    onPoint = isOnPoint(design);
  for (const o of document.querySelectorAll('#sym-row .sym-opt')) {
    const v = /** @type {HTMLElement} */ (o).dataset.sym;
    o.setAttribute('aria-pressed', String(v === cur));
    // 8-way mirrors across the diagonals too: only a square layout has them
    const off = v === 'kal' && design.cols !== design.rows;
    /** @type {HTMLButtonElement} */ (o).disabled = off;
    o.setAttribute(
      'title',
      off ? t('Kaleidoscope (8-way): only for square layouts (as many columns as rows)') : o.getAttribute('aria-label'),
    );
    if (v === cur) btn.querySelector('svg').innerHTML = o.querySelector('svg').innerHTML;
  }
  btn.setAttribute('aria-pressed', String(cur !== 'off'));
  // on point the mirror lines only run through the blocks when the quilt is square; a choice made earlier waits
  const paused = onPoint && design.cols !== design.rows;
  btn.disabled = paused;
  btn.title = paused
    ? t('Symmetry on point needs as many columns as rows')
    : t('Symmetry: every change to a block is copied to its mirror partners');
  if (paused) openSym(false);
}
/** Slides the five symmetry choices out beside the button (to the left, over the quilt, when there is no room on the right), or back. @param {boolean} open */
function openSym(open) {
  const wrap = $('sym-wrap'),
    row = $('sym-row');
  if (!wrap) return;
  if (open) {
    row.classList.remove('lefty', 'parked');
    const r = row.getBoundingClientRect(),
      b = $('rail-sym').getBoundingClientRect();
    // no room on the right: the window's edge, or the side panel (it would cover the choices)
    const side = $('dz-side'),
      limit = side && !side.hidden ? side.getBoundingClientRect().left : innerWidth - 4;
    if (b.right + 8 + r.width > limit) row.classList.add('lefty');
  } else
    // once faded out, tuck it back over the quilt (hidden, it would still stretch a narrow page sideways)
    setTimeout(() => wrap.classList.contains('open') || row.classList.add('parked'), 200);
  wrap.classList.toggle('open', open);
  $('rail-sym').setAttribute('aria-expanded', String(open));
}
$('dz-quilting').addEventListener('change', e => {
  if (!design) return;
  dispatch(setQuilting, e.target.value);
});
$('rail-sym').addEventListener('click', () => openSym(!$('sym-wrap').classList.contains('open')));
$('sym-row').addEventListener('click', e => {
  const o = /** @type {HTMLButtonElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.sym-opt'));
  if (!o || o.disabled || !design) return;
  dispatch(setSymmetry, o.dataset.sym); // turning one on mirrors the top-left part straight away (undo takes it back)
  openSym(false);
});
// a click anywhere else, or Esc, closes it unchanged
document.addEventListener('click', e => {
  if ($('sym-wrap').classList.contains('open') && !$('sym-wrap').contains(/** @type {Node} */ (e.target)))
    openSym(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('sym-wrap').classList.contains('open')) openSym(false);
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
// empty page space: not a control, the quilt, the panel or the timeline (and not during the tour)
const onEmptySpace = e =>
  state.page === 'design' &&
  !document.body.classList.contains('tour-active') &&
  !e.target.closest(
    'button, input, select, textarea, label, a, canvas, .card, #dz-side, .rail, #tl-panel, .tour, dialog',
  );
// a click on empty page space ends a block selection: back to the block in focus (no dotted frames round the
// others) and the Block parts card closes. Its changes stay (✕ is the button that undoes them).
document.addEventListener('click', e => {
  if (!onEmptySpace(e) || flipped || !design) return;
  const partsOpen = !$('dz-side').hidden && toolsPanel === 'parts';
  if (selBlocks.size <= 1 && !partsOpen) return;
  setSelBlocks(new Set([focusBlock]));
  selParts.clear();
  // closing the panel redraws the quilt
  if (partsOpen) hideTools();
  else drawDesignerCanvas();
});
// a double-click on empty page space closes the side panel
document.addEventListener('dblclick', e => {
  if (!onEmptySpace(e)) return;
  hideTools();
  if (!$('tl-panel').hidden && tl.showBar) tl.showBar(false); // and the timeline closes too
  if (tl.hideRow) tl.hideRow();
});

export { syncSymUI };
