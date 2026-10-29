// Start-up.
import './loop.js'; // load order: runs after app/loop
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { startSim } from '../sim/worker-link.js';
import { IS_PHONE } from '../sim/renderer.js';
import { loadImage } from '../sim/textures.js';
import { applyLook } from '../sim/lighting.js';
import { BUNDLED, useSwatches } from '../sim/patchwork.js';
import { resize } from '../sim/camera.js';
import { initFabricLib } from '../designer/fabric-library.js';
import { syncSimulation } from '../sim/design-maps.js';
import { showPage } from './pages.js';
import { fitSimSide } from './layout.js';
import { frame } from './loop.js';
import { ensureDesign } from '../designer/dispatch.js';

// ------------------------------------------------------------- start
if (IS_PHONE) {
  document.documentElement.classList.add('phone');
  $('rbtn').hidden = true;
  $('render-card').hidden = true;
  const ar = $('atrest');
  ar.value = 'none';
}
resize();
startSim();
requestAnimationFrame(frame);
fitSimSide();
// the site opens on the Quilt designer (#sim or #cut in the address open those pages instead)
if (location.hash === '#sim') showPage('sim');
else if (location.hash === '#cut') showPage('cut');
else if (location.hash === '#mine') showPage('mine');
else showPage('design');
(async () => {
  try {
    shared.cavityImg = await loadImage('assets/quilt_cavity.png');
    await Promise.all([useSwatches(BUNDLED), applyLook()]);
    // the quilt on the bed is your design from the start (the designer keeps it in this browser)
    await initFabricLib();
    if (!shared.design) {
      ensureDesign();
      shared.activeFabric = shared.activeFabric || 'b0';
    }
    syncSimulation();
  } catch (e) {
    $('loading').textContent = 'Some photos or lighting could not load. Showing a plain preview.';
    setTimeout(() => {
      $('loading').hidden = true;
    }, 4000);
    return;
  }
  $('loading').hidden = true;
})();
