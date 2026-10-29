// The one way the design changes: dispatch(edit, ...args) applies a pure edit from core/edits.js, then, always in
// this order: mirrors the changed blocks (symmetry), repairs large blocks, saves (storage, timeline, simulation)
// and redraws the designer.
import './design-state.js'; // load order: runs after designer/design-state
import { shared } from '../core/shared.js';
import { normalizeSpans } from '../core/geometry.js';
import { withSymmetry } from '../core/symmetry.js';
import { resize } from '../core/edits.js';
import { saveDesign } from './design-state.js';
import { drawFabricPalette, renderDesigner } from './parts-editor.js';
/** @typedef {import('../core/types.js').Design} Design */

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
  shared.design = normalizeSpans(next);
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
 * Puts a whole other design in place (new design, start over, cancel): no mirroring; saved and redrawn.
 * The selection goes back to the first block, or stays where it was with keepFocus.
 * @param {Design} d @param {{ keepFocus?: boolean }} [opts]
 */
function replaceDesign(d, opts = {}) {
  shared.design = normalizeSpans(d);
  const f = opts.keepFocus ? Math.min(shared.focusBlock, d.blocks.length - 1) : 0;
  shared.selBlocks = new Set([f]);
  shared.focusBlock = f;
  shared.selParts.clear();
  saveDesign();
  renderDesigner();
}

export { dispatch, replaceDesign, resizeTo };
