/* Cloth physics core — SI units throughout (m, kg, s, N).
 *
 * Model
 *  - Mass: lumped from triangle areas × areal density ρA (kg/m²).
 *  - Membrane: XPBD distance constraints (Macklin et al. 2016) with compliance
 *    α = 1/k, where k comes from the fabric's 2D tensile modulus E (N/m) and
 *    shear modulus G (N/m). Compression is 50× softer than tension, because
 *    woven fabric buckles instead of resisting compression.
 *  - Bending: isometric quadratic bending energy (Bergou et al. 2006),
 *    E = ½ B xᵀQx with flexural rigidity B (N·m). Its scale is calibrated so
 *    the discrete energy converges to the analytic plate energy of a cylinder,
 *    ½ B A / R², under mesh refinement.
 *  - Damping: XPBD constraint damping and modal bending damping, both set by
 *    a damping ratio ζ.
 *  - Air: quadratic pressure drag on each triangle, ½ ρ C_d A |v_n| v_n,
 *    plus skin friction; ρ_air = 1.204 kg/m³ (20 °C, sea level).
 *  - Contact: exact signed-distance functions for the bed, pillows and floor;
 *    Coulomb friction applied at position level, so tangential motion stops
 *    when |F_t| ≤ μ_s N and slides with μ_k N otherwise.
 *  - Self-contact: particle repulsion via a spatial hash.
 *  - Integration: "small steps" XPBD (Macklin et al. 2019) — many substeps,
 *    one constraint iteration each.
 */
const ClothSim = (function () {
  'use strict';
  const GRAV = 9.81;
  const RHO_AIR = 1.204;
  const COMPRESS_SOFTNESS = 50;

  function cot(ax, ay, az, bx, by, bz) {
    const d = ax * bx + ay * by + az * bz;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    return d / Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  // Exact SDF of a rounded box; writes outward normal into out[0..2].
  function roundedBoxSDF(px, py, pz, b, out) {
    const dx = px - b.c[0], dy = py - b.c[1], dz = pz - b.c[2];
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1, sz = dz < 0 ? -1 : 1;
    const qx = Math.abs(dx) - (b.h[0] - b.r);
    const qy = Math.abs(dy) - (b.h[1] - b.r);
    const qz = Math.abs(dz) - (b.h[2] - b.r);
    const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
    const ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const mq = Math.max(qx, qy, qz);
    if (ol > 0) {
      out[0] = sx * ox / ol; out[1] = sy * oy / ol; out[2] = sz * oz / ol;
    } else {
      out[0] = out[1] = out[2] = 0;
      if (mq === qx) out[0] = sx; else if (mq === qy) out[1] = sy; else out[2] = sz;
    }
    return ol + Math.min(mq, 0) - b.r;
  }

  class Cloth {
    constructor(opt) {
      const nx = (this.nx = opt.nx), ny = (this.ny = opt.ny);
      const N = (this.N = nx * ny);
      this.width = opt.width; this.length = opt.length;
      this.hx = this.width / (nx - 1);
      this.hy = this.length / (ny - 1);
      this.pos = new Float64Array(3 * N);
      this.prev = new Float64Array(3 * N);
      this.vel = new Float64Array(3 * N);
      this.frc = new Float64Array(3 * N);
      this.mass = new Float64Array(N);
      this.invMass = new Float64Array(N);
      this.pinned = new Uint8Array(N);
      this.pinTarget = new Float64Array(3 * N);
      this.inContact = new Uint8Array(N);
      this.gx = new Int16Array(N);
      this.gy = new Int16Array(N);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        this.gx[j * nx + i] = i; this.gy[j * nx + i] = j;
      }

      // Triangles, alternating diagonals for isotropy; wound so +y is "front".
      const tris = [];
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, d = a + nx, c = d + 1;
        if (((i + j) & 1) === 0) tris.push(a, c, b, a, d, c);
        else tris.push(a, d, b, b, d, c);
      }
      this.tris = new Uint32Array(tris);

      // Membrane constraints: type 0 = stretch (grid edges), 1 = shear (diagonals).
      const cA = [], cB = [], cT = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = j * nx + i;
        if (i + 1 < nx) { cA.push(a); cB.push(a + 1); cT.push(0); }
        if (j + 1 < ny) { cA.push(a); cB.push(a + nx); cT.push(0); }
        if (i + 1 < nx && j + 1 < ny) {
          cA.push(a); cB.push(a + nx + 1); cT.push(1);
          cA.push(a + 1); cB.push(a + nx); cT.push(1);
        }
      }
      this.cA = new Uint32Array(cA); this.cB = new Uint32Array(cB);
      this.cT = new Uint8Array(cT);
      this.cRest = new Float64Array(cA.length);
      this.cSqrtM = new Float64Array(cA.length);

      this.colliders = [];
      this.params = Object.assign({
        rhoA: 0.5, E: 3000, G: 60, B: 3e-4, muS: 0.6, muK: 0.5,
        Cd: 1.2, Cf: 0.02, zeta: 0.05, thickness: 0.02
      }, opt.params || {});
      this.selfCollision = true;
      this.time = 0;
      this.kinematic = null;
      this._n = new Float64Array(3);
      this._flip = false;
      this._sub = 0;

      this.layFlat(0, 1, 0);
      this._buildBending();
      this.setParams({});
      this._initHash();
    }

    // Place the cloth flat, horizontal, centred at (cx, y, cz).
    layFlat(cx, y, cz) {
      const { nx, ny, hx, hy, pos, prev, vel } = this;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = 3 * (j * nx + i);
        pos[k] = cx + i * hx - this.width / 2;
        pos[k + 1] = y;
        pos[k + 2] = cz + j * hy - this.length / 2;
      }
      prev.set(pos); vel.fill(0);
      this.pinned.fill(0);
      this.time = 0;
      if (this.cRest[0] === 0) this._setRest();
      this._refreshInvMass();
    }

    _setRest() {
      const { cA, cB, pos } = this;
      for (let c = 0; c < cA.length; c++) {
        const a = 3 * cA[c], b = 3 * cB[c];
        this.cRest[c] = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
      }
    }

    _buildBending() {
      const { tris, pos, N } = this;
      const map = new Map();
      for (let t = 0; t < tris.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const v0 = tris[t + e], v1 = tris[t + (e + 1) % 3], op = tris[t + (e + 2) % 3];
          const lo = Math.min(v0, v1), hi = Math.max(v0, v1);
          const key = lo * N + hi;
          const ent = map.get(key);
          if (ent) ent.push(op); else map.set(key, [lo, hi, op]);
        }
      }
      const idx = [], K = [], S = [];
      for (const ent of map.values()) {
        if (ent.length !== 4) continue;
        const [i0, i1, i2, i3] = ent;
        const P = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
        const x0 = P(i0), x1 = P(i1), x2 = P(i2), x3 = P(i3);
        const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const e0 = sub(x1, x0), e1 = sub(x2, x0), e2 = sub(x3, x0), e3 = sub(x2, x1), e4 = sub(x3, x1);
        const c01 = cot(...e0, ...e1), c02 = cot(...e0, ...e2);
        const c03 = cot(-e0[0], -e0[1], -e0[2], ...e3), c04 = cot(-e0[0], -e0[1], -e0[2], ...e4);
        const cr = (a, b) => Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
        const A0 = cr(e0, e1) / 2, A1 = cr(e0, e2) / 2;
        idx.push(i0, i1, i2, i3);
        K.push(c03 + c04, c01 + c02, -c01 - c03, -c02 - c04);
        // Calibrated: with 1/(A0+A1) the discrete energy converges to the analytic
        // plate energy ½·B·A/R² of a cylinder as the mesh is refined.
        S.push(1 / (A0 + A1));
      }
      this.bIdx = new Uint32Array(idx);
      this.bK = new Float64Array(K);
      this.bS = new Float64Array(S);
      this.bD = new Float64Array(S.length); // sqrt(S·m̄)/|K|, filled in setParams
    }

    setParams(p) {
      Object.assign(this.params, p);
      const P = this.params;
      // Lumped masses from triangle areas.
      const { tris, pos, mass } = this;
      mass.fill(0);
      for (let t = 0; t < tris.length; t += 3) {
        const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
        // rest area (flat grid): hx*hy/2
        const A = this.hx * this.hy / 2;
        const m3 = P.rhoA * A / 3;
        mass[tris[t]] += m3; mass[tris[t + 1]] += m3; mass[tris[t + 2]] += m3;
      }
      this.totalMass = mass.reduce((s, m) => s + m, 0);
      // Constraint stiffness: a strip of width w and length L under 2D modulus E
      // has k = E·w/L. For the grid, structural edges get w ≈ spacing ⇒ k ≈ E.
      // Diagonals carry shear: k ≈ G.
      this.kType = [P.E, P.G];
      this.alphaType = [1 / P.E, 1 / P.G];
      for (let c = 0; c < this.cA.length; c++)
        this.cSqrtM[c] = Math.sqrt((mass[this.cA[c]] + mass[this.cB[c]]) / 2);
      const nb = this.bS.length;
      for (let k = 0; k < nb; k++) {
        const i = 4 * k;
        const mbar = (mass[this.bIdx[i]] + mass[this.bIdx[i + 1]] + mass[this.bIdx[i + 2]] + mass[this.bIdx[i + 3]]) / 4;
        const kn = Math.hypot(this.bK[i], this.bK[i + 1], this.bK[i + 2], this.bK[i + 3]);
        this.bD[k] = Math.sqrt(this.bS[k] * mbar) / kn;
      }
      this._refreshInvMass();
      if (this._hashCell !== undefined) this._initHash();
    }

    _refreshInvMass() {
      for (let i = 0; i < this.N; i++)
        this.invMass[i] = this.pinned[i] || !this.mass[i] ? 0 : 1 / this.mass[i];
    }

    pin(i, x, y, z) {
      this.pinned[i] = 1; this.invMass[i] = 0;
      this.pinTarget[3 * i] = x; this.pinTarget[3 * i + 1] = y; this.pinTarget[3 * i + 2] = z;
    }
    unpin(i) { this.pinned[i] = 0; this.invMass[i] = 1 / this.mass[i]; }
    unpinAll() { this.pinned.fill(0); this._refreshInvMass(); }

    // Bending length (Peirce cantilever): c = (B / (ρA g))^(1/3)
    bendingLength() { return Math.cbrt(this.params.B / (this.params.rhoA * GRAV)); }

    step(frameDt, substeps) {
      const dt = frameDt / substeps;
      for (let s = 0; s < substeps; s++) this._substep(dt);
    }

    _substep(dt) {
      const t = this.time + dt;
      if (this.kinematic) this.kinematic(t, this, dt);
      this._forces();
      const { N, pos, prev, vel, frc, invMass, pinned, pinTarget } = this;
      for (let i = 0; i < N; i++) {
        const k = 3 * i;
        prev[k] = pos[k]; prev[k + 1] = pos[k + 1]; prev[k + 2] = pos[k + 2];
        if (pinned[i]) {
          pos[k] = pinTarget[k]; pos[k + 1] = pinTarget[k + 1]; pos[k + 2] = pinTarget[k + 2];
        } else {
          const w = invMass[i] * dt;
          vel[k] += frc[k] * w; vel[k + 1] += frc[k + 1] * w; vel[k + 2] += frc[k + 2] * w;
          pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        }
      }
      this._solveMembrane(dt);
      if (this.selfCollision) {
        if ((this._sub = (this._sub + 1) & 3) === 1) this._buildPairs();
        this._solvePairs();
      }
      this._solveContacts();
      const inv = 1 / dt;
      for (let k = 0; k < 3 * N; k++) vel[k] = (pos[k] - prev[k]) * inv;
      this.time = t;
    }

    _forces() {
      const { N, frc, mass, pos: x, vel: v, params: P } = this;
      for (let i = 0; i < N; i++) {
        frc[3 * i] = 0; frc[3 * i + 1] = -mass[i] * GRAV; frc[3 * i + 2] = 0;
      }
      // Bending: F = −B·Q·x − c·Q̂·v (modal damping at ratio ζ)
      const B = P.B, zb = 2 * P.zeta * Math.sqrt(B);
      const bIdx = this.bIdx, bK = this.bK, bS = this.bS, bD = this.bD;
      const nb = bS.length;
      for (let s = 0; s < nb; s++) {
        const o = 4 * s;
        const i0 = 3 * bIdx[o], i1 = 3 * bIdx[o + 1], i2 = 3 * bIdx[o + 2], i3 = 3 * bIdx[o + 3];
        const k0 = bK[o], k1 = bK[o + 1], k2 = bK[o + 2], k3 = bK[o + 3];
        const sb = B * bS[s], cd = zb * bD[s];
        let q = k0 * x[i0] + k1 * x[i1] + k2 * x[i2] + k3 * x[i3];
        let qd = k0 * v[i0] + k1 * v[i1] + k2 * v[i2] + k3 * v[i3];
        let g = sb * q + cd * qd;
        frc[i0] -= g * k0; frc[i1] -= g * k1; frc[i2] -= g * k2; frc[i3] -= g * k3;
        q = k0 * x[i0 + 1] + k1 * x[i1 + 1] + k2 * x[i2 + 1] + k3 * x[i3 + 1];
        qd = k0 * v[i0 + 1] + k1 * v[i1 + 1] + k2 * v[i2 + 1] + k3 * v[i3 + 1];
        g = sb * q + cd * qd;
        frc[i0 + 1] -= g * k0; frc[i1 + 1] -= g * k1; frc[i2 + 1] -= g * k2; frc[i3 + 1] -= g * k3;
        q = k0 * x[i0 + 2] + k1 * x[i1 + 2] + k2 * x[i2 + 2] + k3 * x[i3 + 2];
        qd = k0 * v[i0 + 2] + k1 * v[i1 + 2] + k2 * v[i2 + 2] + k3 * v[i3 + 2];
        g = sb * q + cd * qd;
        frc[i0 + 2] -= g * k0; frc[i1 + 2] -= g * k1; frc[i2 + 2] -= g * k2; frc[i3 + 2] -= g * k3;
      }
      // Aerodynamic drag on each triangle (still air).
      if (P.Cd > 0 || P.Cf > 0) {
        const tris = this.tris, half = 0.5 * RHO_AIR;
        for (let t = 0; t < tris.length; t += 3) {
          const a = 3 * tris[t], b = 3 * tris[t + 1], c = 3 * tris[t + 2];
          const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2];
          const wx = x[c] - x[a], wy = x[c + 1] - x[a + 1], wz = x[c + 2] - x[a + 2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          const n2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (n2 < 1e-12) continue;
          const A = n2 / 2; nx /= n2; ny /= n2; nz /= n2;
          const vx = (v[a] + v[b] + v[c]) / 3, vy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, vz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
          const vn = vx * nx + vy * ny + vz * nz;
          const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
          const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
          const fn = -half * P.Cd * A * Math.abs(vn) * vn;
          const ft = -half * P.Cf * A * vt;
          const Fx = (fn * nx + ft * tx) / 3, Fy = (fn * ny + ft * ty) / 3, Fz = (fn * nz + ft * tz) / 3;
          frc[a] += Fx; frc[a + 1] += Fy; frc[a + 2] += Fz;
          frc[b] += Fx; frc[b + 1] += Fy; frc[b + 2] += Fz;
          frc[c] += Fx; frc[c + 1] += Fy; frc[c + 2] += Fz;
        }
      }
    }

    _solveMembrane(dt) {
      const { cA, cB, cT, cRest, cSqrtM, pos: x, prev: xp, invMass: w, params: P } = this;
      const dt2 = dt * dt;
      const a0 = this.alphaType[0], a1 = this.alphaType[1];
      const zeta = P.zeta;
      const n = cA.length;
      for (let q = 0; q < n; q++) {
        const c = q; // fixed order: alternating the order excites a period-2 mode
        const i = cA[c], j = cB[c];
        const wi = w[i], wj = w[j], ws = wi + wj;
        if (ws === 0) continue;
        const a = 3 * i, b = 3 * j;
        let dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (L < 1e-12) continue;
        dx /= L; dy /= L; dz /= L;
        const C = L - cRest[c];
        let alpha = cT[c] ? a1 : a0;
        if (C < 0) alpha *= COMPRESS_SOFTNESS;
        const at = alpha / dt2;
        const gamma = 2 * zeta * Math.sqrt(alpha) * cSqrtM[c] / dt;
        const vrel = dx * ((x[b] - xp[b]) - (x[a] - xp[a])) +
                     dy * ((x[b + 1] - xp[b + 1]) - (x[a + 1] - xp[a + 1])) +
                     dz * ((x[b + 2] - xp[b + 2]) - (x[a + 2] - xp[a + 2]));
        const dl = (-C - gamma * vrel) / ((1 + gamma) * ws + at);
        x[a] -= wi * dl * dx; x[a + 1] -= wi * dl * dy; x[a + 2] -= wi * dl * dz;
        x[b] += wj * dl * dx; x[b + 1] += wj * dl * dy; x[b + 2] += wj * dl * dz;
      }
    }

    _initHash() {
      const P = this.params;
      this._selfDist = Math.max(P.thickness, 0.6 * Math.min(this.hx, this.hy));
      this._hashCell = this._selfDist;
      let size = 1; while (size < 2 * this.N) size <<= 1;
      this._hashMask = size - 1;
      this._head = new Int32Array(size);
      this._next = new Int32Array(this.N);
      this._cell = new Int32Array(3 * this.N);
      this._pairs = this._pairs || new Int32Array(4096);
      this._np = 0;
    }

    // Broad phase every 4th substep: collect particle pairs within 1.6·d_s
    // (a Verlet list), so the narrow phase can run on every substep cheaply.
    _buildPairs() {
      const { N, pos: x, gx, gy } = this;
      const inv = 1 / this._hashCell, mask = this._hashMask;
      const head = this._head, next = this._next, cell = this._cell;
      const rr = 1.6 * this._selfDist, rr2 = rr * rr;
      head.fill(-1);
      const H = (a, b, c) => (Math.imul(a, 92837111) ^ Math.imul(b, 689287499) ^ Math.imul(c, 283923481)) & mask;
      for (let i = 0; i < N; i++) {
        const cx = Math.floor(x[3 * i] * inv), cy = Math.floor(x[3 * i + 1] * inv), cz = Math.floor(x[3 * i + 2] * inv);
        cell[3 * i] = cx; cell[3 * i + 1] = cy; cell[3 * i + 2] = cz;
        const h = H(cx, cy, cz);
        next[i] = head[h]; head[h] = i;
      }
      let np = 0, pairs = this._pairs;
      for (let i = 0; i < N; i++) {
        const cx = cell[3 * i], cy = cell[3 * i + 1], cz = cell[3 * i + 2];
        const gxi = gx[i], gyi = gy[i];
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
          let j = head[H(cx + ox, cy + oy, cz + oz)];
          while (j !== -1) {
            if (j > i && cell[3 * j] === cx + ox && cell[3 * j + 1] === cy + oy && cell[3 * j + 2] === cz + oz) {
              const ddx = gx[j] - gxi, ddy = gy[j] - gyi;
              if (ddx > 1 || ddx < -1 || ddy > 1 || ddy < -1) {
                const a = 3 * i, b = 3 * j;
                const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
                if (dx * dx + dy * dy + dz * dz < rr2) {
                  if (2 * np + 2 > pairs.length) { const g = new Int32Array(pairs.length * 2); g.set(pairs); pairs = this._pairs = g; }
                  pairs[2 * np] = i; pairs[2 * np + 1] = j; np++;
                }
              }
            }
            j = next[j];
          }
        }
      }
      this._np = np;
    }

    _solvePairs() {
      const { pos: x, invMass: w } = this;
      const pairs = this._pairs, ds = this._selfDist, ds2 = ds * ds;
      for (let p = 0; p < this._np; p++) {
        const i = pairs[2 * p], j = pairs[2 * p + 1];
        const a = 3 * i, b = 3 * j;
        const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= ds2 || d2 < 1e-14) continue;
        const wi = w[i], wj = w[j], ws = wi + wj;
        if (ws === 0) continue;
        const d = Math.sqrt(d2), corr = (ds - d) / (d * ws);
        x[a] -= dx * corr * wi; x[a + 1] -= dy * corr * wi; x[a + 2] -= dz * corr * wi;
        x[b] += dx * corr * wj; x[b + 1] += dy * corr * wj; x[b + 2] += dz * corr * wj;
      }
    }

    _solveContacts() {
      const { N, pos: x, prev: xp, invMass: w, colliders, params: P, inContact } = this;
      const r = P.thickness / 2, n = this._n;
      const muS = P.muS, muK = Math.min(P.muK, P.muS);
      for (let i = 0; i < N; i++) {
        inContact[i] = 0;
        if (w[i] === 0) continue;
        const k = 3 * i;
        // Floor (oak boards; a slightly lower μ than cotton-on-cotton).
        if (x[k + 1] < r) {
          const d = r - x[k + 1];
          x[k + 1] = r;
          this._friction(k, 0, 1, 0, d, 0.4, 0.3);
          inContact[i] = 1;
        }
        for (let c = 0; c < colliders.length; c++) {
          const b = colliders[c];
          if (!b.enabled) continue;
          if (Math.abs(x[k] - b.c[0]) > b.h[0] + r || Math.abs(x[k + 1] - b.c[1]) > b.h[1] + r ||
              Math.abs(x[k + 2] - b.c[2]) > b.h[2] + r) continue;
          const sd = roundedBoxSDF(x[k], x[k + 1], x[k + 2], b, n);
          if (sd < r) {
            const d = r - sd;
            x[k] += n[0] * d; x[k + 1] += n[1] * d; x[k + 2] += n[2] * d;
            this._friction(k, n[0], n[1], n[2], d, b.muScale * muS, b.muScale * muK);
            inContact[i] = 1;
          }
        }
      }
    }

    // Position-level Coulomb friction. The normal correction d is the normal
    // impulse × dt/m, so |Δx_t| ≤ μ·d is exactly |J_t| ≤ μ·|J_n|.
    _friction(k, nx, ny, nz, d, muS, muK) {
      const x = this.pos, xp = this.prev;
      const dx = x[k] - xp[k], dy = x[k + 1] - xp[k + 1], dz = x[k + 2] - xp[k + 2];
      const dn = dx * nx + dy * ny + dz * nz;
      const tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz;
      const lt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (lt < 1e-14) return;
      let s;
      if (lt < muS * d) s = 1;               // static: stick
      else s = Math.min(muK * d / lt, 1);    // kinetic: slide
      x[k] -= tx * s; x[k + 1] -= ty * s; x[k + 2] -= tz * s;
    }

    energies() {
      const { N, pos: x, vel: v, mass, params: P } = this;
      let ke = 0, pe = 0;
      for (let i = 0; i < N; i++) {
        const k = 3 * i;
        ke += 0.5 * mass[i] * (v[k] * v[k] + v[k + 1] * v[k + 1] + v[k + 2] * v[k + 2]);
        pe += mass[i] * GRAV * x[k + 1];
      }
      let es = 0, maxStrain = 0;
      const { cA, cB, cT, cRest } = this;
      for (let c = 0; c < cA.length; c++) {
        const a = 3 * cA[c], b = 3 * cB[c];
        const L = Math.hypot(x[b] - x[a], x[b + 1] - x[a + 1], x[b + 2] - x[a + 2]);
        const C = L - cRest[c];
        let k = this.kType[cT[c]];
        if (C < 0) k /= COMPRESS_SOFTNESS;
        es += 0.5 * k * C * C;
        if (cT[c] === 0 && C / cRest[c] > maxStrain) maxStrain = C / cRest[c];
      }
      let eb = 0;
      const { bIdx, bK, bS } = this;
      for (let s = 0; s < bS.length; s++) {
        const o = 4 * s;
        for (let d = 0; d < 3; d++) {
          const q = bK[o] * x[3 * bIdx[o] + d] + bK[o + 1] * x[3 * bIdx[o + 1] + d] +
                    bK[o + 2] * x[3 * bIdx[o + 2] + d] + bK[o + 3] * x[3 * bIdx[o + 3] + d];
          eb += 0.5 * P.B * bS[s] * q * q;
        }
      }
      let contact = 0;
      for (let i = 0; i < N; i++) contact += this.inContact[i];
      return { ke, pe, stretch: es, bend: eb, maxStrain, contactFrac: contact / N };
    }
  }

  // ---------------------------------------------------------------- Scene
  // A bed sized to its mattress (default: US queen, 152.5 × 203 cm), top of mattress at 62 cm.
  // Head at −z. The frame, headboard and pillows follow the mattress size; a mattress narrower
  // than 1.2 m gets one centred pillow (pillowR then duplicates it and is marked `dup`).
  const MATTRESS_TOP = 0.62;
  const DEFAULT_BED = { w: 1.525, l: 2.03 };
  // A table: a 4 cm top with rounded (bull-nose) edges at height h, on four square legs set 8 cm in from the edges.
  function tableColliders(t) {
    const W = t.w / 2, L = t.l / 2, H = t.h || 0.75, top = 0.04, lh = (H - top) / 2;
    const out = [{ name: 'tabletop', c: [0, H - top / 2, 0], h: [W, top / 2, L], r: 0.019, muScale: 0.75, enabled: true }];
    const ix = Math.max(0.03, W - 0.08), iz = Math.max(0.03, L - 0.08);
    for (const [sx, sz, n] of [[-1, -1, 0], [1, -1, 1], [-1, 1, 2], [1, 1, 3]])
      out.push({ name: 'leg' + n, c: [sx * ix, lh, sz * iz], h: [0.03, lh, 0.03], r: 0.004, muScale: 0.75, enabled: true });
    return out;
  }
  const isTable = bed => !!bed && bed.kind === 'table';
  // height of the surface the quilt is laid on, and where along z the quilt's centre starts
  const surfaceTop = bed => isTable(bed) ? (bed.h || 0.75) : MATTRESS_TOP;
  const startZ = (bed, length) => isTable(bed) ? 0 : -bed.l / 2 + 0.07 + length / 2;
  function bedColliders(bed = DEFAULT_BED) {
    if (isTable(bed)) return tableColliders(bed);
    const W = bed.w / 2, L = bed.l / 2;
    const single = bed.w < 1.2, pw = single ? Math.min(0.33, W - 0.06) : Math.min(0.33, (W - 0.07) / 2);
    const px = single ? 0 : Math.min(0.36, W - 0.04 - pw), pz = -L + 0.295;
    return [
      { name: 'frame',    c: [0, 0.23, 0.0],        h: [W + 0.06, 0.13, L + 0.055], r: 0.012, muScale: 0.75, enabled: true },
      { name: 'mattress', c: [0, 0.49, 0.0],        h: [W - 0.0025, 0.13, L],      r: 0.07,  muScale: 1.0,  enabled: true },
      { name: 'headboard',c: [0, 0.68, -L - 0.08],  h: [W + 0.08, 0.58, 0.025],    r: 0.01,  muScale: 0.75, enabled: true },
      { name: 'pillowL',  c: [-px, 0.69, pz],       h: [pw, 0.07, 0.23],           r: 0.065, muScale: 1.0,  enabled: true },
      { name: 'pillowR',  c: [px, 0.69, pz],        h: [pw, 0.07, 0.23],           r: 0.065, muScale: 1.0,  enabled: true, dup: single },
    ];
  }

  function ease(a, b, u) { const s = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(u, 0), 1)); return a + (b - a) * s; }
  function track(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let k = 1; k < keys.length; k++) {
      if (t <= keys[k].t) {
        const a = keys[k - 1], b = keys[k], u = (t - a.t) / (b.t - a.t);
        return { x: ease(a.x, b.x, u), y: ease(a.y, b.y, u), z: ease(a.z, b.z, u) };
      }
    }
    return keys[keys.length - 1];
  }

  // Scenario scripts: hands are kinematic (prescribed motion); everything
  // else is the solver's response. A hand grips a 2×2 patch of fabric
  // (≈ 6 cm), not a single point, so the load is not concentrated on one node.
  function grip(c, gi, gj) {
    const di = gi === 0 ? 1 : -1, dj = gj === 0 ? 1 : -1;
    return [[gi, gj], [gi + di, gj], [gi, gj + dj], [gi + di, gj + dj]].map(([i, j]) => j * c.nx + i);
  }
  const SCENARIOS = {
    drop: { label: 'Drop flat', release: 0, place: 'flat', hands: () => [] },
    spread: {
      label: 'Two-person spread', release: 2.45, place: 'curtain',
      // Two people at the foot hold the head-end corners, lift the quilt and
      // carry that edge over the bed to the pillows, then let go.
      hands: (c, bed) => {
        const W = c.width / 2, B = bed.w / 2, L = bed.l / 2;
        const keys = s => [
          { t: 0.0,  x: s * W,          y: 1.70, z: L + 0.485 },
          { t: 0.8,  x: s * (B + 0.32), y: 1.95, z: L - 0.365 },
          { t: 1.55, x: s * (B + 0.29), y: 1.45, z: -L + 0.565 },
          { t: 2.3,  x: s * (B + 0.26), y: Math.max(0.86, surfaceTop(bed) + 0.24), z: -L + 0.085 },
        ];
        return [
          { ids: grip(c, 0, 0), keys: keys(-1) },
          { ids: grip(c, c.nx - 1, 0), keys: keys(1) },
        ];
      }
    },
    corner: {
      label: 'Hang by one corner', release: 2.4, place: 'flat',
      hands: (c, bed) => {
        const zc = startZ(bed, c.length), B = bed.w / 2, L = bed.l / 2;
        const x0 = c.width / 2, z0 = zc + c.length / 2, y0 = surfaceTop(bed) + 0.6;
        return [{ ids: grip(c, c.nx - 1, c.ny - 1), keys: [
          { t: 0, x: x0, y: y0, z: z0 },
          { t: 1.0, x: B - 0.01, y: 2.05, z: L - 0.115 },
          { t: 2.3, x: B - 0.21, y: 2.0, z: L - 0.415 },
        ] }];
      }
    }
  };

  class SimController {
    constructor(opt) {
      this.n = opt.n || 40;
      this.cloth = new Cloth({ nx: this.n, ny: this.n, width: opt.width || 2.29, length: opt.length || 2.29, params: opt.params });
      this.bed = opt.bed || DEFAULT_BED;
      this.cloth.colliders = bedColliders(this.bed);
      this.dropHeight = 0.5;
      this.rot = !!opt.rot;          // quilt turned 90° on the bed before it is dropped
      this.pos = opt.pos == null ? null : +opt.pos;   // drop centre along the bed's / table's long side (m from its centre); null = default
      this.substeps = opt.substeps || 20;
      this.reset(opt.scenario || 'drop', opt.dropHeight || 0.5);
    }
    reset(name, dropHeight, rot, pos) {
      const c = this.cloth;
      if (rot !== undefined) this.rot = !!rot;
      if (pos !== undefined) this.pos = pos == null ? null : +pos;
      this.scenario = SCENARIOS[name] ? name : 'drop';
      if (dropHeight !== undefined) this.dropHeight = dropHeight;
      const sc = SCENARIOS[this.scenario];
      const h = sc.release ? 0.6 : this.dropHeight;
      // the head edge of the quilt lies 7 cm from the head of the mattress, under the pillows
      const turn = this.rot && this.scenario === 'drop';
      let xc = 0, zc = startZ(this.bed, turn ? c.width : c.length);
      // a chosen drop position slides the quilt's centre along the long side of the bed or table
      if (this.pos != null && this.scenario === 'drop') {
        if (this.bed.w > this.bed.l) xc = this.pos;
        // on a bed the quilt may not start over the headboard: its head edge stays at or past the head of the mattress,
        // otherwise its first layout would cut through the board and the cloth would drape on both sides of it
        else zc = isTable(this.bed) ? this.pos : Math.max(this.pos, -this.bed.l / 2 + 0.02 + (turn ? c.width : c.length) / 2);
      }
      c.layFlat(xc, surfaceTop(this.bed) + h, zc);
      if (turn) {
        // a quarter turn about the quilt's centre: its width now runs along the bed and its length across
        for (let i = 0; i < c.N; i++) { const k = 3 * i, dx = c.pos[k] - xc, dz = c.pos[k + 2] - zc; c.pos[k] = xc - dz; c.pos[k + 2] = zc + dx; }
      }
      if (sc.place === 'curtain') {
        // Hanging from the hands at 1.70 m, 48.5 cm beyond the foot of the bed; the part
        // longer than the drop lies on the floor, folded away from the bed.
        const top = 1.70, z0 = this.bed.l / 2 + 0.485, r = c.params.thickness / 2;
        for (let j = 0; j < c.ny; j++) for (let i = 0; i < c.nx; i++) {
          const k = 3 * (j * c.nx + i), v = j * c.hy, vert = top - r;
          if (v <= vert) { c.pos[k + 1] = top - v; c.pos[k + 2] = z0; }
          else { c.pos[k + 1] = r; c.pos[k + 2] = z0 + (v - vert); }
        }
      }
      // 1 mm deterministic surface noise breaks the perfect symmetry a real
      // quilt never has.
      let s = 12345;
      for (let i = 0; i < c.N; i++) { s = (s * 16807) % 2147483647; c.pos[3 * i + 1] += 0.001 * (s / 2147483647 - 0.5); }
      c.prev.set(c.pos);
      this.hands = sc.hands(c, this.bed);
      this.released = sc.release === 0;
      this.grab = null;
      // Grip offsets relative to the hand, taken from the starting layout.
      for (const hd of this.hands) {
        const p = hd.keys[0], a = 3 * hd.ids[0];
        hd.off = hd.ids.map(id => [c.pos[3 * id] - c.pos[a], c.pos[3 * id + 1] - c.pos[a + 1], c.pos[3 * id + 2] - c.pos[a + 2]]);
        hd.ids.forEach((id, n) => c.pin(id, p.x + hd.off[n][0], p.y + hd.off[n][1], p.z + hd.off[n][2]));
      }
      c.kinematic = (t, cl, dt) => this._kinematic(t, dt);
      this.E0 = this.released ? this._etot() : null;
      this.restAt = null; this._still = 0;
      this.history = [];
    }
    _etot() { const e = this.cloth.energies(); return e.ke + e.pe + e.stretch + e.bend; }
    _kinematic(t, dt) {
      const c = this.cloth, sc = SCENARIOS[this.scenario];
      if (!this.released) {
        if (t >= sc.release) {
          for (const hd of this.hands) for (const id of hd.ids) if (!this.grab || this.grab.i !== id) c.unpin(id);
          this.hands = []; this.released = true; this._pendingE0 = true;
        } else {
          for (const hd of this.hands) {
            const p = track(hd.keys, t);
            hd.ids.forEach((id, n) => c.pin(id, p.x + hd.off[n][0], p.y + hd.off[n][1], p.z + hd.off[n][2]));
          }
        }
      }
      const g = this.grab;
      if (g) {
        g.u = Math.min(1, g.u + dt / g.span);
        c.pin(g.i, g.from[0] + (g.to[0] - g.from[0]) * g.u, g.from[1] + (g.to[1] - g.from[1]) * g.u, g.from[2] + (g.to[2] - g.from[2]) * g.u);
      }
    }
    setGrab(i, target, frameDt) {
      const c = this.cloth;
      if (i === null || i === undefined) {
        if (this.grab) { c.unpin(this.grab.i); this.grab = null; this.restAt = null; this._still = 0; this.E0 = null; this._pendingE0 = true; }
        return;
      }
      const cur = this.grab && this.grab.i === i ? this.grab.to : [c.pos[3 * i], c.pos[3 * i + 1], c.pos[3 * i + 2]];
      const from = this.grab && this.grab.i === i
        ? [c.pinTarget[3 * i], c.pinTarget[3 * i + 1], c.pinTarget[3 * i + 2]] : cur;
      this.grab = { i, from, to: target, u: 0, span: frameDt };
      c.pin(i, from[0], from[1], from[2]);
      this.restAt = null; this._still = 0; this.E0 = null;
    }
    frame(frameDt) {
      const c = this.cloth;
      c.step(frameDt, this.substeps);
      if (this._pendingE0 && !this.grab) { this.E0 = this._etot(); this._pendingE0 = false; }
    }
    stats() {
      const c = this.cloth, e = c.energies();
      const E = e.ke + e.pe + e.stretch + e.bend;
      const held = !this.released || !!this.grab;
      if (!held) {
        if (e.ke / c.totalMass < 2e-5) { this._still += 1; if (this._still >= 3 && this.restAt === null) this.restAt = c.time; }
        else { this._still = 0; this.restAt = null; }
      }
      let vy = 0, mtot = 0;
      for (let i = 0; i < c.N; i++) { vy += c.vel[3 * i + 1] * c.mass[i]; mtot += c.mass[i]; }
      return {
        t: c.time, ke: e.ke, pe: e.pe, stretch: e.stretch, bend: e.bend,
        maxStrain: e.maxStrain, contact: e.contactFrac, vy: vy / mtot,
        dissipated: this.E0 === null ? null : this.E0 - E,
        held, restAt: this.restAt, mass: c.totalMass,
        bendLen: c.bendingLength(), h: c.hx
      };
    }
  }

  // ---------------------------------------------------------------- Runner
  // Runs the simulation in real time on a message port (a Web Worker's
  // `self`, or a local stand-in) and streams positions + measurements back.
  function serve(port) {
    const DT = 1 / 60;
    let sim = null, initOpt = null, running = true, scale = 1, budget = 0, last = 0;
    let simAcc = 0, realAcc = 0, speed = 1, stepMs = 0, posts = 0, dirty = true;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    port.onmessage = e => {
      const m = e.data;
      if (m.type === 'init') { initOpt = m.opt; sim = new SimController(m.opt); last = now(); dirty = true; tick(); return; }
      if (m.type === 'dims' && sim) {
        // a quilt of a new size: rebuild the cloth, keeping the fabric, solver and scene settings
        const c = sim.cloth, pillows = c.colliders.filter(b => b.name.startsWith('pillow')).every(b => b.enabled);
        sim = new SimController({ ...initOpt, params: { ...c.params }, substeps: sim.substeps, scenario: sim.scenario,
                                  dropHeight: sim.dropHeight, rot: sim.rot, pos: sim.pos, width: m.width, length: m.length, bed: m.bed || sim.bed });
        sim.cloth.selfCollision = c.selfCollision;
        for (const b of sim.cloth.colliders) if (b.name.startsWith('pillow')) b.enabled = pillows;
        budget = 0; dirty = true; return;
      }
      if (!sim) return;
      switch (m.type) {
        case 'reset': sim.reset(m.scenario, m.dropHeight, m.rot, m.pos); budget = 0; break;
        case 'params': sim.cloth.setParams(m.params); break;
        case 'substeps': sim.substeps = m.value; break;
        case 'pillows': for (const b of sim.cloth.colliders) if (b.name.startsWith('pillow')) b.enabled = m.value; break;
        case 'self': sim.cloth.selfCollision = m.value; break;
        case 'run': running = m.value; break;
        case 'speed': scale = m.value; break;
        case 'grab': sim.setGrab(m.i, m.target, DT); break;
      }
      dirty = true;
    };
    function post() {
      const c = sim.cloth, pos = new Float32Array(c.pos), hands = [];
      for (const hd of sim.hands) { const k = 3 * hd.ids[0]; hands.push(c.pinTarget[k], c.pinTarget[k + 1], c.pinTarget[k + 2]); }
      if (sim.grab) { const k = 3 * sim.grab.i; hands.push(c.pinTarget[k], c.pinTarget[k + 1], c.pinTarget[k + 2]); }
      const msg = { type: 'frame', pos, hands };
      if (posts++ % 4 === 0 || dirty) {
        msg.stats = sim.stats();
        msg.stats.speed = speed; msg.stats.stepMs = stepMs; msg.stats.running = running;
        msg.stats.scenario = sim.scenario;
      }
      dirty = false;
      port.postMessage(msg, [pos.buffer]);
    }
    function tick() {
      const t = now();
      let real = (t - last) / 1000; last = t;
      if (real > 0.25) real = 0.25;
      let n = 0;
      if (running) {
        budget += real * scale;
        const t0 = now();
        while (budget >= DT && n < 3) { sim.frame(DT); budget -= DT; n++; }
        if (n) stepMs = (now() - t0) / n;
        if (budget > DT) budget = DT; // can't keep up: run slower than real time, never skip physics
        simAcc += n * DT; realAcc += real * scale;
        if (realAcc > 1) { speed = simAcc / realAcc; simAcc = realAcc = 0; }
      }
      if (n || dirty) post();
      setTimeout(tick, n ? 0 : 6);
    }
  }

  return { Cloth, SimController, SCENARIOS, bedColliders, DEFAULT_BED, roundedBoxSDF, serve, GRAV, RHO_AIR, MATTRESS_TOP, surfaceTop };
})();
if (typeof module !== 'undefined') module.exports = ClothSim;
