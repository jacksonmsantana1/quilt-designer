// The bedroom of the realistic picture: a closed room lit only through its window, with curtains, furniture and art.
// Everything is drawn by code, so the app needs no model files. It is built around the bed, table or couch in use, and
// only when a picture is asked for: the live preview has its own simple rooms (sim/stage.js).
import './quilt-hero.js'; // load order: runs after sim/quilt-hero
import * as THREE from 'three';
import { N, WOOD_PARTS } from './config.js';
import { maxAniso } from './textures.js';
import { roundedBoxGeometry } from './stage.js';

const ROOM_HEIGHT = 2.7,
  // the window, in the left-hand wall: its size and how high its sill is
  WINDOW_W = 1.9,
  WINDOW_H = 1.8,
  SILL = 0.55,
  WALL_DEPTH = 0.2;
// the sun: its direction into the room, its distance, its size (a small lamp far away gives soft-edged sunlight)
const SUN_DIR = new THREE.Vector3(0.78, -0.55, 0.3).normalize(),
  SUN_FAR = 5,
  SUN_SIZE = 0.15;

/** The room's materials, ready after prepareRoom(). @type {Record<string, any>} */
const mats = {};

// ---- pictures drawn once: the rug, the painting and the leaves of the plant
function drawnTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
// a plain wool rug with a quiet border and lattice, so that it doesn't argue with the quilt
function drawRug(g, w, h) {
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#b9b0a0';
  g.fillRect(0, 0, w, h);
  const line = (a, lw, colour) => {
    g.strokeStyle = colour;
    g.lineWidth = lw;
    g.strokeRect(a, a, w - 2 * a, h - 2 * a);
  };
  line(26, 22, '#8f8674');
  line(58, 6, '#d6cfc0');
  g.save();
  g.beginPath();
  g.rect(70, 70, w - 140, h - 140);
  g.clip();
  g.strokeStyle = 'rgba(232,226,212,.42)';
  g.lineWidth = 4;
  for (let t = -h; t < w + h; t += 118) {
    g.beginPath();
    g.moveTo(t, 0);
    g.lineTo(t + h, h);
    g.moveTo(t, h);
    g.lineTo(t + h, 0);
    g.stroke();
  }
  g.restore();
  // the wool's own unevenness
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '60,52,40' : '245,240,228'},${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 9, 1 + rnd() * 3);
  }
}
// a quiet watercolour of hills
function drawPainting(g, w, h) {
  let seed = 77;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#d9dfdc');
  sky.addColorStop(0.55, '#efe6d6');
  sky.addColorStop(1, '#e6d7bf');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const hills = ['#b9c2b6', '#98a697', '#7f8f7c', '#66745f', '#535c49'];
  hills.forEach((colour, k) => {
    const base = h * (0.42 + k * 0.11),
      a = 18 + rnd() * 26,
      f = 0.004 + rnd() * 0.005,
      ph = rnd() * 6.28;
    g.fillStyle = colour;
    g.globalAlpha = 0.86;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 6)
      g.lineTo(x, base + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.7 + ph * 2) * a * 0.35 + rnd() * 1.6);
    g.lineTo(w, h);
    g.fill();
  });
  g.globalAlpha = 1;
  // the grain of the paper
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '70,66,55' : '255,252,244'},${rnd() * 0.05})`;
    g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
  }
}
// a snake plant's leaf: dark green with paler cross-bands and a yellow edge
function drawLeaf(g, w, h) {
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#2c4a33';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 9 + rnd() * 18) {
    g.fillStyle = `rgba(150,176,132,${0.18 + rnd() * 0.3})`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 12) g.lineTo(x, y + Math.sin(x * 0.11 + y) * 5 + rnd() * 3);
    g.lineTo(w, y + 7);
    g.lineTo(0, y + 7);
    g.fill();
  }
  g.fillStyle = '#b7ad5b';
  g.fillRect(0, 0, w * 0.07, h);
  g.fillRect(w * 0.93, 0, w * 0.07, h);
}
// a bright garden, far out of focus: pale sky above soft masses of leaves
function drawView(g, w, h) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f4f8fb');
  sky.addColorStop(0.5, '#eef4f4');
  sky.addColorStop(1, '#dfe9d8');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w,
      y = h * (0.34 + rnd() * 0.66),
      r = 14 + rnd() * 36,
      blob = g.createRadialGradient(x, y, 0, x, y, r);
    const colour = rnd() < 0.5 ? '186,204,176' : '212,224,202';
    blob.addColorStop(0, `rgba(${colour},.55)`);
    blob.addColorStop(1, `rgba(${colour},0)`);
    g.fillStyle = blob;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
// The photographed surfaces. Every use of a photo shares its one copy: the path tracer keeps one image per photo.
const loader = new THREE.TextureLoader();
/** @type {Map<string, Promise<THREE.Texture>>} */
const photos = new Map();
async function photo(url, repeat, srgb = true) {
  if (!photos.has(url)) photos.set(url, loader.loadAsync(url));
  const t = (await photos.get(url)).clone();
  t.needsUpdate = true;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}
const weaveColour = repeat => photo('assets/fabric/weave.jpg', repeat);
const weaveRelief = repeat => photo('assets/weave_normal.jpg', repeat, false);
const woodMaps = async repeat => ({
  map: await photo('assets/wood_color.jpg', repeat),
  roughnessMap: await photo('assets/wood_rough.jpg', repeat, false),
  normalMap: await photo('assets/wood_normal.jpg', repeat, false),
});
/** @type {Promise<void> | null} */
let preparing = null;
/** Loads and draws what the room is made of (once). */
function prepareRoom() {
  return (preparing ??= (async () => {
    const standard = o => new THREE.MeshStandardMaterial(o),
      physical = o => new THREE.MeshPhysicalMaterial(o),
      faint = new THREE.Vector2(0.2, 0.2);
    Object.assign(mats, {
      wall: standard({ color: 0xe6e1d7, roughness: 0.96 }),
      headWall: standard({ color: 0xb9b6a8, roughness: 0.94 }),
      ceiling: standard({ color: 0xf2efe9, roughness: 0.95 }),
      trim: standard({ color: 0xf0ede6, roughness: 0.42 }),
      metal: standard({ color: 0x2c2a27, roughness: 0.45, metalness: 0.85 }),
      brass: standard({ color: 0xb08d57, roughness: 0.35, metalness: 0.95 }),
      ceramic: physical({ color: 0xcfc8b8, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      pot: standard({ color: 0xe4dfd5, roughness: 0.7 }),
      soil: standard({ color: 0x2a211a, roughness: 1 }),
      floor: physical({
        ...(await woodMaps([14 / 1.68, 14 / 0.84])),
        color: 0xb3a899, // cools and deepens the photographed oak
        roughness: 1,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        normalScale: new THREE.Vector2(0.6, 0.6),
      }),
      // the boxes of the bed and furniture have texture coordinates in metres, so these repeat per metre
      wood: physical({
        ...(await woodMaps([1 / 1.68, 1 / 0.84])),
        color: 0x6e5140,
        roughness: 1,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
      }),
      sheet: physical({
        map: await weaveColour([4, 4]),
        normalMap: await weaveRelief([4, 4]),
        color: 0xf1efe9,
        roughness: 0.95,
        sheen: 1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0.35, 0.35, 0.35),
      }),
      couch: physical({
        map: await weaveColour([5, 5]),
        normalMap: await weaveRelief([5, 5]),
        color: 0x9a948b,
        roughness: 0.97,
        sheen: 1,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0.3, 0.29, 0.27),
      }),
      // (the lampshade and the pillows take only the weave's relief: its photo is too blotchy for a plain pale cloth)
      shade: physical({
        normalMap: await weaveRelief([9, 3]),
        normalScale: faint,
        color: 0xf1eadb,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
      curtain: physical({
        map: await weaveColour([7, 12]),
        normalMap: await weaveRelief([7, 12]),
        color: 0xd9cfbd,
        roughness: 0.96,
        sheen: 1,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0.2, 0.19, 0.17),
        side: THREE.DoubleSide,
      }),
      pillow: physical({
        normalMap: await weaveRelief([5, 4]),
        normalScale: faint,
        color: 0xf3efe6,
        roughness: 0.93,
        sheen: 1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(0.22, 0.22, 0.21),
      }),
      view: standard({
        color: 0x000000,
        emissive: 0xffffff,
        emissiveMap: drawnTexture(1024, 376, drawView),
        emissiveIntensity: 2.2,
      }),
      rug: physical({
        map: drawnTexture(1024, 1024, drawRug),
        normalMap: await weaveRelief([24, 24]),
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: 1,
        sheen: 1,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0.2, 0.19, 0.17),
      }),
      painting: standard({ map: drawnTexture(1024, 640, drawPainting), roughness: 0.82 }),
      leaf: standard({ map: drawnTexture(128, 1024, drawLeaf), roughness: 0.42, side: THREE.DoubleSide }),
    });
  })());
}

// ---- shapes
/** A rounded box whose texture coordinates are in metres on every face (in the box's order: ±x, ±y, ±z). */
function metreBox(h, r, segFlat, segRound) {
  const geo = roundedBoxGeometry(h, r, segFlat, segRound),
    p = geo.attributes.position,
    uv = geo.attributes.uv,
    n = segFlat + 2 * segRound,
    perFace = (n + 1) * (n + 1);
  for (let i = 0; i < p.count; i++) {
    const face = Math.floor(i / perFace);
    if (face < 2) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (face < 4) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}
/** A curtain hanging straight, gathered into folds: width along x, height down from y = 0, folds deeper at the hem. */
function curtainGeometry(width, height, folds, seed) {
  const nu = 150,
    nv = 26,
    pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu,
        wander = 0.5 * Math.sin(u * 13 + seed) + 0.3 * Math.sin(u * 29 + seed * 2.3 + v * 1.4),
        depth = 0.028 + 0.03 * v;
      pos.push(
        (u - 0.5) * width * (0.94 + 0.06 * v),
        -v * height,
        Math.sin(u * folds * Math.PI * 2 + wander * (0.4 + v)) * depth + wander * 0.012,
      );
      uv.push(u, 1 - v);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i,
        b = a + 1,
        d = a + nu + 1,
        c = d + 1;
      idx.push(a, d, b, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A pillow: two puffed faces sewn at the edge, the edges pulled in between the corners, with a few soft dents. */
function pillowGeometry(w, h, thick, seed) {
  const n = 40,
    pos = [],
    uv = [],
    idx = [];
  for (const face of [1, -1]) {
    const first = pos.length / 3;
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * 2 - 1,
          b = (j / n) * 2 - 1,
          puff = Math.sqrt(Math.max(0, (1 - a * a * a * a) * (1 - b * b * b * b))),
          dents = 1 + 0.08 * Math.sin(a * 3.1 + seed) * Math.cos(b * 2.3 - seed) + 0.04 * Math.sin((a + b) * 7 + seed),
          pull = 0.075;
        pos.push(
          a * (w / 2) * (1 - pull * (1 - b * b)),
          b * (h / 2) * (1 - pull * (1 - a * a)),
          face * puff * (thick / 2) * dents,
        );
        uv.push(i / n, j / n);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const p = first + j * (n + 1) + i,
          q = p + 1,
          s = p + n + 1,
          r = s + 1;
        if (face > 0) idx.push(p, q, r, p, r, s);
        else idx.push(p, r, q, p, s, r);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** One sword-shaped leaf of a snake plant, rising from the origin. */
function leafGeometry(height, width, lean, twist) {
  const nu = 4,
    nv = 22,
    pos = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv,
      half = (width / 2) * Math.min(1, 0.55 + v * 2.5) * Math.pow(Math.max(0, 1 - Math.pow(v, 5)), 0.6),
      turn = twist * v,
      bend = lean * v * v;
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1,
        across = u * half,
        cup = (1 - u * u) * half * 0.22;
      pos.push(
        across * Math.cos(turn) + cup * Math.sin(turn),
        v * height,
        bend + across * Math.sin(turn) - cup * Math.cos(turn),
      );
      uv.push(i / nu, v);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i,
        b = a + 1,
        d = a + nu + 1,
        c = d + 1;
      idx.push(a, b, c, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const lathe = (points, segments = 40) =>
  new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );

// ---- the room
const bedroom = new THREE.Group();
let roomSun = null,
  bedPillows = [];

function add(parent, geometry, material, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (parent, material, w, h, d, x, y, z) => add(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);

function buildWindow(left, zc) {
  const top = SILL + WINDOW_H,
    z0 = zc - WINDOW_W / 2,
    z1 = zc + WINDOW_W / 2,
    x = left - WALL_DEPTH;
  // the sides of the opening, through the thickness of the wall
  for (const [w, h, y, z] of [
    [0.02, WINDOW_H + 0.04, SILL + WINDOW_H / 2, z0 - 0.01],
    [0.02, WINDOW_H + 0.04, SILL + WINDOW_H / 2, z1 + 0.01],
    [WINDOW_W, 0.02, top + 0.01, zc],
  ])
    box(bedroom, mats.wall, WALL_DEPTH, h, w, left - WALL_DEPTH / 2, y, z);
  // the sill, standing a little proud of the wall
  box(bedroom, mats.trim, WALL_DEPTH + 0.05, 0.035, WINDOW_W + 0.1, left - WALL_DEPTH / 2 + 0.025, SILL - 0.015, zc);
  // the frame and its glazing bars
  const bar = 0.05;
  for (const z of [z0 + bar / 2, zc, z1 - bar / 2])
    box(bedroom, mats.trim, 0.05, WINDOW_H, bar, x + 0.03, SILL + WINDOW_H / 2, z);
  for (const y of [SILL + bar / 2, top - bar / 2, SILL + WINDOW_H * 0.68])
    box(bedroom, mats.trim, 0.05, bar, WINDOW_W, x + 0.03, y, zc);
  // daylight from the sky fills the opening
  const sky = new THREE.RectAreaLight(0xe9f0fb, 15, WINDOW_W, WINDOW_H);
  sky.position.set(x - 0.02, SILL + WINDOW_H / 2, zc);
  sky.lookAt(left + 1, SILL + WINDOW_H / 2, zc);
  bedroom.add(sky);
  // the bright, out-of-focus garden seen through the glass (the path tracer doesn't draw lights themselves).
  // It stands further away than the sun, so that it doesn't shade the room from it
  const view = add(bedroom, new THREE.PlaneGeometry(30, 11), mats.view, left - SUN_FAR - 2, -0.5, zc, false);
  view.rotation.y = Math.PI / 2;
  // the sun, low enough to come in through the window and lie across the bed. The path tracer only: nothing else can
  // stop this kind of light at the walls
  roomSun = new THREE.RectAreaLight(0xffe6c6, 4500, SUN_SIZE, SUN_SIZE);
  const through = new THREE.Vector3(left, SILL + WINDOW_H * 0.62, zc);
  roomSun.position.copy(through).addScaledVector(SUN_DIR, -SUN_FAR);
  roomSun.lookAt(through);
  bedroom.add(roomSun);
  // curtains drawn back to either side, on a dark rod
  const rodY = top + 0.14,
    rodX = left + 0.1,
    span = WINDOW_W + 0.9;
  add(bedroom, new THREE.CylinderGeometry(0.012, 0.012, span, 16), mats.metal, rodX, rodY, zc).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    add(bedroom, new THREE.SphereGeometry(0.024, 16, 12), mats.metal, rodX, rodY, zc + (s * span) / 2);
    box(bedroom, mats.metal, 0.1, 0.02, 0.02, left + 0.05, rodY, zc + s * (span / 2 - 0.1));
    const c = add(
      bedroom,
      curtainGeometry(0.62, rodY - 0.015, 6, 1.7 + s),
      mats.curtain,
      rodX,
      rodY - 0.005,
      zc + s * (WINDOW_W / 2 + 0.08),
    );
    c.rotation.y = Math.PI / 2;
  }
}

function buildNightstand(x, z, withLamp) {
  const stand = new THREE.Group();
  stand.position.set(x, 0, z);
  bedroom.add(stand);
  add(stand, metreBox([0.25, 0.2, 0.2], 0.008, 2, 2), mats.wood, 0, 0.42, 0);
  add(stand, metreBox([0.222, 0.075, 0.008], 0.003, 2, 2), mats.wood, 0, 0.51, 0.2);
  add(stand, metreBox([0.222, 0.075, 0.008], 0.003, 2, 2), mats.wood, 0, 0.34, 0.2);
  for (const y of [0.51, 0.34]) add(stand, new THREE.SphereGeometry(0.012, 16, 12), mats.brass, 0, y, 0.218);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg = add(stand, new THREE.CylinderGeometry(0.016, 0.009, 0.22, 12), mats.wood, sx * 0.21, 0.11, sz * 0.16);
      leg.rotation.set(sz * 0.06, 0, -sx * 0.06);
    }
  if (withLamp) {
    // a table lamp, switched off: it is daytime
    add(
      stand,
      lathe([
        [0.001, 0.62],
        [0.062, 0.62],
        [0.08, 0.66],
        [0.094, 0.72],
        [0.082, 0.79],
        [0.05, 0.85],
        [0.022, 0.89],
        [0.016, 0.93],
      ]),
      mats.ceramic,
    );
    add(stand, new THREE.CylinderGeometry(0.006, 0.006, 0.1, 10), mats.brass, 0, 0.97, 0);
    add(
      stand,
      lathe([
        [0.155, 0.93],
        [0.1, 1.15],
      ]),
      mats.shade,
    );
  } else {
    // a few books and a small bowl
    const covers = [0x6e7a6a, 0xb5a78d, 0x7a5a4d];
    covers.forEach((colour, k) => {
      const book = add(
        stand,
        roundedBoxGeometry([0.095 - k * 0.008, 0.0125, 0.13 - k * 0.01], 0.003, 2, 2),
        new THREE.MeshStandardMaterial({ color: colour, roughness: 0.72 }),
        -0.04,
        0.634 + k * 0.026,
        0.02,
      );
      book.rotation.y = 0.14 - k * 0.2;
    });
    add(
      stand,
      lathe([
        [0.001, 0.62],
        [0.03, 0.62],
        [0.055, 0.645],
        [0.062, 0.675],
        [0.056, 0.675],
        [0.048, 0.65],
        [0.001, 0.632],
      ]),
      mats.ceramic,
      0.14,
      0,
      -0.05,
    );
  }
}

function buildPlant(x, z) {
  const plant = new THREE.Group();
  plant.position.set(x, 0, z);
  bedroom.add(plant);
  add(
    plant,
    lathe([
      [0.001, 0.005],
      [0.13, 0.005],
      [0.16, 0.2],
      [0.175, 0.36],
      [0.165, 0.36],
      [0.15, 0.2],
      [0.001, 0.33],
    ]),
    mats.pot,
  );
  add(plant, new THREE.CylinderGeometry(0.163, 0.163, 0.01, 32), mats.soil, 0, 0.335, 0);
  let seed = 19;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 15; k++) {
    const a = k * 2.399,
      r = 0.03 + (k / 15) * 0.1,
      tall = 1 - (k / 15) * 0.45,
      leaf = add(
        plant,
        leafGeometry(
          (0.55 + rnd() * 0.3) * tall + 0.25,
          0.07 + rnd() * 0.02,
          0.05 + (k / 15) * 0.2,
          rnd() * 1.1 - 0.55,
        ),
        mats.leaf,
        Math.cos(a) * r,
        0.33,
        Math.sin(a) * r,
      );
    leaf.rotation.y = -a + Math.PI / 2;
  }
}

function buildArt(y, z, width) {
  const h = width * 0.625,
    art = new THREE.Group();
  art.position.set(0, y, z);
  bedroom.add(art);
  const wood = 0.022;
  for (const s of [-1, 1]) {
    box(art, mats.wood, width + 2 * wood, wood, 0.028, 0, (s * (h + wood)) / 2, 0.014);
    box(art, mats.wood, wood, h, 0.028, (s * (width + wood)) / 2, 0, 0.014);
  }
  box(art, mats.trim, width, h, 0.006, 0, 0, 0.003);
  add(art, new THREE.PlaneGeometry(width * 0.74, h * 0.72), mats.painting, 0, 0, 0.0075, false);
}

// The bed, table or couch, from exactly the colliders the physics uses.
function buildFurnitureToDrape(bed, pillowsUnder) {
  for (const b of ClothSim.bedColliders(bed)) {
    if (b.dup || (b.name.startsWith('pillow') && !pillowsUnder)) continue;
    const isWood = WOOD_PARTS(b.name),
      material = isWood
        ? mats.wood
        : b.name === 'mattress'
          ? mats.sheet
          : b.name.startsWith('couch')
            ? mats.couch
            : mats.pillow;
    add(bedroom, metreBox(b.h, b.r, isWood ? 4 : 8, isWood ? 3 : 7), material, ...b.c);
  }
  if (bed.kind) return;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      box(bedroom, mats.wood, 0.07, 0.1, 0.07, (sx * bed.w) / 2, 0.05, sz * (bed.l / 2 - 0.015));
}

/**
 * Clears and rebuilds the room around a bed, table or couch (after prepareRoom()).
 * @param {{ w: number, l: number, kind?: string }} bed sizes in m, as bedM() gives them
 * @param {boolean} pillowsUnder the pillows the quilt lies over, if the person has them on
 */
function buildBedroom(bed, pillowsUnder) {
  clearBedroom();
  const W = bed.w / 2,
    L = bed.l / 2,
    onBed = !bed.kind,
    back = -L - (onBed || bed.kind === 'couch' ? 0.12 : 1.1),
    left = -Math.max(2.5, W + 1.05),
    right = Math.max(2.4, W + 1.0),
    front = back + Math.max(5.5, 2 * L + 3.2),
    zc = Math.max(back + WINDOW_W / 2 + 0.75, 0.1),
    deep = front - back,
    wide = right - left;
  buildFurnitureToDrape(bed, pillowsUnder);
  // floor: it starts at the window wall, so there are no floorboards in the garden
  const floor = add(bedroom, new THREE.PlaneGeometry(14, 14), mats.floor, left + 7, 0, back + 7, false);
  floor.rotation.x = -Math.PI / 2;
  // walls and ceiling face inwards: from outside the room a camera looks straight through them, as a photographer
  // would through a wall taken out of a film set, while inside they stop the light like any wall
  const backWall = add(
    bedroom,
    new THREE.PlaneGeometry(wide, ROOM_HEIGHT),
    mats.headWall,
    (left + right) / 2,
    ROOM_HEIGHT / 2,
    back,
    false,
  );
  backWall.name = 'head wall';
  add(
    bedroom,
    new THREE.PlaneGeometry(wide, ROOM_HEIGHT),
    mats.wall,
    (left + right) / 2,
    ROOM_HEIGHT / 2,
    front,
    false,
  ).rotation.y = Math.PI;
  add(
    bedroom,
    new THREE.PlaneGeometry(deep, ROOM_HEIGHT),
    mats.wall,
    right,
    ROOM_HEIGHT / 2,
    (back + front) / 2,
    false,
  ).rotation.y = -Math.PI / 2;
  const ceiling = add(
    bedroom,
    new THREE.PlaneGeometry(wide, deep),
    mats.ceiling,
    (left + right) / 2,
    ROOM_HEIGHT,
    (back + front) / 2,
    false,
  );
  ceiling.rotation.x = Math.PI / 2;
  // the window wall, with its opening cut out (drawn in the wall's own plane: x runs against the room's z)
  const outline = new THREE.Shape([
    new THREE.Vector2(-front, 0),
    new THREE.Vector2(-back, 0),
    new THREE.Vector2(-back, ROOM_HEIGHT),
    new THREE.Vector2(-front, ROOM_HEIGHT),
  ]);
  outline.holes.push(
    new THREE.Path([
      new THREE.Vector2(-zc - WINDOW_W / 2, SILL),
      new THREE.Vector2(-zc - WINDOW_W / 2, SILL + WINDOW_H),
      new THREE.Vector2(-zc + WINDOW_W / 2, SILL + WINDOW_H),
      new THREE.Vector2(-zc + WINDOW_W / 2, SILL),
    ]),
  );
  const leftWall = add(bedroom, new THREE.ShapeGeometry(outline), mats.wall, left, 0, 0, false);
  leftWall.rotation.y = Math.PI / 2;
  buildWindow(left, zc);
  // skirting boards, on the two walls in view (a box can't be looked through, like the walls the camera stands behind)
  const skirt = 0.11;
  box(bedroom, mats.trim, wide, skirt, 0.016, (left + right) / 2, skirt / 2, back + 0.008);
  box(bedroom, mats.trim, 0.016, skirt, deep, left + 0.008, skirt / 2, (back + front) / 2);
  // a rug under the foot of the bed
  const rugW = bed.w + 1.3,
    rugL = Math.min(bed.l + 0.9, 3.2),
    rugZ = onBed ? L + 0.6 - rugL / 2 : 0;
  box(bedroom, mats.rug, rugW, 0.012, rugL, 0, 0.006, rugZ);
  // the furniture
  if (onBed) {
    const beside = W + 0.06 + 0.3,
      standZ = back + 0.23;
    buildNightstand(beside, standZ, true);
    buildNightstand(-beside, standZ, false);
    buildArt(1.82, back, Math.min(1.25, bed.w * 0.8));
    bedPillows = [-1, 1].map(s => {
      const p = add(bedroom, pillowGeometry(Math.min(0.68, W * 0.9), 0.46, 0.17, 1.3 + s), mats.pillow);
      p.userData.side = s;
      p.visible = false;
      return p;
    });
  } else bedPillows = [];
  buildPlant(left + 0.42, back + 0.42);
}
/** Takes the room apart (the materials stay, for the next picture). */
function clearBedroom() {
  for (const m of bedroom.children.slice()) {
    bedroom.remove(m);
    m.traverse(o => o.geometry?.dispose());
  }
  bedPillows = [];
}

/**
 * Stands two pillows against the headboard, on the quilt as it lies.
 * @param {{ w: number, l: number }} bed @param {ArrayLike<number>} simPos the quilt's N × N points @param {boolean} wanted
 */
function dressBed(bed, simPos, wanted) {
  const single = bed.w < 1.2,
    z = -bed.l / 2 + 0.13;
  for (const p of bedPillows) {
    const x = single ? 0 : p.userData.side * Math.min(0.36, bed.w / 4);
    // the highest point of the quilt under the pillow (or the bed itself, when the quilt was dropped elsewhere)
    let y = 0.76;
    for (let k = 0; k < N * N; k++)
      if (Math.abs(simPos[3 * k] - x) < 0.2 && Math.abs(simPos[3 * k + 2] - z) < 0.12)
        y = Math.max(y, simPos[3 * k + 1]);
    p.position.set(x, y + 0.21, z);
    p.rotation.set(-0.3, p.userData.side * 0.05, p.userData.side * 0.03);
    p.visible = wanted && !(single && p.userData.side > 0);
  }
}
/** Sunlight through the window: for the path tracer only, which is the one that can stop light with the walls. */
function showRoomSun(on) {
  if (roomSun) roomSun.visible = on;
}

export { bedroom, buildBedroom, clearBedroom, dressBed, prepareRoom, showRoomSun };
