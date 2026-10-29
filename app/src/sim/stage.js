// Bedroom and photo-studio stages, and the bed or table built from the physics colliders.
import './textures.js'; // load order: runs after sim/textures
import * as THREE from 'three';
import { WOOD_PARTS, bedM } from './config.js';
import { scene } from './renderer.js';
import { M } from './textures.js';

// ------------------------------------------------------------- stages
function roundedBoxGeometry(h, r, segFlat = 6, segRound = 6) {
  const n = segFlat + 2 * segRound;
  const geo = new THREE.BoxGeometry(2 * h[0], 2 * h[1], 2 * h[2], n, n, n);
  const p = geo.attributes.position;
  const remap = (u, hh) => {
    const f = ((u + hh) / (2 * hh)) * n;
    if (f <= segRound) return -hh + r * (f / segRound);
    if (f >= n - segRound) return hh - r * ((n - f) / segRound);
    return -hh + r + (2 * hh - 2 * r) * ((f - segRound) / segFlat);
  };
  for (let i = 0; i < p.count; i++) {
    const x = remap(p.getX(i), h[0]),
      y = remap(p.getY(i), h[1]),
      z = remap(p.getZ(i), h[2]);
    const ix = Math.max(-h[0] + r, Math.min(h[0] - r, x));
    const iy = Math.max(-h[1] + r, Math.min(h[1] - r, y));
    const iz = Math.max(-h[2] + r, Math.min(h[2] - r, z));
    const dx = x - ix,
      dy = y - iy,
      dz = z - iz,
      l = Math.hypot(dx, dy, dz) || 1;
    p.setXYZ(i, ix + (dx / l) * r, iy + (dy / l) * r, iz + (dz / l) * r);
  }
  geo.computeVertexNormals();
  return geo;
}

const bedroom = new THREE.Group();
scene.add(bedroom);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), M.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
bedroom.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), M.wall);
wall.position.set(0, 2, -1.125);
wall.receiveShadow = true;
bedroom.add(wall);
const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), M.wall);
wall2.position.set(-2.6, 2, 0);
wall2.rotation.y = Math.PI / 2;
wall2.receiveShadow = true;
bedroom.add(wall2);
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), M.rug);
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.004, 1.25);
rug.receiveShadow = true;
bedroom.add(rug);
// Window: a bright panel in the side wall that is also the room's main light.
const windowLight = new THREE.RectAreaLight(0xfff3e4, 7, 1.3, 1.5);
windowLight.position.set(-2.57, 1.45, 0.35);
windowLight.lookAt(0, 1.0, 0.35);
bedroom.add(windowLight);
const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshBasicMaterial({ color: 0xfff6ea }));
windowPane.position.copy(windowLight.position).add(new THREE.Vector3(-0.015, 0, 0));
windowPane.rotation.y = Math.PI / 2;
bedroom.add(windowPane);
const frameMat = new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.6 });
for (const [w, h, y, z] of [
  [0.06, 1.62, 1.45, 0.35 - 0.68],
  [0.06, 1.62, 1.45, 0.35 + 0.68],
]) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameMat);
  f.position.set(-2.57, y, z);
  bedroom.add(f);
}
for (const y of [1.45 - 0.78, 1.45 + 0.78]) {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.42), frameMat);
  f.position.set(-2.56, y, 0.35);
  bedroom.add(f);
}

// Studio: a seamless cyclorama sweep, as used for product photography.
const studio = new THREE.Group();
studio.visible = false;
scene.add(studio);
{
  const pts = [];
  const zFront = 5,
    zBack = -2.4,
    rad = 1.4,
    top = 5;
  pts.push([zFront, 0]);
  for (let k = 0; k <= 16; k++) {
    const a = ((k / 16) * Math.PI) / 2;
    pts.push([zBack + rad - rad * Math.sin(a), rad - rad * Math.cos(a)]);
  }
  pts.push([zBack, top]);
  const w = 14,
    pos = [],
    idx = [];
  pts.forEach(([z, y]) => {
    pos.push(-w / 2, y, z, w / 2, y, z);
  });
  for (let k = 0; k < pts.length - 1; k++) {
    const a = 2 * k;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const cyc = new THREE.Mesh(g, M.cyc);
  cyc.receiveShadow = true;
  studio.add(cyc);
}
const softbox = new THREE.RectAreaLight(0xffffff, 13, 2.2, 1.6);
softbox.position.set(1.6, 2.9, 2.2);
softbox.lookAt(0, 0.5, 0.1);
studio.add(softbox);
const rimbox = new THREE.RectAreaLight(0xe9f0ff, 4, 1.6, 1.2);
rimbox.position.set(-2.4, 2.2, -0.6);
rimbox.lookAt(0, 0.6, 0.2);
studio.add(rimbox);

// Bed, built from exactly the colliders the physics uses, for the chosen mattress size.
const colliderMeshes = {};
const legs = [];
function buildBedMeshes() {
  for (const m of [...Object.values(colliderMeshes), ...legs]) {
    scene.remove(m);
    m.geometry.dispose();
  }
  legs.length = 0;
  const bed = bedM();
  for (const b of ClothSim.bedColliders(bed)) {
    const isWood = WOOD_PARTS(b.name);
    const mesh = new THREE.Mesh(
      roundedBoxGeometry(b.h, b.r, isWood ? 4 : 8, isWood ? 3 : 7),
      isWood ? M.wood : b.name === 'mattress' ? M.sheet : M.pillow,
    );
    mesh.position.set(...b.c);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.dup = !!b.dup;
    if (b.dup) mesh.visible = false;
    scene.add(mesh);
    colliderMeshes[b.name] = mesh;
  }
  if (bed.kind !== 'table')
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), M.wood);
        leg.position.set((sx * bed.w) / 2, 0.05, sz * (bed.l / 2 - 0.015));
        leg.castShadow = true;
        scene.add(leg);
        legs.push(leg);
      }
}
buildBedMeshes();

export { bedroom, buildBedMeshes, colliderMeshes, legs, roundedBoxGeometry, studio };
