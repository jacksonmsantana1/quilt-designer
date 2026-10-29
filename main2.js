import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const $ = id => document.getElementById(id);
const N = 40;                       // simulation grid (N × N nodes)
const R = 2 * (N - 1) + 1;          // render grid after 4-point subdivision
const SIZE = 2.29;                  // default: 90-inch queen quilt, metres
const quilt = { w: SIZE, l: SIZE };  // current quilt width (across the bed) and length, metres

// Standard mattress sizes (width × length, mm). Brazil first, then the US sizes most quilt patterns use.
const BEDS = [
  { key: 'br-solteiro',  group: 'Brazil', label: 'Solteiro', w: 880,  l: 1880 },
  { key: 'br-solteirao', group: 'Brazil', label: 'Solteirão', w: 960, l: 2030 },
  { key: 'br-casal',     group: 'Brazil', label: 'Casal padrão', w: 1380, l: 1880 },
  { key: 'br-queen',     group: 'Brazil', label: 'Queen', w: 1580, l: 1980 },
  { key: 'br-king',      group: 'Brazil', label: 'King', w: 1930, l: 2030 },
  { key: 'us-twin',      group: 'United States', label: 'Twin', w: 965, l: 1905 },
  { key: 'us-twinxl',    group: 'United States', label: 'Twin XL', w: 965, l: 2030 },
  { key: 'us-full',      group: 'United States', label: 'Full / Double', w: 1370, l: 1905 },
  { key: 'us-queen',     group: 'United States', label: 'Queen', w: 1525, l: 2030 },
  { key: 'us-king',      group: 'United States', label: 'King', w: 1930, l: 2030 },
  { key: 'us-calking',   group: 'United States', label: 'California King', w: 1830, l: 2135 },
  // tables (top width × length, mm; h = height of the top from the floor)
  { key: 'tb-square4',   group: 'Tables', kind: 'table', label: 'Square table, 4 seats', w: 900, l: 900, h: 750 },
  { key: 'tb-rect4',     group: 'Tables', kind: 'table', label: 'Rectangular table, 4 seats', w: 800, l: 1200, h: 750 },
  { key: 'tb-rect6',     group: 'Tables', kind: 'table', label: 'Rectangular table, 6 seats', w: 900, l: 1800, h: 750 },
  { key: 'tb-rect8',     group: 'Tables', kind: 'table', label: 'Rectangular table, 8 seats', w: 1000, l: 2400, h: 750 },
  { key: 'tb-coffee',    group: 'Tables', kind: 'table', label: 'Coffee table', w: 600, l: 1200, h: 450 },
];
const BED_KEY = 'quilt-bed.v1';
// Cutting guide: the cutting-list line being hovered (A1.1, AS.1, CB2.1 ...) as a test on each drawn piece;
// matching pieces stay bright, all others dim. null = nothing hovered.
let fabHi = null;
const FAB_DIM = 'rgba(236,239,244,.8)';
function dimUnlessHi(g, info) { if (fabHi && !fabHi(info)) { const f = g.fillStyle; g.fillStyle = FAB_DIM; g.fill(); g.fillStyle = f; } }
const bedState = { key: 'us-queen', kind: 'bed', w: 1525, l: 2030, h: 750, drop: 300, tuck: true };
try { Object.assign(bedState, JSON.parse(localStorage.getItem(BED_KEY) || '{}')); } catch (e) {}
const isTableSim = () => bedState.kind === 'table';
const bedM = () => (isTableSim() ? { kind: 'table', w: bedState.w / 1000, l: bedState.l / 1000, h: bedState.h / 1000 } : { w: bedState.w / 1000, l: bedState.l / 1000 });
const bedName = () => { const b = BEDS.find(x => x.key === bedState.key); return b ? (b.kind === 'table' ? b.label.toLowerCase() : `${b.group === 'Brazil' ? 'Brazilian' : 'US'} ${b.label.toLowerCase()} bed`) : isTableSim() ? 'custom table' : 'custom bed'; };
const WOOD_PARTS = n => n === 'frame' || n === 'headboard' || n === 'tabletop' || n.startsWith('leg');

const PRESETS = {
  cotton: { rhoA: 0.50, E: 3000, G: 60, B: 3e-4,   muS: 0.60, muK: 0.50, Cd: 1.2, zeta: 0.05, thickness: 0.020 },
  down:   { rhoA: 0.40, E: 2000, G: 40, B: 1.2e-3, muS: 0.45, muK: 0.38, Cd: 1.3, zeta: 0.08, thickness: 0.040 },
  wool:   { rhoA: 0.75, E: 1500, G: 30, B: 8e-5,   muS: 0.70, muK: 0.60, Cd: 1.2, zeta: 0.05, thickness: 0.008 },
  silk:   { rhoA: 0.12, E: 1000, G: 10, B: 3e-6,   muS: 0.30, muK: 0.25, Cd: 1.2, zeta: 0.04, thickness: 0.002 },
};
const PARAMS = [
  { key: 'rhoA', label: 'Areal density ρA', unit: 'kg/m²', min: 0.08, max: 1.2, scale: 'lin', fmt: v => v.toFixed(2) },
  { key: 'E', label: 'Tensile stiffness E', unit: 'N/m', min: 300, max: 30000, scale: 'log', fmt: v => v.toFixed(0) },
  { key: 'G', label: 'Shear stiffness G', unit: 'N/m', min: 3, max: 300, scale: 'log', fmt: v => v.toFixed(0) },
  { key: 'B', label: 'Bending rigidity B', unit: 'N·m', min: 1e-6, max: 1e-2, scale: 'log', fmt: v => v.toExponential(1) },
  { key: 'muS', label: 'Static friction μs', unit: '', min: 0, max: 1.2, scale: 'lin', fmt: v => v.toFixed(2) },
  { key: 'muK', label: 'Kinetic friction μk', unit: '', min: 0, max: 1.2, scale: 'lin', fmt: v => v.toFixed(2), note: 'Capped at μs inside the solver.' },
  { key: 'Cd', label: 'Drag coefficient Cd', unit: '', min: 0, max: 2, scale: 'lin', fmt: v => v.toFixed(2) },
  { key: 'zeta', label: 'Internal damping ratio ζ', unit: '', min: 0, max: 0.3, scale: 'lin', fmt: v => v.toFixed(2) },
  { key: 'thickness', label: 'Thickness', unit: 'mm', min: 0.002, max: 0.05, scale: 'lin', fmt: v => (v * 1000).toFixed(0) },
];
const SUBSTEPS = [10, 20, 40];
const state = {
  params: { ...PRESETS.cotton }, scenario: 'drop', dropHeight: 0.5, running: true,
  substeps: 20, mode: 'orbit', lastStats: null, history: [], view: 'photo', atRest: 'none', photoCm: 25, page: 'design'
};

// ------------------------------------------------------------- simulation
const physSrc = $('physics-src').textContent;
let port = null;
function localPort() {
  // Fallback when Web Workers are unavailable: run on the page's own thread.
  const main = { onmessage: null }, simSide = { onmessage: null };
  simSide.postMessage = (d) => setTimeout(() => main.onmessage && main.onmessage({ data: d }), 0);
  main.postMessage = (d) => setTimeout(() => simSide.onmessage && simSide.onmessage({ data: d }), 0);
  ClothSim.serve(simSide);
  return main;
}
function startSim() {
  try {
    const url = URL.createObjectURL(new Blob([physSrc + '\nClothSim.serve(self);'], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onerror = (e) => { e.preventDefault && e.preventDefault(); if (port === w) { port = localPort(); connect(); } };
    port = w;
  } catch (e) { port = localPort(); }
  connect();
}
function connect() {
  port.onmessage = onSim;
  port.postMessage({ type: 'init', opt: { n: N, scenario: state.scenario, params: state.params, substeps: state.substeps, bed: bedM(), width: quilt.w, length: quilt.l } });
  port.postMessage({ type: 'reset', scenario: state.scenario, dropHeight: state.dropHeight, rot: quiltTurned, pos: dropPosM() });
}
const send = m => port && port.postMessage(m);
// the quilt can be turned a quarter turn on the bed or table before it is dropped (remembered in this browser)
let quiltTurned = false; try { quiltTurned = localStorage.getItem('quilt-turned.v1') === '1'; } catch (e) {}
// where the quilt's centre is dropped along the long side of the bed or table, mm from its centre (null = the usual spot)
let dropPos = null;
const dropPosM = () => (dropPos == null ? null : dropPos / 1000);

// ------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
const IS_PHONE = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_PHONE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
RectAreaLightUniformsLib.init();
const scene = new THREE.Scene();
const camera = new PhysicalCamera(38, 16 / 10, 0.05, 50);
camera.bokehSize = 0;                     // depth of field off until asked for
camera.apertureBlades = 6;

// Raster key light: gives the live preview its shadows. The path tracer uses
// the area lights and the HDRI instead, so this one is switched off there.
const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 14 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun);

// ------------------------------------------------------------- textures
const texLoader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(url, { srgb = true, repeat = null } = {}) {
  const t = texLoader.load(url, () => { if (pathTracer && state.view === 'render') pathTracer.updateMaterials(); });
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const loadImage = src => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = src; });

// Real photographed surfaces.
const weaveMap = rep => tex('assets/fabric/weave.jpg', { repeat: rep });
const weaveNormal = rep => tex('assets/weave_normal.jpg', { srgb: false, repeat: rep });
const woodRep = (a, b) => ({
  map: tex('assets/wood_color.jpg', { repeat: [a, b] }),
  roughnessMap: tex('assets/wood_rough.jpg', { srgb: false, repeat: [a, b] }),
  normalMap: tex('assets/wood_normal.jpg', { srgb: false, repeat: [a, b] }),
});

const M = {
  floor: new THREE.MeshPhysicalMaterial({ ...woodRep(10 / 1.68, 10 / 0.84), roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.35, normalScale: new THREE.Vector2(0.6, 0.6) }),
  wood: new THREE.MeshPhysicalMaterial({ ...woodRep(1.2, 0.6), color: 0x8a5b3c, roughness: 1, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  sheet: new THREE.MeshPhysicalMaterial({ map: weaveMap([6, 8]), normalMap: weaveNormal([6, 8]), color: 0xf1efe9, roughness: 0.95, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.35, 0.35, 0.35) }),
  pillow: new THREE.MeshPhysicalMaterial({ map: weaveMap([3, 2]), normalMap: weaveNormal([3, 2]), color: 0xf6f3ec, roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.4, 0.4, 0.4) }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd8d0c3, roughness: 0.96 }),
  rug: new THREE.MeshPhysicalMaterial({ map: weaveMap([8, 6]), normalMap: weaveNormal([8, 6]), color: 0x6f7f74, roughness: 1, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0.25, 0.28, 0.26) }),
  cyc: new THREE.MeshStandardMaterial({ color: 0xdcdad6, roughness: 0.92 }),
};

// ------------------------------------------------------------- stages
function roundedBoxGeometry(h, r, segFlat = 6, segRound = 6) {
  const n = segFlat + 2 * segRound;
  const geo = new THREE.BoxGeometry(2 * h[0], 2 * h[1], 2 * h[2], n, n, n);
  const p = geo.attributes.position;
  const remap = (u, hh) => {
    const f = (u + hh) / (2 * hh) * n;
    if (f <= segRound) return -hh + r * (f / segRound);
    if (f >= n - segRound) return hh - r * ((n - f) / segRound);
    return -hh + r + (2 * hh - 2 * r) * ((f - segRound) / segFlat);
  };
  for (let i = 0; i < p.count; i++) {
    const x = remap(p.getX(i), h[0]), y = remap(p.getY(i), h[1]), z = remap(p.getZ(i), h[2]);
    const ix = Math.max(-h[0] + r, Math.min(h[0] - r, x));
    const iy = Math.max(-h[1] + r, Math.min(h[1] - r, y));
    const iz = Math.max(-h[2] + r, Math.min(h[2] - r, z));
    const dx = x - ix, dy = y - iy, dz = z - iz, l = Math.hypot(dx, dy, dz) || 1;
    p.setXYZ(i, ix + dx / l * r, iy + dy / l * r, iz + dz / l * r);
  }
  geo.computeVertexNormals();
  return geo;
}

const bedroom = new THREE.Group(); scene.add(bedroom);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), M.floor);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; bedroom.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), M.wall);
wall.position.set(0, 2, -1.125); wall.receiveShadow = true; bedroom.add(wall);
const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), M.wall);
wall2.position.set(-2.6, 2, 0); wall2.rotation.y = Math.PI / 2; wall2.receiveShadow = true; bedroom.add(wall2);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), M.rug);
rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 1.25); rug.receiveShadow = true; bedroom.add(rug);
// Window: a bright panel in the side wall that is also the room's main light.
const windowLight = new THREE.RectAreaLight(0xfff3e4, 7, 1.3, 1.5);
windowLight.position.set(-2.57, 1.45, 0.35); windowLight.lookAt(0, 1.0, 0.35);
bedroom.add(windowLight);
const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshBasicMaterial({ color: 0xfff6ea }));
windowPane.position.copy(windowLight.position).add(new THREE.Vector3(-0.015, 0, 0)); windowPane.rotation.y = Math.PI / 2;
bedroom.add(windowPane);
const frameMat = new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.6 });
for (const [w, h, y, z] of [[0.06, 1.62, 1.45, 0.35 - 0.68], [0.06, 1.62, 1.45, 0.35 + 0.68]]) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameMat); f.position.set(-2.57, y, z); bedroom.add(f);
}
for (const y of [1.45 - 0.78, 1.45 + 0.78]) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.42), frameMat); f.position.set(-2.56, y, 0.35); bedroom.add(f);
}

// Studio: a seamless cyclorama sweep, as used for product photography.
const studio = new THREE.Group(); studio.visible = false; scene.add(studio);
{
  const pts = [];
  const zFront = 5, zBack = -2.4, rad = 1.4, top = 5;
  pts.push([zFront, 0]);
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI / 2; pts.push([zBack + rad - rad * Math.sin(a), rad - rad * Math.cos(a)]); }
  pts.push([zBack, top]);
  const w = 14, pos = [], idx = [];
  pts.forEach(([z, y]) => { pos.push(-w / 2, y, z, w / 2, y, z); });
  for (let k = 0; k < pts.length - 1; k++) { const a = 2 * k; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const cyc = new THREE.Mesh(g, M.cyc); cyc.receiveShadow = true; studio.add(cyc);
}
const softbox = new THREE.RectAreaLight(0xffffff, 13, 2.2, 1.6);
softbox.position.set(1.6, 2.9, 2.2); softbox.lookAt(0, 0.5, 0.1);
studio.add(softbox);
const rimbox = new THREE.RectAreaLight(0xe9f0ff, 4, 1.6, 1.2);
rimbox.position.set(-2.4, 2.2, -0.6); rimbox.lookAt(0, 0.6, 0.2);
studio.add(rimbox);

// Bed, built from exactly the colliders the physics uses, for the chosen mattress size.
const colliderMeshes = {};
const legs = [];
function buildBedMeshes() {
  for (const m of [...Object.values(colliderMeshes), ...legs]) { scene.remove(m); m.geometry.dispose(); }
  legs.length = 0;
  const bed = bedM();
  for (const b of ClothSim.bedColliders(bed)) {
    const isWood = WOOD_PARTS(b.name);
    const mesh = new THREE.Mesh(roundedBoxGeometry(b.h, b.r, isWood ? 4 : 8, isWood ? 3 : 7),
      isWood ? M.wood : b.name === 'mattress' ? M.sheet : M.pillow);
    mesh.position.set(...b.c);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.dup = !!b.dup;
    if (b.dup) mesh.visible = false;
    scene.add(mesh); colliderMeshes[b.name] = mesh;
  }
  if (bed.kind !== 'table') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.07), M.wood);
    leg.position.set(sx * bed.w / 2, 0.05, sz * (bed.l / 2 - 0.015)); leg.castShadow = true; scene.add(leg); legs.push(leg);
  }
}
buildBedMeshes();

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
    const bin = atob(j.data), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    // Half floats: unlike 32-bit floats, every WebGL 2 GPU can filter them.
    const half = new Uint16Array(u8.buffer), n = j.width * j.height;
    const rgba = new Uint16Array(n * 4), one = THREE.DataUtils.toHalfFloat(1);
    for (let i = 0; i < n; i++) {
      rgba[4 * i] = half[3 * i]; rgba[4 * i + 1] = half[3 * i + 1]; rgba[4 * i + 2] = half[3 * i + 2]; rgba[4 * i + 3] = one;
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
const look = { stage: 'studio', light: 'warm', exposure: 1.0, dof: false, fstop: 4, target: 128, bounces: 6, engine: 'auto' };
// Phones skip the photo render entirely: preview, analysis and the designer remain.
if (IS_PHONE) { look.engine = 'raster'; state.atRest = 'none'; }
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
  if (raster.active) { scene.environmentIntensity *= RASTER_ENV_SCALE; sun.visible = true; resetRaster(); }
  if (pathTracer && state.view === 'render' && !raster.active) { pathTracer.updateEnvironment(); pathTracer.updateLights(); pathTracer.updateMaterials(); }
}

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
const patchCanvas = document.createElement('canvas'); patchCanvas.width = patchCanvas.height = PW;
let patchTex = new THREE.CanvasTexture(patchCanvas);
patchTex.colorSpace = THREE.SRGBColorSpace; patchTex.anisotropy = maxAniso;
let cavityImg = null, swatches = [];
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
  if (cavityImg) { g.globalCompositeOperation = 'multiply'; g.drawImage(cavityImg, 0, 0, PW, PW); g.globalCompositeOperation = 'source-over'; }
  patchTex.needsUpdate = true;
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
  if (typeof restoreBacking === 'function' && design) restoreBacking();
}

const quiltNormal = tex('assets/quilt_normal.jpg', { srgb: false });
const QM = {
  top: new THREE.MeshPhysicalMaterial({ map: patchTex, normalMap: quiltNormal, normalScale: new THREE.Vector2(1, 1), roughness: 0.9,
    sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.3, 0.3, 0.3) }),
  back: new THREE.MeshPhysicalMaterial({ map: weaveMap([10, 10]), normalMap: quiltNormal, color: 0xe7dcc4, roughness: 0.93,
    sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.25, 0.25, 0.25) }),
  binding: new THREE.MeshPhysicalMaterial({ map: weaveMap([1, 1]), normalMap: weaveNormal([1, 1]), color: 0x2f466f, roughness: 0.9,
    sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.3, 0.3, 0.35) }),
};

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
let havePos = false;
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

// ------------------------------------------------------------- camera
const target = new THREE.Vector3(0, 0.5, 0.15);
const orbit = { r: 4.3, az: 0.72, el: 0.38 };
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 50);
let activeCam = camera;
function placeCamera(keepRender) {
  for (const cam of [camera, ortho]) {
    cam.position.set(
      target.x + orbit.r * Math.cos(orbit.el) * Math.sin(orbit.az),
      target.y + orbit.r * Math.sin(orbit.el),
      target.z + orbit.r * Math.cos(orbit.el) * Math.cos(orbit.az));
    cam.lookAt(target);
  }
  const hh = orbit.r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  ortho.top = hh; ortho.bottom = -hh; ortho.left = -hh * camera.aspect; ortho.right = hh * camera.aspect;
  ortho.updateProjectionMatrix();
  camera.focusDistance = orbit.r;
  if (keepRender) return;
  if (pathTracer && state.view === 'render' && !raster.active) pathTracer.updateCamera();
  resetRaster();
}
const VIEWS = { iso: { az: 0.72, el: 0.38 }, foot: { az: 0, el: 0.08 }, side: { az: Math.PI / 2, el: 0.08 }, top: { az: 0, el: 1.55 } };
let camTween = null;
function goView(name) {
  const v = VIEWS[name], TAU = 2 * Math.PI;
  const daz = (((v.az - orbit.az) % TAU) + TAU + Math.PI) % TAU - Math.PI;
  camTween = { t: 0, az0: orbit.az, el0: orbit.el, daz, del: v.el - orbit.el };
}
function stepCamera(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / 0.7);
  const u = 0.5 - 0.5 * Math.cos(Math.PI * camTween.t);
  orbit.az = camTween.az0 + camTween.daz * u; orbit.el = camTween.el0 + camTween.del * u;
  placeCamera();
  if (camTween.t >= 1) camTween = null;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map();
let drag = null, pinchD = 0, grabMsg = null;
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, activeCam);
}
function pickQuilt(e) {
  if (!havePos || state.view === 'render') return null;
  setNdc(e);
  const hit = ray.intersectObjects([quiltTop, quiltBot], false)[0];
  if (!hit || !hit.uv) return null;
  const i = Math.round(hit.uv.x * (N - 1)), j = Math.round((1 - hit.uv.y) * (N - 1));
  return { i: j * N + i, point: hit.point.clone() };
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { drag = null; const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); return; }
  if (state.mode === 'grab') {
    const p = pickQuilt(e);
    if (p) {
      const n = new THREE.Vector3(); activeCam.getWorldDirection(n);
      drag = { kind: 'grab', i: p.i, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), p.point) };
      grabMsg = { type: 'grab', i: p.i, target: p.point.toArray() };
      canvas.classList.add('grabbing');
      return;
    }
  }
  drag = { kind: 'orbit', x: e.clientX, y: e.clientY }; camTween = null;
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD) orbit.r = Math.min(9, Math.max(1.8, orbit.r * pinchD / d));
    pinchD = d; placeCamera(); return;
  }
  if (!drag) {
    if (state.mode === 'grab' && e.pointerType === 'mouse') canvas.classList.toggle('can-grab', !!pickQuilt(e));
    return;
  }
  if (drag.kind === 'orbit') {
    orbit.az -= (e.clientX - drag.x) * 0.006;
    orbit.el = Math.min(1.55, Math.max(0.04, orbit.el + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX; drag.y = e.clientY; placeCamera();
  } else {
    setNdc(e);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(drag.plane, p)) { p.y = Math.max(0.03, p.y); grabMsg = { type: 'grab', i: drag.i, target: p.toArray() }; }
  }
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchD = 0;
  if (drag && drag.kind === 'grab') { grabMsg = null; send({ type: 'grab', i: null }); }
  drag = null; canvas.classList.remove('grabbing');
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  orbit.r = Math.min(9, Math.max(1.8, orbit.r * Math.exp(e.deltaY * 0.0012)));
  placeCamera();
}, { passive: false });

function resize() {
  const r = canvas.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;      // the 3D view is hidden (another page): keep its size and buffers
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 52 : 38;
  orbit.r = w / h < 1.2 ? 5.0 : 4.3;
  camera.updateProjectionMatrix();
  placeCamera();
}
new ResizeObserver(resize).observe(canvas);

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
aMesh.frustumCulled = false; aMesh.visible = false; aMesh.castShadow = true; aMesh.receiveShadow = true;
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
meshLines.frustumCulled = false; meshLines.visible = false; scene.add(meshLines);

// Scan sheet that sweeps head → foot while the result is revealed.
const scan = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5), new THREE.MeshBasicMaterial({
  color: 0x3fc3ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scan.position.y = 0.72; scan.visible = false; scene.add(scan);
const scanEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.012), new THREE.MeshBasicMaterial({
  color: 0x9fe6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scanEdge.position.y = 0.75; scan.add(scanEdge);

// Engineering workspace.
const engBgCanvas = document.createElement('canvas'); engBgCanvas.width = 4; engBgCanvas.height = 256;
{ const g = engBgCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#b9c0ca'); gr.addColorStop(1, '#eceef2'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }
const engBg = new THREE.CanvasTexture(engBgCanvas); engBg.colorSpace = THREE.SRGBColorSpace;
const engFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 1 }));
engFloor.rotation.x = -Math.PI / 2; engFloor.receiveShadow = true; engFloor.visible = false; scene.add(engFloor);
const gridMinor = new THREE.GridHelper(6, 60, 0xc3c9d1, 0xc3c9d1); gridMinor.position.y = 0.001;
const gridMajor = new THREE.GridHelper(6, 6, 0x7d8796, 0x7d8796); gridMajor.position.y = 0.002;
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
let colliders = ClothSim.bedColliders(bedM());
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
    for (const c of colliders) {
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
  if (!havePos) return;
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
  const on = analysis.on && havePos;
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


// ------------------------------------------------------------- photo render
// Two engines. Path tracing (three-gpu-pathtracer) is the accurate one. Some
// GPU drivers miscompile its BVH traversal (seen on Intel Xe through Direct3D
// 11), so there is also a progressive raster engine that runs on any WebGL 2
// GPU. It averages many frames, each with a jittered key light (soft shadows),
// a light from a random sky direction (ambient occlusion and contact shadows),
// a jittered lens position (depth of field) and a sub-pixel camera offset
// (anti-aliasing).
const PT_KEY = 'quilt-render.pathTracingBroken';
const GPU_NAME = (() => {
  try { const gl = renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }
  catch (e) { return 'unknown GPU'; }
})();
let pathTracer = null, ptError = null, renderT0 = 0, wasRunning = true, ptCheck = null, ptBroken = null;
try { const saved = JSON.parse(localStorage.getItem(PT_KEY) || 'null'); if (saved && saved.gpu === GPU_NAME) ptBroken = saved.reason; } catch (e) {}

function ensurePathTracer() {
  if (pathTracer || ptError) return pathTracer;
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext) || !gl.getExtension('EXT_color_buffer_float')) {
    ptError = 'this browser’s graphics don’t support floating-point render targets'; return null;
  }
  try {
    pathTracer = new WebGLPathTracer(renderer);
    pathTracer.textureSize.set(1024, 1024);
    pathTracer.tiles.set(2, 2);
    pathTracer.renderDelay = 0;
    pathTracer.minSamples = 2;
    pathTracer.fadeDuration = 600;
    pathTracer.dynamicLowRes = false;
    pathTracer.rasterizeScene = true;
    pathTracer.filterGlossyFactor = 0.5;
  } catch (e) { ptError = 'the path tracer could not start (' + (e.message || e) + ')'; pathTracer = null; }
  return pathTracer;
}
function ptScale() { return window.__ptScale || Math.min(1, 1 / renderer.getPixelRatio()); }

// ---- raster engine
const RASTER_ENV_SCALE = 0.35;          // the rest of the sky's diffuse light comes from the shadowed sky light
const raster = { active: false, n: 0, rtFrame: null, rtAccum: null, t0: 0, frameMs: 16 };
const skyLight = new THREE.DirectionalLight(0xfff7ef, 0);
skyLight.castShadow = true;
skyLight.shadow.mapSize.set(2048, 2048);
Object.assign(skyLight.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 18 });
skyLight.shadow.bias = -0.0005; skyLight.shadow.normalBias = 0.025;
skyLight.visible = false;
scene.add(skyLight); scene.add(skyLight.target);
const blendQuad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tMap: { value: null }, uW: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tMap; uniform float uW; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tMap, vUv).rgb, uW); }',
  transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,   // alpha only grows, so the canvas stays opaque
}));
const showQuad = new FullScreenQuad(new THREE.MeshBasicMaterial({ toneMapped: true, depthTest: false, depthWrite: false }));
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const baseSunDir = new THREE.Vector3();
function rasterSize() {
  const s = new THREE.Vector2(); renderer.getDrawingBufferSize(s);
  return [Math.max(1, Math.floor(s.x)), Math.max(1, Math.floor(s.y))];
}
function ensureRasterTargets() {
  const [w, h] = rasterSize();
  if (raster.rtFrame && raster.rtFrame.width === w && raster.rtFrame.height === h) return;
  raster.rtFrame?.dispose(); raster.rtAccum?.dispose();
  const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
  raster.rtFrame = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true });
  raster.rtAccum = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: false });
  raster.n = 0;
}
function resetRaster() { if (raster.active) { raster.n = 0; raster.t0 = performance.now(); } }
function rasterTarget() { return look.target * 2; }
function startRaster() {
  raster.active = true;
  ensureRasterTargets();
  baseSunDir.copy(sun.position).normalize();
  sun.visible = true;
  skyLight.visible = true;
  skyLight.target.position.copy(target);
  skyLight.intensity = look.stage === 'studio' ? 1.3 : 1.0;
  scene.environmentIntensity *= RASTER_ENV_SCALE;
  resetRaster();
}
function stopRaster() {
  if (!raster.active) return;
  raster.active = false;
  skyLight.visible = false;
  camera.clearViewOffset();
  placeCamera();
}
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3(), _camPos = new THREE.Vector3();
function rasterFrame() {
  const k = raster.n + 1, [w, h] = rasterSize();
  // key light: a random direction within the window / softbox's angular size
  const cone = look.stage === 'studio' ? 0.28 : 0.16;
  _fwd.copy(baseSunDir); _right.set(0, 1, 0).cross(_fwd).normalize(); _up.copy(_fwd).cross(_right);
  const a = 2 * Math.PI * halton(k, 2), r = cone * Math.sqrt(halton(k, 3));
  sun.position.copy(_fwd).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize().multiplyScalar(6);
  // sky light: cosine-weighted direction over the upper hemisphere
  const u1 = halton(k, 5), u2 = halton(k, 7), sr = Math.sqrt(u1), phi = 2 * Math.PI * u2;
  const dy = Math.max(0.08, Math.sqrt(1 - u1));
  skyLight.position.set(sr * Math.cos(phi), dy, sr * Math.sin(phi)).normalize().multiplyScalar(9).add(target);
  // lens: thin-lens depth of field by moving the eye across the aperture, keeping the focus point fixed
  placeCamera(true);
  if (look.dof) {
    const apertureM = camera.getFocalLength() / look.fstop / 1000;    // focal length in mm on a 35 mm film gauge
    const la = 2 * Math.PI * halton(k, 11), lr = 0.5 * apertureM * Math.sqrt(halton(k, 13));
    camera.getWorldDirection(_fwd); _right.crossVectors(_fwd, camera.up).normalize(); _up.crossVectors(_right, _fwd);
    _camPos.copy(camera.position).addScaledVector(_right, Math.cos(la) * lr).addScaledVector(_up, Math.sin(la) * lr);
    camera.position.copy(_camPos); camera.lookAt(target);
  }
  // sub-pixel jitter for anti-aliasing
  camera.setViewOffset(w, h, halton(k, 2) - 0.5, halton(k, 3) - 0.5, w, h);
  renderer.setRenderTarget(raster.rtFrame);
  renderer.clear();
  renderer.render(scene, camera);
  camera.clearViewOffset();
  renderer.setRenderTarget(raster.rtAccum);
  blendQuad.material.uniforms.tMap.value = raster.rtFrame.texture;
  blendQuad.material.uniforms.uW.value = 1 / k;
  const ac = renderer.autoClear; renderer.autoClear = false;   // blend onto the running average, don't wipe it
  blendQuad.render(renderer);
  renderer.autoClear = ac;
  renderer.setRenderTarget(null);
  raster.n = k;
}
function stepRaster() {
  ensureRasterTargets();
  const goal = rasterTarget(), t = performance.now();
  // render as many frames as fit in ~25 ms, so the page stays responsive
  let did = 0;
  while (raster.n < goal && (did === 0 || performance.now() - t + raster.frameMs < 25)) {
    const f0 = performance.now(); rasterFrame(); raster.frameMs = 0.8 * raster.frameMs + 0.2 * (performance.now() - f0); did++;
  }
  showQuad.material.map = raster.rtAccum.texture;
  showQuad.render(renderer);
  const secs = (performance.now() - raster.t0) / 1000, done = raster.n >= goal;
  $('rstat').textContent = done ? `Render done · ${goal} frames · ${secs.toFixed(0)} s · fast raster` : `Rendering · ${raster.n} / ${goal} frames · ${secs.toFixed(0)} s · fast raster`;
  $('rbar-fill').style.width = Math.min(100, 100 * raster.n / goal) + '%';
  return true;
}

// ---- engine selection and failure handling
function usePathTracing() { return look.engine === 'path' || (look.engine === 'auto' && !ptBroken); }
function renderFailed(reason, permanent = true) {
  ptBroken = reason;
  if (permanent) { try { localStorage.setItem(PT_KEY, JSON.stringify({ gpu: GPU_NAME, reason })); } catch (e) {} }
  const n = $('rnote');
  n.textContent = `Path tracing didn’t work on this GPU (${GPU_NAME}): ${reason}. Switched to the fast raster renderer, which works on any GPU.`;
  n.hidden = false;
  setTimeout(() => { n.hidden = true; }, 12000);
  if (state.view === 'render') { sun.visible = true; startRaster(); }
}
async function startRender() {
  if ($('ortho').checked) { $('ortho').checked = false; activeCam = camera; }
  wasRunning = state.running;
  if (state.running) setRunning(false, true);
  await applyLook();
  for (const h of handMeshes) h.visible = false;
  if (!usePathTracing()) { startRaster(); return; }
  if (!ensurePathTracer()) { renderFailed(ptError); return; }
  sun.visible = false;
  pathTracer.bounces = look.bounces;
  pathTracer.renderScale = ptScale();
  pathTracer.pausePathTracing = false;
  camera.bokehSize = look.dof ? camera.getFocalLength() / look.fstop : 0;
  camera.focusDistance = orbit.r;
  try { pathTracer.setScene(scene, camera); }
  catch (e) { renderFailed('the scene could not be prepared (' + (e.message || e) + ')'); return; }
  renderT0 = performance.now();
  ptCheck = { done: false };
}
function stopRender() {
  stopRaster();
  sun.visible = true;
  applyLook();
  if (wasRunning && !state.running) setRunning(true, true);
}
function restartSamples() {
  if (!pathTracer || state.view !== 'render' || raster.active) return;
  pathTracer.pausePathTracing = false;
  renderT0 = performance.now();
  pathTracer.reset();
  ptCheck = { done: false };
}
// After a few samples, read the accumulated image where the quilt is. On a
// working GPU those pixels are lit fabric; on a broken driver they come back
// black, NaN, or exactly the background colour (the rays missed the geometry).
const _p = new THREE.Vector3();
function verifyRender() {
  if (!ptCheck || ptCheck.done || pathTracer.samples < 4) return;
  ptCheck.done = true;
  const t = pathTracer.target; if (!t) return;
  const bg = scene.background && scene.background.isColor ? scene.background : new THREE.Color(0, 0, 0);
  const px = new Float32Array(4); let bad = 0, tested = 0;
  for (const [i, j] of [[10, 10], [20, 10], [30, 10], [10, 20], [20, 20], [30, 20], [10, 30], [20, 30], [30, 30]]) {
    const k = 3 * (j * N + i);
    _p.set(simPos[k], simPos[k + 1], simPos[k + 2]).project(camera);
    if (Math.abs(_p.x) > 0.95 || Math.abs(_p.y) > 0.95 || _p.z > 1) continue;
    const x = Math.floor((_p.x * 0.5 + 0.5) * t.width), y = Math.floor((_p.y * 0.5 + 0.5) * t.height);
    try { renderer.readRenderTargetPixels(t, x, y, 1, 1, px); } catch (e) { return; }
    tested++;
    const s = px[0] + px[1] + px[2];
    if (!Number.isFinite(s) || s < 1e-4 || Math.abs(px[0] - bg.r) + Math.abs(px[1] - bg.g) + Math.abs(px[2] - bg.b) < 0.003) bad++;
  }
  if (tested >= 3 && bad >= Math.ceil(tested / 2)) renderFailed('the quilt came out black, so the graphics driver is mis-running the path tracer');
}
function stepRender() {
  if (state.view !== 'render') return false;
  if (raster.active) return stepRaster();
  if (!pathTracer || !pathTracer.scene) return false;
  if (pathTracer.samples >= look.target) pathTracer.pausePathTracing = true;
  pathTracer.renderSample();
  verifyRender();
  if (raster.active || state.view !== 'render') return raster.active;
  const s = Math.floor(pathTracer.samples), secs = (performance.now() - renderT0) / 1000;
  const done = pathTracer.samples >= look.target;
  $('rstat').textContent = pathTracer.isCompiling ? `Compiling the path tracer for your GPU… ${secs.toFixed(0)} s (first time only)` :
    done ? `Render done · ${look.target} samples · ${secs.toFixed(0)} s · path traced` : `Rendering · ${s} / ${look.target} samples · ${secs.toFixed(0)} s · path traced`;
  $('rbar-fill').style.width = Math.min(100, 100 * pathTracer.samples / look.target) + '%';
  if (pathTracer.isCompiling && secs > 150) renderFailed('the path tracer took over 2½ minutes to compile', false);
  return true;
}
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  console.error('Shader error:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
  if (state.view === 'render' && !raster.active) renderFailed('the path-tracing shader failed to compile');
};
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  try { localStorage.setItem(PT_KEY, JSON.stringify({ gpu: GPU_NAME, reason: 'the graphics card reset while path tracing' })); } catch (_) {}
  const n = $('rnote');
  n.textContent = 'The graphics card reset the 3D view. Reload the page; photo renders will use the fast raster renderer on this GPU.';
  n.hidden = false;
});

// ------------------------------------------------------------- view modes
function setView(v) {
  if (state.view === v) return;
  const prev = state.view;
  state.view = v;
  for (const b of $('views').children) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  if (prev === 'render') stopRender();
  setAnalysis(v === 'analysis');
  $('rstat').hidden = $('rbar').hidden = v !== 'render';
  $('hint').hidden = v !== 'photo';
  if (v === 'render') $('slow').hidden = true;
  $('stage').classList.toggle('rendering', v === 'render');
  if (v === 'render') startRender(); else applyLook();
}

// ------------------------------------------------------------- messages
let handsData = [], newFrame = false;
function onSim(e) {
  const m = e.data;
  if (m.type !== 'frame') return;
  if (state.view === 'render') return;          // the render holds the captured shape
  simPos.set(m.pos); havePos = true; handsData = m.hands;
  newFrame = true;
  if (m.stats) updateStats(m.stats);
}

const fmtJ = v => (Math.abs(v) < 0.1 ? (v * 1000).toFixed(1) + ' mJ' : v.toFixed(2) + ' J');
function updateStats(s) {
  state.lastStats = s;
  $('clock').textContent = `t = ${s.t.toFixed(2)} s`;
  const pill = $('state');
  let cls = 'fall', txt = 'Falling';
  if (!s.running) { cls = ''; txt = 'Paused'; }
  else if (s.held) { cls = 'held'; txt = 'Held by hands'; }
  else if (s.restAt !== null) { cls = 'rest'; txt = `At rest · ${s.restAt.toFixed(1)} s`; }
  else if (s.contact > 0.04) { cls = 'settle'; txt = 'Settling'; }
  pill.className = 'pill ' + cls; pill.textContent = txt;
  const slow = $('slow');
  if (s.running && s.speed < 0.93 && state.view !== 'render') { slow.hidden = false; slow.textContent = `running at ${(s.speed).toFixed(2)}× speed`; }
  else slow.hidden = true;
  $('hint').hidden = (s.running && s.speed < 0.93) || state.view !== 'photo';
  $('m-ke').textContent = fmtJ(s.ke);
  $('m-pe').textContent = fmtJ(s.pe);
  $('m-el').textContent = fmtJ(s.stretch + s.bend);
  $('m-dis').textContent = s.dissipated === null ? 'held' : fmtJ(s.dissipated);
  $('m-vy').textContent = s.vy.toFixed(3) + ' m/s';
  $('m-st').textContent = (s.maxStrain * 100).toFixed(2) + ' %';
  $('m-ct').textContent = (s.contact * 100).toFixed(0) + ' %';
  $('m-mass').textContent = s.mass.toFixed(2) + ' kg';
  $('m-bl').textContent = (s.bendLen * 100).toFixed(1) + ' cm';
  const P = state.params;
  $('m-vt').textContent = P.Cd > 0 ? Math.sqrt(2 * P.rhoA * 9.81 / (1.204 * P.Cd)).toFixed(2) + ' m/s' : 'none (no air)';
  $('m-ms').textContent = s.stepMs.toFixed(1) + ' ms';
  analysisOnStats(s);
  if (s.restAt !== null && !state.autoDone && s.running && state.view === 'photo' && state.atRest !== 'none' && state.page === 'sim') {
    state.autoDone = true;
    setView(state.atRest);
  }
  if (s.running) {
    const H = state.history;
    if (H.length && s.t < H[H.length - 1].t) H.length = 0;
    H.push({ t: s.t, ke: s.ke, el: s.stretch + s.bend, dis: s.dissipated });
    while (H.length && H[0].t < s.t - 10) H.shift();
    drawChart();
  }
}

const chart = $('chart');
function drawChart() {
  const H = state.history;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = chart.clientWidth, h = chart.clientHeight;
  if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
  const g = chart.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement);
  const col = k => cs.getPropertyValue(k).trim();
  const padL = 38, padB = 16, padT = 6, pw = w - padL - 4, ph = h - padB - padT;
  let ymax = 0.05;
  for (const p of H) ymax = Math.max(ymax, p.ke, p.el * 10, p.dis || 0);
  const nice = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  ymax = nice.find(v => v >= ymax) || ymax;
  const t1 = H.length ? Math.max(10, H[H.length - 1].t) : 10, t0 = t1 - 10;
  const X = t => padL + (t - t0) / 10 * pw, Y = v => padT + ph - v / ymax * ph;
  g.strokeStyle = col('--line'); g.lineWidth = 1; g.fillStyle = col('--muted');
  g.font = `11px ${col('--font-data')}`; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let k = 0; k <= 2; k++) {
    const v = ymax * k / 2, y = Y(v);
    g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke();
    g.fillText(v + ' J', padL - 4, y);
  }
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let t = Math.floor(t0 / 2) * 2 + 2; t <= t1; t += 2) g.fillText(t + ' s', X(t), padT + ph + 3);
  const line = (key, color, mul = 1, dash = []) => {
    g.strokeStyle = color; g.lineWidth = 1.8; g.setLineDash(dash); g.beginPath();
    let started = false;
    for (const p of H) {
      const v = p[key]; if (v === null || v === undefined) { started = false; continue; }
      const x = X(p.t), y = Y(Math.min(ymax, v * mul));
      started ? g.lineTo(x, y) : g.moveTo(x, y); started = true;
    }
    g.stroke(); g.setLineDash([]);
  };
  line('dis', col('--muted'), 1, [4, 3]);
  line('el', col('--madder'), 10);
  line('ke', col('--accent'));
}

// ------------------------------------------------------------- controls
const toSlider = (p, v) => p.scale === 'log' ? Math.log(v / p.min) / Math.log(p.max / p.min) * 1000 : (v - p.min) / (p.max - p.min) * 1000;
const fromSlider = (p, s) => p.scale === 'log' ? p.min * Math.pow(p.max / p.min, s / 1000) : p.min + (p.max - p.min) * s / 1000;
const paramsBox = $('params');
for (const p of PARAMS) {
  const wrap = document.createElement('div'); wrap.className = 'param';
  wrap.innerHTML = `<label for="p-${p.key}">${p.label}</label><output id="p-${p.key}-o"></output>
    <input id="p-${p.key}" type="range" min="0" max="1000" step="1">${p.note ? `<small>${p.note}</small>` : ''}`;
  paramsBox.appendChild(wrap);
  const input = wrap.querySelector('input');
  input.addEventListener('input', () => {
    const v = fromSlider(p, +input.value);
    state.params[p.key] = v;
    if (p.key === 'Cd') $('air').checked = v > 0;
    showParam(p);
    send({ type: 'params', params: { [p.key]: v } });
  });
}
function showParam(p) { $(`p-${p.key}-o`).textContent = p.fmt(state.params[p.key]) + (p.unit ? ' ' + p.unit : ''); }
function syncParams() { for (const p of PARAMS) { $(`p-${p.key}`).value = toSlider(p, state.params[p.key]); showParam(p); } }
syncParams();
let savedCd = state.params.Cd;
$('preset').addEventListener('change', e => {
  state.params = { ...PRESETS[e.target.value] };
  savedCd = state.params.Cd; $('air').checked = true;
  syncParams(); send({ type: 'params', params: state.params }); restart();
});
$('air').addEventListener('change', e => {
  if (!e.target.checked) { savedCd = state.params.Cd || savedCd; state.params.Cd = 0; state.params.Cf = 0; }
  else { state.params.Cd = savedCd || 1.2; state.params.Cf = 0.02; }
  syncParams(); send({ type: 'params', params: { Cd: state.params.Cd, Cf: state.params.Cf } });
});
$('pillows').addEventListener('change', e => {
  if (colliderMeshes.pillowL) { colliderMeshes.pillowL.visible = e.target.checked; colliderMeshes.pillowR.visible = e.target.checked && !colliderMeshes.pillowR.userData.dup; }
  if (analysis.on) setEngineering(true);
  send({ type: 'pillows', value: e.target.checked });
});
$('selfc').addEventListener('change', e => send({ type: 'self', value: e.target.checked }));
const dropOut = () => { $('dropH-o').textContent = state.dropHeight.toFixed(2) + ' m'; };
$('dropH').addEventListener('input', e => { state.dropHeight = +e.target.value; dropOut(); });
$('dropH').addEventListener('change', () => { if (state.scenario === 'drop') restart(); });
dropOut();
const subOut = () => { $('substeps-o').textContent = `${state.substeps} substeps · Δt = ${(1000 / 60 / state.substeps).toFixed(2)} ms`; };
$('substeps').addEventListener('input', e => { state.substeps = SUBSTEPS[+e.target.value]; subOut(); send({ type: 'substeps', value: state.substeps }); });
subOut();
$('speed').addEventListener('change', e => send({ type: 'speed', value: +e.target.value }));

function restart() {
  state.history.length = 0;
  state.autoDone = false;
  setView('photo');
  if (!state.running) setRunning(true);
  send({ type: 'reset', scenario: state.scenario, dropHeight: state.dropHeight, rot: quiltTurned, pos: dropPosM() });
}
function setRunning(v, quiet) {
  state.running = v;
  $('pause').textContent = v ? 'Pause' : 'Resume';
  send({ type: 'run', value: v });
  if (!quiet && v && state.view === 'render') setView('photo');
}
$('restart').addEventListener('click', restart);
function syncTurnBtn() { const b = $('sim-turn'); if (!b) return; b.setAttribute('aria-pressed', String(quiltTurned)); b.title = quiltTurned ? 'Quilt turned 90° · click to drop it straight again' : 'Turn the quilt 90° and drop it again'; }
$('sim-turn').addEventListener('click', () => {
  quiltTurned = !quiltTurned; try { localStorage.setItem('quilt-turned.v1', quiltTurned ? '1' : '0'); } catch (e) {}
  if (state.scenario !== 'drop') { state.scenario = 'drop'; for (const x of $('scenarios').children) x.setAttribute('aria-pressed', String(x.dataset.sc === 'drop')); }
  syncTurnBtn(); syncDropUI(); restart();
});
syncTurnBtn();
// ---- drop position: a slider along an imaginary line over the long side of the bed or table
const alongZ = () => bedState.l >= bedState.w;
// the furthest toward the head the quilt can start: on a bed its head edge stays at the head of the mattress
// (starting over the headboard would make it drape on both sides of the board)
function dropMin() {
  const L = Math.max(bedState.w, bedState.l);
  if (isTableSim() || !alongZ()) return -Math.round(L / 2);
  const len = (quiltTurned ? quilt.w : quilt.l) * 1000;
  return Math.round(-bedState.l / 2 + 20 + len / 2);
}
function defaultDropPos() {
  if (isTableSim() || !alongZ()) return 0;
  const len = (quiltTurned ? quilt.w : quilt.l) * 1000;
  return Math.round(-bedState.l / 2 + 70 + len / 2);            // head edge of the quilt 7 cm from the head of the bed
}
const dropGuide = new THREE.Group(); dropGuide.visible = false; dropGuide.renderOrder = 999; scene.add(dropGuide);
const guideMat = new THREE.LineDashedMaterial({ color: 0xe0592a, dashSize: 0.06, gapSize: 0.035, depthTest: false, transparent: true });
const guideMat2 = new THREE.LineDashedMaterial({ color: 0x2f466f, dashSize: 0.04, gapSize: 0.03, depthTest: false, transparent: true });
const guideDot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 32), new THREE.MeshBasicMaterial({ color: 0xe0592a, depthTest: false, transparent: true }));
guideDot.rotation.x = -Math.PI / 2; guideDot.renderOrder = 1000;
let guideT = 0;
function updateDropGuide(show) {
  for (const o of [...dropGuide.children]) { dropGuide.remove(o); if (o !== guideDot) o.geometry.dispose(); }
  const bed = bedM(), y = ClothSim.surfaceTop(bed) + 0.03, L = Math.max(bed.w, bed.l), z = alongZ();
  const p = (dropPos == null ? defaultDropPos() : dropPos) / 1000;
  const P = (a, b) => z ? new THREE.Vector3(b, y, a) : new THREE.Vector3(a, y, b);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(-L / 2, 0), P(L / 2, 0)]), guideMat); line.computeLineDistances(); line.renderOrder = 999;
  // the quilt's footprint where it will be dropped
  const qw = (quiltTurned ? quilt.l : quilt.w) / 2, ql = (quiltTurned ? quilt.w : quilt.l) / 2, cx = z ? 0 : p, cz = z ? p : (isTableSim() ? 0 : 0);
  const rect = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-qw, -ql], [qw, -ql], [qw, ql], [-qw, ql]].map(([a, b]) => new THREE.Vector3(cx + a, y, cz + b))), guideMat2);
  rect.computeLineDistances(); rect.renderOrder = 999;
  guideDot.position.set(z ? 0 : p, y + 0.001, z ? p : 0);
  dropGuide.add(line, rect, guideDot);
  clearTimeout(guideT);
  dropGuide.visible = !!show;
  if (show) guideT = setTimeout(() => { dropGuide.visible = false; }, 2500);
}
function syncDropUI() {
  const el = $('drop-pos'); if (!el) return;
  const L = Math.max(bedState.w, bedState.l);
  const lo = dropMin(), hi = Math.round(L / 2);
  if (dropPos != null && dropPos < lo) dropPos = lo;
  const v = dropPos == null ? defaultDropPos() : dropPos;
  el.min = String(Math.min(lo, hi)); el.max = String(hi); el.step = '10'; el.value = String(dropPos == null ? v : dropPos);
  const far = z => Math.abs(z) < 5 ? 'centre' : `${Math.abs(z)} mm toward the ${alongZ() ? (z > 0 ? (isTableSim() ? 'near end' : 'foot') : (isTableSim() ? 'far end' : 'head')) : (z > 0 ? 'right' : 'left')}`;
  $('drop-pos-v').textContent = dropPos == null ? `${far(v)} (usual spot)` : far(v);
}
$('drop-pos').addEventListener('input', e => { dropPos = +e.target.value; syncDropUI(); updateDropGuide(true); });
$('drop-pos').addEventListener('change', () => { updateDropGuide(true); restart(); });
$('drop-pos').addEventListener('dblclick', () => { dropPos = null; syncDropUI(); updateDropGuide(true); restart(); });
for (const ev of ['pointerenter', 'focus']) $('drop-pos').addEventListener(ev, () => updateDropGuide(true));
syncDropUI();
$('pause').addEventListener('click', () => setRunning(!state.running));
$('scenarios').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.scenario = b.dataset.sc;
  for (const x of $('scenarios').children) x.setAttribute('aria-pressed', String(x === b));
  restart();
});
$('modes').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.mode = b.dataset.mode;
  for (const x of $('modes').children) x.setAttribute('aria-pressed', String(x === b));
  $('hint').textContent = state.mode === 'grab' ? 'Drag the quilt to pull it · drag empty space to orbit' : 'Drag to orbit · scroll to zoom';
  canvas.classList.remove('can-grab');
});
$('views').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); });
$('field').addEventListener('change', e => { analysis.field = e.target.value; analysis.legendKey = ''; computeAnalysis(); });
$('meshlines').addEventListener('change', e => { analysis.mesh = e.target.checked; });
$('ortho').addEventListener('change', e => {
  if (e.target.checked && state.view === 'render') setView('photo');
  activeCam = e.target.checked ? ortho : camera;
});
$('atrest').addEventListener('change', e => { state.atRest = e.target.value; });
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => goView(b.dataset.cam));

// render controls
$('stagesel').addEventListener('change', e => { look.stage = e.target.value; applyLook().then(rebuildRenderScene); });
$('lightsel').addEventListener('change', e => { look.light = e.target.value; applyLook().then(() => { restartSamples(); resetRaster(); }); });
const expOut = () => { $('exposure-o').textContent = look.exposure.toFixed(2) + '×'; };
$('exposure').addEventListener('input', e => { look.exposure = +e.target.value; renderer.toneMappingExposure = look.exposure; expOut(); });
expOut();
const fOut = () => { $('fstop-o').textContent = 'f/' + look.fstop.toFixed(1); };
$('dof').addEventListener('change', e => { look.dof = e.target.checked; updateDof(); });
$('fstop').addEventListener('input', e => { look.fstop = +e.target.value; fOut(); updateDof(); });
fOut();
function updateDof() {
  camera.bokehSize = look.dof ? camera.getFocalLength() / look.fstop : 0;
  if (pathTracer && state.view === 'render' && !raster.active) pathTracer.updateCamera();
  resetRaster();
}
$('quality').addEventListener('change', e => {
  look.target = +e.target.value;
  if (pathTracer && state.view === 'render' && pathTracer.samples < look.target) pathTracer.pausePathTracing = false;
});
$('engine').addEventListener('change', e => {
  look.engine = e.target.value;
  if (look.engine === 'path') { ptBroken = null; try { localStorage.removeItem(PT_KEY); } catch (_) {} $('rnote').hidden = true; }
  if (state.view === 'render') { stopRender(); startRender(); }
});
$('bounces').addEventListener('change', e => { look.bounces = +e.target.value; if (pathTracer) { pathTracer.bounces = look.bounces; restartSamples(); } });
function rebuildRenderScene() {
  if (raster.active) { resetRaster(); return; }
  if (pathTracer && state.view === 'render') { sun.visible = false; pathTracer.setScene(scene, camera); renderT0 = performance.now(); ptCheck = { done: false }; }
}

// (fabrics for the quilt come from the designer; the simulation page has no fabric card of its own)

// ------------------------------------------------------------- quilt designer
// The user lays out a grid of blocks, picks a traditional pattern for each
// block and a fabric for every part of it. "Simulate this quilt" turns the
// design into the quilt's texture and a quilting normal map that follows the
// design's own seams, then drops it on the bed.

// Each pattern is a list of parts: a polygon in the unit square (y down) and
// a colour role (0 background, 1 main, 2 accent) used for default fabrics.
const P_ = (name, role, poly) => ({ name, role, poly });
function rotPoly(poly, k) { let p = poly; for (let i = 0; i < k; i++) p = p.map(([x, y]) => [1 - y, x]); return p; }
// a block's orientation: turned rot quarter turns, then mirrored left-right when flip is set
const orientPoly = (poly, b) => { const p = rotPoly(poly, b.rot || 0); return b.flip ? p.map(([x, y]) => [1 - x, y]) : p; };
const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const PATTERNS = {
  plain: { label: 'Plain square', parts: () => [P_('Square', 0, sq(0, 0, 1, 1))] },
  hst: { label: 'Half-square triangle', parts: () => [P_('Lower triangle', 1, [[0, 0], [0, 1], [1, 1]]), P_('Upper triangle', 0, [[0, 0], [1, 0], [1, 1]])] },
  hourglass: { label: 'Hourglass', parts: () => {
    const c = [0.5, 0.5];
    return [P_('Top', 1, [[0, 0], [1, 0], c]), P_('Right', 0, [[1, 0], [1, 1], c]), P_('Bottom', 1, [[1, 1], [0, 1], c]), P_('Left', 0, [[0, 1], [0, 0], c])];
  } },
  four: { label: 'Four patch', parts: () => [P_('Top left', 1, sq(0, 0, .5, .5)), P_('Top right', 0, sq(.5, 0, 1, .5)), P_('Bottom left', 0, sq(0, .5, .5, 1)), P_('Bottom right', 1, sq(.5, .5, 1, 1))] },
  nine: { label: 'Nine patch', parts: () => {
    const out = [], t = 1 / 3, names = ['Top left', 'Top', 'Top right', 'Left', 'Centre', 'Right', 'Bottom left', 'Bottom', 'Bottom right'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out.push(P_(names[j * 3 + i], (i + j) % 2 === 0 ? 1 : 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    return out;
  } },
  ohio: { label: 'Ohio star', parts: () => {
    const t = 1 / 3, out = [];
    for (const [i, j, n] of [[0, 0, 'Corner top left'], [2, 0, 'Corner top right'], [0, 2, 'Corner bottom left'], [2, 2, 'Corner bottom right']]) out.push(P_(n, 0, sq(i * t, j * t, (i + 1) * t, (j + 1) * t)));
    out.push(P_('Centre', 2, sq(t, t, 2 * t, 2 * t)));
    // four quarter-square-triangle units make the star points
    for (const [i, j, side, vertical] of [[1, 0, 'top', false], [1, 2, 'bottom', false], [0, 1, 'left', true], [2, 1, 'right', true]]) {
      const x0 = i * t, y0 = j * t, x1 = x0 + t, y1 = y0 + t, c = [x0 + t / 2, y0 + t / 2];
      const tri = { N: [[x0, y0], [x1, y0], c], E: [[x1, y0], [x1, y1], c], S: [[x1, y1], [x0, y1], c], Wd: [[x0, y1], [x0, y0], c] };
      const star = vertical ? ['N', 'S'] : ['E', 'Wd'];
      for (const k of ['N', 'E', 'S', 'Wd']) out.push(P_(`Point ${side} · ${{ N: 'upper', E: 'right', S: 'lower', Wd: 'left' }[k]}`, star.includes(k) ? 1 : 0, tri[k]));
    }
    return out;
  } },
  pinwheel: { label: 'Pinwheel', parts: () => {
    const blade = [[0, 0], [.5, 0], [.5, .5]], bg = [[0, 0], [.5, .5], [0, .5]], out = [];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Blade ' + names[k], 1, rotPoly(blade, k))); out.push(P_('Background ' + names[k], 0, rotPoly(bg, k))); }
    return out;
  } },
  geese: { label: 'Flying geese', parts: () => {
    const out = [];
    for (const [r, role] of [[0, 1], [1, 2]]) {
      const y0 = r * .5, y1 = y0 + .5, n = r ? 'lower' : 'upper';
      out.push(P_(`Goose ${n}`, role, [[0, y1], [.5, y0], [1, y1]]), P_(`Sky left ${n}`, 0, [[0, y0], [.5, y0], [0, y1]]), P_(`Sky right ${n}`, 0, [[.5, y0], [1, y0], [1, y1]]));
    }
    return out;
  } },
  logcabin: { label: 'Log cabin', parts: () => {
    let x0 = .4, y0 = .4, x1 = .6, y1 = .6; const w = .1, out = [P_('Hearth', 2, sq(x0, y0, x1, y1))];
    for (let k = 0; k < 16; k++) {
      const side = k % 4, role = side < 2 ? 0 : 1, n = `Log ${k + 1}`;
      if (side === 0) { out.push(P_(n, role, sq(x0, y0 - w, x1, y0))); y0 -= w; }
      else if (side === 1) { out.push(P_(n, role, sq(x1, y0, x1 + w, y1))); x1 += w; }
      else if (side === 2) { out.push(P_(n, role, sq(x0, y1, x1, y1 + w))); y1 += w; }
      else { out.push(P_(n, role, sq(x0 - w, y0, x0, y1))); x0 -= w; }
    }
    return out;
  } },
  churn: { label: 'Churn dash', parts: () => {
    const t = 1 / 3, out = [];
    // corners: half-square triangles with the dark half at the outer corner
    const corner = [[0, 0], [t, 0], [0, t]], cornerBg = [[t, 0], [t, t], [0, t]];
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Corner ' + names[k], 1, rotPoly(corner, k)), P_('Corner background ' + names[k], 0, rotPoly(cornerBg, k))); }
    const edgeOuter = sq(t, 0, 2 * t, t / 2), edgeInner = sq(t, t / 2, 2 * t, t), en = ['top', 'right', 'bottom', 'left'];
    for (let k = 0; k < 4; k++) { out.push(P_('Bar ' + en[k], 1, rotPoly(edgeOuter, k)), P_('Bar background ' + en[k], 0, rotPoly(edgeInner, k))); }
    out.push(P_('Centre', 0, sq(t, t, 2 * t, 2 * t)));
    return out;
  } },
  fanstar: { label: 'Fan star', parts: () => {
    // Top-left quadrant: six fan blades radiating from the block centre.
    // Bottom-right: an eight-point star (centre M, four star-point units, corners I, K, L).
    const t = 1 / 3, s = 1 / 6, apex = [0.5, 0.5], out = [];
    const blades = [[[0, .5], [0, t]], [[0, t], [0, s]], [[0, s], [0, 0]], [[0, 0], [s, 0]], [[s, 0], [t, 0]], [[t, 0], [.5, 0]]];
    blades.forEach(([a, b], k) => out.push(P_(`A${k + 1} · fan blade`, k === 4 ? 2 : 1, [a, b, apex])));
    out.push(P_('B', 0, sq(.5, 0, 2 / 3, t)), P_('C', 0, sq(2 / 3, 0, 1, t)), P_('D', 0, sq(0, .5, t, 2 / 3)), P_('E', 0, sq(0, 2 / 3, t, 1)),
             P_('I · star corner', 0, sq(5 / 6, t, 1, .5)), P_('K · star corner', 0, sq(t, 5 / 6, .5, 1)), P_('L · star corner', 0, sq(5 / 6, 5 / 6, 1, 1)),
             P_('M · star centre', 1, sq(.5, .5, 5 / 6, 5 / 6)));
    // star-point unit above M (half-square triangles), turned to each side of the star
    const c = [2 / 3, 2 / 3];
    const turn = ([u, v], k) => { let du = u - c[0], dv = v - c[1]; for (let i = 0; i < k; i++) [du, dv] = [-dv, du]; return [c[0] + du, c[1] + dv]; };
    const unit = [[1, [[.5, t], [2 / 3, .5], [.5, .5]]], [2, [[.5, t], [2 / 3, t], [2 / 3, .5]]], [2, [[2 / 3, t], [5 / 6, t], [2 / 3, .5]]], [1, [[5 / 6, t], [5 / 6, .5], [2 / 3, .5]]]];
    const sides = ['top', 'right', 'bottom', 'left'], letters = [['G', 'F', 'H', 'G'], ['G', 'H', 'F', 'G'], ['G', 'F', 'J', 'G'], ['G', 'J', 'F', 'G']];
    for (let k = 0; k < 4; k++) unit.forEach(([role, poly], i) => out.push(P_(`Star point ${sides[k]} · ${letters[k][i]}`, role, poly.map(p => turn(p, k)))));
    return out;
  } },
};
// The 12 blocks traced from the user's drawing: [label, [[part name, colour role, flat x,y list in 1/24ths], ...]]
const TRACED = {
  spoolstar: ["Spool star", [["Triangle · top left 1",0,[0,6,0,0,6,0]],["Triangle · top",1,[12,6,6,0,18,0]],["Triangle · top right 1",0,[24,6,18,0,24,0]],["Triangle · top left 2",2,[0,6,6,0,6,6]],["Triangle · top left 3",0,[6,6,6,0,12,6]],["Triangle · top right 2",0,[12,6,18,0,18,6]],["Triangle · top right 3",2,[24,6,18,6,18,0]],["Triangle · top left 4",0,[10,6,6,10,6,6]],["Triangle · top right 4",0,[18,6,18,10,14,6]],["Triangle · top left 5",0,[0,6,6,6,6,12]],["Triangle · top right 5",0,[24,6,18,12,18,6]],["Triangle · centre 1",1,[10,6,10,10,6,10]],["Triangle · centre 2",1,[18,10,14,10,14,6]],["Triangle · left",1,[0,6,6,12,0,18]],["Square · left",0,[6,10,10,10,10,14,6,14]],["Rectangle · centre",2,[14,18,10,18,10,6,14,6]],["Square · right",0,[18,14,14,14,14,10,18,10]],["Triangle · right",1,[24,6,24,18,18,12]],["Triangle · centre 3",1,[6,14,10,14,10,18]],["Triangle · centre 4",1,[14,14,18,14,14,18]],["Triangle · bottom left 1",0,[0,18,6,12,6,18]],["Triangle · bottom right 1",0,[24,18,18,18,18,12]],["Triangle · bottom left 2",0,[6,14,10,18,6,18]],["Triangle · bottom right 2",0,[18,14,18,18,14,18]],["Triangle · bottom left 3",2,[0,18,6,18,6,24]],["Triangle · bottom left 4",0,[6,24,6,18,12,18]],["Triangle · bottom right 3",0,[18,24,12,18,18,18]],["Triangle · bottom right 4",2,[24,18,18,24,18,18]],["Triangle · bottom left 5",0,[0,18,6,24,0,24]],["Triangle · bottom",1,[6,24,12,18,18,24]],["Triangle · bottom right 5",0,[24,18,24,24,18,24]]]],
  crossroads: ["Crossroads", [["Rectangle · top",0,[16,0,16,4,8,4,8,0]],["Triangle · top left 1",0,[8,0,0,8,0,0]],["Triangle · top right 1",0,[24,8,16,0,24,0]],["Triangle · top left 2",1,[8,0,8,8,0,8]],["Triangle · top right 2",1,[16,8,16,0,24,8]],["Rectangle · left",0,[0,16,0,8,4,8,4,16]],["Piece · centre",2,[20,8,20,16,16,16,16,20,8,20,8,16,4,16,4,8,8,8,8,4,16,4,16,8]],["Rectangle · right",0,[20,8,24,8,24,16,20,16]],["Triangle · bottom left 1",1,[0,16,8,16,8,24]],["Triangle · bottom right 1",1,[24,16,16,24,16,16]],["Triangle · bottom left 2",0,[0,16,8,24,0,24]],["Triangle · bottom right 2",0,[24,16,24,24,16,24]],["Rectangle · bottom",0,[8,24,8,20,16,20,16,24]]]],
  geesecrown: ["Crown of geese", [["Triangle · top 1",1,[6,0,12,0,9,3]],["Triangle · top 2",1,[12,0,18,0,15,3]],["Triangle · top left 1",0,[6,0,0,6,0,0]],["Triangle · top right 1",0,[24,6,18,0,24,0]],["Triangle · top 3",2,[12,0,12,6,9,3]],["Triangle · top 4",2,[12,0,15,3,12,6]],["Triangle · top left 2",1,[6,0,6,6,0,6]],["Triangle · top left 3",0,[6,0,12,6,6,6]],["Triangle · top right 2",0,[18,0,18,6,12,6]],["Triangle · top right 3",1,[24,6,18,6,18,0]],["Triangle · top left 4",0,[6,12,0,6,6,6]],["Triangle · top right 4",0,[18,12,18,6,24,6]],["Triangle · left 1",1,[0,12,0,6,3,9]],["Triangle · right 1",1,[21,9,24,6,24,12]],["Triangle · left 2",2,[0,12,3,9,6,12]],["Triangle · right 2",2,[21,9,24,12,18,12]],["Square · centre",0,[6,6,18,6,18,18,6,18]],["Triangle · left 3",2,[0,12,6,12,3,15]],["Triangle · right 3",2,[24,12,21,15,18,12]],["Triangle · left 4",1,[0,12,3,15,0,18]],["Triangle · right 4",1,[24,12,24,18,21,15]],["Triangle · bottom left 1",0,[6,12,6,18,0,18]],["Triangle · bottom right 1",0,[18,18,18,12,24,18]],["Triangle · bottom left 2",1,[0,18,6,18,6,24]],["Triangle · bottom left 3",0,[6,24,6,18,12,18]],["Triangle · bottom right 2",0,[18,18,18,24,12,18]],["Triangle · bottom right 3",1,[18,18,24,18,18,24]],["Triangle · bottom 1",2,[9,21,12,18,12,24]],["Triangle · bottom 2",2,[12,24,12,18,15,21]],["Triangle · bottom left 4",0,[0,18,6,24,0,24]],["Triangle · bottom right 4",0,[18,24,24,18,24,24]],["Triangle · bottom 3",1,[6,24,9,21,12,24]],["Triangle · bottom 4",1,[18,24,12,24,15,21]]]],
  tulipcross: ["Tulip cross", [["Triangle · top left 1",0,[4,0,12,0,8,4]],["Triangle · top right 1",0,[16,4,12,0,20,0]],["Square · top left",1,[0,4,0,0,4,0,4,4]],["Square · top right",1,[20,0,24,0,24,4,20,4]],["Hexagon · top left",0,[4,8,0,4,4,4,4,0,8,4,8,8]],["Hexagon · top right",0,[16,4,20,0,20,4,24,4,20,8,16,8]],["Pentagon · top",1,[16,4,16,8,8,8,8,4,12,0]],["Triangle · top left 2",0,[0,12,0,4,4,8]],["Triangle · top right 2",0,[24,12,20,8,24,4]],["Pentagon · left",1,[0,12,4,8,8,8,8,16,4,16]],["Square · centre",2,[8,16,8,8,16,8,16,16]],["Pentagon · right",1,[20,16,16,16,16,8,20,8,24,12]],["Triangle · bottom left 1",0,[0,12,4,16,0,20]],["Triangle · bottom right 1",0,[20,16,24,12,24,20]],["Pentagon · bottom",1,[12,24,8,20,8,16,16,16,16,20]],["Hexagon · bottom left",0,[4,24,4,20,0,20,4,16,8,16,8,20]],["Hexagon · bottom right",0,[20,24,16,20,16,16,20,16,24,20,20,20]],["Square · bottom left",1,[4,24,0,24,0,20,4,20]],["Square · bottom right",1,[20,24,20,20,24,20,24,24]],["Triangle · bottom left 2",0,[4,24,8,20,12,24]],["Triangle · bottom right 2",0,[12,24,16,20,20,24]]]],
  eightstar: ["Eight-point star", [["Triangle · top 1",0,[6,0,12,0,12,6]],["Triangle · top 2",0,[12,0,18,0,12,6]],["Square · top left",0,[6,0,6,6,0,6,0,0]],["Square · top right",0,[18,0,24,0,24,6,18,6]],["Triangle · top left 1",1,[6,0,12,6,6,6]],["Triangle · top right 1",1,[18,0,18,6,12,6]],["Triangle · top left 2",1,[6,12,0,6,6,6]],["Triangle · top left 3",0,[6,12,6,6,12,6]],["Triangle · top right 2",0,[18,12,12,6,18,6]],["Triangle · top right 3",1,[18,12,18,6,24,6]],["Triangle · centre 1",2,[12,6,12,12,9,9]],["Triangle · centre 2",2,[15,9,12,12,12,6]],["Triangle · left 1",0,[0,12,0,6,6,12]],["Triangle · right 1",0,[18,12,24,6,24,12]],["Triangle · centre 3",2,[6,12,9,9,12,12]],["Triangle · centre 4",2,[18,12,12,12,15,9]],["Triangle · centre 5",2,[6,12,12,12,9,15]],["Triangle · centre 6",2,[18,12,15,15,12,12]],["Triangle · left 2",0,[0,12,6,12,0,18]],["Triangle · right 2",0,[18,12,24,12,24,18]],["Triangle · centre 7",2,[9,15,12,12,12,18]],["Triangle · centre 8",2,[12,12,15,15,12,18]],["Triangle · bottom left 1",1,[6,12,6,18,0,18]],["Triangle · bottom left 2",0,[6,12,12,18,6,18]],["Triangle · bottom right 1",0,[18,12,18,18,12,18]],["Triangle · bottom right 2",1,[18,12,24,18,18,18]],["Triangle · bottom left 3",1,[6,24,6,18,12,18]],["Triangle · bottom right 3",1,[18,18,18,24,12,18]],["Square · bottom left",0,[0,18,6,18,6,24,0,24]],["Square · bottom right",0,[24,18,24,24,18,24,18,18]],["Triangle · bottom 1",0,[6,24,12,18,12,24]],["Triangle · bottom 2",0,[18,24,12,24,12,18]]]],
  nested: ["Nested triangles", [["Triangle · top right 1",0,[18,0,18,6,12,0]],["Triangle · top right 2",0,[18,0,24,0,24,6]],["Triangle · top left",0,[12,12,0,0,12,0]],["Triangle · top right 3",2,[18,0,24,6,18,6]],["Triangle · top right 4",1,[24,12,12,12,12,0]],["Triangle · top right 5",0,[18,6,24,6,24,12]],["Triangle · bottom left",1,[24,24,0,24,0,0]],["Triangle · bottom right",0,[12,12,24,12,24,24]]]],
  twinbars: ["Twin bars star", [["Triangle · top 1",1,[6,0,12,0,12,6]],["Triangle · top 2",1,[12,0,18,0,12,6]],["Square · top left",0,[6,0,6,6,0,6,0,0]],["Square · top right",0,[24,6,18,6,18,0,24,0]],["Triangle · top left 1",0,[6,0,12,6,6,6]],["Triangle · top right 1",0,[18,0,18,6,12,6]],["Triangle · top left 2",0,[0,6,6,6,6,12]],["Triangle · top right 2",0,[24,6,18,12,18,6]],["Triangle · left",1,[0,6,6,12,0,18]],["Rectangle · centre 1",2,[6,6,12,6,12,18,6,18]],["Rectangle · centre 2",2,[18,18,12,18,12,6,18,6]],["Triangle · right",1,[24,6,24,18,18,12]],["Triangle · bottom left 1",0,[0,18,6,12,6,18]],["Triangle · bottom right 1",0,[24,18,18,18,18,12]],["Triangle · bottom left 2",0,[6,24,6,18,12,18]],["Triangle · bottom right 2",0,[18,18,18,24,12,18]],["Square · bottom left",0,[0,18,6,18,6,24,0,24]],["Square · bottom right",0,[24,18,24,24,18,24,18,18]],["Triangle · bottom 1",1,[6,24,12,18,12,24]],["Triangle · bottom 2",1,[18,24,12,24,12,18]]]],
  twisted: ["Twisted square", [["Triangle · top left",0,[0,8,0,0,8,0]],["Triangle · top right",0,[24,8,16,0,24,0]],["Pentagon · top right",1,[24,8,16,16,16,8,8,0,16,0]],["Pentagon · top left",2,[0,16,0,8,8,0,16,8,8,8]],["Square · centre",0,[16,8,16,16,8,16,8,8]],["Pentagon · bottom right",1,[24,16,16,24,8,16,16,16,24,8]],["Pentagon · bottom left",2,[0,16,8,8,8,16,16,24,8,24]],["Triangle · bottom left",0,[0,16,8,24,0,24]],["Triangle · bottom right",0,[24,16,24,24,16,24]]]],
  spindiamond: ["Spinning diamond", [["Triangle · top left 1",0,[6,0,0,6,0,0]],["Triangle · top right 1",0,[12,0,18,0,18,6]],["Triangle · top right 2",0,[18,0,24,0,24,6]],["Parallelogram · top left",1,[6,0,12,0,6,6,0,6]],["Triangle · top",0,[12,0,12,6,6,6]],["Parallelogram · top",1,[12,0,18,6,18,12,12,6]],["Parallelogram · top right",1,[18,0,24,6,24,12,18,6]],["Triangle · top left 2",0,[0,12,0,6,6,6]],["Parallelogram · left",1,[0,12,6,6,12,6,6,12]],["Triangle · centre 1",2,[6,12,12,6,12,12]],["Triangle · centre 2",2,[12,6,18,12,12,12]],["Triangle · right",0,[18,6,24,12,18,12]],["Triangle · left",0,[0,12,6,12,6,18]],["Triangle · centre 3",2,[6,12,12,12,12,18]],["Triangle · centre 4",2,[18,12,12,18,12,12]],["Parallelogram · right",1,[18,12,24,12,18,18,12,18]],["Triangle · bottom right 1",0,[24,12,24,18,18,18]],["Parallelogram · bottom left",1,[0,12,6,18,6,24,0,18]],["Parallelogram · bottom",1,[6,18,6,12,12,18,12,24]],["Triangle · bottom",0,[12,18,18,18,12,24]],["Parallelogram · bottom right",1,[18,24,12,24,18,18,24,18]],["Triangle · bottom left 1",0,[0,18,6,24,0,24]],["Triangle · bottom left 2",0,[6,18,12,24,6,24]],["Triangle · bottom right 2",0,[18,24,24,18,24,24]]]],
  hourframe: ["Hourglass frame", [["Triangle · top left 1",1,[4,4,0,0,8,0]],["Triangle · top 1",1,[12,4,8,0,16,0]],["Triangle · top right 1",1,[20,4,16,0,24,0]],["Triangle · top left 2",0,[12,4,4,4,8,0]],["Triangle · top right 2",0,[12,4,16,0,20,4]],["Triangle · top left 3",1,[4,4,0,8,0,0]],["Triangle · top right 3",1,[20,4,24,0,24,8]],["Triangle · top left 4",1,[12,4,8,8,4,4]],["Triangle · top right 4",1,[12,4,20,4,16,8]],["Triangle · top left 5",0,[4,8,4,4,8,8]],["Triangle · top 2",0,[12,4,16,8,8,8]],["Triangle · top right 5",0,[20,4,20,8,16,8]],["Triangle · top left 6",0,[4,12,0,8,4,4]],["Triangle · top right 6",0,[20,4,24,8,20,12]],["Triangle · centre 1",2,[12,12,8,8,16,8]],["Triangle · left 1",1,[0,16,0,8,4,12]],["Triangle · left 2",0,[4,8,8,12,4,16]],["Hexagon · left",1,[4,8,8,8,12,12,8,16,4,16,8,12]],["Hexagon · right",1,[12,12,16,8,20,8,16,12,20,16,16,16]],["Triangle · right 1",0,[16,12,20,8,20,16]],["Triangle · right 2",1,[24,16,20,12,24,8]],["Triangle · centre 2",2,[12,12,16,16,8,16]],["Triangle · bottom left 1",0,[4,20,0,16,4,12]],["Triangle · bottom right 1",0,[20,20,20,12,24,16]],["Triangle · bottom left 2",0,[4,20,4,16,8,16]],["Triangle · bottom 1",0,[12,20,8,16,16,16]],["Triangle · bottom right 2",0,[20,20,16,16,20,16]],["Triangle · bottom left 3",1,[4,20,8,16,12,20]],["Triangle · bottom right 3",1,[20,20,12,20,16,16]],["Triangle · bottom left 4",1,[0,24,0,16,4,20]],["Triangle · bottom right 4",1,[20,20,24,16,24,24]],["Triangle · bottom left 5",0,[4,20,12,20,8,24]],["Triangle · bottom right 5",0,[20,20,16,24,12,20]],["Triangle · bottom left 6",1,[0,24,4,20,8,24]],["Triangle · bottom 2",1,[8,24,12,20,16,24]],["Triangle · bottom right 6",1,[20,20,24,24,16,24]]]],
  window: ["Window diamond", [["Square · top left 1",1,[4,4,0,4,0,0,4,0]],["Square · top left 2",0,[4,4,4,0,8,0,8,4]],["Rectangle · top 1",1,[16,4,8,4,8,0,16,0]],["Square · top right 1",0,[16,4,16,0,20,0,20,4]],["Square · top right 2",1,[20,4,20,0,24,0,24,4]],["Square · top left 3",0,[4,4,4,8,0,8,0,4]],["Square · top left 4",1,[4,4,8,4,8,8,4,8]],["Rectangle · top 2",0,[16,4,16,8,8,8,8,4]],["Square · top right 3",1,[16,4,20,4,20,8,16,8]],["Square · top right 4",0,[20,4,24,4,24,8,20,8]],["Triangle · centre 1",0,[8,12,8,8,12,8]],["Triangle · centre 2",0,[12,8,16,8,16,12]],["Triangle · centre 3",2,[8,12,12,8,12,12]],["Triangle · centre 4",2,[12,8,16,12,12,12]],["Rectangle · left 1",1,[0,16,0,8,4,8,4,16]],["Rectangle · left 2",0,[4,8,8,8,8,16,4,16]],["Rectangle · right 1",0,[20,8,20,16,16,16,16,8]],["Rectangle · right 2",1,[20,8,24,8,24,16,20,16]],["Triangle · centre 5",2,[8,12,12,12,12,16]],["Triangle · centre 6",2,[16,12,12,16,12,12]],["Triangle · centre 7",0,[8,12,12,16,8,16]],["Triangle · centre 8",0,[16,12,16,16,12,16]],["Square · bottom left 1",0,[4,20,0,20,0,16,4,16]],["Square · bottom left 2",1,[4,20,4,16,8,16,8,20]],["Rectangle · bottom 1",0,[8,20,8,16,16,16,16,20]],["Square · bottom right 1",1,[20,16,20,20,16,20,16,16]],["Square · bottom right 2",0,[20,16,24,16,24,20,20,20]],["Square · bottom left 3",1,[4,20,4,24,0,24,0,20]],["Square · bottom left 4",0,[4,20,8,20,8,24,4,24]],["Rectangle · bottom 2",1,[8,20,16,20,16,24,8,24]],["Square · bottom right 3",0,[20,24,16,24,16,20,20,20]],["Square · bottom right 4",1,[20,24,20,20,24,20,24,24]]]],
  totem: ["Totem", [["Triangle · top",1,[12,4,8,0,16,0]],["Hexagon · top left",0,[12,4,4,4,8,8,0,8,0,0,8,0]],["Hexagon · top right",0,[12,4,16,0,24,0,24,8,16,8,20,4]],["Trapezoid · top",1,[20,4,16,8,8,8,4,4]],["Triangle · centre 1",2,[16,8,12,12,8,8]],["Triangle · left",1,[0,16,0,8,4,12]],["Hexagon · left",0,[0,16,4,12,0,8,8,8,12,12,8,16]],["Hexagon · right",0,[24,16,16,16,12,12,16,8,24,8,20,12]],["Triangle · right",1,[24,16,20,12,24,8]],["Triangle · centre 2",2,[12,12,16,16,8,16]],["Trapezoid · bottom",1,[4,20,8,16,16,16,20,20]],["Hexagon · bottom left",0,[0,16,8,16,4,20,12,20,8,24,0,24]],["Hexagon · bottom right",0,[24,16,24,24,16,24,12,20,20,20,16,16]],["Triangle · bottom",1,[12,20,16,24,8,24]]]],
};
for (const [key, [label, parts]] of Object.entries(TRACED))
  PATTERNS[key] = { label, parts: () => parts.map(([n, role, f]) => P_(n, role, Array.from({ length: f.length / 2 }, (_, i) => [f[2 * i] / 24, f[2 * i + 1] / 24]))) };
// Blocks for medallion and sampler quilts
Object.assign(PATTERNS, {
  sqsq: { label: 'Square in a square', parts: () => {
    const c = [[.5, 0], [1, .5], [.5, 1], [0, .5]], names = ['top left', 'top right', 'bottom right', 'bottom left'];
    const out = [P_('Centre square', 1, c)];
    [[[0, 0], [.5, 0], [0, .5]], [[.5, 0], [1, 0], [1, .5]], [[1, .5], [1, 1], [.5, 1]], [[0, .5], [.5, 1], [0, 1]]].forEach((t, k) => out.push(P_('Corner ' + names[k], 0, t)));
    return out;
  } },
  economy: { label: 'Economy', parts: () => {
    const names = ['top left', 'top right', 'bottom right', 'bottom left'];
    const out = [P_('Centre square', 2, sq(.25, .25, .75, .75))];
    // first round: four triangles turning the centre on point
    [[[.25, .25], [.5, 0], [.75, .25]], [[.75, .25], [1, .5], [.75, .75]], [[.75, .75], [.5, 1], [.25, .75]], [[.25, .75], [0, .5], [.25, .25]]]
      .forEach((t, k) => out.push(P_('Inner triangle ' + ['top', 'right', 'bottom', 'left'][k], 1, t)));
    // second round: the outer corners square it up again
    [[[0, 0], [.5, 0], [0, .5]], [[.5, 0], [1, 0], [1, .5]], [[1, .5], [1, 1], [.5, 1]], [[0, .5], [.5, 1], [0, 1]]].forEach((t, k) => out.push(P_('Outer corner ' + names[k], 0, t)));
    return out;
  } },
  dnine: { label: 'Double nine patch', parts: () => {
    const out = [], t = 1 / 3, m = t / 3, cell = ['top left', 'top', 'top right', 'left', 'centre', 'right', 'bottom left', 'bottom', 'bottom right'];
    for (let J = 0; J < 3; J++) for (let I = 0; I < 3; I++) {
      const n = cell[J * 3 + I];
      if ((I + J) % 2) { out.push(P_('Plain ' + n, 0, sq(I * t, J * t, (I + 1) * t, (J + 1) * t))); continue; }
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
        out.push(P_(`Patch ${n} · ${cell[j * 3 + i]}`, (i + j) % 2 ? 0 : 1, sq(I * t + i * m, J * t + j * m, I * t + (i + 1) * m, J * t + (j + 1) * m)));
    }
    return out;
  } },
  sawstar: { label: 'Sawtooth star', parts: () => {
    const q = .25, out = [], names = ['top left', 'top right', 'bottom right', 'bottom left'];
    [[0, 0], [3, 0], [3, 3], [0, 3]].forEach(([i, j], k) => out.push(P_('Corner ' + names[k], 0, sq(i * q, j * q, (i + 1) * q, (j + 1) * q))));
    out.push(P_('Centre', 2, sq(q, q, 3 * q, 3 * q)));
    // one star-point unit (a flying goose pointing out) on each side, turned about the block centre
    const goose = [[q, q], [.5, 0], [3 * q, q]], skyL = [[q, 0], [.5, 0], [q, q]], skyR = [[.5, 0], [3 * q, 0], [3 * q, q]], sides = ['top', 'right', 'bottom', 'left'];
    for (let k = 0; k < 4; k++) out.push(P_('Point ' + sides[k], 1, rotPoly(goose, k)), P_('Sky ' + sides[k] + ' 1', 0, rotPoly(skyL, k)), P_('Sky ' + sides[k] + ' 2', 0, rotPoly(skyR, k)));
    return out;
  } },
});
const PCACHE = {};
const partsOf = name => (PCACHE[name] = PCACHE[name] || PATTERNS[name].parts());

// ---- fabric library (bundled scans + the user's photos)
const fabricLib = [];          // {id, name, canvas, cm}
const fabricById = id => fabricLib.find(f => f.id === id) || fabricLib[0];
let activeFabric = null;
async function initFabricLib() {
  if (fabricLib.length) return;
  const preps = await Promise.all(BUNDLED.map(prepareSwatch));
  preps.forEach((s, i) => fabricLib.push({ id: 'b' + i, name: s.name, canvas: s.canvas, cm: s.cm, print: !s.tint && !/linen/i.test(s.name) }));
}
const ROLE_DEFAULT = ['b0', 'b1', 'b3'];     // cream, indigo, mustard

// ---- design state
const DESIGN_KEY = 'quilt-designer.v1';
let design = null, selBlocks = new Set(), focusBlock = 0, selParts = new Set();
function newBlock(pattern = 'ohio', roles = ROLE_DEFAULT) {
  return { pattern, rot: 0, fabrics: partsOf(pattern).map(p => roles[p.role] || roles[0]) };
}
function defaultDesign() {
  const d = { cols: 5, rows: 5, blockMm: 458, backFabric: 'b0', blocks: [] };
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
    d.blocks.push((r + c) % 2 === 0 ? newBlock('ohio', ['b0', 'b1', 'b3']) : newBlock('nine', ['b0', 'b4', 'b3']));
  return d;
}
function loadDesign() {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null');
    if (d && d.cols && d.rows && Array.isArray(d.blocks) && d.blocks.length === d.cols * d.rows &&
        d.blocks.every(b => PATTERNS[b.pattern] && b.fabrics.length === partsOf(b.pattern).length)) {
      if (!(d.blockMm > 0)) d.blockMm = Math.round(2290 / d.cols);     // designs saved before block sizes existed
      if (!d.backFabric) d.backFabric = 'b0';
      return normalizeSpans(d);
    }
  } catch (e) {}
  return defaultDesign();
}
function saveDesign() { normalizeSpans(design); try { localStorage.setItem(DESIGN_KEY, JSON.stringify(design)); } catch (e) {} scheduleSync(); tlRecord(); }
function resizeDesign(cols, rows) {
  cols = Math.max(1, Math.min(20, cols | 0)); rows = Math.max(1, Math.min(20, rows | 0));
  const old = design, blocks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r < old.rows && c < old.cols) blocks.push(old.blocks[r * old.cols + c]);
    else {
      // new blocks continue the checkerboard of the nearest existing block pattern
      const src = old.blocks[Math.min(r, old.rows - 1) * old.cols + Math.min(c, old.cols - 1)];
      blocks.push(JSON.parse(JSON.stringify(src)));
    }
  }
  design = { cols, rows, blockMm: old.blockMm, backFabric: old.backFabric, blocks, ...(old.sashing ? { sashing: old.sashing } : {}), ...(old.borders ? { borders: old.borders } : {}), ...(old.sym ? { sym: old.sym } : {}), ...(old.quilting ? { quilting: old.quilting } : {}) };
  selBlocks = new Set([Math.min(focusBlock, blocks.length - 1)]); focusBlock = [...selBlocks][0]; selParts.clear();
  saveDesign(); renderDesigner();
}

// ---- drawing
// Fabric is drawn at its real size: each block is design.blockMm across.
// a print placed so its point (u, v) (fractions of one repeat) sits at (cx, cy): a fussy cut
function fabricFillAt(g, fab, pxPerCm, cx, cy, u, v) {
  const pat = g.createPattern(fab.canvas, 'repeat'), k = pxPerCm / (fab.canvas.width / fab.cm);
  pat.setTransform(new DOMMatrix().translate(cx, cy).scale(k).translate(-u * fab.canvas.width, -v * fab.canvas.height));
  return pat;
}
const polyCentre = p => { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; };
// the fill for part pi of block b drawn as poly: fussy-cut parts show the chosen spot of the print
function pieceFill(g, b, pi, poly, pxPerCm, seed) {
  const fab = fabricById(b.fabrics[pi]), f = b.fussy && b.fussy[pi];
  if (!f) return fabricFill(g, fab, pxPerCm, seed);
  const [cx, cy] = polyCentre(poly); return fabricFillAt(g, fab, pxPerCm, cx, cy, f[0], f[1]);
}
function fabricFill(g, fab, pxPerCm, seed) {
  const pat = g.createPattern(fab.canvas, 'repeat');
  const k = pxPerCm / (fab.canvas.width / fab.cm);
  const ox = (seed * 7919) % fab.canvas.width, oy = (seed * 104729) % fab.canvas.height;
  pat.setTransform(new DOMMatrix().scale(k).translate(-ox, -oy));
  return pat;
}
function blockPolys(b, x, y, w, h) {
  return partsOf(b.pattern).map(p => orientPoly(p.poly, b).map(([u, v]) => [x + u * w, y + v * h]));
}
function pathPoly(g, poly) { g.beginPath(); poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }
// ---- sashing: strips of fabric between the blocks (optionally all round the outside too), with
// cornerstones where strips cross. design.sashing = { mm, fabric, corner, border }; mm 0 = none.
const sashOf = d => { const s = d && d.sashing; return s && s.mm > 0 ? { mm: s.mm, fabric: s.fabric || 'b0', corner: s.corner || s.fabric || 'b0', border: !!s.border } : { mm: 0, fabric: 'b0', corner: 'b0', border: false }; };
// finished size of the quilt top in mm
// the centre (blocks + sashing), before any borders
function centreMm(d) {
  const s = sashOf(d), e = s.border ? 2 : 0;
  return { W: d.cols * d.blockMm + s.mm * (d.cols - 1 + e), H: d.rows * d.blockMm + s.mm * (d.rows - 1 + e) };
}
const bordersOf = d => (d && Array.isArray(d.borders) ? d.borders.filter(b => BORDER_TYPES[b.type] && b.mm > 0) : []);
const borderTotal = d => bordersOf(d).reduce((a, b) => a + b.mm, 0);
// finished size of the whole quilt top, borders included
function quiltMm(d) { const c = centreMm(d), t = borderTotal(d); return { W: c.W + 2 * t, H: c.H + 2 * t }; }
// ---- large blocks: an "anchor" block with span k covers k × k cells (and the sashing between them);
// the cells it covers keep their data but carry under = the anchor's index and are not drawn or cut
const spanOf = b => (b && b.span > 1 ? b.span : 1);
const anchorOf = (d, i) => { const b = d.blocks[i]; return b && b.under != null ? b.under : i; };
function normalizeSpans(d) {
  if (!d || !Array.isArray(d.blocks)) return d;
  const C = d.cols, R = d.rows, taken = new Array(C * R).fill(false);
  for (const b of d.blocks) delete b.under;
  d.blocks.forEach((b, i) => {
    const c = i % C, r = Math.floor(i / C);
    if (taken[i]) { delete b.span; return; }
    taken[i] = true;
    if (!(b.span > 1)) { delete b.span; return; }
    let k = Math.min(b.span, C - c, R - r);
    const free = k => { for (let y = r; y < r + k; y++) for (let x = c; x < c + k; x++) if ((x !== c || y !== r) && taken[y * C + x]) return false; return true; };
    while (k > 1 && !free(k)) k--;
    if (k <= 1) { delete b.span; return; }
    b.span = k;
    for (let y = r; y < r + k; y++) for (let x = c; x < c + k; x++) { const j = y * C + x; if (j !== i) { taken[j] = true; d.blocks[j].under = i; } }
  });
  return d;
}
// make block i span k × k cells: other large blocks in the way go back to single cells first
function setSpan(d, i, k) {
  const C = d.cols, c = i % C, r = Math.floor(i / C);
  k = Math.max(1, Math.min(k, C - c, d.rows - r));
  d.blocks.forEach((b, j) => {
    if (j === i || !(b.span > 1)) return;
    const cj = j % C, rj = Math.floor(j / C), kj = b.span;
    if (cj < c + k && cj + kj > c && rj < r + k && rj + kj > r) delete b.span;
  });
  if (k > 1) d.blocks[i].span = k; else delete d.blocks[i].span;
  normalizeSpans(d);
}
// where one grid cell (c, r) sits on a W × H drawing of the quilt
function cellRect(d, c, r, W, H) {
  const s = sashOf(d), q = quiltMm(d), kx = W / q.W, ky = H / q.H, off = (s.border ? s.mm : 0) + borderTotal(d);
  return { x: (off + c * (d.blockMm + s.mm)) * kx, y: (off + r * (d.blockMm + s.mm)) * ky, w: d.blockMm * kx, h: d.blockMm * ky };
}
// where block (c, r) sits: a large block covers its k × k cells; a covered cell answers with its large block
function blockRect(d, c, r, W, H) {
  let i = r * d.cols + c;
  const a = d.blocks ? anchorOf(d, i) : i;
  if (a !== i) { i = a; c = a % d.cols; r = Math.floor(a / d.cols); }
  const R = cellRect(d, c, r, W, H), k = d.blocks ? spanOf(d.blocks[i]) : 1;
  if (k === 1) return R;
  const s = sashOf(d), q = quiltMm(d), kx = W / q.W, ky = H / q.H, mm = k * d.blockMm + (k - 1) * s.mm;
  return { x: R.x, y: R.y, w: mm * kx, h: mm * ky };
}
// finished size (mm) of a block that spans k cells
const blockSizeMm = (d, k) => k * d.blockMm + (k - 1) * sashOf(d).mm;
// which block is at (x, y) on a W × H drawing (-1 on sashing or outside); a large block answers for all its area
function blockAt(d, x, y, W, H) {
  const s = sashOf(d), q = quiltMm(d), o = (s.border ? s.mm : 0) + borderTotal(d), mx = x / W * q.W - o, my = y / H * q.H - o, p = d.blockMm + s.mm;
  const c = Math.floor(mx / p), r = Math.floor(my / p);
  if (c < 0 || r < 0 || c >= d.cols || r >= d.rows) return -1;
  const a = anchorOf(d, r * d.cols + c), R = blockRect(d, c, r, W, H);
  return x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h ? a : -1;
}
// the sashing strips and cornerstones on a W × H drawing
function sashRects(d, W, H) {
  const s = sashOf(d); if (!s.mm) return [];
  const q = quiltMm(d), kx = W / q.W, ky = H / q.H, bt = borderTotal(d), off = (s.border ? s.mm : 0) + bt, p = d.blockMm + s.mm, out = [];
  const xs = [], ys = [];                                   // left / top edge of each sashing line, in mm
  if (s.border) { xs.push(bt); ys.push(bt); }
  for (let c = 1; c < d.cols; c++) xs.push(off + c * p - s.mm);
  for (let r = 1; r < d.rows; r++) ys.push(off + r * p - s.mm);
  if (s.border) { xs.push(q.W - bt - s.mm); ys.push(q.H - bt - s.mm); }
  for (const x of xs) for (let r = 0; r < d.rows; r++) out.push({ kind: 'sash', x: x * kx, y: (off + r * p) * ky, w: s.mm * kx, h: d.blockMm * ky });
  for (const y of ys) for (let c = 0; c < d.cols; c++) out.push({ kind: 'sash', x: (off + c * p) * kx, y: y * ky, w: d.blockMm * kx, h: s.mm * ky });
  for (const x of xs) for (const y of ys) out.push({ kind: 'corner', x: x * kx, y: y * ky, w: s.mm * kx, h: s.mm * ky });
  // strips and cornerstones inside a large block are not there: the block covers them
  const big = (d.blocks || []).map((b, i) => (b.span > 1 && b.under == null ? blockRect(d, i % d.cols, Math.floor(i / d.cols), W, H) : null)).filter(Boolean);
  if (!big.length) return out;
  return out.filter(rc => { const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2; return !big.some(B => cx > B.x && cx < B.x + B.w && cy > B.y && cy < B.y + B.h); });
}
// ---- borders: rings of fabric around the centre, innermost first; several can be stacked.
// Each side is drawn in its own frame: x along the side, y from the outer edge (0) to the inner edge (T).
const BORDER_TYPES = {
  plain:    { label: 'Plain strip', slots: ['Fabric', 'Corner squares'], mm: 100, unit: null },
  piano:    { label: 'Piano keys', slots: ['Key A', 'Key B', 'Corners'], mm: 100, unit: T => T / 2 },
  squares:  { label: 'Row of squares', slots: ['Square A', 'Square B', 'Corners'], mm: 64, unit: T => T },
  checker:  { label: 'Checkerboard', slots: ['Square A', 'Square B', 'Corners'], mm: 76, unit: T => T / 2 },
  sawtooth: { label: 'Sawtooth', slots: ['Teeth', 'Background', 'Corners'], mm: 64, unit: T => T },
  geese:    { label: 'Flying geese', slots: ['Geese', 'Sky', 'Corners'], mm: 76, unit: T => T / 2 },
};
const borderUnits = (b, L) => { const u = BORDER_TYPES[b.type].unit; return u ? Math.max(1, Math.round(L / u(b.mm))) : 1; };
// pieces of one border side, in the side's frame: [{poly, slot}]
function borderSidePieces(b, L) {
  const T = b.mm, out = [], n = borderUnits(b, L), u = L / n, R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (b.type === 'plain') { out.push({ poly: R(0, 0, L, T), slot: 0 }); return out; }
  for (let i = 0; i < n; i++) {
    const x0 = i * u, x1 = x0 + u, alt = i % 2;
    if (b.type === 'piano' || b.type === 'squares') out.push({ poly: R(x0, 0, x1, T), slot: alt });
    else if (b.type === 'checker') { out.push({ poly: R(x0, 0, x1, T / 2), slot: alt }); out.push({ poly: R(x0, T / 2, x1, T), slot: 1 - alt }); }
    else if (b.type === 'sawtooth') { out.push({ poly: [[x0, T], [x1, 0], [x1, T]], slot: 0 }); out.push({ poly: [[x0, 0], [x1, 0], [x0, T]], slot: 1 }); }
    else if (b.type === 'geese') {
      out.push({ poly: [[x0, 0], [x1, T / 2], [x0, T]], slot: 0 });
      out.push({ poly: [[x0, 0], [x1, 0], [x1, T / 2]], slot: 1 }); out.push({ poly: [[x0, T], [x1, T / 2], [x1, T]], slot: 1 });
    }
  }
  return out;
}
const borderFab = (b, slot) => (b.fabrics && b.fabrics[slot]) || (b.fabrics && b.fabrics[0]) || 'b0';
const borderCornerSlot = b => (b.type === 'plain' ? 1 : 2);
const plainButted = b => b.type === 'plain' && borderFab(b, 1) === borderFab(b, 0);   // no corner squares: long strips
// draw every border on a W × H drawing of the quilt
function drawBorders(g, d, W, H, pxPerCm, seams, biBase = 0) {
  const q = quiltMm(d), k = W / q.W, bs = bordersOf(d);
  let off = 0;
  // outermost first: borders[last] is the outer ring
  for (let bi = bs.length - 1; bi >= 0; bi--) {
    const b = bs[bi], T = b.mm, ox = off, oy = off, OW = q.W - 2 * off, OH = q.H - 2 * off;
    const sides = [
      { L: OW - 2 * T, tf: [ox + T, oy, 0] }, { L: OH - 2 * T, tf: [ox + OW, oy + T, 90] },
      { L: OW - 2 * T, tf: [ox + OW - T, oy + OH, 180] }, { L: OH - 2 * T, tf: [ox, oy + OH - T, 270] },
    ];
    let seed = 2000 + bi * 97;
    for (const sd of sides) {
      g.save(); g.scale(k, k); g.translate(sd.tf[0], sd.tf[1]); g.rotate(sd.tf[2] * Math.PI / 180);
      for (const pc of borderSidePieces(b, sd.L)) {
        g.fillStyle = fabricFill(g, fabricById(borderFab(b, pc.slot)), pxPerCm / k, seed++); pathPoly(g, pc.poly); g.fill(); dimUnlessHi(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, pc.slot), corner: false });
        if (seams) { g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = Math.max(1, W / 1400) / k; g.stroke(); }
      }
      g.restore();
    }
    // corners
    for (const [cx, cy] of [[ox, oy], [ox + OW - T, oy], [ox + OW - T, oy + OH - T], [ox, oy + OH - T]]) {
      g.fillStyle = fabricFill(g, fabricById(borderFab(b, borderCornerSlot(b))), pxPerCm, seed++); g.fillRect(cx * k, cy * k, T * k, T * k);
      g.beginPath(); g.rect(cx * k, cy * k, T * k, T * k); dimUnlessHi(g, { t: 'brd', bi: bi + biBase, fabric: borderFab(b, borderCornerSlot(b)), corner: !plainButted(b) });
      if (seams && !plainButted(b)) { g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = Math.max(1, W / 1400); g.strokeRect(cx * k, cy * k, T * k, T * k); }
    }
    off += T;
  }
}
// The quilt with its borders pulled apart: each border is drawn as its own ring with a gap around it,
// so several borders read separately. W is the width in px; gap the space between rings (px). Returns the height.
function explodedH(W, gap) { const q = quiltMm(design), n = bordersOf(design).length, k = (W - 2 * gap * n) / q.W; return Math.round(q.H * k + 2 * gap * n); }
// one border drawn as a ring filling the box (X, Y, BW, BH) in px at k px/mm; each side is laid out for its own length,
// so the units fit whatever the box (used to draw the borders pulled apart)
function drawRingPx(g, b, bi, X, Y, BW, BH, k) {
  const T = b.mm, Tp = T * k, Lw = (BW - 2 * Tp) / k, Lh = (BH - 2 * Tp) / k;
  const sides = [[Lw, X + Tp, Y, 0], [Lh, X + BW, Y + Tp, 90], [Lw, X + BW - Tp, Y + BH, 180], [Lh, X, Y + BH - Tp, 270]];
  let seed = 2000 + bi * 97;
  for (const [L, tx, ty, rot] of sides) {
    g.save(); g.translate(tx, ty); g.rotate(rot * Math.PI / 180); g.scale(k, k);
    for (const pc of borderSidePieces(b, L)) {
      const fab = borderFab(b, pc.slot);
      g.fillStyle = fabricFill(g, fabricById(fab), 10, seed++); pathPoly(g, pc.poly); g.fill(); dimUnlessHi(g, { t: 'brd', bi, fabric: fab, corner: false });
      g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 1 / k; g.stroke();
    }
    g.restore();
  }
  for (const [cx, cy] of [[X, Y], [X + BW - Tp, Y], [X + BW - Tp, Y + BH - Tp], [X, Y + BH - Tp]]) {
    const fab = borderFab(b, borderCornerSlot(b));
    g.fillStyle = fabricFill(g, fabricById(fab), k * 10, seed++); g.fillRect(cx, cy, Tp, Tp);
    g.beginPath(); g.rect(cx, cy, Tp, Tp); dimUnlessHi(g, { t: 'brd', bi, fabric: fab, corner: !plainButted(b) });
    if (!plainButted(b)) { g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 1; g.strokeRect(cx, cy, Tp, Tp); }
  }
}
function drawBordersExploded(g, W, gap, focus = -1) {
  const bs = bordersOf(design), n = bs.length, q = quiltMm(design), k = (W - 2 * gap * n) / q.W, H = explodedH(W, gap);
  const fade = (x, y, w, h, t) => { g.beginPath(); g.rect(x, y, w, h); if (t) g.rect(x + t, y + t, w - 2 * t, h - 2 * t); g.fillStyle = 'rgba(236,239,244,.78)'; g.fill('evenodd'); };
  let off = 0;                                   // px from the outside edge
  for (let i = n - 1; i >= 0; i--) {             // outermost first; each ring sits a gap inside the one around it
    const X = off, BW = W - 2 * off, BH = H - 2 * off, Tp = bs[i].mm * k;
    drawRingPx(g, bs[i], i, X, X, BW, BH, k);
    g.strokeStyle = 'rgba(40,30,20,.45)'; g.lineWidth = 1; g.strokeRect(X + .5, X + .5, BW - 1, BH - 1); g.strokeRect(X + Tp - .5, X + Tp - .5, BW - 2 * Tp + 1, BH - 2 * Tp + 1);
    if (focus >= 0 && i !== focus) fade(X, X, BW, BH, Tp);
    off += Tp + gap;
  }
  // the quilt inside all the borders
  const keep = design; design = { ...design, borders: [] };
  try { g.save(); g.translate(off, off); drawQuilt(g, W - 2 * off, H - 2 * off, { seams: true }); if (focus >= 0) fade(0, 0, W - 2 * off, H - 2 * off, 0); g.restore(); } finally { design = keep; }
  return H;
}
function drawQuilt(g, W, H, opts = {}) {
  if (bordersOf(design).length) drawBorders(g, design, W, H, W / (quiltMm(design).W / 10), opts.seams);
  const d = design, q = quiltMm(d), pxPerCm = W / (q.W / 10), s = sashOf(d);
  for (const [k, rc] of sashRects(d, W, H).entries()) {
    g.fillStyle = fabricFill(g, fabricById(rc.kind === 'corner' ? s.corner : s.fabric), pxPerCm, 900 + k);
    g.fillRect(rc.x, rc.y, rc.w, rc.h);
    g.beginPath(); g.rect(rc.x, rc.y, rc.w, rc.h); dimUnlessHi(g, { t: 'sash', kind: rc.kind });
    if (opts.seams) { g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = Math.max(1, W / 1400); g.strokeRect(rc.x, rc.y, rc.w, rc.h); }
  }
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++) {
    const bi = r * d.cols + c, b = d.blocks[bi]; if (b.under != null) continue;
    const R = blockRect(d, c, r, W, H), polys = blockPolys(b, R.x, R.y, R.w, R.h);
    polys.forEach((poly, pi) => {
      g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, bi * 31 + pi);
      pathPoly(g, poly); g.fill(); dimUnlessHi(g, { t: 'qpiece', fabric: b.fabrics[pi] });
    });
    if (opts.seams) {
      g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = Math.max(1, W / 1400);
      polys.forEach(poly => { pathPoly(g, poly); g.stroke(); });
    }
  }
}
function drawDesignerCanvas() {
  if (!design) return;
  const cv = $('dz-quilt'), box = cv.closest('.dz-quiltwrap').getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2), qmm = quiltMm(design), ar = qmm.H / qmm.W;
  // the preview has the quilt's real proportions (square blocks), and fits the screen
  let cw = Math.max(200, Math.floor(Math.min(box.width - (window.innerWidth > 640 ? 128 : 0), 860)));
  let maxH = Math.max(320, Math.floor(window.innerHeight * 0.82));
  if (document.body.classList.contains('tl-open')) {      // keep the whole quilt above the timeline bar
    const docTop0 = cv.closest('.dz-quiltwrap').getBoundingClientRect().top + window.scrollY;
    maxH = Math.max(240, Math.floor(window.innerHeight - docTop0 - ($('tl-panel').offsetHeight || 0) - 92));
  }
  // with the tools open on a wide screen the quilt column is pinned: the quilt must fit the window
  if ($('dz').classList.contains('tools-open') && window.innerWidth > 920) {
    // fit below the page header without any page scrolling: the page stays still, only the tools scroll
    const docTop = cv.closest('.dz-quiltwrap').getBoundingClientRect().top + window.scrollY;
    const tlH = document.body.classList.contains('tl-open') ? $('tl-panel').offsetHeight : 0;
    maxH = Math.max(240, Math.floor(window.innerHeight - docTop - 160 - tlH));     // room for the two lines under the quilt and the page's bottom margin
    const side = $('dz-side'), sideTop = side.getBoundingClientRect().top + window.scrollY;
    side.style.maxHeight = Math.max(240, Math.floor(window.innerHeight - sideTop - 40 - tlH)) + 'px';
  } else { $('dz-side').style.maxHeight = '';
  }
  if (cw * ar > maxH) cw = Math.floor(maxH / ar);
  const ch = Math.round(cw * ar);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * dpr); cv.height = Math.floor(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, cw, ch, { seams: true });
  // the quilting stitches, as thread on the top
  const qk = quiltingOf(design);
  if (qk !== 'ditch') { g.save(); g.setLineDash([Math.max(2, cw / 300), Math.max(1.5, cw / 420)]); g.lineWidth = Math.max(0.7, cw / 1000);
    g.strokeStyle = 'rgba(40,30,20,.28)'; g.translate(0.6, 0.6); drawQuiltingLines(g, cw, ch, qk); g.translate(-0.6, -0.6); g.strokeStyle = 'rgba(255,255,255,.5)'; drawQuiltingLines(g, cw, ch, qk); g.restore(); }
  // binding
  g.strokeStyle = '#2f466f'; g.lineWidth = Math.max(3, cw * 0.006); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  // the selection frame shows only while blocks are being edited; otherwise only the hover marks a block
  const editing = $('dz-dialog').open || $('dz-partdlg').open || editorInSide || selBlocks.size > 1;
  if (editing) for (const bi of selBlocks) {
    const R = blockRect(design, bi % design.cols, Math.floor(bi / design.cols), cw, ch);
    g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.strokeRect(R.x + 1.5, R.y + 1.5, R.w - 3, R.h - 3);
    g.lineWidth = 1.5; g.strokeStyle = bi === focusBlock ? '#e0592a' : '#1b2233'; g.setLineDash(bi === focusBlock ? [] : [5, 4]);
    g.strokeRect(R.x + 1.5, R.y + 1.5, R.w - 3, R.h - 3); g.setLineDash([]);
  }
  // symmetry axes (dashed) while a symmetry is on: the lines the design is mirrored across
  const sy = symOf(design);
  if (sy !== 'off') {
    const bt = borderTotal(design) * cw / quiltMm(design).W, x0 = bt, y0 = bt, x1 = cw - bt, y1 = ch - bt, mx = cw / 2, my = ch / 2;
    g.save(); g.setLineDash([8, 6]); g.lineCap = 'round';
    const line = (a, b, c, d) => { for (const [w, col] of [[4, 'rgba(255,255,255,.85)'], [2, '#e0592a']]) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); } };
    if (sy !== 'tb') line(mx, y0, mx, y1);
    if (sy !== 'lr') line(x0, my, x1, my);
    if (sy === 'kal') { line(x0, y0, x1, y1); line(x1, y0, x0, y1); }
    g.restore();
  }
  const sz = sashOf(design);
  const nb = bordersOf(design).length;
  $('dz-size-b').textContent = `${sz.mm ? ` · ${sz.mm} mm sashing${sz.border ? ' with border' : ''}` : ''}${nb ? ` · ${nb} border${nb > 1 ? 's' : ''} (${borderTotal(design)} mm)` : ''} · finished quilt ${qmm.W} × ${qmm.H} mm`;
  drawBackCanvas(cw, ch, dpr);
  const hv = $('dz-hover'); hv.style.width = cw + 'px'; hv.style.height = ch + 'px'; hv.width = Math.floor(cw * dpr); hv.height = Math.floor(ch * dpr);
  drawHover();
}
// The back: one backing fabric at real scale, the quilting stitches showing
// through (mirrored left to right, as on a real quilt turned over) and the
// binding folded round the edge.
function drawBackCanvas(cw, ch, dpr) {
  const cv = $('dz-back');
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.width = Math.floor(cw * dpr); cv.height = Math.floor(ch * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pxPerCm = cw / (quiltMm(design).W / 10);
  g.fillStyle = fabricFill(g, fabricById(design.backFabric), pxPerCm, 7); g.fillRect(0, 0, cw, ch);
  // stitch-in-the-ditch lines, mirrored
  g.save(); g.translate(cw, 0); g.scale(-1, 1);
  g.setLineDash([Math.max(2, cw / 260), Math.max(2, cw / 360)]);
  g.lineWidth = Math.max(0.8, cw / 900); g.strokeStyle = 'rgba(40,30,20,.45)';
  strokeSeams(g, cw, ch);
  if (quiltingOf(design) !== 'ditch') drawQuiltingLines(g, cw, ch, quiltingOf(design));
  g.setLineDash([]); g.restore();
  // soft loft shading between the stitches
  g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, cw, ch);
  // binding wraps round to the back
  g.strokeStyle = '#2f466f'; g.lineWidth = Math.max(4, cw * 0.009); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  $('dz-backname').textContent = fabricById(design.backFabric).name;
}
let flipped = false;
function turnQuilt() {
  flipped = !flipped;
  const f = $('dz-flipper');
  f.classList.remove('lift'); void f.offsetWidth; f.classList.add('lift');      // restart the lift animation
  f.classList.toggle('flipped', flipped);
  $('dz-flip').title = flipped ? 'Show the front of the quilt' : 'Turn over: show the back of the quilt'; $('dz-flip').setAttribute('aria-label', flipped ? 'Show the front' : 'Turn over');
  $('dz-flip').setAttribute('aria-pressed', String(flipped));
  $('dz-backbar').hidden = !flipped;
  $('dz-quilt').setAttribute('aria-hidden', String(flipped)); $('dz-back').setAttribute('aria-hidden', String(!flipped));
  if (flipped) drawPaletteInto($('dz-backfabs'), design.backFabric);
}
const BLOCK_PX = 300;
// ---- fussy cut: with one part selected in a printed fabric, click the print to choose what shows in that part
function drawFussy() {
  const box = $('dz-fussy'); if (!box || !design) return;
  const b = design.blocks[focusBlock], pi = selParts.size === 1 ? [...selParts][0] : -1, fab = pi >= 0 ? fabricById(b.fabrics[pi]) : null;
  box.hidden = !(fab && fab.print);
  if (box.hidden) return;
  const cv = $('dz-fussy-cv'), S = 170, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = S * dpr; cv.height = S * dpr; cv.style.width = S + 'px'; cv.style.height = S + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(fab.canvas, 0, 0, S, S);                                   // one repeat of the print
  const f = b.fussy && b.fussy[pi];
  $('dz-fussy-st').textContent = f ? 'Fussy cut: the outline shows the part of the print that will be in this piece. Click or drag to move it.' : 'Click the print to choose which part of it shows in this piece (a fussy cut).';
  $('dz-fussy-clear').hidden = !f;
  if (!f) return;
  // the piece at its real size on this repeat (the repeat is fab.cm wide)
  const size = blockSizeMm(design, spanOf(b)) / 10, k = S / fab.cm;
  const poly = orientPoly(partsOf(b.pattern)[pi].poly, b).map(([u, v]) => [u * size * k, v * size * k]), [cx, cy] = polyCentre(poly);
  const offs = [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S]].map(([dx, dy]) => poly.map(([x, y]) => [x + f[0] * S - cx + dx, y + f[1] * S - cy + dy]));
  g.save(); g.beginPath(); g.rect(0, 0, S, S); for (const p of offs) pathPolyInto(g, p);
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fill('evenodd');
  for (const p of offs) { pathPoly(g, p); g.lineWidth = 2; g.strokeStyle = '#e0592a'; g.stroke(); }
  g.restore();
}
function setFussy(u, v) {
  const pi = [...selParts][0];
  eachSelected(b => { if (b.pattern === design.blocks[focusBlock].pattern) { b.fussy = b.fussy || {}; if (u == null) delete b.fussy[pi]; else b.fussy[pi] = [u, v]; if (!Object.keys(b.fussy).length) delete b.fussy; } });
  symApply([...selBlocks]); saveDesign(); drawDesignerCanvas(); drawPartsEditor();
}
{
  const cv = $('dz-fussy-cv'); let drag = false;
  const at = e => { const r = cv.getBoundingClientRect(); setFussy(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); };
  cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); at(e); });
  cv.addEventListener('pointermove', e => { if (drag) at(e); });
  cv.addEventListener('pointerup', () => { drag = false; });
  $('dz-fussy-clear').addEventListener('click', () => setFussy(null));
}
function drawPartsEditor() {
  if (!design) return;
  drawBlockLibrary();
  const cv = $('dz-block'), css = BLOCK_PX, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = cv.height = css * dpr; cv.style.width = css + 'px'; cv.style.height = 'auto';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, css, css);
  const b = design.blocks[focusBlock], polys = blockPolys(b, 0, 0, css, css);
  const realCm = design.blockMm / 10, pxPerCm = css / realCm;
  polys.forEach((poly, pi) => { g.fillStyle = pieceFill(g, b, pi, poly, pxPerCm, focusBlock * 31 + pi); pathPoly(g, poly); g.fill(); });
  polys.forEach((poly, pi) => {
    pathPoly(g, poly);
    if (selParts.has(pi)) {
      g.fillStyle = 'rgba(224,89,42,.28)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
      g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.stroke();
    } else { g.lineWidth = 1; g.strokeStyle = 'rgba(20,20,20,.45)'; g.stroke(); }
  });
  const names = [...selParts].map(i => partsOf(b.pattern)[i].name);
  $('dz-parts-info').textContent = selParts.size === 0 ? 'Click a part to select it, or double-click to select every part in the same fabric. Then pick a fabric.'
    : selParts.size === 1 ? `Selected: ${names[0]} · ${fabricById(b.fabrics[[...selParts][0]]).name}${b.fussy && b.fussy[[...selParts][0]] ? ' · fussy cut' : ''}` : `${selParts.size} parts selected`;
  drawFussy();
  $('dz-blockname').textContent = `${PATTERNS[b.pattern].label} · block ${Math.floor(focusBlock / design.cols) + 1}, ${focusBlock % design.cols + 1}` + (selBlocks.size > 1 ? ` · editing ${selBlocks.size} blocks` : '');
}
function drawPatternButtons() {
  if (!design) return;
  const box = $('dz-patterns');
  if (!box.childElementCount) {
    for (const [key, p] of Object.entries(PATTERNS)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pat'; b.dataset.p = key; b.title = p.label;
      const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      const cols = ['#efe5cf', '#2f466f', '#c79a45'];
      partsOf(key).forEach(part => { g.fillStyle = cols[part.role]; pathPoly(g, part.poly.map(([u, v]) => [u * 96, v * 96])); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(); });
      const s = document.createElement('span'); s.textContent = p.label;
      b.append(c, s); box.appendChild(b);
    }
  }
  const cur = design.blocks[focusBlock].pattern;
  for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.p === cur));
}
function drawFabricPalette() {
  for (const id of ['dz-fabrics', 'dz-fabrics2']) if ($(id)) drawPaletteInto($(id));
  if (design) drawPaletteInto($('dz-backfabs'), design.backFabric);
}
function drawPaletteInto(box, selected = activeFabric) {
  box.innerHTML = '';
  for (const f of fabricLib) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fab'; b.dataset.f = f.id; b.title = f.name;
    const c = document.createElement('canvas'); c.width = c.height = 64; const k = Math.min(f.canvas.width, f.canvas.height, 360);
    c.getContext('2d').drawImage(f.canvas, 0, 0, k, k, 0, 0, 64, 64);
    const s = document.createElement('span'); s.textContent = f.name;
    b.append(c, s);
    b.setAttribute('aria-pressed', String(f.id === selected));
    box.appendChild(b);
  }
}
function renderDesigner() {
  if (!design) return;
  normalizeSpans(design);
  if (design.blocks[focusBlock] && design.blocks[focusBlock].under != null) focusBlock = design.blocks[focusBlock].under;
  $('dz-cols').value = design.cols; $('dz-rows').value = design.rows;
  syncSymUI();
  for (const id of ['dz-bmm3']) if (document.activeElement !== $(id)) $(id).value = design.blockMm;
  $('dz-rot').textContent = `Rotate 90° (${design.blocks[focusBlock].rot * 90}°)`;
  $('dz-rot2').textContent = `Rotate 90° · now ${design.blocks[focusBlock].rot * 90}°`;
  const ps = $('dz-patsel');
  if (!ps.options.length) for (const [k, p] of Object.entries(PATTERNS)) ps.add(new Option(p.label, k));
  ps.value = design.blocks[focusBlock].pattern;
  updatePatPicker();
  drawDesignerCanvas(); drawPartsEditor(); drawPatternButtons(); renderFitSuggestions(); tlEnsure(); if (typeof renderSashUI === 'function') renderSashUI(); if (typeof renderBorderUI === 'function') renderBorderUI();
}

// ---- interaction
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// ---- library of the distinct blocks in the quilt (pop-up)
// Two blocks count as the same when they look the same: same fabric on the same piece positions,
// whatever pattern rotation produced them (a symmetric block turned 90° is still the same block).
const bkCache = new Map();
const blockKey = b => {
  const raw = b.pattern + '|' + b.rot + (b.flip ? 'f' : '') + '|' + b.fabrics.join(',') + (b.fussy ? '|' + JSON.stringify(b.fussy) : '');
  let k = bkCache.get(raw);
  if (!k) {
    k = blockPolys(b, 0, 0, 1, 1).map((p, i) => b.fabrics[i] + ':' + p.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).sort().join(';')).sort().join('|');
    if (bkCache.size > 5000) bkCache.clear();
    bkCache.set(raw, k);
  }
  return k;
};
function drawBlockLibrary() {
  const box = $('dz-library'); if (!box || !design) return;
  const seen = new Map();
  design.blocks.forEach((b, i) => { if (b.under != null) return; const k = blockKey(b); if (!seen.has(k)) seen.set(k, { b, i, n: 0 }); seen.get(k).n++; });
  const cur = blockKey(design.blocks[focusBlock]);
  box.innerHTML = '';
  const dpr = Math.min(window.devicePixelRatio || 1, 2), S = 68, realCm = design.blockMm / 10;
  for (const [k, { b, i, n }] of seen) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'blib-item'; btn.dataset.src = i;
    btn.setAttribute('aria-pressed', String(k === cur));
    btn.title = `${PATTERNS[b.pattern].label} · used ${n}×`;
    const c = document.createElement('canvas'); c.width = c.height = S * dpr;
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    blockPolys(b, 0, 0, S, S).forEach((poly, pi) => { g.fillStyle = pieceFill(g, b, pi, poly, S / realCm, i * 31 + pi); pathPoly(g, poly); g.fill(); });
    g.lineWidth = 0.75; g.strokeStyle = 'rgba(255,255,255,.7)'; blockPolys(b, 0, 0, S, S).forEach(poly => { pathPoly(g, poly); g.stroke(); });
    const s = document.createElement('span'); s.textContent = `${PATTERNS[b.pattern].label} ×${n}`;
    btn.append(c, s); box.appendChild(btn);
  }
}
function copyBlockFrom(srcIndex) {
  const src = JSON.parse(JSON.stringify(design.blocks[srcIndex]));
  eachSelected((b, bi) => { const k = b.span; design.blocks[bi] = JSON.parse(JSON.stringify(src)); if (k > 1) design.blocks[bi].span = k; else delete design.blocks[bi].span; });
  symApply([...selBlocks]);
  selParts.clear(); saveDesign(); renderDesigner();
}
let partTap = null;
function selectSameFabric(pi) {
  const b = design.blocks[focusBlock], ref = b.fabrics[pi];
  selParts = new Set(b.fabrics.map((f, i) => f === ref ? i : -1).filter(i => i >= 0));
  drawPartsEditor();
}
// The block editor lives in the pop-up while the design tools are hidden. When the tools are
// shown it moves into the side panel instead, and clicking a block just edits it there.
let editorInSide = false, toolsSnap = null, showTools = () => {}, showToolsPanel = () => {}, hideTools = () => {}, toolsPanel = null;
const PANEL_CARDS = { parts: 'dz-sideparts', sash: 'sash-card', brd: 'brd-card' };
function syncRail() { for (const n of Object.keys(PANEL_CARDS)) { const b = $('rail-' + n); if (b) b.setAttribute('aria-pressed', String(!$('dz-side').hidden && toolsPanel === n)); } }
function placeBlockEditor(side) {
  editorInSide = side;
  const dlg = $('dz-dialog'), card = $('dz-sideparts');
  if (side) {
    if (dlg.open) dlg.close();
    card.append($('dz-partsbox'), $('dz-fabbox'), $('dz-libbox'), $('dz-patbox'));    // fabrics right under the block, pattern choice last
    if (typeof syncPartsTitle === 'function') syncPartsTitle();
  } else {
    dlg.insertBefore($('dz-libbox'), dlg.querySelector('.dlg-foot'));
    dlg.insertBefore($('dz-fabbox'), $('dz-libbox'));
    dlg.insertBefore($('dz-partsbox'), $('dz-fabbox'));
    if (typeof syncPartsTitle === 'function') syncPartsTitle();
  }
}
function openBlockEditor() {
  const dlg = $('dz-dialog');
  drawPartsEditor(); drawFabricPalette();
  showTools();        // a block always opens in the side panel's Block parts (there is no block pop-up any more)
  if (editorInSide) {
    if ($('dz-sideparts').classList.contains('folded')) setFold($('dz-sideparts'), 'dz:block parts', false);
    // on narrow screens the side panel sits below the quilt: bring the editor into view
    const card = $('dz-sideparts'), r = card.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  clearHover();
  if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  drawDesignerCanvas();
}
function updateMultiUI() {}      // (the "Select several" mode was removed; kept as a no-op for callers)
function eachSelected(fn) { for (const bi of selBlocks) if (design.blocks[bi].under == null) fn(design.blocks[bi], bi); }
// ---- symmetry: an edit to a block is copied to its mirror partners, mirrored to match
// sym: 'off' | 'lr' (left-right) | 'tb' (top-bottom) | 'both' (4-way) | 'kal' (8-way, square layouts only)
const SYMS = { off: 'Off', lr: 'Mirror left–right', tb: 'Mirror top–bottom', both: 'Mirror both ways (4-way)', kal: 'Kaleidoscope (8-way)' };
const symOf = d => { const s = d && d.sym; return s === 'kal' && d.cols !== d.rows ? 'both' : (SYMS[s] ? s : 'off'); };
// orientation algebra: M = F^flip ∘ R^rot, R = quarter turn, F = left-right mirror
const oLR = o => ({ rot: o.rot, flip: !o.flip });
const oTB = o => ({ rot: (o.rot + 2) % 4, flip: !o.flip });
const oDiag = o => o.flip ? { rot: (o.rot + 3) % 4, flip: false } : { rot: (o.rot + 1) % 4, flip: true };   // transpose (main diagonal)
// partners of block bi: [[index, orientation transform], ...]
function symPartners(bi, d = design) {
  const s = symOf(d); if (s === 'off') return [];
  const C = d.cols, Rr = d.rows, c = bi % C, r = Math.floor(bi / C), out = [], k = spanOf(d.blocks[bi]);
  const add = (cc, rr, f) => { const j = rr * C + cc; if (j !== bi && !out.some(x => x[0] === j)) out.push([j, f]); };
  const id = o => o, comp = (f, g) => o => f(g(o));
  const base = [[c, r, id]];
  if (s === 'lr' || s === 'both' || s === 'kal') base.push([C - k - c, r, oLR]);
  if (s === 'tb' || s === 'both' || s === 'kal') base.push([c, Rr - k - r, oTB]);
  if (s === 'both' || s === 'kal') base.push([C - k - c, Rr - k - r, comp(oLR, oTB)]);
  for (const [cc, rr, f] of base) { add(cc, rr, f); if (s === 'kal') add(rr, cc, comp(oDiag, f)); }
  return out;
}
function symApply(sources) {
  if (symOf(design) === 'off') return;
  const done = new Set();
  for (const bi of sources) {
    if (done.has(bi)) continue;
    const src = design.blocks[bi]; if (src.under != null) continue;
    const o = { rot: src.rot || 0, flip: !!src.flip };
    for (const [j, f] of symPartners(bi)) {
      if (sources.includes(j) && j !== bi && done.has(j)) continue;
      const t = f(o), nb = JSON.parse(JSON.stringify(src)); nb.rot = t.rot; if (t.flip) nb.flip = true; else delete nb.flip;
      if (spanOf(src) > 1) { design.blocks[j] = nb; setSpan(design, j, spanOf(src)); } else { delete nb.span; design.blocks[j] = nb; }
      done.add(j);
    }
    done.add(bi);
  }
  normalizeSpans(design);
}
function applyFabric(fid) {
  activeFabric = fid;
  if (!selParts.size) { drawFabricPalette(); openBlockEditor(); $('dz-parts-info').textContent = 'Select one or more parts first, then pick a fabric.'; return; }
  const focus = design.blocks[focusBlock];
  eachSelected(b => { if (b.pattern === focus.pattern) for (const pi of selParts) b.fabrics[pi] = fid; });
  symApply([...selBlocks]);
  saveDesign(); drawFabricPalette(); drawDesignerCanvas(); drawPartsEditor();
}
function setPattern(key) {
  // carry the focused block's colours over to the new pattern, role by role
  const b0 = design.blocks[focusBlock], roles = [...ROLE_DEFAULT], seen = [false, false, false];
  partsOf(b0.pattern).forEach((p, i) => { if (!seen[p.role]) { roles[p.role] = b0.fabrics[i]; seen[p.role] = true; } });
  eachSelected((b, bi) => { design.blocks[bi] = { ...newBlock(key, roles), rot: b.rot, ...(b.flip ? { flip: true } : {}), ...(b.span > 1 ? { span: b.span } : {}) }; });
  symApply([...selBlocks]);
  selParts.clear(); saveDesign(); renderDesigner();
}

function initDesignerUI() {
  // ---- area selection: drag a dotted rectangle; every block it touches is selected
  const qcv = $('dz-quilt'), mq = $('dz-marquee');
  let marquee = null, suppressClick = false, mqFrame = 0;
  const blocksIn = (x0, y0, x1, y1) => {
    const r = qcv.getBoundingClientRect(), out = new Set();
    const L = Math.min(x0, x1), R2 = Math.max(x0, x1), T = Math.min(y0, y1), B2 = Math.max(y0, y1);
    for (let rr = 0; rr < design.rows; rr++) for (let cc = 0; cc < design.cols; cc++) {
      const b = blockRect(design, cc, rr, r.width, r.height);          // every block the rectangle touches
      if (b.x < R2 && b.x + b.w > L && b.y < B2 && b.y + b.h > T) out.add(anchorOf(design, rr * design.cols + cc));
    }
    return out;
  };
  qcv.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (flipped || e.button !== 0 || !design) return;
    if (e.pointerType === 'touch') return;          // on phones a drag scrolls the page
    const r = qcv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    marquee = { id: e.pointerId, x0: x, y0: y, x1: x, y1: y, active: false,
                base: (e.shiftKey || e.ctrlKey || e.metaKey) ? new Set(selBlocks) : new Set() };
  });
  qcv.addEventListener('pointermove', e => {
    if (!marquee || e.pointerId !== marquee.id) return;
    const r = qcv.getBoundingClientRect();
    marquee.x1 = Math.max(0, Math.min(r.width, e.clientX - r.left)); marquee.y1 = Math.max(0, Math.min(r.height, e.clientY - r.top));
    if (!marquee.active && Math.hypot(marquee.x1 - marquee.x0, marquee.y1 - marquee.y0) > 6) {
      marquee.active = true; qcv.setPointerCapture(e.pointerId); mq.hidden = false;
    }
    if (!marquee.active) return;
    e.preventDefault();
    const { x0, y0, x1, y1 } = marquee;
    Object.assign(mq.style, { left: Math.min(x0, x1) + 'px', top: Math.min(y0, y1) + 'px', width: Math.abs(x1 - x0) + 'px', height: Math.abs(y1 - y0) + 'px' });
    const inside = blocksIn(x0, y0, x1, y1);
    mq.dataset.count = `${inside.size} block${inside.size === 1 ? '' : 's'}`;
    if (!mqFrame) mqFrame = requestAnimationFrame(() => {      // live highlight, at most once per frame
      mqFrame = 0; if (!marquee) return;
      selBlocks = new Set([...marquee.base, ...blocksIn(marquee.x0, marquee.y0, marquee.x1, marquee.y1)]);
      drawDesignerCanvas();
    });
  });
  const endMarquee = (e, cancel) => {
    if (!marquee || e.pointerId !== marquee.id) return;
    const m0 = marquee; marquee = null; mq.hidden = true;
    if (!m0.active) return;                                       // a plain click: the click handler opens the block
    suppressClick = true;
    if (cancel) { selBlocks = m0.base.size ? m0.base : new Set([focusBlock]); drawDesignerCanvas(); return; }
    const inside = blocksIn(m0.x0, m0.y0, m0.x1, m0.y1);
    selBlocks = new Set([...m0.base, ...inside]);
    if (!selBlocks.size) selBlocks = new Set([focusBlock]);
    focusBlock = inside.size ? Math.min(...inside) : [...selBlocks][0];
    selParts.clear();
    renderDesigner(); updateMultiUI();
    openBlockEditor();
  };
  qcv.addEventListener('pointerup', e => endMarquee(e, false));
  qcv.addEventListener('pointercancel', e => endMarquee(e, true));
  qcv.addEventListener('click', e => {
    if (flipped) return;
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  $('dz-quilt').addEventListener('click', e => {
    if (flipped || e.defaultPrevented) return;
    const r = e.currentTarget.getBoundingClientRect();
    const bi = blockAt(design, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    if (bi < 0) {          // a click on a border or the sashing opens its settings
      const q = quiltMm(design), bt = borderTotal(design), mx = (e.clientX - r.left) / r.width * q.W, my = (e.clientY - r.top) / r.height * q.H;
      if (bt && (mx < bt || my < bt || mx > q.W - bt || my > q.H - bt)) openBorders(); else if (sashOf(design).mm) openSashing();
      return;
    }
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const prevPattern = design.blocks[focusBlock].pattern;
    if (multi) { if (selBlocks.has(bi) && selBlocks.size > 1) selBlocks.delete(bi); else selBlocks.add(bi); }
    else if (!selBlocks.has(bi) || selBlocks.size <= 1) selBlocks = new Set([bi]);
    focusBlock = selBlocks.has(bi) ? bi : [...selBlocks][0];
    if (design.blocks[focusBlock].pattern !== prevPattern || !multi) selParts.clear();
    renderDesigner();
    if (!multi) openBlockEditor();
    updateMultiUI();
  });
  $('dz-block').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * BLOCK_PX, y = (e.clientY - r.top) / r.height * BLOCK_PX;
    const polys = blockPolys(design.blocks[focusBlock], 0, 0, BLOCK_PX, BLOCK_PX);
    const hit = polys.findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    const now = performance.now(), last = partTap;
    partTap = { t: now, hit };
    if (last && last.hit === hit && now - last.t < 380) { selectSameFabric(hit); partTap = null; return; }
    if (e.shiftKey || e.ctrlKey || e.metaKey) { selParts.has(hit) ? selParts.delete(hit) : selParts.add(hit); }
    else if (selParts.size === 1 && selParts.has(hit)) selParts.clear();
    else selParts = new Set([hit]);
    drawPartsEditor();
  });
  // double-click a part: select every part cut from the same fabric
  $('dz-block').addEventListener('dblclick', e => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * BLOCK_PX, y = (e.clientY - r.top) / r.height * BLOCK_PX;
    const b = design.blocks[focusBlock], hit = blockPolys(b, 0, 0, BLOCK_PX, BLOCK_PX).findIndex(p => pointInPoly(x, y, p));
    if (hit < 0) return;
    selectSameFabric(hit);
  });
  $('dz-allparts').addEventListener('click', () => { selParts = new Set(partsOf(design.blocks[focusBlock].pattern).map((_, i) => i)); drawPartsEditor(); });
  $('dz-sameparts').addEventListener('click', () => {
    const b = design.blocks[focusBlock], ref = selParts.size ? b.fabrics[[...selParts][0]] : null;
    if (ref === null) { $('dz-parts-info').textContent = 'Select one part first; this then selects every part with the same fabric.'; return; }
    selParts = new Set(b.fabrics.map((f, i) => f === ref ? i : -1).filter(i => i >= 0)); drawPartsEditor();
  });
  $('dz-noparts').addEventListener('click', () => { selParts.clear(); drawPartsEditor(); });
  $('dz-allblocks').addEventListener('click', () => { selBlocks = new Set(design.blocks.map((_, i) => i)); drawDesignerCanvas(); drawPartsEditor(); updateMultiUI(); });
  $('dz-sameblocks').addEventListener('click', () => {
    const p = design.blocks[focusBlock].pattern;
    selBlocks = new Set(design.blocks.map((b, i) => b.pattern === p ? i : -1).filter(i => i >= 0)); drawDesignerCanvas(); drawPartsEditor();
  });
  $('dz-patterns').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPattern(b.dataset.p); });
  const rotate = () => { eachSelected(b => { b.rot = (b.rot + 1) % 4; }); symApply([...selBlocks]); saveDesign(); renderDesigner(); };
  $('dz-rot').addEventListener('click', rotate);
  $('dz-rot2').addEventListener('click', rotate);
  $('dz-patsel').addEventListener('change', e => setPattern(e.target.value));
  $('dz-fabrics2').addEventListener('click', e => { const b = e.target.closest('button'); if (b) applyFabric(b.dataset.f); });
  $('dz-library').addEventListener('click', e => { const b = e.target.closest('button'); if (b) copyBlockFrom(+b.dataset.src); });
  const dlg = $('dz-dialog');
  $('dz-close').addEventListener('click', () => dlg.close());
  $('dz-done').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => {           // a click on the backdrop, outside the box, closes it
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  dlg.addEventListener('close', () => { if (selBlocks.size > 1) { selBlocks = new Set([focusBlock]); } selParts.clear(); drawDesignerCanvas(); updateMultiUI(); });
  // side panel: hidden until asked for
  let toolsOpen = false;
  try { toolsOpen = localStorage.getItem('quilt-designer.tools') === '1'; } catch (e) {}
  const setTools = open => {
    // remember the quilt as it was when the panel opened, so "cancel" can bring it back
    if (open && !toolsOpen && design) { tlEnsure(); tlCommit(); toolsSnap = { d: JSON.stringify(design), i: tl.i, key: tl.key }; }
    toolsOpen = open;
    $('dz-side').hidden = !open; $('dz').classList.toggle('tools-open', open);
    placeBlockEditor(open);
    if (!open) toolsPanel = null;
    syncRail();
    if (design) { drawDesignerCanvas(); drawPartsEditor(); }
  };
  // round buttons beside the quilt: each opens the side panel with its own card; the active one closes it
  const showPanel = name => {
    toolsPanel = name;
    for (const [n, id] of Object.entries(PANEL_CARDS)) { const c = $(id); c.hidden = n !== name; if (n === name && c.classList.contains('folded')) setFold(c, n === 'parts' ? 'dz:block parts' : n === 'sash' ? 'dz:sashing' : 'dz:borders', false); }
    if (!toolsOpen) setTools(true); else syncRail();
    $('dz-side').scrollTop = 0;
  };
  for (const [n] of Object.entries(PANEL_CARDS)) $('rail-' + n).addEventListener('click', () => (toolsOpen && toolsPanel === n ? setTools(false) : showPanel(n)));
  showTools = () => { if (!toolsOpen || toolsPanel !== 'parts') showPanel('parts'); };
  showToolsPanel = showPanel; hideTools = () => { if (toolsOpen) setTools(false); };
  $('dz-flip').addEventListener('click', turnQuilt);
  $('dz-backfabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    design.backFabric = b.dataset.f; saveDesign();
    drawPaletteInto($('dz-backfabs'), design.backFabric); drawDesignerCanvas();
  });
  setTools(false);                         // the side panel starts closed
  $('dz-copy').addEventListener('click', () => {
    const src = design.blocks[focusBlock];
    eachSelected((b, bi) => { if (bi !== focusBlock) { const k = b.span; design.blocks[bi] = JSON.parse(JSON.stringify(src)); if (k > 1) design.blocks[bi].span = k; else delete design.blocks[bi].span; } });
    symApply([...selBlocks]);
    saveDesign(); drawDesignerCanvas();
  });
  const sizeChange = () => resizeDesign(+$('dz-cols').value, +$('dz-rows').value);
  const blockSize = e => {
    const v = Math.round(+e.target.value);
    if (!(v >= 50 && v <= 1000)) { e.target.value = design.blockMm; return; }
    design.blockMm = v; saveDesign(); renderDesigner();
  };
  for (const id of ['dz-bmm3']) $(id).addEventListener('change', blockSize);
  $('dz-cols').addEventListener('change', sizeChange); $('dz-rows').addEventListener('change', sizeChange);
  for (const b of document.querySelectorAll('[data-step]')) b.addEventListener('click', () => {
    const [which, d] = b.dataset.step.split(':');
    resizeDesign(design.cols + (which === 'c' ? +d : 0), design.rows + (which === 'r' ? +d : 0));
  });
  $('dz-reset').addEventListener('click', () => {
    if ($('dz-reset').dataset.armed !== '1') { $('dz-reset').dataset.armed = '1'; $('dz-reset').textContent = 'Click again to start over'; setTimeout(() => { $('dz-reset').dataset.armed = ''; $('dz-reset').textContent = 'Start over'; }, 3000); return; }
    design = defaultDesign(); selBlocks = new Set([0]); focusBlock = 0; selParts.clear(); mineCur = null; try { localStorage.removeItem('quilt-mydesigns-current.v1'); localStorage.removeItem(tlKeyFor(null)); } catch (e) {} tlSwitch(null); saveDesign(); renderDesigner();
    $('dz-reset').dataset.armed = ''; $('dz-reset').textContent = 'Start over';
  });
  $('dz-upload').addEventListener('change', async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    for (const f of files) {
      const im = await loadImage(URL.createObjectURL(f));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      fabricLib.push({ id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name.replace(/\.[^.]+$/, ''), canvas: c, cm: +$('dz-cm').value });
    }
    e.target.value = ''; drawFabricPalette();
    $('dz-fabnote').textContent = `${files.length} photo${files.length === 1 ? '' : 's'} added. Your photos are kept only until you reload the page.`;
  });
  const cmOut2 = () => { $('dz-cm-o').textContent = $('dz-cm').value + ' cm'; };
  $('dz-cm').addEventListener('input', cmOut2); cmOut2();
  new ResizeObserver(() => { if (state.page === 'design') drawDesignerCanvas(); }).observe($('dz-quilt').closest('.dz-quiltwrap'));
}

// ---- design -> simulation
// Colour: the design drawn at 2048 px with real-scale fabric. Quilting: the
// quilt is stitched in the ditch along every seam of the design, so the
// batting puffs between them; that relief becomes a normal map.
const designNormalCanvas = document.createElement('canvas'); designNormalCanvas.width = designNormalCanvas.height = 1024;
let designNormalTex = new THREE.CanvasTexture(designNormalCanvas);
designNormalTex.colorSpace = THREE.NoColorSpace; designNormalTex.anisotropy = maxAniso;
// Change the quilt's size: canvases take its proportions (long side 2048 / 1024 px),
// textures are recreated at the new size, and the physics rebuilds the cloth.
function updateIntro() {
  $('intro').textContent = `A ${quilt.w.toFixed(2)} × ${quilt.l.toFixed(2)} m quilt meeting a ${bedName()} (${isTableSim() ? `${bedState.w} × ${bedState.l} mm top, ${bedState.h} mm high` : `${bedState.w} × ${bedState.l} mm mattress`}). Every motion comes from the physics: gravity, fabric elasticity and bending, air drag, and Coulomb friction, in SI units.`;
}
function saveBed() { try { localStorage.setItem(BED_KEY, JSON.stringify(bedState)); } catch (e) {} }
// how the current quilt hangs on the chosen bed (lying as the simulation lays it: head edge 7 cm from the head)
function overhang() {
  const W = quilt.w * 1000, L = quilt.l * 1000;
  if (isTableSim()) return { side: Math.round((W - bedState.w) / 2), foot: Math.round((L - bedState.l) / 2) };
  return { side: Math.round((W - bedState.w) / 2), foot: Math.round(L - 70 - bedState.l) };
}
function updateFitReadout() {
  const o = overhang(), say = v => v >= 0 ? `${v} mm` : `${-v} mm short`;
  const t = isTableSim()
    ? `Quilt ${Math.round(quilt.w * 1000)} × ${Math.round(quilt.l * 1000)} mm on a ${bedState.w} × ${bedState.l} mm table, ${bedState.h} mm high: hangs ${say(o.side)} over each side and ${say(o.foot)} over each end.`
    : `Quilt ${Math.round(quilt.w * 1000)} × ${Math.round(quilt.l * 1000)} mm on a ${bedState.w} × ${bedState.l} mm mattress: hangs ${say(o.side)} over each side and ${say(o.foot)} past the foot.`;
  if ($('bed-fit')) $('bed-fit').textContent = t;
  if ($('fit-now')) $('fit-now').textContent = 'In the simulation now: ' + t.charAt(0).toLowerCase() + t.slice(1);
}
function setBed(key, w, l, h) {
  const b = BEDS.find(x => x.key === key);
  bedState.key = b ? key : key === 'custom-table' ? 'custom-table' : 'custom';
  bedState.kind = b ? (b.kind || 'bed') : key === 'custom-table' ? 'table' : 'bed';
  bedState.w = b ? b.w : Math.round(w); bedState.l = b ? b.l : Math.round(l);
  if (b && b.h) bedState.h = b.h; else if (h) bedState.h = Math.round(h);
  saveBed(); syncBedUI();
  buildBedMeshes(); buildBedExtras();
  colliders = ClothSim.bedColliders(bedM());
  MAT.top = ClothSim.surfaceTop(bedM()); MAT.headFace = isTableSim() ? -bedM().l / 2 : -bedM().l / 2 - 0.055;
  const pil = $('pillows').checked;
  if (colliderMeshes.pillowL) { colliderMeshes.pillowL.visible = pil; colliderMeshes.pillowR.visible = pil && !colliderMeshes.pillowR.userData.dup; }
  if ($('pillows').closest('label')) $('pillows').closest('label').hidden = isTableSim();
  target.y = isTableSim() ? Math.max(0.3, bedM().h - 0.1) : 0.5; placeCamera();
  if (analysis.on) setEngineering(true);
  send({ type: 'dims', width: quilt.w, length: quilt.l, bed: bedM() });
  send({ type: 'pillows', value: pil });
  updateIntro(); updateFitReadout(); renderFitSuggestions();
  dropPos = null; syncDropUI();
  restart();          // drop the quilt again on the new bed (leaves the photo render if it was on)
}
function syncBedUI() {
  const known = BEDS.some(b => b.key === bedState.key), ck = isTableSim() ? 'custom-table' : 'custom';
  for (const id of ['bedsel', 'fit-bed']) { const s = $(id); if (s) s.value = known ? bedState.key : (id === 'fit-bed' ? 'custom' : ck); }
  for (const id of ['bed-custom', 'fit-custom']) if ($(id)) $(id).hidden = known || isTableSim();
  if ($('table-custom')) { $('table-custom').hidden = known || !isTableSim(); $('tbl-w').value = bedState.w; $('tbl-l').value = bedState.l; $('tbl-h').value = bedState.h; }
  for (const [w, l] of [['bed-w', 'bed-l'], ['fit-w', 'fit-l']]) if ($(w)) { $(w).value = bedState.w; $(l).value = bedState.l; }
  if ($('fit-drop')) $('fit-drop').value = bedState.drop;
  if ($('fit-tuck')) $('fit-tuck').checked = bedState.tuck;
}
function fillBedSelect(sel, withTables = true) {
  sel.innerHTML = '';
  for (const g of withTables ? ['Brazil', 'United States', 'Tables'] : ['Brazil', 'United States']) {
    const og = document.createElement('optgroup'); og.label = g === 'Tables' ? 'Tables' : `Beds · ${g}`;
    for (const b of BEDS.filter(x => x.group === g)) og.appendChild(new Option(`${b.label} · ${b.w} × ${b.l} mm${b.kind === 'table' ? ` · ${b.h} mm high` : ''}`, b.key));
    sel.appendChild(og);
  }
  sel.appendChild(new Option('Custom bed size…', 'custom'));
  if (withTables) sel.appendChild(new Option('Custom table…', 'custom-table'));
}
// Target quilt size for the bed: mattress + drop on both sides and at the foot (+ 250 mm pillow tuck).
const TUCK = 250;
function fitTarget() { return { W: bedState.w + 2 * bedState.drop, L: bedState.l + bedState.drop + (bedState.tuck ? TUCK : 0) }; }
// Layout options that come closest to the target: the current block size first, then common block sizes.
function fitOptions() {
  const T = fitTarget(), out = [], seen = new Set(), sz = design ? sashOf(design) : { mm: 0, border: false }, S = sz.mm, e = sz.border ? 2 : 0;
  const BT = design ? 2 * borderTotal(design) : 0;
  const size = (c, r, B) => ({ W: c * B + S * (c - 1 + e) + BT, L: r * B + S * (r - 1 + e) + BT });     // includes the sashing and borders
  const sizes = [design ? design.blockMm : 400, 250, 300, 305, 350, 400, 450, 457, 500, 550, 600];
  for (const B of sizes) {
    const p = B + S;
    for (const c of [Math.floor((T.W - BT - S * (e - 1)) / p), Math.ceil((T.W - BT - S * (e - 1)) / p)]) for (const r of [Math.floor((T.L - BT - S * (e - 1)) / p), Math.ceil((T.L - BT - S * (e - 1)) / p)]) {
      if (c < 1 || r < 1 || c > 20 || r > 20) continue;
      const k = `${B}|${c}|${r}`; if (seen.has(k)) continue; seen.add(k);
      const { W, L } = size(c, r, B), err = Math.abs(W - T.W) + Math.abs(L - T.L) + (W < bedState.w ? 1e6 : 0);
      out.push({ B, c, r, W, L, err, current: design && B === design.blockMm });
    }
  }
  out.sort((a, b) => a.err - b.err);
  const cur = out.find(o => o.current), list = [];
  if (cur) list.push(cur);
  for (const o of out) { if (list.length >= 4) break; if (!list.includes(o) && !list.some(x => x.B === o.B)) list.push(o); }
  // exact fit: change the block size so the columns match the width exactly
  if (design) {
    const c = Math.max(1, Math.round((T.W - BT - S * (e - 1)) / (design.blockMm + S))), B = Math.max(50, Math.round((T.W - BT - S * (c - 1 + e)) / c / 5) * 5), r = Math.max(1, Math.round((T.L - BT - S * (e - 1)) / (B + S)));
    if (!list.some(o => o.B === B && o.c === c && o.r === r)) list.push({ B, c, r, ...size(c, r, B), err: 0, exact: true });
  }
  return list;
}
function renderFitSuggestions() {
  const box = $('fit-list'); if (!box || !design) return;
  const T = fitTarget();
  $('fit-target').textContent = `Target quilt: ${T.W} × ${T.L} mm (mattress ${bedState.w} × ${bedState.l} + ${bedState.drop} mm drop each side and at the foot${bedState.tuck ? ` + ${TUCK} mm pillow tuck` : ''}).`;
  box.innerHTML = '';
  for (const o of fitOptions()) {
    const side = Math.round((o.W - bedState.w) / 2), foot = o.L - bedState.l - (bedState.tuck ? TUCK : 0);
    const isNow = design.cols === o.c && design.rows === o.r && design.blockMm === o.B;
    const row = document.createElement('div'); row.className = 'fitopt';
    row.innerHTML = `<div><b>${o.c} × ${o.r} blocks of ${o.B} mm</b>${o.current ? ' <span class="tag">your block size</span>' : ''}${o.exact ? ' <span class="tag">resized blocks</span>' : ''}
      <small>${o.W} × ${o.L} mm · drop ${side} mm at the sides, ${foot} mm at the foot</small></div>`;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sm' + (isNow ? '' : ' primary');
    btn.textContent = isNow ? 'In use' : 'Use'; btn.disabled = isNow;
    btn.addEventListener('click', () => { design.blockMm = o.B; resizeDesign(o.c, o.r); saveDesign(); renderDesigner(); renderFitSuggestions(); });
    row.appendChild(btn); box.appendChild(row);
  }
}
function initBedUI() {
  fillBedSelect($('bedsel')); fillBedSelect($('fit-bed'), false);
  const onSel = e => {
    if (e.target.value === 'custom') { if (isTableSim()) setBed('custom', 1525, 2030); else { bedState.key = 'custom'; syncBedUI(); } return; }
    if (e.target.value === 'custom-table') { setBed('custom-table', isTableSim() ? bedState.w : 900, isTableSim() ? bedState.l : 1600, bedState.h || 750); return; }
    setBed(e.target.value);
  };
  const onTable = () => { const w = +$('tbl-w').value, l = +$('tbl-l').value, h = +$('tbl-h').value;
    if (w >= 300 && w <= 3000 && l >= 300 && l <= 4000 && h >= 300 && h <= 1200) setBed('custom-table', w, l, h); else syncBedUI(); };
  for (const id of ['tbl-w', 'tbl-l', 'tbl-h']) $(id).addEventListener('change', onTable);
  $('bedsel').addEventListener('change', onSel); $('fit-bed').addEventListener('change', onSel);
  const onCustom = (wi, li) => () => { const w = +$(wi).value, l = +$(li).value; if (w >= 500 && w <= 3000 && l >= 1000 && l <= 3000) setBed('custom', w, l); };
  for (const [w, l] of [['bed-w', 'bed-l'], ['fit-w', 'fit-l']]) { $(w).addEventListener('change', onCustom(w, l)); $(l).addEventListener('change', onCustom(w, l)); }
  $('fit-drop').addEventListener('change', e => { const v = Math.round(+e.target.value); if (v >= 0 && v <= 800) { bedState.drop = v; saveBed(); renderFitSuggestions(); } else e.target.value = bedState.drop; });
  $('fit-tuck').addEventListener('change', e => { bedState.tuck = e.target.checked; saveBed(); renderFitSuggestions(); });
  syncBedUI(); updateIntro(); updateFitReadout();
}
function setQuiltDims(w, l) {
  const changed = Math.abs(w - quilt.w) > 1e-6 || Math.abs(l - quilt.l) > 1e-6;
  quilt.w = w; quilt.l = l;
  const fit = (long) => w >= l ? [long, Math.max(64, Math.round(long * l / w))] : [Math.max(64, Math.round(long * w / l)), long];
  const [pw, ph] = fit(PW), [nw, nh] = fit(1024);
  if (patchCanvas.width !== pw || patchCanvas.height !== ph) {
    patchCanvas.width = pw; patchCanvas.height = ph;
    patchTex.dispose(); patchTex = new THREE.CanvasTexture(patchCanvas);
    patchTex.colorSpace = THREE.SRGBColorSpace; patchTex.anisotropy = maxAniso;
    QM.top.map = patchTex; QM.top.needsUpdate = true;
  }
  if (designNormalCanvas.width !== nw || designNormalCanvas.height !== nh) {
    designNormalCanvas.width = nw; designNormalCanvas.height = nh;
    const wasDesign = QM.top.normalMap === designNormalTex;
    designNormalTex.dispose(); designNormalTex = new THREE.CanvasTexture(designNormalCanvas);
    designNormalTex.colorSpace = THREE.NoColorSpace; designNormalTex.anisotropy = maxAniso;
    if (wasDesign) { QM.top.normalMap = designNormalTex; QM.top.needsUpdate = true; }
  }
  updateBindUv();
  updateIntro(); updateFitReadout();
  if (changed) send({ type: 'dims', width: w, length: l, bed: bedM() });
  if (typeof syncDropUI === 'function') try { syncDropUI(); } catch (e) {}
}
// ---- quilting: the stitching that holds the layers together, drawn over the whole top.
// 'ditch' = along the seams only; the others add a pattern of their own over the top
const QUILTING = { ditch: 'In the ditch (along the seams)', cross: 'Crosshatch', fans: 'Baptist fans', meander: 'Meander' };
const quiltingOf = d => (d && QUILTING[d.quilting] ? d.quilting : 'ditch');
function drawQuiltingLines(g, W, H, kind) {
  const k = W / quiltMm(design).W;                                     // px per mm
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
  if (kind === 'cross') {                                               // diagonal grid, 38 mm (1½ in) apart
    const sp = 38 * k; g.beginPath();
    for (let t = -H; t < W + H; t += sp) { g.moveTo(t, 0); g.lineTo(t + H, H); g.moveTo(t, H); g.lineTo(t + H, 0); }
    g.stroke();
  } else if (kind === 'fans') {                                         // rows of fans: arcs 25 mm apart in 200 mm fans
    const F = 200 * k, st = 25 * k;
    for (let row = Math.ceil(H / F); row >= 0; row--) for (let c = -1; c * F < W + F; c++) {
      const x0 = c * F + (row % 2 ? F / 2 : 0), y0 = (row + 1) * F;
      g.save(); g.beginPath(); g.rect(x0, y0 - F, F, F); g.clip();
      for (let r = st; r <= F * 1.42; r += st) { g.beginPath(); g.arc(x0, y0, r, -Math.PI / 2, 0); g.stroke(); }
      g.restore();
    }
  } else if (kind === 'meander') {                                      // a wandering line, rows about 30 mm apart
    let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const row = 30 * k, step = 18 * k;
    for (let y = row / 2; y < H + row; y += row) {
      g.beginPath(); g.moveTo(-step, y);
      for (let x = -step; x < W + 2 * step; x += step) { const cy = y + (rnd() - .5) * row * 1.4, ny = y + (rnd() - .5) * row * .5; g.quadraticCurveTo(x + step / 2, cy, x + step, ny); }
      g.stroke();
    }
  }
  g.restore();
}
function strokeSeams(g, W, H) {
  const d = design;
  for (const rc of sashRects(d, W, H)) g.strokeRect(rc.x, rc.y, rc.w, rc.h);
  for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++) {
    if (d.blocks[r * d.cols + c].under != null) continue;
    const R = blockRect(d, c, r, W, H);
    for (const poly of blockPolys(d.blocks[r * d.cols + c], R.x, R.y, R.w, R.h)) { pathPoly(g, poly); g.stroke(); }
  }
}
// The design's seams drawn at 1/f size and returned for scaling up: scaling up a small drawing
// with smoothing gives a blur of about f pixels, at a tiny fraction of a blur filter's cost.
function softSeams(W, H, blur, bg, ink, lineWidth) {
  const f = Math.max(1, blur), w = Math.max(8, Math.round(W / f)), h = Math.max(8, Math.round(H / f));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.setTransform(w / W, 0, 0, h / H, 0, 0); g.strokeStyle = ink; g.lineWidth = lineWidth; strokeSeams(g, W, H);
  const qk = quiltingOf(design); if (qk !== 'ditch') { g.lineWidth = lineWidth * 0.6; drawQuiltingLines(g, W, H, qk); }
  return c;
}
function buildDesignMaps() {
  const qm = quiltMm(design); setQuiltDims(qm.W / 1000, qm.H / 1000);
  const W = patchCanvas.width, H = patchCanvas.height, quiltCm = qm.W / 10;
  const g = patchCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  drawQuilt(g, W, H);
  // shadow in the seams
  // (blurred by drawing small and scaling up: fast everywhere, unlike canvas blur filters)
  const cav = softSeams(W, H, 3, '#fff', 'rgba(0,0,0,.55)', 5);
  g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cav, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  // binding: ½-inch (12.7 mm) indigo cotton
  const bw = W * (1.27 / quiltCm);
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(bw, bw, W - 2 * bw, H - 2 * bw); g.clip('evenodd');
  g.fillStyle = fabricFill(g, fabricById('b1'), W / quiltCm, 3); g.fillRect(0, 0, W, H); g.restore();
  patchTex.needsUpdate = true;
  // quilting relief -> normal map
  const NW = designNormalCanvas.width, NH = designNormalCanvas.height, hc = document.createElement('canvas'); hc.width = NW; hc.height = NH; const hg = hc.getContext('2d');
  hg.imageSmoothingEnabled = true; hg.imageSmoothingQuality = 'high';
  hg.drawImage(softSeams(NW, NH, 6, '#fff', '#000', 7), 0, 0, NW, NH);
  hg.lineWidth = Math.max(4, Math.max(NW, NH) * 0.012); hg.strokeStyle = '#999'; hg.strokeRect(0, 0, NW, NH);
  const h = hg.getImageData(0, 0, NW, NH).data, out = new ImageData(NW, NH), o = out.data, s = 6 / 255;
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    const xm = Math.max(0, x - 1), xp = Math.min(NW - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(NH - 1, y + 1);
    const gx = (h[4 * (y * NW + xp)] - h[4 * (y * NW + xm)]) * s, gy = -(h[4 * (yp * NW + x)] - h[4 * (ym * NW + x)]) * s;
    const l = Math.hypot(gx, gy, 1), i = 4 * (y * NW + x);
    o[i] = (-gx / l * 0.5 + 0.5) * 255; o[i + 1] = (-gy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  designNormalCanvas.getContext('2d').putImageData(out, 0, 0);
  designNormalTex.needsUpdate = true;
  QM.top.normalMap = designNormalTex; QM.top.needsUpdate = true;
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
  backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = maxAniso;
  backTex.wrapS = backTex.wrapT = THREE.RepeatWrapping;
  backTex.repeat.set(quilt.w * 100 / fab.cm, quilt.l * 100 / (fab.cm * fab.canvas.height / fab.canvas.width));
  QM.back.map = backTex; QM.back.color.set(0xffffff); QM.back.normalMap = designNormalTex; QM.back.needsUpdate = true;
}
function restoreBacking() {
  QM.back.map = BACK_DEFAULT.map; QM.back.color.copy(BACK_DEFAULT.color); QM.back.normalMap = BACK_DEFAULT.normalMap; QM.back.needsUpdate = true;
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
  const w0 = quilt.w, l0 = quilt.l;
  if (state.view === 'render') setView('photo');
  buildDesignMaps();
  state.usingDesign = true;
  const resized = Math.abs(quilt.w - w0) > 1e-6 || Math.abs(quilt.l - l0) > 1e-6;
  if (resized) restart();
  if ($('dz-sync')) $('dz-sync').textContent = resized ? 'Simulation updated · quilt dropped again at the new size' : 'Simulation up to date';
}
// ---- pages
function showPage(p) {
  state.page = p;
  if ($('tour-start')) $('tour-start').hidden = p !== 'design';
  // the simulation opens as a layer above the Quilt designer, which stays underneath
  document.body.classList.toggle('sim-over', p === 'sim');
  $('page-sim').hidden = p !== 'sim'; $('page-design').hidden = p !== 'design' && p !== 'sim'; $('page-cut').hidden = p !== 'cut'; $('page-mine').hidden = p !== 'mine';
  for (const b of $('tabs').children) b.setAttribute('aria-selected', String(b.dataset.page === (p === 'sim' ? 'design' : p)));
  if ($('tl-panel')) { const want = p === 'design' && !!tlBarOn;
    $('tl-panel').hidden = !want; document.body.classList.toggle('tl-open', want); if (want) { tlUI(); document.body.style.setProperty('--tl-h', $('tl-panel').offsetHeight + 'px'); } }
  if (p === 'sim') {
    resize(); fitSimSide();
    if (!design) (async () => { await initFabricLib(); if (!design) { design = loadDesign(); selBlocks = new Set([0]); focusBlock = 0; activeFabric = 'b0'; } drawFabricPalette(); renderDesigner(); })();
    // coming back: the photo render (if one is showing) starts again from the current quilt and window size
    if (state.view === 'render') { stopRender(); startRender(); }
    return;
  }
  (async () => {
    await initFabricLib();
    if (!design) { design = loadDesign(); selBlocks = new Set([0]); focusBlock = 0; activeFabric = 'b0'; }
    if (p === 'design') { drawFabricPalette(); renderDesigner(); } else if (p === 'mine') renderMine(); else renderCut();
  })();
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showPage(b.dataset.page); });
$('dz-sim').addEventListener('click', () => showPage('sim'));
$('sim-close').addEventListener('click', () => showPage('design'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.page === 'sim' && !document.querySelector('dialog[open]')) { e.preventDefault(); showPage('design'); } });
initDesignerUI();

// ------------------------------------------------------------- cutting guide core (millimetres)
// Turns the designed quilt into cutting instructions, using standard quilting
// methods. s = seam allowance.
//   squares / rectangles   cut = finished + 2s
//   half-square triangles  cut a square of (finished leg + s(2+sqrt2)) and cut it once on the
//                          diagonal: 2 triangles per square
//   quarter-square tri.    cut a square of (finished long side + s(2+2sqrt2)) and cut it twice
//                          on the diagonal: 4 triangles per square
// Cut sizes round UP to the whole millimetre. Fabric is cut in strips across the
// width of fabric (WOF) and the strips are sub-cut.
const CG = (() => {
  const upmm = x => Math.ceil(x - 1e-6);
  const mm = x => `${Math.round(x)} mm`;
  const close = (a, b) => Math.abs(a - b) < 1e-6;
  const metres = x => `${(Math.ceil(x / 50 - 1e-6) * 0.05).toFixed(2)} m`;   // rounded up to 5 cm

  function classify(poly, W, H, s) {
    const p = poly.map(([u, v]) => [u * W, v * H]);
    if (p.length === 4 && p.every((a, i) => { const b = p[(i + 1) % 4]; return close(a[0], b[0]) || close(a[1], b[1]); })) {
      const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
      const w = upmm(Math.max(...xs) - Math.min(...xs) + 2 * s), h = upmm(Math.max(...ys) - Math.min(...ys) + 2 * s);
      if (w === h) return { kind: 'square', cut: [w, w], yield: 1, how: `square ${mm(w)}` };
      return { kind: 'rect', cut: [Math.max(w, h), Math.min(w, h)], yield: 1, how: `rectangle ${Math.min(w, h)} × ${Math.max(w, h)} mm` };
    }
    if (p.length === 3) {
      const L = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      for (let k = 0; k < 3; k++) {
        const r = p[k], a = p[(k + 1) % 3], b = p[(k + 2) % 3];
        const ra = [a[0] - r[0], a[1] - r[1]], rb = [b[0] - r[0], b[1] - r[1]];
        if (Math.abs(ra[0] * rb[0] + ra[1] * rb[1]) > 1e-6 * W * W || Math.abs(L(r, a) - L(r, b)) > 1e-6 * W) continue;
        const leg = L(r, a), hyp = L(a, b);
        const legsAxis = (close(ra[0], 0) || close(ra[1], 0)) && (close(rb[0], 0) || close(rb[1], 0));
        if (legsAxis) { const c = upmm(leg + s * (2 + Math.SQRT2)); return { kind: 'hst', cut: [c, c], yield: 2, how: `square ${mm(c)}, cut once on the diagonal ◩` }; }
        const c = upmm(hyp + s * (2 + 2 * Math.SQRT2));
        return { kind: 'qst', cut: [c, c], yield: 4, how: `square ${mm(c)}, cut twice on the diagonals ⊠` };
      }
    }
    // other shapes (e.g. triangles in non-square blocks): cut from a template
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const w = upmm(Math.max(...xs) - Math.min(...xs) + 2 * s), h = upmm(Math.max(...ys) - Math.min(...ys) + 2 * s);
    if (p.length === 3) {
      // draw the template from its finished sides, then add the seam allowance all round
      const sides = [0, 1, 2].map(i => Math.round(Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][1] - p[(i + 1) % 3][1]))).sort((a, b) => a - b);
      return { kind: 'template', cut: [Math.max(w, h), Math.min(w, h), ...sides], yield: 1,
               how: `triangle template, finished sides ${sides.join(' × ')} mm; add ${s} mm seam allowance all round (fits in ${Math.min(w, h)} × ${Math.max(w, h)} mm)` };
    }
    return { kind: 'template', cut: [Math.max(w, h), Math.min(w, h)], yield: 1, how: `template piece in a ${Math.min(w, h)} × ${Math.max(w, h)} mm rectangle, ${s} mm seam allowance added` };
  }

  // strips across the fabric width, sub-cut into pieces; picks the orientation using less length
  function stripPlan(a, b, n, usable) {
    let best = null;
    for (const [h, w] of [[b, a], [a, b]]) {
      if (w > usable) continue;
      const per = Math.floor(usable / w), strips = Math.ceil(n / per);
      const pl = { stripH: h, pieceW: w, per, strips, length: strips * h, widthUsed: Math.min(n, per) * w };
      if (!best || pl.length < best.length) best = pl;
    }
    return best || { stripH: a, pieceW: b, per: 1, strips: n, length: n * a, widthUsed: b };
  }

  /** design {cols, rows, blocks:[{pattern, rot, fabrics}]}; opts {quiltMm, seam, fabricWidth, selvage, bindingFabric, bindingWidth, partsOf, label} */
  function plan(design, opts) {
    const s = opts.seam, usable = opts.fabricWidth - opts.selvage;
    const blockW = opts.blockMm, blockH = opts.blockMm;          // blocks are square, of the size the user set
    const groups = new Map();
    design.blocks.forEach((b, i) => {
      if (b.under != null) return;                               // covered by a large block
      const sp = b.span > 1 ? b.span : 1;
      const key = b.pattern + '|' + sp + '|' + b.fabrics.join(',');   // rotation does not change the cutting; size does
      if (!groups.has(key)) groups.set(key, { block: b, count: 0, index: i, span: sp, size: opts.sizeOf ? opts.sizeOf(sp) : blockW });
      groups.get(key).count++;
    });
    const letters = new Map();
    const letterOf = id => { if (!letters.has(id)) letters.set(id, String.fromCharCode(65 + letters.size)); return letters.get(id); };
    const blocks = [];
    for (const g of groups.values()) {
      const pieces = opts.partsOf(g.block.pattern).map((p, i) => ({ part: p, fabric: g.block.fabrics[i], letter: letterOf(g.block.fabrics[i]), fussy: !!(g.block.fussy && g.block.fussy[i]), ...classify(p.poly, g.size, g.size, s) }));
      const rows = new Map();
      for (const pc of pieces) {
        const k = pc.letter + '|' + pc.kind + '|' + pc.cut.join('x') + (pc.fussy ? '|fussy' : '');
        // a fussy-cut piece is cut one by one around the chosen motif (no strip cutting, no cutting in two)
        if (!rows.has(k)) rows.set(k, pc.fussy ? { letter: pc.letter, fabric: pc.fabric, kind: pc.kind, cut: pc.cut, yield: 1, fussy: true, how: `${pc.how.replace(/, cut (once|twice) on the diagonals?.*$/, '')} · fussy cut: one at a time, centred on the chosen motif`, pieces: 0 }
                                     : { letter: pc.letter, fabric: pc.fabric, kind: pc.kind, cut: pc.cut, yield: pc.yield, how: pc.how, pieces: 0 });
        rows.get(k).pieces++; pc.rowKey = k;
      }
      // each different cut shape of a fabric is a "form": D2.1, D2.2, ... (largest first)
      const list = [...rows.values()].sort((a, b) => a.letter.localeCompare(b.letter) || b.cut[0] - a.cut[0] || b.cut[1] - a.cut[1] || a.kind.localeCompare(b.kind) || String(b.cut).localeCompare(String(a.cut)));
      const nForm = {};
      for (const r of list) r.form = nForm[r.letter] = (nForm[r.letter] || 0) + 1;
      for (const pc of pieces) pc.form = rows.get(pc.rowKey).form;
      blocks.push({ ...g, label: opts.label(g.block.pattern), pieces, list });
    }
    const fabrics = new Map();
    for (const b of blocks) for (const r of b.list) {
      const f = fabrics.get(r.fabric) || { id: r.fabric, letter: r.letter, cuts: new Map() };
      const k = r.kind + '|' + r.cut.join('x');
      const c = f.cuts.get(k) || { kind: r.kind, cut: r.cut, yield: r.yield, how: r.how, pieces: 0 };
      c.pieces += r.pieces * b.count; f.cuts.set(k, c); fabrics.set(r.fabric, f);
    }
    // sashing strips and cornerstones (rectangles / squares cut at finished size + 2 seam allowances)
    const sashList = [];
    for (const x of opts.extra || []) {
      const letter = letterOf(x.fabric), f = fabrics.get(x.fabric) || { id: x.fabric, letter, cuts: new Map() };
      if (x.wof) {          // long strips cut across the fabric width and joined end to end
        const width = upmm(x.w + 2 * s), total = x.lens.reduce((a, l) => a + l + 2 * s, 0), strips = Math.ceil(total / usable);
        (f.wof = f.wof || []).push({ strips, width }); fabrics.set(x.fabric, f);
        sashList.push({ ...x, letter, how: `${strips} strip${strips > 1 ? 's' : ''} ${width} mm × WOF, joined and cut to ${x.lens.map(l => upmm(l + 2 * s)).join(' + ')} mm`, n: x.lens.length });
        continue;
      }
      let kind, cut, how, yld = 1;
      if (x.kind) ({ kind, cut, how } = x), yld = x.yield || 1;
      else {
        const cw = upmm(x.w + 2 * s), ch = upmm(x.h + 2 * s);
        kind = cw === ch ? 'square' : 'rect'; cut = [Math.max(cw, ch), Math.min(cw, ch)];
        how = kind === 'square' ? `square ${mm(cw)}` : `rectangle ${Math.min(cw, ch)} × ${Math.max(cw, ch)} mm`;
      }
      const k = kind + '|' + cut.join('x');
      const c = f.cuts.get(k) || { kind, cut, yield: yld, how, pieces: 0 };
      c.pieces += x.n; f.cuts.set(k, c); fabrics.set(x.fabric, f);
      sashList.push({ ...x, letter, how, kind, cut, yield: yld });
    }
    const result = [];
    for (const f of fabrics.values()) {
      let length = 0, oneStrip = true, maxW = 0;
      const cuts = [...f.cuts.values()].map(c => {
        const n = Math.ceil(c.pieces / c.yield), sp = stripPlan(c.cut[0], c.cut[1], n, usable);
        length += sp.length; if (sp.strips > 1) oneStrip = false; maxW = Math.max(maxW, sp.widthUsed);
        return { ...c, toCut: n, strip: sp };
      }).sort((a, b) => b.cut[0] - a.cut[0]);
      for (const w of f.wof || []) { length += w.strips * w.width; oneStrip = false; maxW = Math.max(maxW, usable); }
      result.push({ id: f.id, letter: f.letter, cuts, length, small: oneStrip && cuts.length <= 2 && maxW <= 550 && length <= 500, maxW });
    }
    const QW = opts.quiltW || blockW * design.cols, QH = opts.quiltH || blockH * design.rows;
    const bindStrips = Math.ceil((2 * (QW + QH) + 300) / usable);
    let bf = result.find(r => r.id === opts.bindingFabric);
    if (!bf) { bf = { id: opts.bindingFabric, letter: letterOf(opts.bindingFabric), cuts: [], length: 0, small: false, maxW: 0 }; result.push(bf); }
    bf.binding = { strips: bindStrips, width: opts.bindingWidth };
    bf.length += bindStrips * opts.bindingWidth; bf.small = false;
    for (const r of result) {
      const L = Math.ceil(r.length + 50);                    // 50 mm to straighten the edge
      r.requirement = r.small ? `${Math.ceil(r.maxW)} × ${Math.ceil(r.length)} mm` : `${L} mm × WOF`;
      r.buy = r.small ? '' : metres(L);
    }
    result.sort((a, b) => a.letter.localeCompare(b.letter));
    const backW = QW + 200, backH = QH + 200, widths = Math.ceil(Math.min(backW, backH) / usable);
    return {
      blockW, blockH, quiltW: QW, quiltH: QH, seam: s, usable, blocks, fabrics: result, sashing: sashList,
      backing: { w: backW, h: backH, widths, buy: metres(widths * Math.max(backW, backH)) },
    };
  }
  return { plan, mm, metres, classify };
})();

// ------------------------------------------------------------- cutting guide page
const cutOpts = { seam: 7.5, fabricWidth: 1500, selvage: 50, bindingWidth: 60 };
function letterBadge(g, x, y, r, letter) {
  // a circle for one character, a pill for labels such as "A12"
  g.font = `600 ${Math.round(r * 1.15)}px Georgia, "Times New Roman", serif`;
  const w = Math.max(0, g.measureText(letter).width - r * 0.9);
  g.beginPath();
  g.arc(x - w / 2, y, r, Math.PI / 2, Math.PI * 1.5); g.arc(x + w / 2, y, r, -Math.PI / 2, Math.PI / 2); g.closePath();
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fill();
  g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
  g.fillStyle = '#1f1d1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, x, y + 0.5);
}
function drawCutBlock(cv, b, P, num) {
  const css = 300, dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ar = P.blockH / P.blockW, W = css, H = Math.round(css * ar);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = '100%'; cv.style.maxWidth = W + 'px'; cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBlockArt(g, b, P, num, W, H);
}
// Draws a block with its pieces labelled (A1, B1, ...) into a W x H box at the context's origin.
// Everything scales with W, so the same drawing serves the page (300 px) and the A4 PDF.
function drawBlockArt(g, b, P, num, W, H) {
  const k = W / 300, pxPerCm = W / ((b.size || P.blockW) / 10);
  const polys = b.pieces.map(pc => pc.part.poly.map(([u, v]) => [u * W, v * H]));
  b.pieces.forEach((pc, i) => { g.fillStyle = pieceFill(g, b.block, i, polys[i], pxPerCm, b.index * 31 + i); pathPoly(g, polys[i]); g.fill(); dimUnlessHi(g, { t: 'piece', num, letter: pc.letter, form: pc.form, fabric: pc.fabric }); });
  g.lineWidth = 1.5 * k; g.strokeStyle = '#ffffff'; g.lineJoin = 'round';
  polys.forEach(p => { pathPoly(g, p); g.stroke(); });
  if (fabHi) { g.lineWidth = 2.2 * k; g.strokeStyle = '#e0592a'; b.pieces.forEach((pc, i) => { if (fabHi({ t: 'piece', num, letter: pc.letter, form: pc.form, fabric: pc.fabric })) { pathPoly(g, polys[i]); g.stroke(); } }); }
  b.pieces.forEach((pc, i) => {
    // label at the roomiest point of the piece (far from every seam), sized to the room there
    const p = polys[i], xs = p.map(v => v[0]), ys = p.map(v => v[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const [cx, cy] = roomiestPoint(p, x0, y0, x1 - x0, y1 - y0, 0, 0);
    let d = Infinity;
    for (let j = 0; j < p.length; j++) { const a = p[j], c = p[(j + 1) % p.length], vx = c[0] - a[0], vy = c[1] - a[1], t = Math.max(0, Math.min(1, ((cx - a[0]) * vx + (cy - a[1]) * vy) / (vx * vx + vy * vy))); d = Math.min(d, Math.hypot(cx - a[0] - t * vx, cy - a[1] - t * vy)); }
    const r = Math.max(5 * k, Math.min(14 * k, d * 0.8));
    letterBadge(g, cx, cy, r, `${pc.letter}${num}.${pc.form}`);
  });
}
function swatchCanvas(fab, w = 72, h = 48) {
  const c = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // show about 12 cm of the fabric so the print reads at its real scale
  g.fillStyle = fabricFill(g, fab, w / 12, 5); g.fillRect(0, 0, w, h);
  return c;
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let lastPlan = null;
const cgRedraws = [];      // redraw functions for the Cutting guide pictures (used when a fabric row is hovered)
// The whole quilt as on the PDF's quilt page: blocks a little apart, each turned as designed,
// every piece labelled with its ID, rows and columns numbered.
let cgHi = -1;
// double-clicking a block opens the whole quilt in a pop-up with that block's squares highlighted
function openQuiltPop(P, i) {
  const d = $('cg-pop'), b = P.blocks[i];
  $('cg-pop-title').textContent = `Block ${i + 1} · ${b.label}`;
  $('cg-pop-sub').textContent = `${b.count} in the quilt, marked in orange · ${design.cols} × ${design.rows} blocks, ${P.quiltW} × ${P.quiltH} mm`;
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  const w = Math.min(1000, window.innerWidth - 80), h = window.innerHeight - 170;
  drawCutQuilt(P, { cv: $('cg-pop-cv'), w, h });
}
// the sashing picture: a 2 × 2 corner of the quilt with every strip and cornerstone labelled with its ID.
// S is the width in px; u scales the labels (1 on screen, more for the PDF at print resolution)
function sashMini() {
  const c = Math.min(2, design.cols), r = Math.min(2, design.rows);
  return { ...design, cols: c, rows: r, blocks: [0, 1, design.cols, design.cols + 1].filter(i => i < design.blocks.length).slice(0, c * r).map(i => { const b = { ...design.blocks[i] }; delete b.span; delete b.under; return b; }), borders: [] };
}
function sashPicH(S) { const q = quiltMm(sashMini()); return Math.round(S * q.H / q.W); }
function drawSashPic(g, S, sashCuts, u) {
  const mini = sashMini(), H = sashPicH(S);
  const keep = design; design = mini; try { drawQuilt(g, S, H, { seams: true }); } finally { design = keep; }
  g.font = `600 ${11 * u}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const rc of sashRects(mini, S, H)) {
    const x = sashCuts.find(t => t.what === (rc.kind === 'corner' ? 'Cornerstones' : 'Sashing strips')); if (!x) continue;
    const t = x.id, tw = g.measureText(t).width + 8 * u, vert = rc.h > rc.w, hh = 16 * u;
    if (rc.kind === 'corner' && rc.w < tw) {
      // cornerstones are too small to write on: a callout beside each one, with a leader line
      const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2, lx = Math.min(S - tw / 2 - 2 * u, cx + 22 * u), ly = Math.max(10 * u, cy - 20 * u);
      g.strokeStyle = '#1f1d1a'; g.lineWidth = u; g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, ly); g.stroke();
      g.beginPath(); g.arc(cx, cy, 2 * u, 0, Math.PI * 2); g.fillStyle = '#1f1d1a'; g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(lx - tw / 2, ly - hh / 2, tw, hh); g.strokeRect(lx - tw / 2, ly - hh / 2, tw, hh);
      g.fillStyle = '#1f1d1a'; g.fillText(t, lx, ly + u); continue;
    }
    if (rc.w < 18 * u && rc.h < 18 * u) continue;
    g.save(); g.translate(rc.x + rc.w / 2, rc.y + rc.h / 2); if (vert && rc.w < tw) g.rotate(-Math.PI / 2);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(-tw / 2, -hh / 2, tw, hh); g.fillStyle = '#1f1d1a'; g.fillText(t, 0, u); g.restore();
  }
}
// a border ring in px on a W-wide drawing at k px/mm: 'brd' = all borders, 'b<i>' = border i (1 is the innermost)
function borderRing(kind, k) {
  const bs = bordersOf(design);
  if (kind === 'brd') return { o: 0, t: borderTotal(design) * k };
  const i = +kind.slice(1); return { o: bs.slice(i + 1).reduce((a, b) => a + b.mm, 0) * k, t: (bs[i] ? bs[i].mm : 0) * k };
}
function dimOutsideRing(g, W, H, r) {
  g.beginPath(); g.rect(0, 0, W, H); g.rect(r.o, r.o, W - 2 * r.o, H - 2 * r.o); g.rect(r.o + r.t, r.o + r.t, W - 2 * (r.o + r.t), H - 2 * (r.o + r.t));
  g.fillStyle = 'rgba(236,239,244,.72)'; g.fill('evenodd');
}
function outlineRing(g, W, H, r, lw = [6, 3.5]) {
  for (const [w, c] of [[lw[0], '#fff'], [lw[1], '#e0592a']]) { g.lineWidth = w; g.strokeStyle = c; g.strokeRect(r.o + 1.5, r.o + 1.5, W - 2 * r.o - 3, H - 2 * r.o - 3); g.strokeRect(r.o + r.t, r.o + r.t, W - 2 * (r.o + r.t), H - 2 * (r.o + r.t)); }
}
// one click opens / closes a card's cutting list (it slides down / up); a double-click finds it in the whole quilt
// how many copies of a plan block are mirrored in the quilt (they need odd-shaped pieces cut reversed)
// only shapes without a mirror symmetry of their own (most odd shapes) need cutting reversed for a mirrored block
function chiral(poly) {
  const n = poly.length, e = [], a = [];
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], r = poly[(i + 2) % n];
    e.push(Math.hypot(q[0] - p[0], q[1] - p[1]));
    a.push(Math.atan2((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]), (q[0] - p[0]) * (r[0] - q[0]) + (q[1] - p[1]) * (r[1] - q[1]))); }
  const sig = (E, A) => E.map((v, i) => `${v.toFixed(4)}:${Math.abs(A[i]).toFixed(3)}`);
  const f = sig(e, a), rev = sig([...e].reverse(), [...a].reverse().slice(1).concat([...a].reverse()[0]));
  for (let k = 0; k < n; k++) if (f.every((v, i) => v === rev[(i + k) % n])) return false;
  return true;
}
const patternChiral = {};
function hasChiralPiece(pattern) { if (!(pattern in patternChiral)) patternChiral[pattern] = partsOf(pattern).some(p => chiral(p.poly)); return patternChiral[pattern]; }
function mirroredCount(pb) {
  if (!hasChiralPiece(pb.block.pattern)) return 0;
  const k = pb.block.pattern + '|' + pb.span + '|' + pb.block.fabrics.join(','); return design.blocks.filter(b => b.flip && b.under == null && b.pattern + '|' + spanOf(b) + '|' + b.fabrics.join(',') === k).length;
}
function cgRowHover(div, makeTest) {
  for (const tr of div.querySelectorAll('.cg-list tbody tr')) {
    tr.classList.add('cutrow'); tr.title = 'Hover to light up these pieces in the pictures';
    tr.addEventListener('mouseenter', () => setFabHi(makeTest(tr), tr));
    tr.addEventListener('mouseleave', () => setFabHi(null));
  }
}
function cgCardBehaviour(div, key, pick, hint) {
  const list = div.querySelector('.cg-list'), cv = div.querySelector('canvas');
  div.dataset.key = String(key);
  if (cgOpen.has(key)) { div.classList.add('open'); list.style.maxHeight = 'none'; }
  const toggle = () => {
    const open = !div.classList.contains('open');
    list.style.maxHeight = list.scrollHeight + 'px';           // from its real height, so the slide is smooth both ways
    if (!open) { list.offsetHeight; list.style.maxHeight = '0px'; }
    div.classList.toggle('open', open);
    if (open) { cgOpen.add(key); list.addEventListener('transitionend', () => { if (div.classList.contains('open')) list.style.maxHeight = 'none'; }, { once: true });
      setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 280); }
    else cgOpen.delete(key);
    cv.setAttribute('aria-expanded', String(open));
  };
  let clickT = 0;
  const onClick = () => { clearTimeout(clickT); clickT = setTimeout(toggle, 260); };
  const onDbl = () => { clearTimeout(clickT); pick(); };
  for (const el of [cv, div.querySelector('h3')]) { el.addEventListener('click', onClick); el.addEventListener('dblclick', onDbl); }
  cv.tabIndex = 0; cv.setAttribute('role', 'button'); cv.setAttribute('aria-expanded', String(cgOpen.has(key)));
  cv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  cv.title = hint;
}
// the real quilt (sashing and borders included) with the sashing or the borders outlined and the rest dimmed
function drawQuiltHi(cv, maxW, maxH, kind) {
  const q = quiltMm(design), k = Math.min(maxW / q.W, maxH / q.H), W = Math.round(q.W * k), H = Math.round(q.H * k);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawQuilt(g, W, H, { seams: true });
  g.save();
  if (kind === 'sash') {
    const rs = sashRects(design, W, H);
    g.beginPath(); g.rect(0, 0, W, H); for (const r of rs) g.rect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(236,239,244,.72)'; g.fill('evenodd');
    for (const r of rs) { g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeRect(r.x, r.y, r.w, r.h); g.lineWidth = 1.6; g.strokeStyle = '#e0592a'; g.strokeRect(r.x, r.y, r.w, r.h); }
  } else { const r = borderRing(kind, k); dimOutsideRing(g, W, H, r); outlineRing(g, W, H, r); }
  g.restore();
}
function openPartPop(kind) {
  const d = $('cg-pop'), q = quiltMm(design), nb = bordersOf(design).length, s = sashOf(design);
  const bi = kind[0] === 'b' && kind !== 'brd' ? +kind.slice(1) : -1, b = bi >= 0 ? bordersOf(design)[bi] : null;
  $('cg-pop-title').textContent = kind === 'sash' ? 'Sashing' : b ? `Border ${bi + 1}` : nb > 1 ? `Borders (${nb})` : 'Border';
  $('cg-pop-sub').textContent = kind === 'sash'
    ? `${s.mm} mm strips between the blocks${s.border ? ' and around the outside' : ''}, marked in orange · finished quilt ${q.W} × ${q.H} mm`
    : b ? `${BORDER_TYPES[b.type].label}, ${b.mm} mm all round${nb > 1 ? (bi === 0 ? ' · the innermost border' : bi === nb - 1 ? ' · the outermost border' : '') : ''}, marked in orange · finished quilt ${q.W} × ${q.H} mm`
    : `${borderTotal(design)} mm all round, marked in orange · finished quilt ${q.W} × ${q.H} mm`;
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  drawQuiltHi($('cg-pop-cv'), Math.min(1000, window.innerWidth - 80), window.innerHeight - 170, kind);
}
const cgOpen = new Set();      // blocks whose cutting list is open          // distinct block picked on the cutting guide (double-click), -1 = none
function drawCutQuilt(P, into) {
  const cv = into ? into.cv : $('cg-quilt'), box = cv.parentElement;
  // into.u scales labels and lines (the PDF draws at print resolution); into.dpr overrides the screen's pixel ratio
  const u = (into && into.u) || 1, dpr = (into && into.dpr) || Math.min(window.devicePixelRatio || 1, 2), lab = 22 * u;
  // lay the quilt out at its real proportions, sashing and borders included; with no sashing the blocks
  // still sit a little apart (an empty gap) so each one reads on its own
  const s = sashOf(design), gapMm = Math.round(design.blockMm * 0.05);
  const d2 = s.mm ? design : { ...design, sashing: { mm: gapMm, fabric: 'b0', corner: 'b0', border: false } };
  const q = quiltMm(d2);
  const availW = (into ? into.w : Math.min(1100, box.clientWidth || 900)) - lab;
  let k = availW / q.W;
  if (into) k = Math.min(k, (into.h - lab) / q.H);
  k = Math.max(k, 60 * u / design.blockMm);
  const W = Math.round(q.W * k), H = Math.round(q.H * k), TW = W + lab, TH = H + lab;
  cv.width = Math.round(TW * dpr); cv.height = Math.round(TH * dpr); cv.style.width = TW + 'px'; cv.style.aspectRatio = `${TW} / ${TH}`;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, TW, TH);
  g.save(); g.translate(lab, lab);
  const pxPerCm = k * 10, bt = borderTotal(design) * k;
  // borders and sashing in their fabrics
  if (bordersOf(design).length) drawBorders(g, d2, W, H, pxPerCm, true);
  const sr = s.mm ? sashRects(d2, W, H) : [];
  sr.forEach((rc, i) => {
    g.fillStyle = fabricFill(g, fabricById(rc.kind === 'corner' ? s.corner : s.fabric), pxPerCm, 900 + i); g.fillRect(rc.x, rc.y, rc.w, rc.h);
    g.beginPath(); g.rect(rc.x, rc.y, rc.w, rc.h); dimUnlessHi(g, { t: 'sash', kind: rc.kind });
    g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = u; g.strokeRect(rc.x + .5, rc.y + .5, rc.w - 1, rc.h - 1);
  });
  // blocks, each turned as designed, every piece labelled with its ID
  const numOf = new Map(P.blocks.map((b, i) => [b.block.pattern + '|' + b.span + '|' + b.block.fabrics.join(','), i]));
  const rects = [];
  design.blocks.forEach((blk, bi) => {
    if (blk.under != null) return;
    const i = numOf.get(blk.pattern + '|' + spanOf(blk) + '|' + blk.fabrics.join(',')), pb = P.blocks[i];
    const r = Math.floor(bi / design.cols), c = bi % design.cols, R = blockRect(d2, c, r, W, H);
    rects.push({ ...R, i });
    const turned = { ...pb, index: bi, pieces: pb.pieces.map(pc => ({ ...pc, part: { ...pc.part, poly: orientPoly(pc.part.poly, blk) } })) };
    g.save(); g.translate(R.x, R.y); drawBlockArt(g, turned, P, i + 1, R.w, R.h); g.restore();
    g.strokeStyle = 'rgba(30,28,25,.55)'; g.lineWidth = u; g.strokeRect(R.x + .5, R.y + .5, R.w - 1, R.h - 1);
  });
  // piece IDs on the sashing and on each border (where there is room)
  const extra = P.sashing || [], tag = (t, x, y, fs, rot) => {
    g.save(); g.translate(x, y); if (rot) g.rotate(-Math.PI / 2);
    g.font = `600 ${fs}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(t).width + 6 * u; g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(-tw / 2, -fs * 0.7, tw, fs * 1.4);
    g.fillStyle = '#1f1d1a'; g.fillText(t, 0, 0.5); g.restore();
  };
  if (sr.length) {
    const idOf = kind => (extra.find(x => x.group === 'sash' && x.what === (kind === 'corner' ? 'Cornerstones' : 'Sashing strips')) || {}).id;
    for (const rc of sr) {
      const t = idOf(rc.kind), thin = Math.min(rc.w, rc.h); if (!t || (thin < 9 * u && rc.kind !== 'corner') || thin < 3 * u) continue;
      const fs = Math.min(11 * u, thin * 0.75), long = Math.max(rc.w, rc.h);
      if (rc.kind === 'corner') {
        if (rc.w >= 30 * u) tag(t, rc.x + rc.w / 2, rc.y + rc.h / 2, Math.min(11 * u, rc.w / 3.2), false);
        else {     // too small to write on: a short callout up and to the right, with a leader line
          const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2, lx = Math.min(W - 18 * u, cx + 18 * u), ly = Math.max(8 * u, cy - 16 * u);
          g.strokeStyle = '#1f1d1a'; g.lineWidth = u; g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, ly); g.stroke();
          tag(t, lx, ly, 9 * u, false);
        }
      }
      else if (long > 40 * u) tag(t, rc.x + rc.w / 2, rc.y + rc.h / 2, fs, rc.h > rc.w);
    }
  }
  const bs = bordersOf(design);
  bs.forEach((b, i) => {
    const o = bs.slice(i + 1).reduce((a, x) => a + x.mm, 0) * k, t = b.mm * k; if (t < 10 * u) return;
    const ids = extra.filter(x => x.group === 'b' + i).map(x => x.id).filter(Boolean).join('  '); if (!ids) return;
    tag(ids, W / 2, o + t / 2, Math.min(11 * u, t * 0.7), false);
    tag(ids, W / 2, H - o - t / 2, Math.min(11 * u, t * 0.7), false);
  });
  // highlight: a block (number), the sashing ('sash') or the borders ('brd'); everything else is dimmed
  if (cgHi !== -1) {
    const ring = typeof cgHi === 'string' && cgHi !== 'sash';
    const tgt = cgHi === 'sash' ? sr : ring ? [] : rects.filter(R => R.i === cgHi);
    const outline = (x, y, w, h, wide) => { g.lineWidth = wide ? 6 : 3; g.strokeStyle = '#fff'; g.strokeRect(x, y, w, h); g.lineWidth = wide ? 3.5 : 1.6; g.strokeStyle = '#e0592a'; g.strokeRect(x, y, w, h); };
    if (ring) { const r = borderRing(cgHi, k); dimOutsideRing(g, W, H, r); outlineRing(g, W, H, r); }
    else { g.beginPath(); g.rect(0, 0, W, H); for (const R of tgt) g.rect(R.x, R.y, R.w, R.h); g.fillStyle = 'rgba(236,239,244,.72)'; g.fill('evenodd'); }
    if (!ring) for (const R of tgt) outline(R.x - (cgHi === 'sash' ? 0 : 1), R.y - (cgHi === 'sash' ? 0 : 1), R.w + (cgHi === 'sash' ? 0 : 2), R.h + (cgHi === 'sash' ? 0 : 2), cgHi !== 'sash');
  }
  g.restore();
  // column and row numbers along the blocks
  g.fillStyle = '#6b665e'; g.font = `${12 * u}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < design.cols; c++) { const R = cellRect(d2, c, 0, W, H); g.fillText(String(c + 1), lab + R.x + R.w / 2, lab / 2); }
  for (let r = 0; r < design.rows; r++) { const R = cellRect(d2, 0, r, W, H); g.fillText(String(r + 1), lab / 2, lab + R.y + R.h / 2); }
  if (into) return;
  const nHi = typeof cgHi === 'number' && cgHi >= 0 ? P.blocks[cgHi].count : 0;
  $('cg-quilt-meta').textContent = typeof cgHi === 'string'
    ? `Showing the ${cgHi === 'sash' ? 'sashing' : cgHi === 'brd' ? 'borders' : 'border ' + (+cgHi.slice(1) + 1)}, marked in orange. Double-click it again, or click here, to show all.`
    : cgHi >= 0
    ? `Showing block ${cgHi + 1} (${P.blocks[cgHi].label}): ${nHi} in the quilt. Double-click it again, or click here, to show all.`
    : `${design.cols} × ${design.rows} blocks${s.mm ? ` · ${s.mm} mm sashing` : ''}${bs.length ? ` · ${bs.length} border${bs.length > 1 ? 's' : ''}` : ''} · finished ${P.quiltW} × ${P.quiltH} mm · each piece shows fabric letter + block number . form (D2.3 = fabric D, block 2, form 3; S = sashing, B1 = border 1). Double-click a block, the sashing or the borders above to see where they go in the quilt.`;
  $('cg-quilt-meta').classList.toggle('cg-hi-on', cgHi !== -1);
  document.querySelectorAll('.cgblock').forEach(el => el.classList.toggle('picked', el.dataset.key === String(cgHi)));
}
function renderCut() {
  if (!design) return;
  cgRedraws.length = 0; fabHi = null;
  const sz = sashOf(design), qm = quiltMm(design), e = sz.border ? 2 : 0, extra = [];
  if (sz.mm) {
    // counted from the drawn sashing, so strips hidden under large blocks are left out
    const sr = sashRects(design, 1000, 1000), strips = sr.filter(x => x.kind === 'sash').length, corners = sr.filter(x => x.kind === 'corner').length;
    if (strips) extra.push({ group: 'sash', what: 'Sashing strips', fabric: sz.fabric, w: design.blockMm, h: sz.mm, n: strips });
    if (corners) extra.push({ group: 'sash', what: 'Cornerstones', fabric: sz.corner, w: sz.mm, h: sz.mm, n: corners });
  }
  // borders: every piece of every side, classified into standard cuts (or long strips cut across the width)
  const bs = bordersOf(design), cm = centreMm(design); let innerW = cm.W, innerH = cm.H;
  bs.forEach((b, bi) => {
    const T = b.mm, label = `Border ${bi + 1} · ${BORDER_TYPES[b.type].label}`, group = 'b' + bi, agg = new Map();
    const usable = cutOpts.fabricWidth - cutOpts.selvage;
    if (b.type === 'plain') {
      const butted = plainButted(b), lens = butted ? [innerW + 2 * T, innerW + 2 * T, innerH, innerH] : [innerW, innerW, innerH, innerH];
      if (Math.max(...lens) + 2 * cutOpts.seam > usable) extra.push({ group, what: label + ' · strips', fabric: borderFab(b, 0), wof: true, w: T, lens });
      else for (const L of lens) extra.push({ group, what: label + ' · strips', fabric: borderFab(b, 0), w: L, h: T, n: 1 });
      if (!butted) extra.push({ group, what: label + ' · corner squares', fabric: borderFab(b, 1), w: T, h: T, n: 4 });
    } else {
      // units are eased slightly to fit each side; when that is under 8 %, cut them at their standard size
      const u0 = BORDER_TYPES[b.type].unit(T), ease = L => { const n = borderUnits(b, L); return Math.abs(L / n - u0) / u0 < 0.08 ? n * u0 : L; };
      for (const L of [innerW, innerH, innerW, innerH]) for (const pc of borderSidePieces(b, ease(L))) {
        const c = CG.classify(pc.poly, 1, 1, cutOpts.seam), fab = borderFab(b, pc.slot), k = fab + '|' + c.kind + '|' + c.cut.join('x');
        if (!agg.has(k)) agg.set(k, { group, what: label, fabric: fab, kind: c.kind, cut: c.cut, yield: c.yield, how: c.how, n: 0 });
        agg.get(k).n++;
      }
      extra.push(...agg.values());
      extra.push({ group, what: label + ' · corner squares', fabric: borderFab(b, 2), w: T, h: T, n: 4 });
    }
    innerW += 2 * T; innerH += 2 * T;
  });
  const P = CG.plan(design, { blockMm: design.blockMm, sizeOf: k => blockSizeMm(design, k), seam: cutOpts.seam, fabricWidth: cutOpts.fabricWidth, selvage: cutOpts.selvage,
    bindingFabric: 'b1', bindingWidth: cutOpts.bindingWidth, partsOf, label: k => PATTERNS[k].label, extra, quiltW: qm.W, quiltH: qm.H });
  lastPlan = P;
  const mm = CG.mm;
  $('cg-facts').innerHTML = [
    ['Finished quilt', `${P.quiltW} × ${P.quiltH} mm`], ['Blocks', `${design.cols} × ${design.rows}`],
    ['Block', `${P.blockW} × ${P.blockH} mm finished · ${P.blockW + 2 * P.seam} × ${P.blockH + 2 * P.seam} mm with seam allowance`],
    ['Distinct blocks', P.blocks.length],
  ].map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join('');
  // fabric table
  const tb = $('cg-fabrics').querySelector('tbody'); tb.innerHTML = '';
  for (const r of P.fabrics) {
    const fab = fabricById(r.id), tr = document.createElement('tr');
    const notes = [];
    if (r.binding) notes.push(`includes binding: ${r.binding.strips} strips ${r.binding.width} mm × WOF`);
    tr.innerHTML = `<td class="sw"></td><td class="letter">${r.letter}<span class="fname">${esc(fab.name)}</span></td>
      <td class="req">${r.requirement}${r.buy ? `<small>buy ≈ ${r.buy}</small>` : ''}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</td>`;
    tr.querySelector('.sw').appendChild(swatchCanvas(fab));
    tb.appendChild(tr);
  }
  const backFab = fabricById(design.backFabric);
  tb.insertAdjacentHTML('beforeend', `<tr class="extra backrow"><td class="sw"></td><td class="letter small">Backing<span class="fname">${esc(backFab.name)}</span></td><td class="req">${P.backing.w} × ${P.backing.h} mm<small>${P.backing.widths} width${P.backing.widths > 1 ? 's' : ''} of fabric sewn together · buy ≈ ${P.backing.buy}</small></td></tr>
    <tr class="extra"><td></td><td class="letter small">Batting</td><td class="req">${P.backing.w} × ${P.backing.h} mm</td></tr>`);
  tb.querySelector('.backrow .sw').appendChild(swatchCanvas(backFab));
  // blocks
  const box = $('cg-blocks'); box.innerHTML = '';
  P.blocks.forEach((b, i) => {
    const div = document.createElement('div'); div.className = 'cgblock';
    const rows = b.list.map(r => `<tr data-l="${r.letter}" data-f="${r.form}"><td class="l">${r.letter}${i + 1}.${r.form}</td><td>${r.how}</td><td class="n">${Math.ceil(r.pieces / r.yield)}</td><td class="n">${Math.ceil(r.pieces * b.count / r.yield)}</td></tr>`).join('');
    div.innerHTML = `<h3>Block ${i + 1}</h3><p class="meta">${esc(b.label)}${b.span > 1 ? ` · large block, ${b.span} × ${b.span} cells (${b.size} mm)` : ''} · make ${b.count}${mirroredCount(b) ? ` · ${mirroredCount(b)} mirrored (cut their odd-shaped pieces with the template turned over)` : ''}</p><div class="cg-art"><canvas aria-label="Block ${i + 1}: ${esc(b.label)}, pieces labelled with fabric letters"></canvas><span class="cg-hint" aria-hidden="true">Click: cutting list · double-click: see it in the quilt</span></div>
      <div class="cg-list" id="cg-list-${i}"><div class="tablewrap"><table><thead><tr><th>Fabric</th><th>Cut</th><th>Per block</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    box.appendChild(div);
    { const bc = div.querySelector('canvas'); const draw = () => drawCutBlock(bc, b, P, i + 1); draw(); cgRedraws.push(draw); }
    const pick = () => { cgHi = i; drawCutQuilt(P); openQuiltPop(P, i); };
    cgCardBehaviour(div, i, pick, 'Click to show or hide the cutting list · double-click to find this block in the whole quilt');
    cgRowHover(div, tr => { const L = tr.dataset.l, F = +tr.dataset.f, n = i + 1; return x => x.t === 'piece' && x.num === n && x.letter === L && x.form === F; });
  });
  const sashCuts = (P.sashing || []).filter(x => x.group === 'sash');
  const hint = '<span class="cg-hint" aria-hidden="true">Click: cutting list · double-click: see it in the quilt</span>';
  const listOf = (head, rows) => `<div class="cg-list"><div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  if (sashCuts.length) {
    // piece IDs like the blocks' D2.3: fabric letter + S (sashing) . form
    sashCuts.forEach((x, k) => { x.id = `${x.letter}S.${k + 1}`; });
    const sz = sashOf(design), div = document.createElement('div'); div.className = 'cgblock cg-sash';
    const rows = sashCuts.map(x => `<tr data-k="${x.what === 'Cornerstones' ? 'corner' : 'sash'}"><td class="l">${x.id}</td><td>${x.what}: ${x.how}</td><td class="n">${x.n}</td></tr>`).join('');
    div.innerHTML = `<h3>Sashing</h3><p class="meta">${sz.mm} mm wide${sz.border ? ', also around the outside' : ''}</p><div class="cg-art"><canvas aria-label="Part of the quilt showing the sashing, pieces labelled with their IDs"></canvas>${hint}</div>`
      + listOf('<th>ID</th><th>Cut</th><th>Total</th>', rows);
    box.appendChild(div);
    // a 2 × 2 corner of the quilt, to show how strips and cornerstones go together
    const cv = div.querySelector('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2), S = 300;
    const drawSash = () => {
      const H = sashPicH(S);
      cv.width = S * dpr; cv.height = H * dpr; cv.style.width = S + 'px'; cv.style.maxWidth = '100%'; cv.style.aspectRatio = `${S} / ${H}`;
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); drawSashPic(g, S, sashCuts, 1);
    };
    drawSash(); cgRedraws.push(drawSash);
    cgRowHover(div, tr => { const K = tr.dataset.k; return x => x.t === 'sash' && x.kind === K; });
    cgCardBehaviour(div, 'sash', () => { cgHi = 'sash'; drawCutQuilt(P); openPartPop('sash'); }, 'Click to show or hide the cutting list · double-click to see the sashing in the whole quilt');
  }
  const brdCuts = (P.sashing || []).filter(x => x.group && x.group[0] === 'b');
  // piece IDs: fabric letter + B<border number> . form, e.g. CB2.1
  { const perBorder = new Map(); for (const x of brdCuts) { const n = (perBorder.get(x.group) || 0) + 1; perBorder.set(x.group, n); x.id = `${x.letter}B${+x.group.slice(1) + 1}.${n}`; } }
  // one card per border (border 1 is the innermost): the quilt with that border lit and the others faded, and its cutting list
  const bs2 = bordersOf(design);
  bs2.forEach((bd, bi) => {
    const cuts = brdCuts.filter(x => x.group === 'b' + bi); if (!cuts.length) return;
    const key = 'b' + bi, div = document.createElement('div'); div.className = 'cgblock cg-sash';
    const rows = cuts.map(x => {
      const n = x.wof ? x.n : Math.ceil(x.n / (x.yield || 1));
      return `<tr data-g="${bi}" data-fab="${x.fabric}" data-c="${/corner squares$/.test(x.what) ? 1 : 0}"><td class="l">${x.id}</td><td><b>${esc(x.what.replace(/^Border \d+ · /, ''))}</b><br>${x.how}</td><td class="n">${x.wof ? '—' : n}</td></tr>`;
    }).join('');
    const where = bs2.length > 1 ? (bi === 0 ? ' · innermost' : bi === bs2.length - 1 ? ' · outermost' : '') : '';
    div.innerHTML = `<h3>Border ${bi + 1}</h3><p class="meta">${BORDER_TYPES[bd.type].label} · ${bd.mm} mm${where}</p><div class="cg-art"><canvas aria-label="The quilt with border ${bi + 1} lit up and its pieces labelled"></canvas>${hint}</div>`
      + `<p class="meta cg-brdleg">Pieces: <b>${cuts.map(x => x.id).join(' · ')}</b></p>`
      + listOf('<th>ID</th><th>Cut</th><th>Total</th>', rows);
    box.appendChild(div);
    const cv = div.querySelector('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2), S = 300, GAP = bs2.length > 1 ? 7 : 0, H = explodedH(S, GAP);
    cv.width = S * dpr; cv.height = H * dpr; cv.style.width = S + 'px'; cv.style.maxWidth = '100%'; cv.style.aspectRatio = `${S} / ${H}`;
    // the borders pulled apart (one ring each), this one bright and the rest faded
    const drawB = () => { const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, H); drawBordersExploded(g, S, GAP, bs2.length > 1 ? bi : -1); };
    drawB(); cgRedraws.push(drawB);
    cgRowHover(div, tr => { const FB = tr.dataset.fab, C = tr.dataset.c === '1'; return x => x.t === 'brd' && x.bi === bi && x.fabric === FB && x.corner === C; });
    cgCardBehaviour(div, key, () => { cgHi = key; drawCutQuilt(P); openPartPop(key); }, `Click to show or hide the cutting list · double-click to see border ${bi + 1} in the whole quilt`);
  });
  if (typeof cgHi === 'number' && cgHi >= P.blocks.length) cgHi = -1;
  if (cgHi === 'sash' && !sashCuts.length || typeof cgHi === 'string' && cgHi[0] === 'b' && !brdCuts.some(x => x.group === cgHi)) cgHi = -1;
  drawCutQuilt(P);
  $('cg-note').textContent = `WOF = width of fabric: ${cutOpts.fabricWidth / 10} cm, of which ${P.usable / 10} cm is usable after trimming the selvages. Cut sizes include a ${P.seam} mm seam allowance and are rounded up to the whole millimetre. Requirements add 50 mm to straighten the edge; "buy" rounds up to 5 cm.`;
}
// hovering a line of a cutting list lights up those pieces in every picture
function setFabHi(test, tr) {
  if (fabHi === test) return;
  fabHi = test;
  document.querySelectorAll('#cg-blocks tr.cut-on').forEach(x => x.classList.remove('cut-on'));
  if (tr) tr.classList.add('cut-on');
  for (const f of cgRedraws) f();
  if (lastPlan) drawCutQuilt(lastPlan);
}
function initCutUI() {
  $('cg-seam').addEventListener('change', e => { cutOpts.seam = +e.target.value; renderCut(); });
  $('cg-width').addEventListener('change', e => { cutOpts.fabricWidth = +e.target.value; renderCut(); });
  $('cg-binding').addEventListener('change', e => { cutOpts.bindingWidth = +e.target.value; renderCut(); });
  $('cg-edit').addEventListener('click', () => showPage('design'));
}
initCutUI();

// ---- sashing settings
function renderSashUI() {
  if (!design || !$('sash-card')) return;
  const s = sashOf(design), raw = design.sashing || {};
  if (document.activeElement !== $('sash-mm')) $('sash-mm').value = s.mm;
  $('sash-border').checked = !!raw.border;
  const box = $('sash-presets'); box.innerHTML = '';
  for (const v of [0, 25, 38, 50, 64, 76]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = v ? v + ' mm' : 'None'; b.dataset.v = v;
    b.setAttribute('aria-pressed', String(s.mm === v)); box.appendChild(b);
  }
  drawPaletteInto($('sash-fabs'), raw.fabric || 'b0');
  drawPaletteInto($('sash-corner'), raw.corner || raw.fabric || 'b0');
  const q = quiltMm(design);
  $('sash-note').textContent = s.mm ? `Finished quilt with sashing: ${q.W} × ${q.H} mm. Click the sashing on the quilt to come back here.` : 'Choose a width to add strips of fabric between the blocks.';
}
function setSash(patch) {
  const cur = design.sashing || { mm: 0, fabric: 'b0', corner: 'b3', border: false };
  design.sashing = { ...cur, ...patch };
  if (!(design.sashing.mm > 0)) design.sashing.mm = 0;
  saveDesign(); renderDesigner(); renderSashUI();
}
function openSashing() { showToolsPanel('sash'); }
function initSashUI() {
  $('sash-mm').addEventListener('change', e => { const v = Math.max(0, Math.min(200, Math.round(+e.target.value || 0))); setSash({ mm: v }); });
  $('sash-presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSash({ mm: +b.dataset.v }); });
  $('sash-border').addEventListener('change', e => setSash({ border: e.target.checked }));
  $('sash-fabs').addEventListener('click', e => { const b = e.target.closest('button.fab'); if (b) setSash({ fabric: b.dataset.f, ...(design.sashing && design.sashing.mm ? {} : { mm: 50 }) }); });
  $('sash-corner').addEventListener('click', e => { const b = e.target.closest('button.fab'); if (b) setSash({ corner: b.dataset.f, ...(design.sashing && design.sashing.mm ? {} : { mm: 50 }) }); });
}
initSashUI();

// ---- borders UI
let brdActive = null;          // { i, slot } — which border colour the palette is choosing
function borderSketch(type, fabs, w = 96, h = 34) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const b = { type, mm: h, fabrics: fabs }, cols = ['#2f466f', '#efe5cf', '#c79a45'];
  for (const pc of borderSidePieces(b, w)) {
    g.fillStyle = fabs ? fabricFill(g, fabricById(borderFab(b, pc.slot)), 6, 3) : cols[pc.slot]; pathPoly(g, pc.poly); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .6; g.stroke();
  }
  return c;
}
function swatch(fid, px = 22) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), c = document.createElement('canvas'); c.width = c.height = px * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = fabricFill(g, fabricById(fid), 8, 5); g.fillRect(0, 0, px, px);
  return c;
}
function renderBorderUI() {
  if (!design || !$('brd-card')) return;
  const types = $('brd-types');
  if (!types.childElementCount) for (const [k, t] of Object.entries(BORDER_TYPES)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'brd-type'; b.dataset.t = k; b.title = `Add a ${t.label.toLowerCase()} border`;
    const sp = document.createElement('span'); sp.textContent = t.label; b.append(borderSketch(k, null), sp); types.appendChild(b);
  }
  const list = $('brd-list'); list.innerHTML = '';
  const bs = design.borders || [];
  bs.forEach((b, i) => {
    const t = BORDER_TYPES[b.type]; if (!t) return;
    const row = document.createElement('div'); row.className = 'brd-row'; row.dataset.i = i;
    const top = document.createElement('div'); top.className = 'top';
    const name = document.createElement('b'); name.textContent = `${i + 1}. ${i === 0 ? 'inner' : i === bs.length - 1 ? 'outer' : 'middle'}`;
    const sel = document.createElement('select'); sel.dataset.a = 'type';
    for (const [k, tt] of Object.entries(BORDER_TYPES)) sel.add(new Option(tt.label, k, false, k === b.type));
    const mm = document.createElement('input'); mm.type = 'number'; mm.min = 10; mm.max = 400; mm.step = 1; mm.value = b.mm; mm.dataset.a = 'mm'; mm.title = 'Width (mm)';
    const unit = document.createElement('span'); unit.className = 'fine'; unit.style.margin = 0; unit.textContent = 'mm';
    const mk = (a, txt, title, dis) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'ic'; x.dataset.a = a; x.textContent = txt; x.title = title; x.setAttribute('aria-label', title); x.disabled = !!dis; return x; };
    top.append(name, sel, mm, unit, mk('in', '↑', 'Move inwards', i === 0), mk('out', '↓', 'Move outwards', i === bs.length - 1), mk('del', '×', 'Remove this border'));
    const slots = document.createElement('div'); slots.className = 'brd-slots';
    t.slots.forEach((label, si) => {
      const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'brd-slot'; sb.dataset.slot = si;
      sb.setAttribute('aria-pressed', String(!!brdActive && brdActive.i === i && brdActive.slot === si));
      const sp = document.createElement('span'); sp.textContent = label; sb.append(swatch(borderFab(b, si)), sp); slots.appendChild(sb);
    });
    row.append(top, slots); row.appendChild(borderSketch(b.type, b.fabrics, 260, 26)); row.lastChild.style.width = '100%'; row.lastChild.style.height = 'auto'; row.lastChild.style.borderRadius = '3px';
    list.appendChild(row);
  });
  const pb = $('brd-palbox');
  if (brdActive && bs[brdActive.i]) {
    pb.hidden = false; const b = bs[brdActive.i];
    $('brd-paltitle').textContent = `Fabric for border ${brdActive.i + 1} · ${BORDER_TYPES[b.type].slots[brdActive.slot]}`;
    drawPaletteInto($('brd-pal'), borderFab(b, brdActive.slot));
  } else { pb.hidden = true; brdActive = null; }
}
function setBorders(fn) { design.borders = JSON.parse(JSON.stringify(design.borders || [])); fn(design.borders); saveDesign(); renderDesigner(); renderBorderUI(); }
function openBorders() { showToolsPanel('brd'); }
function initBorderUI() {
  $('brd-types').addEventListener('click', e => {
    const b = e.target.closest('.brd-type'); if (!b) return;
    const t = BORDER_TYPES[b.dataset.t], n = (design.borders || []).length;
    const def = { plain: ['b1', 'b1'], piano: ['b1', 'b0', 'b1'], squares: ['b4', 'b0', 'b4'], checker: ['b1', 'b0', 'b1'], sawtooth: ['b4', 'b0', 'b4'], geese: ['b1', 'b0', 'b1'] }[b.dataset.t];
    setBorders(bs => bs.push({ type: b.dataset.t, mm: t.mm, fabrics: def }));
    brdActive = null; renderBorderUI();
    if (n === 0) $('brd-list').scrollIntoView({ block: 'nearest' });
  });
  $('brd-list').addEventListener('change', e => {
    const row = e.target.closest('.brd-row'); if (!row) return; const i = +row.dataset.i;
    if (e.target.dataset.a === 'type') setBorders(bs => { bs[i].type = e.target.value; });
    if (e.target.dataset.a === 'mm') { const v = Math.max(10, Math.min(400, Math.round(+e.target.value || 0))); setBorders(bs => { bs[i].mm = v; }); }
  });
  $('brd-list').addEventListener('click', e => {
    const row = e.target.closest('.brd-row'); if (!row) return; const i = +row.dataset.i;
    const a = e.target.closest('[data-a]')?.dataset.a, slot = e.target.closest('.brd-slot');
    if (slot) { const si = +slot.dataset.slot; brdActive = brdActive && brdActive.i === i && brdActive.slot === si ? null : { i, slot: si }; renderBorderUI(); return; }
    if (a === 'del') { brdActive = null; setBorders(bs => bs.splice(i, 1)); }
    else if (a === 'in' && i > 0) { brdActive = null; setBorders(bs => { [bs[i - 1], bs[i]] = [bs[i], bs[i - 1]]; }); }
    else if (a === 'out' && i < (design.borders || []).length - 1) { brdActive = null; setBorders(bs => { [bs[i + 1], bs[i]] = [bs[i], bs[i + 1]]; }); }
  });
  $('brd-pal').addEventListener('click', e => {
    const f = e.target.closest('button.fab'); if (!f || !brdActive) return;
    const { i, slot } = brdActive;
    setBorders(bs => { const fb = (bs[i].fabrics || []).slice(); while (fb.length <= slot) fb.push(fb[0] || 'b0'); fb[slot] = f.dataset.f; bs[i].fabrics = fb; });
  });
}
initBorderUI();
// small round button on the Block parts card: undo everything done since the design tools were opened, and close them
// symmetry setting (Block parts): turning one on mirrors the design from its top-left part straight away
function syncSymUI() {
  if ($('dz-quilting') && design) $('dz-quilting').value = quiltingOf(design);
  const el = $('dz-sym'); if (!el || !design) return;
  for (const o of el.options) o.disabled = o.value === 'kal' && design.cols !== design.rows;
  el.value = symOf(design);
  const sp = $('dz-span'), b = design.blocks[focusBlock]; if (!sp || !b) return;
  const c = focusBlock % design.cols, r = Math.floor(focusBlock / design.cols), max = Math.min(design.cols - c, design.rows - r);
  for (const o of sp.options) { o.disabled = +o.value > max; o.textContent = `${o.value} × ${o.value} cell${o.value > 1 ? 's' : ''} · ${blockSizeMm(design, +o.value)} mm`; }
  sp.value = String(spanOf(b));
}
$('dz-quilting').addEventListener('change', e => {
  if (!design) return;
  design.quilting = e.target.value; if (design.quilting === 'ditch') delete design.quilting;
  saveDesign(); renderDesigner();
});
$('dz-span').addEventListener('change', e => {
  if (!design) return;
  setSpan(design, focusBlock, +e.target.value);
  selBlocks = new Set([focusBlock]); symApply([focusBlock]);
  saveDesign(); renderDesigner(); drawPartsEditor();
});
$('dz-sym').addEventListener('change', e => {
  if (!design) return;
  design.sym = e.target.value; if (design.sym === 'off') delete design.sym;
  const s = symOf(design), C = design.cols, R = design.rows, src = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const inL = c < Math.ceil(C / 2), inT = r < Math.ceil(R / 2);
    if (s === 'lr' ? inL : s === 'tb' ? inT : s === 'both' ? inL && inT : s === 'kal' ? inL && inT && c >= r : false) src.push(r * C + c);
  }
  symApply(src); saveDesign(); renderDesigner();
});
const cancelTools = () => {
  if (toolsSnap && design) {
    tlCommit();
    const k = tl.steps.findIndex(st => st.d === toolsSnap.d);
    if (tl.key === toolsSnap.key && JSON.stringify(design) !== toolsSnap.d && k >= 0) tlGo(k);       // the later steps stay available as redo
    else if (JSON.stringify(design) !== toolsSnap.d) { design = JSON.parse(toolsSnap.d); selBlocks = new Set([Math.min(focusBlock, design.blocks.length - 1)]); focusBlock = [...selBlocks][0]; selParts.clear(); saveDesign(); renderDesigner(); }
  }
  toolsSnap = null;
  hideTools();
};
for (const b of document.querySelectorAll('.dz-cancel')) b.addEventListener('click', e => { e.stopPropagation(); cancelTools(); });
// a double-click on empty page space (not on a control, the quilt, the panel or the timeline) closes the side panel
document.addEventListener('dblclick', e => {
  if (state.page !== 'design' || document.body.classList.contains('tour-active')) return;
  if (e.target.closest('button, input, select, textarea, label, a, canvas, .card, #dz-side, .rail, #tl-panel, .tour, dialog')) return;
  hideTools();
  if (!$('tl-panel').hidden && tl.showBar) tl.showBar(false);   // and the timeline closes too
  if (tl.hideRow) tl.hideRow();
});

// ---- guided tour: a short exercise for first-time users. Every control is greyed out and switched
// off except the ones the current step needs; the step moves on by itself once it has been done.
const TOUR_KEY = 'quilt-tour.v1';
const tour = { on: false, i: 0, poll: 0, saved: null, savedCur: null, mark: null };
const blk = i => design && design.blocks[i];
const TOUR = [
  { title: 'Welcome to the Quilt designer!', text: 'In about two minutes you will make a <b>quilt of three blocks</b> in the Quilt designer, change its pattern and fabrics and add a border. Only the button you need lights up at each step.',
    center: true, buttons: [['Start the exercise', 'next', true], ['Not now', 'skip']] },
  { title: 'Fewer columns', text: 'A new quilt starts with 5 × 5 blocks. Above the quilt, click the <b>−</b> next to <b>Columns</b> until there are <b>3</b> columns.',
    allow: ['[data-step="c:-1"]', '#dz-cols'], glow: '[data-step="c:-1"]', done: () => design.cols === 3 },
  { title: 'Just one row', text: 'Now click the <b>−</b> next to <b>Rows</b> until there is <b>1</b> row. Your quilt is now three blocks side by side.',
    allow: ['[data-step="r:-1"]', '#dz-rows'], glow: '[data-step="r:-1"]', done: () => design.rows === 1 },
  { title: 'Open the middle block', text: '<b>Click the middle block</b> of your quilt. The side panel opens with its editor.',
    allow: ['#dz-quilt'], glow: '#dz-quilt', done: () => !$('dz-side').hidden && focusBlock === 1 && selBlocks.size === 1 },
  { title: 'Choose a pattern', text: 'Under <b>Block pattern</b> at the end of the Block parts card, click <b>Pinwheel</b>.',
    allow: ['#dz-patterns'], glow: '#dz-patterns [data-p="pinwheel"]', done: () => blk(1).pattern === 'pinwheel' },
  { title: 'Pick a piece', text: 'In the big picture of the block at the top of the side panel, <b>click one of the blades</b> of the pinwheel to select it.',
    allow: ['#dz-block'], glow: '#dz-block', done: () => selParts.size > 0 },
  { title: 'Give it a fabric', text: 'Now click a fabric under <b>Fabric for the selected parts</b>, for example <b>Mustard cotton</b> (any fabric different from the one it has). The piece changes right away.',
    allow: ['#dz-fabrics2'], glow: '#dz-fabrics2', done: s => blk(1).fabrics.join() !== s.f, start: () => ({ f: blk(1).fabrics.join() }) },
  { title: 'Select all three blocks', text: 'Press and <b>drag a rectangle</b> across the whole quilt, from one end to the other. Every block it touches is selected.',
    allow: ['#dz-quilt'], glow: '#dz-quilt', done: () => selBlocks.size === 3 },
  { title: 'Copy your block', text: 'In the side panel, under <b>Blocks in your quilt</b>, click the <b>Pinwheel</b>. All three blocks become a copy of it.',
    allow: ['#dz-library'], glow: '#dz-library', done: () => design.blocks.every(b => b.pattern === 'pinwheel' && blockKey(b) === blockKey(blk(1))) },
  { title: 'Close the side panel', text: 'Click the highlighted <b>round button</b> beside the quilt (Block parts) again to close the side panel and see the whole quilt.', allow: ['#rail-parts'], glow: '#rail-parts', done: () => $('dz-side').hidden },
  { title: 'Go back in time', text: 'Changed your mind? Press the <b>←</b> arrow key on your keyboard. The timeline opens at the bottom of the page and steps back one change.',
    allow: ['#tl-panel'], done: s => tl.i < s.i, start: () => ({ i: tl.i }) },
  { title: 'And forward again', text: 'Now press the <b>→</b> arrow key to bring the change back. Later, double-click an empty part of the page to close the timeline.', allow: ['#tl-panel'], done: s => tl.i > s.i, start: () => ({ i: tl.i }) },
  { title: 'Open the borders', text: 'Click the <b>Borders</b> round button beside the quilt — the one with a frame drawn on it.',
    allow: ['#rail-brd'], glow: '#rail-brd', done: () => !$('dz-side').hidden && toolsPanel === 'brd' },
  { title: 'Add a border', text: 'In the <b>Borders</b> card, click <b>Piano keys</b> to frame your quilt.',
    allow: ['#brd-types'], glow: '.brd-type[data-t="piano"]', done: () => bordersOf(design).length > 0 },
  { title: 'Well done!', text: 'You made a three-block quilt, changed a block, copied it, used undo and redo and added a border. Every change also appears on the bed in <b>Simulation</b>. Keep this quilt, or go back to the one you had before. Restart the tour any time with <b>? Guided tour</b>.',
    center: true, buttons: [['Keep this quilt', 'keep', true], ['Go back to my previous quilt', 'restore']] },
];
function tourAllowed(el) { return !!(el && el.closest && (el.closest('#tour') || el.closest('.tour-allow'))); }
function tourBlock(e) {
  if (!tour.on || tourAllowed(e.target)) return;
  if (e.type === 'keydown' && !['Enter', ' ', 'Escape'].includes(e.key) && !((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key))) return;   // reading and scrolling keys still work
  e.preventDefault(); e.stopImmediatePropagation();
}
for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'change', 'input', 'contextmenu', 'touchstart'])
  document.addEventListener(ev, tourBlock, true);
for (const id of ['dz-dialog', 'dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop'])
  $(id).addEventListener('cancel', e => { if (tour.on && !(TOUR[tour.i].allow || []).includes('#dz-done')) e.preventDefault(); });
function tourHost() {         // the tour card must sit inside an open modal pop-up, or it would be blocked by it
  for (const id of ['dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop', 'dz-dialog']) { const d = $(id); if (d && d.open) return d; }
  return document.body;
}
// Place the card where it covers the least of what the user needs: the quilt, the open pop-up, the
// controls of this step, the toolbar and side panel. It can also be dragged by its top line, or folded.
function tourPlace() {
  const box = $('tour'), st = TOUR[tour.i], host = tourHost();
  if (box.parentElement !== host) host.appendChild(box);
  box.classList.toggle('center', !!st.center && !tour.userPos);
  const W = innerWidth, H = innerHeight, bw = box.offsetWidth, bh = box.offsetHeight, m = 12;
  const clampXY = (x, y) => [Math.max(m, Math.min(W - bw - m, x)), Math.max(m, Math.min(H - bh - m, y))];
  if (tour.userPos) { const [x, y] = clampXY(tour.userPos[0], tour.userPos[1]); box.style.left = x + 'px'; box.style.top = y + 'px'; return; }
  if (st.center) { box.style.left = box.style.top = ''; return; }
  const rectOf = el => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const tg = st.glow && document.querySelector(st.glow), T = rectOf(tg);
  const keep = [];                                  // [rect, weight]
  if (T) keep.push([T, 12]);
  document.querySelectorAll('.tour-allow').forEach(el => { const r = rectOf(el); if (r) keep.push([r, 8]); });
  for (const sel of ['#dz-quilt', '#dz-size2', '#dz-size']) { const r = rectOf(document.querySelector(sel)); if (r) keep.push([r, 3]); }
  if (host !== document.body) { const r = rectOf(host); if (r) keep.push([r, 6]); }
  const side = $('dz-side'); if (side && !side.hidden) { const r = rectOf(side); if (r) keep.push([r, 2]); }
  const bar = $('tl-panel'), barTop = bar && !bar.hidden ? bar.getBoundingClientRect().top : H;
  const cands = [[m, m + 60], [W - bw - m, m + 60], [m, barTop - bh - m], [W - bw - m, barTop - bh - m], [m, (H - bh) / 2], [W - bw - m, (H - bh) / 2]];
  if (T) cands.push([T.right + 14, T.top + T.height / 2 - bh / 2], [T.left - 14 - bw, T.top + T.height / 2 - bh / 2], [T.left + T.width / 2 - bw / 2, T.bottom + 14], [T.left + T.width / 2 - bw / 2, T.top - 14 - bh]);
  let best = null;
  for (const c of cands) {
    const [x, y] = clampXY(c[0], c[1]);
    let cost = 0;
    for (const [r, w] of keep) { const ox = Math.max(0, Math.min(x + bw, r.right) - Math.max(x, r.left)), oy = Math.max(0, Math.min(y + bh, r.bottom) - Math.max(y, r.top)); cost += ox * oy * w; }
    if (y + bh > barTop) cost += (y + bh - barTop) * bw * 4;               // keep the timeline strip clear
    if (T) cost += Math.hypot(x + bw / 2 - (T.left + T.width / 2), y + bh / 2 - (T.top + T.height / 2)) * 2;   // then: as close to the target as possible
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  box.style.left = best.x + 'px'; box.style.top = best.y + 'px';
}
function initTourDrag() {
  const head = document.querySelector('#tour .tour-head');
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const box = $('tour'), r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    box.classList.remove('center'); head.setPointerCapture(e.pointerId);
    const move = ev => { tour.userPos = [ev.clientX - dx, ev.clientY - dy]; tourPlace(); };
    const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
  });
  $('tour-min').addEventListener('click', () => { const box = $('tour'); box.classList.toggle('min'); $('tour-min').textContent = box.classList.contains('min') ? '▢' : '–'; $('tour-min').title = box.classList.contains('min') ? 'Show the instructions' : 'Fold the instructions'; tourPlace(); });
}
function tourMark() {
  document.querySelectorAll('.tour-allow').forEach(el => el.classList.remove('tour-allow'));
  document.querySelectorAll('.tour-glow').forEach(el => el.classList.remove('tour-glow'));
  if (!tour.on) return;
  const st = TOUR[tour.i];
  for (const sel of st.allow || []) document.querySelectorAll(sel).forEach(el => el.classList.add('tour-allow'));
  const g = st.glow && document.querySelector(st.glow); if (g) g.classList.add('tour-glow');
}
function tourShow() {
  const st = TOUR[tour.i];
  $('tour-count').textContent = st.center ? 'Guided tour' : `Step ${tour.i} of ${TOUR.length - 2}`;
  $('tour-title').textContent = st.title; $('tour-text').innerHTML = st.text;
  $('tour-prog').style.width = `${Math.round(tour.i / (TOUR.length - 1) * 100)}%`;
  const acts = $('tour-actions'); acts.innerHTML = '';
  for (const [label, act, primary] of st.buttons || []) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (primary) b.className = 'primary';
    b.addEventListener('click', () => tourAct(act)); acts.appendChild(b);
  }
  $('tour-skip').hidden = tour.i === TOUR.length - 1;
  if (st.enter) st.enter();
  tour.mark = st.start ? st.start() : null;
  tourMark();
  const g = st.glow && document.querySelector(st.glow);
  if (g) g.scrollIntoView({ block: 'center', inline: 'nearest' });
  requestAnimationFrame(tourPlace);
  if (st.buttons) acts.querySelector('button').focus();
}
function tourTick() {
  if (!tour.on) return;
  const st = TOUR[tour.i];
  tourMark(); tourPlace();
  if (st.done && st.done(tour.mark || {})) { tour.i++; tourShow(); }
}
function tourBegin() {
  if (tour.on) return;
  tour.saved = design ? JSON.stringify(design) : null; tour.savedCur = typeof mineCur !== 'undefined' ? mineCur : null;
  tour.on = true; tour.i = 0; tour.userPos = null;
  document.body.classList.add('tour-active');
  for (const id of ['dz-dialog', 'dz-partdlg', 'save-dlg', 'cam-dialog', 'cg-pop']) if ($(id).open) $(id).close();
  if (state.page !== 'design') showPage('design');
  hideTools();
  // the tour always starts from the same default quilt (5 × 5, 458 mm, Ohio star and nine patch), with its
  // own timeline; the user's own quilt is put aside and comes back if they skip or ask for it at the end
  const fresh = () => {
    design = defaultDesign(); selBlocks = new Set([0]); focusBlock = 0; selParts.clear();
    try { localStorage.removeItem(tlKeyFor('tour')); } catch (e) {}
    tlSwitch('tour'); saveDesign(); renderDesigner();
  };
  if (design) fresh(); else (async () => { await initFabricLib(); if (!design) design = loadDesign(); fresh(); })();
  $('tour').hidden = false; tourShow();
  clearInterval(tour.poll); tour.poll = setInterval(tourTick, 200);
}
function tourAct(act) {
  if (act === 'next') { tour.i = 1; tourShow(); return; }
  if (act === 'skip') { tourEnd('restore'); return; }
  tourEnd(act);
}
function tourEnd(how) {
  tour.on = false; clearInterval(tour.poll);
  document.body.classList.remove('tour-active'); tourMark();
  const box = $('tour'); box.hidden = true; document.body.appendChild(box);
  try { localStorage.setItem(TOUR_KEY, 'done'); } catch (e) {}
  for (const id of ['dz-dialog', 'dz-partdlg']) if ($(id).open) $(id).close();
  if (how === 'keep') {            // the tour quilt becomes an ordinary unsaved design, with its history
    tlCopy('tour', null); mineCur = null; mineSave(); tlSwitch(null);
  } else if (how === 'restore' && tour.saved) {
    design = JSON.parse(tour.saved); mineCur = tour.savedCur; mineSave();
    selBlocks = new Set([0]); focusBlock = 0; selParts.clear();
    tlSwitch(mineCur); saveDesign();
  }
  try { localStorage.removeItem(tlKeyFor('tour')); } catch (e) {}
  showPage('design');
}
$('tour-start').addEventListener('click', tourBegin);
initTourDrag();
$('tour-skip').addEventListener('click', () => tourAct('skip'));
window.addEventListener('resize', () => { if (tour.on) tourPlace(); });
document.addEventListener('scroll', () => { if (tour.on) tourPlace(); }, true);
// first visit: offer the tour once the designer is ready
setTimeout(() => { let seen = null; try { seen = localStorage.getItem(TOUR_KEY); } catch (e) {} if (!seen && !IS_PHONE && state.page === 'design') tourBegin(); }, 1200);

// ---- My designs: saved quilts, shown as a Pinterest-style masonry
const MINE_KEY = 'quilt-mydesigns.v1', MINE_CUR = 'quilt-mydesigns-current.v1';
let mine = []; try { mine = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch (e) {}
// A medallion sampler in the style of a quilt the user shared: a large eight-point star in the centre, rings of
// nine-patches, half-square triangles, flying geese, sawtooth stars and economy blocks mirrored eight ways,
// a narrow chocolate border and a wide floral one. It is laid out once, in the top-left eighth, and mirrored.
function medallionDesign() {
  const N = 14, CR = 'b0', MI = 'b9', CH = 'b10', WH = 'b11', MU = 'b3', FL = 'b12';
  const d = { cols: N, rows: N, blockMm: 140, backFabric: CR, sym: 'kal', blocks: [],
    borders: [{ type: 'plain', mm: 25, fabrics: [CH, CH, CH] }, { type: 'plain', mm: 150, fabrics: [FL, FL, FL] }] };
  for (let i = 0; i < N * N; i++) d.blocks.push(newBlock('plain', [WH, WH, WH]));
  const put = (c, r, pattern, roles, rot = 0, extra = {}) => { d.blocks[r * N + c] = { ...newBlock(pattern, roles), rot, ...extra }; };
  // the top-left eighth (c >= r); diagonal cells hold blocks that mirror onto themselves
  put(0, 0, 'nine', [CR, CH, CH]);        put(1, 0, 'nine', [CR, CH, CH]);       put(2, 0, 'hst', [WH, MI, MI], 1);
  put(3, 0, 'geese', [WH, CH, CH], 2);    put(4, 0, 'sawstar', [WH, MU, FL]);    put(5, 0, 'hst', [WH, CH, CH], 0);
  put(6, 0, 'economy', [WH, CH, FL]);
  put(1, 1, 'nine', [WH, MI, MI]);        put(2, 1, 'nine', [CR, CH, CH]);       put(3, 1, 'hst', [WH, CH, CH], 0);
  put(4, 1, 'hst', [WH, MI, MI], 1);      put(5, 1, 'sawstar', [WH, CH, MI]);    put(6, 1, 'economy', [MI, CH, FL]);
  put(2, 2, 'hst', [WH, MI, MI], 1);      put(3, 2, 'nine', [CR, CH, CH]);       put(4, 2, 'nine', [WH, MU, MU]);
  put(5, 2, 'hst', [MI, WH, WH], 1);      put(6, 2, 'economy', [WH, CH, FL]);
  put(3, 3, 'sawstar', [WH, CH, MI]);     put(4, 3, 'nine', [WH, MU, MU]);       put(5, 3, 'geese', [WH, CH, CH], 1);
  put(6, 3, 'hst', [WH, MI, MI], 0);
  put(4, 4, 'sawstar', [WH, CH, CH]);     put(5, 4, 'hst', [WH, CH, CH], 3);     put(6, 4, 'geese', [WH, CH, MI], 2);
  // the large centre star: 4 × 4 cells
  put(5, 5, 'eightstar', [WH, CH, MU], 0, { span: 4 });
  const keep = design; design = d;
  try { normalizeSpans(d); const src = []; for (let r = 0; r < 7; r++) for (let c = r; c < 7; c++) src.push(r * N + c); symApply(src); normalizeSpans(d); }
  finally { design = keep; }
  return d;
}
// The quilt in the user's photo, laid out on a 15 × 15 grid: the top-left eighth is entered cell by cell
// (c >= r) and mirrored eight ways; the 3 × 3 star sits in the middle.
function photoMedallion() {
  const N = 15, WH = 'b11', MI = 'b9', CH = 'b10', MU = 'b3', FL = 'b12', MO = 'b13', TE = 'b14', CR = 'b0';
  const d = { cols: N, rows: N, blockMm: 102, backFabric: CR, sym: 'kal', quilting: 'fans', blocks: [],
    borders: [{ type: 'plain', mm: 20, fabrics: [CH, CH, CH] }, { type: 'plain', mm: 140, fabrics: [FL, FL, FL] }] };
  for (let i = 0; i < N * N; i++) d.blocks.push(newBlock('plain', [WH, WH, WH]));
  const put = (c, r, pattern, roles, rot = 0, extra = {}) => { d.blocks[r * N + c] = { ...newBlock(pattern, roles), rot, ...extra }; };
  const chain = [WH, MO, MO], dark9 = [WH, CH, CH], gold9 = [WH, MU, MU];
  const mintH = [WH, MI, MI], darkH = [WH, CH, CH];
  // row 0
  put(0, 0, 'dnine', chain);  put(1, 0, 'nine', chain);        put(2, 0, 'hst', mintH, 0);  put(3, 0, 'hst', darkH, 0);
  put(4, 0, 'sawstar', [WH, MU, FL]);   put(5, 0, 'hst', mintH, 1); put(6, 0, 'hst', darkH, 1);   put(7, 0, 'economy', [MI, TE, CH]);
  // row 1
  put(1, 1, 'nine', chain);   put(2, 1, 'nine', chain);        put(3, 1, 'hst', mintH, 0);  put(4, 1, 'hst', darkH, 0);
  put(5, 1, 'hst', darkH, 1); put(6, 1, 'hst', mintH, 1);      put(7, 1, 'economy', [MI, TE, CH]);
  // row 2
  put(2, 2, 'nine', chain);   put(3, 2, 'nine', dark9);        put(4, 2, 'nine', dark9);    put(5, 2, 'sawstar', [WH, CH, TE]);
  put(6, 2, 'hst', mintH, 0); put(7, 2, 'economy', [MI, TE, CH]);
  // row 3
  put(3, 3, 'nine', chain);   put(4, 3, 'hst', mintH, 0);      put(5, 3, 'nine', gold9);    put(6, 3, 'sawstar', [WH, CH, MO]);
  put(7, 3, 'sawstar', [WH, CH, MO]);
  // row 4
  put(4, 4, 'sawstar', [WH, CH, CH]); put(5, 4, 'hst', mintH, 0); put(6, 4, 'geese', [WH, MO, MO], 2); put(7, 4, 'geese', [WH, MO, MO], 2);
  // row 5
  put(5, 5, 'sqsq', [WH, MI, MI]); put(6, 5, 'hst', [WH, MI, MI], 1); put(7, 5, 'plain', [WH, WH, WH]);
  // the centre star: 3 × 3 cells, a floral centre
  put(6, 6, 'eightstar', [WH, CH, FL], 0, { span: 3 });
  const keep = design; design = d;
  try { normalizeSpans(d); const src = []; for (let r = 0; r < 8; r++) for (let c = r; c < 8; c++) src.push(r * N + c); symApply(src); normalizeSpans(d); }
  finally { design = keep; }
  delete d.sym;            // laid out; mirroring stays off until the user turns it on
  return d;
}
// add it to My designs once
try {
  if (!localStorage.getItem('quilt-medallion-seeded.v1')) {
    const now = Date.now();
    mine.push({ id: 'qmedallion', name: 'Medallion sampler', d: JSON.stringify(medallionDesign()), created: now, updated: now });
    localStorage.setItem(MINE_KEY, JSON.stringify(mine)); localStorage.setItem('quilt-medallion-seeded.v1', '1');
  }
  if (!localStorage.getItem('quilt-photo-seeded.v1')) {
    const now = Date.now() + 1;
    mine.push({ id: 'qphoto', name: 'Medallion from the photo', d: JSON.stringify(photoMedallion()), created: now, updated: now });
    localStorage.setItem(MINE_KEY, JSON.stringify(mine)); localStorage.setItem('quilt-photo-seeded.v1', '1');
  }
} catch (e) {}
let mineCur = null; try { mineCur = localStorage.getItem(MINE_CUR) || null; } catch (e) {}
function mineSave() {
  try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); if (mineCur) localStorage.setItem(MINE_CUR, mineCur); else localStorage.removeItem(MINE_CUR); }
  catch (e) { alertMine('Your browser storage is full: delete a design to save new ones.'); }
}
function alertMine(t) { const el = $('mine-empty'); el.textContent = t; el.hidden = false; }
function quiltPicture(d, width) {
  const qq = quiltMm(d), dpr = Math.min(window.devicePixelRatio || 1, 2), w = width, h = Math.round(width * qq.H / qq.W);
  const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const keep = design; design = d;
  try { drawQuilt(g, w, h, { seams: true }); g.strokeStyle = '#2f466f'; g.lineWidth = Math.max(2, w * 0.012); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  finally { design = keep; }
  return c;
}
let saveForceNew = false;
function openSaveDialog(forceNew) {
  if (!design) return;
  saveForceNew = !!forceNew;
  const cur = !saveForceNew && mine.find(m => m.id === mineCur);
  $('save-name').value = cur ? cur.name : `Quilt ${mine.length + 1}`;
  $('save-title').textContent = cur ? 'Save changes' : 'Save design';
  $('save-asnew').hidden = !cur;
  const pic = quiltPicture(design, 300), cv = $('save-cv');
  cv.width = pic.width; cv.height = pic.height; cv.style.width = '300px'; cv.getContext('2d').drawImage(pic, 0, 0);
  const d = $('save-dlg'); if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  $('save-name').select();
}
function doSave(asNew) {
  const name = ($('save-name').value || '').trim() || `Quilt ${mine.length + 1}`, now = Date.now(), d = JSON.stringify(design);
  let cur = !asNew && !saveForceNew && mine.find(m => m.id === mineCur);
  const prev = mineCur;
  if (cur) { cur.name = name; cur.d = d; cur.updated = now; }
  else {
    cur = { id: 'q' + now.toString(36) + Math.random().toString(36).slice(2, 5), name, d, created: now, updated: now }; mine.push(cur);
    // the new design takes the timeline so far (an unsaved draft's moves over; a saved design keeps its own too)
    tlCopy(undefined, cur.id); if (!prev) { try { localStorage.removeItem(tlKeyFor(null)); } catch (e) {} }
    tl.key = tlKeyFor(cur.id);
  }
  saveForceNew = false;
  mineCur = cur.id; mineSave();
  $('save-dlg').close();
  const b = $('dz-save'); b.classList.add('saved'); b.title = 'Saved ✓'; setTimeout(() => { b.classList.remove('saved'); b.title = 'Save this quilt to My designs'; }, 1600);
}
function openMine(id) {
  const m = mine.find(x => x.id === id); if (!m) return;
  design = JSON.parse(m.d); mineCur = id; mineSave();
  selBlocks = new Set([0]); focusBlock = 0; selParts.clear();
  tlSwitch(id);
  saveDesign(); showPage('design');
}
function renderMine() {
  const grid = $('mine-grid'), q = ($('mine-q').value || '').trim().toLowerCase(), sort = $('mine-sort').value;
  let list = mine.filter(m => !q || m.name.toLowerCase().includes(q));
  list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b[sort] - a[sort]);
  grid.innerHTML = '';
  $('mine-empty').hidden = mine.length > 0 && list.length > 0;
  if (mine.length && !list.length) $('mine-empty').textContent = 'No designs match your search.';
  else $('mine-empty').innerHTML = 'No saved designs yet. In the Quilt designer, press <b>Save</b> to keep a quilt here.';
  const when = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  for (const m of list) {
    let d; try { d = JSON.parse(m.d); } catch (e) { continue; }
    const pin = document.createElement('article'); pin.className = 'pin' + (m.id === mineCur ? ' current' : '');
    const img = document.createElement('div'); img.className = 'img'; img.title = 'Open in the Quilt designer';
    img.appendChild(quiltPicture(d, 260));
    const over = document.createElement('div'); over.className = 'over';
    over.innerHTML = '<button class="open" type="button">Open</button><button class="ic" type="button" data-a="rename" title="Rename" aria-label="Rename">✎</button><button class="ic" type="button" data-a="dup" title="Duplicate" aria-label="Duplicate">⧉</button><button class="ic" type="button" data-a="del" title="Delete" aria-label="Delete">🗑</button>';
    img.appendChild(over);
    const meta = document.createElement('div'); meta.className = 'meta';
    const nm = document.createElement('b'); nm.textContent = m.name;
    const sm = document.createElement('small'); sm.textContent = `${d.cols} × ${d.rows} blocks · ${quiltMm(d).W} × ${quiltMm(d).H} mm · ${when(m.updated)}`;
    meta.append(nm, sm); pin.append(img, meta); grid.appendChild(pin);
    img.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) { openMine(m.id); return; }
      if (a === 'rename') {
        const inp = document.createElement('input'); inp.type = 'text'; inp.value = m.name; inp.maxLength = 60; inp.style.width = '100%';
        nm.replaceWith(inp); inp.focus(); inp.select();
        const done = () => { m.name = inp.value.trim() || m.name; mineSave(); renderMine(); };
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); if (ev.key === 'Escape') renderMine(); });
        inp.addEventListener('blur', done);
      } else if (a === 'dup') {
        const now = Date.now(), nid = 'q' + now.toString(36) + Math.random().toString(36).slice(2, 5); mine.push({ ...m, id: nid, name: m.name + ' (copy)', created: now, updated: now }); tlCopy(m.id, nid); mineSave(); renderMine();
      } else if (a === 'del') {
        const btn = e.target.closest('[data-a]');
        if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = '✓'; btn.title = 'Click again to delete'; btn.style.background = '#e0592a'; btn.style.color = '#fff'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = '🗑'; btn.style.background = ''; btn.style.color = ''; } }, 2500); return; }
        mine = mine.filter(x => x.id !== m.id); try { localStorage.removeItem(tlKeyFor(m.id)); } catch (e) {}
        if (mineCur === m.id) { mineCur = null; tlCopy(undefined, null); tl.key = tlKeyFor(null); tlSave(); }
        mineSave(); renderMine();
      }
    });
  }
}
function initMine() {
  $('dz-save').addEventListener('click', () => openSaveDialog(false));
  // New design: always the same default quilt (5 × 5 Ohio star / nine patch, 458 mm); the timeline keeps the previous one
  $('dz-new').addEventListener('click', () => {
    design = defaultDesign(); mineCur = null; mineSave();
    selBlocks = new Set([0]); focusBlock = 0; selParts.clear();
    if ($('dz-dialog').open) $('dz-dialog').close();
    try { localStorage.removeItem(tlKeyFor(null)); } catch (e) {}   // a new design starts its own, empty timeline
    tlSwitch(null);
    saveDesign(); renderDesigner();
  });
  $('mine-new').addEventListener('click', () => openSaveDialog(true));
  $('save-ok').addEventListener('click', () => doSave(false));
  $('save-asnew').addEventListener('click', () => doSave(true));
  $('save-x').addEventListener('click', () => $('save-dlg').close());
  $('save-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSave(false); } });
  $('save-dlg').addEventListener('close', () => { saveForceNew = false; if (state.page === 'mine') renderMine(); });
  $('mine-q').addEventListener('input', renderMine); $('mine-sort').addEventListener('change', renderMine);
}
initMine();
$('cg-pop-x').addEventListener('click', () => $('cg-pop').close());
$('cg-pop').addEventListener('click', e => { if (e.target === $('cg-pop')) $('cg-pop').close(); });   // click outside closes
$('cg-pop').addEventListener('close', () => { cgHi = -1; if (lastPlan) drawCutQuilt(lastPlan); });

// ---- design timeline: every change is a step (the last 100 are kept in this browser);
// undo / redo, or jump to any step from the timeline strip.
const TL_KEY = 'quilt-timeline.v1', TL_MAX = 100;
var tlBarOn = false;   // the timeline film strip opens with the arrow keys and closes on a double-click outside
const tl = { steps: [], i: -1, ready: false, restoring: false, timer: 0, thumbs: new Map(), seq: 0, key: '' };
// each design has its own timeline: saved designs by their id, the unsaved one as "draft"
const tlKeyFor = id => TL_KEY + ':' + (id || 'draft');
function tlSave() {
  const v = JSON.stringify({ steps: tl.steps, i: tl.i, seq: tl.seq });
  for (let tries = 0; tries < 8; tries++) {
    try { localStorage.setItem(tl.key, v); return; }
    catch (e) {   // storage full: shorten the longest other timeline and try again
      let worst = null, size = 0;
      for (let k = 0; k < localStorage.length; k++) { const n = localStorage.key(k); if (n && n.startsWith(TL_KEY + ':') && n !== tl.key) { const l = (localStorage.getItem(n) || '').length; if (l > size) { size = l; worst = n; } } }
      if (!worst) return;
      try { const o = JSON.parse(localStorage.getItem(worst)); if (o.steps.length <= 2) localStorage.removeItem(worst); else { const cut = Math.ceil(o.steps.length / 2); o.steps = o.steps.slice(cut); o.i = Math.max(0, o.i - cut); localStorage.setItem(worst, JSON.stringify(o)); } } catch (e2) { localStorage.removeItem(worst); }
    }
  }
}
// switch to another design's timeline (loads it, or starts one)
function tlSwitch(id) {
  clearTimeout(tl.timer);
  if (tl.ready) tlSave();
  tl.key = tlKeyFor(id); tl.steps = []; tl.i = -1; tl.seq = 0; tl.ready = false; tl.thumbs.clear();
  tlEnsure();
}
// a design got a new id (first save, save as new, duplicate): give it a copy of a timeline
function tlCopy(fromId, toId, move) {
  try { const v = fromId === undefined ? JSON.stringify({ steps: tl.steps, i: tl.i, seq: tl.seq }) : localStorage.getItem(tlKeyFor(fromId)); if (v) localStorage.setItem(tlKeyFor(toId), v); if (move && fromId !== undefined) localStorage.removeItem(tlKeyFor(fromId)); } catch (e) {}
}
function tlEnsure() {
  if (tl.ready || !design) return;
  tl.ready = true;
  if (!tl.key) {
    tl.key = tlKeyFor(typeof mineCur !== 'undefined' ? mineCur : null);
    try { const old = localStorage.getItem(TL_KEY); if (old && !localStorage.getItem(tl.key)) localStorage.setItem(tl.key, old); localStorage.removeItem(TL_KEY); } catch (e) {}   // timeline saved before designs had their own
  }
  try { const o = JSON.parse(localStorage.getItem(tl.key) || 'null'); if (o && Array.isArray(o.steps) && o.steps.length) { tl.steps = o.steps; tl.i = Math.min(o.i, o.steps.length - 1); tl.seq = o.seq || o.steps.length; } } catch (e) {}
  const cur = JSON.stringify(design);
  if (!tl.steps.length || tl.steps[tl.i].d !== cur) tlPush(cur, tl.steps.length ? 'Opened' : 'Start');
  tlUI();
}
function tlPush(d, label) {
  tl.steps = tl.steps.slice(0, tl.i + 1);                 // a change after going back starts a new branch
  tl.steps.push({ id: ++tl.seq, d, label, t: Date.now() });
  while (tl.steps.length > TL_MAX) tl.steps.shift();
  tl.i = tl.steps.length - 1;
  tlSave();
}
// changes arriving close together (typing a number, dragging) become one step
function tlRecord() {
  if (tl.restoring || !design) return;
  tlEnsure();
  clearTimeout(tl.timer);
  tl.timer = setTimeout(tlCommit, 450);
}
function tlCommit() {          // record the pending change now
  clearTimeout(tl.timer); tl.timer = 0;
  if (!design || !tl.ready) return;
  const cur = JSON.stringify(design), prev = tl.steps[tl.i];
  if (prev && prev.d === cur) return;
  tlPush(cur, tlDescribe(prev ? JSON.parse(prev.d) : null, design));
  tlUI();
}
function tlDescribe(a, b) {
  if (!a) return 'Start';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (a.cols !== b.cols || a.rows !== b.rows) return `Layout ${b.cols} × ${b.rows}`;
  if (a.blockMm !== b.blockMm) return `Block size ${b.blockMm} mm`;
  if (a.backFabric !== b.backFabric) return `Backing: ${fabricById(b.backFabric).name}`;
  if (JSON.stringify(a.borders || []) !== JSON.stringify(b.borders || [])) {
    const na = bordersOf(a).length, nb = bordersOf(b).length;
    if (nb > na) return `Add border: ${BORDER_TYPES[bordersOf(b)[nb - 1].type].label}`;
    if (nb < na) return 'Remove border';
    return 'Change border';
  }
  if (JSON.stringify(a.sashing || null) !== JSON.stringify(b.sashing || null)) {
    const p = sashOf(a), s = sashOf(b);
    if (!s.mm) return 'No sashing';
    if (p.mm !== s.mm) return `Sashing ${s.mm} mm`;
    if (p.border !== s.border) return s.border ? 'Sashing border on' : 'Sashing border off';
    if (p.fabric !== s.fabric) return `Sashing: ${fabricById(s.fabric).name}`;
    return `Cornerstones: ${fabricById(s.corner).name}`;
  }
  let pat = 0, rot = 0, fab = 0; const newFabs = new Set(), patNames = new Set();
  b.blocks.forEach((x, i) => {
    const y = a.blocks[i]; if (!y) return;
    if (x.pattern !== y.pattern) { pat++; patNames.add(PATTERNS[x.pattern].label); return; }
    if (x.rot !== y.rot) rot++;
    let ch = false; x.fabrics.forEach((f, k) => { if (f !== y.fabrics[k]) { ch = true; newFabs.add(f); } }); if (ch) fab++;
  });
  if (pat) return `${patNames.size === 1 ? [...patNames][0] : 'Patterns'} in ${plural(pat, 'block')}`;
  if (fab) return `${newFabs.size === 1 ? fabricById([...newFabs][0]).name : 'Fabrics'} in ${plural(fab, 'block')}`;
  if (rot) return `Rotate ${plural(rot, 'block')}`;
  return 'Change';
}
function tlGo(i) {
  if (!tl.steps.length) return;
  i = Math.max(0, Math.min(tl.steps.length - 1, i));
  if (i === tl.i) return;
  clearTimeout(tl.timer);
  tl.i = i; tlSave();
  design = JSON.parse(tl.steps[i].d);
  const n = design.blocks.length;
  selBlocks = new Set([Math.min(focusBlock, n - 1)]); focusBlock = [...selBlocks][0]; selParts.clear();
  tl.restoring = true; saveDesign(); renderDesigner(); tl.restoring = false;
  tlUI();
}
function tlThumb(step) {
  if (tl.thumbs.has(step.id)) return tl.thumbs.get(step.id);
  const d = JSON.parse(step.d), S = 82, c = document.createElement('canvas'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const qq = quiltMm(d), w = qq.W >= qq.H ? S : Math.round(S * qq.W / qq.H), h = qq.W >= qq.H ? Math.round(S * qq.H / qq.W) : S;
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const keep = design; design = d; try { drawQuilt(g, w, h); } finally { design = keep; }
  tl.thumbs.set(step.id, c);
  if (tl.thumbs.size > 140) tl.thumbs.delete(tl.thumbs.keys().next().value);
  return c;
}
function tlUI() {
  const n = tl.steps.length;
  $('tl-undo').disabled = tl.i <= 0; $('tl-redo').disabled = tl.i >= n - 1;
  $('tl-open').textContent = `Timeline · ${tl.i + 1}/${n}`;
  if ($('tl-panel').hidden) return;
  $('tl-first').disabled = $('tl-back').disabled = tl.i <= 0; $('tl-last').disabled = $('tl-fwd').disabled = tl.i >= n - 1;
  const sl = $('tl-slider'); sl.max = Math.max(0, n - 1); sl.value = tl.i;
  $('tl-pos').textContent = `${tl.i + 1} / ${n} · ${tl.steps[tl.i] ? tl.steps[tl.i].label : ''}`;
  const list = $('tl-list'); list.innerHTML = '';
  const now = Date.now(), ago = t => { const s = Math.round((now - t) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  tl.steps.forEach((st, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl-step' + (k === tl.i ? ' cur' : '') + (k > tl.i ? ' future' : '');
    b.title = `Step ${k + 1}: ${st.label} · ${ago(st.t)}`;
    const num = document.createElement('span'); num.className = 'n'; num.textContent = `${k + 1}`;
    const lab = document.createElement('span'); lab.className = 'l'; lab.textContent = st.label;
    b.append(tlThumb(st), num, lab);
    b.addEventListener('click', () => tlGo(k));
    list.appendChild(b);
  });
  const cur = list.children[tl.i]; if (cur) list.scrollLeft = cur.offsetLeft - list.clientWidth / 2 + cur.offsetWidth / 2;
}
function initTimeline() {
  $('tl-undo').addEventListener('click', () => tlGo(tl.i - 1));
  $('tl-redo').addEventListener('click', () => tlGo(tl.i + 1));
  const showBar = v => {
    const p = $('tl-panel'); p.hidden = !v; $('tl-open').setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('tl-open', v);
    if (v) { tlUI(); document.body.style.setProperty('--tl-h', p.offsetHeight + 'px'); } else stopPlay();
    tlBarOn = v;
    if (state.page === 'design') drawDesignerCanvas();
  };
  tl.showBar = showBar;
  $('tl-open').addEventListener('click', () => showBar($('tl-panel').hidden));
  $('tl-close').addEventListener('click', () => showBar(false));
  $('tl-first').addEventListener('click', () => tlGo(0));
  $('tl-last').addEventListener('click', () => tlGo(tl.steps.length - 1));
  $('tl-back').addEventListener('click', () => tlGo(tl.i - 1));
  $('tl-fwd').addEventListener('click', () => tlGo(tl.i + 1));
  // play: runs through the history like a video, from the start (or from here) to the latest step
  let playT = 0;
  function stopPlay() { clearInterval(playT); playT = 0; $('tl-play').textContent = '▶'; $('tl-play').setAttribute('aria-label', 'Play'); }
  $('tl-play').addEventListener('click', () => {
    if (playT) { stopPlay(); return; }
    if (tl.i >= tl.steps.length - 1) tlGo(0);
    $('tl-play').textContent = '❚❚'; $('tl-play').setAttribute('aria-label', 'Pause');
    playT = setInterval(() => { if (tl.i >= tl.steps.length - 1) { stopPlay(); return; } tlGo(tl.i + 1); }, 600);
  });
  // the wheel scrolls the film strip sideways
  $('tl-list').addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); $('tl-list').scrollLeft += e.deltaY; } }, { passive: false });
  $('tl-slider').addEventListener('input', e => tlGo(+e.target.value));
  $('tl-clear').addEventListener('click', () => { if (!design) return; tl.steps = []; tl.i = -1; tl.thumbs.clear(); tlPush(JSON.stringify(design), 'Start'); tlUI(); });
  // the undo / redo / Timeline buttons stay hidden until the left or right arrow key is pressed
  const row = $('tl-row'); let rowT = 0;
  const hideRow = () => { clearTimeout(rowT); rowT = setTimeout(() => { if (row.matches(':hover') || row.contains(document.activeElement)) return hideRow(); row.classList.add('tl-hidden'); }, 5000); };
  document.addEventListener('keydown', e => {
    if (state.page !== 'design' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || e.target.closest('[role="listbox"], #tl-panel')) return;
    e.preventDefault();
    if ($('tl-panel').hidden && tl.showBar) tl.showBar(true);
    if (design) tlGo(tl.i + (e.key === 'ArrowRight' ? 1 : -1));   // the arrows step back and forth through the timeline
  });
  tl.hideRow = () => { clearTimeout(rowT); row.classList.add('tl-hidden'); };
  row.addEventListener('pointerleave', hideRow);
  document.addEventListener('keydown', e => {
    if (state.page !== 'design' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); tlGo(tl.i - 1); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); tlGo(tl.i + 1); }
  });
}
initTimeline();
// the toolbar can wrap onto a second line (status text): refit the quilt when its height changes
new ResizeObserver(() => { if (state.page === 'design' && design) drawDesignerCanvas(); }).observe($('dz-size'));

// 3D view: the scenario / display / pointer buttons are hidden until asked for
(function initStageControls() {
  const stage = $('stage'), btn = $('stage-ctl'), KEY = 'quilt-stage-ctl.v1';
  let shown = false; try { shown = localStorage.getItem(KEY) === '1'; } catch (e) {}
  const set = v => { shown = v; stage.dataset.ctl = v ? 'shown' : 'hidden'; btn.textContent = v ? 'Hide controls' : 'Show controls'; btn.setAttribute('aria-expanded', String(v)); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
  btn.addEventListener('click', () => set(!shown));
  set(shown);
})();

// Run options card: hidden until "More options"
const simPanels = { run: false, adv: false };
function updateSimSide() {
  const side = $('sim-side'), any = simPanels.run || simPanels.adv;
  side.hidden = !any; $('bench').classList.toggle('one', !any);
  $('run-card').hidden = !simPanels.run;
  requestAnimationFrame(() => { resize(); fitSimSide(); });
}
(function initRunMore() {
  const btn = $('run-more');
  const set = v => { simPanels.run = v; btn.textContent = v ? 'Fewer options' : 'More options'; btn.setAttribute('aria-expanded', String(v)); updateSimSide(); };
  btn.addEventListener('click', () => set(!simPanels.run));
  set(false);                             // always starts closed
})();

// simulation page: the advanced cards (photo render, measurements, analysis, fabric physics) are hidden behind one button
(function initAdvanced() {
  const side = $('sim-side'), btn = $('sim-adv');
  let shown = false;                      // always starts hidden
  const set = v => {
    shown = v; side.dataset.adv = v ? 'shown' : 'hidden'; simPanels.adv = v;
    btn.textContent = v ? 'Hide advanced settings' : 'Show advanced settings';
    btn.title = 'Photo render, measurements, final-state analysis and fabric physics';
    btn.setAttribute('aria-expanded', String(v));
    if (typeof updateSimSide === 'function') updateSimSide();
  };
  btn.addEventListener('click', () => set(!shown));
  set(shown);
})();

// ---- block pattern picker: a dropdown that shows a sketch of every pattern
function patternSketch(key, px = 34) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), c = document.createElement('canvas');
  c.width = c.height = Math.round(px * 1.5 * dpr);       // drawn larger: it grows when hovered
  const g = c.getContext('2d'), S = c.width, cols = ['#efe5cf', '#2f466f', '#c79a45'];
  partsOf(key).forEach(part => { g.fillStyle = cols[part.role]; pathPoly(g, part.poly.map(([u, v]) => [u * S, v * S])); g.fill(); g.lineWidth = Math.max(1, S / 120); g.strokeStyle = 'rgba(0,0,0,.28)'; g.stroke(); });
  return c;
}
function updatePatPicker() {
  const btn = $('dz-patbtn'); if (!btn || !design) return;
  const key = design.blocks[focusBlock].pattern;
  if (btn.dataset.key !== key) {
    btn.dataset.key = key; btn.innerHTML = '';
    const sp = document.createElement('span'); sp.textContent = PATTERNS[key].label;
    btn.append(patternSketch(key), sp);
  }
  for (const o of $('dz-patlist').children) o.setAttribute('aria-selected', String(o.dataset.key === key));
}
function initPatPicker() {
  const btn = $('dz-patbtn'), list = $('dz-patlist');
  for (const [key, p] of Object.entries(PATTERNS)) {
    const o = document.createElement('button'); o.type = 'button'; o.className = 'patopt'; o.role = 'option'; o.dataset.key = key; o.tabIndex = -1;
    const sp = document.createElement('span'); sp.textContent = p.label;
    o.append(patternSketch(key), sp); list.appendChild(o);
  }
  const opts = () => [...list.children];
  const open = () => {
    list.hidden = false; btn.setAttribute('aria-expanded', 'true');
    const cur = opts().find(o => o.getAttribute('aria-selected') === 'true') || opts()[0];
    cur.scrollIntoView({ block: 'nearest' }); cur.focus({ preventScroll: true });
  };
  const close = (refocus) => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); };
  const choose = key => { const ps = $('dz-patsel'); ps.value = key; ps.dispatchEvent(new Event('change')); close(true); };
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('click', e => { const o = e.target.closest('.patopt'); if (o) choose(o.dataset.key); });
  list.addEventListener('keydown', e => {
    const all = opts(), i = all.indexOf(document.activeElement);
    const cols = Math.max(1, Math.round(list.clientWidth / (all[0].offsetWidth || 150)));
    const go = j => { const o = all[Math.max(0, Math.min(all.length - 1, j))]; o.focus(); o.scrollIntoView({ block: 'nearest' }); };
    if (e.key === 'ArrowDown') { e.preventDefault(); go(i + cols); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(i - cols); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close(false);
  });
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && list.hidden) { e.preventDefault(); open(); } });
  document.addEventListener('pointerdown', e => { if (!list.hidden && !$('dz-patpick').contains(e.target)) close(false); });
  // Escape inside the list closes only the list, not the whole pop-up
  $('dz-dialog').addEventListener('cancel', e => { if (!list.hidden) { e.preventDefault(); close(true); } });
}
initPatPicker();

// ---- side-panel cards open and close from their title (remembered in this browser)
const FOLD_KEY = 'quilt-folds.v1';
let folds = {}; try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) {}
function setFold(card, key, folded) {
  card.classList.toggle('folded', folded);
  const head = card.querySelector('.fold-head'); if (head) head.setAttribute('aria-expanded', String(!folded));
  folds[key] = folded; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
}
function makeFoldable(card, head, key) {
  head.classList.add('fold-head'); head.tabIndex = 0; head.setAttribute('role', 'button');
  head.title = 'Click to open or close';
  const toggle = () => setFold(card, key, !card.classList.contains('folded'));
  head.addEventListener('click', toggle);
  head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  card.classList.toggle('folded', !!folds[key]); head.setAttribute('aria-expanded', String(!folds[key]));
}
function initFolds() {
  // only the Simulation side cards fold; the Quilt designer side panel cards always stay open (no fold arrow)
  for (const card of document.querySelectorAll('#sim-side > .card')) {
    const h = card.querySelector(':scope > h2'); if (!h) continue;
    makeFoldable(card, h, 'sim:' + h.textContent.trim().toLowerCase());
  }
  for (const card of document.querySelectorAll('#dz-side > .card')) card.classList.remove('folded');
}
function syncPartsTitle() {
  const title = $('dz-dialog-title');
  title.classList.remove('fold-head'); title.removeAttribute('tabindex'); title.removeAttribute('role'); title.removeAttribute('title'); title.removeAttribute('aria-expanded');
}
initFolds();
// simulation page: the controls column is as tall as the window below its top, so the page itself stays still
function fitSimSide() {
  const side = $('sim-side'); if (!side) return;
  if (window.innerWidth <= 920 || state.page !== 'sim') { side.style.maxHeight = ''; return; }
  const top = side.getBoundingClientRect().top + window.scrollY;
  side.style.maxHeight = Math.max(260, Math.floor(window.innerHeight - top - 40)) + 'px';
}
window.addEventListener('resize', fitSimSide);
window.addEventListener('resize', () => { if (state.page === 'design' && design) drawDesignerCanvas(); });
$('cg-quilt-meta').addEventListener('click', () => { if (cgHi !== -1 && lastPlan) { cgHi = -1; drawCutQuilt(lastPlan); } });
new ResizeObserver(() => { if (state.page === 'cut' && lastPlan && design) drawCutQuilt(lastPlan); }).observe(document.querySelector('.cg-quilt'));
initBedUI();

// ---- new fabric from the camera
// Live camera where the viewer allows it (getUserMedia); otherwise the phone's own camera or a
// file through a capture input. The square inside the guide becomes the fabric: its lighting is
// evened out (divided by a heavily blurred copy) and its edges cross-faded with a half-offset copy
// so it repeats without visible seams.
const cam = { stream: null, facing: 'environment', devices: 0, shot: null };
let camTarget = null;          // set by a caller that wants the new fabric applied its own way
function camMsg(t) { $('cam-msg').textContent = t || ''; }
function camStop() { if (cam.stream) { for (const tr of cam.stream.getTracks()) tr.stop(); cam.stream = null; } $('cam-video').srcObject = null; }
// Is the camera allowed in this frame at all? (an embedding page can block it outright)
function camPolicyAllows() {
  const pp = document.permissionsPolicy || document.featurePolicy;
  try { return pp && pp.allowsFeature ? pp.allowsFeature('camera') : true; } catch (e) { return true; }
}
async function camPermissionState() {
  try { return (await navigator.permissions.query({ name: 'camera' })).state; } catch (e) { return 'unknown'; }
}
// Step 1: ask the viewer before the browser's own prompt appears
async function camAsk() {
  camStop(); cam.shot = null;
  $('cam-ask').hidden = false; $('cam-viewbox').hidden = true; $('cam-live-row').hidden = true; $('cam-review').hidden = true;
  camMsg('');
  const note = $('cam-ask-note'), allow = $('cam-allow'), tab = $('cam-newtab');
  note.hidden = true; allow.hidden = false; allow.disabled = false; tab.hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    note.textContent = 'This browser view does not offer a camera. Use a photo file (on a phone it opens the camera), or open the stand-alone copy of this site, quilt_designer.html, in Chrome, Edge or Firefox.';
    note.hidden = false; allow.hidden = true; return;
  }
  if (!camPolicyAllows()) {
    note.textContent = 'Claude shows this page in a protected window that blocks webcams, so the browser cannot ask for permission here. Use a photo file (on a phone this opens the camera), or open the stand-alone copy of this site, quilt_designer.html, in Chrome, Edge or Firefox to use the webcam.';
    note.hidden = false; allow.hidden = true; return;
  }
  const st = await camPermissionState();
  if (st === 'granted') { camStart(); return; }           // already allowed: go straight to the camera
  if (st === 'denied') {
    note.textContent = 'The camera is blocked for this page. Click the camera or lock icon in the address bar, set Camera to "Allow", then press "Allow webcam" again.';
    note.hidden = false;
  }
}
async function camStart() {
  camStop(); cam.shot = null;
  $('cam-ask').hidden = true; $('cam-viewbox').hidden = false;
  $('cam-review').hidden = true; $('cam-live-row').hidden = false; $('cam-shot').hidden = true; $('cam-video').hidden = false; $('cam-guide').hidden = false;
  camMsg('Waiting for permission to use the webcam…');
  $('cam-snap').disabled = true;
  try {
    // this call is what makes the browser show its permission prompt
    cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    $('cam-video').srcObject = cam.stream; await $('cam-video').play().catch(() => {});
    camMsg('Fill the dashed square with the fabric, hold steady, then take the picture.');
    $('cam-snap').disabled = false; cam.hadLive = true;
    try { cam.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length; } catch (e) { cam.devices = 1; }
    $('cam-flip').hidden = cam.devices < 2;
  } catch (e) {
    await camAsk();
    const note = $('cam-ask-note');
    note.textContent = e && e.name === 'NotAllowedError'
      ? (camPolicyAllows() ? 'Permission was not given. To use the webcam, click the camera or lock icon in the address bar, set Camera to "Allow", then press "Allow webcam" again.' : note.textContent)
      : e && e.name === 'NotFoundError' ? 'No webcam was found on this computer. Use a photo file instead.'
      : e && e.name === 'NotReadableError' ? 'The webcam is in use by another program. Close it and press "Allow webcam" again.'
      : `The webcam could not be started${e && e.name ? ` (${e.name})` : ''}. Press "Allow webcam" to try again, or use a photo file.`;
    note.hidden = false;
    if (e && e.name === 'NotAllowedError' && !camPolicyAllows()) $('cam-allow').hidden = true;
  }
}
function camNoLive(why) {
  $('cam-snap').disabled = true; $('cam-video').hidden = true; $('cam-guide').hidden = true; $('cam-flip').hidden = true;
  camMsg(`${why} Use "Use the phone camera or a file": on a phone it opens the camera; on a computer, pick a photo of the fabric.`);
}
// crop the guide square (70 % of the short side, centred) from a source of size w × h
function camCrop(src, w, h) {
  const side = Math.round(Math.min(w, h) * (src instanceof HTMLVideoElement ? 0.7 : 1)), out = Math.min(1024, side);
  const c = document.createElement('canvas'); c.width = c.height = out;
  c.getContext('2d').drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  return c;
}
function evenLighting(c) {
  const n = c.width, g = c.getContext('2d'), img = g.getImageData(0, 0, n, n), d = img.data;
  // illumination: the photo shrunk to 8 × 8 and smoothly scaled back up
  const s = document.createElement('canvas'); s.width = s.height = 8;
  const sg = s.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, 8, 8);
  const L = document.createElement('canvas'); L.width = L.height = n;
  const lg = L.getContext('2d'); lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high'; lg.drawImage(s, 0, 0, n, n);
  const ld = lg.getImageData(0, 0, n, n).data;
  let mr = 0, mg = 0, mb = 0; const px = n * n;
  for (let i = 0; i < d.length; i += 4) { mr += ld[i]; mg += ld[i + 1]; mb += ld[i + 2]; }
  mr /= px; mg /= px; mb /= px;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (ld[i] + ld[i + 1] + ld[i + 2]) / 3 || 1, mean = (mr + mg + mb) / 3, k = mean / lum;
    d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  g.putImageData(img, 0, 0);
  return c;
}
function makeSeamless(c) {
  const n = c.width, h = n >> 1, g = c.getContext('2d'), A = g.getImageData(0, 0, n, n).data;
  const out = g.createImageData(n, n), o = out.data;
  const edge = (x, y) => Math.max(1e-3, Math.min(x, n - 1 - x, y, n - 1 - y) / h);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const xb = (x + h) % n, yb = (y + h) % n, ia = 4 * (y * n + x), ib = 4 * (yb * n + xb);
    const wa = edge(x, y) ** 2, wb = edge(xb, yb) ** 2, t = wa + wb;
    for (let k = 0; k < 3; k++) o[ia + k] = (A[ia + k] * wa + A[ib + k] * wb) / t;
    o[ia + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}
function camReview(c) {
  cam.shot = c; camStop();
  const v = $('cam-shot'); v.width = c.width; v.height = c.height; v.getContext('2d').drawImage(c, 0, 0);
  v.hidden = false; $('cam-video').hidden = true; $('cam-guide').hidden = true;
  $('cam-live-row').hidden = true; $('cam-review').hidden = false;
  if (!$('cam-name').value) $('cam-name').value = `Photo fabric ${fabricLib.filter(f => f.id.startsWith('u')).length + 1}`;
  camMsg('Check the picture. Set how wide the square is on the real fabric, so the print shows at its true size.');
}
function openCamera() {
  const dlg = $('cam-dialog'); $('cam-name').value = '';
  if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  camAsk();
}
function initCamera() {
  for (const b of document.querySelectorAll('.cam-open')) b.addEventListener('click', openCamera);
  $('cam-close').addEventListener('click', () => $('cam-dialog').close());
  $('cam-dialog').addEventListener('close', () => { camStop(); setTimeout(() => { camTarget = null; }, 0); });
  $('cam-flip').addEventListener('click', () => { cam.facing = cam.facing === 'environment' ? 'user' : 'environment'; camStart(); });
  $('cam-snap').addEventListener('click', () => {
    const v = $('cam-video'); if (!v.videoWidth) return;
    camReview(camCrop(v, v.videoWidth, v.videoHeight));
  });
  $('cam-file').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = await loadImage(URL.createObjectURL(f));
    camReview(camCrop(im, im.naturalWidth, im.naturalHeight));
  });
  $('cam-retake').addEventListener('click', () => (cam.hadLive ? camStart() : camAsk()));
  $('cam-allow').addEventListener('click', camStart);
  $('cam-file2').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = await loadImage(URL.createObjectURL(f));
    $('cam-ask').hidden = true; $('cam-viewbox').hidden = false;
    camReview(camCrop(im, im.naturalWidth, im.naturalHeight));
  });
  $('cam-use').addEventListener('click', () => {
    if (!cam.shot) return;
    const c = document.createElement('canvas'); c.width = c.height = cam.shot.width; c.getContext('2d').drawImage(cam.shot, 0, 0);
    if ($('cam-fix').checked) makeSeamless(evenLighting(c));
    const cm = Math.max(3, Math.min(100, +$('cam-cm').value || 15));
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    fabricLib.push({ id, name: ($('cam-name').value || 'Photo fabric').slice(0, 40), canvas: c, cm });
    $('cam-dialog').close();
    // pick it straight away: applies to the selected parts, or waits for a selection
    if (camTarget) { const f = camTarget; camTarget = null; f(id); }
    else if (selParts.size) applyFabric(id); else { activeFabric = id; drawFabricPalette(); }
    $('dz-fabnote').textContent = 'Fabric added from the camera. Photos are kept only until you reload the page.';
  });
}
initCamera();

// ---- hover: highlight the block under the mouse; rest on one part and only that part lights up.
// A click while a part is lit opens a small pop-up with just the fabrics, for that part.
const hover = { bi: -1, part: -1, cand: -1, timer: 0, x: 0, y: 0, zone: null, zr: null, zi: -1 };
const PART_DWELL = 650;              // ms the mouse must rest on a part
function hoverGeom() {
  const cv = $('dz-quilt'), w = parseFloat(cv.style.width) || cv.clientWidth, h = parseFloat(cv.style.height) || cv.clientHeight;
  return { w, h };
}
function partAt(bi, x, y) {
  const { w, h } = hoverGeom(), R = blockRect(design, bi % design.cols, Math.floor(bi / design.cols), w, h);
  return blockPolys(design.blocks[bi], R.x, R.y, R.w, R.h).findIndex(p => pointInPoly(x, y, p));
}
// what lies under (x, y) outside the blocks: a sashing strip / cornerstone, or one of the borders
function zoneAt(x, y) {
  const { w: W, h: H } = hoverGeom(), q = quiltMm(design), k = W / q.W, mx = x / k, my = y / k;
  const bs = bordersOf(design), d = Math.min(mx, my, q.W - mx, q.H - my);
  if (bs.length && d >= 0 && d < borderTotal(design)) {
    let o = 0;
    for (let i = bs.length - 1; i >= 0; i--) { if (d < o + bs[i].mm) return { zone: 'brd', zi: i, zr: { o: o * k, t: bs[i].mm * k } }; o += bs[i].mm; }
  }
  for (const r of sashRects(design, W, H)) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { zone: 'sash', zi: -1, zr: r };
  return null;
}
function hoverLabel(g, txt, W) {
  g.font = '600 12px system-ui, sans-serif'; const tw = g.measureText(txt).width + 14;
  const lx = Math.min(Math.max(4, hover.x + 14), W - tw - 4), ly = Math.max(4, hover.y - 30);
  g.fillStyle = 'rgba(25,28,36,.88)'; g.beginPath(); g.roundRect ? g.roundRect(lx, ly, tw, 22, 6) : g.rect(lx, ly, tw, 22); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(txt, lx + 7, ly + 11);
}
function drawHover() {
  const cv = $('dz-hover'); if (!cv || !design) return;
  const g = cv.getContext('2d'), dpr = cv.width / (parseFloat(cv.style.width) || 1);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rb = $('dz-hrot');
  if (hover.zone) {          // sashing or a border: light it up like a block, with its name
    if (rb) rb.hidden = true; if ($('dz-hflip')) $('dz-hflip').hidden = true;
    const { w: W, h: H } = hoverGeom(), z = hover.zr;
    g.save(); g.beginPath();
    if (hover.zone === 'brd') { g.rect(z.o, z.o, W - 2 * z.o, H - 2 * z.o); g.rect(z.o + z.t, z.o + z.t, W - 2 * (z.o + z.t), H - 2 * (z.o + z.t)); }
    else for (const r of sashRects(design, W, H)) g.rect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(255,255,255,.26)'; g.fill('evenodd');
    g.lineJoin = 'round';
    for (const [lw, c] of [[3, 'rgba(255,255,255,.95)'], [1.5, '#e0592a']]) {
      g.lineWidth = lw; g.strokeStyle = c;
      if (hover.zone === 'brd') { g.strokeRect(z.o + 1, z.o + 1, W - 2 * z.o - 2, H - 2 * z.o - 2); g.strokeRect(z.o + z.t, z.o + z.t, W - 2 * (z.o + z.t), H - 2 * (z.o + z.t)); }
      else g.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    }
    g.restore();
    const s = sashOf(design), b = hover.zone === 'brd' ? bordersOf(design)[hover.zi] : null;
    hoverLabel(g, hover.zone === 'brd'
      ? `Border ${hover.zi + 1} · ${BORDER_TYPES[b.type].label} · ${b.mm} mm · click to edit`
      : `${z.kind === 'corner' ? 'Cornerstone' : 'Sashing'} · ${fabricById(z.kind === 'corner' ? s.corner : s.fabric).name} · ${s.mm} mm · click to edit`, W);
    return;
  }
  if (hover.bi < 0 || hover.bi >= design.blocks.length) { if (rb) rb.hidden = true; if ($('dz-hflip')) $('dz-hflip').hidden = true; return; }
  const { w: HW, h: HH } = hoverGeom(), RR = blockRect(design, hover.bi % design.cols, Math.floor(hover.bi / design.cols), HW, HH), x = RR.x, y = RR.y, bw = RR.w, bh = RR.h;
  if (rb) {           // small round rotate button in the block's top-right corner
    const sz = bw < 70 ? 22 : 28;
    rb.style.width = rb.style.height = sz + 'px';
    rb.style.left = (cv.offsetLeft + x + bw - sz - 5) + 'px'; rb.style.top = (cv.offsetTop + y + 5) + 'px';
    rb.hidden = bw < 34 || document.body.classList.contains('tour-active');
    const fb = $('dz-hflip');
    if (fb) { fb.style.width = fb.style.height = sz + 'px'; fb.style.left = (cv.offsetLeft + x + bw - 2 * sz - 9) + 'px'; fb.style.top = rb.style.top; fb.hidden = rb.hidden || bw < 70; }
  }
  if (hover.part < 0) {
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, bw, bh);
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    return;
  }
  const polys = blockPolys(design.blocks[hover.bi], x, y, bw, bh), p = polys[hover.part];
  if (!p) return;
  // dim the rest of the block a little so the part stands out
  g.save(); g.beginPath(); g.rect(x, y, bw, bh); pathPolyInto(g, p); g.fillStyle = 'rgba(20,24,34,.28)'; g.fill('evenodd'); g.restore();
  pathPoly(g, p); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
  g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.stroke();
  // label: part name and fabric
  const b = design.blocks[hover.bi], txt = `${partsOf(b.pattern)[hover.part].name} · ${fabricById(b.fabrics[hover.part]).name}`;
  g.font = '600 12px system-ui, sans-serif'; const tw = g.measureText(txt).width + 14;
  const W = parseFloat(cv.style.width), lx = Math.min(Math.max(4, hover.x + 14), W - tw - 4), ly = Math.max(4, hover.y - 30);
  g.fillStyle = 'rgba(25,28,36,.88)'; g.beginPath(); g.roundRect ? g.roundRect(lx, ly, tw, 22, 6) : g.rect(lx, ly, tw, 22); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(txt, lx + 7, ly + 11);
}
function pathPolyInto(g, poly) { poly.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); }
function clearHover() { clearTimeout(hover.timer); if (hover.bi !== -1 || hover.part !== -1 || hover.zone) { hover.bi = -1; hover.part = -1; hover.cand = -1; hover.zone = null; drawHover(); } }
function initHover() {
  const qcv = $('dz-quilt');
  qcv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || flipped || !design || e.buttons) { if (e.buttons) clearHover(); return; }
    const r = qcv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const { w: HW, h: HH } = hoverGeom(), bi = blockAt(design, x, y, HW, HH);
    if (bi < 0) {
      const z = zoneAt(x, y);
      if (!z) { clearHover(); return; }
      clearTimeout(hover.timer); hover.timer = 0; hover.bi = -1; hover.part = -1; hover.x = x; hover.y = y;
      hover.zone = z.zone; hover.zi = z.zi; hover.zr = z.zr; drawHover(); return;
    }
    hover.zone = null;
    const part = partAt(bi, x, y);
    hover.x = x; hover.y = y;
    if (bi !== hover.bi) { hover.bi = bi; hover.part = -1; hover.cand = part; clearTimeout(hover.timer); }
    if (hover.part >= 0) { if (part >= 0 && part !== hover.part) hover.part = part; drawHover(); return; }   // part mode follows the mouse
    if (part !== hover.cand || !hover.timer) {
      hover.cand = part; clearTimeout(hover.timer);
      hover.timer = setTimeout(() => { hover.timer = 0; if (document.body.classList.contains('tour-active')) return; if (hover.cand >= 0 && hover.bi >= 0) { hover.part = hover.cand; drawHover(); } }, PART_DWELL);
    }
    drawHover();
  });
  const hrot = $('dz-hrot');
  const hflip = $('dz-hflip'), onBtn = el => el && (hrot.contains(el) || hflip.contains(el));
  qcv.addEventListener('pointerleave', e => { if (onBtn(e.relatedTarget)) return; clearHover(); });
  document.addEventListener('pointermove', e => { if ((hover.bi >= 0 || hover.zone) && e.target !== qcv && !onBtn(e.target)) clearHover(); }, { passive: true });
  hflip.addEventListener('pointermove', () => { if (hover.part >= 0) hover.part = -1; clearTimeout(hover.timer); hover.timer = 0; drawHover(); });
  hflip.addEventListener('click', e => {
    e.stopPropagation();
    const bi = hover.bi; if (bi < 0 || !design) return;
    const targets = selBlocks.size > 1 && selBlocks.has(bi) ? [...selBlocks] : [bi];
    for (const i of targets) { const b = design.blocks[i]; if (b.flip) delete b.flip; else b.flip = true; }
    symApply(targets);
    saveDesign(); renderDesigner(); drawPartsEditor(); hover.bi = bi; drawHover();
  });
  hrot.addEventListener('pointermove', () => { if (hover.part >= 0) { hover.part = -1; } clearTimeout(hover.timer); hover.timer = 0; drawHover(); });
  hrot.addEventListener('click', e => {
    e.stopPropagation();
    const bi = hover.bi; if (bi < 0 || !design) return;
    // rotate the hovered block, or every selected block when it is one of several selected
    const targets = selBlocks.size > 1 && selBlocks.has(bi) ? [...selBlocks] : [bi];
    for (const i of targets) design.blocks[i].rot = (design.blocks[i].rot + 1) % 4;
    symApply(targets);
    saveDesign(); renderDesigner(); drawPartsEditor(); hover.bi = bi; drawHover();
  });
  qcv.addEventListener('pointerdown', () => { clearTimeout(hover.timer); hover.timer = 0; });
  // a click on a lit part opens the fabric pop-up instead of the block editor
  qcv.addEventListener('click', e => {
    if (flipped || hover.part < 0 || hover.bi < 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const bi = hover.bi, part = hover.part;
    selBlocks = new Set([bi]); focusBlock = bi; selParts = new Set([part]);
    clearHover(); renderDesigner(); openBlockEditor(); drawPartsEditor();
  }, true);
}
// ---- the fabric-only pop-up for one part
const partEdit = { bi: -1, part: -1, twins: [] };
function openPartFabric(bi, part) {
  partEdit.bi = bi; partEdit.part = part;
  const b = design.blocks[bi], key = b.pattern + '|' + b.fabrics.join(',');
  partEdit.twins = design.blocks.map((x, i) => i !== bi && x.pattern + '|' + x.fabrics.join(',') === key ? i : -1).filter(i => i >= 0);
  selBlocks = new Set([bi]); focusBlock = bi; selParts = new Set([part]);
  $('dz-partdlg-sub').textContent = `${partsOf(b.pattern)[part].name} · ${PATTERNS[b.pattern].label} · block ${Math.floor(bi / design.cols) + 1}, ${bi % design.cols + 1}`;
  $('dz-partall-row').hidden = !partEdit.twins.length; $('dz-partall').checked = false;
  $('dz-partall-txt').textContent = `Also in the ${partEdit.twins.length} other block${partEdit.twins.length === 1 ? '' : 's'} just like this one`;
  drawPartDialog();
  clearHover();
  const d = $('dz-partdlg'); if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  drawDesignerCanvas();
}
function drawPartDialog() {
  const b = design.blocks[partEdit.bi]; if (!b) return;
  drawPaletteInto($('dz-partfabs'), b.fabrics[partEdit.part]);
  const cv = $('dz-partdlg-cv'), dpr = Math.min(window.devicePixelRatio || 1, 2), S = 160;
  cv.width = cv.height = S * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const polys = blockPolys(b, 0, 0, S, S), pxPerCm = S / (design.blockMm / 10);
  polys.forEach((p, i) => { g.fillStyle = pieceFill(g, b, i, p, pxPerCm, partEdit.bi * 31 + i); pathPoly(g, p); g.fill(); });
  g.save(); g.beginPath(); g.rect(0, 0, S, S); pathPolyInto(g, polys[partEdit.part]); g.fillStyle = 'rgba(20,24,34,.35)'; g.fill('evenodd'); g.restore();
  pathPoly(g, polys[partEdit.part]); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 1.5; g.strokeStyle = '#e0592a'; g.stroke();
}
function setPartFabric(fid) {
  const targets = [partEdit.bi, ...($('dz-partall').checked ? partEdit.twins : [])];
  for (const bi of targets) design.blocks[bi].fabrics[partEdit.part] = fid;
  symApply(targets);
  activeFabric = fid;
  saveDesign(); drawPartDialog(); drawDesignerCanvas(); drawFabricPalette();
}
function initPartDialog() {
  $('dz-partfabs').addEventListener('click', e => { const b = e.target.closest('button.fab'); if (b) setPartFabric(b.dataset.f); });
  const close = () => $('dz-partdlg').close();
  $('dz-partdlg-x').addEventListener('click', close); $('dz-partdone').addEventListener('click', close);
  $('dz-partdlg').addEventListener('close', () => { selParts.clear(); drawDesignerCanvas(); });
  $('dz-partcam').addEventListener('click', () => { camTarget = id => setPartFabric(id); openCamera(); });
}
initHover(); initPartDialog();

// ------------------------------------------------------------- save image
// Uses the viewer's downloads capability: the viewer confirms each save.
let downloads = null;
if (window.claude && window.claude.use) {
  window.claude.use('downloads').then(d => { downloads = d; $('saveimg').hidden = !d; $('saveimg2').hidden = !d; }).catch(() => {});
}
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
      renderer.render(scene, activeCam);
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


// ------------------------------------------------------------- cutting guide PDF (A4)
// One A4 page per distinct block: the block drawn as large as the sheet allows, every piece
// labelled (A1, B1, ...) and its cutting list underneath. Page 1 lists the fabrics, page 2 shows
// the whole quilt (sashing and borders included) with every piece's ID; the sashing and each border
// get a page of their own at the end.
// Each page is drawn on a canvas at 200 dpi and placed full-bleed on the sheet as a JPEG.
const A4 = { w: 210, h: 297 }, PDF_DPI = 200, PX = PDF_DPI / 25.4;          // px per mm
function pdfPageCanvas() {
  const c = document.createElement('canvas'); c.width = Math.round(A4.w * PX); c.height = Math.round(A4.h * PX);
  const g = c.getContext('2d'); g.scale(PX, PX); g.fillStyle = '#fff'; g.fillRect(0, 0, A4.w, A4.h);
  return [c, g];
}
const PDF_FONT = 'Helvetica, Arial, sans-serif', PDF_SERIF = 'Georgia, "Times New Roman", serif';
function pdfText(g, txt, x, y, size, opt = {}) {
  g.font = `${opt.weight || 400} ${size}px ${opt.serif ? PDF_SERIF : PDF_FONT}`;
  g.fillStyle = opt.color || '#1f1d1a'; g.textAlign = opt.align || 'left'; g.textBaseline = 'alphabetic';
  g.fillText(txt, x, y);
}
function pdfWrap(g, txt, maxW, size) {
  g.font = `400 ${size}px ${PDF_FONT}`;
  const words = String(txt).split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
const plainHow = s => String(s).replace(/\s*[◩⊠]/g, '');
function pdfHeader(g, P, title, sub, page, pages) {
  const M = 12;
  pdfText(g, title, M, M + 8, 9, { serif: true, weight: 600 });
  if (sub) pdfText(g, sub, M, M + 14, 4.2, { color: '#5a5650' });
  pdfText(g, `Quilt ${P.quiltW} × ${P.quiltH} mm · block ${P.blockW} × ${P.blockH} mm · seam ${P.seam} mm`, A4.w - M, M + 6, 3.4, { align: 'right', color: '#5a5650' });
  pdfText(g, `Page ${page} of ${pages}`, A4.w - M, A4.h - 7, 3.2, { align: 'right', color: '#8a857c' });
  g.strokeStyle = '#d9d3c7'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(M, M + 17.5); g.lineTo(A4.w - M, M + 17.5); g.stroke();
}
function pdfTable(g, x, y, widths, head, rows, size = 3.6) {
  const pad = 1.8, lh = size * 1.35, W = widths.reduce((a, b) => a + b, 0);
  const wrapped = rows.map(r => r.map((c, i) => i === 1 ? pdfWrap(g, c, widths[i] - 2 * pad, size) : [String(c)]));
  const rowH = wrapped.map(r => Math.max(...r.map(c => c.length)) * lh + 2 * pad);
  const headH = lh + 2 * pad;
  g.fillStyle = '#f6e7d4'; g.fillRect(x, y, W, headH);
  let cx = x; head.forEach((h, i) => { pdfText(g, h, i >= 2 ? cx + widths[i] - pad : cx + pad, y + pad + size, size, { weight: 700, align: i >= 2 ? 'right' : 'left' }); cx += widths[i]; });
  let cy = y + headH;
  wrapped.forEach((r, ri) => {
    if (ri % 2) { g.fillStyle = '#faf8f4'; g.fillRect(x, cy, W, rowH[ri]); }
    cx = x;
    r.forEach((lines, i) => {
      lines.forEach((ln, li) => pdfText(g, ln, i >= 2 ? cx + widths[i] - pad : cx + pad, cy + pad + size + li * lh, size,
        { weight: i === 0 ? 700 : 400, serif: i === 0, align: i >= 2 ? 'right' : 'left' }));
      cx += widths[i];
    });
    cy += rowH[ri];
    g.strokeStyle = '#e4ded3'; g.lineWidth = 0.2; g.beginPath(); g.moveTo(x, cy); g.lineTo(x + W, cy); g.stroke();
  });
  return cy;
}
function pdfTableHeight(g, widths, rows, size = 3.6) {
  const pad = 1.8, lh = size * 1.35;
  return lh + 2 * pad + rows.reduce((h, r) => h + Math.max(1, pdfWrap(g, r[1], widths[1] - 2 * pad, size).length) * lh + 2 * pad, 0);
}
function pdfFabricPage(P, pages) {
  const [c, g] = pdfPageCanvas(), M = 12;
  pdfHeader(g, P, 'Cutting guide', `${design.cols} × ${design.rows} blocks · ${P.blocks.length} distinct block${P.blocks.length > 1 ? 's' : ''}`, 1, pages);
  let y = M + 26;
  pdfText(g, 'Fabrics', M, y, 6, { serif: true, weight: 600 }); y += 5;
  const rowH = 22;
  for (const r of P.fabrics) {
    const fab = fabricById(r.id);
    g.save(); g.beginPath(); g.rect(M, y, 34, rowH - 4); g.clip();
    g.fillStyle = fabricFill(g, fab, 10, 5); g.fillRect(M, y, 34, rowH - 4); g.restore();   // 10 px/cm in mm space: real scale
    g.strokeStyle = '#cfc8bb'; g.lineWidth = 0.25; g.strokeRect(M, y, 34, rowH - 4);
    pdfText(g, r.letter, M + 40, y + 9, 9, { serif: true, weight: 600 });
    pdfText(g, fab.name, M + 40, y + 15, 3.6, { color: '#5a5650' });
    pdfText(g, r.requirement, M + 75, y + 7.5, 4.4, { weight: 600 });
    const notes = [r.buy ? `buy ≈ ${r.buy}` : '', r.binding ? `includes binding: ${r.binding.strips} strips ${r.binding.width} mm × WOF` : ''].filter(Boolean).join(' · ');
    if (notes) pdfText(g, notes, M + 75, y + 13, 3.6, { color: '#5a5650' });
    y += rowH;
  }
  y += 2;
  pdfText(g, 'Backing', M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(g, `${P.backing.w} × ${P.backing.h} mm · ${P.backing.widths} width${P.backing.widths > 1 ? 's' : ''} of fabric · buy ≈ ${P.backing.buy}`, M + 75, y + 6, 4, {});
  y += 9;
  pdfText(g, 'Batting', M + 40, y + 6, 4.6, { weight: 600 });
  pdfText(g, `${P.backing.w} × ${P.backing.h} mm`, M + 75, y + 6, 4, {});
  y += 9;
  for (const x of P.sashing || []) {
    if (y > A4.h - 70) break;
    pdfText(g, x.what, M + 40, y + 6, 4, { weight: 600 });
    pdfText(g, `${x.id || x.letter}: ${x.wof ? '' : Math.ceil(x.n / (x.yield || 1)) + ' × '}${plainHow(x.how)}`.slice(0, 110), M + 40, y + 11, 3.5, { color: '#3a3732' });
    y += 13;
  }
  y += 7;
  pdfText(g, 'Piece labels', M, y, 6, { serif: true, weight: 600 }); y += 6;
  for (const ln of pdfWrap(g, 'Each piece is labelled fabric letter + block number + form: D2.3 is a piece of fabric D in block 2, in that block\'s third shape cut from fabric D. The letters are the fabrics listed above; pieces with the same label are cut identically.', A4.w - 2 * M, 4)) { pdfText(g, ln, M, y, 4); y += 5.6; }
  y += 3;
  for (const ln of pdfWrap(g, `WOF = width of fabric: ${cutOpts.fabricWidth / 10} cm, ${P.usable / 10} cm usable after trimming the selvages. Cut sizes include a ${P.seam} mm seam allowance and are rounded up to the whole millimetre.`, A4.w - 2 * M, 3.6)) { pdfText(g, ln, M, y, 3.6, { color: '#5a5650' }); y += 5; }
  return c;
}
function pdfQuiltPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, s = sashOf(design), nb = bordersOf(design).length;
  pdfHeader(g, P, 'Whole quilt', `${design.cols} × ${design.rows} blocks${s.mm ? ` · ${s.mm} mm sashing` : ''}${nb ? ` · ${nb} border${nb > 1 ? 's' : ''}` : ''} · every piece with its ID`, page, pages);
  // the same drawing as the Cutting guide page (sashing and borders included), made at print resolution
  const top = M + 24, availW = A4.w - 2 * M, availH = A4.h - top - 26;
  const keepHi = cgHi, keepFab = fabHi; cgHi = -1; fabHi = null;
  const tmp = document.createElement('canvas');
  try { drawCutQuilt(P, { cv: tmp, w: availW * PX, h: availH * PX, u: 2.4, dpr: 1 }); } finally { cgHi = keepHi; fabHi = keepFab; }
  const k = Math.min(availW / (tmp.width / PX), availH / (tmp.height / PX), 1), QW = tmp.width / PX * k, QH = tmp.height / PX * k;
  g.drawImage(tmp, (A4.w - QW) / 2, top, QW, QH);
  let y = top + QH + 6;
  const txt = `Columns are numbered across the top and rows down the side. Each block piece is labelled with its fabric letter, the number of its block in this guide and its form (D2.3 = fabric D, block 2, form 3).`
    + (s.mm ? ' Sashing pieces carry S (AS.1 = fabric A, sashing form 1).' : '') + (nb ? ' Border pieces carry B and the border number, counted from the inside (CB2.1 = fabric C, border 2, form 1).' : '')
    + ' The pages that follow show each block, the sashing and the borders with their cutting lists.';
  for (const ln of pdfWrap(g, txt, A4.w - 2 * M, 3.6)) { pdfText(g, ln, M, y, 3.6, { color: '#3a3732' }); y += 5; }
  return c;
}
// one page for the sashing (a corner of the quilt with every strip and cornerstone labelled) and its cutting list
function pdfSashPage(P, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, s = sashOf(design), cuts = (P.sashing || []).filter(x => x.group === 'sash');
  pdfHeader(g, P, 'Sashing', `${s.mm} mm strips between the blocks${s.border ? ' and around the outside' : ''} · strips and cornerstones with their IDs`, page, pages);
  const widths = [24, 118, 22, 22], rows = cuts.map(x => [x.id, `${x.what}: ${plainHow(x.how)}`, '', x.n]);
  const tH = pdfTableHeight(g, widths, rows), top = M + 24;
  const side = Math.min(A4.w - 2 * M - 30, A4.h - top - tH - 24), H = side * sashPicH(1000) / 1000, x0 = (A4.w - side) / 2;
  g.save(); g.translate(x0, top); g.scale(1 / PX, 1 / PX); drawSashPic(g, side * PX, cuts, 2.6); g.restore();
  g.strokeStyle = '#bdb6a8'; g.lineWidth = 0.3; g.strokeRect(x0, top, side, H);
  pdfText(g, 'A corner of the quilt (2 × 2 blocks) showing how the strips and cornerstones go together.', A4.w / 2, top + H + 5, 3.4, { align: 'center', color: '#5a5650' });
  pdfTable(g, M, top + H + 10, widths, ['ID', 'Cut', '', 'Total'], rows);
  return c;
}
// one page per border (border 1 is the innermost): the borders pulled apart with this one lit, and its cutting list
function pdfBorderPage(P, bi, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12, bs = bordersOf(design), bd = bs[bi], q = quiltMm(design);
  const cuts = (P.sashing || []).filter(x => x.group === 'b' + bi);
  const where = bs.length > 1 ? (bi === 0 ? ' · the innermost border' : bi === bs.length - 1 ? ' · the outermost border' : '') : '';
  pdfHeader(g, P, `Border ${bi + 1}`, `${BORDER_TYPES[bd.type].label} · ${bd.mm} mm all round${where}`, page, pages);
  const widths = [24, 118, 22, 22], rows = cuts.map(x => [x.id, `${x.what.replace(/^Border \d+ · /, '')}: ${plainHow(x.how)}`, '', x.wof ? '—' : Math.ceil(x.n / (x.yield || 1))]);
  const tH = pdfTableHeight(g, widths, rows), top = M + 24;
  const gapMm = bs.length > 1 ? 3 : 0, side = Math.min(A4.w - 2 * M - 30, (A4.h - top - tH - 30) * q.W / q.H), x0 = (A4.w - side) / 2;
  const keepFab = fabHi; fabHi = null; let Hpx;
  g.save(); g.translate(x0, top); g.scale(1 / PX, 1 / PX); try { Hpx = drawBordersExploded(g, side * PX, gapMm * PX, bs.length > 1 ? bi : -1); } finally { fabHi = keepFab; } g.restore();
  const H = Hpx / PX;
  pdfText(g, `Pieces of border ${bi + 1}: ${cuts.map(x => x.id).join(' · ')}`, A4.w / 2, top + H + 6, 3.8, { align: 'center', weight: 600 });
  pdfTable(g, M, top + H + 11, widths, ['ID', 'Cut', '', 'Total'], rows);
  return c;
}
function pdfBlockPage(P, b, i, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 12;
  pdfHeader(g, P, `Block ${i + 1}`, `${b.label}${b.span > 1 ? ` · large block, ${b.size} × ${b.size} mm` : ''} · make ${b.count}${mirroredCount(b) ? ` · ${mirroredCount(b)} mirrored: cut their odd-shaped pieces with the template turned over` : ''}`, page, pages);
  const widths = [22, 112, 26, 26];
  const rows = b.list.map(r => [`${r.letter}${i + 1}.${r.form}`, plainHow(r.how), Math.ceil(r.pieces / r.yield), Math.ceil(r.pieces * b.count / r.yield)]);
  const tH = pdfTableHeight(g, widths, rows);
  const top = M + 22, bottom = A4.h - 12;
  // the block fills the page width unless the cutting list needs the room
  const side = Math.min(A4.w - 2 * M, bottom - top - tH - 8);
  const bx = (A4.w - side) / 2, bh = side;
  g.save(); g.translate(bx, top);
  // draw at device resolution for crisp prints: scale back to px inside the block box
  g.scale(1 / PX, 1 / PX); drawBlockArt(g, b, P, i + 1, side * PX, bh * PX); g.restore();
  g.strokeStyle = '#bdb6a8'; g.lineWidth = 0.3; g.strokeRect(bx, top, side, bh);
  pdfTable(g, M, top + bh + 6, widths, ['Piece', 'Cut', 'Per block', 'Total'], rows);
  return c;
}
const canvasJpeg = c => new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('Page could not be drawn')), 'image/jpeg', 0.9));
// Minimal PDF 1.4 writer: one full-page JPEG per A4 page.
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offsets = []; let len = 0;
  const put = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const obj = (n, body) => { offsets[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  const W = (A4.w / 25.4 * 72).toFixed(2), H = (A4.h / 25.4 * 72).toFixed(2), n = pages.length;
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    const po = 3 + i * 3, co = po + 1, io = po + 2;
    obj(po, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${io} 0 R >> >> /Contents ${co} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(co, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(io, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put('\nendstream'); });
  });
  const xref = len, count = 3 + n * 3;
  let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  put(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
// ---- real-size templates for pieces that are not rectangles or right triangles
const polyAngleRight = (p, i) => { const a = p[(i + p.length - 1) % p.length], o = p[i], c = p[(i + 1) % p.length];
  const ux = a[0] - o[0], uy = a[1] - o[1], vx = c[0] - o[0], vy = c[1] - o[1];
  return Math.abs(ux * vx + uy * vy) <= 1e-6 * Math.hypot(ux, uy) * Math.hypot(vx, vy); };
function needsTemplate(poly) {
  if (poly.length === 3) return ![0, 1, 2].some(i => polyAngleRight(poly, i));        // right triangles are cut with a ruler
  if (poly.length === 4) return ![0, 1, 2, 3].every(i => polyAngleRight(poly, i));    // squares and rectangles too
  return true;
}
// a shape's identity up to turning and flipping, so one template serves every copy
function shapeKey(mmPoly) {
  let best = null, bestMirror = false;
  const T = [([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x]];
  for (const mirror of [false, true]) for (const t of T) {
    let q = mmPoly.map(v => t(mirror ? [-v[0], v[1]] : v));
    if (mirror) q = q.reverse();
    const mx = Math.min(...q.map(v => v[0])), my = Math.min(...q.map(v => v[1]));
    q = q.map(([x, y]) => [Math.round((x - mx) * 10) / 10, Math.round((y - my) * 10) / 10]);
    let k = null;
    for (let r = 0; r < q.length; r++) { const ks = q.slice(r).concat(q.slice(0, r)).map(v => v.join(',')).join(';'); if (k === null || ks < k) k = ks; }
    if (best === null || k < best) { best = k; bestMirror = mirror; }
  }
  return { key: best, mirror: bestMirror };
}
function blockTemplates(P, b, i) {
  const map = new Map();
  b.pieces.forEach(pc => {
    if (!needsTemplate(pc.part.poly)) return;
    const mm = pc.part.poly.map(([u, v]) => [u * (b.size || P.blockW), v * (b.size || P.blockH)]);
    const { key, mirror } = shapeKey(mm);
    if (!map.has(key)) map.set(key, { poly: mm, ids: new Map(), mirrored: 0, plain: 0 });
    const t = map.get(key), id = `${pc.letter}${i + 1}.${pc.form}`;
    t.ids.set(id, (t.ids.get(id) || 0) + b.count);
    if (mirror === shapeKey(t.poly).mirror) t.plain += b.count; else t.mirrored += b.count;
  });
  return [...map.values()];
}
// offset a polygon outward by d: the cutting line around the finished line. Sharp points are
// blunted (as quilters trim "dog ears") once the mitre would reach further than 2.5 d.
function offsetPoly(p, d, limit = 2.5) {
  let A = 0; for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; A += a[0] * c[1] - c[0] * a[1]; }
  const sgn = A > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const nx = sgn * (c[1] - a[1]) / L, ny = -sgn * (c[0] - a[0]) / L;
    lines.push([[a[0] + nx * d, a[1] + ny * d], [c[0] + nx * d, c[1] + ny * d]]);
  }
  const meet = ([p1, p2], [p3, p4]) => {
    const den = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(den) < 1e-9) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / den;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  };
  const out = [];
  lines.forEach((l, i) => {
    const m = lines[(i + lines.length - 1) % lines.length], v = p[i], q = meet(m, l);
    if (!q) { out.push(l[0]); return; }
    const dist = Math.hypot(q[0] - v[0], q[1] - v[1]);
    if (dist <= limit * d) { out.push(q); return; }
    // blunt the point: cut it square to the bisector at limit*d from the corner
    const ux = (q[0] - v[0]) / dist, uy = (q[1] - v[1]) / dist, c = [v[0] + ux * limit * d, v[1] + uy * limit * d];
    const cl = [c, [c[0] - uy, c[1] + ux]];
    out.push(meet(m, cl) || c, meet(cl, l) || c);
  });
  return out;
}

// ---- making the most of the A4 sheet
// Each template is turned to the angle that needs the fewest sheets; among angles that tie,
// square-to-the-sheet angles are preferred (easier to read and to line up the grain), then the
// smallest footprint. Templates that fit on one sheet are then packed together, several per
// sheet, with a skyline packer that also tries each one turned 90°.
const TPL = { x: 8, y: 35, w: 194, h: 253 }, TPL_GAP = 5;
const rotPts = (pts, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const bbox = q => { const xs = q.map(v => v[0]), ys = q.map(v => v[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function bestAngle(cut) {
  const H = hull(cut), cands = new Set();
  for (let k = 0; k < 360; k++) cands.add(k * Math.PI / 360);                 // every 0.5°
  for (let i = 0; i < H.length; i++) {                                        // and every hull edge laid flat (min-area boxes live there)
    const a = H[i], c = H[(i + 1) % H.length], e = Math.atan2(c[1] - a[1], c[0] - a[0]);
    for (const off of [0, Math.PI / 2]) cands.add((((-e + off) % Math.PI) + Math.PI) % Math.PI);
  }
  let best = null;
  for (const ang of cands) {
    const [x0, y0, x1, y1] = bbox(rotPts(H, ang)), w = x1 - x0, h = y1 - y0;
    const sheets = Math.ceil(w / TPL.w) * Math.ceil(h / TPL.h);
    const square = Math.min(ang % (Math.PI / 2), Math.PI / 2 - ang % (Math.PI / 2)) < 1e-6;
    const score = [sheets, square ? 0 : 1, w * h];
    if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2] - 1e-6))))
      best = { ang, w, h, score, sheets };
  }
  return best;
}
// shape geometry at its chosen angle, with the bounding box at the origin
function templateShape(t, seam) {
  const cut0 = offsetPoly(t.poly, seam), fit = bestAngle(cut0);
  const cut = rotPts(cut0, fit.ang), [x0, y0] = bbox(cut);
  const sh = p => p.map(([x, y]) => [x - x0, y - y0]);
  return { t, fin: sh(rotPts(t.poly, fit.ang)), cut: sh(cut), w: fit.w, h: fit.h, ang: fit.ang, sheets: fit.sheets };
}
const turn90 = (sp) => ({ ...sp, fin: sp.fin.map(([x, y]) => [sp.h - y, x]), cut: sp.cut.map(([x, y]) => [sp.h - y, x]), w: sp.h, h: sp.w, ang: sp.ang + Math.PI / 2 });
// skyline bottom-left packing of the single-sheet templates into as few A4 sheets as possible
function packTemplates(shapes) {
  const W = TPL.w, H = TPL.h, g = TPL_GAP, sheets = [];
  const items = shapes.slice().sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  const tryPlace = (sky, w, h) => {
    let best = null;
    for (let i = 0; i < sky.length; i++) {
      const x = sky[i].x; if (x + w > W + 1e-6) break;
      let y = 0, j = i, span = 0;
      while (span < w - 1e-6 && j < sky.length) { y = Math.max(y, sky[j].y); span = sky[j].x + sky[j].w - x; j++; }
      if (span < w - 1e-6 || y + h > H + 1e-6) continue;
      if (!best || y < best.y - 1e-6 || (Math.abs(y - best.y) < 1e-6 && x < best.x)) best = { x, y };
    }
    return best;
  };
  const addSky = (sky, x, w, top) => {
    const out = [];
    for (const s of sky) {
      if (s.x + s.w <= x || s.x >= x + w) { out.push(s); continue; }
      if (s.x < x) out.push({ x: s.x, w: x - s.x, y: s.y });
      if (s.x + s.w > x + w) out.push({ x: x + w, w: s.x + s.w - x - w, y: s.y });
    }
    out.push({ x, w, y: top }); out.sort((a, b) => a.x - b.x);
    return out.filter(s => s.w > 1e-6);
  };
  for (const it of items) {
    let placed = false;
    for (const sheet of sheets) {
      let best = null;
      for (const v of [it, turn90(it)]) {
        const w = v.w + g, h = v.h + g, pos = tryPlace(sheet.sky, Math.min(w, W), Math.min(h, H));
        if (pos && (!best || pos.y + v.h < best.pos.y + best.v.h)) best = { v, pos };
      }
      if (best) { sheet.items.push({ ...best.v, x: best.pos.x, y: best.pos.y }); sheet.sky = addSky(sheet.sky, best.pos.x, Math.min(best.v.w + g, W), best.pos.y + best.v.h + g); placed = true; break; }
    }
    if (!placed) {
      const v = it.w <= W && it.h <= H ? it : turn90(it);
      sheets.push({ items: [{ ...v, x: 0, y: 0 }], sky: addSky([{ x: 0, w: W, y: 0 }], 0, Math.min(v.w + g, W), v.h + g) });
    }
  }
  // centre each sheet's layout in the printable area
  for (const sh of sheets) {
    const [, , x1, y1] = bbox(sh.items.flatMap(it => [[it.x, it.y], [it.x + it.w, it.y + it.h]]));
    sh.dx = (W - x1) / 2; sh.dy = (H - y1) / 2;
  }
  return sheets;
}
// does any part of the polygon fall on this sheet? (skips blank sheets of a split template)
function tileHasShape(p, x, y, w, h) {
  const inR = ([px, py]) => px > x && px < x + w && py > y && py < y + h;
  if (p.some(inR)) return true;
  const inP = (qx, qy) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  if ([[x, y], [x + w, y], [x, y + h], [x + w, y + h]].some(([qx, qy]) => inP(qx, qy))) return true;
  const R = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  for (let i = 0; i < p.length; i++) for (let k = 0; k < 4; k++) if (X(p[i], p[(i + 1) % p.length], R[k], R[(k + 1) % 4])) return true;
  return false;
}
function roomiestPoint(p, x, y, w, h, mx = 15, my = 12) {
  const inP = (qx, qy) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > qy) !== (yj > qy) && qx < (xj - xi) * (qy - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const dSeg = (qx, qy, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((qx - a[0]) * vx + (qy - a[1]) * vy) / (vx * vx + vy * vy))); return Math.hypot(qx - a[0] - t * vx, qy - a[1] - t * vy); };
  let best = null, bd = -1;
  const st = Math.max(1, Math.min(3, Math.min(w, h) / 20));
  for (let qy = y + my; qy < y + h - my; qy += st) for (let qx = x + mx; qx < x + w - mx; qx += st) {
    if (!inP(qx, qy)) continue;
    let d = Math.min(qx - x, x + w - qx, qy - y, y + h - qy);
    for (let i = 0; i < p.length; i++) d = Math.min(d, dSeg(qx, qy, p[i], p[(i + 1) % p.length]));
    if (d > bd) { bd = d; best = [qx, qy]; }
  }
  return best || [p.reduce((a, v) => a + v[0], 0) / p.length, p.reduce((a, v) => a + v[1], 0) / p.length];
}
function drawTemplateShape(g, P, it, ox, oy, clip) {
  const t = it.t, fin = it.fin.map(([x, y]) => [x + ox, y + oy]), cut = it.cut.map(([x, y]) => [x + ox, y + oy]);
  const fabId = [...t.ids.keys()][0], letter = fabId.match(/^[A-Z]+/)[0];
  const fab = fabricById((P.fabrics.find(f => f.letter === letter) || {}).id);
  g.save(); pathPoly(g, fin); g.clip(); g.globalAlpha = 0.18; g.fillStyle = fabricFill(g, fab, 10, 3);
  const [bx0, by0, bx1, by1] = bbox(cut); g.fillRect(bx0, by0, bx1 - bx0, by1 - by0); g.restore();
  g.strokeStyle = '#111'; g.lineWidth = 0.4; pathPoly(g, cut); g.stroke();
  g.setLineDash([2, 1.4]); g.lineWidth = 0.3; pathPoly(g, fin); g.stroke(); g.setLineDash([]);
  // label, count and straight-grain arrow (the block's horizontal direction, turned with the shape)
  const [cx, cy] = roomiestPoint(fin, clip[0], clip[1], clip[2], clip[3], clip[4] ?? 15, clip[5] ?? 12);
  const ids = [...t.ids.keys()].join(' / ');
  const size = Math.max(3.4, Math.min(7, (bx1 - bx0) / (ids.length * 0.9)));
  pdfText(g, ids, cx, cy, size, { align: 'center', serif: true, weight: 700 });
  pdfText(g, 'cut ' + [...t.ids.values()].reduce((a, n) => a + n, 0), cx, cy + 3.6, 2.6, { align: 'center', color: '#3a3732' });
  const L = Math.max(10, Math.min(26, Math.min(bx1 - bx0, by1 - by0) * 0.35)), dx = Math.cos(it.ang), dy = Math.sin(it.ang);
  const mx = cx, my = cy + 6 + Math.abs(dy) * L / 2;
  const ax = mx - dx * L / 2, ay = my - dy * L / 2, ex = mx + dx * L / 2, ey = my + dy * L / 2;
  g.lineWidth = 0.35; g.strokeStyle = '#1f1d1a'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey);
  for (const [px, py, s] of [[ax, ay, 1], [ex, ey, -1]]) { g.moveTo(px + s * (dx * 2.5 - dy * 1.4), py + s * (dy * 2.5 + dx * 1.4)); g.lineTo(px, py); g.lineTo(px + s * (dx * 2.5 + dy * 1.4), py + s * (dy * 2.5 - dx * 1.4)); }
  g.stroke();
  pdfText(g, 'grain', mx + Math.abs(dy) * 4, my + Math.abs(dx) * 3.4, 2.4, { align: Math.abs(dy) > 0.5 ? 'left' : 'center', color: '#5a5650' });
}
function pdfTemplateHeader(g, P, title, lines, page, pages) {
  const M = 10;
  pdfText(g, title, M, M + 6, 6.5, { serif: true, weight: 600 });
  lines.forEach((l, k) => pdfText(g, l.text, M, M + 12 + k * 4.4, k ? 3.1 : 3.6, { color: l.color || (k ? '#5a5650' : '#3a3732'), weight: l.weight || 400 }));
  const bx = A4.w - M - 50, by = M + 4;
  g.strokeStyle = '#1f1d1a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 50, by);
  for (let k = 0; k <= 5; k++) { g.moveTo(bx + k * 10, by - (k % 5 ? 1.2 : 2)); g.lineTo(bx + k * 10, by + (k % 5 ? 1.2 : 2)); }
  g.stroke(); pdfText(g, 'check: 50 mm', bx + 25, by + 5.5, 3, { align: 'center', color: '#5a5650' });
  pdfText(g, `Page ${page} of ${pages}`, A4.w - M, A4.h - 6, 3.2, { align: 'right', color: '#8a857c' });
}
const realSizeNote = P => `Real size: print at 100 % / "actual size". Solid line = cutting line (${P.seam} mm seam allowance included); dashed = sewing line.`;
const mirrorNote = t => t.mirrored && t.plain ? `${[...t.ids.keys()].join('/')}: ${t.mirrored} of ${t.mirrored + t.plain} are mirror images, turn the template over to cut them.` : '';
// a sheet holding several whole templates
function pdfPackedPage(P, b, i, sheet, sk, nsk, page, pages) {
  const [c, g] = pdfPageCanvas();
  const notes = sheet.items.map(it => mirrorNote(it.t)).filter(Boolean);
  pdfTemplateHeader(g, P, `Templates · Block ${i + 1}`, [
    { text: `${b.label} · ${sheet.items.map(it => [...it.t.ids.entries()].map(([id, n]) => `${id} × ${n}`).join(', ')).join(' · ')}${nsk > 1 ? ` · sheet ${sk + 1} of ${nsk}` : ''}` },
    { text: realSizeNote(P) },
    ...notes.slice(0, 2).map(n => ({ text: n, color: '#8a3b1f', weight: 600 })),
  ], page, pages);
  for (const it of sheet.items) {
    const ox = TPL.x + sheet.dx + it.x, oy = TPL.y + sheet.dy + it.y;
    drawTemplateShape(g, P, it, ox, oy, [ox, oy, it.w, it.h, 0, 0]);
  }
  return c;
}
// one sheet of a template too big for a single A4 sheet
function pdfTiledPage(P, b, i, sp, tile, page, pages) {
  const [c, g] = pdfPageCanvas(), M = 10;
  const t = sp.t, n = sp.tiles.length;
  pdfTemplateHeader(g, P, `Template · Block ${i + 1}`, [
    { text: `${b.label} · cut ${[...t.ids.entries()].map(([id, k]) => `${id} × ${k}`).join(' · ')} · sheet ${tile.k + 1} of ${n} (row ${tile.r + 1}, column ${tile.c + 1})` },
    { text: realSizeNote(P) },
    ...(mirrorNote(t) ? [{ text: mirrorNote(t), color: '#8a3b1f', weight: 600 }] : []),
  ], page, pages);
  g.save(); g.beginPath(); g.rect(TPL.x, TPL.y, TPL.w, TPL.h); g.clip();
  const ox = TPL.x - tile.c * TPL.w + sp.ox, oy = TPL.y - tile.r * TPL.h + sp.oy;
  drawTemplateShape(g, P, sp, ox, oy, [TPL.x, TPL.y, TPL.w, TPL.h]);
  g.restore();
  g.setLineDash([1, 1]); g.strokeStyle = '#8a857c'; g.lineWidth = 0.25; g.strokeRect(TPL.x, TPL.y, TPL.w, TPL.h); g.setLineDash([]);
  // join marks at the middle of each edge that meets another sheet
  g.strokeStyle = '#1f1d1a'; g.lineWidth = 0.3;
  const mids = [];
  if (tile.c > 0) mids.push([TPL.x, TPL.y + TPL.h / 2, 'left']);
  if (tile.c < sp.cols - 1) mids.push([TPL.x + TPL.w, TPL.y + TPL.h / 2, 'right']);
  if (tile.r > 0) mids.push([TPL.x + TPL.w / 2, TPL.y, 'top']);
  if (tile.r < sp.rows - 1) mids.push([TPL.x + TPL.w / 2, TPL.y + TPL.h, 'bottom']);
  for (const [x, y] of mids) { g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); }
  pdfText(g, 'Trim along the dotted border where sheets join, match the + marks, and tape the sheets edge to edge.', M, A4.h - 6, 3, { color: '#5a5650' });
  return c;
}
function templateJobs(P, b, i) {
  const shapes = blockTemplates(P, b, i).map(t => templateShape(t, P.seam));
  const single = shapes.filter(sp => sp.sheets === 1), big = shapes.filter(sp => sp.sheets > 1), jobs = [];
  const sheets = packTemplates(single);
  sheets.forEach((sh, k) => jobs.push((n, p) => pdfPackedPage(P, b, i, sh, k, sheets.length, p, n)));
  for (const sp of big) {
    sp.cols = Math.ceil(sp.w / TPL.w); sp.rows = Math.ceil(sp.h / TPL.h);
    sp.ox = (sp.cols * TPL.w - sp.w) / 2; sp.oy = (sp.rows * TPL.h - sp.h) / 2;
    const cutAt = sp.cut.map(([x, y]) => [x + sp.ox, y + sp.oy]);
    sp.tiles = [];
    for (let r = 0; r < sp.rows; r++) for (let c = 0; c < sp.cols; c++)
      if (tileHasShape(cutAt, c * TPL.w + 3, r * TPL.h + 3, TPL.w - 6, TPL.h - 6)) sp.tiles.push({ r, c, k: sp.tiles.length });
    for (const tile of sp.tiles) jobs.push((n, p) => pdfTiledPage(P, b, i, sp, tile, p, n));
  }
  return jobs;
}
async function makeCutPdf() {
  if (!design) return null;
  if (!lastPlan) renderCut();
  const P = lastPlan, jobs = [];
  jobs.push(n => pdfFabricPage(P, n), (n, p) => pdfQuiltPage(P, p, n));
  P.blocks.forEach((b, i) => { jobs.push((n, p) => pdfBlockPage(P, b, i, p, n)); jobs.push(...templateJobs(P, b, i)); });
  if ((P.sashing || []).some(x => x.group === 'sash')) jobs.push((n, p) => pdfSashPage(P, p, n));
  bordersOf(design).forEach((_, bi) => { if ((P.sashing || []).some(x => x.group === 'b' + bi)) jobs.push((n, p) => pdfBorderPage(P, bi, p, n)); });
  const total = jobs.length, pages = [];
  for (let k = 0; k < total; k++) {
    cgPdfStatus(`Drawing page ${k + 1} of ${total}…`);
    await new Promise(r => setTimeout(r, 0));
    const c = jobs[k](total, k + 1);
    pages.push({ w: c.width, h: c.height, jpg: await canvasJpeg(c) });
  }
  return buildPdf(pages);
}
function cgPdfStatus(t) { const el = $('cg-pdfstat'); el.textContent = t; el.hidden = !t; clearTimeout(cgPdfStatus.t); if (t && !t.endsWith('…')) cgPdfStatus.t = setTimeout(() => cgPdfStatus(''), 5000); }
async function downloadCutPdf() {
  const btn = $('cg-pdf'); btn.disabled = true;
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const filename = `quilt-cutting-guide-A4-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
  try {
    const blob = await makeCutPdf();
    window.__lastCutPdf = blob;
    if (downloads) {
      cgPdfStatus('Saving…');
      const res = await downloads.save({ filename, data: blob });
      cgPdfStatus(res && res.status === 'delivered' ? 'Sent' : 'Saved');
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      cgPdfStatus('Saved');
    }
  } catch (e) {
    const code = e && e.code;
    cgPdfStatus(code === 'declined' ? 'Not saved' : code === 'rate_limited' ? 'A save dialog is already open' : (e && e.message) || 'The PDF could not be made');
  } finally { btn.disabled = false; }
}
$('cg-pdf').addEventListener('click', downloadCutPdf);

// ------------------------------------------------------------- loop
let lastT = performance.now();
function frame(now) {
  now = now || performance.now();
  if (state.page !== 'sim') { lastT = now; requestAnimationFrame(frame); return; }   // the 3D view is hidden
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (grabMsg) { send(grabMsg); grabMsg = null; }
  if (newFrame) {
    upsample(); newFrame = false;
    computeAnalysis();
    for (let k = 0; k < handMeshes.length; k++) {
      const on = 3 * k + 2 < handsData.length && state.view !== 'render';
      handMeshes[k].visible = on;
      if (on) handMeshes[k].position.set(handsData[3 * k], handsData[3 * k + 1] + 0.03, handsData[3 * k + 2]);
    }
  }
  const showQuilt = havePos && !(analysis.on && analysis.anim === null);
  quiltTop.visible = quiltBot.visible = quiltBind.visible = showQuilt || (analysis.on && analysis.anim !== null);
  stepAnalysis(dt);
  stepCamera(dt);
  if (!stepRender()) renderer.render(scene, activeCam);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------- start
if (IS_PHONE) {
  document.documentElement.classList.add('phone');
  $('rbtn').hidden = true;
  $('render-card').hidden = true;
  const ar = $('atrest'); ar.value = 'none';
}
resize();
startSim();
requestAnimationFrame(frame);
fitSimSide();
// the site opens on the Quilt designer (#sim or #cut in the address open those pages instead)
if (location.hash === '#sim') showPage('sim');
else if (location.hash === '#cut') showPage('cut');
else if (location.hash === '#mine') showPage('mine');
else showPage('design');
(async () => {
  try {
    cavityImg = await loadImage('assets/quilt_cavity.png');
    await Promise.all([useSwatches(BUNDLED), applyLook()]);
    // the quilt on the bed is your design from the start (the designer keeps it in this browser)
    await initFabricLib();
    if (!design) { design = loadDesign(); selBlocks = new Set([0]); focusBlock = 0; activeFabric = activeFabric || 'b0'; }
    syncSimulation();
  } catch (e) {
    $('loading').textContent = 'Some photos or lighting could not load. Showing a plain preview.';
    setTimeout(() => { $('loading').hidden = true; }, 4000);
    return;
  }
  $('loading').hidden = true;
})();
