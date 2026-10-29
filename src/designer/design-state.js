// The design being edited: loading, saving, new design, resizing.
import './fabric-library.js';          // load order: runs after designer/fabric-library
import { shared } from '../core/shared.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { ROLE_DEFAULT } from './fabric-library.js';
import { normalizeSpans } from '../core/geometry.js';
import { renderDesigner } from './parts-editor.js';
import { scheduleSync } from '../sim/design-maps.js';
import { tlRecord } from '../timeline/timeline.js';

// ---- design state
const DESIGN_KEY = 'quilt-designer.v1';
shared.design = null; shared.selBlocks = new Set(); shared.focusBlock = 0; shared.selParts = new Set();
function newBlock(pattern = 'ohio', roles = ROLE_DEFAULT) {
  return { pattern, rot: 0, fabrics: partsOf(pattern).map(p => roles[p.role] || roles[0]) };
}
function defaultDesign() {
  const d = { cols: 5, rows: 5, blockMm: 458, backFabric: 'b0', blocks: [] };
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
    d.blocks.push((r + c) % 2 === 0 ? newBlock('ohio', ['b0', 'b1', 'b3']) : newBlock('nine', ['b0', 'b4', 'b3']));
  return d;
}
function loadDesign() {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null');
    if (d && d.cols && d.rows && Array.isArray(d.blocks) && d.blocks.length === d.cols * d.rows &&
        d.blocks.every(b => PATTERNS[b.pattern] && b.fabrics.length === partsOf(b.pattern).length)) {
      if (!(d.blockMm > 0)) d.blockMm = Math.round(2290 / d.cols);     // designs saved before block sizes existed
      if (!d.backFabric) d.backFabric = 'b0';
      return normalizeSpans(d);
    }
  } catch (e) {}
  return defaultDesign();
}
function saveDesign() { normalizeSpans(shared.design); try { localStorage.setItem(DESIGN_KEY, JSON.stringify(shared.design)); } catch (e) {} scheduleSync(); tlRecord(); }
function resizeDesign(cols, rows) {
  cols = Math.max(1, Math.min(20, cols | 0)); rows = Math.max(1, Math.min(20, rows | 0));
  const old = shared.design, blocks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r < old.rows && c < old.cols) blocks.push(old.blocks[r * old.cols + c]);
    else {
      // new blocks continue the checkerboard of the nearest existing block pattern
      const src = old.blocks[Math.min(r, old.rows - 1) * old.cols + Math.min(c, old.cols - 1)];
      blocks.push(JSON.parse(JSON.stringify(src)));
    }
  }
  shared.design = { cols, rows, blockMm: old.blockMm, backFabric: old.backFabric, blocks, ...(old.sashing ? { sashing: old.sashing } : {}), ...(old.borders ? { borders: old.borders } : {}), ...(old.sym ? { sym: old.sym } : {}), ...(old.quilting ? { quilting: old.quilting } : {}) };
  shared.selBlocks = new Set([Math.min(shared.focusBlock, blocks.length - 1)]); shared.focusBlock = [...shared.selBlocks][0]; shared.selParts.clear();
  saveDesign(); renderDesigner();
}

export { defaultDesign, loadDesign, newBlock, resizeDesign, saveDesign };
