// Quilt-designer UI state used across modules. Pure; values are read as live bindings and changed with the setters.
// showTools, showToolsPanel and hideTools are hooks: designer/designer-ui.js sets them, and modules that load
// before it (the tour, settings, …) call them.

/** @type {string | null} the side panel that is open ('brd', 'sash', …) */
export let toolsPanel = null;
/** @param {string | null} v */
export const setToolsPanel = v => (toolsPanel = v);
/** @type {() => void} */
export let showTools = () => {};
/** @param {() => void} f */
export const setShowTools = f => (showTools = f);
/** @type {(name: string) => void} */
export let showToolsPanel = () => {};
/** @param {(name: string) => void} f */
export const setShowToolsPanel = f => (showToolsPanel = f);
/** @type {() => void} */
export let hideTools = () => {};
/** @param {() => void} f */
export const setHideTools = f => (hideTools = f);
/** @type {{ t: number, hit: number } | null} the last tap on a part (for double taps) */
export let partTap = null;
/** @param {{ t: number, hit: number } | null} v */
export const setPartTap = v => (partTap = v);
/** @type {string} the fabric that clicking or dragging over a mosaic paints with */
export let mosaicBrush = 'b1';
/** @param {string} v */
export const setMosaicBrush = v => (mosaicBrush = v);
/** @type {'one' | 'rosette' | 'row' | 'way' | 'random'} what a click on a mosaic paints */
export let mosaicTool = 'one';
/** @param {'one' | 'rosette' | 'row' | 'way' | 'random'} v */
export const setMosaicTool = v => (mosaicTool = v);
