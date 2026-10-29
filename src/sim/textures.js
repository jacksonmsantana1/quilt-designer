// Texture loading and the shared materials of the 3D scene.
import './renderer.js';          // load order: runs after sim/renderer
import * as THREE from 'three';
import { state } from './config.js';
import { renderer } from './renderer.js';
import { pathTracer } from './photo-render.js';

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

export { M, loadImage, maxAniso, tex, weaveMap, weaveNormal };
