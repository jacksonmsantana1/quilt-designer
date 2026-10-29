// The one way the design changes: dispatch(edit, ...args) applies a pure edit from core/edits.js, then, always in
// this order: mirrors the changed blocks (symmetry), repairs large blocks, saves (storage, timeline, simulation)
// and redraws the designer.
import './design-state.js'; // load order: runs after designer/design-state
import { shared } from '../core/shared.js';
import { normalizeSpans } from '../core/geometry.js';
import { withSymmetry } from '../core/symmetry.js';
import { resize } from '../core/edits.js';
import { loadDesign, saveDesign } from './design-state.js';
import { tlSwitch } from '../timeline/timeline.js';
import { drawFabricPalette, renderDesigner } from './parts-editor.js';
/** @typedef {import('../core/types.js').Design} Design */

// In tests (localStorage 'quilt-freeze.v1' = '1') the design is frozen after every change, so any code that
// still changed it in place would throw instead of silently skipping the save, symmetry and redraw.
let freezeOn = false;
try {
  freezeOn = localStorage.getItem('quilt-freeze.v1') === '1';
} catch (e) {}
const deepFreeze = o => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
/** Makes a design the one being edited. @param {Design} d */
function setCurrent(d) {
  shared.design = freezeOn ? deepFreeze(d) : d;
}

/** The blocks an edit changed (a new object in the same place), not counting cells covered by a large block. */
function changedBlocks(prev, next) {
  if (!prev || prev.blocks.length !== next.blocks.length) return [];
  const out = [];
  next.blocks.forEach((b, i) => {
    if (b !== prev.blocks[i] && b.under == null) out.push(i);
  });
  return out;
}

/**
 * Applies an edit to the design being edited. Returns true when the design changed.
 * An edit marked `edit.mirror = false` (resizing, turning symmetry on) is not mirrored.
 * @template {any[]} A
 * @param {((d: Design, ...args: A) => Design) & { mirror?: boolean }} edit
 * @param {A} args
 */
function dispatch(edit, ...args) {
  const prev = shared.design;
  if (!prev) return false;
  let next = edit(prev, ...args);
  if (next === prev) return false;
  if (edit.mirror !== false) next = withSymmetry(next, changedBlocks(prev, next));
  setCurrent(normalizeSpans(next));
  saveDesign();
  renderDesigner();
  drawFabricPalette();
  return true;
}

/** Changes the number of columns and rows; the selection follows. @param {number} cols @param {number} rows */
function resizeTo(cols, rows) {
  const d = shared.design;
  if (!d) return false;
  const n = Math.max(1, Math.min(20, cols | 0)) * Math.max(1, Math.min(20, rows | 0));
  shared.selBlocks = new Set([Math.min(shared.focusBlock, n - 1)]);
  shared.focusBlock = [...shared.selBlocks][0];
  shared.selParts.clear();
  return dispatch(resize, cols, rows);
}

/**
 * Puts a whole other design in place (new design, opening a saved one, cancel, undo): no mirroring; saved and
 * redrawn. The selection goes back to the first block, or stays where it was with keepFocus.
 * With `timeline`, the design gets that timeline (a saved design's id, null for an unsaved one, 'tour').
 * @param {Design} d @param {{ keepFocus?: boolean, timeline?: string | null }} [opts]
 */
function replaceDesign(d, opts = {}) {
  setCurrent(normalizeSpans(d));
  const f = opts.keepFocus ? Math.min(shared.focusBlock, d.blocks.length - 1) : 0;
  shared.selBlocks = new Set([f]);
  shared.focusBlock = f;
  shared.selParts.clear();
  if ('timeline' in opts) tlSwitch(opts.timeline);
  saveDesign();
  renderDesigner();
}
/** Loads the saved design the first time it is needed (at start-up, or the first page that shows it). */
function ensureDesign() {
  if (shared.design) return;
  setCurrent(loadDesign());
  shared.selBlocks = new Set([0]);
  shared.focusBlock = 0;
}

export { dispatch, ensureDesign, replaceDesign, resizeTo };
