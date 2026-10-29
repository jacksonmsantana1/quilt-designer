// The design being edited: loading, saving, new design, resizing.
import './fabric-library.js'; // load order: runs after designer/fabric-library
import { design } from '../core/store.js';
import { PATTERNS, partsOf } from '../core/patterns.js';
import { normalizeSpans } from '../core/geometry.js';
import { scheduleSync } from '../sim/design-maps.js';
import { defaultDesign } from '../core/design.js';

// ---- design state
const DESIGN_KEY = 'quilt-designer.v1';
function loadDesign() {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null');
    if (
      d &&
      d.cols &&
      d.rows &&
      Array.isArray(d.blocks) &&
      d.blocks.length === d.cols * d.rows &&
      d.blocks.every(b => PATTERNS[b.pattern] && b.fabrics.length === partsOf(b.pattern).length)
    ) {
      if (!(d.blockMm > 0)) d.blockMm = Math.round(2290 / d.cols); // designs saved before block sizes existed
      if (!d.backFabric) d.backFabric = 'b0';
      return normalizeSpans(d);
    }
  } catch (e) {}
  return defaultDesign();
}
function saveDesign() {
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
  } catch (e) {}
  scheduleSync();
}

export { loadDesign, saveDesign };
