// Resizing the simulated quilt to the design.
import './bed.js'; // load order: runs after sim/bed
import * as THREE from 'three';
import { designNormalTex, patchTex, setDesignNormalTex, setPatchTex } from './sim-state.js';
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
    patchTex.dispose();
    setPatchTex(new THREE.CanvasTexture(patchCanvas));
    patchTex.colorSpace = THREE.SRGBColorSpace;
    patchTex.anisotropy = maxAniso;
    QM.top.map = patchTex;
    QM.top.needsUpdate = true;
  }
  if (designNormalCanvas.width !== nw || designNormalCanvas.height !== nh) {
    designNormalCanvas.width = nw;
    designNormalCanvas.height = nh;
    const wasDesign = QM.top.normalMap === designNormalTex;
    designNormalTex.dispose();
    setDesignNormalTex(new THREE.CanvasTexture(designNormalCanvas));
    designNormalTex.colorSpace = THREE.NoColorSpace;
    designNormalTex.anisotropy = maxAniso;
    if (wasDesign) {
      QM.top.normalMap = designNormalTex;
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
