// Turns the design into the 3D quilt texture, quilting relief and backing.
import '../designer/designer-ui.js'; // load order: runs after designer/designer-ui
import * as THREE from 'three';
import { designNormalTex, patchTex, setDesignNormalTex } from './sim-state.js';
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { quilt, state } from './config.js';
import { maxAniso } from './textures.js';
import { QM, patchCanvas } from './patchwork.js';
import { pathTracer } from './photo-render.js';
import { setView } from './view.js';
import { restart } from './controls.js';
import { fabricById } from '../designer/fabric-library.js';
import { quiltMm } from '../core/geometry.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { setQuiltDims } from './quilt-size.js';
import { softSeams } from '../render/quilting.js';
import { fabricFill } from '../render/fabric-fill.js';

// ---- design -> simulation
// Colour: the design drawn at 2048 px with real-scale fabric. Quilting: the
// quilt is stitched in the ditch along every seam of the design, so the
// batting puffs between them; that relief becomes a normal map.
const designNormalCanvas = document.createElement('canvas');
designNormalCanvas.width = designNormalCanvas.height = 1024;
setDesignNormalTex(new THREE.CanvasTexture(designNormalCanvas));
designNormalTex.colorSpace = THREE.NoColorSpace;
designNormalTex.anisotropy = maxAniso;
function buildDesignMaps() {
  const qm = quiltMm(design);
  setQuiltDims(qm.W / 1000, qm.H / 1000);
  const W = patchCanvas.width,
    H = patchCanvas.height,
    quiltCm = qm.W / 10;
  const g = patchCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  drawQuilt(g, W, H);
  // shadow in the seams
  // (blurred by drawing small and scaling up: fast everywhere, unlike canvas blur filters)
  const cav = softSeams(W, H, 3, '#fff', 'rgba(0,0,0,.55)', 5);
  g.globalCompositeOperation = 'multiply';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cav, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  // binding: ½-inch (12.7 mm) indigo cotton
  const bw = W * (1.27 / quiltCm);
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  g.rect(bw, bw, W - 2 * bw, H - 2 * bw);
  g.clip('evenodd');
  g.fillStyle = fabricFill(g, fabricById('b1'), W / quiltCm, 3);
  g.fillRect(0, 0, W, H);
  g.restore();
  patchTex.needsUpdate = true;
  // quilting relief -> normal map
  const NW = designNormalCanvas.width,
    NH = designNormalCanvas.height,
    hc = document.createElement('canvas');
  hc.width = NW;
  hc.height = NH;
  const hg = hc.getContext('2d');
  hg.imageSmoothingEnabled = true;
  hg.imageSmoothingQuality = 'high';
  hg.drawImage(softSeams(NW, NH, 6, '#fff', '#000', 7), 0, 0, NW, NH);
  hg.lineWidth = Math.max(4, Math.max(NW, NH) * 0.012);
  hg.strokeStyle = '#999';
  hg.strokeRect(0, 0, NW, NH);
  const h = hg.getImageData(0, 0, NW, NH).data,
    out = new ImageData(NW, NH),
    o = out.data,
    s = 6 / 255;
  for (let y = 0; y < NH; y++)
    for (let x = 0; x < NW; x++) {
      const xm = Math.max(0, x - 1),
        xp = Math.min(NW - 1, x + 1),
        ym = Math.max(0, y - 1),
        yp = Math.min(NH - 1, y + 1);
      const gx = (h[4 * (y * NW + xp)] - h[4 * (y * NW + xm)]) * s,
        gy = -(h[4 * (yp * NW + x)] - h[4 * (ym * NW + x)]) * s;
      const l = Math.hypot(gx, gy, 1),
        i = 4 * (y * NW + x);
      o[i] = ((-gx / l) * 0.5 + 0.5) * 255;
      o[i + 1] = ((-gy / l) * 0.5 + 0.5) * 255;
      o[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
    }
  designNormalCanvas.getContext('2d').putImageData(out, 0, 0);
  designNormalTex.needsUpdate = true;
  QM.top.normalMap = designNormalTex;
  QM.top.needsUpdate = true;
  applyBacking();
  if (pathTracer && state.view === 'render') pathTracer.updateMaterials();
}
// Backing fabric on the quilt's underside, repeated at its real size.
let backTex = null;
const BACK_DEFAULT = { map: QM.back.map, color: QM.back.color.clone(), normalMap: QM.back.normalMap };
function applyBacking() {
  const fab = fabricById(design.backFabric);
  if (backTex) backTex.dispose();
  backTex = new THREE.CanvasTexture(fab.canvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = maxAniso;
  backTex.wrapS = backTex.wrapT = THREE.RepeatWrapping;
  backTex.repeat.set((quilt.w * 100) / fab.cm, (quilt.l * 100) / ((fab.cm * fab.canvas.height) / fab.canvas.width));
  QM.back.map = backTex;
  QM.back.color.set(0xffffff);
  QM.back.normalMap = designNormalTex;
  QM.back.needsUpdate = true;
}
function restoreBacking() {
  QM.back.map = BACK_DEFAULT.map;
  QM.back.color.copy(BACK_DEFAULT.color);
  QM.back.normalMap = BACK_DEFAULT.normalMap;
  QM.back.needsUpdate = true;
}
// The simulation follows the design: every change (saved through saveDesign) is rebuilt into the
// quilt's texture and quilting after a short pause; a change of size rebuilds the cloth and
// drops it again.
let syncTimer = 0;
function scheduleSync() {
  clearTimeout(syncTimer);
  if ($('dz-sync')) $('dz-sync').textContent = 'Updating the simulation…';
  syncTimer = setTimeout(syncSimulation, 350);
}
function syncSimulation() {
  if (!design) return;
  const w0 = quilt.w,
    l0 = quilt.l;
  if (state.view === 'render') setView('photo');
  buildDesignMaps();
  state.usingDesign = true;
  const resized = Math.abs(quilt.w - w0) > 1e-6 || Math.abs(quilt.l - l0) > 1e-6;
  if (resized) restart();
  if ($('dz-sync'))
    $('dz-sync').textContent = resized
      ? 'Simulation updated · quilt dropped again at the new size'
      : 'Simulation up to date';
}

export { designNormalCanvas, restoreBacking, scheduleSync, syncSimulation };
