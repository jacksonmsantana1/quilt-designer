// Resizing the simulated quilt to the design.
import './bed.js'; // load order: runs after sim/bed
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { bedM, quilt } from './config.js';
import { send } from './worker-link.js';
import { maxAniso } from './textures.js';
import { PW, QM, patchCanvas } from './patchwork.js';
import { updateBindUv } from './quilt-mesh.js';
import { syncDropUI } from './controls.js';
import { designNormalCanvas } from './design-maps.js';
import { updateFitReadout, updateIntro } from './bed.js';

function setQuiltDims(w, l) {
  const changed = Math.abs(w - quilt.w) > 1e-6 || Math.abs(l - quilt.l) > 1e-6;
  quilt.w = w;
  quilt.l = l;
  const fit = long =>
    w >= l ? [long, Math.max(64, Math.round((long * l) / w))] : [Math.max(64, Math.round((long * w) / l)), long];
  const [pw, ph] = fit(PW),
    [nw, nh] = fit(1024);
  if (patchCanvas.width !== pw || patchCanvas.height !== ph) {
    patchCanvas.width = pw;
    patchCanvas.height = ph;
    shared.patchTex.dispose();
    shared.patchTex = new THREE.CanvasTexture(patchCanvas);
    shared.patchTex.colorSpace = THREE.SRGBColorSpace;
    shared.patchTex.anisotropy = maxAniso;
    QM.top.map = shared.patchTex;
    QM.top.needsUpdate = true;
  }
  if (designNormalCanvas.width !== nw || designNormalCanvas.height !== nh) {
    designNormalCanvas.width = nw;
    designNormalCanvas.height = nh;
    const wasDesign = QM.top.normalMap === shared.designNormalTex;
    shared.designNormalTex.dispose();
    shared.designNormalTex = new THREE.CanvasTexture(designNormalCanvas);
    shared.designNormalTex.colorSpace = THREE.NoColorSpace;
    shared.designNormalTex.anisotropy = maxAniso;
    if (wasDesign) {
      QM.top.normalMap = shared.designNormalTex;
      QM.top.needsUpdate = true;
    }
  }
  updateBindUv();
  updateIntro();
  updateFitReadout();
  if (changed) send({ type: 'dims', width: w, length: l, bed: bedM() });
  if (typeof syncDropUI === 'function')
    try {
      syncDropUI();
    } catch (e) {}
}

export { setQuiltDims };
