// Fabric swatches and the patchwork texture of the bundled sample quilt.
import './lighting.js'; // load order: runs after sim/lighting
import * as THREE from 'three';
import { cavityImg, patchTex, setPatchTex } from './sim-state.js';
import { design } from '../core/store.js';
import { $ } from '../core/dom.js';
import { SIZE, quilt, state } from './config.js';
import { maxAniso, tex, weaveMap, weaveNormal } from './textures.js';
import { prepareSwatch } from '@quilt/shared/basic-fabrics.js';
import { pathTracer } from './photo-render.js';
import { restoreBacking } from './design-maps.js';
import { setQuiltDims } from './quilt-size.js';

// ------------------------------------------------------------- quilt fabrics
// The patchwork is cut from photographs of real fabric. A 90-inch quilt of
// 12 × 12 patches (7.5 in each), arranged "Trip Around the World": every ring
// around the centre is cut from the same fabric.
const PW = 2048,
  NP = 12,
  PATCH = PW / NP,
  PX_PER_CM = PW / 228.6;
const patchCanvas = document.createElement('canvas');
patchCanvas.width = patchCanvas.height = PW;
setPatchTex(new THREE.CanvasTexture(patchCanvas));
patchTex.colorSpace = THREE.SRGBColorSpace;
patchTex.anisotropy = maxAniso;
let swatches = [];
function buildPatchwork() {
  const g = patchCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#d9cdb5';
  g.fillRect(0, 0, PW, PW);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < NP; j++)
    for (let i = 0; i < NP; i++) {
      const ring = Math.round(Math.abs(i - 5.5) + Math.abs(j - 5.5) - 1);
      const sw = swatches[ring % swatches.length];
      if (!sw) continue;
      const c = sw.canvas,
        scale = PX_PER_CM / (c.width / sw.cm); // canvas px per photo px
      const crop = PATCH / scale; // photo px per patch
      const ox = crop < c.width ? rnd() * (c.width - crop) : 0;
      const oy = crop < c.height ? rnd() * (c.height - crop) : 0;
      g.save();
      g.beginPath();
      g.rect(i * PATCH, j * PATCH, PATCH, PATCH);
      g.clip();
      g.translate(i * PATCH + PATCH / 2, j * PATCH + PATCH / 2);
      g.rotate((rnd() - 0.5) * 0.035); // hand-cut patches are never perfectly square
      g.scale(scale, scale);
      g.translate(-crop / 2 - ox, -crop / 2 - oy);
      g.fillStyle = g.createPattern(c, 'repeat');
      g.fillRect(ox - crop, oy - crop, crop * 3, crop * 3);
      g.restore();
    }
  // Binding: ½-inch indigo cotton around the edge.
  const ind = swatches.find(s => s.binding) || null;
  const bw = PATCH * 0.067;
  g.save();
  g.beginPath();
  g.rect(0, 0, PW, PW);
  g.rect(bw, bw, PW - 2 * bw, PW - 2 * bw);
  g.clip('evenodd');
  if (ind) {
    g.fillStyle = g.createPattern(ind.canvas, 'repeat');
  } else g.fillStyle = '#2f466f';
  g.fillRect(0, 0, PW, PW);
  g.restore();
  // Seams and quilting stitches sit in the shadow of the batting loft.
  if (cavityImg) {
    g.globalCompositeOperation = 'multiply';
    g.drawImage(cavityImg, 0, 0, PW, PW);
    g.globalCompositeOperation = 'source-over';
  }
  patchTex.needsUpdate = true;
  if (pathTracer && state.view === 'render') pathTracer.updateMaterials();
  showSwatches();
}
function showSwatches() {
  const box = $('swatches');
  if (!box) return;
  box.innerHTML = '';
  for (const s of swatches) {
    const c = document.createElement('canvas');
    c.width = c.height = 44;
    c.title = s.name;
    const g = c.getContext('2d');
    const k = Math.min(s.canvas.width, s.canvas.height, 300);
    g.drawImage(s.canvas, 0, 0, k, k, 0, 0, 44, 44);
    box.appendChild(c);
  }
}
async function useSwatches(defs) {
  swatches = await Promise.all(defs.map(prepareSwatch));
  if (quilt.w !== SIZE || quilt.l !== SIZE) setQuiltDims(SIZE, SIZE);
  buildPatchwork();
  // the bundled Trip Around the World layout has its own quilting map
  QM.top.normalMap = quiltNormal;
  QM.top.needsUpdate = true;
  state.usingDesign = false;
  if (typeof restoreBacking === 'function' && design) restoreBacking();
}

const quiltNormal = tex('assets/quilt_normal.jpg', { srgb: false });
const QM = {
  top: new THREE.MeshPhysicalMaterial({
    map: patchTex,
    normalMap: quiltNormal,
    normalScale: new THREE.Vector2(1, 1),
    roughness: 0.9,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0.3, 0.3, 0.3),
  }),
  back: new THREE.MeshPhysicalMaterial({
    map: weaveMap([10, 10]),
    normalMap: quiltNormal,
    color: 0xe7dcc4,
    roughness: 0.93,
    sheen: 1,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0.25, 0.25, 0.25),
  }),
  binding: new THREE.MeshPhysicalMaterial({
    map: weaveMap([1, 1]),
    normalMap: weaveNormal([1, 1]),
    color: 0x2f466f,
    roughness: 0.9,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0.3, 0.3, 0.35),
  }),
};

export { PW, QM, patchCanvas, useSwatches };
