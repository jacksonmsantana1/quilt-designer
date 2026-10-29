// Photo render: path tracer, raster fallback and engine selection.
import './analysis.js'; // load order: runs after sim/analysis
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ptBroken, ptCheck, renderT0, setActiveCam, setPtBroken, setPtCheck, setRenderT0 } from './sim-state.js';
import { $ } from '../core/dom.js';
import { N, state } from './config.js';
import { camera, canvas, renderer, scene, sun } from './renderer.js';
import { applyLook, look } from './lighting.js';
import { handMeshes, simPos } from './quilt-mesh.js';
import { orbit, placeCamera, target } from './camera.js';
import { setRunning } from './controls.js';

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
  try {
    const gl = renderer.getContext(),
      d = gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e) {
    return 'unknown GPU';
  }
})();
let pathTracer = null,
  ptError = null,
  wasRunning = true;
try {
  const saved = JSON.parse(localStorage.getItem(PT_KEY) || 'null');
  if (saved && saved.gpu === GPU_NAME) setPtBroken(saved.reason);
} catch (e) {}

function ensurePathTracer() {
  if (pathTracer || ptError) return pathTracer;
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext) || !gl.getExtension('EXT_color_buffer_float')) {
    ptError = 'this browser’s graphics don’t support floating-point render targets';
    return null;
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
  } catch (e) {
    ptError = 'the path tracer could not start (' + (e.message || e) + ')';
    pathTracer = null;
  }
  return pathTracer;
}
function ptScale() {
  return window.__ptScale || Math.min(1, 1 / renderer.getPixelRatio());
}

// ---- raster engine
const RASTER_ENV_SCALE = 0.35; // the rest of the sky's diffuse light comes from the shadowed sky light
const raster = { active: false, n: 0, rtFrame: null, rtAccum: null, t0: 0, frameMs: 16 };
const skyLight = new THREE.DirectionalLight(0xfff7ef, 0);
skyLight.castShadow = true;
skyLight.shadow.mapSize.set(2048, 2048);
Object.assign(skyLight.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 18 });
skyLight.shadow.bias = -0.0005;
skyLight.shadow.normalBias = 0.025;
skyLight.visible = false;
scene.add(skyLight);
scene.add(skyLight.target);
const blendQuad = new FullScreenQuad(
  new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uW: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:
      'uniform sampler2D tMap; uniform float uW; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tMap, vUv).rgb, uW); }',
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor, // alpha only grows, so the canvas stays opaque
  }),
);
const showQuad = new FullScreenQuad(
  new THREE.MeshBasicMaterial({ toneMapped: true, depthTest: false, depthWrite: false }),
);
const halton = (n, b) => {
  let f = 1,
    r = 0,
    i = n;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
};
const baseSunDir = new THREE.Vector3();
function rasterSize() {
  const s = new THREE.Vector2();
  renderer.getDrawingBufferSize(s);
  return [Math.max(1, Math.floor(s.x)), Math.max(1, Math.floor(s.y))];
}
function ensureRasterTargets() {
  const [w, h] = rasterSize();
  if (raster.rtFrame && raster.rtFrame.width === w && raster.rtFrame.height === h) return;
  raster.rtFrame?.dispose();
  raster.rtAccum?.dispose();
  const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
  raster.rtFrame = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true });
  raster.rtAccum = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: false });
  raster.n = 0;
}
function resetRaster() {
  if (raster.active) {
    raster.n = 0;
    raster.t0 = performance.now();
  }
}
function rasterTarget() {
  return look.target * 2;
}
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
const _right = new THREE.Vector3(),
  _up = new THREE.Vector3(),
  _fwd = new THREE.Vector3(),
  _camPos = new THREE.Vector3();
function rasterFrame() {
  const k = raster.n + 1,
    [w, h] = rasterSize();
  // key light: a random direction within the window / softbox's angular size
  const cone = look.stage === 'studio' ? 0.28 : 0.16;
  _fwd.copy(baseSunDir);
  _right.set(0, 1, 0).cross(_fwd).normalize();
  _up.copy(_fwd).cross(_right);
  const a = 2 * Math.PI * halton(k, 2),
    r = cone * Math.sqrt(halton(k, 3));
  sun.position
    .copy(_fwd)
    .addScaledVector(_right, Math.cos(a) * r)
    .addScaledVector(_up, Math.sin(a) * r)
    .normalize()
    .multiplyScalar(6);
  // sky light: cosine-weighted direction over the upper hemisphere
  const u1 = halton(k, 5),
    u2 = halton(k, 7),
    sr = Math.sqrt(u1),
    phi = 2 * Math.PI * u2;
  const dy = Math.max(0.08, Math.sqrt(1 - u1));
  skyLight.position
    .set(sr * Math.cos(phi), dy, sr * Math.sin(phi))
    .normalize()
    .multiplyScalar(9)
    .add(target);
  // lens: thin-lens depth of field by moving the eye across the aperture, keeping the focus point fixed
  placeCamera(true);
  if (look.dof) {
    const apertureM = camera.getFocalLength() / look.fstop / 1000; // focal length in mm on a 35 mm film gauge
    const la = 2 * Math.PI * halton(k, 11),
      lr = 0.5 * apertureM * Math.sqrt(halton(k, 13));
    camera.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, camera.up).normalize();
    _up.crossVectors(_right, _fwd);
    _camPos
      .copy(camera.position)
      .addScaledVector(_right, Math.cos(la) * lr)
      .addScaledVector(_up, Math.sin(la) * lr);
    camera.position.copy(_camPos);
    camera.lookAt(target);
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
  const ac = renderer.autoClear;
  renderer.autoClear = false; // blend onto the running average, don't wipe it
  blendQuad.render(renderer);
  renderer.autoClear = ac;
  renderer.setRenderTarget(null);
  raster.n = k;
}
function stepRaster() {
  ensureRasterTargets();
  const goal = rasterTarget(),
    t = performance.now();
  // render as many frames as fit in ~25 ms, so the page stays responsive
  let did = 0;
  while (raster.n < goal && (did === 0 || performance.now() - t + raster.frameMs < 25)) {
    const f0 = performance.now();
    rasterFrame();
    raster.frameMs = 0.8 * raster.frameMs + 0.2 * (performance.now() - f0);
    did++;
  }
  showQuad.material.map = raster.rtAccum.texture;
  showQuad.render(renderer);
  const secs = (performance.now() - raster.t0) / 1000,
    done = raster.n >= goal;
  $('rstat').textContent = done
    ? `Render done · ${goal} frames · ${secs.toFixed(0)} s · fast raster`
    : `Rendering · ${raster.n} / ${goal} frames · ${secs.toFixed(0)} s · fast raster`;
  $('rbar-fill').style.width = Math.min(100, (100 * raster.n) / goal) + '%';
  return true;
}

// ---- engine selection and failure handling
function usePathTracing() {
  return look.engine === 'path' || (look.engine === 'auto' && !ptBroken);
}
function renderFailed(reason, permanent = true) {
  setPtBroken(reason);
  if (permanent) {
    try {
      localStorage.setItem(PT_KEY, JSON.stringify({ gpu: GPU_NAME, reason }));
    } catch (e) {}
  }
  const n = $('rnote');
  n.textContent = `Path tracing didn’t work on this GPU (${GPU_NAME}): ${reason}. Switched to the fast raster renderer, which works on any GPU.`;
  n.hidden = false;
  setTimeout(() => {
    n.hidden = true;
  }, 12000);
  if (state.view === 'render') {
    sun.visible = true;
    startRaster();
  }
}
async function startRender() {
  if ($('ortho').checked) {
    $('ortho').checked = false;
    setActiveCam(camera);
  }
  wasRunning = state.running;
  if (state.running) setRunning(false, true);
  await applyLook();
  for (const h of handMeshes) h.visible = false;
  if (!usePathTracing()) {
    startRaster();
    return;
  }
  if (!ensurePathTracer()) {
    renderFailed(ptError);
    return;
  }
  sun.visible = false;
  pathTracer.bounces = look.bounces;
  pathTracer.renderScale = ptScale();
  pathTracer.pausePathTracing = false;
  camera.bokehSize = look.dof ? camera.getFocalLength() / look.fstop : 0;
  camera.focusDistance = orbit.r;
  try {
    pathTracer.setScene(scene, camera);
  } catch (e) {
    renderFailed('the scene could not be prepared (' + (e.message || e) + ')');
    return;
  }
  setRenderT0(performance.now());
  setPtCheck({ done: false });
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
  setRenderT0(performance.now());
  pathTracer.reset();
  setPtCheck({ done: false });
}
// After a few samples, read the accumulated image where the quilt is. On a
// working GPU those pixels are lit fabric; on a broken driver they come back
// black, NaN, or exactly the background colour (the rays missed the geometry).
const _p = new THREE.Vector3();
function verifyRender() {
  if (!ptCheck || ptCheck.done || pathTracer.samples < 4) return;
  ptCheck.done = true;
  const t = pathTracer.target;
  if (!t) return;
  const bg = scene.background && scene.background.isColor ? scene.background : new THREE.Color(0, 0, 0);
  const px = new Float32Array(4);
  let bad = 0,
    tested = 0;
  for (const [i, j] of [
    [10, 10],
    [20, 10],
    [30, 10],
    [10, 20],
    [20, 20],
    [30, 20],
    [10, 30],
    [20, 30],
    [30, 30],
  ]) {
    const k = 3 * (j * N + i);
    _p.set(simPos[k], simPos[k + 1], simPos[k + 2]).project(camera);
    if (Math.abs(_p.x) > 0.95 || Math.abs(_p.y) > 0.95 || _p.z > 1) continue;
    const x = Math.floor((_p.x * 0.5 + 0.5) * t.width),
      y = Math.floor((_p.y * 0.5 + 0.5) * t.height);
    try {
      renderer.readRenderTargetPixels(t, x, y, 1, 1, px);
    } catch (e) {
      return;
    }
    tested++;
    const s = px[0] + px[1] + px[2];
    if (
      !Number.isFinite(s) ||
      s < 1e-4 ||
      Math.abs(px[0] - bg.r) + Math.abs(px[1] - bg.g) + Math.abs(px[2] - bg.b) < 0.003
    )
      bad++;
  }
  if (tested >= 3 && bad >= Math.ceil(tested / 2))
    renderFailed('the quilt came out black, so the graphics driver is mis-running the path tracer');
}
function stepRender() {
  if (state.view !== 'render') return false;
  if (raster.active) return stepRaster();
  if (!pathTracer || !pathTracer.scene) return false;
  if (pathTracer.samples >= look.target) pathTracer.pausePathTracing = true;
  pathTracer.renderSample();
  verifyRender();
  if (raster.active || state.view !== 'render') return raster.active;
  const s = Math.floor(pathTracer.samples),
    secs = (performance.now() - renderT0) / 1000;
  const done = pathTracer.samples >= look.target;
  $('rstat').textContent = pathTracer.isCompiling
    ? `Compiling the path tracer for your GPU… ${secs.toFixed(0)} s (first time only)`
    : done
      ? `Render done · ${look.target} samples · ${secs.toFixed(0)} s · path traced`
      : `Rendering · ${s} / ${look.target} samples · ${secs.toFixed(0)} s · path traced`;
  $('rbar-fill').style.width = Math.min(100, (100 * pathTracer.samples) / look.target) + '%';
  if (pathTracer.isCompiling && secs > 150) renderFailed('the path tracer took over 2½ minutes to compile', false);
  return true;
}
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  console.error('Shader error:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
  if (state.view === 'render' && !raster.active) renderFailed('the path-tracing shader failed to compile');
};
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  try {
    localStorage.setItem(
      PT_KEY,
      JSON.stringify({ gpu: GPU_NAME, reason: 'the graphics card reset while path tracing' }),
    );
  } catch (_) {}
  const n = $('rnote');
  n.textContent =
    'The graphics card reset the 3D view. Reload the page; photo renders will use the fast raster renderer on this GPU.';
  n.hidden = false;
});

export {
  PT_KEY,
  RASTER_ENV_SCALE,
  pathTracer,
  raster,
  resetRaster,
  restartSamples,
  showQuad,
  startRender,
  stepRender,
  stopRender,
};
