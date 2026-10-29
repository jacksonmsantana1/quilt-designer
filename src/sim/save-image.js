// Saving a picture of the 3D view.
import '../platform/downloads.js';          // load order: runs after platform/downloads
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { state } from './config.js';
import { canvas, renderer, scene } from './renderer.js';
import { look } from './lighting.js';
import { analysis } from './analysis.js';
import { pathTracer, raster, showQuad } from './photo-render.js';
import { downloads } from '../platform/downloads.js';

// Redraw the current view and snapshot the canvas in the same task, so the
// image is captured before the browser clears the drawing buffer. The HUD
// labels are HTML on top of the canvas, so they are never in the image.
function captureBlob() {
  return new Promise((resolve, reject) => {
    if (state.view === 'render' && raster.active && raster.rtAccum) {
      showQuad.material.map = raster.rtAccum.texture; showQuad.render(renderer);
    } else if (state.view === 'render' && pathTracer && pathTracer.scene) {
      const p = pathTracer.pausePathTracing; pathTracer.pausePathTracing = true; pathTracer.renderSample(); pathTracer.pausePathTracing = p;
    } else {
      renderer.render(scene, shared.activeCam);
    }
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('The image could not be captured.')), 'image/png');
  });
}
function imageName() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const what = state.view === 'render'
    ? `${look.stage}-${raster.active ? 'raster-' + raster.n + 'frames' : 'pathtraced-' + Math.floor(pathTracer ? pathTracer.samples : 0) + 'spp'}`
    : state.view === 'analysis' ? `analysis-${analysis.field}` : 'preview';
  return `quilt-${what}-${canvas.width}x${canvas.height}-${stamp}.png`;
}
function saveStatus(text) {
  for (const id of ['savestat', 'savestat2', 'savestat3']) { const el = $(id); if (!el) continue; el.textContent = text; el.hidden = !text; }
  clearTimeout(saveStatus.t);
  if (text) saveStatus.t = setTimeout(() => saveStatus(''), 5000);
}
async function saveImage() {
  for (const id of ['saveimg', 'saveimg2', 'saveimg3']) $(id).disabled = true;
  try {
    const blob = await captureBlob();
    if (downloads) {
      const res = await downloads.save({ filename: imageName(), data: blob });
      saveStatus(res && res.status === 'delivered' ? 'Picture sent' : 'Picture saved');
    } else {
      // opened outside Claude: an ordinary browser download
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = imageName();
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      saveStatus('Picture saved');
    }
  } catch (e) {
    const code = e && e.code;
    if (code === 'declined') saveStatus('Not saved');
    else if (code === 'rate_limited') saveStatus('A save dialog is already open');
    else if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) {
      saveStatus('Saving isn’t available in this view'); $('saveimg').hidden = $('saveimg2').hidden = true;
    } else saveStatus((e && e.message) || 'The image could not be saved');
  } finally {
    for (const id of ['saveimg', 'saveimg2', 'saveimg3']) $(id).disabled = false;
  }
}
$('saveimg3').addEventListener('click', saveImage);
$('saveimg').addEventListener('click', saveImage);
$('saveimg2').addEventListener('click', saveImage);
