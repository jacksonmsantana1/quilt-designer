// The one way the design changes: dispatch(edit, ...args) applies a pure edit from core/edits.js, then, always in
// this order: mirrors the changed blocks (symmetry), repairs large blocks, saves (storage, timeline, simulation)
// and redraws the designer.
import './design-state.js'; // load order: runs after designer/design-state
import { design, focusBlock, selBlocks, selParts, setDesign, setFocusBlock, setSelBlocks } from '../core/store.js';
import { normalizeSpans } from '../core/geometry.js';
import { withSymmetry } from '../core/symmetry.js';
import { resize } from '../core/edits.js';
import { loadDesign, saveDesign } from './design-state.js';
import { tlRecord, tlSwitch } from '../timeline/timeline.js';
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
  setDesign(freezeOn ? deepFreeze(d) : d);
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
 * An edit marked `edit.mirror = false` (resizing, turning symmetry on) is not mirrored. Each edit is one timeline
 * step; an edit marked `edit.merge = true` (typing a size, holding a stepper) updates its step while repeated.
 * @template {any[]} A
 * @param {((d: Design, ...args: A) => Design) & { mirror?: boolean, merge?: boolean }} edit
 * @param {A} args
 */
function dispatch(edit, ...args) {
  const prev = design;
  if (!prev) return false;
  let next = edit(prev, ...args);
  if (next === prev) return false;
  if (edit.mirror !== false) next = withSymmetry(next, changedBlocks(prev, next));
  setCurrent(normalizeSpans(next));
  saveDesign();
  tlRecord(edit.merge ? edit.name : null);
  renderDesigner();
  drawFabricPalette();
  return true;
}

/** Changes the number of columns and rows; the selection follows. @param {number} cols @param {number} rows */
function resizeTo(cols, rows) {
  const d = design;
  if (!d) return false;
  const n = Math.max(1, Math.min(20, cols | 0)) * Math.max(1, Math.min(20, rows | 0));
  setSelBlocks(new Set([Math.min(focusBlock, n - 1)]));
  setFocusBlock([...selBlocks][0]);
  selParts.clear();
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
  const f = opts.keepFocus ? Math.min(focusBlock, d.blocks.length - 1) : 0;
  setSelBlocks(new Set([f]));
  setFocusBlock(f);
  selParts.clear();
  if ('timeline' in opts) tlSwitch(opts.timeline);
  saveDesign();
  tlRecord(null);
  renderDesigner();
}
/** Loads the saved design the first time it is needed (at start-up, or the first page that shows it). */
function ensureDesign() {
  if (design) return;
  setCurrent(loadDesign());
  setSelBlocks(new Set([0]));
  setFocusBlock(0);
}

export { dispatch, ensureDesign, replaceDesign, resizeTo };
