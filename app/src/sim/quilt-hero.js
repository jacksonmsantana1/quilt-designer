// The quilt as the realistic picture sees it: a much finer mesh of the top with real puffs and puckers, and a colour
// image with no painted seam shadows, because there the light makes the real ones. The live preview keeps its light mesh.
import '../render/quilting.js'; // load order: runs after render/quilting
import * as THREE from 'three';
import { R } from './config.js';
import { maxAniso } from './textures.js';
import { PW, QM } from './patchwork.js';
import { BINDING_MM, paintBinding } from './design-maps.js';
import { drawQuilt } from '../render/quilt-draw.js';
import { drawQuiltingLines, quiltingOf, strokeSeams } from '../render/quilting.js';
import { quiltRelief, refineGrid, reliefNormals, softBlur } from '../render/relief.js';
import { quiltMm } from '@quilt/shared/geometry.js';

// each cell of the quilt's render grid becomes FINER × FINER cells, about 4 mm on a queen quilt
const FINER = 8,
  HR = (R - 1) * FINER + 1;
// a machine stitch and the gap to the next one
const STITCH_MM = 2.6,
  STITCH_GAP_MM = 1.4;
// how deep the valleys may be: most of the way into a thick batting, and never through to the backing
const VALLEY_SHARE = 0.85,
  VALLEY_MAX_MM = 11,
  LOWEST_SHARE = 0.12;

function canvasTexture(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// The stitching as black lines on white, read back as a mask.
function stitchMask(d, w, h, kPxPerMm, kind, dashed) {
  const g = newCanvas(w, h).getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#000';
  g.lineWidth = Math.max(1.25, 0.8 * kPxPerMm);
  if (dashed) g.setLineDash([STITCH_MM * kPxPerMm, STITCH_GAP_MM * kPxPerMm]);
  strokeSeams(g, w, h, d);
  if (kind !== 'ditch') drawQuiltingLines(g, w, h, kind, d);
  // the binding is stitched down along its inner edge
  const bw = BINDING_MM * kPxPerMm;
  g.strokeRect(bw, bw, w - 2 * bw, h - 2 * bw);
  const px = g.getImageData(0, 0, w, h).data,
    mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = px[4 * i] < 128 ? 1 : 0;
  return mask;
}

// The grid of triangles of the fine mesh, the same every time.
let fineUv = null,
  fineIndex = null;
function ensureGrid() {
  if (fineUv) return;
  fineUv = new Float32Array(HR * HR * 2);
  fineIndex = new Uint32Array(6 * (HR - 1) * (HR - 1));
  for (let j = 0, k = 0; j < HR; j++)
    for (let i = 0; i < HR; i++, k++) {
      fineUv[2 * k] = i / (HR - 1);
      fineUv[2 * k + 1] = 1 - j / (HR - 1);
    }
  let o = 0;
  for (let j = 0; j < HR - 1; j++)
    for (let i = 0; i < HR - 1; i++) {
      const a = j * HR + i,
        b = a + 1,
        d = a + HR,
        c = d + 1;
      fineIndex.set(((i + j) & 1) === 0 ? [a, c, b, a, d, c] : [a, d, b, b, d, c], o);
      o += 6;
    }
}

/**
 * The fine top of this quilt, in this shape. A long job, so it stops for breath between its steps.
 * @param {any} d the design @param {number} halfThick half the quilt's thickness, m
 * @param {ArrayLike<number>} midCoarse the mid-surface on the render grid @param {ArrayLike<number>} normalCoarse its normals
 * @param {() => Promise<void>} breathe
 * @returns {Promise<THREE.Mesh>} call its userData.dispose() when done with it
 */
async function makeHeroTop(d, halfThick, midCoarse, normalCoarse, breathe) {
  const qm = quiltMm(d),
    long = PW,
    w = qm.W >= qm.H ? long : Math.max(64, Math.round((long * qm.W) / qm.H)),
    h = qm.W >= qm.H ? Math.max(64, Math.round((long * qm.H) / qm.W)) : long,
    kPxPerMm = w / qm.W,
    mmPerPx = 1 / kPxPerMm,
    kind = quiltingOf(d);
  // colour: the fabrics, the binding and, for a quilting pattern, its thread (stitches in the ditch hide in the seam)
  const colour = newCanvas(w, h),
    g = colour.getContext('2d');
  drawQuilt(g, w, h, { design: d });
  if (kind !== 'ditch') {
    g.save();
    g.strokeStyle = 'rgba(250,246,235,.6)';
    g.lineWidth = Math.max(1, 0.6 * kPxPerMm);
    g.setLineDash([STITCH_MM * kPxPerMm, STITCH_GAP_MM * kPxPerMm]);
    drawQuiltingLines(g, w, h, kind, d);
    g.restore();
  }
  paintBinding(g, w, h, d);
  await breathe();
  // shape: the broad part goes into the mesh and the crisp rest into the normal map, so nothing is lit twice
  const faceMm = halfThick * 1000,
    depth = Math.min(VALLEY_MAX_MM, VALLEY_SHARE * faceMm),
    solid = stitchMask(d, w, h, kPxPerMm, kind, false),
    thread = stitchMask(d, w, h, kPxPerMm, kind, true);
  await breathe();
  const height = quiltRelief(solid, w, h, { mmPerPx, depth, thread });
  await breathe();
  const broad = softBlur(height, w, h, Math.max(1, Math.round(1.8 * kPxPerMm))),
    crisp = new Float32Array(w * h);
  for (let i = 0; i < crisp.length; i++) crisp[i] = height[i] - broad[i];
  await breathe();
  const relief = newCanvas(w, h);
  relief.getContext('2d').putImageData(new ImageData(reliefNormals(crisp, w, h, mmPerPx), w, h), 0, 0);
  await breathe();
  // the fine mesh: the smooth shape of the quilt, raised at each point by the broad height there
  ensureGrid();
  const mid = refineGrid(midCoarse, R, FINER, 3),
    normal = refineGrid(normalCoarse, R, FINER, 3),
    pos = new Float32Array(HR * HR * 3);
  for (let j = 0, k = 0; j < HR; j++) {
    const y = (j / (HR - 1)) * (h - 1),
      y0 = Math.floor(y),
      y1 = Math.min(h - 1, y0 + 1),
      fy = y - y0;
    for (let i = 0; i < HR; i++, k++) {
      const x = (i / (HR - 1)) * (w - 1),
        x0 = Math.floor(x),
        x1 = Math.min(w - 1, x0 + 1),
        fx = x - x0,
        above = broad[y0 * w + x0] * (1 - fx) + broad[y0 * w + x1] * fx,
        below = broad[y1 * w + x0] * (1 - fx) + broad[y1 * w + x1] * fx,
        rise = above * (1 - fy) + below * fy,
        nx = normal[3 * k],
        ny = normal[3 * k + 1],
        nz = normal[3 * k + 2],
        s = 1 / (Math.hypot(nx, ny, nz) || 1),
        up = Math.max(LOWEST_SHARE * faceMm, faceMm + rise) / 1000; // above the quilt's mid-surface, m
      pos[3 * k] = mid[3 * k] + nx * s * up;
      pos[3 * k + 1] = mid[3 * k + 1] + ny * s * up;
      pos[3 * k + 2] = mid[3 * k + 2] + nz * s * up;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(fineUv, 2));
  geo.setIndex(new THREE.BufferAttribute(fineIndex, 1));
  geo.computeVertexNormals();
  const material = QM.top.clone();
  material.map = canvasTexture(colour, true);
  material.normalMap = canvasTexture(relief, false);
  material.normalScale = new THREE.Vector2(1, 1);
  // cotton has only a faint sheen: more would lay a grey veil over the dark fabrics
  material.sheenColor = new THREE.Color(0.1, 0.1, 0.1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.dispose = () => {
    geo.dispose();
    material.map.dispose();
    material.normalMap.dispose();
    material.dispose();
  };
  return mesh;
}

export { makeHeroTop };
