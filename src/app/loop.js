// The animation loop of the 3D view.
import '../pdf/download.js';          // load order: runs after pdf/download
import { shared } from '../core/shared.js';
import { state } from '../sim/config.js';
import { send } from '../sim/worker-link.js';
import { renderer, scene } from '../sim/renderer.js';
import { handMeshes, quiltBind, quiltBot, quiltTop, upsample } from '../sim/quilt-mesh.js';
import { stepCamera } from '../sim/camera.js';
import { analysis, computeAnalysis, stepAnalysis } from '../sim/analysis.js';
import { stepRender } from '../sim/photo-render.js';
import { handsData } from '../sim/messages.js';

// ------------------------------------------------------------- loop
let lastT = performance.now();
function frame(now) {
  now = now || performance.now();
  if (state.page !== 'sim') { lastT = now; requestAnimationFrame(frame); return; }   // the 3D view is hidden
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (shared.grabMsg) { send(shared.grabMsg); shared.grabMsg = null; }
  if (shared.newFrame) {
    upsample(); shared.newFrame = false;
    computeAnalysis();
    for (let k = 0; k < handMeshes.length; k++) {
      const on = 3 * k + 2 < handsData.length && state.view !== 'render';
      handMeshes[k].visible = on;
      if (on) handMeshes[k].position.set(handsData[3 * k], handsData[3 * k + 1] + 0.03, handsData[3 * k + 2]);
    }
  }
  const showQuilt = shared.havePos && !(analysis.on && analysis.anim === null);
  quiltTop.visible = quiltBot.visible = quiltBind.visible = showQuilt || (analysis.on && analysis.anim !== null);
  stepAnalysis(dt);
  stepCamera(dt);
  if (!stepRender()) renderer.render(scene, shared.activeCam);
  requestAnimationFrame(frame);
}

export { frame };
