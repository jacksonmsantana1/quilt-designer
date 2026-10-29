// Camera orbit, views and pointer interaction in the 3D view.
import './quilt-mesh.js'; // load order: runs after sim/quilt-mesh
import * as THREE from 'three';
import { shared } from '../core/shared.js';
import { N, state } from './config.js';
import { send } from './worker-link.js';
import { camera, canvas, renderer } from './renderer.js';
import { quiltBot, quiltTop } from './quilt-mesh.js';
import { pathTracer, raster, resetRaster } from './photo-render.js';

// ------------------------------------------------------------- camera
const target = new THREE.Vector3(0, 0.5, 0.15);
const orbit = { r: 4.3, az: 0.72, el: 0.38 };
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 50);
shared.activeCam = camera;
function placeCamera(keepRender) {
  for (const cam of [camera, ortho]) {
    cam.position.set(
      target.x + orbit.r * Math.cos(orbit.el) * Math.sin(orbit.az),
      target.y + orbit.r * Math.sin(orbit.el),
      target.z + orbit.r * Math.cos(orbit.el) * Math.cos(orbit.az),
    );
    cam.lookAt(target);
  }
  const hh = orbit.r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  ortho.top = hh;
  ortho.bottom = -hh;
  ortho.left = -hh * camera.aspect;
  ortho.right = hh * camera.aspect;
  ortho.updateProjectionMatrix();
  camera.focusDistance = orbit.r;
  if (keepRender) return;
  if (pathTracer && state.view === 'render' && !raster.active) pathTracer.updateCamera();
  resetRaster();
}
const VIEWS = {
  iso: { az: 0.72, el: 0.38 },
  foot: { az: 0, el: 0.08 },
  side: { az: Math.PI / 2, el: 0.08 },
  top: { az: 0, el: 1.55 },
};
let camTween = null;
function goView(name) {
  const v = VIEWS[name],
    TAU = 2 * Math.PI;
  const daz = ((((v.az - orbit.az) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  camTween = { t: 0, az0: orbit.az, el0: orbit.el, daz, del: v.el - orbit.el };
}
function stepCamera(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / 0.7);
  const u = 0.5 - 0.5 * Math.cos(Math.PI * camTween.t);
  orbit.az = camTween.az0 + camTween.daz * u;
  orbit.el = camTween.el0 + camTween.del * u;
  placeCamera();
  if (camTween.t >= 1) camTween = null;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map();
let drag = null,
  pinchD = 0;
shared.grabMsg = null;
function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, shared.activeCam);
}
function pickQuilt(e) {
  if (!shared.havePos || state.view === 'render') return null;
  setNdc(e);
  const hit = ray.intersectObjects([quiltTop, quiltBot], false)[0];
  if (!hit || !hit.uv) return null;
  const i = Math.round(hit.uv.x * (N - 1)),
    j = Math.round((1 - hit.uv.y) * (N - 1));
  return { i: j * N + i, point: hit.point.clone() };
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drag = null;
    const [a, b] = [...pointers.values()];
    pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    return;
  }
  if (state.mode === 'grab') {
    const p = pickQuilt(e);
    if (p) {
      const n = new THREE.Vector3();
      shared.activeCam.getWorldDirection(n);
      drag = { kind: 'grab', i: p.i, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), p.point) };
      shared.grabMsg = { type: 'grab', i: p.i, target: p.point.toArray() };
      canvas.classList.add('grabbing');
      return;
    }
  }
  drag = { kind: 'orbit', x: e.clientX, y: e.clientY };
  camTween = null;
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()],
      d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD) orbit.r = Math.min(9, Math.max(1.8, (orbit.r * pinchD) / d));
    pinchD = d;
    placeCamera();
    return;
  }
  if (!drag) {
    if (state.mode === 'grab' && e.pointerType === 'mouse') canvas.classList.toggle('can-grab', !!pickQuilt(e));
    return;
  }
  if (drag.kind === 'orbit') {
    orbit.az -= (e.clientX - drag.x) * 0.006;
    orbit.el = Math.min(1.55, Math.max(0.04, orbit.el + (e.clientY - drag.y) * 0.005));
    drag.x = e.clientX;
    drag.y = e.clientY;
    placeCamera();
  } else {
    setNdc(e);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(drag.plane, p)) {
      p.y = Math.max(0.03, p.y);
      shared.grabMsg = { type: 'grab', i: drag.i, target: p.toArray() };
    }
  }
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchD = 0;
  if (drag && drag.kind === 'grab') {
    shared.grabMsg = null;
    send({ type: 'grab', i: null });
  }
  drag = null;
  canvas.classList.remove('grabbing');
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    orbit.r = Math.min(9, Math.max(1.8, orbit.r * Math.exp(e.deltaY * 0.0012)));
    placeCamera();
  },
  { passive: false },
);

function resize() {
  const r = canvas.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return; // the 3D view is hidden (another page): keep its size and buffers
  const w = Math.max(1, Math.round(r.width)),
    h = Math.max(1, Math.round(r.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 52 : 38;
  orbit.r = w / h < 1.2 ? 5.0 : 4.3;
  camera.updateProjectionMatrix();
  placeCamera();
}
new ResizeObserver(resize).observe(canvas);

export { goView, orbit, ortho, placeCamera, resize, stepCamera, target };
