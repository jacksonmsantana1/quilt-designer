// Layout that follows the window size.
import '../ui/folds.js'; // load order: runs after ui/folds
import { shared } from '../core/shared.js';
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
  if (state.page === 'design' && shared.design) drawDesignerCanvas();
});
$('cg-quilt-meta').addEventListener('click', () => {
  if (shared.cgHi !== -1 && shared.lastPlan) {
    shared.cgHi = -1;
    drawCutQuilt(shared.lastPlan);
  }
});
new ResizeObserver(() => {
  if (state.page === 'cut' && shared.lastPlan && shared.design) drawCutQuilt(shared.lastPlan);
}).observe(document.querySelector('.cg-quilt'));
initBedUI();

export { fitSimSide };
