// Lighting presets (HDRI environments) and the look of the 3D view.
import './stage.js'; // load order: runs after sim/stage
import * as THREE from 'three';
import { state } from './config.js';
import { IS_PHONE, renderer, scene, sun } from './renderer.js';
import { bedroom, studio } from './stage.js';
import { analysis, engBg } from './analysis.js';
import { RASTER_ENV_SCALE, pathTracer, raster, resetRaster } from './photo-render.js';

// ------------------------------------------------------------- lighting presets
// Studio lighting from Poly Haven HDRIs, stored as half-float RGB (512 × 256).
const HDRIS = {
  soft: { url: 'assets/env_soft.json', tex: null },
  warm: { url: 'assets/env_warm.json', tex: null },
};
async function loadHdri(key) {
  const h = HDRIS[key];
  if (!h.tex) {
    const j = await (await fetch(h.url)).json();
    const bin = atob(j.data),
      u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    // Half floats: unlike 32-bit floats, every WebGL 2 GPU can filter them.
    const half = new Uint16Array(u8.buffer),
      n = j.width * j.height;
    const rgba = new Uint16Array(n * 4),
      one = THREE.DataUtils.toHalfFloat(1);
    for (let i = 0; i < n; i++) {
      rgba[4 * i] = half[3 * i];
      rgba[4 * i + 1] = half[3 * i + 1];
      rgba[4 * i + 2] = half[3 * i + 2];
      rgba[4 * i + 3] = one;
    }
    const t = new THREE.DataTexture(rgba, j.width, j.height, THREE.RGBAFormat, THREE.HalfFloatType);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.flipY = true;
    t.needsUpdate = true;
    h.tex = t;
  }
  return h.tex;
}
const look = {
  stage: 'studio',
  light: 'warm',
  exposure: 1.0,
  dof: false,
  fstop: 4,
  target: 128,
  bounces: 6,
  engine: 'auto',
};
// Phones skip the photo render entirely: preview, analysis and the designer remain.
if (IS_PHONE) {
  look.engine = 'raster';
  state.atRest = 'none';
}
async function applyLook() {
  const env = await loadHdri(look.light);
  scene.environment = env;
  const isStudio = look.stage === 'studio';
  bedroom.visible = !isStudio && !analysis.on;
  studio.visible = isStudio && !analysis.on;
  scene.environmentIntensity = isStudio ? 0.42 : 0.28;
  scene.background = analysis.on ? engBg : new THREE.Color(isStudio ? 0xdcdad6 : 0x2a2521);
  sun.position.set(...(isStudio ? [2.2, 4.4, 2.6] : [-3.6, 3.2, 0.9]));
  sun.intensity = isStudio ? 1.6 : 2.4;
  renderer.toneMappingExposure = look.exposure;
  if (raster.active) {
    scene.environmentIntensity *= RASTER_ENV_SCALE;
    sun.visible = true;
    resetRaster();
  }
  if (pathTracer && state.view === 'render' && !raster.active) {
    pathTracer.updateEnvironment();
    pathTracer.updateLights();
    pathTracer.updateMaterials();
  }
}

export { applyLook, look };
