// Engineering view: strain, curvature and clearance fields drawn on the quilt.
import './camera.js';          // load order: runs after sim/camera
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { N, R, WOOD_PARTS, bedM, isTableSim, quilt, state } from './config.js';
import { scene } from './renderer.js';
import { colliderMeshes, legs, roundedBoxGeometry } from './stage.js';
import { applyLook } from './lighting.js';
import { QM } from './patchwork.js';
import { qGeo, quiltBind, quiltBot, quiltTop, simPos, subdivide } from './quilt-mesh.js';

  // ------------------------------------------------------------- analysis view
// CAD/FEA-style post-processing of the solved shape: banded contour fields
// on the quilt, the simulation mesh overlaid, a neutral grey workspace with
// outlined parts and a floor grid, and drape measurements.

const MAT = { top: ClothSim.surfaceTop(bedM()), headFace: isTableSim() ? -bedM().l / 2 : -bedM().l / 2 - 0.055 };
const FIELDS = {
  strain:    { label: 'Membrane strain', unit: '%', fmt: v => v.toFixed(2), note: 'Stretch of the fabric relative to its flat, unloaded size.' },
  curvature: { label: 'Curvature κ', unit: '1/m', fmt: v => v.toFixed(1), note: 'κ = 1/R. Red marks folds and the tightest bends.' },
  clearance: { label: 'Gap to bed or floor', unit: 'mm', fmt: v => v.toFixed(0), note: 'Blue is touching (≤ 1 mm). Red is hanging free.' },
  height:    { label: 'Height above floor', unit: 'm', fmt: v => v.toFixed(2), note: 'Mattress top is at 0.62 m.' },
};
const BANDS = 10;
const easeIO = u => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(u, 0), 1));
const analysis = { on: false, field: 'strain', mesh: true, auto: true, autoDone: false, anim: null, range: null, legendKey: '', fields: null };

// FEA "rainbow" contour scale in 10 equal bands, blue (low) → red (high).
const bandCss = [], bandData = new Uint8Array(BANDS * 4);
for (let k = 0; k < BANDS; k++) {
  const c = new THREE.Color().setHSL((240 - 240 * (k + 0.5) / BANDS) / 360, 0.88, 0.5);
  bandData.set([c.r * 255, c.g * 255, c.b * 255, 255], 4 * k);
  bandCss.push('#' + c.getHexString());
}
const bandTex = new THREE.DataTexture(bandData, BANDS, 1, THREE.RGBAFormat);
bandTex.magFilter = bandTex.minFilter = THREE.NearestFilter;
bandTex.colorSpace = THREE.SRGBColorSpace;
bandTex.needsUpdate = true;

// Result surface shares the quilt's positions, normals and triangles.
const aUv = new Float32Array(R * R * 2);
const aGeo = new THREE.BufferGeometry();
aGeo.setAttribute('position', qGeo.attributes.position);
aGeo.setAttribute('uv', new THREE.BufferAttribute(aUv, 2).setUsage(THREE.DynamicDrawUsage));
aGeo.setIndex(qGeo.index);
const aClip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);   // keeps z ≤ constant
const photoClip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 100); // keeps z ≥ −constant
QM.top.clippingPlanes = QM.back.clippingPlanes = QM.binding.clippingPlanes = [photoClip];
const aMat = new THREE.MeshLambertMaterial({ map: bandTex, side: THREE.DoubleSide, clippingPlanes: [aClip],
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const aMesh = new THREE.Mesh(aGeo, aMat);
aMesh.frustumCulled = false;
 aMesh.visible = false;
 aMesh.castShadow = true;
 aMesh.receiveShadow = true;
scene.add(aMesh);

// Simulation mesh overlay (the actual 40 × 40 nodes, lifted 2 mm off the surface).
const wireIdx = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const a = j * N + i;
  if (i + 1 < N) wireIdx.push(a, a + 1);
  if (j + 1 < N) wireIdx.push(a, a + N);
}
const wirePos = new Float32Array(wireIdx.length * 3);
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3).setUsage(THREE.DynamicDrawUsage));
const meshLines = new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({ color: 0x121821, transparent: true, opacity: 0 }));
meshLines.frustumCulled = false;
 meshLines.visible = false;
 scene.add(meshLines);

// Scan sheet that sweeps head → foot while the result is revealed.
const scan = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5), new THREE.MeshBasicMaterial({
  color: 0x3fc3ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scan.position.y = 0.72;
 scan.visible = false;
 scene.add(scan);
const scanEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.012), new THREE.MeshBasicMaterial({
  color: 0x9fe6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scanEdge.position.y = 0.75;
 scan.add(scanEdge);

// Engineering workspace.
const engBgCanvas = document.createElement('canvas');
 engBgCanvas.width = 4;
 engBgCanvas.height = 256;
{ const g = engBgCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#b9c0ca'); gr.addColorStop(1, '#eceef2'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }
const engBg = new THREE.CanvasTexture(engBgCanvas);
 engBg.colorSpace = THREE.SRGBColorSpace;
const engFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 1 }));
engFloor.rotation.x = -Math.PI / 2;
 engFloor.receiveShadow = true;
 engFloor.visible = false;
 scene.add(engFloor);
const gridMinor = new THREE.GridHelper(6, 60, 0xc3c9d1, 0xc3c9d1);
 gridMinor.position.y = 0.001;
const gridMajor = new THREE.GridHelper(6, 6, 0x7d8796, 0x7d8796);
 gridMajor.position.y = 0.002;
for (const g of [gridMinor, gridMajor]) { g.visible = false; scene.add(g); }
const greyMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.7 });
const greyLight = new THREE.MeshStandardMaterial({ color: 0xcfd4db, roughness: 0.8 });
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1f27, side: THREE.BackSide });
const outlines = [];
const origMats = new Map();
function buildBedExtras() {
  for (const o of outlines) { scene.remove(o); o.geometry.dispose(); }
  outlines.length = 0;
  for (const b of ClothSim.bedColliders(bedM())) {
    if (b.dup) continue;
    const e = 0.007;
    const o = new THREE.Mesh(roundedBoxGeometry([b.h[0] + e, b.h[1] + e, b.h[2] + e], b.r + e, 4, 5), outlineMat);
    o.position.set(...b.c); o.visible = false; o.userData.name = b.name; scene.add(o);
    outlines.push(o);
  }
  origMats.clear();
  for (const mesh of [...Object.values(colliderMeshes), ...legs]) origMats.set(mesh, mesh.material);
}
buildBedExtras();
function setEngineering(on) {
  engFloor.visible = gridMinor.visible = gridMajor.visible = on;
  for (const [name, mesh] of Object.entries(colliderMeshes))
    mesh.material = on ? (WOOD_PARTS(name) ? greyMat : greyLight) : origMats.get(mesh);
  for (const l of legs) l.material = on ? greyMat : origMats.get(l);
  const pillowsOn = $('pillows').checked;
  for (const o of outlines) o.visible = on && (!o.userData.name.startsWith('pillow') || pillowsOn);
  applyLook();
}

// Scalar fields at the simulation nodes.
const F = { strain: new Float32Array(N * N), curvature: new Float32Array(N * N), clearance: new Float32Array(N * N), height: new Float32Array(N * N) };
const fieldR = new Float32Array(R * R), sdfN = new Float64Array(3);
shared.colliders = ClothSim.bedColliders(bedM());
const sortedCopy = a => Float32Array.from(a).sort();
const quant = (s, q) => s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
function computeFields() {
  const p = simPos, hx = quilt.w / (N - 1), hy = quilt.l / (N - 1), h = Math.sqrt(hx * hy), t = state.params.thickness / 2, pillowsOn = $('pillows').checked;
  const P = (i, j, d) => p[3 * (j * N + i) + d];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = P(i, j, 0), y = P(i, j, 1), z = P(i, j, 2);
    // strain: mean engineering strain of the grid edges meeting at this node
    let s = 0, n = 0;
    if (i > 0) { s += Math.hypot(x - P(i - 1, j, 0), y - P(i - 1, j, 1), z - P(i - 1, j, 2)) / hx - 1; n++; }
    if (i < N - 1) { s += Math.hypot(x - P(i + 1, j, 0), y - P(i + 1, j, 1), z - P(i + 1, j, 2)) / hx - 1; n++; }
    if (j > 0) { s += Math.hypot(x - P(i, j - 1, 0), y - P(i, j - 1, 1), z - P(i, j - 1, 2)) / hy - 1; n++; }
    if (j < N - 1) { s += Math.hypot(x - P(i, j + 1, 0), y - P(i, j + 1, 1), z - P(i, j + 1, 2)) / hy - 1; n++; }
    F.strain[k] = 100 * s / n;
    // curvature: |Δx| on the grid (for a cylinder of radius R this is 1/R)
    const ic = Math.min(N - 2, Math.max(1, i)), jc = Math.min(N - 2, Math.max(1, j));
    let l2 = 0;
    for (let d = 0; d < 3; d++) {
      const lap = (P(ic + 1, jc, d) + P(ic - 1, jc, d) + P(ic, jc + 1, d) + P(ic, jc - 1, d) - 4 * P(ic, jc, d)) / (h * h);
      l2 += lap * lap;
    }
    F.curvature[k] = Math.sqrt(l2);
    // clearance: signed distance to the nearest surface, minus half the quilt thickness
    let dmin = y;
    for (const c of shared.colliders) {
      if (!pillowsOn && c.name.startsWith('pillow')) continue;
      dmin = Math.min(dmin, ClothSim.roundedBoxSDF(x, y, z, c, sdfN));
    }
    F.clearance[k] = Math.max(0, (dmin - t) * 1000);
    F.height[k] = y;
  }
}
function rangeFor(name, sorted) {
  const last = sorted[sorted.length - 1];
  if (name === 'strain') return { lo: Math.min(0, quant(sorted, 0.02)), hi: Math.max(quant(sorted, 0.98), 0.05) };
  if (name === 'curvature') return { lo: 0, hi: Math.max(quant(sorted, 0.98), 1) };
  if (name === 'clearance') return { lo: 0, hi: 50 };
  return { lo: 0, hi: Math.max(last, 0.1) };
}
function computeAnalysis() {
  if (!shared.havePos) return;
  computeFields();
  analysis.fields = F;
  if (!analysis.on) return;
  const sorted = sortedCopy(F[analysis.field]);
  const r = rangeFor(analysis.field, sorted);
  analysis.range = r;
  subdivide(F[analysis.field], fieldR, 1);
  const span = r.hi - r.lo || 1;
  for (let k = 0; k < R * R; k++) {
    aUv[2 * k] = Math.min(0.9999, Math.max(0, (fieldR[k] - r.lo) / span));
    aUv[2 * k + 1] = 0.5;
  }
  aGeo.attributes.uv.needsUpdate = true;
  // mesh overlay lifted along the render normals
  const nrm = qGeo.attributes.normal && qGeo.attributes.normal.array;
  for (let e = 0; e < wireIdx.length; e++) {
    const s = wireIdx[e], i = s % N, j = (s / N) | 0, rk = 3 * ((2 * j) * R + 2 * i);
    for (let d = 0; d < 3; d++) wirePos[3 * e + d] = simPos[3 * s + d] + (nrm ? nrm[rk + d] * 0.002 : 0);
  }
  wGeo.attributes.position.needsUpdate = true;
  renderLegend();
}
function renderLegend() {
  const f = FIELDS[analysis.field], r = analysis.range;
  if (!r) return;
  const labels = [];
  for (let k = 0; k <= BANDS; k++) labels.push(f.fmt(r.lo + (r.hi - r.lo) * k / BANDS));
  const key = analysis.field + labels.join('|');
  if (key === analysis.legendKey) return;
  analysis.legendKey = key;
  $('lg-title').textContent = `${f.label} (${f.unit})`;
  let html = '';
  for (let k = BANDS - 1; k >= 0; k--)
    html += `<div class="lg-row"><i style="background:${bandCss[k]}"></i><span>${(k + 1) % 2 === 0 ? labels[k + 1] : ''}</span></div>`;
  html += `<div class="lg-row lg-end"><span>${labels[0]}</span></div>`;
  $('lg-bar').innerHTML = html;
  $('lg-note').textContent = f.note;
}

function setAnalysis(on) {
  if (analysis.on === on) return;
  analysis.on = on;
    $('legend3d').hidden = !on;
  $('hint').hidden = on;
  analysis.legendKey = '';
  setEngineering(on);
  analysis.anim = on ? 0 : null;
  if (on) computeAnalysis();
}
// Called every frame: drives the head-to-foot reveal and the overlay fade.
function stepAnalysis(dt) {
  const on = analysis.on && shared.havePos;
  let s = 100, u = 1;
  if (on && analysis.anim !== null) {
    analysis.anim += dt / 1.3;
    if (analysis.anim >= 1) analysis.anim = null;
    else { u = analysis.anim; s = -1.3 + 3.05 * easeIO(u); }
  }
  const sweeping = on && analysis.anim !== null;
  aClip.constant = s;                       // result visible where z ≤ s
  photoClip.constant = on ? -s : 100;       // photoreal visible where z ≥ s
  aMesh.visible = on;
  if (on && !sweeping) quiltTop.visible = quiltBot.visible = quiltBind.visible = false;
  scan.visible = sweeping; scan.position.z = s;
  meshLines.visible = on && analysis.mesh;
  meshLines.material.opacity = sweeping ? 0.42 * Math.max(0, (u - 0.6) / 0.4) : 0.42;
}
function fmtCm(v) { return (v * 100).toFixed(1) + ' cm'; }
function analysisOnStats(s) {
  if (!analysis.fields) return;
  const p = simPos, T = state.params.thickness / 2;
  let minL = 9, minR = 9, minF = 9, minAll = 9, headZ = 0;
  for (let k = 0; k < N; k++) {
    const yl = p[3 * (k * N) + 1], yr = p[3 * (k * N + N - 1) + 1];
    const yf = p[3 * ((N - 1) * N + k) + 1], yh = p[3 * k + 1];
    minL = Math.min(minL, yl); minR = Math.min(minR, yr); minF = Math.min(minF, yf);
    minAll = Math.min(minAll, yl, yr, yf, yh);
    headZ += p[3 * k + 2];
  }
  headZ /= N;
  const drop = y => Math.max(0, MAT.top - y);
  $('r-dl').textContent = fmtCm(drop(minL));
  $('r-dr').textContent = fmtCm(drop(minR));
  $('r-df').textContent = fmtCm(drop(minF));
  $('r-head').textContent = fmtCm(headZ - MAT.headFace);
  $('r-hem').textContent = minAll - T < 0.002 ? 'on the floor' : fmtCm(minAll - T);
  let touch = 0; for (const g of F.clearance) if (g <= 1) touch++;
  $('r-touch').textContent = (100 * touch / F.clearance.length).toFixed(0) + ' %';
  const ss = sortedCopy(F.strain);
  $('r-strain').textContent = `${quant(ss, 0.98).toFixed(2)} % · max ${ss[ss.length - 1].toFixed(2)} %`;
  const kc = quant(sortedCopy(F.curvature), 0.99);
  $('r-fold').textContent = kc > 0.5 ? `${(100 / kc).toFixed(1)} cm` : 'flat';
}

export { MAT, aGeo, analysis, analysisOnStats, buildBedExtras, computeAnalysis, engBg, setAnalysis, setEngineering, stepAnalysis };
