// The quilt mesh: top, back and binding, upsampled from the physics grid.
import './patchwork.js';          // load order: runs after sim/patchwork
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { N, R, quilt, state } from './config.js';
import { scene } from './renderer.js';
import { QM } from './patchwork.js';
import { aGeo } from './analysis.js';

// ------------------------------------------------------------- quilt geometry
// Mid-surface (what the simulation solves) on a subdivided render grid.
const qGeo = new THREE.BufferGeometry();
const qPos = new Float32Array(R * R * 3), qUv = new Float32Array(R * R * 2), qIdx = [], qIdxRev = [];
for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
  qUv[2 * (j * R + i)] = i / (R - 1); qUv[2 * (j * R + i) + 1] = 1 - j / (R - 1);
}
for (let j = 0; j < R - 1; j++) for (let i = 0; i < R - 1; i++) {
  const a = j * R + i, b = a + 1, d = a + R, c = d + 1;
  if (((i + j) & 1) === 0) { qIdx.push(a, c, b, a, d, c); qIdxRev.push(a, b, c, a, c, d); }
  else { qIdx.push(a, d, b, b, d, c); qIdxRev.push(a, b, d, b, c, d); }
}
qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3).setUsage(THREE.DynamicDrawUsage));
qGeo.setAttribute('uv', new THREE.BufferAttribute(qUv, 2));
qGeo.setIndex(qIdx);

// The quilt has real thickness: a top, a backing, and a rounded binding that
// joins them. Its faces sit ±t/2 from the mid-surface, which is exactly the
// contact offset the physics uses, so the backing touches the mattress.
function dynGeo(nVerts, index, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nVerts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}
const topGeo = dynGeo(R * R, qIdx, qUv), botGeo = dynGeo(R * R, qIdxRev, qUv);
const perim = [];
for (let i = 0; i < R; i++) perim.push([i, 0]);
for (let j = 1; j < R; j++) perim.push([R - 1, j]);
for (let i = R - 2; i >= 0; i--) perim.push([i, R - 1]);
for (let j = R - 2; j > 0; j--) perim.push([0, j]);
const PL = perim.length, PROF = 7;
const bindIdx = [], bindUv = new Float32Array(PL * PROF * 2);
for (let k = 0; k < PL; k++) {
  const k2 = (k + 1) % PL;
  for (let s = 0; s < PROF - 1; s++) {
    const a = k * PROF + s, b = k2 * PROF + s;
    bindIdx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  for (let s = 0; s < PROF; s++) bindUv[2 * (k * PROF + s) + 1] = s / (PROF - 1);
}
const bindGeo = dynGeo(PL * PROF, bindIdx, bindUv);
function updateBindUv() {
  // weave repeats every 6 cm along the binding, whatever the quilt's size
  let along = 0;
  for (let k = 0; k < PL; k++) {
    if (k) { const [i0, j0] = perim[k - 1], [i1, j1] = perim[k]; along += Math.abs(i1 - i0) * quilt.w / (R - 1) + Math.abs(j1 - j0) * quilt.l / (R - 1); }
    for (let s = 0; s < PROF; s++) bindUv[2 * (k * PROF + s)] = along / 0.06;
  }
  bindGeo.attributes.uv.needsUpdate = true;
}
updateBindUv();
const quiltTop = new THREE.Mesh(topGeo, QM.top);
const quiltBot = new THREE.Mesh(botGeo, QM.back);
const quiltBind = new THREE.Mesh(bindGeo, QM.binding);
for (const m of [quiltTop, quiltBot, quiltBind]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.visible = false; scene.add(m); }

function subdivide(src, dst, k) {
  const g = (i, j, d) => {
    if (i < 0) return 2 * g(0, j, d) - g(1, j, d);
    if (i >= N) return 2 * g(N - 1, j, d) - g(N - 2, j, d);
    return src[k * (j * N + i) + d];
  };
  for (let j = 0; j < N; j++) {
    const rj = 2 * j;
    for (let i = 0; i < N; i++) for (let d = 0; d < k; d++) dst[k * (rj * R + 2 * i) + d] = src[k * (j * N + i) + d];
    for (let i = 0; i < N - 1; i++) for (let d = 0; d < k; d++)
      dst[k * (rj * R + 2 * i + 1) + d] = (-g(i - 1, j, d) + 9 * g(i, j, d) + 9 * g(i + 1, j, d) - g(i + 2, j, d)) / 16;
  }
  const G = (ri, rj, d) => {
    if (rj < 0) return 2 * G(ri, 0, d) - G(ri, 2, d);
    if (rj > R - 1) return 2 * G(ri, R - 1, d) - G(ri, R - 3, d);
    return dst[k * (rj * R + ri) + d];
  };
  for (let j = 0; j < N - 1; j++) {
    const rj = 2 * j + 1;
    for (let ri = 0; ri < R; ri++) for (let d = 0; d < k; d++)
      dst[k * (rj * R + ri) + d] = (-G(ri, rj - 3, d) + 9 * G(ri, rj - 1, d) + 9 * G(ri, rj + 1, d) - G(ri, rj + 3, d)) / 16;
  }
}
const simPos = new Float32Array(N * N * 3);
shared.havePos = false;
function upsample() {
  subdivide(simPos, qPos, 3);
  qGeo.attributes.position.needsUpdate = true;
  qGeo.computeVertexNormals();
  if (!aGeo.attributes.normal) aGeo.setAttribute('normal', qGeo.attributes.normal);
  const n = qGeo.attributes.normal.array, h = Math.max(0.003, state.params.thickness) / 2;
  const tp = topGeo.attributes.position.array, bp = botGeo.attributes.position.array;
  for (let k = 0; k < R * R * 3; k++) { tp[k] = qPos[k] + n[k] * h; bp[k] = qPos[k] - n[k] * h; }
  // binding: half-round profile from the top face, out past the edge, to the backing
  const bpos = bindGeo.attributes.position.array;
  for (let k = 0; k < PL; k++) {
    const [i, j] = perim[k], v = j * R + i;
    const ii = i === 0 ? 1 : i === R - 1 ? R - 2 : i, jj = j === 0 ? 1 : j === R - 1 ? R - 2 : j, w = jj * R + ii;
    let ox = qPos[3 * v] - qPos[3 * w], oy = qPos[3 * v + 1] - qPos[3 * w + 1], oz = qPos[3 * v + 2] - qPos[3 * w + 2];
    const nx = n[3 * v], ny = n[3 * v + 1], nz = n[3 * v + 2], dn = ox * nx + oy * ny + oz * nz;
    ox -= dn * nx; oy -= dn * ny; oz -= dn * nz;
    const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
    for (let s = 0; s < PROF; s++) {
      const th = Math.PI * s / (PROF - 1), c = Math.cos(th) * h, sn = Math.sin(th) * h * 0.8, o = 3 * (k * PROF + s);
      bpos[o] = qPos[3 * v] + nx * c + ox * sn;
      bpos[o + 1] = qPos[3 * v + 1] + ny * c + oy * sn;
      bpos[o + 2] = qPos[3 * v + 2] + nz * c + oz * sn;
    }
  }
  for (const g of [topGeo, botGeo, bindGeo]) { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); }
}

const handMat = new THREE.MeshStandardMaterial({ color: 0xd9a37e, roughness: 0.6 });
const handMeshes = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), handMat);
  m.castShadow = true; m.visible = false; scene.add(m); return m;
});

export { handMeshes, qGeo, quiltBind, quiltBot, quiltTop, simPos, subdivide, updateBindUv, upsample };
