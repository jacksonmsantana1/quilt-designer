// Simulation controls: parameters, scenario, restart, 90° turn and drop position.
import './messages.js'; // load order: runs after sim/messages
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { $ } from '../core/dom.js';
import { PARAMS, PRESETS, SUBSTEPS, bedM, bedState, isTableSim, quilt, state } from './config.js';
import { dropPosM, send } from './worker-link.js';
import { camera, canvas, renderer, scene, sun } from './renderer.js';
import { colliderMeshes } from './stage.js';
import { applyLook, look } from './lighting.js';
import { goView, ortho } from './camera.js';
import { analysis, computeAnalysis, setEngineering } from './analysis.js';
import { PT_KEY, pathTracer, raster, resetRaster, restartSamples, startRender, stopRender } from './photo-render.js';
import { setView } from './view.js';

// ------------------------------------------------------------- controls
const toSlider = (p, v) =>
  p.scale === 'log' ? (Math.log(v / p.min) / Math.log(p.max / p.min)) * 1000 : ((v - p.min) / (p.max - p.min)) * 1000;
const fromSlider = (p, s) =>
  p.scale === 'log' ? p.min * Math.pow(p.max / p.min, s / 1000) : p.min + ((p.max - p.min) * s) / 1000;
const paramsBox = $('params');
for (const p of PARAMS) {
  const wrap = document.createElement('div');
  wrap.className = 'param';
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
function showParam(p) {
  $(`p-${p.key}-o`).textContent = p.fmt(state.params[p.key]) + (p.unit ? ' ' + p.unit : '');
}
function syncParams() {
  for (const p of PARAMS) {
    $(`p-${p.key}`).value = toSlider(p, state.params[p.key]);
    showParam(p);
  }
}
syncParams();
let savedCd = state.params.Cd;
$('preset').addEventListener('change', e => {
  state.params = { ...PRESETS[e.target.value] };
  savedCd = state.params.Cd;
  $('air').checked = true;
  syncParams();
  send({ type: 'params', params: state.params });
  restart();
});
$('air').addEventListener('change', e => {
  if (!e.target.checked) {
    savedCd = state.params.Cd || savedCd;
    state.params.Cd = 0;
    state.params.Cf = 0;
  } else {
    state.params.Cd = savedCd || 1.2;
    state.params.Cf = 0.02;
  }
  syncParams();
  send({ type: 'params', params: { Cd: state.params.Cd, Cf: state.params.Cf } });
});
$('pillows').addEventListener('change', e => {
  if (colliderMeshes.pillowL) {
    colliderMeshes.pillowL.visible = e.target.checked;
    colliderMeshes.pillowR.visible = e.target.checked && !colliderMeshes.pillowR.userData.dup;
  }
  if (analysis.on) setEngineering(true);
  send({ type: 'pillows', value: e.target.checked });
});
$('selfc').addEventListener('change', e => send({ type: 'self', value: e.target.checked }));
const dropOut = () => {
  $('dropH-o').textContent = state.dropHeight.toFixed(2) + ' m';
};
$('dropH').addEventListener('input', e => {
  state.dropHeight = +e.target.value;
  dropOut();
});
$('dropH').addEventListener('change', () => {
  if (state.scenario === 'drop') restart();
});
dropOut();
const subOut = () => {
  $('substeps-o').textContent = `${state.substeps} substeps · Δt = ${(1000 / 60 / state.substeps).toFixed(2)} ms`;
};
$('substeps').addEventListener('input', e => {
  state.substeps = SUBSTEPS[+e.target.value];
  subOut();
  send({ type: 'substeps', value: state.substeps });
});
subOut();
$('speed').addEventListener('change', e => send({ type: 'speed', value: +e.target.value }));

function restart() {
  state.history.length = 0;
  state.autoDone = false;
  setView('photo');
  if (!state.running) setRunning(true);
  send({
    type: 'reset',
    scenario: state.scenario,
    dropHeight: state.dropHeight,
    rot: shared.quiltTurned,
    pos: dropPosM(),
  });
}
function setRunning(v, quiet) {
  state.running = v;
  $('pause').textContent = v ? 'Pause' : 'Resume';
  send({ type: 'run', value: v });
  if (!quiet && v && state.view === 'render') setView('photo');
}
$('restart').addEventListener('click', restart);
function syncTurnBtn() {
  const b = $('sim-turn');
  if (!b) return;
  b.setAttribute('aria-pressed', String(shared.quiltTurned));
  b.title = shared.quiltTurned
    ? 'Quilt turned 90° · click to drop it straight again'
    : 'Turn the quilt 90° and drop it again';
}
$('sim-turn').addEventListener('click', () => {
  shared.quiltTurned = !shared.quiltTurned;
  try {
    localStorage.setItem('quilt-turned.v1', shared.quiltTurned ? '1' : '0');
  } catch (e) {}
  if (state.scenario !== 'drop') {
    state.scenario = 'drop';
    for (const x of $('scenarios').children) x.setAttribute('aria-pressed', String(x.dataset.sc === 'drop'));
  }
  syncTurnBtn();
  syncDropUI();
  restart();
});
syncTurnBtn();
// ---- drop position: a slider along an imaginary line over the long side of the bed or table
const alongZ = () => bedState.l >= bedState.w;
// the furthest toward the head the quilt can start: on a bed its head edge stays at the head of the mattress
// (starting over the headboard would make it drape on both sides of the board)
function dropMin() {
  const L = Math.max(bedState.w, bedState.l);
  if (isTableSim() || !alongZ()) return -Math.round(L / 2);
  const len = (shared.quiltTurned ? quilt.w : quilt.l) * 1000;
  return Math.round(-bedState.l / 2 + 20 + len / 2);
}
function defaultDropPos() {
  if (isTableSim() || !alongZ()) return 0;
  const len = (shared.quiltTurned ? quilt.w : quilt.l) * 1000;
  return Math.round(-bedState.l / 2 + 70 + len / 2); // head edge of the quilt 7 cm from the head of the bed
}
const dropGuide = new THREE.Group();
dropGuide.visible = false;
dropGuide.renderOrder = 999;
scene.add(dropGuide);
const guideMat = new THREE.LineDashedMaterial({
  color: 0xe0592a,
  dashSize: 0.06,
  gapSize: 0.035,
  depthTest: false,
  transparent: true,
});
const guideMat2 = new THREE.LineDashedMaterial({
  color: 0x2f466f,
  dashSize: 0.04,
  gapSize: 0.03,
  depthTest: false,
  transparent: true,
});
const guideDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.035, 32),
  new THREE.MeshBasicMaterial({ color: 0xe0592a, depthTest: false, transparent: true }),
);
guideDot.rotation.x = -Math.PI / 2;
guideDot.renderOrder = 1000;
let guideT = 0;
function updateDropGuide(show) {
  for (const o of [...dropGuide.children]) {
    dropGuide.remove(o);
    if (o !== guideDot) o.geometry.dispose();
  }
  const bed = bedM(),
    y = ClothSim.surfaceTop(bed) + 0.03,
    L = Math.max(bed.w, bed.l),
    z = alongZ();
  const p = (shared.dropPos == null ? defaultDropPos() : shared.dropPos) / 1000;
  const P = (a, b) => (z ? new THREE.Vector3(b, y, a) : new THREE.Vector3(a, y, b));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(-L / 2, 0), P(L / 2, 0)]), guideMat);
  line.computeLineDistances();
  line.renderOrder = 999;
  // the quilt's footprint where it will be dropped
  const qw = (shared.quiltTurned ? quilt.l : quilt.w) / 2,
    ql = (shared.quiltTurned ? quilt.w : quilt.l) / 2,
    cx = z ? 0 : p,
    cz = z ? p : isTableSim() ? 0 : 0;
  const rect = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      [
        [-qw, -ql],
        [qw, -ql],
        [qw, ql],
        [-qw, ql],
      ].map(([a, b]) => new THREE.Vector3(cx + a, y, cz + b)),
    ),
    guideMat2,
  );
  rect.computeLineDistances();
  rect.renderOrder = 999;
  guideDot.position.set(z ? 0 : p, y + 0.001, z ? p : 0);
  dropGuide.add(line, rect, guideDot);
  clearTimeout(guideT);
  dropGuide.visible = !!show;
  if (show)
    guideT = setTimeout(() => {
      dropGuide.visible = false;
    }, 2500);
}
function syncDropUI() {
  const el = $('drop-pos');
  if (!el) return;
  const L = Math.max(bedState.w, bedState.l);
  const lo = dropMin(),
    hi = Math.round(L / 2);
  if (shared.dropPos != null && shared.dropPos < lo) shared.dropPos = lo;
  const v = shared.dropPos == null ? defaultDropPos() : shared.dropPos;
  el.min = String(Math.min(lo, hi));
  el.max = String(hi);
  el.step = '10';
  el.value = String(shared.dropPos == null ? v : shared.dropPos);
  const far = z =>
    Math.abs(z) < 5
      ? 'centre'
      : `${Math.abs(z)} mm toward the ${alongZ() ? (z > 0 ? (isTableSim() ? 'near end' : 'foot') : isTableSim() ? 'far end' : 'head') : z > 0 ? 'right' : 'left'}`;
  $('drop-pos-v').textContent = shared.dropPos == null ? `${far(v)} (usual spot)` : far(v);
}
$('drop-pos').addEventListener('input', e => {
  shared.dropPos = +e.target.value;
  syncDropUI();
  updateDropGuide(true);
});
$('drop-pos').addEventListener('change', () => {
  updateDropGuide(true);
  restart();
});
$('drop-pos').addEventListener('dblclick', () => {
  shared.dropPos = null;
  syncDropUI();
  updateDropGuide(true);
  restart();
});
for (const ev of ['pointerenter', 'focus']) $('drop-pos').addEventListener(ev, () => updateDropGuide(true));
syncDropUI();
$('pause').addEventListener('click', () => setRunning(!state.running));
$('scenarios').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  state.scenario = b.dataset.sc;
  for (const x of $('scenarios').children) x.setAttribute('aria-pressed', String(x === b));
  restart();
});
$('modes').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  state.mode = b.dataset.mode;
  for (const x of $('modes').children) x.setAttribute('aria-pressed', String(x === b));
  $('hint').textContent =
    state.mode === 'grab' ? 'Drag the quilt to pull it · drag empty space to orbit' : 'Drag to orbit · scroll to zoom';
  canvas.classList.remove('can-grab');
});
$('views').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setView(b.dataset.view);
});
$('field').addEventListener('change', e => {
  analysis.field = e.target.value;
  analysis.legendKey = '';
  computeAnalysis();
});
$('meshlines').addEventListener('change', e => {
  analysis.mesh = e.target.checked;
});
$('ortho').addEventListener('change', e => {
  if (e.target.checked && state.view === 'render') setView('photo');
  shared.activeCam = e.target.checked ? ortho : camera;
});
$('atrest').addEventListener('change', e => {
  state.atRest = e.target.value;
});
for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => goView(b.dataset.cam));

// render controls
$('stagesel').addEventListener('change', e => {
  look.stage = e.target.value;
  applyLook().then(rebuildRenderScene);
});
$('lightsel').addEventListener('change', e => {
  look.light = e.target.value;
  applyLook().then(() => {
    restartSamples();
    resetRaster();
  });
});
const expOut = () => {
  $('exposure-o').textContent = look.exposure.toFixed(2) + '×';
};
$('exposure').addEventListener('input', e => {
  look.exposure = +e.target.value;
  renderer.toneMappingExposure = look.exposure;
  expOut();
});
expOut();
const fOut = () => {
  $('fstop-o').textContent = 'f/' + look.fstop.toFixed(1);
};
$('dof').addEventListener('change', e => {
  look.dof = e.target.checked;
  updateDof();
});
$('fstop').addEventListener('input', e => {
  look.fstop = +e.target.value;
  fOut();
  updateDof();
});
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
  if (look.engine === 'path') {
    shared.ptBroken = null;
    try {
      localStorage.removeItem(PT_KEY);
    } catch (_) {}
    $('rnote').hidden = true;
  }
  if (state.view === 'render') {
    stopRender();
    startRender();
  }
});
$('bounces').addEventListener('change', e => {
  look.bounces = +e.target.value;
  if (pathTracer) {
    pathTracer.bounces = look.bounces;
    restartSamples();
  }
});
function rebuildRenderScene() {
  if (raster.active) {
    resetRaster();
    return;
  }
  if (pathTracer && state.view === 'render') {
    sun.visible = false;
    pathTracer.setScene(scene, camera);
    shared.renderT0 = performance.now();
    shared.ptCheck = { done: false };
  }
}

export { restart, setRunning, syncDropUI };
