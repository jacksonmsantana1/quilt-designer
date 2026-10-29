// Layout that follows the window size.
import '../ui/folds.js'; // load order: runs after ui/folds
import { cgHi, lastPlan, setCgHi } from '../render/hi-state.js';
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { drawDesignerCanvas } from '../designer/canvas.js';
import { initBedUI } from '../sim/bed.js';
import { drawCutQuilt } from '../cutting/draw.js';

// simulation page: the controls column is as tall as the window below its top, so the page itself stays still
function fitSimSide() {
  const side = $('sim-side');
  if (!side) return;
  if (window.innerWidth <= 920 || state.page !== 'sim') {
    side.style.maxHeight = '';
    return;
  }
  const top = side.getBoundingClientRect().top + window.scrollY;
  side.style.maxHeight = Math.max(260, Math.floor(window.innerHeight - top - 40)) + 'px';
}
window.addEventListener('resize', fitSimSide);
window.addEventListener('resize', () => {
  if (state.page === 'design' && design) drawDesignerCanvas();
});
$('cg-quilt-meta').addEventListener('click', () => {
  if (cgHi !== -1 && lastPlan) {
    setCgHi(-1);
    drawCutQuilt(lastPlan);
  }
});
new ResizeObserver(() => {
  if (state.page === 'cut' && lastPlan && design) drawCutQuilt(lastPlan);
}).observe(document.querySelector('.cg-quilt'));
initBedUI();

export { fitSimSide };
