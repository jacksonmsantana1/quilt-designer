(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const N = 40;                       // simulation grid (N × N nodes)
  const R = 2 * (N - 1) + 1;          // render grid after 4-point subdivision
  const SIZE = 2.29;                  // 90-inch queen quilt, metres

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
    { key: 'thickness', label: 'Thickness', unit: 'mm', min: 0.002, max: 0.05, scale: 'lin', fmt: v => (v * 1000).toFixed(0), noUnitConv: true },
  ];
  const SUBSTEPS = [10, 20, 40];
  const state = {
    params: { ...PRESETS.cotton }, scenario: 'drop', dropHeight: 0.5, running: true,
    substeps: 20, mode: 'orbit', lastStats: null, history: []
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
      w.onerror = (e) => { e.preventDefault && e.preventDefault(); if (port === w) { port = localPort(); wire(); } };
      port = w;
    } catch (e) { port = localPort(); }
    wire();
  }
  function wire() {
    port.onmessage = onSim;
    port.postMessage({ type: 'init', opt: { n: N, scenario: state.scenario, params: state.params, substeps: state.substeps } });
    port.postMessage({ type: 'reset', scenario: state.scenario, dropHeight: state.dropHeight });
  }
  const send = m => port && port.postMessage(m);

  // ------------------------------------------------------------- three.js
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2622);
  const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.05, 50);

  const hemi = new THREE.HemisphereLight(0xfff3e2, 0x4b3f33, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.25);
  sun.position.set(2.6, 4.2, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9d6ff, 0.28);
  fill.position.set(-3, 2, -1);
  scene.add(fill);

  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function noisePattern(ctx, size, alpha, seed = 7) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size);
    let s = seed;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647; const v = s & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 * alpha;
    }
    g.putImageData(img, 0, 0);
    return ctx.createPattern(c, 'repeat');
  }

  // Floor: oak boards, 14 cm wide.
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const boards = 8, bw = w / boards;
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let b = 0; b < boards; b++) {
      let y = -r() * h;
      while (y < h) {
        const len = h * (0.45 + r() * 0.5);
        const l = 46 + r() * 10;
        g.fillStyle = `hsl(${28 + r() * 6}, ${38 + r() * 8}%, ${l}%)`;
        g.fillRect(b * bw, y, bw, len);
        g.strokeStyle = 'rgba(60,35,15,.18)';
        for (let k = 0; k < 9; k++) {
          g.beginPath(); const x = b * bw + r() * bw;
          g.moveTo(x, y); g.bezierCurveTo(x + 6, y + len * .3, x - 6, y + len * .6, x + 2, y + len); g.stroke();
        }
        g.fillStyle = 'rgba(40,22,10,.55)'; g.fillRect(b * bw, y, bw, 2);
        y += len;
      }
      g.fillStyle = 'rgba(40,22,10,.6)'; g.fillRect(b * bw, 0, 2, h);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10 / (8 * 0.14), 10 / (8 * 0.14) / 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wallMat);
  wall.position.set(0, 2, -1.125); wall.receiveShadow = true; scene.add(wall);
  const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), wallMat);
  wall2.position.set(-2.6, 2, 0); wall2.rotation.y = Math.PI / 2; wall2.receiveShadow = true; scene.add(wall2);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshStandardMaterial({
    map: canvasTex(512, 400, (g, w, h) => {
      g.fillStyle = '#6c7a72'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d8cfbf'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
      g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
      g.fillStyle = noisePattern(g, 64, 0.18); g.fillRect(0, 0, w, h);
    }), roughness: 1
  }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.003, 1.25); rug.receiveShadow = true; scene.add(rug);

  // Rounded-box meshes built from exactly the same parameters as the
  // physics colliders, so what you see is what the quilt collides with.
  function roundedBoxGeometry(h, r, segFlat = 6, segRound = 6) {
    const n = segFlat + 2 * segRound;
    const geo = new THREE.BoxGeometry(2 * h[0], 2 * h[1], 2 * h[2], n, n, n);
    const p = geo.attributes.position;
    const remap = (u, hh) => {
      const f = (u + hh) / (2 * hh) * n; // 0..n
      if (f <= segRound) return -hh + r * (f / segRound);
      if (f >= n - segRound) return hh - r * ((n - f) / segRound);
      return -hh + r + (2 * hh - 2 * r) * ((f - segRound) / segFlat);
    };
    for (let i = 0; i < p.count; i++) {
      const x = remap(p.getX(i), h[0]), y = remap(p.getY(i), h[1]), z = remap(p.getZ(i), h[2]);
      const ix = Math.max(-h[0] + r, Math.min(h[0] - r, x));
      const iy = Math.max(-h[1] + r, Math.min(h[1] - r, y));
      const iz = Math.max(-h[2] + r, Math.min(h[2] - r, z));
      let dx = x - ix, dy = y - iy, dz = z - iz;
      const l = Math.hypot(dx, dy, dz) || 1;
      p.setXYZ(i, ix + dx / l * r, iy + dy / l * r, iz + dz / l * r);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const woodTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5b3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${30 + (i % 5) * 8},${16 + (i % 3) * 6},8,${0.15 + (i % 4) * 0.05})`;
      g.lineWidth = 1 + (i % 3);
      g.beginPath(); const y = (i / 70) * h;
      g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 8, w * .6, y - 8, w, y + 3); g.stroke();
    }
  });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 });
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.92 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 });
  const colliderMeshes = {};
  for (const b of ClothSim.bedColliders()) {
    const isWood = b.name === 'frame' || b.name === 'headboard';
    const mesh = new THREE.Mesh(roundedBoxGeometry(b.h, b.r, isWood ? 4 : 8, isWood ? 3 : 7),
      isWood ? woodMat : b.name === 'mattress' ? sheetMat : pillowMat);
    mesh.position.set(...b.c);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); colliderMeshes[b.name] = mesh;
  }
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.07), woodMat);
    leg.position.set(sx * 0.76, 0.05, sz * 1.0); leg.castShadow = true; scene.add(leg); legs.push(leg);
  }

  // Quilt textures: 90-inch quilt, 8 × 8 Ohio Star blocks of 9 inches,
  // an 8¼-inch madder border and a ¾-inch indigo binding.
  const PX = 2048, IN = PX / 90;
  const C = { cream: '#efe4cc', indigo: '#28406c', madder: '#963226', ochre: '#c38f2f', bind: '#1d2843' };
  function quiltLayout(g, mode) {
    // mode 'color' draws fabric; mode 'bump' draws loft (light = puffed).
    const bump = mode === 'bump';
    const tri = (pts, fill) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = fill; g.fill(); };
    g.fillStyle = bump ? '#606060' : C.bind; g.fillRect(0, 0, PX, PX);
    const b0 = 0.75 * IN, b1 = 9 * IN;
    g.fillStyle = bump ? '#bdbdbd' : C.madder; g.fillRect(b0, b0, PX - 2 * b0, PX - 2 * b0);
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      const x0 = b1 + bx * 9 * IN, y0 = b1 + by * 9 * IN, u = 3 * IN;
      const alt = (bx + by) & 1;
      const bg = C.cream, star = alt ? C.madder : C.indigo, mid = alt ? C.indigo : C.ochre;
      if (bump) {
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const cx = x0 + (i + .5) * u, cy = y0 + (j + .5) * u;
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, u * 0.72);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#5a5a5a');
          g.fillStyle = gr; g.fillRect(x0 + i * u, y0 + j * u, u, u);
        }
        continue;
      }
      g.fillStyle = bg; g.fillRect(x0, y0, 9 * IN, 9 * IN);
      g.fillStyle = mid; g.fillRect(x0 + u, y0 + u, u, u);
      // Four quarter-square-triangle star points.
      const qst = (ux, uy, rot) => {
        const cx = ux + u / 2, cy = uy + u / 2;
        const corners = [[ux, uy], [ux + u, uy], [ux + u, uy + u], [ux, uy + u]];
        for (let k = 0; k < 4; k++) {
          const a = corners[k], b = corners[(k + 1) % 4];
          const isPoint = ((k + rot) & 1) === 1;
          tri([a, b, [cx, cy]], isPoint ? star : bg);
        }
      };
      qst(x0 + u, y0, 0); qst(x0 + u, y0 + 2 * u, 0);
      qst(x0, y0 + u, 1); qst(x0 + 2 * u, y0 + u, 1);
    }
    // Quilting stitches: in the ditch around every 3-inch unit, and a
    // diagonal crosshatch over the border.
    g.save();
    if (bump) { g.strokeStyle = '#000'; g.lineWidth = 7; g.filter = 'blur(5px)'; }
    else { g.strokeStyle = 'rgba(35,25,15,.28)'; g.lineWidth = 2; g.setLineDash([7, 6]); }
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const v = b1 + k * 3 * IN;
      g.moveTo(v, b1); g.lineTo(v, PX - b1); g.moveTo(b1, v); g.lineTo(PX - b1, v);
    }
    g.stroke();
    g.beginPath();
    g.rect(b0, b0, PX - 2 * b0, PX - 2 * b0);
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(b0, b0, PX - 2 * b0, PX - 2 * b0); g.rect(PX - b1, b1, -(PX - 2 * b1), PX - 2 * b1);
    g.clip('evenodd');
    if (!bump) g.strokeStyle = 'rgba(255,235,210,.22)';
    g.beginPath();
    for (let d = -PX; d < 2 * PX; d += 4.5 * IN) { g.moveTo(d, 0); g.lineTo(d + PX, PX); g.moveTo(d, PX); g.lineTo(d + PX, 0); }
    g.stroke();
    g.restore();
    g.restore();
    if (!bump) { g.fillStyle = noisePattern(g, 96, 0.07); g.fillRect(0, 0, PX, PX); }
  }
  const quiltMap = canvasTex(PX, PX, g => quiltLayout(g, 'color'));
  const quiltBump = canvasTex(1024, 1024, g => { g.scale(1024 / PX, 1024 / PX); quiltLayout(g, 'bump'); }, false);
  const backMap = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8cbb0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,50,38,.35)';
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
    g.fillStyle = noisePattern(g, 64, 0.08); g.fillRect(0, 0, w, h);
  });
  backMap.wrapS = backMap.wrapT = THREE.RepeatWrapping; backMap.repeat.set(6, 6);

  // Quilt render mesh (subdivided R × R grid).
  const qGeo = new THREE.BufferGeometry();
  const qPos = new Float32Array(R * R * 3), qUv = new Float32Array(R * R * 2), qIdx = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    qUv[2 * (j * R + i)] = i / (R - 1); qUv[2 * (j * R + i) + 1] = 1 - j / (R - 1);
  }
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < R - 1; i++) {
    const a = j * R + i, b = a + 1, d = a + R, c = d + 1;
    if (((i + j) & 1) === 0) qIdx.push(a, c, b, a, d, c); else qIdx.push(a, d, b, b, d, c);
  }
  qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3).setUsage(THREE.DynamicDrawUsage));
  qGeo.setAttribute('uv', new THREE.BufferAttribute(qUv, 2));
  qGeo.setIndex(qIdx);
  const frontMat = new THREE.MeshStandardMaterial({ map: quiltMap, bumpMap: quiltBump, bumpScale: 0.9, roughness: 0.93, side: THREE.FrontSide });
  const backMat = new THREE.MeshStandardMaterial({ map: backMap, bumpMap: quiltBump, bumpScale: 0.6, roughness: 0.95, side: THREE.BackSide });
  const quiltFront = new THREE.Mesh(qGeo, frontMat);
  const quiltBack = new THREE.Mesh(qGeo, backMat);
  quiltFront.castShadow = true; quiltFront.receiveShadow = true; quiltBack.receiveShadow = true;
  frontMat.shadowSide = THREE.DoubleSide;
  scene.add(quiltFront, quiltBack);

  const handMat = new THREE.MeshStandardMaterial({ color: 0xd9a37e, roughness: 0.6 });
  const handMeshes = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), handMat);
    m.castShadow = true; m.visible = false; scene.add(m); return m;
  });

  // 4-point interpolatory subdivision (Dyn–Levin–Gregory), separable on the grid:
  // mid = (−p0 + 9p1 + 9p2 − p3) / 16. Smooths the render without moving the
  // simulated nodes.
  const simPos = new Float32Array(N * N * 3);
  let havePos = false;
  function subdivide(src, dst, k) {
    const g = (i, j, d) => {
      // ghost nodes by linear extrapolation at the borders
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
  function upsample() {
    subdivide(simPos, qPos, 3);
    qGeo.attributes.position.needsUpdate = true;
    qGeo.computeVertexNormals();
    qGeo.computeBoundingSphere();
    if (!aGeo.attributes.normal) aGeo.setAttribute('normal', qGeo.attributes.normal);
  }

  // ------------------------------------------------------------- camera
  const target = new THREE.Vector3(0, 0.5, 0.15);
  const orbit = { r: 4.7, az: 0.72, el: 0.42 };
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 50);
  let activeCam = camera;
  function placeCamera() {
    for (const cam of [camera, ortho]) {
      cam.position.set(
        target.x + orbit.r * Math.cos(orbit.el) * Math.sin(orbit.az),
        target.y + orbit.r * Math.sin(orbit.el),
        target.z + orbit.r * Math.cos(orbit.el) * Math.cos(orbit.az));
      cam.lookAt(target);
    }
    // Orthographic frustum matched to what the perspective camera sees at the target.
    const hh = orbit.r * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    ortho.top = hh; ortho.bottom = -hh; ortho.left = -hh * camera.aspect; ortho.right = hh * camera.aspect;
    ortho.updateProjectionMatrix();
  }
  const VIEWS = { iso: { az: 0.72, el: 0.42 }, foot: { az: 0, el: 0.08 }, side: { az: Math.PI / 2, el: 0.08 }, top: { az: 0, el: 1.55 } };
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
  placeCamera();

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
    if (!havePos) return null;
    setNdc(e);
    const hit = ray.intersectObjects([quiltFront, quiltBack], false)[0];
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
      if (ray.ray.intersectPlane(drag.plane, p)) {
        p.y = Math.max(0.03, p.y);
        grabMsg = { type: 'grab', i: drag.i, target: p.toArray() };
      }
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
    const r = $('stage').getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 52 : 38;
    orbit.r = w / h < 1.2 ? 5.2 : 4.3; placeCamera();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe($('stage'));
  resize();

  // ------------------------------------------------------------- analysis view
  // CAD/FEA-style post-processing of the solved shape: banded contour fields
  // on the quilt, the simulation mesh overlaid, a neutral grey workspace with
  // outlined parts and a floor grid, and drape measurements.
  const H_GRID = SIZE / (N - 1);
  const MAT = { top: 0.62, headFace: -1.07 };
  const FIELDS = {
    strain:    { label: 'Membrane strain', unit: '%', fmt: v => v.toFixed(2), note: 'Change in length from the flat quilt. Negative means compressed, where the fabric buckles into folds.' },
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
  bandTex.encoding = THREE.sRGBEncoding;
  bandTex.needsUpdate = true;

  // Result surface shares the quilt's positions, normals and triangles.
  const aUv = new Float32Array(R * R * 2);
  const aGeo = new THREE.BufferGeometry();
  aGeo.setAttribute('position', qGeo.attributes.position);
  aGeo.setAttribute('uv', new THREE.BufferAttribute(aUv, 2).setUsage(THREE.DynamicDrawUsage));
  aGeo.setIndex(qGeo.index);
  const aClip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);   // keeps z ≤ constant
  const photoClip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 100); // keeps z ≥ −constant
  frontMat.clippingPlanes = backMat.clippingPlanes = [photoClip];
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
  const photoBg = scene.background;
  const engBg = canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b9c0ca'); gr.addColorStop(1, '#eceef2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const engFloorMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 1 });
  const gridMinor = new THREE.GridHelper(6, 60, 0xc3c9d1, 0xc3c9d1); gridMinor.position.y = 0.001;
  const gridMajor = new THREE.GridHelper(6, 6, 0x7d8796, 0x7d8796); gridMajor.position.y = 0.002;
  for (const g of [gridMinor, gridMajor]) { g.visible = false; scene.add(g); }
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.7 });
  const greyLight = new THREE.MeshStandardMaterial({ color: 0xcfd4db, roughness: 0.8 });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1f27, side: THREE.BackSide });
  const outlines = ClothSim.bedColliders().map(b => {
    const e = 0.007;
    const o = new THREE.Mesh(roundedBoxGeometry([b.h[0] + e, b.h[1] + e, b.h[2] + e], b.r + e, 4, 5), outlineMat);
    o.position.set(...b.c); o.visible = false; o.userData.name = b.name; scene.add(o);
    return o;
  });
  const origMats = new Map();
  for (const mesh of [...Object.values(colliderMeshes), ...legs, floor]) origMats.set(mesh, mesh.material);
  function setEngineering(on) {
    scene.background = on ? engBg : photoBg;
    floor.material = on ? engFloorMat : origMats.get(floor);
    gridMinor.visible = gridMajor.visible = on;
    wall.visible = wall2.visible = rug.visible = !on;
    for (const [name, mesh] of Object.entries(colliderMeshes))
      mesh.material = on ? (name === 'frame' || name === 'headboard' ? greyMat : greyLight) : origMats.get(mesh);
    for (const l of legs) l.material = on ? greyMat : origMats.get(l);
    const pillowsOn = $('pillows').checked;
    for (const o of outlines) o.visible = on && (!o.userData.name.startsWith('pillow') || pillowsOn);
  }

  // Scalar fields at the simulation nodes.
  const F = { strain: new Float32Array(N * N), curvature: new Float32Array(N * N), clearance: new Float32Array(N * N), height: new Float32Array(N * N) };
  const fieldR = new Float32Array(R * R), sdfN = new Float64Array(3);
  const colliders = ClothSim.bedColliders();
  const sortedCopy = a => Float32Array.from(a).sort();
  const quant = (s, q) => s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
  function computeFields() {
    const p = simPos, h = H_GRID, t = state.params.thickness / 2, pillowsOn = $('pillows').checked;
    const P = (i, j, d) => p[3 * (j * N + i) + d];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = P(i, j, 0), y = P(i, j, 1), z = P(i, j, 2);
      // strain: mean engineering strain of the grid edges meeting at this node
      let s = 0, n = 0;
      if (i > 0) { s += Math.hypot(x - P(i - 1, j, 0), y - P(i - 1, j, 1), z - P(i - 1, j, 2)) / h - 1; n++; }
      if (i < N - 1) { s += Math.hypot(x - P(i + 1, j, 0), y - P(i + 1, j, 1), z - P(i + 1, j, 2)) / h - 1; n++; }
      if (j > 0) { s += Math.hypot(x - P(i, j - 1, 0), y - P(i, j - 1, 1), z - P(i, j - 1, 2)) / h - 1; n++; }
      if (j < N - 1) { s += Math.hypot(x - P(i, j + 1, 0), y - P(i, j + 1, 1), z - P(i, j + 1, 2)) / h - 1; n++; }
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
    for (const b of $('views').children) b.setAttribute('aria-pressed', String((b.dataset.view === 'analysis') === on));
    $('legend3d').hidden = !on;
    $('stage').classList.toggle('analysis', on);
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
    if (on && !sweeping) quiltFront.visible = quiltBack.visible = false;
    scan.visible = sweeping; scan.position.z = s;
    meshLines.visible = on && analysis.mesh;
    meshLines.material.opacity = sweeping ? 0.42 * Math.max(0, (u - 0.6) / 0.4) : 0.42;
  }
  function fmtCm(v) { return (v * 100).toFixed(1) + ' cm'; }
  function analysisOnStats(s) {
    if (s.restAt !== null && analysis.auto && !analysis.autoDone && !analysis.on && s.running) {
      analysis.autoDone = true;
      setAnalysis(true);
    }
    if (!analysis.fields) return;
    const p = simPos, T = state.params.thickness / 2;
    // Drop is measured along the middle third of each edge, away from the
    // corners, which hang lower than the sides.
    let yL = 0, yR = 0, yF = 0, nMid = 0, minAll = 9, headZ = 0;
    const a0 = Math.floor(N / 3), a1 = Math.ceil(2 * N / 3);
    for (let k = 0; k < N; k++) {
      const yl = p[3 * (k * N) + 1], yr = p[3 * (k * N + N - 1) + 1];
      const yf = p[3 * ((N - 1) * N + k) + 1], yh = p[3 * k + 1];
      if (k >= a0 && k < a1) { yL += yl; yR += yr; yF += yf; nMid++; }
      minAll = Math.min(minAll, yl, yr, yf, yh);
      headZ += p[3 * k + 2];
    }
    headZ /= N;
    const drop = y => Math.max(0, MAT.top - y / nMid);
    $('r-dl').textContent = fmtCm(drop(yL));
    $('r-dr').textContent = fmtCm(drop(yR));
    $('r-df').textContent = fmtCm(drop(yF));
    $('r-head').textContent = fmtCm(headZ - MAT.headFace);
    $('r-hem').textContent = minAll - T < 0.002 ? 'on the floor' : fmtCm(minAll - T);
    let touch = 0; for (const g of F.clearance) if (g <= 1) touch++;
    $('r-touch').textContent = (100 * touch / F.clearance.length).toFixed(0) + ' %';
    const ss = sortedCopy(F.strain);
    $("r-strain").textContent = `${quant(ss, 0.98).toFixed(2)} · ${ss[ss.length - 1].toFixed(2)} %`;
    const kc = quant(sortedCopy(F.curvature), 0.99);
    $('r-fold').textContent = kc > 0.5 ? `${(100 / kc).toFixed(1)} cm` : 'flat';
  }

  // ------------------------------------------------------------- messages
  let handsData = [];
  function onSim(e) {
    const m = e.data;
    if (m.type !== 'frame') return;
    simPos.set(m.pos); havePos = true; handsData = m.hands;
    newFrame = true;
    if (m.stats) updateStats(m.stats);
  }
  let newFrame = false;

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
    $('hint').hidden = (s.running && s.speed < 0.93) || analysis.on;
    if (s.running && s.speed < 0.93) { slow.hidden = false; slow.textContent = `running at ${(s.speed).toFixed(2)}× speed`; }
    else slow.hidden = true;
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
  function showParam(p) {
    $(`p-${p.key}-o`).textContent = p.fmt(state.params[p.key]) + (p.unit ? ' ' + p.unit : '');
  }
  function syncParams() {
    for (const p of PARAMS) { $(`p-${p.key}`).value = toSlider(p, state.params[p.key]); showParam(p); }
  }
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
    colliderMeshes.pillowL.visible = colliderMeshes.pillowR.visible = e.target.checked;
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
    analysis.autoDone = false;
    setAnalysis(false);
    if (!state.running) setRunning(true);
    send({ type: 'reset', scenario: state.scenario, dropHeight: state.dropHeight });
  }
  function setRunning(v) {
    state.running = v;
    $('pause').textContent = v ? 'Pause' : 'Resume';
    send({ type: 'run', value: v });
  }
  $('restart').addEventListener('click', restart);
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

  $('views').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setAnalysis(b.dataset.view === 'analysis');
  });
  $('field').addEventListener('change', e => { analysis.field = e.target.value; analysis.legendKey = ''; computeAnalysis(); });
  $('meshlines').addEventListener('change', e => { analysis.mesh = e.target.checked; });
  $('ortho').addEventListener('change', e => { activeCam = e.target.checked ? ortho : camera; });
  $('autoan').addEventListener('change', e => { analysis.auto = e.target.checked; });
  for (const b of document.querySelectorAll('[data-cam]')) b.addEventListener('click', () => goView(b.dataset.cam));

  // ------------------------------------------------------------- loop
  let lastT = performance.now();
  function frame(now) {
    now = now || performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (grabMsg) { send(grabMsg); grabMsg = null; }
    if (newFrame) {
      upsample(); newFrame = false;
      computeAnalysis();
      for (let k = 0; k < handMeshes.length; k++) {
        const on = 3 * k + 2 < handsData.length;
        handMeshes[k].visible = on;
        if (on) handMeshes[k].position.set(handsData[3 * k], handsData[3 * k + 1] + 0.03, handsData[3 * k + 2]);
      }
    }
    quiltFront.visible = quiltBack.visible = havePos;
    stepAnalysis(dt);
    stepCamera(dt);
    renderer.render(scene, activeCam);
    requestAnimationFrame(frame);
  }
  startSim();
  requestAnimationFrame(frame);
})();
