// The realistic picture of a quilt, made in the background while the person carries on working. It has its own copy of
// everything, so what they do meanwhile doesn't touch it, nor it them: a copy of the physics settles the quilt, a hidden
// canvas with its own graphics context renders the room (sim/bedroom.js) and the fine quilt (sim/quilt-hero.js), and
// the design is the one the picture was asked for even if it has been edited since. The result is kept by the quilt's
// fingerprint (storage/pictures.js). The page has to stay open; the work goes on while its tab is out of sight.
import './bedroom.js'; // load order: runs after sim/bedroom
import * as THREE from 'three';
import { DenoiseMaterial, PhysicalCamera, WebGLPathTracer } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { dropPos, ptBroken, quiltTurned } from './sim-state.js';
import { N, R, bedM, state } from './config.js';
import { newPhysicsWorker } from './worker-link.js';
import { IS_PHONE } from './renderer.js';
import { loadHdri, look } from './lighting.js';
import { QM } from './patchwork.js';
import { layQuilt, newBackAndBinding, qGeo, subdivide } from './quilt-mesh.js';
import { makeHeroTop } from './quilt-hero.js';
import { bedroom, buildBedroom, clearBedroom, dressBed, prepareRoom, showRoomSun } from './bedroom.js';
import { pictures } from '../storage/pictures.js';
import { quiltSig } from '../core/quilt-sig.js';
import { quiltMm } from '@quilt/shared/geometry.js';
import { t } from '@quilt/shared/i18n.js';

const WIDTH = 1500,
  HEIGHT = 1000,
  JPEG_QUALITY = 0.92;
const SAMPLES = 512, // of the path tracer
  RASTER_FRAMES = 256, // of the fallback for graphics cards it doesn't work on
  // a slow graphics card stops at what it has after this long, as long as it has enough to look right
  ENOUGH_SECONDS = 600,
  ENOUGH_SAMPLES = 64,
  COMPILE_SECONDS = 150,
  SETTLE_SECONDS = 90,
  PHYSICS_SPEED = 3;

/** Stops a picture being made. */
class Stopped extends Error {}

/** A picture being made: of which quilt, and how far along. */
class Job {
  /** @param {any} design */
  constructor(design) {
    this.sig = quiltSig(design);
    this.design = design;
    /** @type {'settling' | 'preparing' | 'compiling' | 'rendering'} */
    this.stage = 'settling';
    this.progress = 0;
    this.stopped = false;
    /** @type {(() => void)[]} */
    this.cleanups = [];
  }
  /** @param {Job['stage']} stage */
  setStage(stage) {
    this.stage = stage;
    this.progress = 0;
    tell({ type: 'change' });
  }
  /** @param {number} progress */
  setProgress(progress) {
    this.progress = Math.min(1, progress);
    tell({ type: 'change' });
  }
}
/** @type {Job | null} */
let job = null;
/** @type {Set<(event: { type: 'change' | 'done' | 'failed' | 'stopped', sig?: string, why?: string }) => void>} */
const listeners = new Set();
const tell = e => listeners.forEach(f => f(e));
/** Called when a picture starts, moves on, is ready or fails. */
const onPicture = f => void listeners.add(f);
/** The picture being made: which quilt, how far along. */
const pictureJob = () => job;
/** Whether this device can make pictures at all: not on phones, as with the photo render. */
const canMakePictures = () => !IS_PHONE && typeof Worker !== 'undefined';

function check(j) {
  if (j.stopped) throw new Stopped();
}
/** Lets the page breathe between long steps. */
function breather(j) {
  return async () => {
    await new Promise(done => setTimeout(done, 0));
    check(j);
  };
}

// ---- the quilt, lying on the bed
/** Lets a copy of the physics drop the quilt and settle. @returns {Promise<Float32Array>} its N × N points */
function settleQuilt(j, bed, pillows) {
  const qm = quiltMm(j.design);
  return new Promise((resolve, reject) => {
    const worker = newPhysicsWorker();
    j.cleanups.push(() => worker.terminate());
    let last = null;
    const finish = () => {
      clearTimeout(limit);
      worker.terminate();
      if (j.stopped) reject(new Stopped());
      else if (last) resolve(last);
      else reject(new Error('the quilt did not settle'));
    };
    // however it has got by then: a quilt that keeps swaying a little still makes a good picture
    const limit = setTimeout(finish, SETTLE_SECONDS * 1000);
    j.cleanups.push(() => {
      clearTimeout(limit);
      if (j.stopped) reject(new Stopped());
    });
    worker.onerror = e => {
      clearTimeout(limit);
      reject(new Error(e.message));
    };
    worker.onmessage = e => {
      const m = e.data;
      if (m.type !== 'frame') return;
      last = m.pos;
      if (j.stopped || m.stats?.restAt != null) finish();
    };
    const send = m => worker.postMessage(m);
    send({
      type: 'init',
      opt: {
        n: N,
        scenario: 'drop',
        params: state.params,
        substeps: state.substeps,
        bed,
        width: qm.W / 1000,
        length: qm.H / 1000,
      },
    });
    send({
      type: 'reset',
      scenario: 'drop',
      dropHeight: state.dropHeight,
      rot: quiltTurned,
      pos: dropPos == null ? null : dropPos / 1000,
    });
    send({ type: 'pillows', value: pillows });
    send({ type: 'speed', value: PHYSICS_SPEED });
  });
}

// ---- the scene
const backMaterial = () => QM.back.clone();
const bindingMaterial = () => QM.binding.clone();
async function buildScene(j, bed, pillows, points) {
  const breathe = breather(j);
  await prepareRoom();
  check(j);
  const scene = new THREE.Scene();
  buildBedroom(bed, pillows);
  dressBed(bed, points, pillows);
  scene.add(bedroom);
  j.cleanups.push(() => {
    scene.remove(bedroom);
    clearBedroom();
  });
  await breathe();
  // the quilt's shape on the render grid, and from it its backing and binding
  const mid = new Float32Array(R * R * 3),
    shape = new THREE.BufferGeometry();
  subdivide(points, mid, 3);
  shape.setAttribute('position', new THREE.BufferAttribute(mid, 3));
  shape.setIndex(qGeo.index);
  shape.computeVertexNormals();
  const normal = shape.attributes.normal.array,
    halfThick = Math.max(0.003, state.params.thickness) / 2,
    { back, binding } = newBackAndBinding();
  layQuilt(mid, normal, halfThick, {
    top: new Float32Array(R * R * 3), // (the picture has its own, finer top)
    back: back.attributes.position.array,
    binding: binding.attributes.position.array,
  });
  const backMesh = new THREE.Mesh(back, backMaterial()),
    bindingMesh = new THREE.Mesh(binding, bindingMaterial());
  for (const m of [backMesh, bindingMesh]) {
    m.geometry.computeVertexNormals();
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }
  const hero = await makeHeroTop(j.design, halfThick, mid, normal, breathe);
  scene.add(hero);
  j.cleanups.push(() => {
    hero.userData.dispose();
    for (const m of [backMesh, bindingMesh]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  });
  // a view of the whole room, standing back further from a very large bed
  const camera = new PhysicalCamera(38, WIDTH / HEIGHT, 0.05, 50),
    r = Math.max(5, 2.5 * Math.max(bed.w, bed.l)),
    az = 0.72,
    el = 0.27,
    aim = new THREE.Vector3(0, bed.kind === 'table' ? Math.max(0.5, bed.h - 0.1) : 0.8, 0.1);
  camera.bokehSize = 0;
  camera.position.set(
    aim.x + r * Math.cos(el) * Math.sin(az),
    aim.y + r * Math.sin(el),
    aim.z + r * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(aim);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  return { scene, camera };
}

// ---- working at the graphics card's own pace
// A timer in a worker keeps its time when the tab is out of sight (the page's own timers and animation frames don't).
// Each step waits until the card has finished the one before, so the card always has room for the live view too.
function runSteps(j, gl, step) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 12);'], { type: 'text/javascript' })),
      timer = new Worker(url);
    let fence = null,
      over = false;
    const end = (fn, v) => {
      if (over) return;
      over = true;
      timer.terminate();
      URL.revokeObjectURL(url);
      if (fence) gl.deleteSync(fence);
      fence = null;
      fn(v);
    };
    j.cleanups.push(() => end(reject, new Stopped()));
    timer.onmessage = () => {
      if (over) return;
      try {
        if (j.stopped) throw new Stopped();
        if (fence) {
          if (gl.isContextLost()) throw new Error('the graphics card was reset');
          const s = gl.clientWaitSync(fence, 0, 0);
          if (s === gl.TIMEOUT_EXPIRED) return;
          gl.deleteSync(fence);
          fence = null;
        }
        if (step()) return end(resolve);
        fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      } catch (e) {
        end(reject, e);
      }
    };
  });
}

// ---- rendering
function newRenderer(j, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  j.cleanups.push(() => {
    renderer.dispose();
    renderer.forceContextLoss();
  });
  return renderer;
}
const quality = usual => globalThis.__pictureQuality || usual; // (the browser tests ask for very little)

async function renderPathTraced(j, canvas, scene, camera) {
  const renderer = newRenderer(j, canvas),
    gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no floating-point render targets');
  // reading the path tracer's compile log holds up the whole page for many seconds; a shader that failed is found
  // anyway, because the picture comes out black
  renderer.debug.checkShaderErrors = false;
  const pt = new WebGLPathTracer(renderer);
  pt.textureSize.set(2048, 2048); // every texture is held at this size: the quilt's must keep its 2048 px
  pt.tiles.set(3, 3); // a part of the image at a time: quick steps, and the live view stays smooth
  pt.renderDelay = 0;
  pt.minSamples = 0;
  pt.fadeDuration = 0;
  pt.dynamicLowRes = false;
  pt.rasterizeScene = false;
  pt.renderToCanvas = false;
  pt.filterGlossyFactor = 0.5;
  pt.bounces = 6;
  // the last image goes through a filter that smooths the grain and stops at real edges
  const denoise = new FullScreenQuad(new DenoiseMaterial({ sigma: 2.2, kSigma: 2 }));
  denoise.material.uniforms.threshold.value = Math.max(0.03, 1.6 / Math.sqrt(SAMPLES));
  pt.renderToCanvasCallback = target => {
    denoise.material.map = target.texture;
    denoise.render(renderer);
  };
  j.cleanups.push(() => {
    denoise.material.dispose();
    denoise.dispose();
    pt.dispose();
  });
  showRoomSun(true);
  pt.setScene(scene, camera);
  j.setStage('compiling');
  const goal = quality(SAMPLES),
    t0 = performance.now();
  let checked = false,
    rendering = false;
  await runSteps(j, gl, () => {
    const secs = (performance.now() - t0) / 1000;
    if (pt.isCompiling && secs > COMPILE_SECONDS) throw new Error('the path tracer took too long to compile');
    if (pt.samples >= goal || (secs > ENOUGH_SECONDS && pt.samples >= ENOUGH_SAMPLES)) return true;
    pt.renderSample();
    if (!pt.isCompiling && !rendering) {
      rendering = true;
      j.setStage('rendering');
    }
    if (rendering) j.setProgress(pt.samples / goal);
    // some graphics drivers run the path tracer and give back nothing but black
    if (!checked && pt.samples >= 4) {
      checked = true;
      if (isBlack(renderer, pt.target)) throw new Error('the picture came out black');
    }
    return false;
  });
  pt.pausePathTracing = true;
  pt.renderToCanvas = true;
  pt.renderSample();
  gl.finish();
}
function isBlack(renderer, target) {
  const w = target.width,
    h = target.height,
    px = new Float32Array(4);
  let lit = 0;
  for (const [u, v] of [
    [0.3, 0.3],
    [0.5, 0.4],
    [0.7, 0.5],
    [0.4, 0.6],
    [0.6, 0.7],
  ]) {
    renderer.readRenderTargetPixels(target, Math.floor(u * w), Math.floor(v * h), 1, 1, px);
    if (Number.isFinite(px[0] + px[1] + px[2]) && px[0] + px[1] + px[2] > 1e-4) lit++;
  }
  return lit < 2;
}

// The fallback, for graphics cards the path tracer doesn't work on: many ordinary frames averaged, each with the
// lights moved a little, which gives soft shadows and shading in the corners.
const halton = (n, b) => {
  let f = 1,
    r = 0;
  for (let i = n; i > 0; i = Math.floor(i / b)) {
    f /= b;
    r += f * (i % b);
  }
  return r;
};
async function renderRaster(j, canvas, scene, camera) {
  const renderer = newRenderer(j, canvas),
    gl = renderer.getContext();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  showRoomSun(false);
  const sun = new THREE.DirectionalLight(0xfff1de, 2.4),
    fill = new THREE.DirectionalLight(0xfff7ef, 1);
  for (const l of [sun, fill]) {
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 0.5, far: 18 });
    l.shadow.bias = -0.0005;
    l.shadow.normalBias = 0.025;
    l.target.position.set(0, 0.5, 0);
    scene.add(l, l.target);
  }
  const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace },
    frame = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { ...opt, depthBuffer: true }),
    sum = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { ...opt, depthBuffer: false });
  const blend = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: frame.texture }, uW: { value: 1 } },
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
        blendDstAlpha: THREE.OneFactor,
      }),
    ),
    show = new FullScreenQuad(
      new THREE.MeshBasicMaterial({ map: sum.texture, toneMapped: true, depthTest: false, depthWrite: false }),
    );
  j.cleanups.push(() => {
    frame.dispose();
    sum.dispose();
    blend.material.dispose();
    blend.dispose();
    show.material.dispose();
    show.dispose();
    sun.dispose();
    fill.dispose();
  });
  j.setStage('rendering');
  const goal = quality(RASTER_FRAMES),
    sunDir = new THREE.Vector3(-3.6, 3.2, 0.9).normalize();
  let k = 0;
  await runSteps(j, gl, () => {
    if (k >= goal) return true;
    k++;
    const a = 2 * Math.PI * halton(k, 2),
      s = 0.16 * Math.sqrt(halton(k, 3));
    sun.position
      .copy(sunDir)
      .add(new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, Math.sin(a * 0.7) * s))
      .normalize()
      .multiplyScalar(6);
    const u = halton(k, 5),
      phi = 2 * Math.PI * halton(k, 7),
      sr = Math.sqrt(u);
    fill.position
      .set(sr * Math.cos(phi), Math.max(0.08, Math.sqrt(1 - u)), sr * Math.sin(phi))
      .normalize()
      .multiplyScalar(9);
    camera.setViewOffset(WIDTH, HEIGHT, halton(k, 2) - 0.5, halton(k, 3) - 0.5, WIDTH, HEIGHT);
    renderer.setRenderTarget(frame);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(sum);
    blend.material.uniforms.uW.value = 1 / k;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    blend.render(renderer);
    renderer.autoClear = ac;
    renderer.setRenderTarget(null);
    j.setProgress(k / goal);
    return false;
  });
  camera.clearViewOffset();
  scene.remove(sun, sun.target, fill, fill.target);
  renderer.setRenderTarget(null);
  show.render(renderer);
  gl.finish();
}

function runCleanups(j) {
  for (const f of j.cleanups.splice(0).reverse())
    try {
      f();
    } catch (e) {}
}
async function makePicture(j) {
  const bed = bedM(),
    pillows = !bed.kind && !!document.getElementById('pillows')?.checked;
  const points = await settleQuilt(j, bed, pillows);
  check(j);
  j.setStage('preparing');
  const { scene, camera } = await buildScene(j, bed, pillows, points),
    newCanvas = () => {
      const c = document.createElement('canvas');
      c.width = WIDTH;
      c.height = HEIGHT;
      return c;
    };
  await breather(j)();
  let canvas = newCanvas();
  const usePath = look.engine === 'path' || (look.engine === 'auto' && !ptBroken);
  try {
    if (!usePath) throw new Error('the fast raster renderer is in use on this graphics card');
    await renderPathTraced(j, canvas, scene, camera);
  } catch (e) {
    if (e instanceof Stopped) throw e;
    // the renderer that works on any card, with the outdoor light it needs: it can't follow light round the room
    console.warn('The realistic picture falls back to the fast renderer:', e?.message);
    canvas = newCanvas();
    scene.environment = await loadHdri('soft');
    scene.environmentIntensity = 0.5;
    check(j);
    await renderRaster(j, canvas, scene, camera);
  }
  check(j);
  const blob = await new Promise(done => canvas.toBlob(done, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('the picture could not be saved');
  await pictures.put(j.sig, blob, { width: WIDTH, height: HEIGHT });
}

/**
 * Starts making the picture of this quilt, unless one is already being made.
 * @param {any} design @returns {boolean} whether it started
 */
function startPicture(design) {
  if (job || !canMakePictures()) return false;
  const j = new Job(design);
  job = j;
  tell({ type: 'change' });
  makePicture(j)
    .then(() => {
      job = null;
      runCleanups(j);
      tell({ type: 'done', sig: j.sig });
    })
    .catch(e => {
      job = null;
      runCleanups(j);
      if (e instanceof Stopped) tell({ type: 'stopped', sig: j.sig });
      else {
        console.error('The realistic picture failed:', e);
        tell({ type: 'failed', sig: j.sig, why: e?.message || t('Something went wrong.') });
      }
    });
  return true;
}
/** Stops the picture being made. */
function stopPicture() {
  if (!job) return;
  job.stopped = true;
  runCleanups(job);
}

export { canMakePictures, onPicture, pictureJob, startPicture, stopPicture };
