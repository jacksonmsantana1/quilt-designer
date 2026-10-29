// Fabric swatches and the patchwork texture of the bundled sample quilt.
import './lighting.js';          // load order: runs after sim/lighting
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { SIZE, quilt, state } from './config.js';
import { loadImage, maxAniso, tex, weaveMap, weaveNormal } from './textures.js';
import { pathTracer } from './photo-render.js';
import { restoreBacking } from './design-maps.js';
import { setQuiltDims } from './quilt-size.js';

// ------------------------------------------------------------- quilt fabrics
// The patchwork is cut from photographs of real fabric. A 90-inch quilt of
// 12 × 12 patches (7.5 in each), arranged "Trip Around the World": every ring
// around the centre is cut from the same fabric.
const BUNDLED = [
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#efe5cf', name: 'Cream cotton' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#2f466f', name: 'Indigo cotton' },
  { src: 'assets/fabric/paisley.jpg', cm: 45, name: 'Woven paisley' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#c79a45', name: 'Mustard cotton' },
  { src: 'assets/fabric/linen.jpg', cm: 22, name: 'Red linen' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#7d8f70', name: 'Sage cotton' },
  { src: 'assets/fabric/stripe.jpg', cm: 22, name: 'Chenille stripe' },
  { src: 'assets/fabric/damask.jpg', cm: 30, name: 'Damask' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#b26a5f', name: 'Rose cotton' },
  // for medallion and sampler quilts
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#a8c8b5', name: 'Mint cotton' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#4a2c22', name: 'Chocolate cotton' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#f8f6f0', name: 'White cotton' },
  { floral: true, cm: 40, name: 'Floral print' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#9b7f78', name: 'Mocha cotton' },
  { src: 'assets/fabric/weave.jpg', cm: 22, tint: '#3f6b6b', name: 'Teal cotton' },
];
// A printed floral (white magnolias and dusky roses with leaves on a warm taupe ground), drawn once as a seamless tile.
function floralTile() {
  const N = 768, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#d6ccbb'; g.fillRect(0, 0, N, N);
  // soft mottling of the ground
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,250,240' : '150,135,115'},${0.05 + rnd() * 0.06})`; const x = rnd() * N, y = rnd() * N, r = 10 + rnd() * 40; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const wrap = (x, y, draw) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(x + dx, y + dy); draw(); g.restore(); } };
  const leaf = (a, L, col) => { g.save(); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .5, -L * .28, L, 0); g.quadraticCurveTo(L * .5, L * .28, 0, 0); g.fill();
    g.strokeStyle = 'rgba(40,60,40,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * .9, 0); g.stroke(); g.restore(); };
  const magnolia = r => { for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * Math.PI / 3 + .2); const gr = g.createLinearGradient(0, 0, 0, -r);
      gr.addColorStop(0, '#e9e2d2'); gr.addColorStop(1, '#fbfaf6'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, -r * .5, r * .32, r * .55, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(120,110,90,.35)'; g.lineWidth = 1; g.stroke(); g.restore(); }
    g.fillStyle = '#c9b56a'; g.beginPath(); g.arc(0, 0, r * .16, 0, 7); g.fill(); };
  const rose = r => { g.fillStyle = '#8a5a66'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(${200 - k * 18},${150 - k * 12},${160 - k * 12},.8)`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * (0.85 - k * .15), k, k + 4.2); g.stroke(); } };
  const motifs = [];
  for (let i = 0; i < 9; i++) motifs.push({ x: (i % 3 + rnd() * .6) * N / 3, y: (Math.floor(i / 3) + rnd() * .6) * N / 3, kind: i % 3 === 1 ? 'rose' : 'mag', r: 34 + rnd() * 22, a: rnd() * 6.28 });
  for (const m of motifs) wrap(m.x, m.y, () => { for (let k = 0; k < 4; k++) leaf(m.a + k * 1.7 + rnd() * .4, m.r * (1.5 + rnd() * .6), k % 2 ? '#7d9a7e' : '#5f7c63'); });
  for (const m of motifs) wrap(m.x, m.y, () => { g.rotate(m.a); m.kind === 'rose' ? rose(m.r * .55) : magnolia(m.r); });
  return c;
}
const PW = 2048, NP = 12, PATCH = PW / NP, PX_PER_CM = PW / 228.6;
const patchCanvas = document.createElement('canvas');
 patchCanvas.width = patchCanvas.height = PW;
shared.patchTex = new THREE.CanvasTexture(patchCanvas);
shared.patchTex.colorSpace = THREE.SRGBColorSpace;
 shared.patchTex.anisotropy = maxAniso;
let swatches = []; shared.cavityImg = null;
async function prepareSwatch(def) {
  const img = def.img || (def.floral ? floralTile() : await loadImage(def.src));
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d');
  if (def.tint) {
    // Recolour the photographed weave: multiply keeps its real texture.
    g.fillStyle = def.tint; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply'; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-over';
  } else g.drawImage(img, 0, 0);
  return { ...def, canvas: c };
}
function buildPatchwork() {
  const g = patchCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#d9cdb5'; g.fillRect(0, 0, PW, PW);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < NP; j++) for (let i = 0; i < NP; i++) {
    const ring = Math.round(Math.abs(i - 5.5) + Math.abs(j - 5.5) - 1);
    const sw = swatches[ring % swatches.length];
    if (!sw) continue;
    const c = sw.canvas, scale = PX_PER_CM / (c.width / sw.cm);   // canvas px per photo px
    const crop = PATCH / scale;                                    // photo px per patch
    const ox = crop < c.width ? rnd() * (c.width - crop) : 0;
    const oy = crop < c.height ? rnd() * (c.height - crop) : 0;
    g.save();
    g.beginPath(); g.rect(i * PATCH, j * PATCH, PATCH, PATCH); g.clip();
    g.translate(i * PATCH + PATCH / 2, j * PATCH + PATCH / 2);
    g.rotate((rnd() - 0.5) * 0.035);                               // hand-cut patches are never perfectly square
    g.scale(scale, scale);
    g.translate(-crop / 2 - ox, -crop / 2 - oy);
    g.fillStyle = g.createPattern(c, 'repeat');
    g.fillRect(ox - crop, oy - crop, crop * 3, crop * 3);
    g.restore();
  }
  // Binding: ½-inch indigo cotton around the edge.
  const ind = swatches.find(s => s.name === 'Indigo cotton') || null;
  const bw = PATCH * 0.067;
  g.save();
  g.beginPath(); g.rect(0, 0, PW, PW); g.rect(bw, bw, PW - 2 * bw, PW - 2 * bw); g.clip('evenodd');
  if (ind) { g.fillStyle = g.createPattern(ind.canvas, 'repeat'); } else g.fillStyle = '#2f466f';
  g.fillRect(0, 0, PW, PW);
  g.restore();
  // Seams and quilting stitches sit in the shadow of the batting loft.
  if (shared.cavityImg) { g.globalCompositeOperation = 'multiply'; g.drawImage(shared.cavityImg, 0, 0, PW, PW); g.globalCompositeOperation = 'source-over'; }
  shared.patchTex.needsUpdate = true;
  if (pathTracer && state.view === 'render') pathTracer.updateMaterials();
  showSwatches();
}
function showSwatches() {
  const box = $('swatches'); if (!box) return; box.innerHTML = '';
  for (const s of swatches) {
    const c = document.createElement('canvas'); c.width = c.height = 44; c.title = s.name;
    const g = c.getContext('2d'); const k = Math.min(s.canvas.width, s.canvas.height, 300);
    g.drawImage(s.canvas, 0, 0, k, k, 0, 0, 44, 44);
    box.appendChild(c);
  }
}
async function useSwatches(defs) {
  swatches = await Promise.all(defs.map(prepareSwatch));
  if (quilt.w !== SIZE || quilt.l !== SIZE) setQuiltDims(SIZE, SIZE);
  buildPatchwork();
  // the bundled Trip Around the World layout has its own quilting map
  QM.top.normalMap = quiltNormal; QM.top.needsUpdate = true; state.usingDesign = false;
  if (typeof restoreBacking === 'function' && shared.design) restoreBacking();
}

const quiltNormal = tex('assets/quilt_normal.jpg', { srgb: false });
const QM = {
  top: new THREE.MeshPhysicalMaterial({ map: shared.patchTex, normalMap: quiltNormal, normalScale: new THREE.Vector2(1, 1), roughness: 0.9,
    sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.3, 0.3, 0.3) }),
  back: new THREE.MeshPhysicalMaterial({ map: weaveMap([10, 10]), normalMap: quiltNormal, color: 0xe7dcc4, roughness: 0.93,
    sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.25, 0.25, 0.25) }),
  binding: new THREE.MeshPhysicalMaterial({ map: weaveMap([1, 1]), normalMap: weaveNormal([1, 1]), color: 0x2f466f, roughness: 0.9,
    sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.3, 0.3, 0.35) }),
};

export { BUNDLED, PW, QM, patchCanvas, prepareSwatch, useSwatches };
