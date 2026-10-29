// The design being edited and the selection: the state the Quilt designer works on.
// Pure (no side effects when loaded), so any module can import it. Importers see the current values (ES modules export
// live bindings) but cannot assign them: every change goes through a setter, so a search for the setter finds
// every place that changes a value. `design` is only ever set by designer/dispatch.js (dispatch, replaceDesign).
/** @typedef {import('@quilt/shared/types.js').Design} Design */

/** @type {Design | null} the design being edited (null until loaded) */
export let design = null;
/** @param {Design | null} d */
export const setDesign = d => (design = d);

/** @type {Set<number>} selected blocks (indices into design.blocks) */
export let selBlocks = new Set();
/** @param {Set<number>} s */
export const setSelBlocks = s => (selBlocks = s);
/** the block the panels show (one of the selected) */
export let focusBlock = 0;
/** @param {number} i */
export const setFocusBlock = i => (focusBlock = i);
/** @type {Set<number>} selected parts of the focused block */
export let selParts = new Set();
/** @param {Set<number>} s */
export const setSelParts = s => (selParts = s);

/** @type {string | null} the fabric picked in the palette */
export let activeFabric = null;
/** @param {string | null} id */
export const setActiveFabric = id => (activeFabric = id);
/** @type {string | null} id of the saved design (My designs) being edited, null for an unsaved one */
export let mineCur = null;
/** @param {string | null} id */
export const setMineCur = id => (mineCur = id);
/** @type {Design | null} the design as it was when a side panel opened (its Cancel button puts it back) */
export let toolsSnap = null;
/** @param {Design | null} d */
export const setToolsSnap = d => (toolsSnap = d);
/** true while the design was saved by a newer version of the app: it is shown, but never saved over */
export let readOnly = false;
/** @param {boolean} v */
export const setReadOnly = v => (readOnly = v);
