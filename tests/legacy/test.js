const { Cloth, GRAV, RHO_AIR } = require('./physics.js');

const BED = [
  { name: 'frame',    c: [0, 0.23, 0],        h: [0.82, 0.13, 1.07],  r: 0.012, muScale: 0.8, enabled: true },
  { name: 'mattress', c: [0, 0.49, 0],        h: [0.76, 0.13, 1.015], r: 0.07,  muScale: 1.0, enabled: true },
  { name: 'head',     c: [0, 0.68, -1.095],   h: [0.84, 0.58, 0.025], r: 0.01,  muScale: 0.8, enabled: true },
  { name: 'pillowL',  c: [-0.36, 0.69, -0.72], h: [0.33, 0.07, 0.23], r: 0.065, muScale: 1.0, enabled: true },
  { name: 'pillowR',  c: [0.36, 0.69, -0.72],  h: [0.33, 0.07, 0.23], r: 0.065, muScale: 1.0, enabled: true },
];

function mk(n = 44) {
  return new Cloth({ nx: n, ny: n, width: 2.3, length: 2.3 });
}

// 1. Bending energy vs analytic cylinder: E = ½ B A / R²
{
  const c = mk(44);
  const R = 0.5;
  for (let i = 0; i < c.N; i++) {
    const u = c.pos[3 * i];           // arc-length coordinate across the width
    const th = u / R;
    c.pos[3 * i] = R * Math.sin(th);
    c.pos[3 * i + 1] = R * (1 - Math.cos(th));
  }
  c.vel.fill(0);
  const e = c.energies();
  const analytic = 0.5 * c.params.B * (2.3 * 2.3) / (R * R);
  console.log('Cylinder bend energy  discrete=%s J  analytic=%s J  ratio=%s',
    e.bend.toExponential(4), analytic.toExponential(4), (e.bend / analytic).toFixed(4));
}

// 2. Rigid motion must give zero bending energy.
{
  const c = mk(20);
  const a = 0.7;
  for (let i = 0; i < c.N; i++) {
    const x = c.pos[3 * i], y = c.pos[3 * i + 1], z = c.pos[3 * i + 2];
    c.pos[3 * i] = Math.cos(a) * x - Math.sin(a) * y + 0.3;
    c.pos[3 * i + 1] = Math.sin(a) * x + Math.cos(a) * y;
    c.pos[3 * i + 2] = z + 2;
  }
  console.log('Rigid motion bend energy (should be ~0):', c.energies().bend.toExponential(2));
}

// 3. Terminal velocity of a horizontal sheet in free fall.
{
  const c = mk(30);
  c.selfCollision = false;
  c.layFlat(0, 100, 0);
  for (let f = 0; f < 60 * 6; f++) c.step(1 / 60, 20);
  let vy = 0; for (let i = 0; i < c.N; i++) vy += c.vel[3 * i + 1]; vy /= c.N;
  const vt = Math.sqrt(2 * c.params.rhoA * GRAV / (RHO_AIR * c.params.Cd));
  console.log('Terminal velocity  sim=%s m/s  analytic=%s m/s', (-vy).toFixed(3), vt.toFixed(3));
}

// 4. Drop onto the bed: settle time, strain, energy, performance.
{
  const c = mk(44);
  c.colliders = BED;
  c.layFlat(0, 0.62 + 0.5, 0.2);
  // tiny symmetry-breaking noise (1 mm)
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < c.N; i++) { c.pos[3 * i + 1] += 0.001 * rnd(); }
  c.prev.set(c.pos);
  const e0 = c.energies();
  const E0 = e0.ke + e0.pe + e0.stretch + e0.bend;
  const t0 = Date.now();
  let restAt = null, still = 0;
  for (let f = 0; f < 60 * 8; f++) {
    c.step(1 / 60, 20);
    if (f % 6 === 0) {
      const e = c.energies();
      if (e.ke / c.totalMass < 5e-5) { still += 0.1; if (still > 0.75 && restAt === null) restAt = c.time; }
      else still = 0;
      if (f % 60 === 0) console.log(`  t=${c.time.toFixed(2)}s KE=${e.ke.toFixed(3)}J PE=${e.pe.toFixed(2)} stretch=${e.stretch.toExponential(2)} bend=${e.bend.toExponential(2)} maxStrain=${(e.maxStrain * 100).toFixed(2)}% contact=${(e.contactFrac * 100).toFixed(0)}%`);
    }
  }
  const ms = (Date.now() - t0) / (60 * 8);
  const e = c.energies();
  const E = e.ke + e.pe + e.stretch + e.bend;
  console.log('Mass %s kg; settled at %s s; dissipated %s J of %s J available',
    c.totalMass.toFixed(3), restAt && restAt.toFixed(2), (E0 - E).toFixed(2), (E0 - c.totalMass * GRAV * 0.62).toFixed(2));
  console.log('Avg compute per 1/60 s frame (20 substeps): %s ms', ms.toFixed(2));
  let miny = 9; for (let i = 0; i < c.N; i++) miny = Math.min(miny, c.pos[3 * i + 1]);
  console.log('Lowest point %s m; bending length %s cm; NaN? %s', miny.toFixed(3),
    (c.bendingLength() * 100).toFixed(2), c.pos.some(Number.isNaN));
}
