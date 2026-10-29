// The design being edited: loading, saving, new design, resizing.
import './fabric-library.js'; // load order: runs after designer/fabric-library
import { design, readOnly } from '../core/store.js';
import { readDesign, readDesignOrDefault } from '../core/format.js';
import { notify } from '../ui/notice.js';
import { scheduleSync } from '../sim/design-maps.js';

// ---- design state
const DESIGN_KEY = 'quilt-designer.v1';
/**
 * The design saved in this browser, upgraded and checked (core/format.js); the default design if there is none
 * or it cannot be read. @returns {NonNullable<ReturnType<typeof readDesign>>}
 */
function loadDesign() {
  let raw = null;
  try {
    raw = localStorage.getItem(DESIGN_KEY);
  } catch (e) {}
  const r = raw ? readDesign(raw) : null;
  if (raw && !r) notify('The quilt saved in this browser could not be read, so a new one was started.');
  return r || readDesignOrDefault(null);
}
function saveDesign() {
  if (readOnly) return; // a design from a newer version of the app: never saved over
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
  } catch (e) {}
  scheduleSync();
}

export { loadDesign, saveDesign };
