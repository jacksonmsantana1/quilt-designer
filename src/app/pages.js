// Pages and tabs.
import '../render/quilting.js'; // load order: runs after render/quilting
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from '../sim/config.js';
import { resize } from '../sim/camera.js';
import { startRender, stopRender } from '../sim/photo-render.js';
import { initFabricLib } from '../designer/fabric-library.js';
import { loadDesign } from '../designer/design-state.js';
import { drawFabricPalette, renderDesigner } from '../designer/parts-editor.js';
import { initDesignerUI } from '../designer/designer-ui.js';
import { renderCut } from '../cutting/page.js';
import { renderMine } from '../mine/my-designs.js';
import { tlBarOn, tlUI } from '../timeline/timeline.js';
import { fitSimSide } from './layout.js';

// ---- pages
function showPage(p) {
  state.page = p;
  if ($('tour-start')) $('tour-start').hidden = p !== 'design';
  // the simulation opens as a layer above the Quilt designer, which stays underneath
  document.body.classList.toggle('sim-over', p === 'sim');
  $('page-sim').hidden = p !== 'sim';
  $('page-design').hidden = p !== 'design' && p !== 'sim';
  $('page-cut').hidden = p !== 'cut';
  $('page-mine').hidden = p !== 'mine';
  for (const b of $('tabs').children)
    b.setAttribute('aria-selected', String(b.dataset.page === (p === 'sim' ? 'design' : p)));
  if ($('tl-panel')) {
    const want = p === 'design' && !!tlBarOn;
    $('tl-panel').hidden = !want;
    document.body.classList.toggle('tl-open', want);
    if (want) {
      tlUI();
      document.body.style.setProperty('--tl-h', $('tl-panel').offsetHeight + 'px');
    }
  }
  if (p === 'sim') {
    resize();
    fitSimSide();
    if (!shared.design)
      (async () => {
        await initFabricLib();
        if (!shared.design) {
          shared.design = loadDesign();
          shared.selBlocks = new Set([0]);
          shared.focusBlock = 0;
          shared.activeFabric = 'b0';
        }
        drawFabricPalette();
        renderDesigner();
      })();
    // coming back: the photo render (if one is showing) starts again from the current quilt and window size
    if (state.view === 'render') {
      stopRender();
      startRender();
    }
    return;
  }
  (async () => {
    await initFabricLib();
    if (!shared.design) {
      shared.design = loadDesign();
      shared.selBlocks = new Set([0]);
      shared.focusBlock = 0;
      shared.activeFabric = 'b0';
    }
    if (p === 'design') {
      drawFabricPalette();
      renderDesigner();
    } else if (p === 'mine') renderMine();
    else renderCut();
  })();
}
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) showPage(b.dataset.page);
});
$('dz-sim').addEventListener('click', () => showPage('sim'));
$('sim-close').addEventListener('click', () => showPage('design'));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.page === 'sim' && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    showPage('design');
  }
});
initDesignerUI();

export { showPage };
